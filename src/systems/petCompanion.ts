// O pet na partida: segue o herói um pouco atrás e ataca sozinho. Usa os quadros da forma atual
// (2 de movimento, preparar e atacar) com balanço por código (voando: flutua; andando: pulinhos).
// Cada linhagem tem o seu kit, que cresce a cada estágio; o Supremo tem um golpe especial a cada 30 s.
// O dano acompanha o nível e o estágio do pet, o dano do herói e a força da fase.
import Phaser from 'phaser';
import { frameHd, frameName, loopFrame, slotsOf, type Slots } from '../art/textures';
import { damageMult } from '../core/stats';
import { getPet, petPower, type MissionStat, type PetDef, type PetForm, type PetStage } from '../data/pets';
import { stageScaling } from '../data/stages';
import type { Enemy } from '../entities';
import { LAYER, type GameScene } from '../scenes/GameScene';
import type { PetState } from './pets';
import { sfx } from './sfx';

/** Tiro básico por estágio: intervalo (s), quantos por vez, dano, tamanho e raio da área (0 = só o alvo). */
interface Shot { every: number; count: number; damage: number; size: number; aoe: number }
const shots = (rows: [number, number, number, number, number][]): Shot[] =>
  rows.map(([every, count, damage, size, aoe]) => ({ every, count, damage, size, aoe }));

const KIT: Record<PetDef['id'], Shot[]> = {
  fire: shots([[1.6, 1, 9, 0.5, 0], [1.4, 1, 14, 0.75, 14], [1.3, 2, 17, 0.9, 28], [1.15, 3, 20, 1, 30], [1, 3, 24, 1.15, 34]]),
  water: shots([[1.6, 1, 8, 0.5, 0], [1.4, 1, 13, 0.75, 12], [1.3, 2, 16, 0.9, 24], [1.15, 2, 19, 1, 28], [1, 3, 23, 1.15, 32]]),
  air: shots([[1.4, 1, 7, 0.5, 0], [1.25, 1, 11, 0.75, 0], [1.15, 2, 14, 0.9, 0], [1.05, 3, 17, 1, 0], [0.95, 3, 21, 1.15, 0]]),
  earth: shots([[1.8, 1, 10, 0.5, 0], [1.6, 1, 15, 0.75, 16], [1.5, 1, 20, 0.95, 24], [1.35, 2, 23, 1.05, 26], [1.2, 2, 28, 1.2, 30]]),
  light: shots([[1.7, 1, 6, 0.5, 0], [1.5, 1, 11, 0.75, 0], [1.35, 2, 14, 0.9, 0], [1.2, 2, 17, 1, 14], [1.05, 3, 21, 1.15, 18]]),
  dark: shots([[1.5, 1, 10, 0.6, 18], [1.35, 1, 15, 0.8, 20], [1.2, 1, 19, 0.95, 24], [1.1, 2, 22, 1.05, 26], [1, 2, 27, 1.2, 30]]),
};
/** Projétil de cada linhagem (a Sombra ataca de perto: avança e arranha). */
const PROJECTILE: Record<PetDef['id'], string> = {
  fire: 'fx_fireball', water: 'fx_water_orb', air: 'fx_wind_blade', earth: 'fx_rock', light: 'fx_light_orb', dark: 'fx_shadow_claw',
};
const COLOR: Record<PetDef['id'], number> = { fire: 0xff8a3a, water: 0x41a6f6, air: 0xb8f0a0, earth: 0xc08040, light: 0xffe9a0, dark: 0xa070ff };
const ULT_NAME: Record<PetDef['id'], string> = { fire: 'CHUVA SOLAR!', water: 'MAREMOTO!', air: 'FURACÃO!', earth: 'TERREMOTO!', light: 'JULGAMENTO!', dark: 'ECLIPSE!' };

