// Fases do mundo (Marco 3, ver docs/GDD.md). Cada fase tem aparência, ondas, chefe, eventos e três
// objetivos (estrelas). As primeiras são coloridas e leves; o mundo fica mais sombrio e épico.
import type { TierProgress } from './difficulty';
import type { EnemyId } from './enemies';
import { WAVES, type Wave } from './waves';

export type StageId = 'clareira' | 'outono' | 'pantano' | 'dunas' | 'sombria' | 'pico' | 'vulcao' | 'ruinas' | 'cidadela';

export type Mood = 'leve' | 'sério' | 'sombrio' | 'épico';

/** Eventos aleatórios que podem acontecer na fase (ver systems/events.ts). */
export type RunEventId = 'chest' | 'captive' | 'surpriseBoss' | 'goldenGoblin' | 'meteors' | 'ambush' | 'tribeWar' | 'sandstorm'
  | 'blizzard' | 'avalanche'
  | 'cursedShrine' | 'bloodMoon';

/** Tribo da guerra de tribos: nome no anúncio e criaturas dela. */
export interface Tribe {
  name: string;
  pool: EnemyId[];
}

/** Objetivo de estrela: vencer o chefe, completar um evento ou um desafio. */
export type Objective =
  | { kind: 'boss'; text: string }
  | { kind: 'event'; event: RunEventId; text: string }
  | { kind: 'hp'; min: number; text: string }
  | { kind: 'kills'; n: number; text: string };

export interface StageDef {
  id: StageId;
  name: string;
  /** frase curta no menu */
  subtitle: string;
  mood: Mood;
  /** elementos dominantes (texto do menu) */
  elements: string;
  /** a arte do bioma já existe (as outras aparecem como "em breve") */
  playable: boolean;
  /** tom do chão e da decoração (multiplica as cores da arte) */
  tint: { ground: number; decor: number; sky: string };
  /** chance relativa de cada decoração (nomes da arte; árvores e troncos ficam de pé, o resto rente ao chão) */
  decor: Record<string, number>;
  /** decoração alta (passa na frente do herói quando ele está atrás) */
  tall?: string[];
  /** manchas no chão (decalques), sorteadas por trecho do mapa */
  patches?: string[];
  /** criatura dourada do evento de tesouro (foge com ouro; padrão: a primeira criatura da fase) */
  golden?: EnemyId;
  /** decoração que ataca quem chega perto (as árvores secas da Floresta Sombria) */
  angry?: string[];
  /** as duas tribos da guerra de tribos (padrão: goblins contra esqueletos) */
  tribes?: [Tribe, Tribe];
  /** textura do chão (padrão: grama da floresta) */
  ground?: string;
  /**
   * perigo do mapa: névoa que esconde a borda da tela, escuridão (só a área em volta do herói fica
   * clara) ou gelo (placas de gelo onde o herói escorrega)
   */
  hazard?: 'fog' | 'dark' | 'ice';
  /** criatura das revoadas (padrão: morcego) e do cerco (padrão: esqueleto, orc mais tarde) */
  swarm?: EnemyId;
  ring?: [EnemyId, EnemyId];
  waves: Wave[];
  /** os três chefes da fase: início (5 min), meio (10 min) e final (15 min, com fase 2) */
  bosses: [EnemyId, EnemyId, EnemyId];
  /**
   * Força da fase (ver stageScaling): sobe bem de uma fase para a outra, acompanhando as melhorias
   * que o jogador comprou na fase anterior, para que toda fase nova volte a ser um desafio.
   */
  difficulty: number;
  events: RunEventId[];
  objectives: [Objective, Objective, Objective];
  /** cor do ponto da fase no mapa-múndi */
  color: number;
}

const FOREST_DECOR = { tree: 7, tree2: 3, bush: 10, rock: 10, stump: 4, flowers: 18, mushroom: 8, tallgrass: 40 };

