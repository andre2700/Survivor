// Pets no save: ovos na chocadeira (o primeiro choca com o tempo de partida), chocar, XP (com o teto
// do estágio), ração, contadores para os requisitos, evoluir e o pet ativo.
import {
  DUPLICATE_EGG_XP, FIRST_HATCH_SECONDS, HATCH_SECONDS, MAX_EGGS, STAGE_CAP, evoRequirements, feedCost, feedXp, getPet, hearts,
  petXpToNext, type MissionStat, type PetId, type PetStage, type Requirement,
} from '../data/pets';
import type { SaveData } from './save';

export interface PetState {
  stage: PetStage;
  level: number;
  xp: number;
  /** contadores dos requisitos (desde que nasceu) */
  feeds: number;
  kills: number;
  bossWins: number;
  /** partidas juntos (afinidade) */
  runs: number;
  /** venceu a prova do Mega */
  trial: boolean;
  mission: Partial<Record<MissionStat, number>>;
}

export interface Egg {
  uid: number;
  pet: PetId;
  /** segundos de partida para chocar, e quanto já chocou */
  need: number;
  progress: number;
}

export const newPet = (): PetState => ({ stage: 0, level: 1, xp: 0, feeds: 0, kills: 0, bossWins: 0, runs: 0, trial: false, mission: {} });

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
  if (save.pets[pet]) return { pet, isNew: false, levels: addPetXp(save, pet, DUPLICATE_EGG_XP) };
  save.pets[pet] = newPet();
  save.activePet ??= pet;
  return { pet, isNew: true, levels: 0 };
}

/** Nível máximo do estágio atual: o XP para de subir até evoluir. */
export const atCap = (p: PetState) => p.level >= STAGE_CAP[p.stage];

/** Soma XP ao pet (até o teto do estágio); devolve quantos níveis subiu. */
export function addPetXp(save: SaveData, pet: PetId, xp: number): number {
  const p = save.pets[pet];
  if (!p) return 0;
  let up = 0;
  p.xp += xp;
  while (!atCap(p) && p.xp >= petXpToNext(p.level)) {
    p.xp -= petXpToNext(p.level);
    p.level++;
    up++;
  }
  if (atCap(p)) p.xp = 0;
  return up;
}

/** Dá ração ao pet (custa ouro). Conta para o requisito do Bebê mesmo no teto. */
export function feed(save: SaveData, pet: PetId): boolean {
  const p = save.pets[pet];
  if (!p || save.gold < feedCost(p.level)) return false;
  save.gold -= feedCost(p.level);
  p.feeds++;
  addPetXp(save, pet, feedXp(p.level));
  return true;
}

/** Quanto do requisito já foi feito. */
export function reqProgress(save: SaveData, pet: PetId, r: Requirement): number {
  const p = save.pets[pet];
  if (!p) return 0;
  switch (r.kind) {
    case 'level': return p.level;
    case 'feeds': return p.feeds;
    case 'kills': return p.kills;
    case 'bossWins': return p.bossWins;
    case 'mission': return p.mission[getPet(pet).mission.stat] ?? 0;
    case 'crystals': return save.evoCrystals;
    case 'hearts': return hearts(p.runs);
    case 'trial': return p.trial ? 1 : 0;
    case 'shards': return save.ancientShards;
  }
}

export function canEvolve(save: SaveData, pet: PetId): boolean {
  const p = save.pets[pet];
  if (!p || p.stage >= 4) return false;
  return evoRequirements(getPet(pet), p.stage).every((r) => reqProgress(save, pet, r) >= r.target);
}

/** Evolui: gasta cristais e fragmentos pedidos, sobe o estágio (o nível continua). */
export function evolve(save: SaveData, pet: PetId): boolean {
  if (!canEvolve(save, pet)) return false;
  const p = save.pets[pet]!;
  for (const r of evoRequirements(getPet(pet), p.stage)) {
    if (r.kind === 'crystals') save.evoCrystals -= r.target;
    if (r.kind === 'shards') save.ancientShards -= r.target;
  }
  p.stage = (p.stage + 1) as PetStage;
  return true;
}

export const activePet = (save: SaveData) => (save.activePet && save.pets[save.activePet] ? { id: save.activePet, ...save.pets[save.activePet]! } : undefined);

/** Converte pets do formato antigo (3 estágios, id 'dragon'). */
export function migratePets(save: SaveData) {
  const raw = save.pets as Record<string, Partial<PetState> | undefined>;
  if (raw.dragon) {
    const old = raw.dragon;
    delete raw.dragon;
    raw.fire = { ...newPet(), stage: 1, level: Math.min(old.level ?? 1, STAGE_CAP[1]) };
    if ((save.activePet as string) === 'dragon') save.activePet = 'fire';
  }
  for (const [id, p] of Object.entries(raw)) if (p) raw[id] = { ...newPet(), ...p };
  for (const e of save.eggs) if ((e.pet as string) === 'dragon') e.pet = 'fire';
}
