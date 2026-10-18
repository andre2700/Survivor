import Phaser from 'phaser';
import { Crack } from '../art/cracks';
import { frameName, framesOf, loopFrame } from '../art/textures';
import { areaMult, cooldownMult, damageMult, durationMult, projectileSpeedMult } from '../core/stats';
import { applyTagBonuses, countTags } from '../data/tags';
import { AWAKEN_EVERY, WEAPONS, capAmount, grandeur, weaponStatsAt, weaponTags, type WeaponDef, type WeaponId, type WeaponStats } from '../data/weapons';
import { controlScale } from '../data/enemies';
import type { Enemy, ProjectileKind } from '../entities';
import { LAYER, type GameScene } from '../scenes/GameScene';
import { sfx } from './sfx';

interface WeaponRuntime {
  id: WeaponId;
  def: WeaponDef;
  level: number;
  timer: number;
  /** stats finais (nível + tags + atributos globais), recalculados quando algo muda */
  stats: WeaponStats;
  /** dano total causado na partida (estatísticas) */
  dealt: number;
}

/** Distância de um ponto ao segmento a–b. */
function distToSegment(px: number, py: number, a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2));
  return Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t));
}

/**
 * Meia-lua de golpe (espada, machado): fina na cauda e grossa na lâmina, em camadas (halo, cor, fio),
 * de `tail` até `head` (rad) numa elipse de raios rx × ry em volta de (cx, cy).
 */
function drawCrescent(gfx: Phaser.GameObjects.Graphics, cx: number, cy: number, tail: number, head: number, rx: number, ry: number,
  layers: [thick: number, color: number, alpha: number][], alpha: number, steps = 14) {
  const pt = (a: number, r: number) => ({ x: cx + Math.cos(a) * rx * r, y: cy + Math.sin(a) * ry * r });
  for (const [thick, c, al] of layers) {
    const outer: { x: number; y: number }[] = [];
    const inner: { x: number; y: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const a = tail + (head - tail) * u;
      outer.push(pt(a, 1.05));
      inner.push(pt(a, 1.05 - thick * u ** 1.4));
    }
    gfx.fillStyle(c, al * alpha).fillPoints([...outer, ...inner.reverse()], true);
  }
}

/** Efeito em andamento (onda, rachadura, tornado): chamado a cada quadro até devolver false. */
type Live = (dt: number) => boolean;

/** Executa os ataques automáticos de todas as armas. Cada padrão é implementado uma única vez. */
export class WeaponSystem {
  private list: WeaponRuntime[] = [];
  private live: Live[] = [];
  /** tornado gigante (nv 20+) em volta do herói */
  private giant = false;
  /** disparos da Onda nv 20+: o Tsunami sai a cada 3 */
  private tsunamiCount = 0;
  /** disparos da Bola de Fogo nv 20+: o Meteoro sai a cada 2 */
  private meteorCount = 0;
  /** machadadas em andamento (limite de golpes simultâneos) */
  private cleaving = 0;
  /** Passos Sísmicos: distância andada desde o último tremor */
  private walked = 0;
  private lastPos: { x: number; y: number } | null = null;
  private orbs: Phaser.GameObjects.Image[] = [];
  private orbAngle = 0;
  private aura?: Phaser.GameObjects.Image;

  constructor(private scene: GameScene) {}

  /** Sincroniza com o loadout e recalcula os stats finais de todas as armas. */
  sync(weapons: Partial<Record<WeaponId, number>>) {
    for (const [id, level] of Object.entries(weapons) as [WeaponId, number][]) {
      const existing = this.list.find((w) => w.id === id);
      if (existing) existing.level = level;
      else this.list.push({ id, def: WEAPONS[id], level, timer: 0.3, stats: WEAPONS[id].base, dealt: 0 });
    }
    this.refresh();
  }

  refresh() {
    const g = this.scene.stats;
    const counts = countTags(this.list.map((w) => weaponTags(w.def)));
    for (const w of this.list) {
      const s = { ...weaponStatsAt(w.def, w.level) };
      applyTagBonuses(s, weaponTags(w.def), counts);
      s.damage *= damageMult(g);
      s.cooldown *= cooldownMult(g);
      s.area *= areaMult(g);
      s.speed *= w.def.pattern === 'orbit' ? 1 : projectileSpeedMult(g);
      s.duration *= durationMult(g);
      s.amount += Math.floor(g.amount);
      s.pierce += Math.floor(g.pierce);
      w.stats = capAmount(s);
    }
  }

  get tagCounts() {
    return countTags(this.list.map((w) => weaponTags(w.def)));
  }

  private dmg(w: WeaponRuntime) {
    return w.stats.damage * (0.9 + Math.random() * 0.2);
  }

  private hit(w: WeaponRuntime, e: Enemy, knock: number, mult = 1) {
    w.dealt += this.scene.hitEnemy(e, this.dmg(w) * mult, knock, w.def.element, true, w.stats.effect);
  }

  /** Empurrão numa direção (onda, explosões); chefes não são empurrados; a Resistência reduz ou anula. */
  private push(e: Enemy, dx: number, dy: number, force: number) {
    if (e.boss || !e.active) return;
    const f = force * e.def.knockback * this.scene.control(e);
    e.kbX += dx * f;
    e.kbY += dy * f;
  }

  /** Dano em área a partir de um ponto, com empurrão para fora. */
  private burst(w: WeaponRuntime, x: number, y: number, radius: number, mult: number, force: number) {
    this.scene.queryEnemies(x, y, radius + 16, (e) => {
      const d = Math.hypot(e.x - x, e.y - y) || 1;
      if (d > radius + e.radius) return;
      this.hit(w, e, 0, mult);
      this.push(e, (e.x - x) / d, (e.y - y) / d, force);
    });
  }

  update(dt: number) {
    const live = this.live;
    this.live = [];
    for (const f of live) if (f(dt)) this.live.push(f);
    for (const w of this.list) {
      if (w.def.pattern === 'orbit') {
        this.updateOrbs(w, dt);
        continue;
      }
      if (w.def.pattern === 'tremor') {
        this.updateTremor(w);
        continue;
      }
      if (w.def.pattern === 'aura') this.updateAuraVisual(w);
      w.timer -= dt;
      if (w.timer > 0) continue;
      const fired = this.fire(w);
      if (fired && w.id === this.scene.char.weapon) this.scene.playerAttack();
      w.timer = fired ? w.stats.cooldown : 0.1;
    }
  }

  private fire(w: WeaponRuntime): boolean {
    switch (w.def.pattern) {
      case 'nearest':
        return this.fireNearest(w);
      case 'volley':
        return this.fireVolley(w);
      case 'cleave':
        return this.fireCleave(w);
      case 'hammer':
        return this.fireHammer(w);
      case 'arc':
        return this.fireArc(w);
      case 'aura':
        return this.tickAura(w);
      case 'strike':
        return this.fireStrike(w);
      case 'wave':
        return this.fireWave(w);
      case 'fissure':
        return this.fireFissure(w);
      case 'tornado':
        return this.fireTornado(w);
      case 'laser':
        return this.fireLaser(w);
      case 'fireball':
        return this.fireFireball(w);
      default:
        return false;
    }
  }

  private shoot(w: WeaponRuntime, kind: ProjectileKind, texture: string, x: number, y: number, vx: number, vy: number) {
    const p = this.scene.projectiles.get();
    if (!p) return;
    p.fire(kind, w.def.projectile ?? texture, x, y, vx, vy, this.dmg(w), w.stats.pierce, w.stats.duration, w.stats.area, w.def.element, w.stats.effect);
    p.owner = w.id;
    if (w.level >= AWAKEN_EVERY) p.setTint(0xffe9a8);
    else p.clearTint();
  }