/** Bosque Outonal: a floresta do começo, agora com cuspidores, conjuradores e explosivos. */
const AUTUMN_WAVES: Wave[] = [
  { minute: 0, pool: ['slime_fire', 'goblin_earth'], rate: 1.6, max: 40 },
  { minute: 1, pool: ['goblin_earth', 'slime_spit'], rate: 2.2, max: 55 },
  { minute: 2, pool: ['goblin_earth', 'slime_bomb', 'slime_fire'], rate: 2.8, max: 70 },
  { minute: 3, pool: ['bat_air', 'slime_spit', 'goblin_earth'], rate: 3.2, max: 90, event: 'swarm' },
  { minute: 4, pool: ['slime_magma', 'slime_bomb', 'goblin_earth', 'slime_fire'], rate: 3.6, max: 110 },
  { minute: 5, pool: ['orc', 'slime_spit', 'goblin_earth', 'slime_fire'], rate: 4.2, max: 130 },
  { minute: 6, pool: ['orc', 'slime_magma', 'goblin_earth', 'slime_bomb'], rate: 4.7, max: 150, event: 'ring' },
  { minute: 7, pool: ['bat_air', 'orc', 'slime_spit', 'slime_magma'], rate: 5.2, max: 170, event: 'swarm' },
  { minute: 8, pool: ['orc', 'slime_bomb', 'goblin_earth'], rate: 5.8, max: 190, event: 'ring' },
  { minute: 9, pool: ['bat_air', 'orc', 'slime_magma', 'slime_spit', 'goblin_earth'], rate: 6.4, max: 210, event: 'swarm' },
  { minute: 10, pool: ['orc', 'slime_bomb', 'slime_fire'], rate: 6.8, max: 230 },
  { minute: 11, pool: ['orc', 'slime_magma', 'goblin_earth'], rate: 7.3, max: 250, event: 'ring' },
  { minute: 12, pool: ['bat_air', 'orc', 'slime_spit', 'slime_bomb', 'slime_fire'], rate: 7.8, max: 270, event: 'swarm' },
  { minute: 13, pool: ['orc', 'slime_magma', 'goblin_earth'], rate: 8.3, max: 290, event: 'ring' },
  { minute: 14, pool: ['goblin_earth', 'orc', 'slime_magma', 'slime_spit', 'slime_bomb'], rate: 9.2, max: 310, event: 'swarm' },
];

/** Pântano Enevoado: sapos, jacarés com bote, mosquitos, cogumelos que atiram esporos e xamãs. */
const SWAMP_WAVES: Wave[] = [
  { minute: 0, pool: ['frog', 'mosquito'], rate: 1.6, max: 40 },
  { minute: 1, pool: ['frog', 'sporeshroom'], rate: 2.2, max: 55 },
  { minute: 2, pool: ['frog', 'croc', 'mosquito'], rate: 2.8, max: 70 },
  { minute: 3, pool: ['sporeshroom', 'croc', 'mosquito'], rate: 3.2, max: 90, event: 'swarm' },
  { minute: 4, pool: ['frog', 'frog_shaman', 'croc', 'mosquito'], rate: 3.6, max: 110 },
  { minute: 5, pool: ['croc', 'sporeshroom', 'frog_shaman'], rate: 4.2, max: 130 },
  { minute: 6, pool: ['frog', 'croc', 'frog_shaman', 'sporeshroom'], rate: 4.7, max: 150, event: 'ring' },
  { minute: 7, pool: ['mosquito', 'croc', 'sporeshroom', 'frog_shaman'], rate: 5.2, max: 170, event: 'swarm' },
  { minute: 8, pool: ['croc', 'frog', 'sporeshroom'], rate: 5.8, max: 190, event: 'ring' },
  { minute: 9, pool: ['frog', 'croc', 'frog_shaman', 'sporeshroom', 'mosquito'], rate: 6.4, max: 210, event: 'swarm' },
  { minute: 10, pool: ['croc', 'frog_shaman', 'frog'], rate: 6.8, max: 230 },
  { minute: 11, pool: ['croc', 'sporeshroom', 'frog_shaman'], rate: 7.3, max: 250, event: 'ring' },
  { minute: 12, pool: ['mosquito', 'croc', 'frog_shaman', 'sporeshroom'], rate: 7.8, max: 270, event: 'swarm' },
  { minute: 13, pool: ['croc', 'frog', 'frog_shaman'], rate: 8.3, max: 290, event: 'ring' },
  { minute: 14, pool: ['frog', 'croc', 'frog_shaman', 'sporeshroom', 'mosquito'], rate: 9.2, max: 310, event: 'swarm' },
];

