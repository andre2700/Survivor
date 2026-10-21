// O pet na partida: segue o herói um pouco atrás e ataca sozinho. Usa os quadros da forma atual
// (2 de movimento, preparar e atacar) com balanço por código (voando: flutua; andando: pulinhos).
// Cada estágio ataca mais forte, e o Mega tem um golpe supremo a cada 30 s. O dano acompanha o nível
// e o estágio do pet, o dano do herói e a força da fase.
import Phaser from 'phaser';
import { frameHd, frameName, slotsOf, type Slots } from '../art/textures';
import { damageMult } from '../core/stats';
import { getPet, petPower, type PetDef, type PetForm, type PetStage } from '../data/pets';
import { stageScaling } from '../data/stages';
import type { Enemy } from '../entities';
import { LAYER, type GameScene } from '../scenes/GameScene';
import type { PetState } from './pets';
import { sfx } from './sfx';

/** Linhagem do Fogo, por estágio: intervalo (s), bolas por vez, dano, tamanho da bola e raio da explosão. */
const FIRE = [
  { every: 1.6, count: 1, damage: 9, size: 0.5, aoe: 0 },
  { every: 1.4, count: 1, damage: 14, size: 0.75, aoe: 14 },
  { every: 1.3, count: 2, damage: 17, size: 0.9, aoe: 28 },
  { every: 1.15, count: 3, damage: 20, size: 1, aoe: 30 },
  { every: 1, count: 3, damage: 24, size: 1.15, aoe: 34 },
];
/** Sopro em leque (Super e Mega) e Chuva Solar (Mega). */
const BREATH = { every: 7, range: 130, damage: 3 };
const ULT = { every: 30, first: 12, meteors: 12, damage: 9, radius: 40 };
const RANGE = 200;
/** Preparar e atacar (s): o pet mostra os quadros antes e durante o tiro. */
const WINDUP = 0.22;
const STRIKE = 0.28;

export class PetCompanion {
  readonly img: Phaser.GameObjects.Image;
  /** sombra no chão (o pet que voa fica acima dela) */
  private shadow: Phaser.GameObjects.Image;
  private def: PetDef;
  private form: PetForm;
  private slots: Slots;
  private stage: PetStage;
  private power: number;
  private nextShot = 1;
  private nextBreath = BREATH.every;
  private nextUlt = ULT.first;
  /** ataque em andamento: até quando mostra preparar e atacar */
  private windupUntil = 0;
  private strikeUntil = 0;
  /** inimigos derrotados pelo pet nesta partida (requisito de evolução) */
  kills = 0;

  constructor(private sc: GameScene, id: Parameters<typeof getPet>[0], state: PetState) {
    this.def = getPet(id);
    this.stage = state.stage;
    this.form = this.def.forms[this.stage];
    this.slots = slotsOf(this.form.texture);
    this.power = petPower(state.level, this.stage);
    const p = sc.player;
    this.img = sc.add.image(p.x - 20, p.y, 'atlas', frameName(this.form.texture)).setOrigin(0.5, 0.95);
    this.shadow = sc.add.image(this.img.x, this.img.y, 'atlas', frameName('shadow')).setAlpha(0.45);
  }

  private dmg(base: number) {
    const sc = this.sc;
    return base * this.power * damageMult(sc.stats) * Math.pow(stageScaling(sc.stage, sc.elapsed / 900).hp, 0.85);
  }

  /** Golpe do pet: conta o abate se o inimigo cair. */
  private hit(e: Enemy, amount: number, knock: number, effect: number) {
    if (!e.active) return;
    this.sc.hitEnemy(e, amount, knock, this.def.element, true, effect);
    if (!e.active) this.kills++;
  }

  /** Tamanho na tela (a textura é desenhada na resolução lógica, não na dela). */
  private get lw() {
    return this.img.displayWidth / frameHd(this.img);
  }

  private get lh() {
    return this.img.displayHeight / frameHd(this.img);
  }

  private setSlot(slot: string) {
    this.img.setFrame(frameName(this.form.texture, this.slots[slot] ?? 0));
  }

