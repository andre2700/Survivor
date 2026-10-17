import Phaser from 'phaser';
import { WEAPONS, type WeaponId, type WeaponStats } from '../data/weapons';
import type { Enemy, Projectile } from '../entities';
import type { GameScene } from '../scenes/GameScene';
import { sfx } from './sfx';

interface WeaponRuntime {
  id: WeaponId;
  level: number;
  timer: number;
}

/** Executa os ataques automáticos de todas as armas do jogador. */
export class WeaponSystem {
  private list: WeaponRuntime[] = [];
  private orbs: Phaser.GameObjects.Image[] = [];
  private orbAngle = 0;
  private aura?: Phaser.GameObjects.Image;

  constructor(private scene: GameScene) {}

  sync(weapons: Partial<Record<WeaponId, number>>) {
    for (const [id, level] of Object.entries(weapons) as [WeaponId, number][]) {
      const existing = this.list.find((w) => w.id === id);
      if (existing) existing.level = level;
      else this.list.push({ id, level, timer: 0.3 });
    }
  }

  private stats(w: WeaponRuntime): WeaponStats {
    return WEAPONS[w.id].levels[w.level - 1];
  }

  private dmg(base: number) {
    return Math.max(1, Math.round(base * this.scene.stats.might * (0.9 + Math.random() * 0.2)));
  }

  update(dt: number) {
    const cdMult = this.scene.stats.cooldown;
    for (const w of this.list) {
      const s = this.stats(w);
      if (w.id === 'orb') {
        this.updateOrbs(dt, s);
        continue;
      }
      if (w.id === 'aura') this.updateAuraVisual(s);
      w.timer -= dt;
      if (w.timer > 0) continue;
      const fired = this.fire(w.id, s);
      w.timer = fired ? s.cooldown * cdMult : 0.1;
    }
  }

  private fire(id: WeaponId, s: WeaponStats): boolean {
    switch (id) {
      case 'wand':
        return this.fireWand(s);
      case 'knives':
        return this.fireKnives(s);
      case 'axe':
        return this.fireAxe(s);
      case 'sword':
        return this.fireSword(s);
      case 'aura':
        return this.tickAura(s);
      case 'lightning':
        return this.fireLightning(s);
      default:
        return false;
    }
  }

  private spawnProjectile(): Projectile | null {
    return this.scene.projectiles.get() as Projectile | null;
  }

  private fireWand(s: WeaponStats): boolean {
    const p = this.scene.player;
    const targets = this.scene.nearestEnemies(p.x, p.y, s.amount, 260);
    if (targets.length === 0) return false;
    for (let i = 0; i < s.amount; i++) {
      const t = targets[i % targets.length];
      const a = Math.atan2(t.y - p.y, t.x - p.x) + (i >= targets.length ? (i - targets.length + 1) * 0.15 : 0);
      const proj = this.spawnProjectile();
      proj?.fire('bolt', 'bolt', p.x, p.y - 4, Math.cos(a) * s.speed, Math.sin(a) * s.speed, this.dmg(s.damage), s.pierce, 1.6, s.area);
    }
    return true;
  }

  private fireKnives(s: WeaponStats): boolean {
    const p = this.scene.player;
    const f = this.scene.facing;
    for (let i = 0; i < s.amount; i++) {
      this.scene.time.delayedCall(i * 70, () => {
        const off = (i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2) * 5;
        const proj = this.spawnProjectile();
        proj?.fire('knife', 'knife', p.x - f.y * off, p.y - 3 + f.x * off, f.x * s.speed, f.y * s.speed, this.dmg(s.damage), s.pierce, 1, s.area);
      });
    }
    return true;
  }

  private fireAxe(s: WeaponStats): boolean {
    const p = this.scene.player;
    for (let i = 0; i < s.amount; i++) {
      this.scene.time.delayedCall(i * 120, () => {
        const proj = this.spawnProjectile();
        const vx = (Math.random() * 2 - 1) * 70 + this.scene.facing.x * 40;
        proj?.fire('axe', 'axe', p.x, p.y - 6, vx, -s.speed, this.dmg(s.damage), s.pierce, 2.2, s.area);
      });
    }
    return true;
  }

  private fireSword(s: WeaponStats): boolean {
    const dir = this.scene.player.flipX ? -1 : 1;
    for (let i = 0; i < s.amount; i++) {
      const side = i === 0 ? dir : -dir;
      this.scene.time.delayedCall(i * 140, () => this.slash(side, s));
    }
    return true;
  }