/** Dunas Escaldantes: escorpiões, abutres, cactos atiradores, vermes que se enterram e xamãs do vento. */
const DUNES_WAVES: Wave[] = [
  { minute: 0, pool: ['scorpion', 'vulture'], rate: 1.6, max: 40 },
  { minute: 1, pool: ['scorpion', 'cactus_spitter'], rate: 2.2, max: 55 },
  { minute: 2, pool: ['scorpion', 'vulture', 'sandworm'], rate: 2.8, max: 70 },
  { minute: 3, pool: ['cactus_spitter', 'sandworm', 'vulture'], rate: 3.2, max: 90, event: 'swarm' },
  { minute: 4, pool: ['scorpion', 'lizard_shaman', 'sandworm', 'vulture'], rate: 3.6, max: 110 },
  { minute: 5, pool: ['sandworm', 'cactus_spitter', 'lizard_shaman'], rate: 4.2, max: 130 },
  { minute: 6, pool: ['scorpion', 'sandworm', 'lizard_shaman', 'vulture'], rate: 4.7, max: 150, event: 'ring' },
  { minute: 7, pool: ['vulture', 'sandworm', 'cactus_spitter', 'lizard_shaman'], rate: 5.2, max: 170, event: 'swarm' },
  { minute: 8, pool: ['sandworm', 'scorpion', 'cactus_spitter'], rate: 5.8, max: 190, event: 'ring' },
  { minute: 9, pool: ['scorpion', 'sandworm', 'lizard_shaman', 'cactus_spitter', 'vulture'], rate: 6.4, max: 210, event: 'swarm' },
  { minute: 10, pool: ['sandworm', 'scorpion', 'lizard_shaman'], rate: 6.8, max: 230 },
  { minute: 11, pool: ['sandworm', 'cactus_spitter', 'lizard_shaman'], rate: 7.3, max: 250, event: 'ring' },
  { minute: 12, pool: ['vulture', 'sandworm', 'lizard_shaman', 'cactus_spitter'], rate: 7.8, max: 270, event: 'swarm' },
  { minute: 13, pool: ['sandworm', 'scorpion', 'lizard_shaman'], rate: 8.3, max: 290, event: 'ring' },
  { minute: 14, pool: ['scorpion', 'sandworm', 'lizard_shaman', 'cactus_spitter', 'vulture'], rate: 9.2, max: 310, event: 'swarm' },
];

/** Floresta Sombria: lobisomens com bote, fogos-fátuos, aranhas que prendem com teia e bruxas do raio. */
const DARK_WAVES: Wave[] = [
  { minute: 0, pool: ['wisp', 'skeleton'], rate: 1.6, max: 40 },
  { minute: 1, pool: ['wisp', 'spider'], rate: 2.2, max: 55 },
  { minute: 2, pool: ['spider', 'werewolf', 'skeleton'], rate: 2.8, max: 70 },
  { minute: 3, pool: ['wisp', 'werewolf', 'spider'], rate: 3.2, max: 90, event: 'swarm' },
  { minute: 4, pool: ['skeleton', 'witch', 'spider', 'werewolf'], rate: 3.6, max: 110 },
  { minute: 5, pool: ['werewolf', 'witch', 'spider'], rate: 4.2, max: 130 },
  { minute: 6, pool: ['skeleton', 'werewolf', 'witch', 'wisp'], rate: 4.7, max: 150, event: 'ring' },
  { minute: 7, pool: ['wisp', 'spider', 'witch', 'werewolf'], rate: 5.2, max: 170, event: 'swarm' },
  { minute: 8, pool: ['werewolf', 'skeleton', 'spider'], rate: 5.8, max: 190, event: 'ring' },
  { minute: 9, pool: ['werewolf', 'witch', 'spider', 'skeleton', 'wisp'], rate: 6.4, max: 210, event: 'swarm' },
  { minute: 10, pool: ['werewolf', 'skeleton', 'witch'], rate: 6.8, max: 230 },
  { minute: 11, pool: ['spider', 'witch', 'werewolf', 'skeleton'], rate: 7.3, max: 250, event: 'ring' },
  { minute: 12, pool: ['wisp', 'werewolf', 'witch', 'spider'], rate: 7.8, max: 270, event: 'swarm' },
  { minute: 13, pool: ['werewolf', 'skeleton', 'witch'], rate: 8.3, max: 290, event: 'ring' },
  { minute: 14, pool: ['werewolf', 'witch', 'spider', 'skeleton', 'wisp'], rate: 9.2, max: 310, event: 'swarm' },
];