/** Golpe extra do Adulto (e do Supremo), a cada `every` s. */
const SPECIAL = { every: 8, damage: 3 };
/** Golpe do Supremo. */
const ULT = { every: 30, first: 12, damage: 9 };
const RANGE = 200;
/** Preparar e atacar (s): o pet mostra os quadros antes e durante o golpe. */
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
  private nextSpecial = SPECIAL.every;
  private nextUlt = ULT.first;
  private nextHeal = 3;
  private nextGems = 0;
  /** ataque em andamento: até quando mostra preparar e atacar */
  private windupUntil = 0;
  private strikeUntil = 0;
  /** Sombra: avanço até o alvo (posição e até quando) */
  private dash: { x: number; y: number; until: number } | null = null;
  /** inimigos derrotados pelo pet nesta partida (requisito de evolução) */
  kills = 0;
  /** contadores das missões feitos pelo próprio pet (empurrões, atordoados, cura) */
  readonly mission: Partial<Record<MissionStat, number>> = {};

  constructor(private sc: GameScene, id: PetDef['id'], state: PetState) {
    this.def = getPet(id);
    this.stage = state.stage;
    this.form = this.def.forms[this.stage];
    this.slots = slotsOf(this.form.texture);
    this.power = petPower(state.level, this.stage);
    const p = sc.player;
    this.img = sc.add.image(p.x - 20, p.y, 'atlas', frameName(this.form.texture)).setOrigin(0.5, 0.95);
    this.shadow = sc.add.image(this.img.x, this.img.y, 'atlas', frameName('shadow')).setAlpha(0.45);
  }

  /** Tamanho na tela (a textura é desenhada na resolução lógica, não na dela). */
  private get lw() {
    return this.img.displayWidth / frameHd(this.img);
  }

  private get lh() {
    return this.img.displayHeight / frameHd(this.img);
  }

  private dmg(base: number) {
    const sc = this.sc;
    return base * this.power * damageMult(sc.stats) * Math.pow(stageScaling(sc.stage, sc.elapsed / 900).hp, 0.85);
  }

  private count(stat: MissionStat, n = 1) {
    this.mission[stat] = (this.mission[stat] ?? 0) + n;
  }

  /** Golpe do pet: conta abates, empurrões (Ar) e o roubo de ouro (Sombra). */
  private hit(e: Enemy, amount: number, knock: number, effect: number) {
    if (!e.active) return;
    const sc = this.sc;
    sc.hitEnemy(e, amount, knock, this.def.element, true, effect);
    if (knock > 0 && this.def.id === 'air') this.count('pushes');
    if (!e.active) {
      this.kills++;
      // Sombra (Jovem em diante): rouba ouro de quem derruba
      if (this.def.id === 'dark' && this.stage >= 2) sc.gold += (this.stage - 1) * stageScaling(sc.stage).reward;
    }
  }

  /** Atordoa (Terra): fica parado um instante, com a cor da pedra. */
  private stun(e: Enemy, time: number) {
    if (!e.active) return;
    const f = this.sc.control(e);
    if (!f) return;
    e.frozenUntil = Math.max(e.frozenUntil, this.sc.elapsed + time * f);
    e.statusEnd = Math.max(e.statusEnd, e.frozenUntil);
    e.setTint(0xc8a070);
    this.count('stuns');
  }

  private heal(amount: number) {
    const sc = this.sc;
    const got = Math.min(amount, sc.stats.maxHp - sc.hp);
    if (got <= 0) return;
    sc.hp += got;
    this.count('heal', got);
    sc.floatText(sc.player.x, sc.player.y - 26, `+${Math.round(got)}`, '#8cf08a', false);
    const ring = sc.add.image(sc.player.x, sc.player.y - 6, 'atlas', frameName('aura')).setTint(0xfff0a0).setBlendMode(Phaser.BlendModes.ADD).setDepth(LAYER.fx).setScale(0.4).setAlpha(0.8);
    sc.tweens.add({ targets: ring, scale: 0.8, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
  }

  private setSlot(slot: string) {
    this.img.setFrame(frameName(this.form.texture, this.slots[slot] ?? 0));
  }

  update(dt: number) {
    const sc = this.sc;
    const p = sc.player;
    const t = sc.elapsed;
    // fica um pouco atrás e acima do herói, do lado oposto ao que ele olha (a Sombra avança no alvo)
    const side = p.flipX ? 1 : -1;
    let tx = p.x + side * (14 + this.lw * 0.5);
    let ty = p.y - 4;
    let k = Math.min(1, dt * 5);
    if (this.dash && t < this.dash.until) {
      tx = this.dash.x;
      ty = this.dash.y;
      k = Math.min(1, dt * 18);
    }
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
      this.img.setOrigin(0.5, 0.95 + hop * (this.stage < 2 ? 0.15 : 0.04));
      this.img.setScale(1 + (1 - hop) * 0.04, 1 - (1 - hop) * 0.04);
    }
    // olha para o alvo, senão para onde o herói olha
    const target = sc.nearestEnemies(this.img.x, this.img.y, 1, RANGE)[0];
    this.img.setFlipX(target ? target.x < this.img.x : p.flipX);
    this.img.setDepth(this.img.y + 0.5);
    const w = this.lw / 46;
    this.shadow.setPosition(this.img.x, this.img.y).setScale(w * (this.def.flies ? 0.7 : 0.9), w * 0.45).setDepth(LAYER.groundFx);
    this.img.setAlpha(p.alpha < 1 ? 0.85 : 1);

    // Sombra (Criança em diante): puxa as gemas perto dela
    if (this.def.id === 'dark' && this.stage >= 1 && t >= this.nextGems) {
      this.nextGems = t + 0.2;
      sc.pullGemsNear(this.img.x, this.img.y, 50 + this.stage * 12);
    }
    // Luz: cura o herói de tempos em tempos
    if (this.def.id === 'light' && t >= this.nextHeal) {
      this.nextHeal = t + [4, 4, 3.5, 3.2, 3][this.stage];
      this.heal(sc.stats.maxHp * [0.01, 0.015, 0.02, 0.025, 0.03][this.stage]);
    }
    this.act(t);
  }

  /** Começa um ataque: mostra preparar, depois atacar e chama `release` no meio do golpe. */
  private attack(t: number, release: () => void) {
    this.windupUntil = t + WINDUP;
    this.strikeUntil = t + WINDUP + STRIKE;
    this.sc.time.delayedCall(WINDUP * 1000, () => {
      if (this.img.active) release();
    });
  }

  private act(t: number) {
    const sc = this.sc;
    if (t < this.strikeUntil) return;
    if (this.stage === 4 && t >= this.nextUlt) {
      this.nextUlt = t + ULT.every;
      this.attack(t, () => this.ultimate());
      return;
    }
    if (this.stage >= 3 && t >= this.nextSpecial) {
      const e = sc.nearestEnemies(this.img.x, this.img.y, 1, 150)[0];
      if (e) {
        this.nextSpecial = t + SPECIAL.every;
        this.attack(t, () => this.special(e));
        return;
      }
      this.nextSpecial = t + 0.5;
    }
    if (t < this.nextShot) return;
    const cfg = KIT[this.def.id][this.stage];
    const targets = sc.nearestEnemies(this.img.x, this.img.y, cfg.count, this.def.id === 'dark' ? 120 : RANGE);
    if (!targets.length) {
      this.nextShot = t + 0.25;
      return;
    }
    this.nextShot = t + cfg.every;
    if (this.def.id === 'dark') {
      // avança no alvo e arranha
      const e = targets[0];
      this.dash = { x: e.x - (e.x > this.img.x ? 12 : -12), y: e.y, until: t + WINDUP + STRIKE + 0.1 };
      this.attack(t, () => targets.forEach((foe, i) => sc.time.delayedCall(i * 140, () => this.claw(foe, this.dmg(cfg.damage), cfg))));
      return;
    }
    this.attack(t, () => targets.forEach((e, i) => sc.time.delayedCall(i * 90, () => this.shoot(e, this.dmg(cfg.damage), cfg))));
  }

  /** Boca: frente da cabeça, do lado para onde o pet olha. */
  private mouth() {
    const f = this.img.flipX ? -1 : 1;
    return { x: this.img.x + f * this.lw * 0.35, y: this.img.y - this.lh * (this.img.originY - 0.35) };
  }

  /** Projétil da linhagem até o inimigo (a pedra vai em arco); na chegada fere o alvo ou a área. */
  private shoot(e: Enemy, damage: number, cfg: Shot) {
    const sc = this.sc;
    if (!this.img.active) return;
    const id = this.def.id;
    const key = PROJECTILE[id];
    const m = this.mouth();
    const ex = e.x;
    const ey = e.y - 6;
    const ball = sc.add.image(m.x, m.y, 'atlas', frameName(key)).setScale(cfg.size).setDepth(LAYER.fx)
      .setRotation(id === 'earth' ? 0 : Math.atan2(ey - m.y, ex - m.x));
    const dist = Math.hypot(ex - m.x, ey - m.y);
    const dur = Math.max(140, (dist / (id === 'earth' ? 240 : 300)) * 1000);
    const t0 = sc.elapsed;
    sfx(id === 'water' ? 'splash' : 'whoosh');
    sc.tweens.addCounter({
      from: 0, to: 1, duration: dur,
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 1;
        ball.setPosition(m.x + (ex - m.x) * k, m.y + (ey - m.y) * k - (id === 'earth' ? Math.sin(k * Math.PI) * 30 : 0));
        if (id === 'earth') ball.setRotation(k * 8);
        else ball.setFrame(loopFrame(key, sc.elapsed - t0, 10));
        if (id === 'fire' && Math.random() < 0.3 + cfg.size * 0.2) sc.emitFlame(ball.x, ball.y);
      },
      onComplete: () => {
        ball.destroy();
        this.land(ex, ey, damage, cfg, e);
      },
    });
  }

  /** Chegada do tiro: efeito de cada linhagem. */
  private land(x: number, y: number, damage: number, cfg: Shot, target: Enemy) {
    const sc = this.sc;
    const id = this.def.id;
    if (id === 'fire' && cfg.aoe >= 26) {
      sc.elements.vfx('vfx_explosion', x, y + cfg.aoe * 0.4, cfg.aoe * 2, [[0, 0.04], [1, 0.05], [2, 0.1], [3, 0.2]]);
      sfx('boom');
    } else sc.impact(x, y, COLOR[id], 0.5 + cfg.size * 0.4 + cfg.aoe / 40);
    // Ar: só o alvo, com empurrão forte; os outros: o alvo ou a área
    const knock = id === 'air' ? 1.5 + this.stage * 0.4 : 0.4;
    const effect = id === 'water' ? 0.5 : 0.35;
    if (!cfg.aoe) {
      if (target.active && (target.x - x) ** 2 + (target.y - 6 - y) ** 2 < 30 * 30) this.hit(target, damage, knock, effect);
      return;
    }
    sc.queryEnemies(x, y, cfg.aoe + 4, (foe) => {
      if ((foe.x - x) ** 2 + (foe.y - y) ** 2 >= cfg.aoe * cfg.aoe) return;
      this.hit(foe, damage, knock, effect);
      // Terra: chance de atordoar
      if (id === 'earth' && Math.random() < 0.25 + this.stage * 0.08) this.stun(foe, 0.6 + this.stage * 0.15);
    });
  }

  /** Sombra: arranhão em área em cima do alvo. */
  private claw(e: Enemy, damage: number, cfg: Shot) {
    const sc = this.sc;
    if (!e.active) return;
    const fx = sc.add.image(e.x, e.y - 8, 'atlas', frameName('fx_shadow_claw')).setScale(cfg.size).setDepth(LAYER.fx).setFlipX(e.x < this.img.x);
    sc.tweens.add({ targets: fx, alpha: 0, scale: cfg.size * 1.3, duration: 260, onComplete: () => fx.destroy() });
    sfx('hit');
    sc.queryEnemies(e.x, e.y, cfg.aoe + 4, (foe) => {
      if ((foe.x - e.x) ** 2 + (foe.y - e.y) ** 2 < cfg.aoe * cfg.aoe) this.hit(foe, damage, 0.3, 0.3);
    });
  }

  /** Golpe do Adulto (e do Supremo). */
  private special(e: Enemy) {
    const m = this.mouth();
    const a = Math.atan2(e.y - m.y, e.x - m.x);
    const d = this.dmg(KIT[this.def.id][this.stage].damage * SPECIAL.damage);
    switch (this.def.id) {
      case 'fire': return this.breath(a, d);
      case 'water': return this.wave(a, d, m);
      case 'air': return this.tornado(e.x, e.y, d, 1, 3);
      case 'earth': return this.wall(d);
      case 'light': return this.shield();
      case 'dark': return this.frenzy(d);
    }
  }

  private breath(a: number, d: number) {
    const sc = this.sc;
    const m = this.mouth();
    const range = 130;
    for (let i = 0; i < 11; i++) {
      const ai = a + (i - 5) * 0.09;
      const img = sc.add.image(m.x, m.y, 'atlas', frameName('fx_fireball')).setRotation(ai).setScale(0.6).setDepth(LAYER.fx);
      sc.tweens.add({ targets: img, x: m.x + Math.cos(ai) * range, y: m.y + Math.sin(ai) * range, scale: 1.4, alpha: 0, duration: 450, onComplete: () => img.destroy() });
    }
    sfx('whoosh');
    sc.floatText(this.img.x, this.img.y - 34, 'SOPRO DE FOGO!', '#ffb070', false);
    sc.queryEnemies(m.x, m.y, range, (e) => {
      if (Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(e.y - m.y, e.x - m.x) - a)) < 0.5) this.hit(e, d, 0.8, 0.6);
    });
  }

  /** Água: uma onda sai de `from` na direção `a`, ferindo e empurrando quem estiver no caminho. */
  private wave(a: number, d: number, from: { x: number; y: number }, scale = 1, len = 220) {
    const sc = this.sc;
    const img = sc.add.image(from.x, from.y + 10, 'atlas', frameName('fx_wave')).setOrigin(0.5, 1).setScale(scale).setDepth(LAYER.fx).setFlipX(Math.cos(a) < 0);
    const ex = from.x + Math.cos(a) * len;
    const ey = from.y + Math.sin(a) * len;
    const hitSet = new Set<Enemy>();
    const t0 = sc.elapsed;
    sfx('splash');
    if (scale === 1) sc.floatText(this.img.x, this.img.y - 34, 'ONDA!', '#8fd8ff', false);
    sc.tweens.addCounter({
      from: 0, to: 1, duration: 900,
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 1;
        const x = from.x + (ex - from.x) * k;
        const y = from.y + (ey - from.y) * k;
        img.setPosition(x, y + 10).setFrame(loopFrame('fx_wave', sc.elapsed - t0, 8)).setAlpha(k > 0.8 ? (1 - k) * 5 : 1);
        sc.queryEnemies(x, y, 30 * scale, (e) => {
          if (hitSet.has(e)) return;
          hitSet.add(e);
          this.hit(e, d, 1.6, 0.8);
        });
      },
      onComplete: () => img.destroy(),
    });
  }

  /** Ar: tornado que puxa e fere em pulsos (anda `drift` px no tempo dele). */
  private tornado(x: number, y: number, d: number, scale: number, time: number, drift = 0) {
    const sc = this.sc;
    const img = sc.add.image(x, y + 10, 'atlas', frameName('fx_tornado')).setOrigin(0.5, 1).setScale(scale).setDepth(y + 20);
    const r = 34 * scale;
    const t0 = sc.elapsed;
    let next = 0;
    sfx('whoosh');
    if (scale <= 1) sc.floatText(this.img.x, this.img.y - 34, 'TORNADO!', '#c8f8b0', false);
    sc.tweens.addCounter({
      from: 0, to: 1, duration: time * 1000,
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 1;
        const cx = x + drift * k;
        img.setPosition(cx, y + 10).setFrame(loopFrame('fx_tornado', sc.elapsed - t0, 12)).setAlpha(k > 0.85 ? (1 - k) * 6 : 0.95);
        sc.queryEnemies(cx, y, r * 2, (e) => {
          if (e.boss) return;
          const dx = cx - e.x;
          const dy = y - e.y;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist < r * 2) {
            e.x += (dx / dist) * 1.2;
            e.y += (dy / dist) * 1.2;
          }
        });
        const now = sc.elapsed - t0;
        if (now >= next) {
          next = now + 0.35;
          sc.queryEnemies(cx, y, r, (e) => {
            if ((e.x - cx) ** 2 + (e.y - y) ** 2 < r * r) this.hit(e, d / 4, 0, 0.3);
          });
        }
      },
      onComplete: () => img.destroy(),
    });
  }

  /** Terra: anel de espinhos de pedra em volta do pet, fere e atordoa. */
  private wall(d: number) {
    const sc = this.sc;
    const x = this.img.x;
    const y = this.img.y;
    const r = 64;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      sc.weapons.spike(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.6, 0.9);
    }
    sc.cameras.main.shake(150, 0.003);
    sfx('boom');
    sc.floatText(x, y - 34, 'MURALHA!', '#e0b070', false);
    sc.queryEnemies(x, y, r, (e) => {
      if ((e.x - x) ** 2 + ((e.y - y) / 0.8) ** 2 >= r * r) return;
      this.hit(e, d, 0.6, 0.4);
      this.stun(e, 1.2);
    });
  }

  /** Luz: escudo que deixa o herói invulnerável por um instante. */
  private shield() {
    const sc = this.sc;
    const time = 1.5 + (this.stage - 3) * 0.5;
    sc.invulnUntil = Math.max(sc.invulnUntil, sc.elapsed + time);
    sc.floatText(sc.player.x, sc.player.y - 34, 'ESCUDO DE LUZ!', '#fff0a0', false);
    const ring = sc.add.image(sc.player.x, sc.player.y - 6, 'atlas', frameName('aura')).setTint(0xfff0a0).setBlendMode(Phaser.BlendModes.ADD).setDepth(LAYER.fx).setScale(0.65);
    sc.tweens.add({
      targets: ring, scale: 0.75, alpha: 0.5, duration: 300, yoyo: true, repeat: Math.ceil((time * 1000) / 600),
      onUpdate: () => ring.setPosition(sc.player.x, sc.player.y - 6), onComplete: () => ring.destroy(),
    });
    sfx('select');
  }

  /** Sombra: rajada de arranhões em vários inimigos em volta. */
  private frenzy(d: number) {
    const sc = this.sc;
    sc.floatText(this.img.x, this.img.y - 34, 'FRENESI!', '#c8a0ff', false);
    sc.nearestEnemies(this.img.x, this.img.y, 6, 140).forEach((e, i) => sc.time.delayedCall(i * 90, () => this.claw(e, d / 2, KIT.dark[this.stage])));
  }

  /** Golpe do Supremo de cada linhagem, na tela toda. */
  private ultimate() {
    const sc = this.sc;
    const view = sc.cameras.main.worldView;
    const d = this.dmg(KIT[this.def.id][4].damage * ULT.damage);
    sc.events.emit('announce', ULT_NAME[this.def.id]);
    sc.cameras.main.shake(500, 0.006);
    sfx('levelup');
    const glow = sc.add.image(this.img.x, this.img.y - this.lh * 0.6, 'atlas', frameName('glow')).setTint(COLOR[this.def.id]).setBlendMode(Phaser.BlendModes.ADD).setDepth(LAYER.fx).setScale(2);
    sc.tweens.add({ targets: glow, scale: 9, alpha: 0, duration: 700, onComplete: () => glow.destroy() });
    const foes = sc.activeEnemies().filter((e) => view.contains(e.x, e.y));
    switch (this.def.id) {
      case 'fire':
        return this.solarRain(view, foes, d);
      case 'water':
        // ondas gigantes atravessam a tela de um lado ao outro
        for (let i = 0; i < 4; i++) {
          const y = view.y + view.height * (0.2 + i * 0.2);
          const left = i % 2 === 0;
          sc.time.delayedCall(i * 200, () => this.wave(left ? 0 : Math.PI, d, { x: left ? view.x - 30 : view.right + 30, y }, 2.2, view.width + 60));
        }
        return;
      case 'air':
        return this.tornado(view.x + 40, view.centerY, d * 2, 2.6, 5, view.width - 80);
      case 'earth':
        for (const e of foes) {
          sc.weapons.spike(e.x, e.y + 6, 1.2);
          this.hit(e, d, 0.5, 0.5);
          this.stun(e, 2);
        }
        sc.cameras.main.shake(900, 0.012);
        return;
      case 'light':
        this.heal(sc.stats.maxHp * 0.25);
        foes.slice(0, 14).forEach((e, i) => sc.time.delayedCall(i * 70, () => {
          if (!e.active) return;
          sc.weapons.drawBolt(e.x, e.y, view.y - 10, false, 0xfff0a0);
          sc.impact(e.x, e.y, 0xfff0a0, 1.4);
          this.hit(e, d, 0.4, 0.5);
        }));
        return;
      case 'dark': {
        // eclipse: a tela escurece e os inimigos da tela sofrem em pulsos
        const veil = sc.add.rectangle(view.centerX, view.centerY, view.width + 40, view.height + 40, 0x0a0016, 0).setDepth(LAYER.fx + 3);
        sc.tweens.add({ targets: veil, fillAlpha: 0.55, duration: 300, yoyo: true, hold: 2400, onComplete: () => veil.destroy() });
        for (let k = 0; k < 4; k++) {
          sc.time.delayedCall(300 + k * 700, () => {
            for (const e of sc.activeEnemies()) if (view.contains(e.x, e.y)) {
              this.hit(e, d / 3, 0, 0.3);
              sc.impact(e.x, e.y, 0xa070ff, 0.6);
            }
          });
        }
        return;
      }
    }
  }

  /** Rei Solar: meteoros caem sobre os inimigos da tela toda. */
  private solarRain(view: Phaser.Geom.Rectangle, foes: Enemy[], d: number) {
    const sc = this.sc;
    const radius = 40;
    for (let i = 0; i < 12; i++) {
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
            sc.elements.vfx('vfx_explosion', x, y + radius * 0.4, radius * 2.2, [[0, 0.04], [1, 0.05], [2, 0.1], [3, 0.22]]);
            sfx('boom');
            sc.queryEnemies(x, y, radius + 4, (foe) => {
              if ((foe.x - x) ** 2 + (foe.y - y) ** 2 < radius * radius) this.hit(foe, d, 1, 0.8);
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
