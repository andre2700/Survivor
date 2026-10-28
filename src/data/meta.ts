import type { Modifier, StatId } from '../core/stats';

export type MetaId =
  | 'maxHp' | 'power' | 'defense' | 'moveSpeed' | 'magnet' | 'attackSpeed' | 'critChance'
  | 'luck' | 'wisdom' | 'greed' | 'reroll' | 'banish' | 'lock' | 'choices' | 'revival';

/** Categorias da loja de melhorias (abas). */
export type MetaCategory = 'ataque' | 'defesa' | 'exploracao' | 'cartas';

export const META_CATEGORIES: { id: MetaCategory; name: string; icon: string; color: number; blurb: string }[] = [
  { id: 'ataque', name: 'Ataque', icon: 'icon_sword', color: 0xff8a6a, blurb: 'Mais dano, mais rápido, mais críticos' },
  { id: 'defesa', name: 'Defesa', icon: 'icon_shield', color: 0x7fc4ff, blurb: 'Aguente mais e volte da morte' },
  { id: 'exploracao', name: 'Exploração', icon: 'icon_boot', color: 0x8cf08a, blurb: 'Velocidade, coleta, experiência e ouro' },
  { id: 'cartas', name: 'Cartas', icon: 'icon_dice', color: 0xd6a6ff, blurb: 'Controle sobre as cartas de nível' },
];

export interface MetaDef {
  id: MetaId;
  category: MetaCategory;
  name: string;
  icon: string;
  description: string;
  baseCost: number;
  /** crescimento do preço por nível */
  costGrowth: number;
  /** atributo que a melhoria aumenta, por nível */
  stat?: { id: StatId; flat?: number; pct?: number };
}

/** Melhorias permanentes compradas com ouro. Nenhuma tem teto: o preço cresce a cada nível. */
export const META_UPGRADES: MetaDef[] = [
  { id: 'maxHp', category: 'defesa', name: 'Vitalidade', icon: 'heart', description: '+5% de vida máxima', baseCost: 40, costGrowth: 1.22, stat: { id: 'maxHp', pct: 0.05 } },
  { id: 'power', category: 'ataque', name: 'Poder', icon: 'icon_potion', description: '+5% de dano', baseCost: 60, costGrowth: 1.22, stat: { id: 'power', flat: 0.05 } },
  { id: 'defense', category: 'defesa', name: 'Couraça', icon: 'icon_shield', description: '+1 de defesa', baseCost: 60, costGrowth: 1.25, stat: { id: 'defense', flat: 1 } },
  { id: 'attackSpeed', category: 'ataque', name: 'Ímpeto', icon: 'icon_book', description: '+3% vel. de ataque', baseCost: 70, costGrowth: 1.25, stat: { id: 'attackSpeed', flat: 0.03 } },
  { id: 'critChance', category: 'ataque', name: 'Precisão', icon: 'icon_sword', description: '+1% de chance crítica', baseCost: 70, costGrowth: 1.25, stat: { id: 'critChance', flat: 0.01 } },
  { id: 'moveSpeed', category: 'exploracao', name: 'Agilidade', icon: 'icon_boot', description: '+3% de velocidade', baseCost: 50, costGrowth: 1.28, stat: { id: 'moveSpeed', pct: 0.03 } },
  { id: 'magnet', category: 'exploracao', name: 'Atração', icon: 'icon_magnet', description: '+10% de alcance de coleta', baseCost: 30, costGrowth: 1.25, stat: { id: 'magnet', pct: 0.1 } },
  { id: 'luck', category: 'cartas', name: 'Sorte', icon: 'icon_dice', description: '+5 de sorte (cartas mais raras)', baseCost: 60, costGrowth: 1.25, stat: { id: 'luck', flat: 5 } },
  { id: 'wisdom', category: 'exploracao', name: 'Crescimento', icon: 'gem_green', description: '+5% de experiência', baseCost: 50, costGrowth: 1.22, stat: { id: 'wisdom', flat: 0.05 } },
  { id: 'greed', category: 'exploracao', name: 'Ganância', icon: 'coin', description: '+10% de ouro', baseCost: 50, costGrowth: 1.22, stat: { id: 'greed', flat: 0.1 } },
  { id: 'reroll', category: 'cartas', name: 'Rolar', icon: 'icon_dice', description: '+1 troca de opções por partida', baseCost: 80, costGrowth: 1.6 },
  { id: 'banish', category: 'cartas', name: 'Banir', icon: 'icon_cross', description: '+1 banimento por partida', baseCost: 120, costGrowth: 1.6 },
  { id: 'lock', category: 'cartas', name: 'Fixar', icon: 'icon_shield', description: '+1 carta fixada por partida', baseCost: 120, costGrowth: 1.6 },
  // sem teto: as que podem "quebrar o jogo" ficam caríssimas (o preço multiplica a cada nível)
  { id: 'choices', category: 'cartas', name: 'Visão', icon: 'gem_red', description: '+1 opção por nível', baseCost: 600, costGrowth: 3.2 },
  { id: 'revival', category: 'defesa', name: 'Renascer', icon: 'icon_cross', description: '+1 renascimento por partida', baseCost: 500, costGrowth: 3.5 },
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
