// Sistema elemental: vantagens, efeitos por chance e reações (ver docs/GDD.md, Marco 2).
import type { Element } from './weapons';

export type Primary = 'fire' | 'water' | 'air' | 'earth';
export const PRIMARIES: Primary[] = ['fire', 'water', 'air', 'earth'];

/** De quais primários cada elemento é feito. Físico e Luz/Trevas (por enquanto) são neutros. */
export const ORIGINS: Record<Element, Primary[]> = {
  physical: [],
  light: [],
  dark: [],
  fire: ['fire'],
  water: ['water'],
  air: ['air'],
  earth: ['earth'],
  lightning: ['fire', 'air'],
};

/** Ciclo: Água > Fogo > Ar > Terra > Água. */
export const BEATS: Record<Primary, Primary> = { water: 'fire', fire: 'air', air: 'earth', earth: 'water' };

export const ADVANTAGE = 2;
export const DISADVANTAGE = 0.5;
export const SAME_ELEMENT = 0.25;

/**
 * Multiplicador de dano de um ataque contra um inimigo elemental. Elementos derivados herdam a
 * melhor vantagem entre as suas origens (Raio = Fogo + Ar: forte contra Terra pelo Ar).
 */
export function elementMultiplier(attack: Element, defender?: Element): number {
  const def = defender ? ORIGINS[defender][0] : undefined;
  if (!def) return 1;
  let best = 0;
  for (const o of ORIGINS[attack]) {
    const m = o === def ? SAME_ELEMENT : BEATS[o] === def ? ADVANTAGE : BEATS[def] === o ? DISADVANTAGE : 1;
    best = Math.max(best, m);
  }
  return best || 1;
}

export interface StatusDef {
  name: string;
  color: number;
  /** duração em segundos */
  duration: number;
}

/** Efeito que cada primário aplica por chance. */
export const STATUS: Record<Primary, StatusDef> = {
  fire: { name: 'Queimando', color: 0xff7a2e, duration: 4 },
  water: { name: 'Encharcado', color: 0x41a6f6, duration: 4 },
  air: { name: 'Desequilibrado', color: 0xa7f070, duration: 4 },
  earth: { name: 'Fraturado', color: 0xc69c6d, duration: 5 },
};

/** Números dos efeitos. */
export const STATUS_RULES = {
  /** chance base de aplicar o efeito por golpe (× chance da arma × potência elemental) */
  chance: 0.2,
  /** Queimando: fração do dano do golpe causada por segundo */
  burnDps: 0.35,
  burnTick: 0.5,
  /** Encharcado: redução de velocidade */
  soakSlow: 0.3,
  /** Desequilibrado: chance crítica extra contra o alvo, e empurrão ao aplicar */
  unbalancedCrit: 0.25,
  unbalancedKnock: 1.2,
  /** Fraturado: dano extra recebido */
  fracturedTaken: 0.25,
};

export type ReactionId = 'lava' | 'ice' | 'lightning' | 'steam' | 'mud' | 'sand';

export interface ReactionDef {
  id: ReactionId;
  name: string;
  color: number;
  pair: [Primary, Primary];
  /** dano da reação em múltiplos do golpe que a disparou */
  damage: number;
  /** raio da área (px) */
  radius: number;
  description: string;
}

/** Dois efeitos ativos no mesmo inimigo se consomem e disparam a reação do elemento derivado. */
export const REACTIONS: ReactionDef[] = [
  { id: 'lava', name: 'Lava', color: 0xff5a1f, pair: ['fire', 'earth'], damage: 2, radius: 48, description: 'Explosão que deixa os atingidos queimando' },
  { id: 'ice', name: 'Gelo', color: 0x9fe8ff, pair: ['water', 'air'], damage: 1.5, radius: 0, description: 'Congela o alvo' },
  { id: 'lightning', name: 'Raio', color: 0x73eff7, pair: ['fire', 'air'], damage: 1.2, radius: 90, description: 'Salta entre até 4 inimigos próximos' },
  { id: 'steam', name: 'Vapor', color: 0xe8eef4, pair: ['fire', 'water'], damage: 0.7, radius: 52, description: 'Nuvem escaldante que fere em pulsos' },
  { id: 'mud', name: 'Lama', color: 0x8a6a3a, pair: ['water', 'earth'], damage: 0.8, radius: 60, description: 'Lentidão forte em área' },
  { id: 'sand', name: 'Areia', color: 0xe6c27a, pair: ['air', 'earth'], damage: 0.5, radius: 46, description: 'Tempestade cortante em pulsos' },
];

export const REACTION_RULES = {
  freeze: 1.6,
  chainJumps: 4,
  steamPulses: 3,
  sandPulses: 4,
  pulseEvery: 0.5,
  mudSlow: 0.6,
  mudDuration: 3,
};

export function reactionFor(a: Primary, b: Primary): ReactionDef | undefined {
  return REACTIONS.find((r) => (r.pair[0] === a && r.pair[1] === b) || (r.pair[0] === b && r.pair[1] === a));
}

/** Chance de aplicar um efeito; acima de 1, o excesso fortalece o efeito (potência). */
export function statusRoll(weaponEffect: number, elementalPower: number, luck: number, rnd: () => number = Math.random) {
  const chance = STATUS_RULES.chance * weaponEffect * (1 + elementalPower + luck * 0.005);
  return { applied: rnd() < chance, potency: Math.max(1, chance) };
}