  update(dt: number) {
    const sc = this.sc;
    const p = sc.player;
    const t = sc.elapsed;
    // fica um pouco atrás e acima do herói, do lado oposto ao que ele olha
    const side = p.flipX ? 1 : -1;
    const tx = p.x + side * (14 + this.lw * 0.5);
    const ty = p.y - 4;
    const k = Math.min(1, dt * 5);
    this.img.x += (tx - this.img.x) * k;
    this.img.y += (ty - this.img.y) * k;
    // quadro: preparar, atacar ou o ciclo de movimento
    const move = this.form.move ?? ['walk_a', 'walk_b'];
    if (t < this.windupUntil) this.setSlot('windup');
    else if (t < this.strikeUntil) this.setSlot('attack');
    else this.setSlot(move[Math.floor(t * (this.def.flies ? 6 : 5)) % move.length]);
    if (this.def.flies) {
      this.img.setOrigin(0.5, 1.22 + Math.sin(t * 3) * 0.05);
      this.img.setScale(1);
    } else {
      const hop = Math.abs(Math.sin(t * 7));
      this.img.setOrigin(0.5, 0.95 + hop * 0.15);
      this.img.setScale(1 + (1 - hop) * 0.05, 1 - (1 - hop) * 0.05);
    }
    // olha para o alvo, senão para onde o herói olha
    const target = sc.nearestEnemies(this.img.x, this.img.y, 1, RANGE)[0];
    this.img.setFlipX(target ? target.x < this.img.x : p.flipX);
    this.img.setDepth(this.img.y + 0.5);
    const w = this.lw / 46;
    this.shadow.setPosition(this.img.x, this.img.y).setScale(w * (this.def.flies ? 0.7 : 0.9), w * 0.45).setDepth(LAYER.groundFx);
    this.img.setAlpha(p.alpha < 1 ? 0.85 : 1);

    if (this.def.id === 'fire') this.fire(t);
  }

  /** Começa um ataque: mostra preparar, depois atacar e chama `release` no meio do golpe. */
  private attack(t: number, release: () => void) {
    this.windupUntil = t + WINDUP;
    this.strikeUntil = t + WINDUP + STRIKE;
    this.sc.time.delayedCall(WINDUP * 1000, () => {
      if (this.img.active) release();
    });
  }

  private fire(t: number) {
    const sc = this.sc;
    const cfg = FIRE[this.stage];
    const busy = t < this.strikeUntil;
    // Mega: Chuva Solar
    if (this.stage === 4 && t >= this.nextUlt && !busy) {
      this.nextUlt = t + ULT.every;
      this.attack(t, () => this.solarRain());
      return;
    }
    // Super e Mega: sopro de fogo em leque
    if (this.stage >= 3 && t >= this.nextBreath && !busy) {
      const e = sc.nearestEnemies(this.img.x, this.img.y, 1, BREATH.range)[0];
      if (e) {
        this.nextBreath = t + BREATH.every;
        this.attack(t, () => this.breath(Math.atan2(e.y - this.img.y, e.x - this.img.x)));
        return;
      }
      this.nextBreath = t + 0.5;
    }
    if (t >= this.nextShot && !busy) {
      const targets = sc.nearestEnemies(this.img.x, this.img.y, cfg.count, RANGE);
      if (targets.length) {
        this.nextShot = t + cfg.every;
        this.attack(t, () => targets.forEach((e, i) => sc.time.delayedCall(i * 90, () => this.fireball(e, this.dmg(cfg.damage), cfg.size, cfg.aoe))));
      } else this.nextShot = t + 0.25;
    }
  }

  /** Boca: frente da cabeça, do lado para onde o pet olha. */
  private mouth() {
    const f = this.img.flipX ? -1 : 1;
    return { x: this.img.x + f * this.lw * 0.35, y: this.img.y - this.lh * (this.img.originY - 0.35) };
  }

