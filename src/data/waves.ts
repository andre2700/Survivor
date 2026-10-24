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
  { minute: 0, pool: ['slime'], rate: 1.6, max: 40 },
  { minute: 1, pool: ['slime', 'goblin'], rate: 2.2, max: 55 },
  { minute: 2, pool: ['slime', 'goblin', 'bat'], rate: 2.8, max: 70 },
  { minute: 3, pool: ['goblin', 'wolf', 'slime_water'], rate: 3.2, max: 90, event: 'swarm' },
  { minute: 4, pool: ['wolf', 'goblin', 'slime', 'bat'], rate: 3.6, max: 110 },
  { minute: 5, pool: ['wolf', 'goblin', 'slime_water'], rate: 4.2, max: 130 },
  { minute: 6, pool: ['goblin', 'wolf', 'bat'], rate: 4.7, max: 150, event: 'ring' },
  { minute: 7, pool: ['bat', 'wolf', 'slime_water', 'goblin'], rate: 5.2, max: 170, event: 'swarm' },
  { minute: 8, pool: ['wolf', 'goblin'], rate: 5.8, max: 190, event: 'ring' },
  { minute: 9, pool: ['goblin', 'wolf', 'slime_water', 'bat'], rate: 6.4, max: 210, event: 'swarm' },
  { minute: 10, pool: ['wolf', 'goblin', 'slime'], rate: 6.8, max: 230 },
  { minute: 11, pool: ['wolf', 'goblin', 'bat'], rate: 7.3, max: 250, event: 'ring' },
  { minute: 12, pool: ['bat', 'wolf', 'goblin', 'slime_water'], rate: 7.8, max: 270, event: 'swarm' },
  { minute: 13, pool: ['wolf', 'goblin', 'slime_water'], rate: 8.3, max: 290, event: 'ring' },
  { minute: 14, pool: ['goblin', 'wolf', 'slime', 'slime_water', 'bat'], rate: 9.2, max: 310, event: 'swarm' },
];

export function waveAt(seconds: number, waves: Wave[] = WAVES): Wave {
  const minute = Math.floor(seconds / 60);
  let current = waves[0];
  for (const w of waves) if (w.minute <= minute) current = w;
  return current;
}

/**
 * Vida dos inimigos ao longo da partida padrão: cresce cada vez mais rápido (×11 aos 15 min), para
 * acompanhar a força que o herói ganha subindo de nível. Sem isso, uma partida que "decola" passava
 * por todos os chefes de uma vez.
 */
export function hpMultiplier(seconds: number): number {
  const m = Math.min(seconds, RUN_DURATION) / 60;
  return 1 + m * 0.3 + m * m * 0.025;
}

/** Dano dos inimigos ao longo da partida padrão (×1,75 aos 15 min). */
export function damageMultiplier(seconds: number): number {
  return 1 + (Math.min(seconds, RUN_DURATION) / 60) * 0.05;
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
