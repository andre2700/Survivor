// Animação: poucos quadros desenhados por personagem (art/manifest.mjs) intercalados em ciclo,
// com balanço por código por cima (esticar/achatar, inclinação, respiração).

interface Gait {
  /** quadros por segundo do ciclo */
  fps: number;
  /** ordem dos quadros no ciclo */
  cycle: number[];
  /** esticar/achatar */
  squash: number;
  /** inclinação máxima (rad) */
  tilt: number;
}

// quadros dos monstros: 0 e 2 = passos, 1 = pernas juntas (slime: normal, achatado, esticado; morcego: asas)
const STEP = [0, 1, 2, 1];
const GAITS: Record<string, Gait> = {
  hero: { fps: 7, cycle: [1, 0, 2, 0], squash: 0.03, tilt: 0.04 },
  slime: { fps: 6, cycle: [0, 1, 2, 0], squash: 0.05, tilt: 0 },
  bat: { fps: 12, cycle: STEP, squash: 0.03, tilt: 0.05 },
  goblin: { fps: 8, cycle: STEP, squash: 0.03, tilt: 0.05 },
  wolf: { fps: 10, cycle: STEP, squash: 0.03, tilt: 0.05 },
  skeleton: { fps: 7, cycle: STEP, squash: 0.025, tilt: 0.05 },
  orc: { fps: 6, cycle: STEP, squash: 0.03, tilt: 0.04 },
  demon: { fps: 4, cycle: STEP, squash: 0.02, tilt: 0.025 },
};

/** Quadro do herói ao atacar. */
export const HERO_ATTACK_FRAME = 3;
/** Quadro do herói parado. */
export const HERO_IDLE_FRAME = 0;

export interface Pose {
  frame: number;
  sx: number;
  sy: number;
  rot: number;
}

const pose: Pose = { frame: 0, sx: 1, sy: 1, rot: 0 };

/**
 * Pose para o tempo `t` (s). Parado, fica no quadro de descanso e só respira. O objeto retornado é
 * reutilizado: copie os valores antes de chamar de novo.
 */
export function walkPose(kind: string, t: number, moving = true): Pose {
  const g = GAITS[kind] ?? GAITS.hero;
  if (!moving) {
    const b = Math.sin(t * 2.4) * 0.025;
    pose.frame = kind === 'hero' ? HERO_IDLE_FRAME : 0;
    pose.sx = 1 - b * 0.5;
    pose.sy = 1 + b;
    pose.rot = 0;
    return pose;
  }
  const step = t * g.fps;
  pose.frame = g.cycle[Math.floor(step) % g.cycle.length];
  // um balanço por quadro: a figura "pisa" a cada troca de quadro
  const ph = (step % 1) * Math.PI;
  const s = Math.sin(ph);
  pose.sx = 1 - s * g.squash * 0.7;
  pose.sy = 1 + s * g.squash;
  pose.rot = Math.sin(t * g.fps * Math.PI * 0.5) * g.tilt;
  return pose;
}
