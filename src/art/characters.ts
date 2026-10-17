// Heróis 32×32 montados em camadas (corpo → botas → armadura → capa → cabeça → elmo → arma).
// Cada camada é desenhada por código; trocar uma peça muda o visual (base do equipamento visível).

import { PixelBuffer, R, type Ramp } from './pixel';

export type HelmetStyle = 'knight' | 'wizard' | 'hood' | 'horned' | 'none';
export type BodyStyle = 'armor' | 'robe' | 'tunic' | 'bare';
export type WeaponStyle = 'sword' | 'staff' | 'dagger' | 'axe' | 'none';

export interface HeroLook {
  skin: Ramp;
  hair?: Ramp;
  beard?: boolean;
  body: { style: BodyStyle; ramp: Ramp; trim?: Ramp };
  legs: Ramp;
  boots: Ramp;
  belt?: Ramp;
  cape?: Ramp;
  helmet: { style: HelmetStyle; ramp: Ramp; accent?: Ramp };
  weapon: WeaponStyle;
  shield?: Ramp;
}

export const HERO_LOOKS: Record<string, HeroLook> = {
  hero_knight: {
    skin: R.skin, body: { style: 'armor', ramp: R.steel, trim: R.blue }, legs: R.steel, boots: R.steel, belt: R.leather,
    cape: R.blue, helmet: { style: 'knight', ramp: R.steel, accent: R.red }, weapon: 'sword', shield: R.blue,
  },
  hero_mage: {
    skin: R.skin, hair: R.hairBlond, body: { style: 'robe', ramp: R.purple, trim: R.gold }, legs: R.purple, boots: R.leather,
    belt: R.gold, helmet: { style: 'wizard', ramp: R.purple, accent: R.gold }, weapon: 'staff',
  },
  hero_ranger: {
    skin: R.skin, body: { style: 'tunic', ramp: R.green, trim: R.leather }, legs: R.leather, boots: R.leather, belt: R.leather,
    cape: R.green, helmet: { style: 'hood', ramp: R.green }, weapon: 'dagger',
  },
  hero_barbarian: {
    skin: R.skin, hair: R.hairRed, beard: true, body: { style: 'bare', ramp: R.skin, trim: R.fur }, legs: R.leather, boots: R.fur,
    belt: R.leather, helmet: { style: 'horned', ramp: R.steel, accent: R.bone }, weapon: 'axe',
  },
};

const EYE = '#1a1020';
const W = 32;
/** Altura do quadro: 8px extras no topo para chapéus, plumas e chifres. */
export const HERO_H = 40;
const OY = 8;

interface Pose {
  bob: number; // corpo sobe (-) ao andar
  front: number; // deslocamento da perna da frente
  back: number;
  arm: number; // balanço do braço
}

/** 4 quadros de caminhada. */
const WALK: Pose[] = [
  { bob: 0, front: 1, back: -1, arm: 0 },
  { bob: -1, front: 3, back: -2, arm: -1 },
  { bob: 0, front: -1, back: 1, arm: 0 },
  { bob: -1, front: -2, back: 3, arm: 1 },
];

function leg(b: PixelBuffer, x: number, look: HeroLook, lift: number) {
  const top = 23 + OY;
  const bottom = 30 + OY - lift;
  b.shadedRect(x, top, 3, bottom - top - 2, look.legs);
  // bota com bico para frente
  b.shadedRect(x, bottom - 2, 3, 3, look.boots);
  b.set(x + 3, bottom, look.boots[1]);
}

function cape(b: PixelBuffer, ramp: Ramp, pose: Pose, f: number) {
  const wave = [0, 1, 0, -1][f];
  const y = 15 + OY + pose.bob;
  b.poly([[11, y], [14, y], [13, 29 + OY], [7 + wave, 29 + OY], [8 + wave, 22 + OY]], [ramp[0], ramp[1], ramp[2]]);
}

