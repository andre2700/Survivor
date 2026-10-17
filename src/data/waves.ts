import type { EnemyId } from './enemies';

export type WaveEvent = 'swarm' | 'ring';

export interface Wave {
  /** minuto de início */
  minute: number;
  pool: EnemyId[];
  /** inimigos gerados por segundo */
  rate: number;
  /** máximo de inimigos vivos nesta onda */
  max: number;
  event?: WaveEvent;
}

/** Duração da partida até o chefe aparecer (segundos). */
export const RUN_DURATION = 10 * 60;
export const MAX_ENEMIES = 260;

export const WAVES: Wave[] = [
  { minute: 0, pool: ['slime'], rate: 1.2, max: 30 },
  { minute: 1, pool: ['slime', 'bat'], rate: 1.8, max: 45 },
  { minute: 2, pool: ['bat', 'skeleton'], rate: 2.4, max: 60 },
  { minute: 3, pool: ['slime', 'skeleton'], rate: 3, max: 80, event: 'swarm' },
  { minute: 4, pool: ['skeleton', 'orc'], rate: 3.2, max: 100 },
  { minute: 5, pool: ['bat', 'skeleton', 'orc'], rate: 3.8, max: 130, event: 'ring' },
  { minute: 6, pool: ['skeleton', 'orc'], rate: 4.3, max: 160 },
  { minute: 7, pool: ['bat', 'orc'], rate: 4.8, max: 190, event: 'swarm' },
  { minute: 8, pool: ['skeleton', 'orc'], rate: 5.5, max: 220, event: 'ring' },
  { minute: 9, pool: ['slime', 'bat', 'skeleton', 'orc'], rate: 6.5, max: 260, event: 'swarm' },
];

export function waveAt(seconds: number): Wave {
  const minute = Math.floor(seconds / 60);
  let current = WAVES[0];
  for (const w of WAVES) if (w.minute <= minute) current = w;
  return current;
}

/** Vida dos inimigos cresce com o tempo. */
export function hpMultiplier(seconds: number): number {
  return 1 + (seconds / 60) * 0.32;
}

/** Elites surgem no meio de cada minuto (a partir do minuto 1). */
export function isEliteTime(prevSeconds: number, seconds: number): boolean {
  if (seconds >= RUN_DURATION) return false;
  const mark = (s: number) => Math.floor((s - 30) / 60);
  return seconds >= 90 && mark(seconds) > mark(prevSeconds);
}

/** XP necessária para passar do nível `level` para o próximo. */
export function xpToNext(level: number): number {
  const l = level - 1;
  return Math.floor(5 + l * 5 + l * l * 0.45);
}
