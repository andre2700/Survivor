// Armas modulares: padrão de ataque + elemento + tags + curva de crescimento infinita.
import { ORIGINS, type Primary } from './elements';

export type Element = 'physical' | 'fire' | 'water' | 'air' | 'earth' | 'light' | 'dark' | 'lightning';
export type Tag = 'melee' | 'projectile' | 'spell' | 'area' | 'heavy' | 'fast' | Primary;
/** Como a arma ataca. Cada padrão é implementado uma vez em `systems/weapons.ts`. */
export type Pattern = 'nearest' | 'volley' | 'arc' | 'lob' | 'orbit' | 'aura' | 'strike';

export type WeaponId = 'wand' | 'sword' | 'axe' | 'orb' | 'aura' | 'lightning' | 'knives' | 'water' | 'rock' | 'wind';

export interface WeaponStats {
  damage: number;
  /** segundos entre ataques (orbe/aura: intervalo de dano no mesmo inimigo) */
  cooldown: number;
  amount: number;
  pierce: number;
  /** multiplicador de tamanho */
  area: number;
  /** px/s do projétil, ou rad/s do orbe */
  speed: number;
  /** vida do projétil em segundos */
  duration: number;
  /** multiplicador da chance de aplicar o efeito do elemento (golpes pesados maior, rápidos menor) */
  effect: number;
}

/** Um passo de crescimento: frações são relativas ao valor base. */
export interface Growth {
  damage?: number;
  amount?: number;
  cooldown?: number;
  area?: number;
  pierce?: number;
  speed?: number;
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  icon: string;
  description: string;
  pattern: Pattern;
  element: Element;
  /** tags próprias; as dos elementos de origem entram sozinhas (ver weaponTags) */
  tags: Tag[];
  /** textura do projétil (padrões que disparam projéteis) */
  projectile?: string;
  base: WeaponStats;
  /** Ciclo de crescimento repetido para sempre a partir do nível 2. */
  growth: Growth[];
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  wand: {
    id: 'wand', name: 'Varinha Mágica', icon: 'bolt', pattern: 'nearest', element: 'light', tags: ['projectile', 'spell'],
    description: 'Dispara orbes de luz no inimigo mais próximo.',
    base: { damage: 10, cooldown: 1.1, amount: 1, pierce: 1, area: 1, speed: 240, duration: 1.6, effect: 1 },
    growth: [{ amount: 1 }, { damage: 0.3 }, { cooldown: 0.1 }, { damage: 0.3 }, { pierce: 1 }],
  },
  sword: {
    id: 'sword', name: 'Espada', icon: 'icon_sword', pattern: 'arc', element: 'physical', tags: ['melee'],
    description: 'Golpe em arco para o lado em que você olha.',
    base: { damage: 22, cooldown: 0.95, amount: 1, pierce: 999, area: 1.1, speed: 0, duration: 0.18, effect: 1 },
    growth: [{ damage: 0.3 }, { area: 0.15 }, { amount: 1 }, { damage: 0.3 }, { cooldown: 0.1 }],
  },
  axe: {
    id: 'axe', name: 'Machado', icon: 'axe', pattern: 'lob', element: 'physical', tags: ['projectile', 'heavy'],
    description: 'Arremessa machados em arco. Dano alto.',
    base: { damage: 25, cooldown: 1.8, amount: 1, pierce: 3, area: 1, speed: 300, duration: 2.2, effect: 1 },
    growth: [{ amount: 1 }, { damage: 0.35 }, { pierce: 2 }, { area: 0.15 }, { damage: 0.35 }],
  },
  orb: {
    id: 'orb', name: 'Orbe Sagrado', icon: 'orb', pattern: 'orbit', element: 'light', tags: ['spell', 'area'],
    description: 'Orbes giram ao seu redor causando dano.',
    base: { damage: 8, cooldown: 0.5, amount: 2, pierce: 999, area: 1, speed: 3, duration: 0, effect: 0.6 },
    growth: [{ amount: 1 }, { damage: 0.3 }, { area: 0.15, speed: 0.15 }, { damage: 0.3 }, { amount: 1 }],
  },
  aura: {
    id: 'aura', name: 'Aura de Fogo', icon: 'icon_fire', pattern: 'aura', element: 'fire', tags: ['spell', 'area'],
    description: 'Queima inimigos próximos continuamente.',
    base: { damage: 5, cooldown: 0.5, amount: 1, pierce: 999, area: 1, speed: 0, duration: 0, effect: 0.5 },
    growth: [{ area: 0.15 }, { damage: 0.35 }, { cooldown: 0.1 }, { area: 0.15 }, { damage: 0.35 }],
  },
  lightning: {
    id: 'lightning', name: 'Raio', icon: 'icon_bolt', pattern: 'strike', element: 'lightning', tags: ['spell', 'area'],
    description: 'Raios atingem inimigos aleatórios na tela.',
    base: { damage: 22, cooldown: 2.2, amount: 2, pierce: 999, area: 1, speed: 0, duration: 0, effect: 1 },
    growth: [{ amount: 1 }, { damage: 0.35 }, { cooldown: 0.1 }, { area: 0.2 }, { damage: 0.35 }],
  },
  knives: {
    id: 'knives', name: 'Adagas', icon: 'knife', pattern: 'volley', element: 'physical', tags: ['projectile', 'fast'],
    description: 'Lança adagas rápidas na direção do movimento.',
    base: { damage: 7, cooldown: 0.45, amount: 1, pierce: 1, area: 1, speed: 360, duration: 1, effect: 0.7 },
    growth: [{ amount: 1 }, { damage: 0.3 }, { cooldown: 0.1 }, { pierce: 1 }, { damage: 0.3 }],
  },
  water: {
    id: 'water', name: "Jato d'Água", icon: 'icon_water', pattern: 'nearest', element: 'water', tags: ['projectile', 'spell'], projectile: 'proj_water',
    description: 'Esferas de água no inimigo mais próximo. Encharcam (lentidão).',
    base: { damage: 9, cooldown: 1, amount: 1, pierce: 2, area: 1, speed: 220, duration: 1.6, effect: 1.2 },
    growth: [{ amount: 1 }, { damage: 0.3 }, { pierce: 1 }, { damage: 0.3 }, { cooldown: 0.1 }],
  },
  rock: {
    id: 'rock', name: 'Pedregulho', icon: 'icon_rock', pattern: 'lob', element: 'earth', tags: ['projectile', 'heavy'], projectile: 'proj_rock',
    description: 'Arremessa pedras pesadas em arco. Fraturam (mais dano recebido).',
    base: { damage: 30, cooldown: 2.2, amount: 1, pierce: 2, area: 1, speed: 290, duration: 2.2, effect: 1.6 },
    growth: [{ damage: 0.35 }, { amount: 1 }, { area: 0.15 }, { damage: 0.35 }, { pierce: 1 }],
  },
  wind: {
    id: 'wind', name: 'Lâmina de Vento', icon: 'icon_wind', pattern: 'volley', element: 'air', tags: ['projectile', 'fast'], projectile: 'proj_wind',
    description: 'Lâminas de vento na direção do movimento. Desequilibram (empurrão e mais crítico).',
    base: { damage: 6, cooldown: 0.5, amount: 1, pierce: 3, area: 1, speed: 300, duration: 0.9, effect: 0.7 },
    growth: [{ amount: 1 }, { damage: 0.3 }, { pierce: 1 }, { cooldown: 0.1 }, { damage: 0.3 }],
  },
};

