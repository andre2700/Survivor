import type { StatId } from '../core/stats';

/** Cartas de atributo: sobem sem teto. `value` é o ganho de uma carta Comum. */
export interface StatCard {
  stat: StatId;
  name: string;
  icon: string;
  value: number;
  /** 'flat' soma ao valor; 'pct' soma ao multiplicador percentual */
  mode: 'flat' | 'pct';
  /** como exibir o valor do atributo */
  display: 'pct' | 'int' | 'dec';
  /** peso relativo no sorteio */
  weight?: number;
}

export const STAT_CARDS: StatCard[] = [
  { stat: 'power', name: 'Poção de Força', icon: 'icon_potion', value: 0.15, mode: 'flat', display: 'pct' },
  { stat: 'attackSpeed', name: 'Tomo Arcano', icon: 'icon_book', value: 0.12, mode: 'flat', display: 'pct' },
  { stat: 'amount', name: 'Eco', icon: 'bolt', value: 1, mode: 'flat', display: 'int', weight: 0.4 },
  { stat: 'area', name: 'Amplitude', icon: 'orb', value: 0.15, mode: 'flat', display: 'pct' },
  { stat: 'duration', name: 'Persistência', icon: 'icon_book', value: 0.2, mode: 'flat', display: 'pct', weight: 0.6 },
  { stat: 'projectileSpeed', name: 'Impulso', icon: 'knife', value: 0.2, mode: 'flat', display: 'pct', weight: 0.6 },
  { stat: 'pierce', name: 'Ponta de Aço', icon: 'knife', value: 1, mode: 'flat', display: 'int', weight: 0.4 },
  { stat: 'critChance', name: 'Olho de Águia', icon: 'icon_sword', value: 0.08, mode: 'flat', display: 'pct' },
  { stat: 'critDamage', name: 'Golpe Fatal', icon: 'icon_sword', value: 0.3, mode: 'flat', display: 'dec' },
  { stat: 'maxHp', name: 'Coração Vigoroso', icon: 'heart', value: 0.2, mode: 'pct', display: 'int' },
  { stat: 'regen', name: 'Erva Curativa', icon: 'icon_cross', value: 0.5, mode: 'flat', display: 'dec' },
  { stat: 'defense', name: 'Armadura', icon: 'icon_shield', value: 4, mode: 'flat', display: 'int' },
  { stat: 'dodge', name: 'Reflexos', icon: 'icon_boot', value: 8, mode: 'flat', display: 'int', weight: 0.7 },
  { stat: 'lifesteal', name: 'Vampirismo', icon: 'heart', value: 0.02, mode: 'flat', display: 'pct', weight: 0.6 },
  { stat: 'thorns', name: 'Espinhos', icon: 'icon_shield', value: 8, mode: 'flat', display: 'int', weight: 0.5 },
  { stat: 'moveSpeed', name: 'Botas Ligeiras', icon: 'icon_boot', value: 0.1, mode: 'pct', display: 'int' },
  { stat: 'magnet', name: 'Ímã', icon: 'icon_magnet', value: 0.3, mode: 'pct', display: 'int' },
  { stat: 'luck', name: 'Trevo', icon: 'icon_dice', value: 10, mode: 'flat', display: 'int' },
  { stat: 'wisdom', name: 'Cristal da Sabedoria', icon: 'gem_green', value: 0.12, mode: 'flat', display: 'pct' },
  { stat: 'greed', name: 'Ganância', icon: 'coin', value: 0.15, mode: 'flat', display: 'pct', weight: 0.6 },
  { stat: 'curse', name: 'Maldição', icon: 'gem_red', value: 0.1, mode: 'flat', display: 'pct', weight: 0.4 },
];

export const STAT_LABELS: Record<StatId, string> = {
  power: 'Dano', attackSpeed: 'Vel. de ataque', amount: 'Quantidade', area: 'Área', duration: 'Duração',
  projectileSpeed: 'Vel. de projétil', pierce: 'Perfuração', critChance: 'Chance crítica', critDamage: 'Dano crítico',
  elementalPower: 'Potência elemental', maxHp: 'Vida máxima', regen: 'Regeneração', defense: 'Defesa', dodge: 'Esquiva',
  lifesteal: 'Roubo de vida', thorns: 'Espinhos', moveSpeed: 'Velocidade', magnet: 'Ímã', luck: 'Sorte',
  wisdom: 'Experiência', greed: 'Ouro', revives: 'Renascimentos', curse: 'Maldição',
};

export function cardFor(stat: StatId): StatCard | undefined {
  return STAT_CARDS.find((c) => c.stat === stat);
}
