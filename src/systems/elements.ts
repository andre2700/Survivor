import Phaser from 'phaser';
import { frameName } from '../art/textures';
import {
  ORIGINS, PRIMARIES, REACTION_RULES, STATUS, STATUS_RULES, elementMultiplier, reactionFor, statusRoll,
  type Primary, type ReactionDef, type ReactionId,
} from '../data/elements';
import type { Element } from '../data/weapons';
import type { Enemy } from '../entities';
import { LAYER, type GameScene } from '../scenes/GameScene';
import { TITLE_FONT } from '../ui/theme';
import { VIEW } from '../ui/view';
import { sfx } from './sfx';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** Linha quebrada entre dois pontos (raios). */
function zigzag(x0: number, y0: number, x1: number, y1: number) {
  const pts: Phaser.Math.Vector2[] = [];
  const n = 6;
  const nx = -(y1 - y0);
  const ny = x1 - x0;
  const len = Math.hypot(nx, ny) || 1;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const j = i === 0 || i === n ? 0 : (Math.random() * 2 - 1) * 9;
    pts.push(new Phaser.Math.Vector2(x0 + (x1 - x0) * k + (nx / len) * j, y0 + (y1 - y0) * k + (ny / len) * j));
  }
  return pts;
}

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
    this.present(r, x, y);
    switch (r.id) {
      case 'lava':
        this.erupt(x, y, r.radius);
        sc.flames.explode(30, x, y);
        this.area(r, x, y, dmg, (o) => this.apply(o, 'fire', dmg * 0.5, t));
        break;
      case 'ice':
        this.hurt(r, e, dmg);
        if (e.active && !e.boss) {
          e.frozenUntil = t + REACTION_RULES.freeze;
          e.statusEnd = Math.max(e.statusEnd, e.frozenUntil);
          sc.restoreTint(e);
          this.encase(e);
        }
        break;
      case 'lightning':
        this.chain(r, e, dmg);
        break;
      case 'mud':
        this.decal('fx_mud', x, y + 4, (r.radius * 2.2) / 72, REACTION_RULES.mudDuration, false);
        this.area(r, x, y, dmg, (o) => {
          o.mudUntil = t + REACTION_RULES.mudDuration;
          o.statusEnd = Math.max(o.statusEnd, o.mudUntil);
        });
        break;
      case 'steam':
      case 'sand': {
        const pulses = r.id === 'steam' ? REACTION_RULES.steamPulses : REACTION_RULES.sandPulses;
        const seconds = pulses * REACTION_RULES.pulseEvery;
        if (r.id === 'steam') {
          for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2;
            this.decal('fx_steam', x + Math.cos(a) * r.radius * 0.4, y + Math.sin(a) * r.radius * 0.3, (r.radius * 1.3) / 56, seconds, true);
          }
        } else {
          this.decal('fx_sand', x, y + 6, (r.radius * 2.2) / 56, seconds, true, true);
        }
        sc.time.addEvent({ delay: REACTION_RULES.pulseEvery * 1000, repeat: pulses - 1, callback: () => this.area(r, x, y, dmg) });
        this.area(r, x, y, dmg);
        break;
      }
    }
  }

  // ---------- Apresentação das reações: não podem passar despercebidas ----------

  private lastBig = -9;
  /** partículas de efeito que ainda podem sair neste quadro */
  private moteBudget = 8;
  /** apresentações completas (anel, clarão) disponíveis; recarrega com o tempo */
  private showBudget = 6;
  private banners = 0;
  /** último título mostrado de cada reação (um por reação a cada meio segundo) */
  private lastBanner: Partial<Record<ReactionId, number>> = {};
  private ices: { e: Enemy; img: Phaser.GameObjects.Image }[] = [];

  /** Título, onda de choque, clarão e som; tremor e clarão de tela com intervalo mínimo. */
  private present(r: ReactionDef, x: number, y: number) {
    const sc = this.scene;
    const color = hex(r.color);
    // muitas reações de uma vez: só as primeiras ganham anel e clarão (o dano e o título continuam)
    if (this.showBudget < 1) {
      sc.impact(x, y, r.color, 1);
      return;
    }
    this.showBudget--;
    sfx(r.id === 'ice' ? 'freeze' : r.id === 'lava' ? 'boom' : r.id === 'lightning' ? 'zap' : 'reaction');
    // onda de choque colorida
    const ring = sc.add.graphics().setDepth(LAYER.fx + 2).setBlendMode(Phaser.BlendModes.ADD);
    const maxR = Math.max(36, r.radius * 1.5);
    const anim = { k: 0 };
    sc.tweens.add({
      targets: anim, k: 1, duration: 380, ease: 'Cubic.Out',
      onUpdate: () => {
        ring.clear();
        ring.lineStyle(8 * (1 - anim.k) + 1, r.color, 1 - anim.k).strokeEllipse(x, y, maxR * 2 * anim.k, maxR * 1.6 * anim.k);
        ring.lineStyle(2, 0xffffff, (1 - anim.k) * 0.9).strokeEllipse(x, y, maxR * 1.6 * anim.k, maxR * 1.3 * anim.k);
      },
      onComplete: () => ring.destroy(),
    });
    // clarão no ponto
    const flash = sc.add.image(x, y - 6, 'atlas', frameName('glow')).setTint(r.color).setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(LAYER.fx + 3).setScale((maxR * 1.1) / 32).setAlpha(0.8);
    sc.tweens.add({ targets: flash, alpha: 0, scale: (maxR * 1.6) / 32, duration: 260, onComplete: () => flash.destroy() });
    sc.impact(x, y, r.color, Math.max(1.5, r.radius / 25));
    // título grande que salta (limite de títulos simultâneos)
    if (this.banners < 3 && sc.elapsed - (this.lastBanner[r.id] ?? -9) > 0.5) {
      this.banners++;
      this.lastBanner[r.id] = sc.elapsed;
      const title = sc.add.text(x, y - 34, r.name.toUpperCase(), {
        fontFamily: TITLE_FONT, fontSize: '22px', color, stroke: '#14101e', strokeThickness: 6, resolution: VIEW.zoom * 2,
      }).setOrigin(0.5).setDepth(LAYER.text + 1).setScale(0.3);
      sc.tweens.add({ targets: title, scale: 1.15, duration: 160, ease: 'Back.Out' });
      sc.tweens.add({
        targets: title, y: y - 64, alpha: 0, delay: 520, duration: 420, ease: 'Quad.In',
        onComplete: () => {
          title.destroy();
          this.banners--;
        },
      });
    }
    // tremor e clarão de tela: no máximo a cada 0,35 s
    if (sc.elapsed - this.lastBig > 0.35) {
      this.lastBig = sc.elapsed;
      sc.cameras.main.shake(140, 0.005);
      sc.screenTint(r.color);
    }
  }

  /** Lava: erupção que sobe e afunda. */
  private erupt(x: number, y: number, radius: number) {
    const img = this.scene.add.image(x, y + 8, 'atlas', frameName('fx_lava')).setOrigin(0.5, 0.95).setDepth(y + 8).setScale(0.2, 0);
    const s = (radius * 1.6) / 56;
    this.scene.tweens.add({ targets: img, scaleX: s, scaleY: s, duration: 140, ease: 'Back.Out' });
    this.scene.tweens.add({ targets: img, scaleY: 0, alpha: 0, delay: 520, duration: 320, ease: 'Quad.In', onComplete: () => img.destroy() });
  }

  /** Gelo: o inimigo fica preso num bloco de gelo que estilhaça ao soltar. */
  private encase(e: Enemy) {
    const img = this.scene.add.image(e.x, e.y + 4, 'atlas', frameName('fx_ice')).setOrigin(0.5, 0.85).setDepth(e.y + 1).setAlpha(0.85);
    const s = Math.max(0.6, (e.displayWidth * 1.2) / 58);
    img.setScale(s * 1.4).setAlpha(0);
    this.scene.tweens.add({ targets: img, scale: s, alpha: 0.85, duration: 120 });
    this.ices.push({ e, img });
  }

  /** Mancha, nuvem ou redemoinho que aparece e some com o tempo. */
  private decal(key: string, x: number, y: number, scale: number, seconds: number, rise: boolean, spin = false) {
    const img = this.scene.add.image(x, y, 'atlas', frameName(key)).setOrigin(0.5, rise ? 0.9 : 0.5)
      .setDepth(rise ? y : LAYER.groundFx).setScale(scale * 0.3).setAlpha(0);
    this.scene.tweens.add({ targets: img, scale, alpha: rise ? 0.95 : 0.9, duration: 180, ease: 'Back.Out' });
    if (spin) this.scene.tweens.add({ targets: img, scaleX: -scale, duration: 220, yoyo: true, repeat: Math.ceil(seconds / 0.44) });
    if (rise) this.scene.tweens.add({ targets: img, y: y - 6, duration: seconds * 1000 });
    this.scene.tweens.add({ targets: img, alpha: 0, delay: seconds * 1000 - 300, duration: 300, onComplete: () => img.destroy() });
  }

  /** Por quadro: blocos de gelo acompanham e estilhaçam quando o congelamento acaba. */
  tick() {
    const t = this.scene.elapsed;
    this.moteBudget = 8;
    this.showBudget = Math.min(6, this.showBudget + 0.25);
    this.ices = this.ices.filter(({ e, img }) => {
      if (e.active && t < e.frozenUntil) {
        img.setPosition(e.x, e.y + 4);
        return true;
      }
      // estilhaça
      this.scene.sparks.setParticleTint(0xbfefff).explode(10, img.x, img.y - 10);
      this.scene.sparks.setParticleTint(0xffffff);
      this.scene.tweens.add({ targets: img, scale: img.scale * 1.3, alpha: 0, duration: 160, onComplete: () => img.destroy() });
      return false;
    });
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
      const pts = zigzag(px, py, n.x, n.y - 6);
      g.lineStyle(10, r.color, 0.25).strokePoints(pts);
      g.lineStyle(4, r.color, 0.9).strokePoints(pts);
      g.lineStyle(1.5, 0xffffff, 1).strokePoints(pts);
      this.scene.impact(n.x, n.y, r.color, 1);
      px = n.x;
      py = n.y - 6;
      this.hurt(r, n, dmg);
      cur = n;
    }
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
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
    // uma partícula de vez em quando, na cor do efeito (orçamento por quadro: tela cheia não pesa)
    if (this.moteBudget <= 0 || Math.random() > dt * 5) return;
    this.moteBudget--;
    for (const p of PRIMARIES) {
      if (t >= e.status[p]) continue;
      if (p === 'fire') this.scene.emitFlame(e.x + (Math.random() - 0.5) * 10, e.y - 6);
      else this.motes.setParticleTint(STATUS[p].color).emitParticleAt(e.x + (Math.random() - 0.5) * 12, e.y - 8, 1);
      break;
    }
  }
}
