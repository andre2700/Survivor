import Phaser from 'phaser';
import { frameName } from '../art/textures';
import {
  ORIGINS, PRIMARIES, REACTION_RULES, STATUS, STATUS_RULES, elementMultiplier, reactionFor, statusRoll,
  type Primary, type ReactionDef, type ReactionId,
} from '../data/elements';
import type { Element } from '../data/weapons';
import type { Enemy } from '../entities';
import { LAYER, type GameScene } from '../scenes/GameScene';
import { sfx } from './sfx';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** Efeitos elementais nos inimigos e as reações entre eles (dados em data/elements.ts). */
export class ElementSystem {
  /** dano total por reação na partida (estatísticas) */
  readonly dealt: Partial<Record<ReactionId, number>> = {};
  private motes: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(private scene: GameScene) {
    this.motes = scene.add.particles(0, 0, 'atlas', {
      frame: frameName('glow'),
      speedY: { min: -30, max: -10 },
      speedX: { min: -8, max: 8 },
      lifespan: 500,
      scale: { start: 0.22, end: 0 },
      alpha: { start: 0.9, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    }).setDepth(LAYER.fx);
  }

  /** Multiplicador de dano: vantagem elemental e Fraturado. */
  damageMultiplier(e: Enemy, element: Element, t: number) {
    return elementMultiplier(element, e.def.element) * (t < e.status.earth ? 1 + STATUS_RULES.fracturedTaken : 1);
  }

  /** Chance crítica extra contra inimigos Desequilibrados. */
  critBonus(e: Enemy, t: number) {
    return t < e.status.air ? STATUS_RULES.unbalancedCrit : 0;
  }

  /** Fração da velocidade que o inimigo mantém (Encharcado, Lama, Gelo). */
  speedFactor(e: Enemy, t: number) {
    if (t >= e.statusEnd) return 1;
    if (t < e.frozenUntil) return 0;
    return (t < e.status.water ? 1 - STATUS_RULES.soakSlow : 1) * (t < e.mudUntil ? 1 - REACTION_RULES.mudSlow : 1);
  }

  /** Depois de um golpe: chance de aplicar o efeito de cada origem do elemento e, com dois ativos, reagir. */
  onHit(e: Enemy, element: Element, dmg: number, effect: number) {
    const origins = ORIGINS[element];
    if (origins.length === 0 || !e.active) return;
    const s = this.scene.stats;
    const t = this.scene.elapsed;
    let applied = false;
    let potency = 1;
    for (const o of origins) {
      const roll = statusRoll(effect, s.elementalPower, s.luck);
      if (!roll.applied) continue;
      potency = Math.max(potency, roll.potency);
      applied = this.apply(e, o, dmg * roll.potency, t) || applied;
    }
    if (applied) this.react(e, dmg * potency, t);
  }

  /** Aplica (ou renova) um efeito. Inimigos não sofrem o efeito do próprio elemento. */
  apply(e: Enemy, p: Primary, dmg: number, t: number): boolean {
    if (e.def.element && ORIGINS[e.def.element].includes(p)) return false;
    if (p === 'fire') {
      // renovar mantém a queimadura mais forte
      const burning = t < e.status.fire;
      e.burnDps = Math.max(burning ? e.burnDps : 0, dmg * STATUS_RULES.burnDps);
      if (!burning) e.burnTickAt = t + STATUS_RULES.burnTick;
    }
    const until = t + STATUS[p].duration;
    e.status[p] = until;
    e.statusEnd = Math.max(e.statusEnd, until);
    if (p === 'air' && !e.boss) {
      // empurrão para longe do herói
      const dx = e.x - this.scene.player.x;
      const dy = e.y - this.scene.player.y;
      const d = Math.hypot(dx, dy) || 1;
      e.kbX += (dx / d) * 90 * STATUS_RULES.unbalancedKnock * e.def.knockback;
      e.kbY += (dy / d) * 90 * STATUS_RULES.unbalancedKnock * e.def.knockback;
    }
    return true;
  }

  /** Dois efeitos ativos se consomem e disparam a reação do par. */
  private react(e: Enemy, dmg: number, t: number) {
    const active = PRIMARIES.filter((p) => t < e.status[p]);
    if (active.length < 2) return;
    const r = reactionFor(active[0], active[1]);
    if (!r) return;
    e.status[active[0]] = e.status[active[1]] = 0;
    if (active[0] === 'fire' || active[1] === 'fire') e.burnDps = 0;
    this.trigger(r, e, dmg * r.damage);
  }

  private trigger(r: ReactionDef, e: Enemy, dmg: number) {
    const { x, y } = e;
    const sc = this.scene;
    const t = sc.elapsed;
    sc.floatText(x, y - 26, r.name, hex(r.color), true);
    sc.impact(x, y, r.color, r.radius ? r.radius / 30 : 1.2);
    sfx('zap');
    switch (r.id) {
      case 'lava':
        sc.flames.explode(24, x, y);
        this.area(r, x, y, dmg, (o) => this.apply(o, 'fire', dmg * 0.5, t));
        break;
      case 'ice':
        this.hurt(r, e, dmg);
        if (e.active && !e.boss) {
          e.frozenUntil = t + REACTION_RULES.freeze;
          e.statusEnd = Math.max(e.statusEnd, e.frozenUntil);
          sc.restoreTint(e);
        }
        break;
      case 'lightning':
        this.chain(r, e, dmg);
        break;
      case 'mud':
        this.cloud(r, x, y, REACTION_RULES.mudDuration);
        this.area(r, x, y, dmg, (o) => {
          o.mudUntil = t + REACTION_RULES.mudDuration;
          o.statusEnd = Math.max(o.statusEnd, o.mudUntil);
        });
        break;
      case 'steam':
      case 'sand': {
        const pulses = r.id === 'steam' ? REACTION_RULES.steamPulses : REACTION_RULES.sandPulses;
        this.cloud(r, x, y, pulses * REACTION_RULES.pulseEvery);
        sc.time.addEvent({ delay: REACTION_RULES.pulseEvery * 1000, repeat: pulses - 1, callback: () => this.area(r, x, y, dmg) });
        this.area(r, x, y, dmg);
        break;
      }
    }
  }

  private hurt(r: ReactionDef, e: Enemy, dmg: number) {
    this.dealt[r.id] = (this.dealt[r.id] ?? 0) + this.scene.elementalDamage(e, dmg, hex(r.color));
  }

  private area(r: ReactionDef, x: number, y: number, dmg: number, extra?: (e: Enemy) => void) {
    this.scene.queryEnemies(x, y, r.radius + 16, (o) => {
      const rr = r.radius + o.radius;
      if ((o.x - x) ** 2 + (o.y - y) ** 2 >= rr * rr) return;
      this.hurt(r, o, dmg);
      if (o.active && extra) extra(o);
    });
  }

  /** Raio: salta do alvo para os inimigos mais próximos ainda não atingidos. */
  private chain(r: ReactionDef, first: Enemy, dmg: number) {
    const g = this.scene.add.graphics().setDepth(LAYER.fx + 1).setBlendMode(Phaser.BlendModes.ADD);
    const hit = new Set<number>([first.uid]);
    let cur = first;
    let px = first.x;
    let py = first.y - 6;
    this.hurt(r, first, dmg);
    for (let i = 0; i < REACTION_RULES.chainJumps; i++) {
      let next: Enemy | null = null;
      let best = r.radius * r.radius;
      this.scene.queryEnemies(cur.x, cur.y, r.radius, (o) => {
        if (hit.has(o.uid) || !o.active) return;
        const d = (o.x - cur.x) ** 2 + (o.y - cur.y) ** 2;
        if (d < best) {
          best = d;
          next = o;
        }
      });
      if (!next) break;
      const n: Enemy = next;
      hit.add(n.uid);
      g.lineStyle(4, r.color, 0.35).lineBetween(px, py, n.x, n.y - 6);
      g.lineStyle(1.5, 0xffffff, 1).lineBetween(px, py, n.x, n.y - 6);
      px = n.x;
      py = n.y - 6;
      this.hurt(r, n, dmg);
      cur = n;
    }
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
  }

  /** Mancha no chão que some com o tempo (lama, vapor, areia). */
  private cloud(r: ReactionDef, x: number, y: number, seconds: number) {
    const img = this.scene.add.image(x, y, 'atlas', frameName('glow')).setTint(r.color).setDepth(LAYER.groundFx)
      .setScale((r.radius * 2.4) / 32, (r.radius * 1.9) / 32).setAlpha(0.75);
    if (r.id !== 'mud') img.setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: img, alpha: 0, angle: r.id === 'sand' ? 180 : 0, duration: seconds * 1000, ease: 'Quad.In', onComplete: () => img.destroy() });
  }

  /** Por quadro, para inimigos com efeito: queimadura, fim do congelamento e partículas. */
  update(e: Enemy, t: number, dt: number) {
    if (t >= e.statusEnd && e.frozenUntil === 0) return;
    if (e.frozenUntil && t >= e.frozenUntil) {
      e.frozenUntil = 0;
      this.scene.restoreTint(e);
    }
    if (t < e.status.fire && t >= e.burnTickAt) {
      e.burnTickAt = t + STATUS_RULES.burnTick;
      this.scene.elementalDamage(e, e.burnDps * STATUS_RULES.burnTick, hex(STATUS.fire.color));
      if (!e.active) return;
    }
    // uma partícula de vez em quando, na cor do efeito
    if (Math.random() > dt * 5) return;
    for (const p of PRIMARIES) {
      if (t >= e.status[p]) continue;
      if (p === 'fire') this.scene.emitFlame(e.x + (Math.random() - 0.5) * 10, e.y - 6);
      else this.motes.setParticleTint(STATUS[p].color).emitParticleAt(e.x + (Math.random() - 0.5) * 12, e.y - 8, 1);
      break;
    }
  }
}
