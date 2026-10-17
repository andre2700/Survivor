import type { WeaponId } from './weapons';

export type CharacterId = 'knight' | 'mage' | 'ranger' | 'barbarian';

export interface CharacterDef {
  id: CharacterId;
  name: string;
  texture: string;
  description: string;
  weapon: WeaponId;
  maxHp: number;
  speed: number;
  /** modificadores iniciais */
  might: number;
  cooldown: number;
  armor: number;
  cost: number;
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'knight', name: 'Cavaleiro', texture: 'hero_knight', weapon: 'sword',
    description: 'Resistente. Começa com Espada e +1 armadura.',
    maxHp: 120, speed: 62, might: 1, cooldown: 1, armor: 1, cost: 0,
  },
  {
    id: 'mage', name: 'Maga', texture: 'hero_mage', weapon: 'wand',
    description: 'Começa com Varinha. Armas recarregam 10% mais rápido.',
    maxHp: 90, speed: 62, might: 1, cooldown: 0.9, armor: 0, cost: 0,
  },
  {
    id: 'ranger', name: 'Caçadora', texture: 'hero_ranger', weapon: 'knives',
    description: 'Ágil. Começa com Adagas e +15% de velocidade.',
    maxHp: 100, speed: 71, might: 1, cooldown: 1, armor: 0, cost: 300,
  },
  {
    id: 'barbarian', name: 'Bárbaro', texture: 'hero_barbarian', weapon: 'axe',
    description: 'Brutal. Começa com Machado e +20% de dano.',
    maxHp: 140, speed: 58, might: 1.2, cooldown: 1, armor: 0, cost: 600,
  },
];

export function getCharacter(id: string): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}