  private fireNearest(w: WeaponRuntime): boolean {
    const p = this.scene.player;
    const s = w.stats;
    const targets = this.scene.nearestEnemies(p.x, p.y, s.amount, 260);
    if (targets.length === 0) return false;
    for (let i = 0; i < s.amount; i++) {
      const t = targets[i % targets.length];
      const a = Math.atan2(t.y - p.y, t.x - p.x) + (i >= targets.length ? (i - targets.length + 1) * 0.15 : 0);
      this.shoot(w, 'bolt', 'proj_bolt', p.x, p.y - 4, Math.cos(a) * s.speed, Math.sin(a) * s.speed);
    }
    return true;
  }

  private fireVolley(w: WeaponRuntime): boolean {
    const p = this.scene.player;
    const s = w.stats;
    // no inimigo mais próximo; sem ninguém por perto, na direção do movimento
    const target = this.scene.nearestEnemies(p.x, p.y, 1, 300)[0];
    const a = target ? Math.atan2(target.y - p.y, target.x - p.x) : Math.atan2(this.scene.facing.y, this.scene.facing.x);
    const fx = Math.cos(a);
    const fy = Math.sin(a);
    for (let i = 0; i < s.amount; i++) {
      this.scene.time.delayedCall(i * 60, () => {
        const off = (i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2) * 5;
        this.shoot(w, 'knife', 'proj_knife', p.x - fy * off, p.y - 3 + fx * off, fx * s.speed, fy * s.speed);
      });
    }
    return true;
  }

  private fireArc(w: WeaponRuntime): boolean {
    // golpeia o inimigo mais próximo ao alcance da lâmina; sem ninguém ao alcance, na direção do
    // movimento (joystick; parado, mantém a última direção)
    const p = this.scene.player;
    const f = this.scene.facing;
    const target = this.scene.nearestEnemies(p.x, p.y, 1, 56 * w.stats.area + 14)[0];
    const angle = target ? Math.atan2(target.y - p.y, target.x - p.x) : Math.atan2(f.y, f.x);
    for (let i = 0; i < w.stats.amount; i++) {
      // 1º golpe para frente, 2º para trás, os seguintes alternam com leve atraso
      this.scene.time.delayedCall(i * 140, () => this.slash(w, i % 2 === 0 ? angle : angle + Math.PI));
    }
    return true;
  }

  private slash(w: WeaponRuntime, angle: number) {
    const p = this.scene.player;
    const width = 56 * w.stats.area;
    const height = 36 * w.stats.area;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const cx = p.x + cos * (width / 2 + 2);
    const cy = p.y - 2 + sin * (width / 2 + 2);
    // traço em meia-lua em volta do herói: corta de um lado ao outro em 0,1 s e some
    const awakened = w.level >= AWAKEN_EVERY;
    const steel = awakened ? 0xffd27a : 0xdfe9f5;
    const edge = awakened ? 0xfff6d8 : 0xffffff;
    const gfx = this.scene.add.graphics().setDepth(LAYER.fx);
    const rx = width * 0.95;
    const ry = width * 0.75;
    const sweep = 2.1;
    const from = angle - sweep / 2;
    let t = 0;
    let sparked = false;
    this.live.push((dt) => {
      t += dt;
      const k = Math.min(1, t / 0.1);
      const head = from + sweep * (1 - (1 - k) ** 2);
      const fade = t < 0.1 ? 1 : Math.max(0, 1 - (t - 0.1) / 0.14);
      gfx.clear();
      drawCrescent(gfx, p.x, p.y - 6, Math.max(from, head - 1.8), head, rx, ry, [[0.42, steel, 0.25], [0.24, steel, 0.8], [0.08, edge, 1]], fade, 12);
      // linhas de velocidade por fora do arco
      gfx.lineStyle(1, edge, 0.6 * fade);
      for (let i = 0; i < 3; i++) {
        const a = head - 0.35 - i * 0.3;
        const r = 1.12 + i * 0.05;
        gfx.lineBetween(p.x + Math.cos(a) * rx * r, p.y - 6 + Math.sin(a) * ry * r, p.x + Math.cos(a + 0.22) * rx * r, p.y - 6 + Math.sin(a + 0.22) * ry * r);
      }
      if (k >= 1 && !sparked) {
        sparked = true;
        // brilho na ponta, onde o golpe termina
        const tx = p.x + Math.cos(head) * rx;
        const ty = p.y - 6 + Math.sin(head) * ry;
        const star = this.scene.add.image(tx, ty, 'atlas', frameName('glow')).setTint(edge).setBlendMode(Phaser.BlendModes.ADD).setScale(0.5).setDepth(LAYER.fx + 1);
        this.scene.tweens.add({ targets: star, scale: 0.1, alpha: 0, duration: 180, onComplete: () => star.destroy() });
        this.scene.sparks.explode(4, tx, ty);
      }
      if (t < 0.24) return true;
      gfx.destroy();
      return false;
    });
    // despertada: a lâmina se solta e voa à frente
    if (grandeur(w.level) >= 2) {
      const pr = this.scene.projectiles.get();
      if (pr) {
        pr.fire('knife', 'slash', cx, cy - 6, cos * 260, sin * 260, this.dmg(w) * 0.8, 999, 0.55, w.stats.area * 0.9, w.def.element, w.stats.effect);
        pr.owner = w.id;
        pr.setTint(0xffe9a8).setBlendMode(Phaser.BlendModes.ADD);
      }
    }
    // área do golpe: retângulo girado na direção do ataque
    this.scene.queryEnemies(cx, cy, Math.max(width, height), (e) => {
      const dx = e.x - cx;
      const dy = e.y - cy;
      const u = dx * cos + dy * sin;
      const v = -dx * sin + dy * cos;
      if (Math.abs(u) < width / 2 + e.radius && Math.abs(v) < height / 2 + e.radius) this.hit(w, e, 1);
    });
  }

  private updateAuraVisual(w: WeaponRuntime) {
    const p = this.scene.player;
    if (!this.aura) {
      // anel de chamas no chão (arte), tremulando
      this.aura = this.scene.add.image(p.x, p.y, 'atlas', frameName('fx_firering')).setDepth(LAYER.groundFx).setOrigin(0.5, 0.55);
      this.scene.tweens.add({ targets: this.aura, alpha: { from: 0.8, to: 1 }, duration: 160, yoyo: true, repeat: -1 });
    }
    const radius = 40 * w.stats.area;
    const flicker = 1 + Math.sin(this.scene.elapsed * 18) * 0.03;
    this.aura.setPosition(p.x, p.y + 6).setScale(((radius * 2.3) / 96) * flicker).setFlipX(Math.floor(this.scene.elapsed * 7) % 2 === 0)
      .setFrame(loopFrame('fx_firering', this.scene.elapsed, 9));
    // labaredas subindo da borda do anel
    for (let i = 0; i < 2; i++) {
      const a = Math.random() * Math.PI * 2;
      this.scene.emitFlame(p.x + Math.cos(a) * radius * 0.95, p.y + 6 + Math.sin(a) * radius * 0.68);
    }
  }

  private tickAura(w: WeaponRuntime): boolean {
    const p = this.scene.player;
    const radius = 40 * w.stats.area;
    this.scene.queryEnemies(p.x, p.y, radius + 16, (e) => {
      const r = radius + e.radius;
      if (Phaser.Math.Distance.Squared(p.x, p.y, e.x, e.y) < r * r) this.hit(w, e, 0.3);
    });
    return true;
  }

