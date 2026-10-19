import type { CharacterId } from '../data/characters';
import type { MetaId } from '../data/meta';
import type { RunEventId, StageId } from '../data/stages';
import { INFINITE_GOLD, dev } from './dev';

export interface SaveData {
  version: 2;
  gold: number;
  meta: Partial<Record<MetaId, number>>;
  unlocked: CharacterId[];
  selected: CharacterId;
  bestTime: number;
  bestKills: number;
  bestCycle: number;
  victories: number;
  sound: boolean;
  /** fase escolhida no mapa-múndi */
  stage: StageId;
  /** estrelas de cada fase (objetivos 1 a 3); a 1ª é vencer o chefe e libera a próxima fase */
  stars: Partial<Record<StageId, boolean[]>>;
  /** eventos já encontrados em cada fase (o mapa mostra "?" nos que faltam) */
  seen: Partial<Record<StageId, RunEventId[]>>;
}

const KEY = 'survivor-save-v1';

export function defaultSave(): SaveData {
  return {
    version: 2,
    gold: 0,
    meta: {},
    unlocked: ['knight', 'mage'],
    selected: 'knight',
    bestTime: 0,
    bestKills: 0,
    bestCycle: 0,
    victories: 0,
    sound: true,
    stage: 'clareira',
    stars: {},
    seen: {},
  };
}

/** Converte saves antigos (v1) para o formato atual. */
export function migrate(raw: Record<string, unknown>): SaveData {
  const data = { ...defaultSave(), ...raw } as SaveData & { meta: Record<string, number> };
  if (raw.version !== 2) {
    const renames: Record<string, MetaId> = { might: 'power', armor: 'defense', speed: 'moveSpeed', growth: 'wisdom' };
    const meta: Record<string, number> = {};
    for (const [k, v] of Object.entries(data.meta ?? {})) meta[renames[k] ?? k] = v;
    data.meta = meta;
    data.version = 2;
  }
  return data;
}

let cache: SaveData | null = null;

export function loadSave(): SaveData {
  if (cache) {
    if (dev.infiniteGold) cache.gold = INFINITE_GOLD;
    return cache;
  }
  let data = defaultSave();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = migrate(JSON.parse(raw));
  } catch {
    // armazenamento indisponível: segue com o padrão
  }
  if (dev.infiniteGold) data.gold = INFINITE_GOLD;
  cache = data;
  return data;
}

export function writeSave(data: SaveData) {
  cache = data;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // ignora (modo privado etc.)
  }
}

export function resetSaveCache() {
  cache = null;
}
