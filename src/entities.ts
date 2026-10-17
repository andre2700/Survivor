import Phaser from 'phaser';
import type { EnemyDef } from './data/enemies';

let nextUid = 1;

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  def!: EnemyDef;
  uid = 0;
  hp = 0;
  maxHp = 0;
  damage = 0;
  speed = 0;
  xp = 0;
  elite = false;
  boss = false;
  kbX = 0;
  kbY = 0;
  flashUntil = 0;
  /** último instante (s) em que foi atingido por orbe/aura — evita dano a cada frame */
  orbHitAt = -99;
  auraHitAt = -99;
  phase = 0;

  spawn(def: EnemyDef, x: number, y: number, hpMult: number, elite = false) {
    this.def = def;
    this.uid = nextUid++;
    this.elite = elite;
    this.boss = def.id === 'demon';
    const eliteMult = elite ? 10 : 1;
    this.maxHp = Math.round(def.hp * (this.boss ? 1 : hpMult) * eliteMult);
    this.hp = this.maxHp;
    this.damage = def.damage * (elite ? 1.5 : 1);
    this.speed = def.speed * (elite ? 0.9 : 1) * (0.9 + Math.random() * 0.2);
    this.xp = def.xp * (elite ? 12 : 1);
    this.kbX = this.kbY = 0;
    this.flashUntil = 0;
    this.orbHitAt = this.auraHitAt = -99;
    this.phase = Math.random() * Math.PI * 2;

    this.enableBody(true, x, y, true, true);
    this.setTexture(def.texture, 0);
    this.setScale(def.scale * (elite ? 1.6 : 1));
    this.setDepth(y);
    this.play(`${def.texture}_walk`, true);
    if (elite) this.setTint(0xffcd75);
    else this.clearTint();
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(def.radius, 8 - def.radius, 9 - def.radius);
  }

  /** Raio efetivo do corpo no mundo (considerando a escala). */
  get worldRadius() {
    return this.def.radius * this.scaleX;
  }
}

export type ProjectileKind = 'bolt' | 'knife' | 'axe';

export class Projectile extends Phaser.Physics.Arcade.Image {
  kind: ProjectileKind = 'bolt';
  damage = 0;
  pierce = 1;
  life = 0;
  spin = 0;
  hits = new Set<number>();

  fire(kind: ProjectileKind, texture: string, x: number, y: number, vx: number, vy: number, damage: number, pierce: number, life: number, scale = 1) {
    this.kind = kind;
    this.damage = damage;
    this.pierce = pierce;
    this.life = life;
    this.hits.clear();
    this.enableBody(true, x, y, true, true);
    this.setTexture(texture);
    this.setScale(scale);
    this.setDepth(100000);
    const body = this.body as Phaser.Physics.Arcade.Body;
    const r = Math.max(3, Math.min(this.width, this.height) / 2);
    body.setCircle(r, this.width / 2 - r, this.height / 2 - r);
    body.setAllowGravity(kind === 'axe');
    body.setGravityY(kind === 'axe' ? 650 : 0);
    this.setVelocity(vx, vy);
    this.spin = kind === 'axe' ? 12 : 0;
    this.setRotation(kind === 'axe' ? 0 : Math.atan2(vy, vx));
  }
}

export type PickupKind = 'gem' | 'coin' | 'heart';

export class Pickup extends Phaser.GameObjects.Image {
  kind: PickupKind = 'gem';
  value = 0;
  magnet = false;
  vel = 0;
}
