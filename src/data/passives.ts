export type PassiveId = 'might' | 'vigor' | 'boots' | 'tome' | 'magnet' | 'regen' | 'armor' | 'wisdom';

export interface PassiveDef {
  id: PassiveId;
  name: string;
  icon: string;
  description: string;
  maxLevel: number;
}

export const PASSIVES: Record<PassiveId, PassiveDef> = {
  might: { id: 'might', name: 'Poção de Força', icon: 'icon_potion', description: '+10% de dano', maxLevel: 5 },
  vigor: { id: 'vigor', name: 'Coração Vigoroso', icon: 'heart', description: '+20 de vida máxima', maxLevel: 5 },
  boots: { id: 'boots', name: 'Botas Ligeiras', icon: 'icon_boot', description: '+8% de velocidade', maxLevel: 5 },
  tome: { id: 'tome', name: 'Tomo Arcano', icon: 'icon_book', description: '-7% de recarga das armas', maxLevel: 5 },
  magnet: { id: 'magnet', name: 'Ímã', icon: 'icon_magnet', description: '+35% de alcance de coleta', maxLevel: 5 },
  regen: { id: 'regen', name: 'Erva Curativa', icon: 'icon_cross', description: '+0.3 de vida por segundo', maxLevel: 5 },
  armor: { id: 'armor', name: 'Armadura', icon: 'icon_shield', description: '-1 de dano recebido', maxLevel: 5 },
  wisdom: { id: 'wisdom', name: 'Cristal da Sabedoria', icon: 'gem_green', description: '+10% de experiência', maxLevel: 5 },
};

export const PASSIVE_IDS = Object.keys(PASSIVES) as PassiveId[];
