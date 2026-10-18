// Fases do mundo (Marco 3, ver docs/GDD.md). Cada fase tem aparência, ondas, chefe, eventos e três
// objetivos (estrelas). As primeiras são coloridas e leves; o mundo fica mais sombrio e épico.
import type { EnemyId } from './enemies';
import { WAVES, type Wave } from './waves';

export type StageId = 'clareira' | 'outono' | 'pantano' | 'dunas' | 'sombria' | 'pico' | 'vulcao' | 'ruinas' | 'cidadela';

export type Mood = 'leve' | 'sério' | 'sombrio' | 'épico';

/** Eventos aleatórios que podem acontecer na fase (ver systems/events.ts). */
export type RunEventId = 'chest' | 'captive' | 'surpriseBoss' | 'goldenGoblin' | 'meteors' | 'ambush';

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
  /** textura do chão (padrão: grama da floresta) */
  ground?: string;
  /** perigo do mapa: névoa que esconde a borda da tela e poças de lama que deixam lento */
  hazard?: 'fog';
  /** criatura das revoadas (padrão: morcego) e do cerco (padrão: esqueleto, orc mais tarde) */
  swarm?: EnemyId;
  ring?: [EnemyId, EnemyId];
  waves: Wave[];
  boss: EnemyId;
  /** multiplicador de vida e dano dos inimigos */
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
  { minute: 5, pool: ['skeleton', 'slime_spit', 'orc', 'slime_fire'], rate: 4.2, max: 130, event: 'ring' },
  { minute: 6, pool: ['skeleton', 'slime_magma', 'goblin_earth', 'slime_bomb'], rate: 4.7, max: 150 },
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
  { minute: 5, pool: ['croc', 'sporeshroom', 'frog_shaman', 'goblin_earth'], rate: 4.4, max: 140, event: 'ring' },
  { minute: 6, pool: ['frog', 'croc', 'frog_shaman', 'slime_water'], rate: 4.9, max: 160 },
  { minute: 7, pool: ['mosquito', 'croc', 'sporeshroom', 'frog_shaman'], rate: 5.4, max: 180, event: 'swarm' },
  { minute: 8, pool: ['croc', 'orc', 'sporeshroom'], rate: 6, max: 200, event: 'ring' },
  { minute: 9, pool: ['frog', 'croc', 'frog_shaman', 'sporeshroom', 'goblin_earth'], rate: 6.6, max: 220, event: 'swarm' },
  { minute: 10, pool: ['croc', 'orc', 'frog_shaman'], rate: 7, max: 240 },
  { minute: 11, pool: ['croc', 'sporeshroom', 'frog_shaman', 'skeleton'], rate: 7.5, max: 260, event: 'ring' },
  { minute: 12, pool: ['mosquito', 'croc', 'frog_shaman', 'sporeshroom', 'slime_water'], rate: 8, max: 280, event: 'swarm' },
  { minute: 13, pool: ['croc', 'orc', 'frog_shaman'], rate: 8.5, max: 300, event: 'ring' },
  { minute: 14, pool: ['frog', 'croc', 'frog_shaman', 'sporeshroom', 'orc', 'mosquito'], rate: 9.4, max: 320, event: 'swarm' },
];

/** Fase futura: aparece no mapa, ainda sem arte própria. */
function soon(id: StageId, name: string, subtitle: string, mood: Mood, elements: string, color: number): StageDef {
  return {
    id, name, subtitle, mood, elements, playable: false, color,
    tint: { ground: 0xffffff, decor: 0xffffff, sky: '#2f6a3a' }, decor: FOREST_DECOR,
    waves: WAVES, boss: 'demon', difficulty: 1, events: [],
    objectives: [{ kind: 'boss', text: 'Derrote o chefe' }, { kind: 'boss', text: '—' }, { kind: 'boss', text: '—' }],
  };
}

export const STAGES: StageDef[] = [
  {
    id: 'clareira', name: 'Clareira Ensolarada', subtitle: 'Onde toda lenda começa', mood: 'leve', elements: 'neutro', playable: true,
    tint: { ground: 0xffffff, decor: 0xffffff, sky: '#2f6a3a' }, decor: FOREST_DECOR, color: 0x7fd36a,
    waves: WAVES, boss: 'demon', difficulty: 1,
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
    waves: AUTUMN_WAVES, boss: 'orc_chief', difficulty: 1.3,
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
    waves: SWAMP_WAVES, boss: 'frog_king', difficulty: 1.6,
    events: ['chest', 'captive', 'surpriseBoss', 'goldenGoblin', 'meteors', 'ambush'],
    objectives: [
      { kind: 'boss', text: 'Derrote o Rei Sapo' },
      { kind: 'event', event: 'chest', text: 'Abra o baú guardado' },
      { kind: 'hp', min: 0.5, text: 'Vença com metade da vida ou mais' },
    ],
  },
  soon('dunas', 'Dunas Escaldantes', 'Tempestades de areia sem fim', 'sério', 'ar e terra', 0xe8c070),
  soon('sombria', 'Floresta Sombria', 'A clareira, anos depois', 'sombrio', 'mistos', 0x4a5a8a),
  soon('pico', 'Pico Congelado', 'O frio que congela até a coragem', 'sombrio', 'água e ar', 0xa8d8f0),
  soon('vulcao', 'Coração do Vulcão', 'O chão ferve sob seus pés', 'épico', 'fogo', 0xe8502a),
  soon('ruinas', 'Ruínas Malditas', 'Um reino caído e seus fantasmas', 'épico', 'mistos', 0x8a6ab0),
  soon('cidadela', 'Cidadela Demoníaca', 'O fim da jornada', 'épico', 'todos', 0xb0202a),
];

export function getStage(id: string | undefined): StageDef {
  return STAGES.find((s) => s.id === id) ?? STAGES[0];
}

/** Fase liberada: a primeira sempre; as outras quando o chefe da anterior foi vencido. */
export function stageUnlocked(i: number, stars: Partial<Record<StageId, boolean[]>>, all = false): boolean {
  return all || i === 0 || !!stars[STAGES[i - 1].id]?.[0];
}
