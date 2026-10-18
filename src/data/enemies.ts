import type { Element } from './weapons';

export type EnemyId = 'slime' | 'bat' | 'goblin' | 'wolf' | 'skeleton' | 'orc' | 'demon'
  | 'slime_fire' | 'slime_water' | 'goblin_earth' | 'bat_air';

export interface EnemyDef {
  id: EnemyId;
  /** criatura base (animação e comportamento): variantes elementais usam a da original */
  kind: string;
  name: string;
  texture: string;
  /** elemento do inimigo: resiste ao próprio elemento e não sofre o efeito dele (ver data/elements.ts) */
  element?: Element;
  hp: number;
  speed: number;
  damage: number;
  xp: number;
  scale: number;
  /** raio do corpo (px, antes da escala) */
  radius: number;
  /** peso: quanto um empurrão o move (0 = não se move, 1 = normal) */
  knockback: number;
  /** Resistência a controle (0 a 1): empurrão, congelamento, lentidão, puxão. Ver controlRoll. */
  resist: number;
}

/** Números da Resistência a controle. */
export const CONTROL_RULES = {
  /** chance de ignorar o controle = resistência × ignore */
  ignore: 0.6,
  /** quando pega, força e duração caem para 1 − resistência × reduce */
  reduce: 0.7,
  /** resistência extra dos elites */
  elite: 0.25,
  max: 0.9,
};

/**
 * Teste de controle contra a Resistência: 0 = ignorou; senão, o fator de força/duração do controle.
 * Monstros comuns (resistência 0) sofrem o controle inteiro; chefes ignoram muitas vezes e, quando
 * pegos, vão menos longe e ficam menos tempo.
 */
export function controlRoll(resist: number, rnd: () => number = Math.random): number {
  if (resist <= 0) return 1;
  if (rnd() < resist * CONTROL_RULES.ignore) return 0;
  return 1 - resist * CONTROL_RULES.reduce;
}

/** Força de um controle contínuo (lentidão, puxão), sem sorteio. */
export const controlScale = (resist: number) => 1 - resist * CONTROL_RULES.reduce;

const BASE = {
  slime: { id: 'slime', kind: 'slime', name: 'Slime', texture: 'slime', hp: 12, speed: 34, damage: 6, xp: 1, scale: 1, radius: 9, knockback: 1, resist: 0 },
  bat: { id: 'bat', kind: 'bat', name: 'Morcego', texture: 'bat', hp: 8, speed: 60, damage: 5, xp: 1, scale: 1, radius: 8, knockback: 1.2, resist: 0 },
  goblin: { id: 'goblin', kind: 'goblin', name: 'Goblin', texture: 'goblin', hp: 18, speed: 44, damage: 7, xp: 1, scale: 1, radius: 8, knockback: 1, resist: 0.05 },
  wolf: { id: 'wolf', kind: 'wolf', name: 'Lobo', texture: 'wolf', hp: 22, speed: 66, damage: 8, xp: 2, scale: 1, radius: 11, knockback: 0.9, resist: 0.1 },
  skeleton: { id: 'skeleton', kind: 'skeleton', name: 'Esqueleto', texture: 'skeleton', hp: 28, speed: 40, damage: 9, xp: 2, scale: 1, radius: 8, knockback: 0.8, resist: 0.15 },
  orc: { id: 'orc', kind: 'orc', name: 'Orc', texture: 'orc', hp: 75, speed: 31, damage: 14, xp: 4, scale: 1, radius: 13, knockback: 0.4, resist: 0.35 },
  demon: { id: 'demon', kind: 'demon', name: 'Demônio Ancestral', texture: 'demon', hp: 15000, speed: 42, damage: 25, xp: 150, scale: 1.3, radius: 22, knockback: 0, resist: 0.75 },
} satisfies Record<string, EnemyDef>;

/** Variante elemental: mesma criatura com outra cor, elemento e números um pouco maiores. */
function variant(of: EnemyDef, id: EnemyId, name: string, element: Element, extra: Partial<EnemyDef> = {}): EnemyDef {
  return { ...of, id, name, texture: id, element, hp: Math.round(of.hp * 1.4), xp: of.xp + 1, ...extra };
}

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  ...BASE,
  slime_fire: variant(BASE.slime, 'slime_fire', 'Slime de Fogo', 'fire', { damage: 8 }),
  slime_water: variant(BASE.slime, 'slime_water', "Slime d'Água", 'water', { speed: 38 }),
  goblin_earth: variant(BASE.goblin, 'goblin_earth', 'Goblin da Terra', 'earth', { hp: 32, speed: 40 }),
  bat_air: variant(BASE.bat, 'bat_air', 'Morcego do Vento', 'air', { speed: 72 }),
};

/** Cor das partículas quando o inimigo morre. */
export const DEATH_TINT: Record<EnemyId, number> = {
  slime: 0x6fdc72, bat: 0x7a4fa8, goblin: 0x5bb04f, wolf: 0x8f96a6, skeleton: 0xd5d1d6, orc: 0x7aab42, demon: 0xd23b35,
  slime_fire: 0xff7a2e, slime_water: 0x41a6f6, goblin_earth: 0xc69c6d, bat_air: 0xa7f070,
};
