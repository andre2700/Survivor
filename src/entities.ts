import Phaser from 'phaser';
import { frameHd, frameName, slotsOf, type Slots } from './art/textures';
import { CONTROL_RULES, type EnemyDef } from './data/enemies';
import type { Primary } from './data/elements';
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
  /** Resistência a controle (a da criatura, mais a dos elites) */
  resist = 0;
  /** último aviso de "RESISTIU" (s) */
  resistShownAt = -99;
  /** papel num evento: guarda de baú/jaula, goblin dourado, chefe surpresa, guerreiro de tribo */
  tag: '' | 'guard' | 'golden' | 'surprise' | 'tribe' | 'sleeper' | 'procession' | 'bell' | 'portal' | 'echo' = '';
  /** parado no mapa (gárgula de pedra, mímico): acorda quando o herói chega a esta distância; 0 = acordado */
  sleeping = 0;
  /** portal: solta `portalN` inimigos a cada `portalEvery` s (0 = não solta) com o herói até `portalRange` px */
  portalEvery = 0;
  portalN = 0;
  portalRange = 0;
  portalAt = 0;
  /** procissão fantasma: anda em linha reta nesta velocidade, sem perseguir o herói */
  marchX = 0;
  marchY = 0;
  kbX = 0;
  kbY = 0;
  flashUntil = 0;
  /** último sinal de golpe num chefe (s) */
  flashAt = -99;
  /** não encosta no herói (chefe no ar ou sumindo) */
  intangible = false;
  /** cor própria (chefe furioso ou na fase 2): volta a ela depois de piscar */
  baseTint = 0;
  /** último instante (s) em que foi atingido por orbe/aura */
  orbHitAt = -99;
  auraHitAt = -99;
  phase = 0;
  /** escala sem a animação de andar */
  baseScale = 1;
  /** quadro de animação atual */
  animFrame = 0;
  /** índice de cada quadro nomeado da textura (walk_a, hurt, death...) */
  slots: Slots = {};
  /** mostra o quadro de dano até este instante (s) */
  hurtUntil = 0;
  /** ataque do chefe: andando, preparando (aviso no chão) ou golpeando */
  attackPhase: 'walk' | 'windup' | 'attack' = 'walk';
  attackTimer = 0;
  attackX = 0;
  attackY = 0;
  /** verme da areia andando por baixo da areia (mostra o monte de areia em vez de andar) */
  burrowed = false;
  /** guerra de tribos: lado do inimigo (0 = nenhum), o rival que ele persegue e o próximo golpe nele */
  faction = 0;
  foe: Enemy | null = null;
  foeAt = 0;
  /** efeitos elementais ativos: fim de cada um (s); 0 = inativo */
  status: Record<Primary, number> = { fire: 0, water: 0, air: 0, earth: 0 };
  /** fim do último efeito ou controle ativo (pula inimigos sem efeito no laço) */
  statusEnd = 0;
  burnDps = 0;
  burnTickAt = 0;
  frozenUntil = 0;
  mudUntil = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'atlas', frameName('slime'));
  }

  spawn(def: EnemyDef, x: number, y: number, hpMult: number, dmgMult: number, elite = false) {
    this.def = def;
    this.uid = nextUid++;
    this.elite = elite;
    this.boss = !!def.boss;
    this.resist = Math.min(CONTROL_RULES.max, def.resist + (elite ? CONTROL_RULES.elite : 0));
    this.resistShownAt = -99;
    this.tag = '';
    this.sleeping = this.marchX = this.marchY = 0;
    this.portalEvery = this.portalN = this.portalRange = this.portalAt = 0;
    const eliteMult = elite ? 10 : 1;
    this.maxHp = Math.round(def.hp * hpMult * eliteMult);
    this.hp = this.maxHp;
    this.damage = def.damage * dmgMult * (elite ? 1.5 : 1);
    this.speed = def.speed * (elite ? 0.9 : 1) * (0.9 + Math.random() * 0.2);
    this.xp = def.xp * (elite ? 12 : 1);
    this.kbX = this.kbY = 0;
    this.flashUntil = 0;
    this.flashAt = -99;
    this.intangible = false;
    this.baseTint = 0;
    this.orbHitAt = this.auraHitAt = -99;
    this.phase = Math.random() * Math.PI * 2;
    const scale = def.scale * (elite ? 1.6 : 1);
    this.radius = def.radius * scale;
    this.baseScale = scale;
    this.animFrame = 0;
    this.slots = slotsOf(def.texture);
    this.hurtUntil = 0;
    this.attackPhase = 'walk';
    this.burrowed = false;
    this.faction = 0;
    this.foe = null;
    this.foeAt = 0;
    this.attackTimer = 3;
    this.status.fire = this.status.water = this.status.air = this.status.earth = 0;
    this.statusEnd = this.burnDps = this.burnTickAt = this.frozenUntil = this.mudUntil = 0;
    this.setPosition(x, y).setActive(true).setVisible(true).setAlpha(1).setAngle(0);
    this.setFrame(frameName(def.texture, 0)).setScale(scale).setDepth(y);
    // a posição é o centro do corpo (a sombra fica embutida na base do sprite)
    this.setOrigin(0.5, def.kind === 'bat' ? 0.5 : 0.65);
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
  /** multiplicador da chance de efeito elemental da arma que disparou */
  effect = 1;
  owner: WeaponId | null = null;
  hits = new Set<number>();

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'atlas', frameName('bolt'));
  }

  fire(kind: ProjectileKind, texture: string, x: number, y: number, vx: number, vy: number, damage: number, pierce: number, life: number, scale: number, element: Element, effect: number) {
    this.kind = kind;
    this.damage = damage;
    this.pierce = pierce;
    this.life = life;
    this.vx = vx;
    this.vy = vy;
    this.element = element;
    this.effect = effect;
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

export type PickupKind = 'gem' | 'coin' | 'heart' | 'magnet' | 'bomb';

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
