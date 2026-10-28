import { STAT_CARDS, STAT_LABELS, cardFor } from '../data/cards';
import { WEAPONS, WEAPON_IDS, describeGrowth, isAwakening, weaponStatsAt, type Growth, type WeaponId } from '../data/weapons';
import { formatNumber } from '../core/format';
import type { Modifier, StatId, Stats } from '../core/stats';

export interface RarityDef {
  name: string;
  /** quantos níveis / quantas vezes o valor da carta */
  mult: number;
  color: number;
  text: string;
}

export const RARITIES: RarityDef[] = [
  { name: 'Comum', mult: 1, color: 0x94b0c2, text: '#94b0c2' },
  { name: 'Rara', mult: 2, color: 0x41a6f6, text: '#41a6f6' },
  { name: 'Épica', mult: 3, color: 0xc56cf0, text: '#c56cf0' },
  { name: 'Lendária', mult: 5, color: 0xffcd75, text: '#ffcd75' },
];

export type UpgradeOption =
  | { kind: 'weapon'; id: WeaponId; rarity: number }
  | { kind: 'stat'; stat: StatId; rarity: number }
  | { kind: 'gold'; rarity: number }
  | { kind: 'heal'; rarity: number };

export interface Loadout {
  /** nível de cada arma possuída (sem limite de armas nem de nível) */
  weapons: Partial<Record<WeaponId, number>>;
  /** quantas "unidades" de cada carta de atributo foram obtidas */
  stats: Partial<Record<StatId, number>>;
}

export function optionKey(o: UpgradeOption): string {
  return o.kind === 'weapon' ? `w:${o.id}` : o.kind === 'stat' ? `s:${o.stat}` : o.kind;
}

