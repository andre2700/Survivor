// Pets: companheiros que seguem o herói e atacam sozinhos. Nascem de ovos (caem de chefes e elites,
// nunca à venda), chocam com tempo de partida, sobem de nível jogando (ou comendo ração comprada com
// ouro) e evoluem em 3 estágios: filhote, jovem (nível 10) e adulto (nível 20, com habilidade especial).
import type { StageId } from './stages';
import type { Element } from './weapons';

export type PetId = 'dragon' | 'turtle' | 'owl' | 'golem' | 'fairy' | 'cat';

export interface PetDef {
  id: PetId;
  name: string;
  element: Element;
  /** arte de cada estágio (filhote, jovem, adulto) e do ovo */
  textures: [string, string, string];
  egg: string;
  /** fases onde o ovo dele cai (fora delas, só se nenhum outro pet couber) */
  stages: StageId[];
  /** voa (flutua acima do chão) ou anda (pulinhos) */
  flies: boolean;
  /** o que cada estágio faz */
  skills: [string, string, string];
  /** já tem arte e pode aparecer (os outros aparecem como "?" na coleção) */
  available: boolean;
}

export const PETS: PetDef[] = [
  {
    id: 'dragon', name: 'Dragãozinho', element: 'fire', textures: ['pet_dragon_1', 'pet_dragon_2', 'pet_dragon_3'], egg: 'egg_dragon',
    stages: ['outono', 'dunas', 'vulcao'], flies: true, available: true,
    skills: ['Cospe uma bola de fogo no inimigo mais perto', 'Cospe duas bolas de fogo, mais fortes', 'Três bolas de fogo e, de tempos em tempos, um sopro de fogo em leque'],
  },
  {
    id: 'turtle', name: 'Tartaruga das Marés', element: 'water', textures: ['pet_turtle_1', 'pet_turtle_2', 'pet_turtle_3'], egg: 'egg_turtle',
    stages: ['pantano'], flies: false, available: false,
    skills: ['Jatos de água que encharcam', 'Jatos mais fortes e rápidos', 'Onda em volta do herói'],
  },
  {
    id: 'owl', name: 'Corujinha do Vento', element: 'air', textures: ['pet_owl_1', 'pet_owl_2', 'pet_owl_3'], egg: 'egg_owl',
    stages: ['pico', 'dunas'], flies: true, available: false,
    skills: ['Rajadas que empurram', 'Rajadas duplas', 'Tornado que puxa os inimigos'],
  },
  {
    id: 'golem', name: 'Golem de Pedra', element: 'earth', textures: ['pet_golem_1', 'pet_golem_2', 'pet_golem_3'], egg: 'egg_golem',
    stages: ['ruinas', 'pico'], flies: false, available: false,
    skills: ['Soco que atordoa', 'Socos mais fortes', 'Atrai os inimigos e protege o herói'],
  },
  {
    id: 'fairy', name: 'Fada da Luz', element: 'light', textures: ['pet_fairy_1', 'pet_fairy_2', 'pet_fairy_3'], egg: 'egg_fairy',
    stages: ['clareira', 'cidadela'], flies: true, available: false,
    skills: ['Cura o herói aos poucos', 'Cura mais e dispara luz', 'Escudo de luz'],
  },
  {
    id: 'cat', name: 'Gatinho Sombrio', element: 'dark', textures: ['pet_cat_1', 'pet_cat_2', 'pet_cat_3'], egg: 'egg_cat',
    stages: ['sombria'], flies: false, available: false,
    skills: ['Arranha e coleta gemas', 'Arranhões mais fortes', 'Rouba ouro dos inimigos'],
  },
];

export const getPet = (id: PetId) => PETS.find((p) => p.id === id)!;

/** Nível em que cada estágio começa. */
export const PET_STAGE_LEVELS = [1, 10, 20] as const;
export const STAGE_NAMES = ['Filhote', 'Jovem', 'Adulto'] as const;

export function petStage(level: number): 0 | 1 | 2 {
  return level >= PET_STAGE_LEVELS[2] ? 2 : level >= PET_STAGE_LEVELS[1] ? 1 : 0;
}

/** XP para passar do nível `level` ao próximo (sem nível máximo). */
export const petXpToNext = (level: number) => Math.round(60 * Math.pow(1.18, level - 1));

/** Força do pet pelo nível (o estágio soma por cima). */
export const petPower = (level: number) => (1 + 0.15 * (level - 1)) * [1, 1.4, 1.9][petStage(level)];

/** XP de uma partida: por minuto, por chefe e pela vitória. */
export const runPetXp = (seconds: number, bosses: number, victory: boolean) =>
  Math.round((seconds / 60) * 10 + bosses * 25 + (victory ? 50 : 0));

/** Ração: compra com ouro um quarto do próximo nível (preço sobe com o nível). */
export const feedXp = (level: number) => Math.ceil(petXpToNext(level) / 4);
export const feedCost = (level: number) => Math.round(40 * Math.pow(1.2, level - 1));

/** Tempo de partida para chocar (o primeiro ovo choca rápido, para o jogador conhecer logo os pets). */
export const HATCH_SECONDS = 20 * 60;
export const FIRST_HATCH_SECONDS = 3 * 60;
/** Ovo de um pet que o jogador já tem: vira XP para ele. */
export const DUPLICATE_EGG_XP = 400;
export const MAX_EGGS = 6;

/** Chance de ovo no fim da partida: por chefe, pela vitória e por elite derrotado. */
export function eggChance(bosses: number, victory: boolean, elites: number) {
  return Math.min(0.9, bosses * 0.2 + (victory ? 0.3 : 0) + elites * 0.02);
}

/** Pet do ovo: um dos que caem nesta fase; se nenhum couber, qualquer um disponível. */
export function rollEggPet(stage: StageId, rnd: () => number = Math.random): PetId | undefined {
  const pool = PETS.filter((p) => p.available);
  if (!pool.length) return undefined;
  const local = pool.filter((p) => p.stages.includes(stage));
  const list = local.length ? local : pool;
  return list[Math.floor(rnd() * list.length)].id;
}
