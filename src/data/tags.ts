import type { Tag, WeaponStats } from './weapons';

export interface TagTier {
  count: number;
  text: string;
  apply: (s: WeaponStats) => void;
}

export interface TagDef {
  id: Tag;
  name: string;
  tiers: TagTier[];
}

/** Bônus de conjunto: ter várias armas com a mesma tag fortalece todas elas. */
export const TAGS: Record<Tag, TagDef> = {
  projectile: {
    id: 'projectile', name: 'Projétil', tiers: [
      { count: 3, text: '+1 quantidade', apply: (s) => { s.amount += 1; } },
      { count: 5, text: '+1 perfuração', apply: (s) => { s.pierce += 1; } },
    ],
  },
  melee: {
    id: 'melee', name: 'Corpo a corpo', tiers: [
      { count: 2, text: '+25% área', apply: (s) => { s.area *= 1.25; } },
      { count: 4, text: '+40% dano', apply: (s) => { s.damage *= 1.4; } },
    ],
  },
  spell: {
    id: 'spell', name: 'Feitiço', tiers: [
      { count: 3, text: '-15% recarga', apply: (s) => { s.cooldown *= 0.85; } },
      { count: 5, text: '+30% dano', apply: (s) => { s.damage *= 1.3; } },
    ],
  },
  area: {
    id: 'area', name: 'Área', tiers: [
      { count: 2, text: '+20% área', apply: (s) => { s.area *= 1.2; } },
      { count: 4, text: '+25% dano', apply: (s) => { s.damage *= 1.25; } },
    ],
  },
  heavy: {
    id: 'heavy', name: 'Pesada', tiers: [{ count: 2, text: '+30% dano', apply: (s) => { s.damage *= 1.3; } }],
  },
  fast: {
    id: 'fast', name: 'Rápida', tiers: [{ count: 2, text: '-15% recarga', apply: (s) => { s.cooldown *= 0.85; } }],
  },
  fire: elementTag('fire', 'Fogo'),
  water: elementTag('water', 'Água'),
  air: elementTag('air', 'Ar'),
  earth: elementTag('earth', 'Terra'),
};

/** Elementos: mais chance de aplicar o efeito e depois mais dano (armas derivadas contam nas duas origens). */
function elementTag(id: Tag, name: string): TagDef {
  return {
    id, name, tiers: [
      { count: 2, text: '+30% chance de efeito', apply: (s) => { s.effect *= 1.3; } },
      { count: 4, text: '+30% dano', apply: (s) => { s.damage *= 1.3; } },
    ],
  };
}

/** Quantas armas possuídas têm cada tag. */
export function countTags(tagLists: Tag[][]): Partial<Record<Tag, number>> {
  const out: Partial<Record<Tag, number>> = {};
  for (const tags of tagLists) for (const t of tags) out[t] = (out[t] ?? 0) + 1;
  return out;
}

/** Aplica os bônus de conjunto ativos a uma arma com as tags dadas. */
export function applyTagBonuses(s: WeaponStats, tags: Tag[], counts: Partial<Record<Tag, number>>) {
  for (const t of tags) {
    for (const tier of TAGS[t].tiers) if ((counts[t] ?? 0) >= tier.count) tier.apply(s);
  }
}