/** Pico Congelado: pinguins, corujas da nevasca, golens que atiram neve, yetis e espectros do gelo. */
const ICE_WAVES: Wave[] = [
  { minute: 0, pool: ['penguin', 'snow_owl'], rate: 1.6, max: 40 },
  { minute: 1, pool: ['penguin', 'snow_golem'], rate: 2.2, max: 55 },
  { minute: 2, pool: ['penguin', 'yeti', 'snow_owl'], rate: 2.8, max: 70 },
  { minute: 3, pool: ['snow_golem', 'yeti', 'snow_owl'], rate: 3.2, max: 90, event: 'swarm' },
  { minute: 4, pool: ['penguin', 'frost_wraith', 'yeti', 'snow_owl'], rate: 3.6, max: 110 },
  { minute: 5, pool: ['yeti', 'snow_golem', 'frost_wraith'], rate: 4.2, max: 130 },
  { minute: 6, pool: ['penguin', 'yeti', 'frost_wraith', 'snow_golem'], rate: 4.7, max: 150, event: 'ring' },
  { minute: 7, pool: ['snow_owl', 'yeti', 'snow_golem', 'frost_wraith'], rate: 5.2, max: 170, event: 'swarm' },
  { minute: 8, pool: ['yeti', 'penguin', 'snow_golem'], rate: 5.8, max: 190, event: 'ring' },
  { minute: 9, pool: ['penguin', 'yeti', 'frost_wraith', 'snow_golem', 'snow_owl'], rate: 6.4, max: 210, event: 'swarm' },
  { minute: 10, pool: ['yeti', 'frost_wraith', 'penguin'], rate: 6.8, max: 230 },
  { minute: 11, pool: ['yeti', 'snow_golem', 'frost_wraith'], rate: 7.3, max: 250, event: 'ring' },
  { minute: 12, pool: ['snow_owl', 'yeti', 'frost_wraith', 'snow_golem'], rate: 7.8, max: 270, event: 'swarm' },
  { minute: 13, pool: ['yeti', 'penguin', 'frost_wraith'], rate: 8.3, max: 290, event: 'ring' },
  { minute: 14, pool: ['penguin', 'yeti', 'frost_wraith', 'snow_golem', 'snow_owl'], rate: 9.2, max: 310, event: 'swarm' },
];

/** Fase futura: aparece no mapa, ainda sem arte própria. */
function soon(id: StageId, name: string, subtitle: string, mood: Mood, elements: string, color: number): StageDef {
  return {
    id, name, subtitle, mood, elements, playable: false, color,
    tint: { ground: 0xffffff, decor: 0xffffff, sky: '#2f6a3a' }, decor: FOREST_DECOR,
    waves: WAVES, bosses: ['king_slime', 'alpha_wolf', 'goblin_king'], difficulty: 1, events: [],
    objectives: [{ kind: 'boss', text: 'Derrote o chefe' }, { kind: 'boss', text: '—' }, { kind: 'boss', text: '—' }],
  };
}