  private fireball(e: Enemy, damage: number, size: number, aoe: number) {
    const sc = this.sc;
    if (!this.img.active) return;
    const m = this.mouth();
    const ex = e.x;
    const ey = e.y - 6;
    const ball = sc.add.image(m.x, m.y, 'atlas', frameName('fx_fireball')).setScale(size).setDepth(LAYER.fx)
      .setRotation(Math.atan2(ey - m.y, ex - m.x));
    const dist = Math.hypot(ex - m.x, ey - m.y);
    sfx('whoosh');
    sc.tweens.add({
      targets: ball, x: ex, y: ey, duration: Math.max(120, (dist / 300) * 1000),
      onUpdate: () => {
        if (Math.random() < 0.3 + size * 0.2) sc.emitFlame(ball.x, ball.y);
      },
      onComplete: () => {
        ball.destroy();
        if (aoe >= 26) {
          // Adulto em diante: a bola explode
          sc.elements.vfx('vfx_explosion', ex, ey + aoe * 0.4, aoe * 2, [[0, 0.04], [1, 0.05], [2, 0.1], [3, 0.2]]);
          sfx('boom');
        } else sc.impact(ex, ey, 0xff8a3a, 0.5 + size * 0.4);
        const r = Math.max(12, aoe);
        sc.queryEnemies(ex, ey, r + 4, (foe) => {
          if ((foe.x - ex) ** 2 + (foe.y - ey) ** 2 < r * r) this.hit(foe, damage, 0.4, 0.35);
        });
      },
    });
  }

  private breath(a: number) {
    const sc = this.sc;
    const m = this.mouth();
    for (let i = 0; i < 11; i++) {
      const ai = a + (i - 5) * 0.09;
      const img = sc.add.image(m.x, m.y, 'atlas', frameName('fx_fireball')).setRotation(ai).setScale(0.6).setDepth(LAYER.fx);
      sc.tweens.add({ targets: img, x: m.x + Math.cos(ai) * BREATH.range, y: m.y + Math.sin(ai) * BREATH.range, scale: 1.4, alpha: 0, duration: 450, onComplete: () => img.destroy() });
    }
    sfx('whoosh');
    sc.floatText(this.img.x, this.img.y - 34, 'SOPRO DE FOGO!', '#ffb070', false);
    const d = this.dmg(FIRE[this.stage].damage * BREATH.damage);
    sc.queryEnemies(m.x, m.y, BREATH.range, (e) => {
      const ea = Math.atan2(e.y - m.y, e.x - m.x);
      if (Math.abs(Phaser.Math.Angle.Wrap(ea - a)) < 0.5) this.hit(e, d, 0.8, 0.6);
    });
  }

  /** Golpe supremo do Rei Solar: meteoros caem sobre os inimigos da tela toda. */
  private solarRain() {
    const sc = this.sc;
    const view = sc.cameras.main.worldView;
    sc.events.emit('announce', 'CHUVA SOLAR!');
    sc.cameras.main.shake(500, 0.006);
    sfx('levelup');
    const glow = sc.add.image(this.img.x, this.img.y - this.lh * 0.6, 'atlas', frameName('glow')).setTint(0xffd060).setBlendMode(Phaser.BlendModes.ADD).setDepth(LAYER.fx).setScale(2);
    sc.tweens.add({ targets: glow, scale: 9, alpha: 0, duration: 700, onComplete: () => glow.destroy() });
    const foes = sc.activeEnemies().filter((e) => view.contains(e.x, e.y));
    const d = this.dmg(FIRE[4].damage * ULT.damage);
    for (let i = 0; i < ULT.meteors; i++) {
      const e = foes.length ? foes[Math.floor(Math.random() * foes.length)] : undefined;
      const x = e ? e.x + (Math.random() - 0.5) * 20 : view.x + Math.random() * view.width;
      const y = e ? e.y : view.y + Math.random() * view.height;
      sc.time.delayedCall(150 + i * 110, () => {
        const ball = sc.add.image(x + 60, view.y - 30, 'atlas', frameName('fx_fireball')).setScale(1.8).setDepth(LAYER.fx + 2)
          .setRotation(Math.atan2(y - (view.y - 30), -60));
        sc.tweens.add({
          targets: ball, x, y, duration: 420, ease: 'Quad.In',
          onComplete: () => {
            ball.destroy();
            sc.elements.vfx('vfx_explosion', x, y + ULT.radius * 0.4, ULT.radius * 2.2, [[0, 0.04], [1, 0.05], [2, 0.1], [3, 0.22]]);
            sfx('boom');
            sc.queryEnemies(x, y, ULT.radius + 4, (foe) => {
              if ((foe.x - x) ** 2 + (foe.y - y) ** 2 < ULT.radius * ULT.radius) this.hit(foe, d, 1, 0.8);
            });
          },
        });
      });
    }
  }

  destroy() {
    this.img.destroy();
    this.shadow.destroy();
  }
}
