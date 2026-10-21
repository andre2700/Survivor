// Equipamento visível no herói. O herói "sem equipamento" (mãos vazias, sem capa) é a arte base, e o
// jogo desenha por cima: a arma na mão da frente, a mão secundária (escudo, tomo) na mão de trás e a
// capa nas costas. Cada quadro do herói tem os pontos da mão, da outra mão e das costas (marcados à mão
// sobre a arte processada), então um item novo nunca precisa de imagem do herói com ele.
// A arma e o escudo usam o próprio ícone do item; a capa é desenhada por código e ondula com o movimento.
import Phaser from 'phaser';
import { RARITIES, baseOf } from '../data/items';
import type { CharacterDef } from '../data/characters';
import { findItem } from '../systems/inventory';
import type { SaveData } from '../systems/save';
import { frameHd, frameName } from './textures';

/** Ponto num quadro, em pixels da textura: mão [x, y, ângulo da arma em graus, 0 = para a frente], outra mão, costas. */
interface Anchor {
  hand?: [number, number, number];
  off?: [number, number];
  back?: [number, number];
}

interface RigDef {
  /** arte base sem equipamento (quadros do modelo de herói e portrait_<texture>) */
  texture: string;
  frames: Record<string, Anchor>;
  portrait: Anchor;
  /** aparência sem nada equipado (igual à arte original do herói) */
  look: HeroLook;
}

export const RIGS: Record<string, RigDef> = {
  knight: {
    texture: 'hero_knight_bare',
    frames: {
      idle: { hand: [135, 76, -55], off: [77, 95], back: [80, 57] },
      walk_a: { hand: [133, 65, -45], off: [59, 80], back: [79, 55] },
      walk_mid: { hand: [134, 58, -60], off: [64, 83], back: [82, 57] },
      walk_b: { hand: [131, 62, -50], off: [65, 80], back: [85, 57] },
      attack: { hand: [143, 75, -8], off: [127, 60], back: [78, 58] },
      hurt: { hand: [128, 80, -30], off: [79, 80], back: [76, 60] },
      victory: { hand: [133, 28, -90], off: [66, 32], back: [88, 50] },
      death: {},
    },
    portrait: { hand: [260, 202, -50], off: [217, 157], back: [70, 165] },
    look: { weapon: 'icon_sword', offhand: 'icon_shield', cape: 0x3a6fd8 },
  },
};

/** Como segurar cada ícone: ponto do cabo (0–1 na imagem), direção da lâmina no ícone (graus) e tamanho lógico. */
const GRIPS: Record<string, { u: number; v: number; axis: number; size: number }> = {
  icon_sword: { u: 0.2, v: 0.82, axis: -45, size: 21 },
  item_blade: { u: 0.2, v: 0.8, axis: -45, size: 21 },
  item_warhammer: { u: 0.18, v: 0.82, axis: -43, size: 21 },
  icon_hammer: { u: 0.18, v: 0.82, axis: -45, size: 21 },
  item_staff: { u: 0.66, v: 0.75, axis: -124, size: 26 },
  item_dagger: { u: 0.8, v: 0.25, axis: 137, size: 15 },
  icon_greataxe: { u: 0.85, v: 0.5, axis: 180, size: 26 },
};
const OFFHAND_SIZE: Record<string, number> = { icon_shield: 15, item_shield: 15, item_tome: 12 };

export interface HeroLook {
  weapon?: string;
  offhand?: string;
  cape?: number;
  /** brilho no chão pela melhor raridade equipada (épico ou mais) */
  glow?: number;
}

export const rigOf = (c: CharacterDef) => (c.rig ? RIGS[c.rig] : undefined);