export const STAGES: StageDef[] = [
  {
    id: 'clareira', name: 'Clareira Ensolarada', subtitle: 'Onde toda lenda começa', mood: 'leve', elements: 'neutro', playable: true,
    tint: { ground: 0xffffff, decor: 0xffffff, sky: '#2f6a3a' }, decor: FOREST_DECOR, color: 0x7fd36a,
    ring: ['goblin', 'wolf'], golden: 'goblin',
    waves: WAVES, bosses: ['king_slime', 'alpha_wolf', 'goblin_king'], difficulty: 1,
    events: ['chest', 'captive', 'goldenGoblin', 'ambush'],
    objectives: [
      { kind: 'boss', text: 'Derrote o Rei Goblin' },
      { kind: 'event', event: 'captive', text: 'Liberte o prisioneiro' },
      { kind: 'hp', min: 0.5, text: 'Vença com metade da vida ou mais' },
    ],
  },
  {
    id: 'outono', name: 'Bosque Outonal', subtitle: 'As folhas caem, os slimes cospem', mood: 'leve', elements: 'fogo e terra', playable: true,
    tint: { ground: 0xffa860, decor: 0xff9a50, sky: '#6a4a2a' }, decor: { ...FOREST_DECOR, flowers: 6, mushroom: 16, stump: 8 }, color: 0xf0a040,
    swarm: 'bat_air', ring: ['goblin_earth', 'orc'], golden: 'goblin_earth',
    waves: AUTUMN_WAVES, bosses: ['magma_lord', 'goblin_warlord', 'orc_chief'], difficulty: 2.8,
    events: ['chest', 'captive', 'surpriseBoss', 'goldenGoblin', 'meteors', 'ambush'],
    objectives: [
      { kind: 'boss', text: 'Derrote o Chefe Orc' },
      { kind: 'event', event: 'goldenGoblin', text: 'Pegue o goblin da terra dourado' },
      { kind: 'kills', n: 3000, text: 'Derrote 3.000 inimigos' },
    ],
  },
  {
    id: 'pantano', name: 'Pântano Enevoado', subtitle: 'A névoa esconde o que espreita', mood: 'leve', elements: 'água e terra', playable: true,
    tint: { ground: 0xffffff, decor: 0xffffff, sky: '#2e5a52' }, color: 0x5fb8a0,
    ground: 'ground_swamp', hazard: 'fog', swarm: 'mosquito', ring: ['frog', 'croc'], golden: 'frog',
    decor: { swamp_tree: 6, reeds: 34, mossy_log: 8, glowshroom: 14, rock: 6, bush: 8, tallgrass: 20 },
    tall: ['swamp_tree'], patches: ['lilypond', 'mud', 'mud'],
    waves: SWAMP_WAVES, bosses: ['croc_king', 'grand_frog_shaman', 'frog_king'], difficulty: 4.5,
    events: ['chest', 'captive', 'surpriseBoss', 'goldenGoblin', 'meteors', 'ambush'],
    objectives: [
      { kind: 'boss', text: 'Derrote o Rei Sapo' },
      { kind: 'event', event: 'chest', text: 'Abra o baú guardado' },
      { kind: 'hp', min: 0.5, text: 'Vença com metade da vida ou mais' },
    ],
  },
  {
    id: 'dunas', name: 'Dunas Escaldantes', subtitle: 'Tempestades de areia sem fim', mood: 'sério', elements: 'ar e terra', playable: true,
    tint: { ground: 0xffffff, decor: 0xffffff, sky: '#8a6a3a' }, color: 0xe8c070,
    ground: 'ground_dunes', swarm: 'vulture', ring: ['scorpion', 'cactus_spitter'], golden: 'scorpion',
    decor: { cactus: 10, palm: 3, desert_rock: 10, bones: 8, dry_bush: 16 },
    tall: ['palm'], patches: ['quicksand'],
    tribes: [{ name: 'Escorpiões', pool: ['scorpion', 'scorpion', 'sandworm'] }, { name: 'Lagartos', pool: ['lizard_shaman', 'lizard_shaman', 'cactus_spitter'] }],
    waves: DUNES_WAVES, bosses: ['colossal_worm', 'lizard_elder', 'scorpion_emperor'], difficulty: 7,
    events: ['chest', 'captive', 'surpriseBoss', 'tribeWar', 'sandstorm', 'goldenGoblin', 'ambush'],
    objectives: [
      { kind: 'boss', text: 'Derrote o Imperador Escorpião' },
      { kind: 'event', event: 'tribeWar', text: 'Acabe com uma guerra de tribos' },
      { kind: 'kills', n: 4000, text: 'Derrote 4.000 inimigos' },
    ],
  },
  {
    id: 'sombria', name: 'Floresta Sombria', subtitle: 'A clareira, anos depois', mood: 'sombrio', elements: 'mistos', playable: true,
    // a arte da floresta reaproveitada fica fria e escura; o chão é a grama da clareira sem cor
    tint: { ground: 0xffffff, decor: 0x9aa4c8, sky: '#1e2238' }, color: 0x4a5a8a,
    ground: 'ground_dark', hazard: 'dark', swarm: 'wisp', ring: ['skeleton', 'werewolf'], golden: 'skeleton', angry: ['dead_tree'],
    decor: { dead_tree: 6, tree: 2, thorn_bush: 12, gravestone: 7, rock: 6, mushroom: 6, stump: 5, tallgrass: 22 },
    tall: ['dead_tree', 'tree'], patches: ['cobweb', 'dirt'],
    tribes: [{ name: 'Lobisomens', pool: ['werewolf', 'werewolf', 'skeleton'] }, { name: 'Aranhas', pool: ['spider', 'spider', 'wisp'] }],
    waves: DARK_WAVES, bosses: ['werewolf_alpha', 'elder_witch', 'ancient_ent'], difficulty: 11,
    events: ['chest', 'captive', 'surpriseBoss', 'cursedShrine', 'bloodMoon', 'tribeWar', 'ambush'],
    objectives: [
      { kind: 'boss', text: 'Derrote o Ent Ancião Corrompido' },
      { kind: 'event', event: 'cursedShrine', text: 'Ative o santuário maldito' },
      { kind: 'hp', min: 0.5, text: 'Vença com metade da vida ou mais' },
    ],
  },
  {
    id: 'pico', name: 'Pico Congelado', subtitle: 'O frio que congela até a coragem', mood: 'sombrio', elements: 'água e ar', playable: true,
    // chão de neve um pouco acinzentado: as criaturas brancas (yeti, corujas) se destacam
    tint: { ground: 0xa8b8cc, decor: 0xffffff, sky: '#5a7a9a' }, color: 0xa8d8f0,
    ground: 'ground_snow', hazard: 'ice', swarm: 'snow_owl', ring: ['penguin', 'yeti'], golden: 'penguin',
    decor: { snow_pine: 7, ice_crystal: 8, snow_rock: 9, snowdrift: 18, frozen_log: 6 },
    tall: ['snow_pine'], patches: ['ice_patch'],
    waves: ICE_WAVES, bosses: ['yeti_elder', 'frost_queen', 'ice_dragon'], difficulty: 16,
    events: ['chest', 'captive', 'surpriseBoss', 'blizzard', 'avalanche', 'goldenGoblin', 'ambush'],
    objectives: [
      { kind: 'boss', text: 'Derrote o Dragão de Gelo' },
      { kind: 'event', event: 'avalanche', text: 'Sobreviva a uma avalanche' },
      { kind: 'kills', n: 5000, text: 'Derrote 5.000 inimigos' },
    ],
  },
  soon('vulcao', 'Coração do Vulcão', 'O chão ferve sob seus pés', 'épico', 'fogo', 0xe8502a),
  soon('ruinas', 'Ruínas Malditas', 'Um reino caído e seus fantasmas', 'épico', 'mistos', 0x8a6ab0),
  soon('cidadela', 'Cidadela Demoníaca', 'O fim da jornada', 'épico', 'todos', 0xb0202a),
];

