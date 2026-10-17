import Phaser from 'phaser';
import { frameHd, frameName } from './art/textures';
import type { EnemyDef } from './data/enemies';
import type { Element, WeaponId } from './data/weapons';

let nextUid = 1;

/** Inimigo: imagem do atlas com movimento manual (sem corpo físico, para escalar a milhares). */
export class Enemy extends Phaser.GameObjects.Image {
  def!: EnemyDef;
  uid = 0;
  hp = 0;
  maxHp = 0;
  damage = 0;
  speed = 0;
  xp = 0;
  radius = 5;
  elite = false;
  boss = false;
  kbX = 0;
  kbY = 0;
  flashUntil = 0;
  /** último instante (s) em que foi atingido por orbe/aura */
  orbHitAt = -99;
  auraHitAt = -99;
  phase = 0;
  /** escala sem a animação de andar */
  baseScale = 1;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'atlas', frameName('slime'));
  }

  spawn(def: EnemyDef, x: number, y: number, hpMult: number, dmgMult: number, elite = false) {
    this.def = def;
    this.uid = nextUid++;
    this.elite = elite;
    this.boss = def.id === 'demon';
    const eliteMult = elite ? 10 : 1;
    this.maxHp = Math.round(def.hp * hpMult * eliteMult);
    this.hp = this.maxHp;
    this.damage = def.damage * dmgMult * (elite ? 1.5 : 1);
    this.speed = def.speed * (elite ? 0.9 : 1) * (0.9 + Math.random() * 0.2);
    this.xp = def.xp * (elite ? 12 : 1);
    this.kbX = this.kbY = 0;
    this.flashUntil = 0;
    this.orbHitAt = this.auraHitAt = -99;
    this.phase = Math.random() * Math.PI * 2;
    const scale = def.scale * (elite ? 1.6 : 1);
    this.radius = def.radius * scale;
    this.baseScale = scale;
    this.setPosition(x, y).setActive(true).setVisible(true).setAlpha(1).setAngle(0);
    this.setFrame(frameName(def.texture, 0)).setScale(scale).setDepth(y);
    // a posição é o centro do corpo (a sombra fica embutida na base do sprite)
    this.setOrigin(0.5, def.id === 'bat' ? 0.5 : 0.65);
    if (elite) this.setTint(0xffcd75);
    else this.clearTint();
  }

  kill() {
    this.setActive(false).setVisible(false);
  }
}

export type ProjectileKind = 'bolt' | 'knife' | 'axe';

export class Projectile extends Phaser.GameObjects.Image {
  kind: ProjectileKind = 'bolt';
  damage = 0;
  pierce = 1;
  life = 0;
  vx = 0;
  vy = 0;
  gravity = 0;
  spin = 0;
  radius = 4;
  element: Element = 'physical';
  owner: WeaponId | null = null;
  hits = new Set<number>();

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'atlas', frameName('bolt'));
  }

  fire(kind: ProjectileKind, texture: string, x: number, y: number, vx: number, vy: number, damage: number, pierce: number, life: number, scale: number, element: Element) {
    this.kind = kind;
    this.damage = damage;
    this.pierce = pierce;
    this.life = life;
    this.vx = vx;
    this.vy = vy;
    this.element = element;
    this.gravity = kind === 'axe' ? 650 : 0;
    this.spin = kind === 'axe' ? 12 : 0;
    this.hits.clear();
    this.setPosition(x, y).setActive(true).setVisible(true).setFrame(frameName(texture)).setScale(scale).setDepth(1e9);
    this.radius = Math.max(4, (Math.min(this.width, this.height) / frameHd(this) / 2) * scale * (kind === 'bolt' ? 0.6 : 1));
    this.setRotation(kind === 'axe' ? 0 : Math.atan2(vy, vx));
  }

  kill() {
    this.setActive(false).setVisible(false);
  }
}

export type PickupKind = 'gem' | 'coin' | 'heart';

export class Pickup extends Phaser.GameObjects.Image {
  kind: PickupKind = 'gem';
  value = 0;
  magnet = false;
  vel = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'atlas', frameName('gem'));
  }
}

/** Pool simples de objetos: reaproveita inativos, cria novos até o limite. */
export class Pool<T extends Phaser.GameObjects.GameObject> {
  readonly items: T[] = [];
  constructor(private scene: Phaser.Scene, private factory: (s: Phaser.Scene) => T, private max: number) {}

  private cursor = 0;

  get(): T | null {
    // busca circular a partir do último encontrado: costuma achar um livre logo
    const n = this.items.length;
    for (let k = 0; k < n; k++) {
      const i = (this.cursor + k) % n;
      if (!this.items[i].active) {
        this.cursor = i + 1;
        return this.items[i];
      }
    }
    if (n >= this.max) return null;
    const item = this.factory(this.scene);
    this.scene.add.existing(item);
    this.items.push(item);
    return item;
  }

  countActive() {
    let n = 0;
    for (const i of this.items) if (i.active) n++;
    return n;
  }
}