/** Aparência do herói: o padrão dele, trocado pelo que estiver equipado. */
export function heroLook(save: SaveData, c: CharacterDef): HeroLook {
  const rig = rigOf(c);
  const look: HeroLook = { ...(rig?.look ?? {}) };
  const get = (slot: keyof SaveData['equipped']) => {
    const uid = save.equipped[slot];
    return uid === undefined ? undefined : findItem(save, uid);
  };
  const w = get('weapon');
  if (w) look.weapon = baseOf(w.base).icon;
  const o = get('offhand');
  if (o) look.offhand = baseOf(o.base).icon;
  const cape = get('cape');
  if (cape) look.cape = RARITIES[cape.rarity].color;
  let best = -1;
  for (const s of Object.keys(save.equipped) as (keyof SaveData['equipped'])[]) best = Math.max(best, get(s)?.rarity ?? -1);
  if (best >= 3) look.glow = RARITIES[best].color;
  return look;
}

const OUTLINE = 0x2a1630;

const shade = (c: number, k: number) => {
  const r = ((c >> 16) & 255) * k;
  const g = ((c >> 8) & 255) * k;
  const b = (c & 255) * k;
  return (Math.min(255, r) << 16) | (Math.min(255, g) << 8) | Math.min(255, b);
};

/** Peças do equipamento que acompanham uma imagem do herói (na partida ou num retrato). */
export class HeroRig {
  private weapon?: Phaser.GameObjects.Image;
  private offhand?: Phaser.GameObjects.Image;
  private cape?: Phaser.GameObjects.Graphics;
  private glow?: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, private def: RigDef, private look: HeroLook, private portrait = false) {
    const img = (key: string) => (portrait ? scene.add.image(0, 0, key) : scene.add.image(0, 0, 'atlas', frameName(key)));
    if (look.glow !== undefined) this.glow = img('aura').setTint(look.glow).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55);
    if (look.cape !== undefined) this.cape = scene.add.graphics();
    if (look.offhand) this.offhand = img(look.offhand);
    if (look.weapon) {
      const g = GRIPS[look.weapon] ?? { u: 0.5, v: 0.5, axis: -45, size: 20 };
      this.weapon = img(look.weapon).setOrigin(g.u, g.v);
    }
  }

  /**
   * Põe as peças sobre o herói `body` (mesma posição, escala, espelho e inclinação). `slot` é o quadro
   * atual (idle, walk_a...); `t` o tempo, `motion` de 0 (parado) a 1 (correndo) para a capa.
   */
  sync(body: Phaser.GameObjects.Image, slot: string, t: number, motion: number) {
    const a = this.portrait ? this.def.portrait : this.def.frames[slot] ?? this.def.frames.idle;
    const hd = frameHd(body);
    const fw = body.frame.realWidth;
    const fh = body.frame.realHeight;
    const flip = body.flipX;
    const f = flip ? -1 : 1;
    const r = body.rotation;
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    const unit = Math.abs(body.scaleY); // tamanho lógico → mundo
    const at = (px: number, py: number) => {
      const lx = ((px - body.originX * fw) / hd) * body.scaleX * f;
      const ly = ((py - body.originY * fh) / hd) * body.scaleY;
      return { x: body.x + lx * cos - ly * sin, y: body.y + lx * sin + ly * cos };
    };
    const depth = body.depth;
    const alpha = body.alpha;
    const visible = body.visible;

    if (this.weapon) {
      const w = this.weapon;
      if (a.hand && visible) {
        const g = GRIPS[this.look.weapon!] ?? { axis: -45, size: 20 };
        const p = at(a.hand[0], a.hand[1]);
        const deg = flip ? g.axis - a.hand[2] : a.hand[2] - g.axis;
        // atrás do corpo: o punho fecha por cima do cabo
        w.setVisible(true).setPosition(p.x, p.y).setFlipX(flip).setRotation(Phaser.Math.DegToRad(deg) + r)
          .setScale((g.size * unit * frameHd(w)) / w.frame.realWidth).setDepth(depth - 0.002).setAlpha(alpha);
      } else w.setVisible(false);
    }
    if (this.offhand) {
      const o = this.offhand;
      if (a.off && visible) {
        const p = at(a.off[0], a.off[1]);
        const size = OFFHAND_SIZE[this.look.offhand!] ?? 13;
        o.setVisible(true).setPosition(p.x, p.y).setFlipX(flip).setRotation(r)
          .setScale((size * unit * frameHd(o)) / o.frame.realWidth).setDepth(depth - 0.004).setAlpha(alpha);
      } else o.setVisible(false);
    }
    if (this.cape) {
      const c = this.cape.clear();
      if (a.back && visible) {
        const p = at(a.back[0], a.back[1]);
        c.setDepth(depth - 0.006).setAlpha(alpha);
        this.drawCape(c, p.x, p.y, f, unit, t, motion);
      }
    }
    if (this.glow) {
      const feet = at(fw / 2, fh * 0.93);
      this.glow.setVisible(visible).setPosition(feet.x, feet.y).setScale(0.34 * unit, 0.13 * unit).setDepth(depth - 0.01)
        .setAlpha((0.3 + 0.12 * Math.sin(t * 3)) * alpha);
    }
  }

  /** Capa presa nos ombros: voa para trás com a corrida e ondula. */
  private drawCape(g: Phaser.GameObjects.Graphics, sx: number, sy: number, f: number, unit: number, t: number, motion: number) {
    const color = this.look.cape!;
    const L = 21;
    const fly = 0.25 + 0.75 * motion;
    const n = 7;
    const front: { x: number; y: number }[] = [];
    const backE: { x: number; y: number }[] = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const wave = Math.sin(k * 3.2 - t * (4 + 6 * motion)) * (0.8 + 1.6 * fly) * k;
      const lift = 1 - fly * 0.35 * k;
      front.push({ x: 2 - (1 + fly * 7) * Math.pow(k, 1.2) + wave * 0.7, y: (L - 2) * k * lift });
      backE.push({ x: -4 - (4 + fly * 12) * Math.pow(k, 1.2) + wave, y: 1 + (L - 1) * k * lift });
    }
    const pt = (q: { x: number; y: number }) => new Phaser.Math.Vector2(sx + q.x * f * unit, sy + q.y * unit);
    const outline = [...front.map(pt), ...[...backE].reverse().map(pt)];
    g.fillStyle(color, 1).fillPoints(outline, true);
    // dobra mais escura junto à borda de trás
    const fold = [...backE.map(pt), ...[...backE].reverse().map((q, i) => pt({ x: q.x + 2.4 + 0.5 * Math.sin(i + t * 4), y: q.y }))];
    g.fillStyle(shade(color, 0.7), 1).fillPoints(fold, true);
    // barra clara
    g.lineStyle(1.2 * unit, shade(color, 1.35), 0.9).strokePoints([pt(front[n]), pt(backE[n])]);
    g.lineStyle(0.9 * unit, OUTLINE, 1).strokePoints(outline, true, true);
  }

  destroy() {
    this.weapon?.destroy();
    this.offhand?.destroy();
    this.cape?.destroy();
    this.glow?.destroy();
  }
}

/** Herói num retrato (menu, equipamento): imagem portrait_<texture> com o equipamento e a capa ondulando. */
export class HeroPortrait {
  readonly body: Phaser.GameObjects.Image;
  private parts?: HeroRig;

  constructor(private scene: Phaser.Scene, x: number, y: number, originY = 0.97) {
    this.body = scene.add.image(x, y, '__DEFAULT').setOrigin(0.5, originY).setDepth(5);
    const tick = () => this.parts?.sync(this.body, 'idle', scene.time.now / 1000, 0);
    scene.events.on('update', tick);
    scene.events.once('shutdown', () => {
      scene.events.off('update', tick);
      this.parts?.destroy();
    });
  }

  /** Mostra o herói `c`; sem `look`, a arte original (sem o equipamento desenhado por cima). */
  show(c: CharacterDef, look?: HeroLook) {
    const rig = look ? rigOf(c) : undefined;
    this.parts?.destroy();
    this.parts = undefined;
    this.body.setTexture(`portrait_${rig ? rig.texture : c.texture}`);
    if (rig) {
      this.parts = new HeroRig(this.scene, rig, look!, true);
      this.parts.sync(this.body, 'idle', this.scene.time.now / 1000, 0);
    }
    return this;
  }
}