/** Sorteia a raridade; cada ponto de Sorte desloca o peso para as raras. */
export function rollRarity(luck: number, rnd: () => number = Math.random): number {
  const base = [70, 22, 6.5, 1.5];
  const shift = 1 + Math.max(0, luck) / 100;
  const weights = base.map((w, i) => w * Math.pow(shift, i));
  let r = rnd() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

interface Candidate {
  key: string;
  weight: number;
  make: (rarity: number) => UpgradeOption;
}

function candidates(loadout: Loadout, excluded: Set<string>): Candidate[] {
  const out: Candidate[] = [];
  for (const id of WEAPON_IDS) {
    const owned = (loadout.weapons[id] ?? 0) > 0;
    out.push({ key: `w:${id}`, weight: owned ? 3 : 1.6, make: (rarity) => ({ kind: 'weapon', id, rarity }) });
  }
  for (const c of STAT_CARDS) {
    out.push({ key: `s:${c.stat}`, weight: 0.6 * (c.weight ?? 1), make: (rarity) => ({ kind: 'stat', stat: c.stat, rarity }) });
  }
  return out.filter((c) => !excluded.has(c.key));
}

/**
 * Sorteia `count` opções distintas. `locked` entram primeiro; `banned` nunca aparecem.
 * Sem limite de armas: qualquer arma pode aparecer a qualquer momento.
 */
export function rollOptions(
  loadout: Loadout,
  count: number,
  luck = 0,
  banned: Set<string> = new Set(),
  locked: UpgradeOption[] = [],
  rnd: () => number = Math.random,
): UpgradeOption[] {
  const picked: UpgradeOption[] = [...locked.slice(0, count)];
  const excluded = new Set([...banned, ...picked.map(optionKey)]);
  const pool = candidates(loadout, excluded);
  while (picked.length < count && pool.length > 0) {
    const total = pool.reduce((s, c) => s + c.weight, 0);
    let r = rnd() * total;
    let idx = 0;
    for (; idx < pool.length - 1; idx++) {
      r -= pool[idx].weight;
      if (r < 0) break;
    }
    picked.push(pool[idx].make(rollRarity(luck, rnd)));
    pool.splice(idx, 1);
  }
  if (picked.length === 0) picked.push({ kind: 'heal', rarity: 0 }, { kind: 'gold', rarity: 0 });
  return picked;
}

export function applyOption(loadout: Loadout, opt: UpgradeOption) {
  const mult = RARITIES[opt.rarity].mult;
  if (opt.kind === 'weapon') loadout.weapons[opt.id] = (loadout.weapons[opt.id] ?? 0) + mult;
  else if (opt.kind === 'stat') loadout.stats[opt.stat] = (loadout.stats[opt.stat] ?? 0) + mult;
}

/** Modificadores de atributo vindos das cartas da partida. */
export function loadoutModifiers(loadout: Loadout): Modifier[] {
  const mods: Modifier[] = [];
  for (const [stat, units] of Object.entries(loadout.stats) as [StatId, number][]) {
    const card = cardFor(stat);
    if (!card || !units) continue;
    mods.push(card.mode === 'flat' ? { stat, flat: card.value * units } : { stat, pct: card.value * units });
  }
  return mods;
}

export function formatStat(stat: StatId, v: number): string {
  const card = cardFor(stat);
  const display = card?.display ?? 'int';
  if (display === 'pct') return `${formatNumber(Math.round(v * 1000) / 10)}%`;
  if (display === 'dec') return formatNumber(Math.round(v * 10) / 10);
  return formatNumber(Math.round(v));
}

export interface OptionInfo {
  title: string;
  icon: string;
  tag: string;
  text: string;
  /** "antes → depois" quando aplicável */
  change?: string;
}

/**
 * Texto da carta. `stats` = atributos atuais; `statsAfter` calcula os atributos se a carta for escolhida.
 */
export function describeOption(
  opt: UpgradeOption,
  loadout: Loadout,
  stats?: Stats,
  statsAfter?: (mods: Modifier[]) => Stats,
): OptionInfo {
  const rarity = RARITIES[opt.rarity];
  switch (opt.kind) {
    case 'weapon': {
      const def = WEAPONS[opt.id];
      const lvl = loadout.weapons[opt.id] ?? 0;
      const to = lvl + rarity.mult;
      if (lvl === 0) {
        const extra = rarity.mult > 1 ? ` Já começa no nível ${to}.` : '';
        return { title: def.name, icon: def.icon, tag: `NOVA · ${rarity.name.toUpperCase()}`, text: def.description + extra };
      }
      // soma os passos de crescimento numa linha só (cartas raras sobem vários níveis)
      const sum: Growth = {};
      let awakens = false;
      for (let l = lvl + 1; l <= to; l++) {
        const g = def.growth[(l - 2) % def.growth.length];
        for (const k of Object.keys(g) as (keyof Growth)[]) sum[k] = (sum[k] ?? 0) + (g[k] ?? 0);
        if (isAwakening(l)) awakens = true;
      }
      const a = weaponStatsAt(def, lvl);
      const b = weaponStatsAt(def, to);
      // mostra os dois atributos da arma que mais mudam
      const diffs: string[] = [];
      if (b.damage > a.damage) diffs.push(`Dano ${formatNumber(a.damage)}>${formatNumber(b.damage)}`);
      if (b.amount > a.amount) diffs.push(`Qtd ${a.amount}>${b.amount}`);
      if (b.cooldown < a.cooldown) diffs.push(`Recarga ${a.cooldown.toFixed(2)}>${b.cooldown.toFixed(2)}s`);
      if (b.area > a.area) diffs.push(`Área ${Math.round(a.area * 100)}>${Math.round(b.area * 100)}%`);
      if (b.pierce > a.pierce) diffs.push(`Perf ${a.pierce}>${b.pierce}`);
      return {
        title: def.name,
        icon: def.icon,
        tag: `NV ${lvl}>${to} · ${rarity.name.toUpperCase()}`,
        text: (awakens ? 'DESPERTAR! ' : '') + describeGrowth(sum),
        change: diffs.slice(0, 2).join('  '),
      };
    }
    case 'stat': {
      const card = cardFor(opt.stat)!;
      const v = card.value * rarity.mult;
      const label = STAT_LABELS[opt.stat];
      const shown = card.display === 'pct' ? `${formatNumber(Math.round(v * 1000) / 10)}%` : formatNumber(Math.round(v * 10) / 10);
      const text = card.mode === 'pct' ? `+${formatNumber(Math.round(v * 100))}% de ${label.toLowerCase()}` : `+${shown} de ${label.toLowerCase()}`;
      let change: string | undefined;
      if (stats && statsAfter) {
        const mod: Modifier = card.mode === 'flat' ? { stat: opt.stat, flat: v } : { stat: opt.stat, pct: v };
        const next = statsAfter([mod]);
        change = `${label}: ${formatStat(opt.stat, stats[opt.stat])} > ${formatStat(opt.stat, next[opt.stat])}`;
      }
      if (opt.stat === 'curse') return { title: card.name, icon: card.icon, tag: rarity.name.toUpperCase(), text: `${text}: mais inimigos e mais recompensas`, change };
      return { title: card.name, icon: card.icon, tag: rarity.name.toUpperCase(), text, change };
    }
    case 'gold':
      return { title: 'Saco de Ouro', icon: 'coin', tag: 'BÔNUS', text: '+25 de ouro' };
    case 'heal':
      return { title: 'Frango Assado', icon: 'heart', tag: 'BÔNUS', text: 'Recupera 40 de vida' };
  }
}
