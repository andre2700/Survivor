// Fases do mundo (Marco 3, ver docs/GDD.md). Cada fase tem aparência, ondas, chefe, eventos e três
// objetivos (estrelas). As primeiras são coloridas e leves; o mundo fica mais sombrio e épico.
import type { TierProgress } from './difficulty';
import type { EnemyId } from './enemies';
import { WAVES, type Wave } from './waves';

export type StageId = 'clareira' | 'outono' | 'pantano' | 'dunas' | 'sombria' | 'pico' | 'vulcao' | 'ruinas' | 'cidadela';

export type Mood = 'leve' | 'sério' | 'sombrio' | 'épico';

/** Eventos aleatórios que podem acontecer na fase (ver systems/events.ts). */
export type RunEventId = 'chest' | 'captive' | 'surpriseBoss' | 'goldenGoblin' | 'meteors' | 'ambush' | 'tribeWar' | 'sandstorm'
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
  /** as duas tribos da guerra de tribos (padrão: goblins contra esqueletos) */
  tribes?: [Tribe, Tribe];
  /** textura do chão (padrão: grama da floresta) */
  ground?: string;
  /** perigo do mapa: névoa que esconde a borda da tela, ou escuridão (só a área em volta do herói fica clara) */
  hazard?: 'fog' | 'dark';
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
  { minute: 0, pool: ['slime', 'goblin'], rate: 1.6, max: 40 },
  { minute: 1, pool: ['goblin', 'slime_spit'], rate: 2.2, max: 55 },
  { minute: 2, pool: ['goblin', 'slime_bomb', 'slime_fire'], rate: 2.8, max: 70 },
  { minute: 3, pool: ['wolf', 'slime_spit', 'goblin_earth'], rate: 3.2, max: 90, event: 'swarm' },
  { minute: 4, pool: ['wolf', 'slime_magma', 'slime_bomb', 'goblin'], rate: 3.6, max: 110 },
  { minute: 5, pool: ['skeleton', 'slime_spit', 'orc', 'slime_fire'], rate: 4.2, max: 130 },
  { minute: 6, pool: ['skeleton', 'slime_magma', 'goblin_earth', 'slime_bomb'], rate: 4.7, max: 150, event: 'ring' },
  { minute: 7, pool: ['bat_air', 'orc', 'slime_spit', 'slime_magma'], rate: 5.2, max: 170, event: 'swarm' },
  { minute: 8, pool: ['skeleton', 'orc', 'slime_bomb'], rate: 5.8, max: 190, event: 'ring' },
  { minute: 9, pool: ['wolf', 'orc', 'slime_magma', 'slime_spit', 'goblin_earth'], rate: 6.4, max: 210, event: 'swarm' },
  { minute: 10, pool: ['skeleton', 'orc', 'slime_bomb'], rate: 6.8, max: 230 },
  { minute: 11, pool: ['wolf', 'orc', 'slime_magma'], rate: 7.3, max: 250, event: 'ring' },
  { minute: 12, pool: ['bat_air', 'orc', 'slime_spit', 'slime_bomb', 'slime_fire'], rate: 7.8, max: 270, event: 'swarm' },
  { minute: 13, pool: ['skeleton', 'orc', 'slime_magma'], rate: 8.3, max: 290, event: 'ring' },
  { minute: 14, pool: ['goblin_earth', 'orc', 'slime_magma', 'slime_spit', 'slime_bomb'], rate: 9.2, max: 310, event: 'swarm' },
];

