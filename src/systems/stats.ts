import type { CharacterDef } from '../data/characters';
import type { MetaId } from '../data/meta';
import type { PassiveId } from '../data/passives';

export interface PlayerStats {
  maxHp: number;
  speed: number;
  might: number;
  cooldown: number;
  magnet: number;
  regen: number;
  armor: number;
  xpGain: number;
  goldGain: number;
}

export const BASE_MAGNET = 40;

export function computeStats(
  char: CharacterDef,
  meta: Partial<Record<MetaId, number>>,
  passives: Partial<Record<PassiveId, number>>,
): PlayerStats {
  const m = (id: MetaId) => meta[id] ?? 0;
  const p = (id: PassiveId) => passives[id] ?? 0;
  return {
    maxHp: char.maxHp + m('maxHp') * 10 + p('vigor') * 20,
    speed: char.speed * (1 + m('speed') * 0.05 + p('boots') * 0.08),
    might: char.might * (1 + m('might') * 0.05 + p('might') * 0.1),
    cooldown: char.cooldown * Math.pow(0.93, p('tome')),
    magnet: BASE_MAGNET * (1 + m('magnet') * 0.15 + p('magnet') * 0.35),
    regen: p('regen') * 0.3,
    armor: char.armor + m('armor') + p('armor'),
    xpGain: 1 + m('growth') * 0.05 + p('wisdom') * 0.1,
    goldGain: 1 + m('greed') * 0.1,
  };
}

/** Dano recebido após armadura (mínimo 1). */
export function damageAfterArmor(raw: number, armor: number): number {
  return Math.max(1, raw - armor);
}
