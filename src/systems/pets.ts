// Pets no save: ovos na chocadeira (o primeiro choca com o tempo de partida), chocar, XP, ração e o
// pet ativo.
import {
  DUPLICATE_EGG_XP, FIRST_HATCH_SECONDS, HATCH_SECONDS, MAX_EGGS, feedCost, feedXp, petStage, petXpToNext, type PetId,
} from '../data/pets';
import type { SaveData } from './save';

export interface PetState {
  level: number;
  xp: number;
}

export interface Egg {
  uid: number;
  pet: PetId;
  /** segundos de partida para chocar, e quanto já chocou */
  need: number;
  progress: number;
}

/** Guarda um ovo novo (o primeiro da vida choca rápido). Devolve false se a chocadeira estiver cheia. */
export function addEgg(save: SaveData, pet: PetId): boolean {
  if (save.eggs.length >= MAX_EGGS) return false;
  const first = !save.eggSeen;
  save.eggSeen = true;
  save.eggs.push({ uid: save.nextItem++, pet, need: first ? FIRST_HATCH_SECONDS : HATCH_SECONDS, progress: 0 });
  return true;
}

/** Tempo de partida choca o ovo da vez (o primeiro da fila). */
export function incubate(save: SaveData, seconds: number) {
  const egg = save.eggs[0];
  if (egg) egg.progress = Math.min(egg.need, egg.progress + seconds);
}

export const eggReady = (e: Egg) => e.progress >= e.need;

/** Choca o ovo pronto: pet novo (vira o ativo se não houver), ou XP se já tiver esse pet. */
export function hatch(save: SaveData, uid: number): { pet: PetId; isNew: boolean; levels: number } | undefined {
  const i = save.eggs.findIndex((e) => e.uid === uid);
  if (i < 0 || !eggReady(save.eggs[i])) return undefined;
  const { pet } = save.eggs[i];
  save.eggs.splice(i, 1);
  const have = save.pets[pet];
  if (have) return { pet, isNew: false, levels: addPetXp(save, pet, DUPLICATE_EGG_XP) };
  save.pets[pet] = { level: 1, xp: 0 };
  save.activePet ??= pet;
  return { pet, isNew: true, levels: 0 };
}

/** Soma XP ao pet; devolve quantos níveis subiu. */
export function addPetXp(save: SaveData, pet: PetId, xp: number): number {
  const p = save.pets[pet];
  if (!p) return 0;
  p.xp += xp;
  let up = 0;
  while (p.xp >= petXpToNext(p.level)) {
    p.xp -= petXpToNext(p.level);
    p.level++;
    up++;
  }
  return up;
}

/** Dá ração ao pet (custa ouro). */
export function feed(save: SaveData, pet: PetId): boolean {
  const p = save.pets[pet];
  if (!p || save.gold < feedCost(p.level)) return false;
  save.gold -= feedCost(p.level);
  addPetXp(save, pet, feedXp(p.level));
  return true;
}

export const activePet = (save: SaveData) => (save.activePet && save.pets[save.activePet] ? { id: save.activePet, ...save.pets[save.activePet]! } : undefined);

export const petStageOf = (save: SaveData, pet: PetId) => petStage(save.pets[pet]?.level ?? 1);