  private updateOrbs(w: WeaponRuntime, dt: number) {
    const s = w.stats;
    while (this.orbs.length < s.amount) {
      this.orbs.push(this.scene.add.image(0, 0, 'atlas', frameName('proj_orb')).setDepth(LAYER.fx).setBlendMode(Phaser.BlendModes.ADD).setScale(1.3));
    }
    const p = this.scene.player;
    const radius = 50 * s.area;
    this.orbAngle += s.speed * dt;
    const now = this.scene.elapsed;
    this.orbs.forEach((orb, i) => {
      const a = this.orbAngle + (i / this.orbs.length) * Math.PI * 2;
      orb.setPosition(p.x + Math.cos(a) * radius, p.y - 4 + Math.sin(a) * radius * 0.85);
      if (w.level >= AWAKEN_EVERY) orb.setTint(0xffe9a8);
      this.scene.queryEnemies(orb.x, orb.y, 24, (e) => {
        if (now - e.orbHitAt < s.cooldown) return;
        const r = 8 + e.radius;
        if (Phaser.Math.Distance.Squared(orb.x, orb.y, e.x, e.y) < r * r) {
          e.orbHitAt = now;
          this.hit(w, e, 0.6);
        }
      });
    });
  }

  private fireStrike(w: WeaponRuntime): boolean {
    const view = this.scene.cameras.main.worldView;
    const visible = this.scene.activeEnemies().filter((e) => view.contains(e.x, e.y));
    if (visible.length === 0) return false;
    Phaser.Utils.Array.Shuffle(visible);
    const radius = 28 * w.stats.area;
    // saltos do raio despertado: todos desenhados num só gráfico por disparo
    const chains = grandeur(w.level) >= 2 ? this.scene.add.graphics().setDepth(LAYER.fx + 1).setBlendMode(Phaser.BlendModes.ADD) : null;
    for (let i = 0; i < Math.min(w.stats.amount, visible.length); i++) {
      const tx = visible[i].x;
      const ty = visible[i].y;
      this.drawBolt(tx, ty, view.y - 10, w.level >= AWAKEN_EVERY);
      this.scene.queryEnemies(tx, ty, radius + 16, (e) => {
        const r = radius + e.radius;
        if (Phaser.Math.Distance.Squared(tx, ty, e.x, e.y) < r * r) this.hit(w, e, 0.5);
      });
      // despertado: o raio salta para os inimigos ao redor
      if (chains) this.chainBolt(w, chains, tx, ty, 2 + grandeur(w.level));
    }
    if (chains) this.scene.tweens.add({ targets: chains, alpha: 0, duration: 240, onComplete: () => chains.destroy() });
    sfx('zap');
    return true;
  }

