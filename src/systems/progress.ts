// Contadores da vida toda, missões diárias e conquistas: o que a partida soma, o que já dá para
// resgatar e o resgate (ouro, pó, cristais, fragmentos e o Baú Diário).
import { EFFECT_RARITY, dropLevel, makeItem, rollRarity, type ItemInstance } from '../data/items';
import { ACHIEVEMENTS, DAILY_COUNT, dailyFor, dailyReward, today, type AchievementDef, type LifeStat, type Reward, type RunStat } from '../data/missions';
import { STAGES } from '../data/stages';
import { addItems, nextUid } from './inventory';
import type { SaveData } from './save';

export interface DailyState {
  day: string;
  progress: Partial<Record<RunStat, number>>;
  claimed: boolean[];
  bonus: boolean;
}

/** Soma num contador da vida toda (forja, evolução e choca chamam fora da partida). */
export function bump(save: SaveData, stat: LifeStat, n = 1) {
  save.life[stat] = (save.life[stat] ?? 0) + n;
}

/** Missões de hoje (troca o dia à meia-noite e zera o progresso). */
export function daily(save: SaveData): DailyState {
  const day = today();
  if (save.daily?.day !== day) save.daily = { day, progress: {}, claimed: Array(DAILY_COUNT).fill(false), bonus: false };
  return save.daily;
}

/** Soma o que a partida fez nas diárias e na vida toda. */
export function recordRun(save: SaveData, run: Partial<Record<RunStat, number>>) {
  const d = daily(save);
  for (const [k, v] of Object.entries(run) as [RunStat, number][]) {
    if (!v) continue;
    d.progress[k] = (d.progress[k] ?? 0) + v;
    bump(save, k, v);
  }
}

/** Fases vencidas (chefe final no Normal) e a maior dificuldade vencida em alguma fase. */
export function stagesCleared(save: SaveData) {
  return STAGES.filter((s) => save.tiers[s.id]?.[0]?.stars[0]).length;
}

export function maxTierCleared(save: SaveData) {
  let best = -1;
  for (const s of STAGES) (save.tiers[s.id] ?? []).forEach((t, i) => {
    if (t?.stars[0]) best = Math.max(best, i);
  });
  return best;
}

export function achievementValue(save: SaveData, a: AchievementDef) {
  if (a.stat === 'stagesCleared') return stagesCleared(save);
  if (a.stat === 'maxTier') return maxTierCleared(save);
  return save.life[a.stat] ?? 0;
}

/** Nível de conquista já resgatado e o próximo (ou undefined se completou todos). */
export function achievementNext(save: SaveData, a: AchievementDef) {
  const done = save.achieved[a.id] ?? 0;
  return { done, next: a.tiers[done] };
}

export const achievementReady = (save: SaveData, a: AchievementDef) => {
  const { next } = achievementNext(save, a);
  return !!next && achievementValue(save, a) >= next.target;
};

export function giveReward(save: SaveData, r: Reward) {
  save.gold += r.gold ?? 0;
  save.dust += r.dust ?? 0;
  save.evoCrystals += r.crystals ?? 0;
  save.ancientShards += r.shards ?? 0;
}

export function claimAchievement(save: SaveData, a: AchievementDef): Reward | undefined {
  if (!achievementReady(save, a)) return undefined;
  const { done, next } = achievementNext(save, a);
  save.achieved[a.id] = done + 1;
  giveReward(save, next!.reward);
  return next!.reward;
}

export const dailyDone = (save: SaveData, i: number) => {
  const d = daily(save);
  const m = dailyFor(d.day)[i];
  return (d.progress[m.stat] ?? 0) >= m.target;
};

export function claimDaily(save: SaveData, i: number): Reward | undefined {
  const d = daily(save);
  if (d.claimed[i] || !dailyDone(save, i)) return undefined;
  d.claimed[i] = true;
  const r = dailyReward(stagesCleared(save));
  giveReward(save, r);
  return r;
}

/** Baú Diário: com as 3 diárias resgatadas, um item Raro ou melhor e pó. */
export function claimDailyBonus(save: SaveData): ItemInstance | undefined {
  const d = daily(save);
  if (d.bonus || !d.claimed.every(Boolean)) return undefined;
  d.bonus = true;
  const it = makeItem(nextUid(save), rollRarity(0, 0.3, EFFECT_RARITY), dropLevel(stagesCleared(save), 0));
  addItems(save, [it]);
  save.dust += 40;
  save.newItems = (save.newItems ?? 0) + 1;
  return it;
}

/** Quantas recompensas estão esperando (selo no menu). */
export function pendingRewards(save: SaveData) {
  const d = daily(save);
  let n = dailyFor(d.day).filter((_, i) => !d.claimed[i] && dailyDone(save, i)).length;
  if (!d.bonus && d.claimed.every(Boolean)) n++;
  return n + ACHIEVEMENTS.filter((a) => achievementReady(save, a)).length;
}
