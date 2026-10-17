import { PASSIVES, PASSIVE_IDS, type PassiveId } from '../data/passives';
import { MAX_WEAPONS, WEAPONS, WEAPON_IDS, type WeaponId } from '../data/weapons';

export type UpgradeOption =
  | { kind: 'weapon'; id: WeaponId; nextLevel: number }
  | { kind: 'passive'; id: PassiveId; nextLevel: number }
  | { kind: 'gold' }
  | { kind: 'heal' };

export interface Loadout {
  weapons: Partial<Record<WeaponId, number>>;
  passives: Partial<Record<PassiveId, number>>;
}

export const MAX_PASSIVES = 6;

export function allOptions(loadout: Loadout): UpgradeOption[] {
  const out: UpgradeOption[] = [];
  const ownedWeapons = Object.keys(loadout.weapons).length;
  for (const id of WEAPON_IDS) {
    const lvl = loadout.weapons[id] ?? 0;
    if (lvl === 0 && ownedWeapons >= MAX_WEAPONS) continue;
    if (lvl < WEAPONS[id].levels.length) out.push({ kind: 'weapon', id, nextLevel: lvl + 1 });
  }
  const ownedPassives = Object.keys(loadout.passives).length;
  for (const id of PASSIVE_IDS) {
    const lvl = loadout.passives[id] ?? 0;
    if (lvl === 0 && ownedPassives >= MAX_PASSIVES) continue;
    if (lvl < PASSIVES[id].maxLevel) out.push({ kind: 'passive', id, nextLevel: lvl + 1 });
  }
  return out;
}

/**
 * Sorteia `count` opções distintas. Melhorias de itens já possuídos têm peso maior,
 * para o jogador conseguir evoluir sua build.
 */
export function rollOptions(loadout: Loadout, count = 3, rng: () => number = Math.random): UpgradeOption[] {
  const pool = allOptions(loadout).map((o) => ({ o, w: o.kind !== 'gold' && o.kind !== 'heal' && o.nextLevel > 1 ? 2 : 1 }));
  const picked: UpgradeOption[] = [];
  while (picked.length < count && pool.length > 0) {
    const total = pool.reduce((s, p) => s + p.w, 0);
    let r = rng() * total;
    let idx = 0;
    for (; idx < pool.length - 1; idx++) {
      r -= pool[idx].w;
      if (r < 0) break;
    }
    picked.push(pool[idx].o);
    pool.splice(idx, 1);
  }
  if (picked.length === 0) picked.push({ kind: 'heal' }, { kind: 'gold' });
  return picked;
}

export function applyOption(loadout: Loadout, opt: UpgradeOption) {
  if (opt.kind === 'weapon') loadout.weapons[opt.id] = opt.nextLevel;
  else if (opt.kind === 'passive') loadout.passives[opt.id] = opt.nextLevel;
}

export function describeOption(opt: UpgradeOption): { title: string; icon: string; text: string; tag: string } {
  switch (opt.kind) {
    case 'weapon': {
      const def = WEAPONS[opt.id];
      return {
        title: def.name,
        icon: def.icon,
        text: opt.nextLevel === 1 ? def.description : def.upgrades[opt.nextLevel - 2],
        tag: opt.nextLevel === 1 ? 'NOVA ARMA' : `NÍVEL ${opt.nextLevel}`,
      };
    }
    case 'passive': {
      const def = PASSIVES[opt.id];
      return { title: def.name, icon: def.icon, text: def.description, tag: opt.nextLevel === 1 ? 'NOVO' : `NÍVEL ${opt.nextLevel}` };
    }
    case 'gold':
      return { title: 'Saco de Ouro', icon: 'coin', text: '+25 de ouro', tag: 'BÔNUS' };
    case 'heal':
      return { title: 'Frango Assado', icon: 'heart', text: 'Recupera 40 de vida', tag: 'BÔNUS' };
  }
}
