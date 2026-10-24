// Pets: companheiros que seguem o herói e atacam sozinhos. 6 linhagens (uma por elemento), cada uma com
// 6 estágios: Ovo → Bebê → Criança → Jovem → Adulto → Supremo. Ovos caem de chefes e elites (nunca à
// venda) e chocam com tempo de partida. O pet sobe de nível jogando (ou com ração comprada com ouro),
// mas cada estágio tem um nível máximo: para seguir, precisa evoluir, cumprindo requisitos cada vez
// mais difíceis (missão do elemento, cristais, afinidade, prova do chefe...).
import { getStage, type StageId } from './stages';
import type { Element } from './weapons';

export type PetId = 'fire' | 'water' | 'air' | 'earth' | 'light' | 'dark';

/** Estágio do pet já nascido: 0 Bebê, 1 Criança, 2 Jovem, 3 Adulto, 4 Supremo. */
export type PetStage = 0 | 1 | 2 | 3 | 4;
export const STAGE_NAMES = ['Bebê', 'Criança', 'Jovem', 'Adulto', 'Supremo'] as const;
/** Nível máximo de cada estágio (o Supremo não tem). */
export const STAGE_CAP = [5, 12, 22, 35, Infinity] as const;
/** Força de cada estágio (multiplica o dano). */
export const STAGE_POWER = [0.6, 1, 1.5, 2.2, 3.2] as const;

/** Missão do elemento (para virar Adulto): o que contar e quanto. */
export type MissionStat = 'burnKills' | 'steamIce' | 'pushes' | 'stuns' | 'heal' | 'gems';

export interface PetForm {
  name: string;
  /** arte com os quadros walk_a, walk_b, windup e attack */
  texture: string;
  /** quadros do movimento (o resto do balanço é por código) */
  move?: string[];
  /** o que faz neste estágio */
  skill: string;
}

export interface PetDef {
  id: PetId;
  element: Element;
  /** nome do elemento (Ovo de Fogo, linhagem do Fogo) */
  label: string;
  forms: [PetForm, PetForm, PetForm, PetForm, PetForm];
  egg: string;
  /** fases onde o ovo cai; a primeira é a fase natal (prova do Supremo) */
  stages: StageId[];
  flies: boolean;
  mission: { stat: MissionStat; target: number; text: string };
  /** já tem arte e pode aparecer (os outros aparecem como "?" na coleção) */
  available: boolean;
}

const form = (name: string, texture: string, skill: string, move?: string[]): PetForm => ({ name, texture, skill, move });