  private drawBolt(x: number, y: number, top: number, awakened: boolean) {
    const g = this.scene.add.graphics().setDepth(LAYER.fx + 1);
    const pts: Phaser.Math.Vector2[] = [];
    const segments = 8;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const jitter = i === 0 || i === segments ? 0 : (Math.random() * 2 - 1) * 8;
      pts.push(new Phaser.Math.Vector2(x + jitter, top + (y - top) * t));
    }
    const c = awakened ? 0xffcd75 : 0x73eff7;
    g.setBlendMode(Phaser.BlendModes.ADD);
    g.lineStyle(7, c, 0.25).strokePoints(pts);
    g.lineStyle(3, c, 1).strokePoints(pts);
    g.lineStyle(1, 0xffffff, 1).strokePoints(pts);
    g.fillStyle(c, 0.35).fillCircle(x, y, 14);
    g.fillStyle(0xffffff, 0.9).fillCircle(x, y, 5);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
    this.scene.impact(x, y, c);
  }

  /** Raio despertado: salta do ponto atingido para os inimigos mais próximos. */
  private chainBolt(w: WeaponRuntime, g: Phaser.GameObjects.Graphics, x: number, y: number, jumps: number) {
    const near = this.scene.nearestEnemies(x, y, jumps + 1, 110).slice(1);
    let px = x;
    let py = y - 6;
    for (const e of near) {
      g.lineStyle(5, 0x73eff7, 0.3).lineBetween(px, py, e.x, e.y - 6);
      g.lineStyle(2, 0xffffff, 1).lineBetween(px, py, e.x, e.y - 6);
      this.hit(w, e, 0.3, 0.6);
      px = e.x;
      py = e.y - 6;
    }
  }

  // ---------- Onda (Água) ----------

  private foamEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;

  /** Espuma branca subindo da base das ondas (um emissor para todas). */
  private foam() {
    this.foamEmitter ??= this.scene.add.particles(0, 0, 'atlas', {
      frame: frameName('glow'),
      speedY: { min: -26, max: -6 },
      speedX: { min: -14, max: 14 },
      lifespan: { min: 280, max: 480 },
      scale: { start: 0.22, end: 0.05 },
      alpha: { start: 0.95, end: 0 },
      tint: [0xffffff, 0xe6f7ff, 0xbfe8ff],
      emitting: false,
    }).setDepth(LAYER.fx + 1);
    return this.foamEmitter;
  }

  private fireWave(w: WeaponRuntime): boolean {
    const p = this.scene.player;
    const target = this.scene.nearestEnemies(p.x, p.y, 1, 280)[0];
    const f = this.scene.facing;
    const base = target ? Math.atan2(target.y - p.y, target.x - p.x) : Math.atan2(f.y, f.x);
    const g = grandeur(w.level);
    const n = w.stats.amount;
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.5;
      this.wave(w, a, g);
      // Maremoto: ondas para os dois lados, que estouram no fim
      if (g >= 2) this.wave(w, a + Math.PI, g);
    }
    // Tsunami: uma onda gigante cruza a tela inteira
    if (g >= 3 && ++this.tsunamiCount % 3 === 1) this.wave(w, base, g, { back: 240, width: 380, speed: 440, range: 520, mult: 2.5, alpha: 0.7 });
    sfx('splash');
    return true;
  }

  private wave(w: WeaponRuntime, angle: number, g: number, o: { back?: number; width?: number; speed?: number; range?: number; mult?: number; alpha?: number } = {}) {
    const s = w.stats;
    const p = this.scene.player;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x0 = p.x - cos * (o.back ?? 0);
    const y0 = p.y - sin * (o.back ?? 0);
    const width0 = o.width ?? 60 * s.area * (g >= 2 ? 1.35 : 1);
    const speed = o.speed ?? s.speed;
    const range = o.range ?? s.speed * s.duration;
    const hit = new Set<number>();
    let traveled = 6;
    // a arte é uma onda de perfil quebrando para a direita: fica sempre em pé, espelhada para o lado
    // do movimento e inclinada no máximo ~30° (subindo ou descendo, a crista fica de frente)
    const left = cos < 0;
    const tilt = Phaser.Math.Clamp(Math.atan2(sin, Math.abs(cos)), -0.5, 0.5);
    const vertical = Math.abs(sin);
    // a base da arte se dissolve sobre uma lâmina d'água no chão, com espuma onde a onda encosta
    const img = this.scene.add.image(x0, y0, 'atlas', frameName('fx_wave')).setOrigin(0.5, 0.86).setFlipX(left).setRotation(left ? -tilt : tilt).setDepth(LAYER.fx);
    if (w.level >= AWAKEN_EVERY) img.setTint(0xd8f4ff);
    const sheet = this.scene.add.image(x0, y0, 'atlas', frameName('glow')).setTint(0x5fc4ff).setAlpha(0.55).setDepth(LAYER.groundFx);
    const foam = this.foam();
    this.live.push((dt) => {
      traveled += speed * dt;
      const k = Math.min(1, traveled / range);
      // nv 5+: a onda cresce enquanto avança
      const width = width0 * (g >= 1 ? 0.8 + k * 0.7 : 1);
      const cx = x0 + cos * traveled;
      const cy = y0 + sin * traveled;
      // de lado, a largura da faixa é a altura da onda; na vertical, é a largura dela
      const sc = (width / 54) * (1 - vertical) + (width / 64) * vertical;
      const fade = (o.alpha ?? 1) * (k > 0.8 ? (1 - k) * 5 : 1);
      img.setPosition(cx, cy).setScale(sc).setDepth(cy).setAlpha(fade).setFrame(loopFrame('fx_wave', traveled / speed, 8));
      // lâmina d'água: larga no sentido da crista, achatada no chão
      const along = width * (1 - vertical) * 0.5 + width * vertical * 1.1;
      const across = width * (1 - vertical) * 1.1 + width * vertical * 0.5;
      sheet.setPosition(cx - cos * 6, cy - sin * 6 + 2).setDisplaySize(along * 1.3, across * 0.5).setAlpha(0.55 * fade);
      for (let i = 0; i < 3; i++) {
        const r = Math.random() - 0.5;
        foam.emitParticleAt(cx - sin * r * width * 0.9 + cos * 4, cy + cos * r * width * 0.35 + sin * 4, 1);
      }
      this.scene.queryEnemies(cx, cy, width, (e) => {
        if (hit.has(e.uid)) return;
        const dx = e.x - x0;
        const dy = e.y - y0;
        const u = dx * cos + dy * sin;
        const v = -dx * sin + dy * cos;
        if (Math.abs(u - traveled) > 14 + e.radius || Math.abs(v) > width / 2 + e.radius) return;
        hit.add(e.uid);
        this.hit(w, e, 0, o.mult ?? 1);
        this.push(e, cos, sin, 170);
      });
      if (k < 1) return true;
      img.destroy();
      sheet.destroy();
      if (g >= 2 && !o.width) {
        // a onda arrebenta no fim
        this.scene.impact(cx, cy, 0x41a6f6, 1.6);
        this.burst(w, cx, cy, 42 * s.area, 1.2, 140);
      }
      return false;
    });
  }

  // ---------- Fissura (Terra) ----------

  private fireFissure(w: WeaponRuntime): boolean {
    const p = this.scene.player;
    const g = grandeur(w.level);
    const s = w.stats;
    const view = this.scene.cameras.main.worldView;
    const visible = this.scene.activeEnemies().filter((e) => view.contains(e.x, e.y));
    const f = this.scene.facing;
    for (let i = 0; i < s.amount; i++) {
      const t = visible.length ? visible[Math.floor(Math.random() * visible.length)] : null;
      const a = t ? Math.atan2(t.y - p.y, t.x - p.x) : Math.atan2(f.y, f.x) + (i - (s.amount - 1) / 2) * 0.6;
      this.crack(w, p.x, p.y + 4, a, s.speed * s.duration * (g >= 2 ? 1.3 : 1), g, 0);
    }
    // Terremoto: o chão treme; nv 20: abalo em todos os inimigos da tela
    if (g >= 2) this.scene.cameras.main.shake(260, g >= 3 ? 0.012 : 0.006);
    if (g >= 3) {
      for (const e of visible) {
        this.hit(w, e, 0, 0.5);
        this.spike(e.x, e.y + 4, 0.8);
      }
    }
    sfx('boom');
    return true;
  }

  private crack(w: WeaponRuntime, x: number, y: number, angle: number, length: number, g: number, depth: number) {
    const s = w.stats;
    const step = 16 * s.area;
    const segs = Math.max(2, Math.ceil(length / step));
    const interval = s.duration / segs;
    const hit = new Set<number>();
    const gfx = this.scene.add.graphics().setDepth(LAYER.groundFx);
    const line = new Crack(x, y, 5 * s.area * (depth ? 0.7 : 1));
    let cx = x;
    let cy = y;
    let i = 0;
    let acc = interval;
    this.live.push((dt) => {
      acc += dt;
      while (acc >= interval && i < segs) {
        acc -= interval;
        i++;
        const a = angle + (Math.random() - 0.5) * 0.8;
        const nx = cx + Math.cos(a) * step;
        const ny = cy + Math.sin(a) * step;
        line.extend(nx, ny);
        gfx.clear();
        line.draw(gfx);
        this.spike(nx, ny, s.area * (depth ? 0.7 : 0.9) * (0.8 + Math.random() * 0.4));
        this.scene.queryEnemies(nx, ny, 20 * s.area + 16, (e) => {
          if (hit.has(e.uid)) return;
          if ((e.x - nx) ** 2 + (e.y - ny) ** 2 > (20 * s.area + e.radius) ** 2) return;
          hit.add(e.uid);
          this.hit(w, e, 0.2);
        });
        // nv 5+: a rachadura se divide no meio
        if (depth === 0 && g >= 1 && i === Math.floor(segs / 2)) {
          this.crack(w, nx, ny, angle + (Math.random() < 0.5 ? 0.9 : -0.9), length * 0.5, g, 1);
        }
        cx = nx;
        cy = ny;
      }
      if (i < segs) return true;
      if (g >= 2 && depth === 0) {
        // Terremoto: erupção de pedras no fim da rachadura
        for (let k = 0; k < 6; k++) this.spike(cx + Math.cos(k) * 22 * s.area, cy + Math.sin(k) * 16 * s.area, s.area * 1.3);
        this.scene.impact(cx, cy, 0xc69c6d, 2);
        this.burst(w, cx, cy, 46 * s.area, 1.8, 120);
      }
      // o rastro some junto com os espinhos
      this.scene.tweens.add({ targets: gfx, alpha: 0, delay: 200, duration: 350, onComplete: () => gfx.destroy() });
      return false;
    });
  }

  /** Espinho de pedra que brota do chão e afunda. */
  private spike(x: number, y: number, scale: number) {
    const img = this.scene.add.image(x, y, 'atlas', frameName('fx_spike')).setOrigin(0.5, 0.9).setDepth(y).setScale(scale * 0.3, 0);
    this.scene.tweens.add({ targets: img, scaleX: scale, scaleY: scale, duration: 90, ease: 'Back.Out' });
    // brota (quadro 1) e fica de pé (quadro 2)
    if (framesOf('fx_spike') > 1) this.scene.time.delayedCall(110, () => img.active && img.setFrame(frameName('fx_spike', 1)));
    this.scene.tweens.add({ targets: img, scaleY: 0, alpha: 0, delay: 420, duration: 260, ease: 'Quad.In', onComplete: () => img.destroy() });
  }

  // ---------- Tornado (Ar) ----------

  private fireTornado(w: WeaponRuntime): boolean {
    const p = this.scene.player;
    const g = grandeur(w.level);
    const f = this.scene.facing;
    const base = Math.atan2(f.y, f.x);
    for (let i = 0; i < w.stats.amount; i++) {
      const a = base + (i - (w.stats.amount - 1) / 2) * 0.9;
      this.tornado(w, p.x + Math.cos(a) * 24, p.y + Math.sin(a) * 24, a, g, false);
    }
    if (g >= 3 && !this.giant) this.tornado(w, p.x, p.y, 0, g, true);
    sfx('whoosh');
    return true;
  }

  private tornado(w: WeaponRuntime, x: number, y: number, angle: number, g: number, giant: boolean) {
    const s = w.stats;
    const life = s.duration * (giant ? 2 : 1);
    const r0 = 20 * s.area * (giant ? 2.4 : 1);
    const hits = new Map<number, number>();
    const seed = Math.random() * 10;
    let t = 0;
    let hx = x;
    let hy = y;
    let dir = angle;
    let orbit = Math.random() * Math.PI * 2;
    if (giant) this.giant = true;
    const img = this.scene.add.image(x, y, 'atlas', frameName('fx_tornado')).setOrigin(0.5, 0.92);
    if (w.level >= AWAKEN_EVERY) img.setTint(0xe8ffd8);
    this.live.push((dt) => {
      t += dt;
      const k = t / life;
      // nv 5+: cresce com o tempo; nasce e some suavemente
      const r = r0 * (g >= 1 ? 1 + 0.5 * k : 1) * Math.min(1, t * 6);
      const p = this.scene.player;
      if (giant) {
        orbit += dt * 1.1;
        hx = p.x + Math.cos(orbit) * 70;
        hy = p.y + Math.sin(orbit) * 55;
      } else {
        // Ciclone (nv 10+): persegue o inimigo mais próximo
        const target = g >= 2 ? this.scene.nearestEnemies(hx, hy, 1, 220)[0] : undefined;
        if (target) {
          const want = Math.atan2(target.y - hy, target.x - hx);
          dir += Phaser.Math.Angle.Wrap(want - dir) * Math.min(1, dt * 3);
        }
        dir += Math.sin(t * 3 + seed) * dt * 1.6;
        hx += Math.cos(dir) * s.speed * dt;
        hy += Math.sin(dir) * s.speed * dt;
      }
      img.setFrame(loopFrame('fx_tornado', t, 12));
      img.setPosition(hx, hy).setScale((r * 2.4) / 60).setRotation(Math.sin(t * 14) * 0.1).setDepth(hy).setAlpha(k > 0.85 ? (1 - k) / 0.15 : 1);
      const pull = r * 2.4;
      this.scene.queryEnemies(hx, hy, pull, (e) => {
        const dx = hx - e.x;
        const dy = hy - e.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > pull) return;
        if (!e.boss) {
          // puxa para o centro do redemoinho (menos forte em quem tem Resistência)
          const m = Math.min(d, 70 * dt * controlScale(e.resist));
          e.x += (dx / d) * m;
          e.y += (dy / d) * m;
        }
        if (d < r + e.radius && t - (hits.get(e.uid) ?? -9) >= 0.3) {
          hits.set(e.uid, t);
          this.hit(w, e, 0);
        }
      });
      if (k < 1) return true;
      img.destroy();
      if (giant) this.giant = false;
      if (g >= 2) {
        // o ciclone estoura e arremessa tudo ao redor
        this.scene.impact(hx, hy, 0xa7f070, 1.8);
        this.burst(w, hx, hy, r * 2.2, 1.5, 220);
      }
      return false;
    });
  }

  // ---------- Machado de duas mãos (Bárbaro) ----------

  /**
   * Machadada pesada: um golpe largo e lento à frente (no inimigo mais próximo ao alcance, senão na
   * direção do movimento) que termina num impacto no chão. Nv 5: o impacto racha o chão em volta;
   * nv 10: solta uma onda de choque; nv 20: o golpe vira um giro completo (redemoinho).
   */
  private fireCleave(w: WeaponRuntime): boolean {
    // no máximo 4 golpes na tela ao mesmo tempo (velocidade de ataque altíssima): o próximo espera
    if (this.cleaving >= 4) return false;
    const p = this.scene.player;
    const f = this.scene.facing;
    const reach = 62 * w.stats.area;
    const target = this.scene.nearestEnemies(p.x, p.y, 1, reach + 14)[0];
    const angle = target ? Math.atan2(target.y - p.y, target.x - p.x) : Math.atan2(f.y, f.x);
    for (let i = 0; i < w.stats.amount; i++) {
      // golpes extras alternam para trás e para os lados
      const a = angle + [0, Math.PI, Math.PI / 2, -Math.PI / 2][i % 4];
      this.scene.time.delayedCall(i * 220, () => this.cleave(w, a, reach));
    }
    return true;
  }

  private cleave(w: WeaponRuntime, angle: number, reach: number) {
    const scene = this.scene;
    const p = scene.player;
    const g = grandeur(w.level);
    const spin = g >= 3;
    // arco largo: o machado desce de um lado ao outro (ou dá a volta toda no redemoinho)
    const sweep = spin ? Math.PI * 2 : 2.4;
    const a0 = angle - sweep / 2;
    // mistura normal: luz aditiva sobre a grama puxa para o verde
    const gfx = scene.add.graphics().setDepth(LAYER.fx);
    const awakened = w.level >= AWAKEN_EVERY;
    const color = awakened ? 0xffcf6a : 0xe9eef5;
    const edge = awakened ? 0xfff6d8 : 0xffffff;
    // o próprio machado gira na ponta do golpe
    const axe = scene.add.image(p.x, p.y, 'icon_greataxe').setDepth(LAYER.fx + 1).setScale(reach / 40);
    const dur = spin ? 0.32 : 0.22;
    const fade = 0.16;
    let t = 0;
    let struck = false;
    const hit = new Set<number>();
    this.cleaving++;
    const rx = reach * 0.85;
    const ry = reach * 0.68;
    const pt = (a: number, r: number) => ({ x: p.x + Math.cos(a) * rx * r, y: p.y - 4 + Math.sin(a) * ry * r });
    this.live.push((dt) => {
      t += dt;
      const k = Math.min(1, t / dur);
      const ease = 1 - (1 - k) ** 3;
      const a1 = a0 + sweep * ease;
      const alpha = k < 1 ? 1 : Math.max(0, 1 - (t - dur) / fade);
      // meia-lua: fina na cauda e grossa na lâmina, com borda clara de fio
      gfx.clear();
      drawCrescent(gfx, p.x, p.y - 4, Math.max(a0, a1 - 2.4), a1, rx, ry, [[0.5, color, 0.22], [0.32, color, 0.75], [0.12, edge, 0.95]], alpha);
      // a arte tem a lâmina à esquerda e o cabo à direita: girada para o cabo apontar para o herói
      const at = pt(a1, 0.72);
      axe.setPosition(at.x, at.y).setRotation(a1 + Math.PI).setAlpha(alpha);
      // dano em quem a lâmina já varreu (só enquanto ela está descendo)
      if (k < 1 || !struck) scene.queryEnemies(p.x, p.y, reach + 20, (e) => {
        if (hit.has(e.uid)) return;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        if (Math.hypot(dx, dy) > reach + e.radius) return;
        const rel = (Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - a0) + Math.PI * 2) % (Math.PI * 2);
        const swept = a1 - a0;
        if (rel > swept + 0.3 && rel < Math.PI * 2 - 0.3) return;
        hit.add(e.uid);
        this.hit(w, e, 1.8);
      });
      if (k >= 1 && !struck) {
        struck = true;
        // impacto no chão onde o machado bate: peso, mas sem sacudir demais a tela
        const ix = p.x + Math.cos(angle) * reach * 0.7;
        const iy = p.y + Math.sin(angle) * reach * 0.55;
        scene.impact(ix, iy, 0xffe0a0, 1.1 + g * 0.2);
        // poeira só quando não há muitos efeitos na tela (desempenho)
        if (this.live.length < 40) this.dust(ix, iy, 4 + g);
        scene.cameras.main.shake(70, 0.0015);
        sfx('boom');
        if (g >= 1) this.quakeCracks(ix, iy, 3 + g, reach * 0.6);
        if (g >= 2) this.shockwave(w, ix, iy, reach * 1.3);
      }
      if (t < dur + fade) return true;
      gfx.destroy();
      axe.destroy();
      this.cleaving--;
      return false;
    });
    sfx('whoosh');
  }

  /** Poeira subindo do chão (machadada). */
  private dust(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const d = this.scene.add.image(x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 8, 'atlas', frameName('glow'))
        .setTint(0xc8a878).setAlpha(0.55).setScale(0.25 + Math.random() * 0.2).setDepth(LAYER.fx);
      const a = Math.PI + Math.random() * Math.PI;
      this.scene.tweens.add({
        targets: d, x: d.x + Math.cos(a) * 22, y: d.y + Math.sin(a) * 14, scale: d.scale * 1.8, alpha: 0,
        duration: 380 + Math.random() * 200, ease: 'Quad.Out', onComplete: () => d.destroy(),
      });
    }
  }

  /** Rachaduras curtas saindo de um ponto (só visual). */
  private quakeCracks(x: number, y: number, n: number, len: number) {
    const g = this.scene.add.graphics().setDepth(LAYER.groundFx);
    Crack.burst(g, x, y, n, len, 4);
    this.scene.tweens.add({ targets: g, alpha: 0, delay: 350, duration: 400, onComplete: () => g.destroy() });
  }

  /** Onda de choque: anel que se expande e fere e empurra quem estiver dentro. */
  private shockwave(w: WeaponRuntime, x: number, y: number, radius: number) {
    const ring = this.scene.add.image(x, y, 'atlas', frameName('aura')).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd890).setDepth(LAYER.groundFx).setScale(0.2, 0.15);
    this.scene.tweens.add({ targets: ring, scaleX: (radius * 2) / 96, scaleY: (radius * 1.5) / 96, alpha: 0, duration: 320, ease: 'Quad.Out', onComplete: () => ring.destroy() });
    this.burst(w, x, y, radius, 0.6, 220);
  }

  // ---------- Martelo do Trovão ----------

  /**
   * O martelo voa em linha reta até o inimigo mais próximo (e além), carregando quem atinge, e volta
   * para a mão do herói ferindo de novo. Nv 5: maior; nv 10: um trovão cai onde ele faz a volta;
   * nv 20: ao voltar, solta uma descarga em volta do herói.
   */
  private fireHammer(w: WeaponRuntime): boolean {
    const p = this.scene.player;
    const s = w.stats;
    const targets = this.scene.nearestEnemies(p.x, p.y, s.amount, 300);
    const f = this.scene.facing;
    for (let i = 0; i < s.amount; i++) {
      const t = targets[i];
      const a = t ? Math.atan2(t.y - p.y, t.x - p.x) : Math.atan2(f.y, f.x) + i * ((Math.PI * 2) / s.amount);
      this.scene.time.delayedCall(i * 120, () => this.hammer(w, a));
    }
    sfx('whoosh');
    return true;
  }

  private hammer(w: WeaponRuntime, angle: number) {
    const scene = this.scene;
    const p = scene.player;
    const s = w.stats;
    const g = grandeur(w.level);
    const size = s.area * (g >= 1 ? 1.25 : 1);
    const img = scene.add.image(p.x, p.y - 8, 'atlas', frameName('fx_hammer')).setDepth(LAYER.fx).setScale(size);
    if (w.level >= AWAKEN_EVERY) img.setTint(0xfff0c0);
    const range = s.speed * s.duration;
    const vx = Math.cos(angle);
    const vy = Math.sin(angle);
    let x = p.x;
    let y = p.y - 8;
    let out = 0;
    let back = false;
    let pause = 0;
    const carried = new Set<Enemy>();
    const hit = new Set<number>();
    const radius = 12 * size;
    this.live.push((dt) => {
      let mx: number;
      let my: number;
      if (!back) {
        const step = Math.min(s.speed * dt, range - out);
        out += step;
        mx = vx * step;
        my = vy * step;
        if (out >= range) {
          // pausa curta no fim, solta quem carregava e volta
          pause += dt;
          if (pause === dt) {
            for (const e of carried) this.push(e, vx, vy, 160);
            carried.clear();
            hit.clear();
            if (g >= 2) {
              this.drawBolt(x, y + 8, scene.cameras.main.worldView.y - 10, w.level >= AWAKEN_EVERY);
              this.burst(w, x, y + 8, 40 * s.area, 1, 120);
              sfx('zap');
            }
          }
          if (pause >= 0.1) back = true;
        }
      } else {
        // volta para a mão do herói, onde quer que ele esteja
        const dx = p.x - x;
        const dy = p.y - 8 - y;
        const d = Math.hypot(dx, dy) || 1;
        const step = Math.min(d, s.speed * 1.25 * dt);
        mx = (dx / d) * step;
        my = (dy / d) * step;
        if (d < 10) {
          img.destroy();
          scene.impact(p.x, p.y - 8, 0x9fd8ff, 0.8);
          if (g >= 3) {
            this.shockwave(w, p.x, p.y, 70 * s.area);
            this.drawBolt(p.x, p.y, scene.cameras.main.worldView.y - 10, true);
          }
          return false;
        }
      }
      x += mx;
      y += my;
      img.setPosition(x, y).setRotation(img.rotation + dt * 16 * (vx >= 0 ? 1 : -1)).setFrame(loopFrame('fx_hammer', scene.elapsed, 10));
      if (Math.random() < 0.7) scene.sparks.explode(1, x, y);
      // na ida, carrega os inimigos atingidos junto (chefes só levam dano)
      for (const e of carried) {
        if (!e.active) carried.delete(e);
        else {
          e.x += mx;
          e.y += my;
        }
      }
      scene.queryEnemies(x, y + 8, radius + 24, (e) => {
        if (hit.has(e.uid)) return;
        if ((e.x - x) ** 2 + (e.y - 8 - y) ** 2 > (radius + e.radius) ** 2) return;
        hit.add(e.uid);
        this.hit(w, e, back ? 0.8 : 0);
        // a Resistência pode impedir que ele seja carregado
        if (!back && !e.boss && e.active && this.scene.control(e) > 0) carried.add(e);
      });
      return true;
    });
  }

  // ---------- Raio de Luz ----------

  private fireLaser(w: WeaponRuntime): boolean {
    const p = this.scene.player;
    const g = grandeur(w.level);
    const target = this.scene.nearestEnemies(p.x, p.y, 1, 320)[0];
    const f = this.scene.facing;
    const aim = target ? Math.atan2(target.y - p.y, target.x - p.x) : Math.atan2(f.y, f.x);
    // despertado: um segundo feixe para trás; nv 20: mais dois em leque
    const offsets = g >= 3 ? [0, Math.PI, 0.6, -0.6] : g >= 2 ? [0, Math.PI] : [0];
    this.laser(w, aim, offsets, g);
    sfx('zap');
    return true;
  }

  /** Caminho do laser: em linha reta até a borda da tela, rebatendo `bounces` vezes (ângulo de reflexão). */
  private laserPath(x: number, y: number, angle: number, view: Phaser.Geom.Rectangle, bounces: number) {
    const pts = [{ x, y }];
    let dx = Math.cos(angle);
    let dy = Math.sin(angle);
    for (let b = 0; b <= bounces; b++) {
      const tx = dx > 1e-6 ? (view.right - x) / dx : dx < -1e-6 ? (view.left - x) / dx : Infinity;
      const ty = dy > 1e-6 ? (view.bottom - y) / dy : dy < -1e-6 ? (view.top - y) / dy : Infinity;
      const t = Math.max(0, Math.min(tx, ty));
      x += dx * t;
      y += dy * t;
      pts.push({ x, y });
      if (tx <= ty) dx = -dx;
      if (ty <= tx) dy = -dy;
    }
    return pts;
  }

  /**
   * Feixes de luz que saem do herói e o acompanham: a direção fica fixa, mas a cada quadro o caminho
   * (com os rebotes) é refeito a partir da posição dele e da tela.
   */
  private laser(w: WeaponRuntime, aim: number, offsets: number[], g: number) {
    const s = w.stats;
    const scene = this.scene;
    const p = scene.player;
    const baseWidth = 6 * s.area * (g >= 1 ? 1.3 : 1);
    const color = w.level >= AWAKEN_EVERY ? 0xffc23a : 0xffe680;
    // mistura normal (não aditiva): sobre a grama verde, a luz aditiva puxava para o verde-limão
    const gfx = scene.add.graphics().setDepth(LAYER.fx + 1);
    // brilhos: na mão do herói, na ponta e em cada rebote
    const flares: Phaser.GameObjects.Image[] = [];
    const flare = (i: number) => (flares[i] ??= scene.add.image(0, 0, 'glow').setDepth(LAYER.fx + 2).setBlendMode(Phaser.BlendModes.ADD));
    let drawn = 0;
    let on = 0;
    let tick = 0;
    let t = 0;
    this.live.push((dt) => {
      t += dt;
      const view = scene.cameras.main.worldView;
      const k = on / s.duration;
      // acende grosso, pulsa enquanto ligado e afina até sumir
      const life = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
      const width = baseWidth * (1 + Math.max(0, 0.6 - t * 3)) * (0.9 + Math.sin(t * 38) * 0.1) * Math.max(0.05, life);
      gfx.clear();
      let fi = 0;
      let extending = false;
      const paths: { x: number; y: number }[][] = [];
      for (const off of offsets) {
        // sai um pouco à frente do herói, para não cobri-lo
        const a = aim + off;
        const pts = this.laserPath(p.x + Math.cos(a) * 12, p.y - 8 + Math.sin(a) * 12, a, view, Math.floor(s.amount));
        // corta o caminho no quanto o feixe já percorreu
        const path = [pts[0]];
        let acc = 0;
        for (let i = 1; i < pts.length; i++) {
          const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
          if (acc + seg <= drawn) {
            path.push(pts[i]);
            acc += seg;
            continue;
          }
          const f = (drawn - acc) / (seg || 1);
          path.push({ x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f });
          extending = true;
          break;
        }
        paths.push(path);
        this.drawBeam(gfx, path, width, color, t);
        for (let i = 1; i < path.length; i++) {
          const tip = i === path.length - 1;
          const img = flare(fi++).setVisible(true).setPosition(path[i].x, path[i].y).setTint(tip ? 0xffffff : color);
          img.setScale((width / 11) * (tip && extending ? 1.6 : 1.1) * (0.85 + Math.random() * 0.3)).setAlpha(0.8 * life);
          // estrela de quatro pontas girando nos rebotes
          if (!tip || !extending) this.drawStar(gfx, path[i].x, path[i].y, width * 3.2, t * 3 + i, life);
        }
        // faíscas soltando do feixe
        if (Math.random() < 0.6 && path.length > 1) {
          const i = 1 + Math.floor(Math.random() * (path.length - 1));
          const r = Math.random();
          scene.sparks.explode(1, path[i - 1].x + (path[i].x - path[i - 1].x) * r, path[i - 1].y + (path[i].y - path[i - 1].y) * r);
        }
      }
      flare(fi++).setVisible(true).setPosition(p.x + Math.cos(aim) * 12, p.y - 8 + Math.sin(aim) * 12).setTint(0xfff4c0).setScale((width / 14) * (0.9 + Math.random() * 0.2)).setAlpha(0.7 * life);
      for (let i = fi; i < flares.length; i++) flares[i].setVisible(false);
      if (extending) drawn += s.speed * dt;
      else on += dt;

      // dano a cada 0,2 s em quem está sobre um feixe
      tick -= dt;
      if (tick <= 0) {
        tick = 0.2;
        for (const e of scene.activeEnemies()) {
          for (const path of paths) {
            let hit = false;
            for (let i = 1; i < path.length && !hit; i++) hit = distToSegment(e.x, e.y - 4, path[i - 1], path[i]) < width / 2 + e.radius;
            if (hit) {
              this.hit(w, e, 0);
              break;
            }
          }
        }
      }
      if (k < 1) return true;
      gfx.destroy();
      for (const img of flares) img.destroy();
      return false;
    });
  }

  /** Feixe em camadas (halo, cor, núcleo branco) com pulsos de energia correndo por ele. */
  private drawBeam(gfx: Phaser.GameObjects.Graphics, path: { x: number; y: number }[], width: number, color: number, t: number) {
    const layers: [number, number, number][] = [
      [width * 3.2, 0xfff6d0, 0.14],
      [width * 1.8, color, 0.4],
      [width * 1.15, 0xd89a1a, 0.9],
      [width * 0.85, color, 1],
      [Math.max(1.2, width * 0.4), 0xffffff, 1],
    ];
    for (const [lw, c, a] of layers) {
      gfx.lineStyle(lw, c, a).fillStyle(c, a);
      for (let i = 1; i < path.length; i++) gfx.lineBetween(path[i - 1].x, path[i - 1].y, path[i].x, path[i].y);
      // juntas arredondadas (sem fresta nas quinas dos rebotes)
      for (let i = 1; i < path.length - 1; i++) gfx.fillCircle(path[i].x, path[i].y, lw / 2);
    }
    // pulsos de luz correndo do herói para a ponta
    const gap = 54;
    const phase = (t * 700) % gap;
    let start = 0;
    gfx.lineStyle(Math.max(1.5, width * 0.7), 0xffffff, 0.9);
    for (let i = 1; i < path.length; i++) {
      const ax = path[i - 1].x;
      const ay = path[i - 1].y;
      const len = Math.hypot(path[i].x - ax, path[i].y - ay) || 1;
      const ux = (path[i].x - ax) / len;
      const uy = (path[i].y - ay) / len;
      for (let d = (((phase - start) % gap) + gap) % gap; d < len; d += gap) {
        const e = Math.min(len, d + 16);
        gfx.lineBetween(ax + ux * d, ay + uy * d, ax + ux * e, ay + uy * e);
      }
      start += len;
    }
  }

  private drawStar(gfx: Phaser.GameObjects.Graphics, x: number, y: number, r: number, rot: number, alpha: number) {
    gfx.fillStyle(0xffffff, 0.8 * alpha);
    for (let i = 0; i < 4; i++) {
      const a = rot + (i * Math.PI) / 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const w = r * 0.12;
      gfx.fillTriangle(x + ca * r, y + sa * r, x - sa * w, y + ca * w, x + sa * w, y - ca * w);
    }
  }

  // ---------- Bola de Fogo ----------

  private fireFireball(w: WeaponRuntime): boolean {
    const p = this.scene.player;
    const g = grandeur(w.level);
    const s = w.stats;
    const targets = this.scene.nearestEnemies(p.x, p.y, s.amount, 300);
    const f = this.scene.facing;
    for (let i = 0; i < s.amount; i++) {
      const t = targets[i % Math.max(1, targets.length)];
      const a = t ? Math.atan2(t.y - p.y, t.x - p.x) + (i >= targets.length ? (i - targets.length + 1) * 0.25 : 0) : Math.atan2(f.y, f.x) + i * 0.3;
      this.scene.time.delayedCall(i * 90, () => this.fireball(w, p.x, p.y - 8, a, g, 1, true));
    }
    // nv 20: Meteoro cai do céu sobre um inimigo na tela, a cada 2 disparos
    if (g >= 3 && ++this.meteorCount % 2 === 1) this.meteor(w);
    sfx('whoosh');
    return true;
  }

  private fireball(w: WeaponRuntime, x: number, y: number, angle: number, g: number, size: number, splits: boolean) {
    const s = w.stats;
    const vx = Math.cos(angle) * s.speed;
    const vy = Math.sin(angle) * s.speed;
    const img = this.scene.add.image(x, y, 'atlas', frameName('fx_fireball')).setRotation(angle).setScale(size * (0.8 + s.area * 0.4)).setDepth(LAYER.fx);
    let life = 0;
    this.live.push((dt) => {
      life += dt;
      x += vx * dt;
      y += vy * dt;
      img.setPosition(x, y).setFrame(loopFrame('fx_fireball', life, 12));
      if (Math.random() < 0.5) this.scene.emitFlame(x - vx * 0.03, y - vy * 0.03);
      let hit = false;
      this.scene.queryEnemies(x, y, 24, (e) => {
        if (!hit && (e.x - x) ** 2 + (e.y - 4 - y) ** 2 < (8 * size + e.radius) ** 2) hit = true;
      });
      if (!hit && life < s.duration) return true;
      img.destroy();
      const radius = 30 * s.area * size * (g >= 1 ? 1.25 : 1);
      this.explode(w, x, y, radius, size, g >= 1 ? 0.004 : 0);
      // despertada: estoura em três bolinhas
      if (splits && g >= 2) for (let k = 0; k < 3; k++) this.fireball(w, x, y, angle + Math.PI + (k - 1) * 0.9, g, 0.55, false);
      return false;
    });
  }

  private explode(w: WeaponRuntime, x: number, y: number, radius: number, mult: number, shake: number) {
    this.scene.elements.vfx('vfx_explosion', x, y + radius * 0.5, radius * 2.1, [[0, 0.04], [1, 0.06], [2, 0.12], [3, 0.28]]);
    this.burst(w, x, y, radius, mult, 90);
    if (shake) this.scene.cameras.main.shake(120, shake);
    sfx('boom');
  }

  private meteor(w: WeaponRuntime) {
    const view = this.scene.cameras.main.worldView;
    const visible = this.scene.activeEnemies().filter((e) => view.contains(e.x, e.y));
    if (!visible.length) return;
    const t = visible[Math.floor(Math.random() * visible.length)];
    const tx = t.x;
    const ty = t.y;
    const img = this.scene.add.image(tx + 80, view.y - 40, 'atlas', frameName('fx_fireball')).setScale(3).setDepth(LAYER.fx + 2)
      .setRotation(Math.atan2(ty - (view.y - 40), tx - (tx + 80)));
    this.scene.tweens.add({
      targets: img, x: tx, y: ty, duration: 520, ease: 'Quad.In',
      onUpdate: (tw) => img.setFrame(loopFrame('fx_fireball', tw.elapsed / 1000, 12)),
      onComplete: () => {
        img.destroy();
        this.explode(w, tx, ty, 70 * w.stats.area, 3, 0.014);
      },
    });
  }

  // ---------- Passos Sísmicos ----------

  /** A cada trecho andado, o chão treme em pontos ao redor do herói. */
  private updateTremor(w: WeaponRuntime) {
    const p = this.scene.player;
    if (!this.lastPos) this.lastPos = { x: p.x, y: p.y };
    this.walked += Math.hypot(p.x - this.lastPos.x, p.y - this.lastPos.y);
    this.lastPos.x = p.x;
    this.lastPos.y = p.y;
    const step = 100 * w.stats.cooldown;
    if (this.walked < step) return;
    this.walked = Math.min(this.walked - step, step);
    const g = grandeur(w.level);
    // onda de choque com o herói no centro; quantidade extra = ondas seguidas
    for (let i = 0; i < w.stats.amount; i++) this.scene.time.delayedCall(i * 180, () => this.shockRing(w, g, 1));
    // despertado: uma segunda onda, mais larga; nv 20: uma terceira, que empurra ainda mais
    if (g >= 2) this.scene.time.delayedCall(320, () => this.shockRing(w, g, 1.35));
    if (g >= 3) this.scene.time.delayedCall(640, () => this.shockRing(w, g, 1.7));
  }

  /**
   * Onda de choque: um anel de poeira e pressão sai do herói e se expande em círculo; quem ele
   * alcança leva dano e é empurrado para fora.
   */
  private shockRing(w: WeaponRuntime, g: number, scale: number) {
    const s = w.stats;
    const scene = this.scene;
    const p = scene.player;
    const x = p.x;
    const y = p.y + 4;
    const radius = 60 * s.area * (g >= 1 ? 1.2 : 1) * scale;
    const force = 230 * (g >= 3 ? 1.4 : 1);
    const gfx = scene.add.graphics().setDepth(LAYER.groundFx);
    const hit = new Set<number>();
    const dur = 0.38;
    let t = 0;
    // pisada: o chão afunda um instante no centro
    const stomp = scene.add.image(x, y, 'atlas', frameName('glow')).setTint(0x3a2a18).setAlpha(0.45).setScale(0.6, 0.35).setDepth(LAYER.groundFx);
    scene.tweens.add({ targets: stomp, alpha: 0, scaleX: 1.2, scaleY: 0.7, duration: 300, onComplete: () => stomp.destroy() });
    this.live.push((dt) => {
      t += dt;
      const k = Math.min(1, t / dur);
      const r = 8 + (radius - 8) * (1 - (1 - k) ** 2);
      const fade = 1 - k;
      gfx.clear();
      // frente da onda: faixa de poeira grossa, com uma linha clara de pressão logo atrás
      gfx.lineStyle(12 * (0.4 + fade * 0.6) * s.area, 0x7a5a34, 0.7 * fade).strokeEllipse(x, y, r * 2, r * 1.5);
      gfx.lineStyle(4 * s.area, 0xf4e2bc, 0.95 * fade).strokeEllipse(x, y, r * 1.82, r * 1.36);
      gfx.lineStyle(1.5, 0xffffff, 0.6 * fade).strokeEllipse(x, y, r * 1.6, r * 1.2);
      // poeira levantando na frente da onda
      if (k < 0.9) {
        for (let i = 0; i < 2; i++) {
          const a = Math.random() * Math.PI * 2;
          this.dust(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.75, 1);
        }
      }
      scene.queryEnemies(x, y, r + 24, (e) => {
        if (hit.has(e.uid)) return;
        const dx = e.x - x;
        const dy = (e.y - y) / 0.75;
        const d = Math.hypot(dx, dy) || 1;
        if (d > r + e.radius) return;
        hit.add(e.uid);
        this.hit(w, e, 0);
        this.push(e, dx / d, dy / d, force);
      });
      if (k < 1) return true;
      gfx.destroy();
      return false;
    });
    sfx('boom');
  }

  /** Registra dano de projéteis na estatística da arma dona. */
  credit(id: WeaponId, amount: number) {
    const w = this.list.find((x) => x.id === id);
    if (w) w.dealt += amount;
  }

  /** Lista para HUD e estatísticas. */
  get owned() {
    return this.list.map((w) => ({ id: w.id, level: w.level, dealt: w.dealt }));
  }

  destroy() {
    this.orbs.forEach((o) => o.destroy());
    this.aura?.destroy();
    this.foamEmitter?.destroy();
  }
}