/**
 * Multiplicadores da fase: vida cheia, dano e recompensa crescem um pouco menos. `progress` (0 a 1,
 * o andamento da partida) suaviza um pouco o começo (90% do expoente no início, tudo no fim),
 * para a fase nova derrotar rápido sem matar no primeiro minuto.
 */
export function stageScaling(st: StageDef, progress = 1) {
  const d = Math.pow(st.difficulty, 0.9 + 0.1 * Math.min(1, Math.max(0, progress)));
  return { hp: d, damage: Math.pow(d, 0.75), reward: Math.pow(st.difficulty, 0.85) };
}

/** Chefe final da fase (o que vale a estrela de vencer e libera a próxima). */
export const finalBoss = (st: StageDef) => st.bosses[2];

/** Nome de cada terço da partida, na ordem dos chefes. */
export const BOSS_STAGES = ['início', 'meio', 'final'] as const;

export function getStage(id: string | undefined): StageDef {
  return STAGES.find((s) => s.id === id) ?? STAGES[0];
}

/** Fase liberada: a primeira sempre; as outras quando o chefe final da anterior foi vencido (no Normal). */
export function stageUnlocked(i: number, tiers: Partial<Record<StageId, TierProgress[]>>, all = false): boolean {
  return all || i === 0 || !!tiers[STAGES[i - 1].id]?.[0]?.stars[0];
}