/** Pântano Enevoado: sapos, jacarés com bote, mosquitos, cogumelos que atiram esporos e xamãs. */
const SWAMP_WAVES: Wave[] = [
  { minute: 0, pool: ['frog', 'mosquito'], rate: 1.8, max: 45 },
  { minute: 1, pool: ['frog', 'sporeshroom'], rate: 2.4, max: 60 },
  { minute: 2, pool: ['frog', 'croc', 'mosquito'], rate: 3, max: 80 },
  { minute: 3, pool: ['sporeshroom', 'croc', 'slime_water'], rate: 3.4, max: 100, event: 'swarm' },
  { minute: 4, pool: ['frog', 'frog_shaman', 'croc', 'mosquito'], rate: 3.8, max: 120 },
  { minute: 5, pool: ['croc', 'sporeshroom', 'frog_shaman', 'goblin_earth'], rate: 4.4, max: 140 },
  { minute: 6, pool: ['frog', 'croc', 'frog_shaman', 'slime_water'], rate: 4.9, max: 160, event: 'ring' },
  { minute: 7, pool: ['mosquito', 'croc', 'sporeshroom', 'frog_shaman'], rate: 5.4, max: 180, event: 'swarm' },
  { minute: 8, pool: ['croc', 'orc', 'sporeshroom'], rate: 6, max: 200, event: 'ring' },
  { minute: 9, pool: ['frog', 'croc', 'frog_shaman', 'sporeshroom', 'goblin_earth'], rate: 6.6, max: 220, event: 'swarm' },
  { minute: 10, pool: ['croc', 'orc', 'frog_shaman'], rate: 7, max: 240 },
  { minute: 11, pool: ['croc', 'sporeshroom', 'frog_shaman', 'skeleton'], rate: 7.5, max: 260, event: 'ring' },
  { minute: 12, pool: ['mosquito', 'croc', 'frog_shaman', 'sporeshroom', 'slime_water'], rate: 8, max: 280, event: 'swarm' },
  { minute: 13, pool: ['croc', 'orc', 'frog_shaman'], rate: 8.5, max: 300, event: 'ring' },
  { minute: 14, pool: ['frog', 'croc', 'frog_shaman', 'sporeshroom', 'orc', 'mosquito'], rate: 9.4, max: 320, event: 'swarm' },
];

/** Dunas Escaldantes: escorpiões, abutres, cactos atiradores, vermes que se enterram e xamãs do vento. */
const DUNES_WAVES: Wave[] = [
  { minute: 0, pool: ['scorpion', 'vulture'], rate: 2, max: 50 },
  { minute: 1, pool: ['scorpion', 'cactus_spitter'], rate: 2.6, max: 65 },
  { minute: 2, pool: ['scorpion', 'vulture', 'sandworm'], rate: 3.2, max: 85 },
  { minute: 3, pool: ['cactus_spitter', 'sandworm', 'goblin_earth'], rate: 3.6, max: 105, event: 'swarm' },
  { minute: 4, pool: ['scorpion', 'lizard_shaman', 'sandworm', 'vulture'], rate: 4, max: 125 },
  { minute: 5, pool: ['sandworm', 'cactus_spitter', 'lizard_shaman', 'skeleton'], rate: 4.6, max: 145 },
  { minute: 6, pool: ['scorpion', 'sandworm', 'lizard_shaman', 'bat_air'], rate: 5.1, max: 165, event: 'ring' },
  { minute: 7, pool: ['vulture', 'sandworm', 'cactus_spitter', 'lizard_shaman'], rate: 5.6, max: 185, event: 'swarm' },
  { minute: 8, pool: ['sandworm', 'orc', 'cactus_spitter'], rate: 6.2, max: 205, event: 'ring' },
  { minute: 9, pool: ['scorpion', 'sandworm', 'lizard_shaman', 'cactus_spitter', 'goblin_earth'], rate: 6.8, max: 225, event: 'swarm' },
  { minute: 10, pool: ['sandworm', 'orc', 'lizard_shaman'], rate: 7.2, max: 245 },
  { minute: 11, pool: ['sandworm', 'cactus_spitter', 'lizard_shaman', 'skeleton'], rate: 7.7, max: 265, event: 'ring' },
  { minute: 12, pool: ['vulture', 'sandworm', 'lizard_shaman', 'cactus_spitter', 'bat_air'], rate: 8.2, max: 285, event: 'swarm' },
  { minute: 13, pool: ['sandworm', 'orc', 'lizard_shaman'], rate: 8.7, max: 305, event: 'ring' },
  { minute: 14, pool: ['scorpion', 'sandworm', 'lizard_shaman', 'cactus_spitter', 'orc', 'vulture'], rate: 9.6, max: 325, event: 'swarm' },
];