export const PETS: PetDef[] = [
  {
    id: 'fire', element: 'fire', label: 'Fogo', egg: 'egg_dragon', stages: ['outono', 'dunas', 'vulcao'], flies: true, available: true,
    mission: { stat: 'burnKills', target: 1000, text: 'Derrotar 1.000 inimigos queimando' },
    forms: [
      form('Brasinha', 'pet_fire_1', 'Cospe faíscas no inimigo mais perto', ['walk_a', 'windup']),
      form('Dragãozinho', 'pet_dragon_1', 'Cospe bolas de fogo'),
      form('Draco', 'pet_dragon_2', 'Bolas de fogo que explodem em área'),
      form('Draco Magma', 'pet_dragon_3', 'Rajada de 3 bolas de fogo e o Sopro de Fogo em leque'),
      form('Rei Solar', 'pet_fire_5', 'Tudo isso e, a cada 30 s, a Chuva Solar: meteoros na tela toda'),
    ],
  },
  {
    id: 'water', element: 'water', label: 'Água', egg: 'egg_turtle', stages: ['pantano'], flies: false, available: true,
    mission: { stat: 'steamIce', target: 500, text: 'Causar 500 reações de Vapor ou Gelo' },
    forms: [
      form('Gotinha', 'pet_water_1', 'Solta bolhas no inimigo mais perto', ['walk_a', 'windup']),
      form('Tartaruguinha', 'pet_water_2', 'Bolas de água que encharcam'),
      form('Casco-Maré', 'pet_water_3', 'Duas bolas de água que espirram em área'),
      form('Leviatã Coral', 'pet_water_4', 'Bolas de água e a Onda, que atravessa e empurra'),
      form('Imperador Abissal', 'pet_water_5', 'Tudo isso e, a cada 30 s, o Maremoto: ondas gigantes cruzam a tela'),
    ],
  },
  {
    id: 'air', element: 'air', label: 'Ar', egg: 'egg_owl', stages: ['pico', 'dunas'], flies: true, available: true,
    mission: { stat: 'pushes', target: 2000, text: 'Empurrar 2.000 inimigos' },
    forms: [
      form('Penugem', 'pet_air_1', 'Sopros de vento que empurram', ['walk_a', 'windup']),
      form('Corujinha', 'pet_air_2', 'Lâminas de vento que empurram forte'),
      form('Gavião-Vento', 'pet_air_3', 'Duas lâminas de vento'),
      form('Grifo Tempestade', 'pet_air_4', 'Três lâminas e o Tornado, que puxa e fere os inimigos'),
      form('Roc Celeste', 'pet_air_5', 'Tudo isso e, a cada 30 s, o Furacão: um tornado gigante atravessa a tela'),
    ],
  },
  {
    id: 'earth', element: 'earth', label: 'Terra', egg: 'egg_golem', stages: ['ruinas', 'pico'], flies: false, available: true,
    mission: { stat: 'stuns', target: 300, text: 'Atordoar 300 inimigos' },
    forms: [
      form('Pedrinha', 'pet_earth_1', 'Atira pedrinhas', ['walk_a', 'windup']),
      form('Golenzinho', 'pet_earth_2', 'Pedras em arco que podem atordoar'),
      form('Golem de Pedra', 'pet_earth_3', 'Pedras maiores que atordoam em área'),
      form('Colosso de Cristal', 'pet_earth_4', 'Duas pedras e a Muralha: espinhos de pedra em volta que atordoam'),
      form('Titã Ancestral', 'pet_earth_5', 'Tudo isso e, a cada 30 s, o Terremoto: espinhos sob todos os inimigos da tela'),
    ],
  },
  {
    id: 'light', element: 'light', label: 'Luz', egg: 'egg_fairy', stages: ['clareira', 'cidadela'], flies: true, available: true,
    mission: { stat: 'heal', target: 5000, text: 'Curar 5.000 de vida' },
    forms: [
      form('Faísca', 'pet_light_1', 'Cura o herói aos poucos e solta faíscas de luz', ['walk_a', 'windup']),
      form('Fadinha', 'pet_light_2', 'Cura mais e dispara orbes de luz'),
      form('Fada da Luz', 'pet_light_3', 'Cura mais e dispara dois orbes'),
      form('Serafina', 'pet_light_4', 'Cura, orbes que explodem em luz e o Escudo de Luz (invulnerável por um instante)'),
      form('Arcanjo Radiante', 'pet_light_5', 'Tudo isso e, a cada 30 s, o Julgamento: raios de luz na tela toda e cura forte'),
    ],
  },
  {
    id: 'dark', element: 'dark', label: 'Sombra', egg: 'egg_cat', stages: ['sombria'], flies: false, available: true,
    mission: { stat: 'gems', target: 3000, text: 'Coletar 3.000 gemas' },
    forms: [
      form('Sombrinha', 'pet_dark_1', 'Avança e arranha o inimigo', ['walk_a', 'windup']),
      form('Gatinho Sombrio', 'pet_dark_2', 'Arranhões mais fortes e puxa as gemas por perto'),
      form('Pantera Noturna', 'pet_dark_3', 'Rouba ouro de cada inimigo que derruba'),
      form('Lobo Eclipse', 'pet_dark_4', 'Dois arranhões, mais ouro e o Frenesi: arranha vários inimigos em volta'),
      form('Senhor do Eclipse', 'pet_dark_5', 'Tudo isso e, a cada 30 s, o Eclipse: a tela escurece e os inimigos sofrem'),
    ],
  },
];

export const getPet = (id: PetId) => PETS.find((p) => p.id === id) ?? PETS[0];
export const eggName = (id: PetId) => `Ovo de ${getPet(id).label}`;

/** XP para passar do nível `level` ao próximo. */
export const petXpToNext = (level: number) => Math.round(50 * Math.pow(1.12, level - 1));

/** Força do pet: nível × estágio × ascensão (Supremo+N: +25% cada). */
export const petPower = (level: number, stage: PetStage, plus = 0) => (1 + 0.12 * (level - 1)) * STAGE_POWER[stage] * (1 + 0.25 * plus);

/** Nome do estágio, com a ascensão depois do Supremo (Supremo+1, Supremo+2...). */
export const stageLabel = (stage: PetStage, plus = 0) => (plus > 0 ? `${STAGE_NAMES[stage]}+${plus}` : STAGE_NAMES[stage]);

/** XP de uma partida: por minuto, por chefe e pela vitória. */
export const runPetXp = (seconds: number, bosses: number, victory: boolean) =>
  Math.round((seconds / 60) * 10 + bosses * 25 + (victory ? 50 : 0));

/** Ração: compra com ouro um quarto do próximo nível (preço sobe com o nível). */
export const feedXp = (level: number) => Math.ceil(petXpToNext(level) / 4);
export const feedCost = (level: number) => Math.round(40 * Math.pow(1.15, level - 1));

