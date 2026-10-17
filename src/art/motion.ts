// Animação por código: cada personagem é uma imagem só, animada com balanço, esticar/achatar e inclinação.

interface Gait {
  /** passos por segundo (em radianos de fase) */
  rate: number;
  /** esticar/achatar */
  squash: number;
  /** inclinação máxima (rad) */
  tilt: number;
  /** bater de asas: achata só na vertical, rápido */
  flap?: boolean;
}

const GAITS: Record<string, Gait> = {
  hero: { rate: 11, squash: 0.05, tilt: 0.07 },
  slime: { rate: 7, squash: 0.13, tilt: 0 },
  bat: { rate: 22, squash: 0.18, tilt: 0.05, flap: true },
  goblin: { rate: 12, squash: 0.05, tilt: 0.09 },
  wolf: { rate: 15, squash: 0.06, tilt: 0.1 },
  skeleton: { rate: 10, squash: 0.04, tilt: 0.08 },
  orc: { rate: 8, squash: 0.05, tilt: 0.06 },
  demon: { rate: 5, squash: 0.035, tilt: 0.04 },
};

export interface Pose {
  sx: number;
  sy: number;
  rot: number;
}

const pose: Pose = { sx: 1, sy: 1, rot: 0 };

/**
 * Pose do quadro para o tempo `t` (s). Parado, só respira. O objeto retornado é reutilizado:
 * copie os valores antes de chamar de novo.
 */
export function walkPose(kind: string, t: number, moving = true): Pose {
  const g = GAITS[kind] ?? GAITS.hero;
  if (!moving) {
    const b = Math.sin(t * 2.4) * 0.025;
    pose.sx = 1 - b * 0.5;
    pose.sy = 1 + b;
    pose.rot = 0;
    return pose;
  }
  const ph = t * g.rate;
  const s = Math.sin(ph * 2);
  if (g.flap) {
    pose.sx = 1 + s * g.squash * 0.3;
    pose.sy = 1 - s * g.squash;
  } else {
    pose.sx = 1 - s * g.squash * 0.7;
    pose.sy = 1 + s * g.squash;
  }
  pose.rot = Math.sin(ph) * g.tilt;
  return pose;
}
