import Phaser from 'phaser';
import { frameName } from '../art/textures';
import { areaMult, cooldownMult, damageMult, durationMult, projectileSpeedMult } from '../core/stats';
import { applyTagBonuses, countTags } from '../data/tags';
import { AWAKEN_EVERY, WEAPONS, capAmount, weaponStatsAt, type WeaponDef, type WeaponId, type WeaponStats } from '../data/weapons';
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

/** Executa os ataques automáticos de todas as armas. Cada padrão é implementado uma única vez. */
export class WeaponSystem {
  private list: WeaponRuntime[] = [];
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
    const counts = countTags(this.list.map((w) => w.def.tags));
    for (const w of this.list) {
      const s = { ...weaponStatsAt(w.def, w.level) };
      applyTagBonuses(s, w.def.tags, counts);
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
    return countTags(this.list.map((w) => w.def.tags));
  }

  private dmg(w: WeaponRuntime) {
    return w.stats.damage * (0.9 + Math.random() * 0.2);
  }

  private hit(w: WeaponRuntime, e: Enemy, knock: number) {
    w.dealt += this.scene.hitEnemy(e, this.dmg(w), knock, w.def.element);
  }

  update(dt: number) {
    for (const w of this.list) {
      if (w.def.pattern === 'orbit') {
        this.updateOrbs(w, dt);
        continue;
      }
      if (w.def.pattern === 'aura') this.updateAuraVisual(w);
      w.timer -= dt;
      if (w.timer > 0) continue;
      const fired = this.fire(w);
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
      default:
        return false;
    }
  }

  private shoot(w: WeaponRuntime, kind: ProjectileKind, texture: string, x: number, y: number, vx: number, vy: number) {
    const p = this.scene.projectiles.get();
    if (!p) return;
    p.fire(kind, texture, x, y, vx, vy, this.dmg(w), w.stats.pierce, w.stats.duration, w.stats.area, w.def.element);
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
    const dir = this.scene.player.flipX ? -1 : 1;
    for (let i = 0; i < w.stats.amount; i++) {
      // 1º golpe para frente, 2º para trás, os seguintes alternam com leve atraso
      const side = i % 2 === 0 ? dir : -dir;
      this.scene.time.delayedCall(i * 140, () => this.slash(w, side));
    }
    return true;
  }

  private slash(w: WeaponRuntime, side: number) {
    const p = this.scene.player;
    const width = 56 * w.stats.area;
    const height = 36 * w.stats.area;
    const cx = p.x + side * (width / 2 + 2);
    const cy = p.y - 2;
    const cy2 = cy - 6;
    const img = this.scene.add.image(cx, cy2, 'atlas', frameName('slash')).setScale(width / 48, height / 30).setFlipX(side < 0).setDepth(LAYER.fx);
    img.setBlendMode(Phaser.BlendModes.ADD);
    if (w.level >= AWAKEN_EVERY) img.setTint(0xffe9a8);
    this.scene.tweens.add({ targets: img, alpha: 0, x: cx + side * 6, scaleY: (height / 30) * 0.5, duration: 200, ease: 'Quad.Out', onComplete: () => img.destroy() });
    this.scene.queryEnemies(cx, cy, Math.max(width, height), (e) => {
      if (Math.abs(e.x - cx) < width / 2 + e.radius && Math.abs(e.y - cy) < height / 2 + e.radius) this.hit(w, e, 1);
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
    for (let i = 0; i < Math.min(w.stats.amount, visible.length); i++) {
      const tx = visible[i].x;
      const ty = visible[i].y;
      this.drawBolt(tx, ty, view.y - 10, w.level >= AWAKEN_EVERY);
      this.scene.queryEnemies(tx, ty, radius + 16, (e) => {
        const r = radius + e.radius;
        if (Phaser.Math.Distance.Squared(tx, ty, e.x, e.y) < r * r) this.hit(w, e, 0.5);
      });
    }
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
