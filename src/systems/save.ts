import type { CharacterId } from '../data/characters';
import type { MetaId } from '../data/meta';

export interface SaveData {
  gold: number;
  meta: Partial<Record<MetaId, number>>;
  unlocked: CharacterId[];
  selected: CharacterId;
  bestTime: number;
  bestKills: number;
  victories: number;
  sound: boolean;
}

const KEY = 'survivor-save-v1';

export function defaultSave(): SaveData {
  return {
    gold: 0,
    meta: {},
    unlocked: ['knight', 'mage'],
    selected: 'knight',
    bestTime: 0,
    bestKills: 0,
    victories: 0,
    sound: true,
  };
}

let cache: SaveData | null = null;

export function loadSave(): SaveData {
  if (cache) return cache;
  let data = defaultSave();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = { ...data, ...JSON.parse(raw) };
  } catch {
    // armazenamento indisponível: segue com o padrão
  }
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
