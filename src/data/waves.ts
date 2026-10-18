import type { EnemyId } from './enemies';

export type WaveEvent = 'swarm' | 'ring';

export interface Wave {
  minute: number;
  pool: EnemyId[];
  /** inimigos gerados por segundo */
  rate: number;
  /** máximo de inimigos vivos */
  max: number;
  event?: WaveEvent;
}

/** Duração da partida padrão até o chefe (segundos). */
export const RUN_DURATION = 15 * 60;
/** No modo infinito, um novo chefe a cada ciclo. */
export const ENDLESS_CYCLE = 5 * 60;
export const MAX_ENEMIES = 700;

export const WAVES: Wave[] = [
  { minute: 0, pool: ['slime'], rate: 1.2, max: 30 },
  { minute: 1, pool: ['slime', 'goblin'], rate: 1.8, max: 45 },
  { minute: 2, pool: ['goblin', 'bat', 'slime_fire'], rate: 2.4, max: 60 },
  { minute: 3, pool: ['goblin', 'wolf', 'slime_water'], rate: 3, max: 80, event: 'swarm' },
  { minute: 4, pool: ['wolf', 'skeleton', 'goblin_earth', 'slime_fire'], rate: 3.2, max: 100 },
  { minute: 5, pool: ['bat_air', 'skeleton', 'orc', 'slime_water'], rate: 3.8, max: 120, event: 'ring' },
  { minute: 6, pool: ['skeleton', 'wolf', 'orc', 'goblin_earth'], rate: 4.3, max: 140 },
  { minute: 7, pool: ['bat', 'bat_air', 'orc', 'slime_fire'], rate: 4.8, max: 160, event: 'swarm' },
  { minute: 8, pool: ['skeleton', 'orc'], rate: 5.5, max: 180, event: 'ring' },
  { minute: 9, pool: ['goblin_earth', 'wolf', 'skeleton', 'orc', 'slime_water'], rate: 6, max: 200, event: 'swarm' },
  { minute: 10, pool: ['skeleton', 'orc'], rate: 6.5, max: 220 },
  { minute: 11, pool: ['wolf', 'orc'], rate: 7, max: 240, event: 'ring' },
  { minute: 12, pool: ['bat_air', 'wolf', 'skeleton', 'orc', 'slime_fire'], rate: 7.5, max: 260, event: 'swarm' },
  { minute: 13, pool: ['skeleton', 'orc'], rate: 8, max: 280, event: 'ring' },
  { minute: 14, pool: ['goblin_earth', 'wolf', 'skeleton', 'orc', 'slime_water', 'bat_air'], rate: 9, max: 300, event: 'swarm' },
];

export function waveAt(seconds: number, waves: Wave[] = WAVES): Wave {
  const minute = Math.floor(seconds / 60);
  let current = waves[0];
  for (const w of waves) if (w.minute <= minute) current = w;
  return current;
}

/** Vida dos inimigos cresce com o tempo da partida padrão. */
export function hpMultiplier(seconds: number): number {
  return 1 + (Math.min(seconds, RUN_DURATION) / 60) * 0.35;
}

/** Multiplicadores do modo infinito por ciclo (exponenciais, sem teto). */
export function endlessScaling(cycle: number) {
  return {
    hp: Math.pow(2.4, cycle),
    damage: Math.pow(1.6, cycle),
    rate: 1 + cycle * 0.35,
    max: Math.min(MAX_ENEMIES, 300 + cycle * 80),
    reward: 1 + cycle,
  };
}

/** Elites surgem no meio de cada minuto (a partir de 1:30). */
export function isEliteTime(prevSeconds: number, seconds: number): boolean {
  const mark = (s: number) => Math.floor((s - 30) / 60);
  return seconds >= 90 && mark(seconds) > mark(prevSeconds);
}

/** XP para passar do nível `level` ao próximo. */
export function xpToNext(level: number): number {
  const l = level - 1;
  return Math.floor(5 + l * 5 + l * l * 0.45);
}
