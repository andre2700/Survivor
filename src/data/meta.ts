import type { Modifier, StatId } from '../core/stats';

export type MetaId =
  | 'maxHp' | 'power' | 'defense' | 'moveSpeed' | 'magnet' | 'attackSpeed' | 'critChance'
  | 'luck' | 'wisdom' | 'greed' | 'reroll' | 'banish' | 'lock' | 'choices' | 'revival';

export interface MetaDef {
  id: MetaId;
  name: string;
  icon: string;
  description: string;
  /** undefined = sem teto */
  maxLevel?: number;
  baseCost: number;
  /** crescimento do preço por nível */
  costGrowth: number;
  /** atributo que a melhoria aumenta, por nível */
  stat?: { id: StatId; flat?: number; pct?: number };
}

/** Melhorias permanentes compradas com ouro. As de atributo não têm teto. */
export const META_UPGRADES: MetaDef[] = [
  { id: 'maxHp', name: 'Vitalidade', icon: 'heart', description: '+5% de vida máxima', baseCost: 40, costGrowth: 1.22, stat: { id: 'maxHp', pct: 0.05 } },
  { id: 'power', name: 'Poder', icon: 'icon_potion', description: '+5% de dano', baseCost: 60, costGrowth: 1.22, stat: { id: 'power', flat: 0.05 } },
  { id: 'defense', name: 'Couraça', icon: 'icon_shield', description: '+1 de defesa', baseCost: 60, costGrowth: 1.25, stat: { id: 'defense', flat: 1 } },
  { id: 'attackSpeed', name: 'Ímpeto', icon: 'icon_book', description: '+3% vel. de ataque', baseCost: 70, costGrowth: 1.25, stat: { id: 'attackSpeed', flat: 0.03 } },
  { id: 'critChance', name: 'Precisão', icon: 'icon_sword', description: '+1% de chance crítica', baseCost: 70, costGrowth: 1.25, stat: { id: 'critChance', flat: 0.01 } },
  { id: 'moveSpeed', name: 'Agilidade', icon: 'icon_boot', description: '+3% de velocidade', baseCost: 50, costGrowth: 1.28, stat: { id: 'moveSpeed', pct: 0.03 } },
  { id: 'magnet', name: 'Atração', icon: 'icon_magnet', description: '+10% de alcance de coleta', baseCost: 30, costGrowth: 1.25, stat: { id: 'magnet', pct: 0.1 } },
  { id: 'luck', name: 'Sorte', icon: 'icon_dice', description: '+5 de sorte (cartas mais raras)', baseCost: 60, costGrowth: 1.25, stat: { id: 'luck', flat: 5 } },
  { id: 'wisdom', name: 'Crescimento', icon: 'gem_green', description: '+5% de experiência', baseCost: 50, costGrowth: 1.22, stat: { id: 'wisdom', flat: 0.05 } },
  { id: 'greed', name: 'Ganância', icon: 'coin', description: '+10% de ouro', baseCost: 50, costGrowth: 1.22, stat: { id: 'greed', flat: 0.1 } },
  { id: 'reroll', name: 'Rolar', icon: 'icon_dice', description: '+1 troca de opções por partida', baseCost: 80, costGrowth: 1.6 },
  { id: 'banish', name: 'Banir', icon: 'icon_cross', description: '+1 banimento por partida', baseCost: 120, costGrowth: 1.6 },
  { id: 'lock', name: 'Fixar', icon: 'icon_shield', description: '+1 carta fixada por partida', baseCost: 120, costGrowth: 1.6 },
  { id: 'choices', name: 'Visão', icon: 'gem_red', description: '+1 opção por nível', maxLevel: 3, baseCost: 400, costGrowth: 2.5 },
  { id: 'revival', name: 'Renascer', icon: 'icon_cross', description: '+1 renascimento por partida', maxLevel: 3, baseCost: 300, costGrowth: 2.2 },
];

export function metaCost(def: MetaDef, level: number): number {
  return Math.round(def.baseCost * Math.pow(def.costGrowth, level));
}

/** Modificadores de atributo vindos da progressão permanente. */
export function metaModifiers(levels: Partial<Record<MetaId, number>>): Modifier[] {
  const mods: Modifier[] = [];
  for (const def of META_UPGRADES) {
    const lvl = levels[def.id] ?? 0;
    if (!lvl || !def.stat) continue;
    mods.push({ stat: def.stat.id, flat: (def.stat.flat ?? 0) * lvl, pct: (def.stat.pct ?? 0) * lvl });
  }
  if (levels.revival) mods.push({ stat: 'revives', flat: levels.revival });
  return mods;
}