/** Floresta Sombria: lobisomens com bote, fogos-fátuos, aranhas que prendem com teia e bruxas do raio. */
const DARK_WAVES: Wave[] = [
  { minute: 0, pool: ['wisp', 'goblin'], rate: 2.2, max: 55 },
  { minute: 1, pool: ['wisp', 'spider'], rate: 2.8, max: 70 },
  { minute: 2, pool: ['spider', 'werewolf', 'skeleton'], rate: 3.4, max: 90 },
  { minute: 3, pool: ['wisp', 'werewolf', 'spider'], rate: 3.8, max: 110, event: 'swarm' },
  { minute: 4, pool: ['skeleton', 'witch', 'spider', 'werewolf'], rate: 4.2, max: 130 },
  { minute: 5, pool: ['werewolf', 'witch', 'spider', 'wolf'], rate: 4.8, max: 150 },
  { minute: 6, pool: ['skeleton', 'werewolf', 'witch', 'wisp'], rate: 5.3, max: 170, event: 'ring' },
  { minute: 7, pool: ['wisp', 'spider', 'witch', 'werewolf'], rate: 5.8, max: 190, event: 'swarm' },
  { minute: 8, pool: ['werewolf', 'orc', 'spider'], rate: 6.4, max: 210, event: 'ring' },
  { minute: 9, pool: ['werewolf', 'witch', 'spider', 'skeleton', 'wisp'], rate: 7, max: 230, event: 'swarm' },
  { minute: 10, pool: ['werewolf', 'orc', 'witch'], rate: 7.4, max: 250 },
  { minute: 11, pool: ['spider', 'witch', 'werewolf', 'skeleton'], rate: 7.9, max: 270, event: 'ring' },
  { minute: 12, pool: ['wisp', 'werewolf', 'witch', 'spider', 'bat'], rate: 8.4, max: 290, event: 'swarm' },
  { minute: 13, pool: ['werewolf', 'orc', 'witch'], rate: 8.9, max: 310, event: 'ring' },
  { minute: 14, pool: ['werewolf', 'witch', 'spider', 'orc', 'wisp', 'skeleton'], rate: 9.8, max: 330, event: 'swarm' },
];

/** Fase futura: aparece no mapa, ainda sem arte própria. */
function soon(id: StageId, name: string, subtitle: string, mood: Mood, elements: string, color: number): StageDef {
  return {
    id, name, subtitle, mood, elements, playable: false, color,
    tint: { ground: 0xffffff, decor: 0xffffff, sky: '#2f6a3a' }, decor: FOREST_DECOR,
    waves: WAVES, bosses: ['king_slime', 'alpha_wolf', 'demon'], difficulty: 1, events: [],
    objectives: [{ kind: 'boss', text: 'Derrote o chefe' }, { kind: 'boss', text: '—' }, { kind: 'boss', text: '—' }],
  };
}