/** Afinidade: um coração a cada 3 partidas juntos, até 10. */
export const AFFINITY_RUNS = 3;
export const MAX_HEARTS = 10;
export const hearts = (runs: number) => Math.min(MAX_HEARTS, Math.floor(runs / AFFINITY_RUNS));

/** Tempo de partida para chocar (o primeiro ovo choca rápido, para o jogador conhecer logo os pets). */
export const HATCH_SECONDS = 15 * 60;
export const FIRST_HATCH_SECONDS = 3 * 60;
/** Ovo de um pet que o jogador já tem: vira XP para ele. */
export const DUPLICATE_EGG_XP = 400;
export const MAX_EGGS = 6;

/** Chance de ovo no fim da partida: por chefe, pela vitória e por elite derrotado. */
export function eggChance(bosses: number, victory: boolean, elites: number) {
  return Math.min(0.9, bosses * 0.2 + (victory ? 0.3 : 0) + elites * 0.02);
}

/** Cristal de Evolução (Jovem → Adulto): chance por chefe vencido no Difícil ou acima. Fragmento Ancestral: no Pesadelo ou acima. */
export const CRYSTAL_CHANCE = 0.25;
export const SHARD_CHANCE = 0.3;
export const CRYSTAL_TIER = 1;
export const SHARD_TIER = 3;
/** Prova do Supremo: vencer o chefe final da fase natal nesta dificuldade (Muito Difícil). */
export const TRIAL_TIER = 2;

/** Pet do ovo: um dos que caem nesta fase; se nenhum couber, qualquer um disponível. */
export function rollEggPet(stage: StageId, rnd: () => number = Math.random): PetId | undefined {
  const pool = PETS.filter((p) => p.available);
  if (!pool.length) return undefined;
  const local = pool.filter((p) => p.stages.includes(stage));
  const list = local.length ? local : pool;
  return list[Math.floor(rnd() * list.length)].id;
}

// ---------- Evolução ----------

export type ReqKind = 'level' | 'feeds' | 'kills' | 'bossWins' | 'mission' | 'crystals' | 'hearts' | 'trial' | 'shards';
export interface Requirement {
  kind: ReqKind;
  target: number;
  text: string;
}

/**
 * Ascensão do Supremo (sem fim): Supremo+1, +2... Cada uma pede mais nível, mais abates com ele e
 * Fragmentos Ancestrais, e dá +25% de força e uma aura maior.
 */
export function ascendRequirements(plus: number): Requirement[] {
  return [
    { kind: 'level', target: 40 + 5 * plus, text: `Chegar ao nível ${40 + 5 * plus}` },
    { kind: 'kills', target: 1000 * (plus + 1), text: `Derrotar ${(1000 * (plus + 1)).toLocaleString('pt-BR')} inimigos com ele` },
    { kind: 'shards', target: 1 + Math.floor(plus / 2), text: `${1 + Math.floor(plus / 2)} Fragmento${plus >= 2 ? 's' : ''} Ancestra${plus >= 2 ? 'is' : 'l'} (chefes no Pesadelo)` },
  ];
}

/** Requisitos do próximo passo: evoluir (até o Supremo) ou ascender (depois dele). */
export const nextRequirements = (def: PetDef, stage: PetStage, plus = 0) => (stage < 4 ? evoRequirements(def, stage) : ascendRequirements(plus));

/** Requisitos para evoluir do estágio `stage` para o seguinte (vazio no Supremo). */
export function evoRequirements(def: PetDef, stage: PetStage): Requirement[] {
  const home = def.stages[0];
  switch (stage) {
    case 0:
      return [{ kind: 'level', target: 5, text: 'Chegar ao nível 5' }, { kind: 'feeds', target: 3, text: 'Comer 3 rações' }];
    case 1:
      return [
        { kind: 'level', target: 12, text: 'Chegar ao nível 12' },
        { kind: 'kills', target: 300, text: 'Derrotar 300 inimigos' },
        { kind: 'bossWins', target: 1, text: 'Vencer um chefe com ele na partida' },
      ];
    case 2:
      return [
        { kind: 'level', target: 22, text: 'Chegar ao nível 22' },
        { kind: 'mission', target: def.mission.target, text: def.mission.text },
        { kind: 'crystals', target: 1, text: '1 Cristal de Evolução (chefes no Difícil ou acima)' },
      ];
    case 3:
      return [
        { kind: 'level', target: 35, text: 'Chegar ao nível 35' },
        { kind: 'hearts', target: MAX_HEARTS, text: 'Afinidade máxima (10 corações)' },
        { kind: 'trial', target: 1, text: `Vencer o chefe final de ${getStage(home).name} no Muito Difícil com ele` },
        { kind: 'shards', target: 3, text: '3 Fragmentos Ancestrais (chefes no Pesadelo)' },
      ];
    default:
      return [];
  }
}