function torso(b: PixelBuffer, look: HeroLook, y0: number) {
  const { style, ramp, trim } = look.body;
  if (style === 'robe') {
    b.poly([[11, y0], [21, y0], [23, 29 + OY], [9, 29 + OY]], ramp.slice(1));
    b.shadedRect(11, y0, 10, 7, ramp);
    if (trim) {
      b.line(9, 29 + OY, 23, 29 + OY, trim[2]);
      b.line(16, y0 + 1, 16, 28 + OY, trim[3]);
    }
  } else if (style === 'bare') {
    b.shadedRect(11, y0, 10, 8, look.skin);
    // músculos e pelagem nos ombros
    b.set(15, y0 + 3, look.skin[1]);
    b.set(17, y0 + 3, look.skin[1]);
    b.line(13, y0 + 5, 19, y0 + 5, look.skin[2]);
    if (trim) b.sphere(12, y0 + 1, 3, 2.5, trim);
  } else {
    b.shadedRect(11, y0, 10, 8, ramp);
    if (style === 'armor') {
      // peitoral com placa clara e tabardo
      b.line(12, y0 + 1, 19, y0 + 1, ramp[4] ?? ramp[3]);
      if (trim) {
        b.shadedRect(14, y0 + 2, 4, 7, trim);
        b.set(15, y0 + 4, '#ffe9a8');
        b.set(16, y0 + 4, '#ffe9a8');
      }
      b.sphere(12, y0 + 1, 2.5, 2, ramp, 0.15);
      b.sphere(20, y0 + 1, 2.5, 2, ramp, 0.15);
    } else if (trim) {
      b.line(11, y0 + 7, 21, y0 + 7, trim[2]);
    }
  }
  if (look.belt) {
    b.line(11, y0 + 6, 21, y0 + 6, look.belt[1]);
    b.set(17, y0 + 6, R.gold[3]);
  }
}

function head(b: PixelBuffer, look: HeroLook, y: number) {
  b.sphere(16, y, 6.2, 5.8, look.skin, 0.05);
  // olhos (vista 3/4 para a direita)
  b.rect(19, y - 1, 1, 2, EYE);
  b.rect(16, y - 1, 1, 2, EYE);
  b.set(19, y - 1, '#f4f0ff');
  b.set(20, y + 2, look.skin[1]);
  if (look.hair) {
    // franja e cabelo atrás
    b.sphere(14, y - 3, 6, 3.5, look.hair);
    b.poly([[9, y - 2], [12, y - 3], [12, y + 4], [10, y + 5]], look.hair.slice(1));
  }
  if (look.beard && look.hair) {
    b.poly([[13, y + 2], [22, y + 1], [21, y + 6], [16, y + 8], [13, y + 5]], look.hair.slice(1));
    b.rect(18, y + 2, 3, 1, look.skin[1]);
  }
}

function helmet(b: PixelBuffer, look: HeroLook, y: number) {
  const { style, ramp, accent } = look.helmet;
  if (style === 'knight') {
    if (accent) b.poly([[12, y - 5], [15, y - 10], [20, y - 11], [17, y - 6]], accent);
    b.sphere(16, y - 1, 6.6, 6.2, ramp, 0.1);
    b.shadedRect(10, y + 3, 12, 2, ramp);
    // abertura do visor mostrando os olhos
    b.rect(16, y - 1, 6, 3, '#14141e');
    b.set(19, y, '#d8e0ff');
    b.set(17, y, '#8890b0');
    b.line(13, y - 5, 13, y + 4, ramp[4] ?? ramp[3]);
  } else if (style === 'wizard') {
    b.poly([[8, y - 3], [25, y - 3], [24, y - 1], [9, y - 1]], ramp);
    b.poly([[11, y - 3], [21, y - 3], [14, y - 14], [8, y - 13]], ramp);
    if (accent) {
      b.line(11, y - 4, 21, y - 4, accent[2]);
      b.set(14, y - 8, accent[4] ?? accent[3]);
      b.set(17, y - 6, accent[3]);
    }
  } else if (style === 'hood') {
    b.sphere(15, y - 1, 7, 6.8, ramp, -0.05);
    b.poly([[9, y], [12, y + 4], [8, y + 7], [6, y + 4]], ramp.slice(0, 3));
    // rosto visível na abertura do capuz
    b.sphere(18, y + 1, 3.6, 3.8, look.skin, 0.1);
    b.rect(19, y, 1, 2, EYE);
    b.set(19, y, '#f4f0ff');
  } else if (style === 'horned') {
    b.sphere(16, y - 4, 6.6, 3.6, ramp, 0.1);
    b.line(10, y - 2, 22, y - 2, ramp[1]);
    if (accent) {
      b.poly([[9, y - 2], [13, y - 3], [10, y - 9], [7, y - 11], [7, y - 6]], accent);
      b.poly([[19, y - 3], [23, y - 2], [25, y - 6], [25, y - 11], [22, y - 9]], accent);
    }
  }
}

