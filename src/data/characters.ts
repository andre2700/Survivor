import type { Modifier } from '../core/stats';
import type { WeaponId } from './weapons';

export type CharacterId = 'knight' | 'mage' | 'ranger' | 'barbarian';

export interface CharacterDef {
  id: CharacterId;
  name: string;
  texture: string;
  /** equipamento desenhado por cima de uma arte sem equipamento (src/art/heroRig.ts) */
  rig?: string;
  description: string;
  weapon: WeaponId;
  /** diferenças em relação aos atributos base */
  mods: Modifier[];
  cost: number;
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'knight', name: 'Cavaleiro', texture: 'hero_knight', rig: 'knight', weapon: 'sword', cost: 0,
    description: 'Resistente. Começa com Espada, +20 vida e +4 defesa.',
    mods: [{ stat: 'maxHp', flat: 20 }, { stat: 'defense', flat: 4 }],
  },
  {
    id: 'mage', name: 'Maga', texture: 'hero_mage', weapon: 'wand', cost: 0,
    description: 'Começa com Varinha. +15% vel. de ataque, -10 vida.',
    mods: [{ stat: 'attackSpeed', flat: 0.15 }, { stat: 'maxHp', flat: -10 }],
  },
  {
    id: 'ranger', name: 'Caçadora', texture: 'hero_ranger', weapon: 'knives', cost: 300,
    description: 'Ágil. Começa com Adagas, +15% velocidade e +5% crítico.',
    mods: [{ stat: 'moveSpeed', pct: 0.15 }, { stat: 'critChance', flat: 0.05 }],
  },
  {
    id: 'barbarian', name: 'Bárbaro', texture: 'hero_barbarian', weapon: 'axe', cost: 600,
    description: 'Brutal. Começa com Machado, +20% dano e +40 vida.',
    mods: [{ stat: 'power', flat: 0.2 }, { stat: 'maxHp', flat: 40 }, { stat: 'moveSpeed', pct: -0.05 }],
  },
];

export function getCharacter(id: string): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}