  private slash(side: number, s: WeaponStats) {
    const p = this.scene.player;
    const w = 46 * s.area;
    const h = 30 * s.area;
    const cx = p.x + side * (w / 2 + 2);
    const cy = p.y - 2;
    const img = this.scene.add.image(cx, cy, 'slash').setScale((w / 40), h / 24).setFlipX(side < 0).setDepth(100001).setAlpha(0.95);
    this.scene.tweens.add({ targets: img, alpha: 0, scaleY: (h / 24) * 0.6, duration: 180, onComplete: () => img.destroy() });
    const dmg = this.dmg(s.damage);
    for (const e of this.scene.activeEnemies()) {
      if (Math.abs(e.x - cx) < w / 2 + e.worldRadius && Math.abs(e.y - cy) < h / 2 + e.worldRadius) {
        this.scene.damageEnemy(e, dmg, 1);
      }
    }
  }

  private updateAuraVisual(s: WeaponStats) {
    const p = this.scene.player;
    if (!this.aura) {
      this.aura = this.scene.add.image(p.x, p.y, 'aura').setDepth(-1);
      this.scene.tweens.add({ targets: this.aura, alpha: { from: 0.75, to: 1 }, duration: 400, yoyo: true, repeat: -1 });
    }
    const radius = 34 * s.area;
    this.aura.setPosition(p.x, p.y + 2).setScale((radius * 2) / 96);
  }

  private tickAura(s: WeaponStats): boolean {
    const p = this.scene.player;
    const radius = 34 * s.area;
    const dmg = this.dmg(s.damage);
    for (const e of this.scene.activeEnemies()) {
      const r = radius + e.worldRadius;
      if (Phaser.Math.Distance.Squared(p.x, p.y, e.x, e.y) < r * r) this.scene.damageEnemy(e, dmg, 0.3);
    }
    return true;
  }

  private updateOrbs(dt: number, s: WeaponStats) {
    while (this.orbs.length < s.amount) this.orbs.push(this.scene.add.image(0, 0, 'orb').setDepth(100000));
    const p = this.scene.player;
    const radius = 42 * s.area;
    this.orbAngle += s.speed * dt;
    const now = this.scene.elapsed;
    const cd = s.cooldown * this.scene.stats.cooldown;
    const enemies = this.scene.activeEnemies();
    this.orbs.forEach((orb, i) => {
      const a = this.orbAngle + (i / this.orbs.length) * Math.PI * 2;
      orb.setPosition(p.x + Math.cos(a) * radius, p.y - 2 + Math.sin(a) * radius);
      for (const e of enemies) {
        if (now - e.orbHitAt < cd) continue;
        const r = 5 + e.worldRadius;
        if (Phaser.Math.Distance.Squared(orb.x, orb.y, e.x, e.y) < r * r) {
          e.orbHitAt = now;
          this.scene.damageEnemy(e, this.dmg(s.damage), 0.6);
        }
      }
    });
  }

  private fireLightning(s: WeaponStats): boolean {
    const view = this.scene.cameras.main.worldView;
    const visible = this.scene.activeEnemies().filter((e) => view.contains(e.x, e.y));
    if (visible.length === 0) return false;
    Phaser.Utils.Array.Shuffle(visible);
    const radius = 22 * s.area;
    for (let i = 0; i < Math.min(s.amount, visible.length); i++) {
      const target = visible[i];
      const tx = target.x;
      const ty = target.y;
      this.drawBolt(tx, ty, view.y - 10);
      const dmg = this.dmg(s.damage);
      for (const e of this.scene.activeEnemies()) {
        const r = radius + e.worldRadius;
        if (Phaser.Math.Distance.Squared(tx, ty, e.x, e.y) < r * r) this.scene.damageEnemy(e, dmg, 0.5);
      }
    }
    sfx('zap');
    return true;
  }

  private drawBolt(x: number, y: number, top: number) {
    const g = this.scene.add.graphics().setDepth(100002);
    const pts: Phaser.Math.Vector2[] = [];
    const segments = 8;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const jitter = i === 0 || i === segments ? 0 : (Math.random() * 2 - 1) * 8;
      pts.push(new Phaser.Math.Vector2(x + jitter, top + (y - top) * t));
    }
    g.lineStyle(3, 0x73eff7, 1).strokePoints(pts);
    g.lineStyle(1, 0xf4f4f4, 1).strokePoints(pts);
    g.fillStyle(0xf4f4f4, 0.8).fillCircle(x, y, 6);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
  }

  /** Lista para a HUD. */
  get owned() {
    return this.list.map((w) => ({ id: w.id, level: w.level }));
  }

  /** Para o fim da partida. */
  destroy() {
    this.orbs.forEach((o) => o.destroy());
    this.aura?.destroy();
  }

  static projectileHit(p: Projectile, e: Enemy): boolean {
    if (p.hits.has(e.uid)) return false;
    p.hits.add(e.uid);
    p.pierce--;
    return true;
  }
}
