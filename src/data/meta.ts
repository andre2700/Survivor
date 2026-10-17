export type MetaId = 'maxHp' | 'might' | 'armor' | 'speed' | 'magnet' | 'growth' | 'greed' | 'reroll' | 'revival';

export interface MetaDef {
  id: MetaId;
  name: string;
  icon: string;
  description: string;
  maxLevel: number;
  baseCost: number;
}

/** Melhorias permanentes compradas com ouro entre as partidas. */
export const META_UPGRADES: MetaDef[] = [
  { id: 'maxHp', name: 'Vitalidade', icon: 'heart', description: '+10 de vida máxima', maxLevel: 5, baseCost: 60 },
  { id: 'might', name: 'Poder', icon: 'icon_potion', description: '+5% de dano', maxLevel: 5, baseCost: 80 },
  { id: 'armor', name: 'Couraça', icon: 'icon_shield', description: '+1 de armadura', maxLevel: 3, baseCost: 120 },
  { id: 'speed', name: 'Agilidade', icon: 'icon_boot', description: '+5% de velocidade', maxLevel: 3, baseCost: 80 },
  { id: 'magnet', name: 'Atração', icon: 'icon_magnet', description: '+15% de alcance de coleta', maxLevel: 3, baseCost: 50 },
  { id: 'growth', name: 'Crescimento', icon: 'gem_green', description: '+5% de experiência', maxLevel: 5, baseCost: 70 },
  { id: 'greed', name: 'Ganância', icon: 'coin', description: '+10% de ouro', maxLevel: 5, baseCost: 60 },
  { id: 'reroll', name: 'Sorte', icon: 'icon_dice', description: '+1 troca de opções por partida', maxLevel: 3, baseCost: 100 },
  { id: 'revival', name: 'Renascer', icon: 'icon_cross', description: 'Revive uma vez com 50% de vida', maxLevel: 1, baseCost: 400 },
];

export function metaCost(def: MetaDef, currentLevel: number): number {
  return Math.round(def.baseCost * (1 + currentLevel * 0.8));
}