/** Tags da arma, incluindo as dos elementos de origem (Raio conta como Fogo e Ar). */
export function weaponTags(def: WeaponDef): Tag[] {
  return [...def.tags, ...ORIGINS[def.element]];
}

export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];

/** A cada quantos níveis a arma desperta. */
export const AWAKEN_EVERY = 10;
/** Acima disso, cada projétil extra vira +12% de dano (protege o desempenho). */
export const MAX_PHYSICAL_AMOUNT = 8;

export function isAwakening(level: number) {
  return level % AWAKEN_EVERY === 0;
}

/** Stats absolutos da arma num nível qualquer (sem teto). */
export function weaponStatsAt(def: WeaponDef, level: number): WeaponStats {
  const b = def.base;
  const s: WeaponStats = { ...b };
  for (let l = 2; l <= level; l++) {
    const g = def.growth[(l - 2) % def.growth.length];
    if (g.damage) s.damage += b.damage * g.damage;
    if (g.amount) s.amount += g.amount;
    if (g.cooldown) s.cooldown *= 1 - g.cooldown;
    if (g.area) s.area += g.area;
    if (g.pierce) s.pierce += g.pierce;
    if (g.speed) s.speed += b.speed * g.speed;
    if (isAwakening(l)) {
      s.damage *= 1.5;
      s.amount += 1;
    }
  }
  return s;
}

/** Converte o excesso de quantidade em dano. */
export function capAmount(s: WeaponStats): WeaponStats {
  if (s.amount <= MAX_PHYSICAL_AMOUNT) return s;
  return { ...s, damage: s.damage * (1 + (s.amount - MAX_PHYSICAL_AMOUNT) * 0.12), amount: MAX_PHYSICAL_AMOUNT };
}

export function describeGrowth(g: Growth): string {
  const parts: string[] = [];
  if (g.damage) parts.push(`+${Math.round(g.damage * 100)}% dano`);
  if (g.amount) parts.push(`+${g.amount} quantidade`);
  if (g.cooldown) parts.push(`-${Math.round(g.cooldown * 100)}% recarga`);
  if (g.area) parts.push(`+${Math.round(g.area * 100)}% área`);
  if (g.pierce) parts.push(`+${g.pierce} perfuração`);
  if (g.speed) parts.push(`+${Math.round(g.speed * 100)}% velocidade`);
  return parts.join(', ');
}

export const ELEMENT_COLORS: Record<Element, string> = {
  physical: '#f4f4f4',
  fire: '#ef7d57',
  water: '#41a6f6',
  air: '#a7f070',
  earth: '#c69c6d',
  light: '#ffcd75',
  dark: '#c56cf0',
  lightning: '#73eff7',
};
