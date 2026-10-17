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
  { minute: 1, pool: ['slime', 'bat'], rate: 1.8, max: 45 },
  { minute: 2, pool: ['bat', 'skeleton'], rate: 2.4, max: 60 },
  { minute: 3, pool: ['slime', 'skeleton'], rate: 3, max: 80, event: 'swarm' },
  { minute: 4, pool: ['skeleton', 'orc'], rate: 3.2, max: 100 },
  { minute: 5, pool: ['bat', 'skeleton', 'orc'], rate: 3.8, max: 120, event: 'ring' },
  { minute: 6, pool: ['skeleton', 'orc'], rate: 4.3, max: 140 },
  { minute: 7, pool: ['bat', 'orc'], rate: 4.8, max: 160, event: 'swarm' },
  { minute: 8, pool: ['skeleton', 'orc'], rate: 5.5, max: 180, event: 'ring' },
  { minute: 9, pool: ['slime', 'bat', 'skeleton', 'orc'], rate: 6, max: 200, event: 'swarm' },
  { minute: 10, pool: ['skeleton', 'orc'], rate: 6.5, max: 220 },
  { minute: 11, pool: ['bat', 'orc'], rate: 7, max: 240, event: 'ring' },
  { minute: 12, pool: ['slime', 'bat', 'skeleton', 'orc'], rate: 7.5, max: 260, event: 'swarm' },
  { minute: 13, pool: ['skeleton', 'orc'], rate: 8, max: 280, event: 'ring' },
  { minute: 14, pool: ['slime', 'bat', 'skeleton', 'orc'], rate: 9, max: 300, event: 'swarm' },
];

export function waveAt(seconds: number): Wave {
  const minute = Math.floor(seconds / 60);
  let current = WAVES[0];
  for (const w of WAVES) if (w.minute <= minute) current = w;
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
