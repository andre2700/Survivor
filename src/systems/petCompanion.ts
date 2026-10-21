// O pet na partida: segue o herói um pouco atrás, com animação por código (voando: flutua e bate as
// "asas" esticando; andando: pulinhos), e ataca sozinho. O dano acompanha o nível do pet, o dano do
// herói e a força da fase.
import Phaser from 'phaser';
import { frameName } from '../art/textures';
import { damageMult } from '../core/stats';
import { getPet, petPower, petStage, type PetDef } from '../data/pets';
import { stageScaling } from '../data/stages';
import type { Enemy } from '../entities';
import { LAYER, type GameScene } from '../scenes/GameScene';
import { sfx } from './sfx';

/** Bola de fogo por estágio: intervalo (s), quantas por vez e dano base de cada. */
const DRAGON = [
  { every: 1.5, count: 1, damage: 14 },
  { every: 1.25, count: 2, damage: 16 },
  { every: 1.05, count: 3, damage: 18 },
];
const BREATH_EVERY = 7;
const RANGE = 200;

export class PetCompanion {
  readonly img: Phaser.GameObjects.Image;
  /** sombra no chão (o pet que voa fica acima dela) */
  private shadow: Phaser.GameObjects.Image;
  private def: PetDef;
  private stage: 0 | 1 | 2;
  private power: number;
  private nextShot = 1;
  private nextBreath = BREATH_EVERY;
  private vx = 0;

  constructor(private sc: GameScene, id: Parameters<typeof getPet>[0], level: number) {
    this.def = getPet(id);
    this.stage = petStage(level);
    this.power = petPower(level);
    const p = sc.player;
    this.img = sc.add.image(p.x - 20, p.y, 'atlas', frameName(this.def.textures[this.stage])).setOrigin(0.5, 0.95);
    this.shadow = sc.add.image(this.img.x, this.img.y, 'atlas', frameName('shadow')).setAlpha(0.45);
  }

  private dmg(base: number) {
    const sc = this.sc;
    return base * this.power * damageMult(sc.stats) * Math.pow(stageScaling(sc.stage, sc.elapsed / 900).hp, 0.85);
  }

  update(dt: number) {
    const sc = this.sc;
    const p = sc.player;
    const t = sc.elapsed;
    // fica um pouco atrás e acima do herói, do lado oposto ao que ele olha
    const side = p.flipX ? 1 : -1;
    const tx = p.x + side * (18 + this.stage * 3);
    const ty = p.y - 4;
    const k = Math.min(1, dt * 5);
    const ox = this.img.x;
    this.img.x += (tx - this.img.x) * k;
    this.img.y += (ty - this.img.y) * k;
    this.vx = (this.img.x - ox) / Math.max(dt, 1e-3);
    const moving = Math.abs(this.vx) > 8;
    if (this.def.flies) {
      // flutua; as asas "batem" esticando e achatando
      const flap = Math.sin(t * 10);
      this.img.setOrigin(0.5, 1.25 + Math.sin(t * 3) * 0.05);
      this.img.setScale(1 + flap * 0.03, 1 - flap * 0.04);
    } else {
      const hop = moving ? Math.abs(Math.sin(t * 9)) : 0;
      this.img.setOrigin(0.5, 0.95 + hop * 0.12);
      this.img.setScale(1 + hop * 0.04, 1 - hop * 0.05);
    }
    // olha para o alvo, senão para onde o herói olha
    const target = sc.nearestEnemies(this.img.x, this.img.y, 1, RANGE)[0];
    this.img.setFlipX(target ? target.x < this.img.x : p.flipX);
    this.img.setDepth(this.img.y + 0.5);
    const w = this.img.displayWidth / 46;
    this.shadow.setPosition(this.img.x, this.img.y).setScale(w * (this.def.flies ? 0.8 : 1), w * 0.5).setDepth(LAYER.groundFx);
    this.img.setAlpha(p.alpha < 1 ? 0.85 : 1);

    if (this.def.id === 'dragon') this.dragon(t);
  }