export const STAGES: StageDef[] = [
  {
    id: 'clareira', name: 'Clareira Ensolarada', subtitle: 'Onde toda lenda começa', mood: 'leve', elements: 'neutro', playable: true,
    tint: { ground: 0xffffff, decor: 0xffffff, sky: '#2f6a3a' }, decor: FOREST_DECOR, color: 0x7fd36a,
    waves: WAVES, bosses: ['king_slime', 'alpha_wolf', 'demon'], difficulty: 1,
    events: ['chest', 'captive', 'goldenGoblin', 'ambush'],
    objectives: [
      { kind: 'boss', text: 'Derrote o Demônio Ancestral' },
      { kind: 'event', event: 'captive', text: 'Liberte o prisioneiro' },
      { kind: 'hp', min: 0.5, text: 'Vença com metade da vida ou mais' },
    ],
  },
  {
    id: 'outono', name: 'Bosque Outonal', subtitle: 'As folhas caem, os slimes cospem', mood: 'leve', elements: 'fogo e terra', playable: true,
    tint: { ground: 0xffa860, decor: 0xff9a50, sky: '#6a4a2a' }, decor: { ...FOREST_DECOR, flowers: 6, mushroom: 16, stump: 8 }, color: 0xf0a040,
    waves: AUTUMN_WAVES, bosses: ['magma_lord', 'goblin_warlord', 'orc_chief'], difficulty: 2.8,
    events: ['chest', 'captive', 'surpriseBoss', 'goldenGoblin', 'meteors', 'ambush'],
    objectives: [
      { kind: 'boss', text: 'Derrote o Chefe Orc' },
      { kind: 'event', event: 'goldenGoblin', text: 'Pegue o goblin dourado' },
      { kind: 'kills', n: 3000, text: 'Derrote 3.000 inimigos' },
    ],
  },
  {
    id: 'pantano', name: 'Pântano Enevoado', subtitle: 'A névoa esconde o que espreita', mood: 'leve', elements: 'água e terra', playable: true,
    tint: { ground: 0xffffff, decor: 0xffffff, sky: '#2e5a52' }, color: 0x5fb8a0,
    ground: 'ground_swamp', hazard: 'fog', swarm: 'mosquito', ring: ['frog', 'croc'],
    decor: { swamp_tree: 6, reeds: 34, mossy_log: 8, glowshroom: 14, rock: 6, bush: 8, tallgrass: 20 },
    tall: ['swamp_tree'], patches: ['lilypond', 'mud', 'mud'],
    waves: SWAMP_WAVES, bosses: ['croc_king', 'grand_frog_shaman', 'frog_king'], difficulty: 7,
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
    ground: 'ground_dunes', swarm: 'vulture', ring: ['scorpion', 'cactus_spitter'],
    decor: { cactus: 10, palm: 3, desert_rock: 10, bones: 8, dry_bush: 16 },
    tall: ['palm'], patches: ['quicksand'],
    tribes: [{ name: 'Escorpiões', pool: ['scorpion', 'scorpion', 'sandworm'] }, { name: 'Lagartos', pool: ['lizard_shaman', 'goblin_earth'] }],
    waves: DUNES_WAVES, bosses: ['colossal_worm', 'lizard_elder', 'scorpion_emperor'], difficulty: 16,
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
    ground: 'ground_dark', hazard: 'dark', swarm: 'wisp', ring: ['wolf', 'werewolf'],
    decor: { dead_tree: 6, tree: 2, thorn_bush: 12, gravestone: 7, rock: 6, mushroom: 6, stump: 5, tallgrass: 22 },
    tall: ['dead_tree', 'tree'], patches: ['cobweb', 'dirt'],
    tribes: [{ name: 'Lobisomens', pool: ['werewolf', 'wolf'] }, { name: 'Aranhas', pool: ['spider', 'spider', 'wisp'] }],
    waves: DARK_WAVES, bosses: ['werewolf_alpha', 'elder_witch', 'ancient_ent'], difficulty: 35,
    events: ['chest', 'captive', 'surpriseBoss', 'cursedShrine', 'bloodMoon', 'tribeWar', 'ambush'],
    objectives: [
      { kind: 'boss', text: 'Derrote o Ent Ancião Corrompido' },
      { kind: 'event', event: 'cursedShrine', text: 'Ative o santuário maldito' },
      { kind: 'hp', min: 0.5, text: 'Vença com metade da vida ou mais' },
    ],
  },
  soon('pico', 'Pico Congelado', 'O frio que congela até a coragem', 'sombrio', 'água e ar', 0xa8d8f0),
  soon('vulcao', 'Coração do Vulcão', 'O chão ferve sob seus pés', 'épico', 'fogo', 0xe8502a),
  soon('ruinas', 'Ruínas Malditas', 'Um reino caído e seus fantasmas', 'épico', 'mistos', 0x8a6ab0),
  soon('cidadela', 'Cidadela Demoníaca', 'O fim da jornada', 'épico', 'todos', 0xb0202a),
];

/** Multiplicadores da fase: vida cheia, dano e recompensa crescem um pouco menos. */
export function stageScaling(st: StageDef) {
  const d = st.difficulty;
  return { hp: d, damage: Math.pow(d, 0.75), reward: Math.pow(d, 0.85) };
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