function weapon(b: PixelBuffer, look: HeroLook, hx: number, hy: number) {
  switch (look.weapon) {
    case 'sword':
      b.line(hx + 1, hy - 1, hx + 8, hy - 10, R.steel[3], 2);
      b.line(hx + 2, hy - 2, hx + 8, hy - 9, R.steel[4]);
      b.line(hx - 1, hy - 2, hx + 3, hy + 2, R.gold[2]);
      b.set(hx, hy + 1, R.leather[2]);
      break;
    case 'staff':
      b.line(hx + 1, hy + 7, hx + 1, hy - 14, R.wood[2], 2);
      b.line(hx + 1, hy + 7, hx + 1, hy - 14, R.wood[3]);
      b.sphere(hx + 1.5, hy - 15, 2.6, 2.6, R.arcane, 0.2);
      break;
    case 'dagger':
      b.line(hx + 1, hy - 1, hx + 5, hy - 5, R.steel[4], 1);
      b.line(hx + 1, hy, hx + 5, hy - 4, R.steel[2]);
      b.set(hx, hy + 1, R.leather[2]);
      break;
    case 'axe':
      b.line(hx, hy + 3, hx + 5, hy - 10, R.wood[2], 2);
      // lâmina em meia-lua
      b.poly([[hx + 4, hy - 9], [hx + 8, hy - 14], [hx + 11, hy - 12], [hx + 12, hy - 7], [hx + 10, hy - 3], [hx + 6, hy - 5]], R.steel);
      b.line(hx + 11, hy - 12, hx + 12, hy - 7, R.steel[4]);
      b.line(hx + 12, hy - 7, hx + 10, hy - 3, R.steel[4]);
      break;
    default:
      break;
  }
}

/** Desenha um quadro do herói. */
export function drawHero(look: HeroLook, f: number): PixelBuffer {
  const b = new PixelBuffer(W, HERO_H);
  const pose = WALK[f % WALK.length];
  const y0 = 15 + OY + pose.bob;
  const headY = 9 + OY + pose.bob;

  if (look.cape) cape(b, look.cape, pose, f);
  // braço de trás
  b.shadedRect(9, y0 + 1, 2, 6 - pose.arm, look.body.style === 'bare' ? look.skin : look.body.ramp.slice(0, 3));
  leg(b, 13 + pose.back, look, pose.back > 1 ? 1 : 0);
  leg(b, 16 + pose.front, look, pose.front > 1 ? 1 : 0);
  torso(b, look, y0);
  if (look.shield) {
    b.sphere(12, y0 + 4, 3.6, 4.6, R.steel, 0.1);
    b.sphere(12, y0 + 4, 2.4, 3.4, look.shield);
    b.set(12, y0 + 3, R.gold[3]);
  }
  head(b, look, headY);
  helmet(b, look, headY);
  // braço da frente e mão
  const hx = 20;
  const hy = y0 + 6 + pose.arm;
  b.shadedRect(20, y0 + 1, 2, 5 + pose.arm, look.body.style === 'bare' ? look.skin : look.body.ramp);
  weapon(b, look, hx, hy);
  b.sphere(hx + 0.5, hy + 0.5, 1.5, 1.5, look.skin);
  b.outline();
  return b.shadowUnder(16, 38.5, 8.5, 2.2, 100);
}

export function heroFrames(key: string): PixelBuffer[] {
  const look = HERO_LOOKS[key];
  return [0, 1, 2, 3].map((f) => drawHero(look, f));
}