  private dragon(t: number) {
    const sc = this.sc;
    const cfg = DRAGON[this.stage];
    if (t >= this.nextShot) {
      const targets = sc.nearestEnemies(this.img.x, this.img.y, cfg.count, RANGE);
      if (targets.length) {
        this.nextShot = t + cfg.every;
        targets.forEach((e, i) => sc.time.delayedCall(i * 90, () => this.fireball(e, this.dmg(cfg.damage))));
        this.img.setScale(1.12, 0.9);
      } else this.nextShot = t + 0.25;
    }
    // adulto: sopro de fogo em leque na direção do inimigo mais perto
    if (this.stage === 2 && t >= this.nextBreath) {
      const e = sc.nearestEnemies(this.img.x, this.img.y, 1, 130)[0];
      if (e) {
        this.nextBreath = t + BREATH_EVERY;
        this.breath(Math.atan2(e.y - this.img.y, e.x - this.img.x));
      } else this.nextBreath = t + 0.5;
    }
  }

  /** Mouth position: frente da cabeça, do lado para onde o pet olha. */
  private mouth() {
    const f = this.img.flipX ? -1 : 1;
    return { x: this.img.x + f * this.img.displayWidth * 0.3, y: this.img.y - this.img.displayHeight * (this.img.originY - 0.3) };
  }

  private fireball(e: Enemy, damage: number) {
    const sc = this.sc;
    if (!this.img.active) return;
    const m = this.mouth();
    const ex = e.x;
    const ey = e.y - 6;
    const ball = sc.add.image(m.x, m.y, 'atlas', frameName('fx_fireball')).setScale(0.75 + this.stage * 0.12).setDepth(LAYER.fx)
      .setRotation(Math.atan2(ey - m.y, ex - m.x));
    const dist = Math.hypot(ex - m.x, ey - m.y);
    sfx('whoosh');
    sc.tweens.add({
      targets: ball, x: ex, y: ey, duration: Math.max(120, (dist / 280) * 1000),
      onUpdate: () => {
        if (Math.random() < 0.4) sc.emitFlame(ball.x, ball.y);
      },
      onComplete: () => {
        ball.destroy();
        sc.impact(ex, ey, 0xff8a3a, 0.6 + this.stage * 0.15);
        // chega no alvo (se ele ainda estiver por perto) e queima um pouco em volta
        sc.queryEnemies(ex, ey, 18 + this.stage * 4, (foe) => {
          if ((foe.x - ex) ** 2 + (foe.y - ey) ** 2 < (18 + this.stage * 4) ** 2) sc.hitEnemy(foe, damage, 0.4, 'fire', true, 0.35);
        });
      },
    });
  }

  private breath(a: number) {
    const sc = this.sc;
    const m = this.mouth();
    const range = 130;
    for (let i = 0; i < 9; i++) {
      const ai = a + (i - 4) * 0.1;
      const img = sc.add.image(m.x, m.y, 'atlas', frameName('fx_fireball')).setRotation(ai).setScale(0.6).setDepth(LAYER.fx);
      sc.tweens.add({ targets: img, x: m.x + Math.cos(ai) * range, y: m.y + Math.sin(ai) * range, scale: 1.3, alpha: 0, duration: 450, onComplete: () => img.destroy() });
    }
    sfx('whoosh');
    sc.floatText(this.img.x, this.img.y - 30, 'SOPRO DE FOGO!', '#ffb070', false);
    const d = this.dmg(DRAGON[2].damage * 3);
    sc.queryEnemies(m.x, m.y, range, (e) => {
      const ea = Math.atan2(e.y - m.y, e.x - m.x);
      if (Math.abs(Phaser.Math.Angle.Wrap(ea - a)) < 0.5) sc.hitEnemy(e, d, 0.8, 'fire', true, 0.6);
    });
  }

  destroy() {
    this.img.destroy();
    this.shadow.destroy();
  }
}
