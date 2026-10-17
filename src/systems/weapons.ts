import Phaser from 'phaser';
import { frameName } from '../art/textures';
import { areaMult, cooldownMult, damageMult, durationMult, projectileSpeedMult } from '../core/stats';
import { applyTagBonuses, countTags } from '../data/tags';
import { AWAKEN_EVERY, WEAPONS, capAmount, grandeur, weaponStatsAt, weaponTags, type WeaponDef, type WeaponId, type WeaponStats } from '../data/weapons';
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

  /** Empurrão numa direção (onda, explosões); chefes não são empurrados. */
  private push(e: Enemy, dx: number, dy: number, force: number) {
    if (e.boss || !e.active) return;
    e.kbX += dx * force * e.def.knockback;
    e.kbY += dy * force * e.def.knockback;
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
      case 'lob':
        return this.fireLob(w);
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
    const f = this.scene.facing;
    const s = w.stats;
    for (let i = 0; i < s.amount; i++) {
      this.scene.time.delayedCall(i * 60, () => {
        const off = (i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2) * 5;
        this.shoot(w, 'knife', 'proj_knife', p.x - f.y * off, p.y - 3 + f.x * off, f.x * s.speed, f.y * s.speed);
      });
    }
    return true;
  }

  private fireLob(w: WeaponRuntime): boolean {
    const p = this.scene.player;
    const s = w.stats;
    for (let i = 0; i < s.amount; i++) {
      this.scene.time.delayedCall(i * 110, () => {
        const vx = (Math.random() * 2 - 1) * 70 + this.scene.facing.x * 40;
        this.shoot(w, 'axe', 'proj_axe', p.x, p.y - 6, vx, -s.speed);
      });
    }
    return true;
  }

  private fireArc(w: WeaponRuntime): boolean {
    // golpeia na direção do movimento (joystick); parado, mantém a última direção
    const f = this.scene.facing;
    const angle = Math.atan2(f.y, f.x);
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
    const img = this.scene.add.image(cx, cy - 6, 'atlas', frameName('slash')).setScale(width / 48, height / 30).setRotation(angle).setDepth(LAYER.fx);
    img.setBlendMode(Phaser.BlendModes.ADD);
    if (w.level >= AWAKEN_EVERY) img.setTint(0xffe9a8);
    this.scene.tweens.add({
      targets: img, alpha: 0, x: img.x + cos * 6, y: img.y + sin * 6, scaleY: (height / 30) * 0.5, duration: 200, ease: 'Quad.Out', onComplete: () => img.destroy(),
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
      this.aura = this.scene.add.image(p.x, p.y, 'atlas', frameName('aura')).setDepth(LAYER.groundFx).setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({ targets: this.aura, alpha: { from: 0.6, to: 0.95 }, duration: 380, yoyo: true, repeat: -1 });
      this.scene.tweens.add({ targets: this.aura, angle: 360, duration: 6000, repeat: -1 });
    }
    const radius = 40 * w.stats.area;
    this.aura.setPosition(p.x, p.y + 6).setScale((radius * 2) / 96, (radius * 1.6) / 96);
    // chamas subindo de pontos do anel
    if (Math.random() < 0.5) this.scene.emitFlame(p.x + (Math.random() * 2 - 1) * radius * 0.9, p.y + 6 + (Math.random() * 2 - 1) * radius * 0.7);
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
    const img = this.scene.add.image(x0, y0, 'atlas', frameName('fx_wave')).setRotation(angle).setFlipY(cos < 0).setDepth(LAYER.fx);
    if (w.level >= AWAKEN_EVERY) img.setTint(0xd8f4ff);
    this.live.push((dt) => {
      traveled += speed * dt;
      const k = Math.min(1, traveled / range);
      // nv 5+: a onda cresce enquanto avança
      const width = width0 * (g >= 1 ? 0.8 + k * 0.7 : 1);
      const cx = x0 + cos * traveled;
      const cy = y0 + sin * traveled;
      img.setPosition(cx, cy).setScale((width / 54) * 0.75, width / 54).setAlpha((o.alpha ?? 1) * (k > 0.8 ? (1 - k) * 5 : 1));
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
        gfx.lineStyle(6 * s.area, 0x2a180c, 0.85).lineBetween(cx, cy, nx, ny);
        gfx.lineStyle(2, 0xd8b07a, 0.9).lineBetween(cx, cy - 2, nx, ny - 2);
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
      this.scene.tweens.add({ targets: gfx, alpha: 0, delay: 700, duration: 900, onComplete: () => gfx.destroy() });
      return false;
    });
  }

  /** Espinho de pedra que brota do chão e afunda. */
  private spike(x: number, y: number, scale: number) {
    const img = this.scene.add.image(x, y, 'atlas', frameName('fx_spike')).setOrigin(0.5, 0.9).setDepth(y).setScale(scale * 0.3, 0);
    this.scene.tweens.add({ targets: img, scaleX: scale, scaleY: scale, duration: 90, ease: 'Back.Out' });
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
      img.setPosition(hx, hy).setScale((r * 2.4) / 60).setRotation(Math.sin(t * 14) * 0.1).setDepth(hy).setAlpha(k > 0.85 ? (1 - k) / 0.15 : 1);
      const pull = r * 2.4;
      this.scene.queryEnemies(hx, hy, pull, (e) => {
        const dx = hx - e.x;
        const dy = hy - e.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > pull) return;
        if (!e.boss) {
          // puxa para o centro do redemoinho
          const m = Math.min(d, 70 * dt);
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
  }
}
