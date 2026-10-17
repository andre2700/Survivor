// Animação: os quadros do modelo de quadros (art/manifest.mjs) em ciclo, com balanço por código por
// cima (esticar/achatar, inclinação, respiração). Dano, morte, ataque e vitória são escolhidos pelo jogo.

interface Gait {
  /** quadros por segundo do ciclo */
  fps: number;
  /** ordem dos quadros (nomes do modelo de quadros) no ciclo */
  cycle: string[];
  /** esticar/achatar */
  squash: number;
  /** inclinação máxima (rad) */
  tilt: number;
}

// monstros: dois passos com as pernas juntas entre eles (slime: normal, achatado, esticado; morcego: asas)
const STEP = ['walk_a', 'walk_mid', 'walk_b', 'walk_mid'];
// heróis e chefe: o quadro parado faz o papel das pernas juntas
const STRIDE = ['walk_a', 'idle', 'walk_b', 'idle'];
const GAITS: Record<string, Gait> = {
  hero: { fps: 7, cycle: STRIDE, squash: 0.03, tilt: 0.04 },
  slime: { fps: 6, cycle: ['walk_a', 'walk_mid', 'walk_b', 'walk_a'], squash: 0.05, tilt: 0 },
  bat: { fps: 12, cycle: STEP, squash: 0.03, tilt: 0.05 },
  goblin: { fps: 8, cycle: STEP, squash: 0.03, tilt: 0.05 },
  wolf: { fps: 10, cycle: STEP, squash: 0.03, tilt: 0.05 },
  skeleton: { fps: 7, cycle: STEP, squash: 0.025, tilt: 0.05 },
  orc: { fps: 6, cycle: STEP, squash: 0.03, tilt: 0.04 },
  demon: { fps: 4, cycle: STRIDE, squash: 0.02, tilt: 0.025 },
};

export interface Pose {
  slot: string;
  sx: number;
  sy: number;
  rot: number;
}

const pose: Pose = { slot: 'idle', sx: 1, sy: 1, rot: 0 };

/**
 * Pose para o tempo `t` (s). Parado, fica no quadro de descanso e só respira. O objeto retornado é
 * reutilizado: copie os valores antes de chamar de novo.
 */
export function walkPose(kind: string, t: number, moving = true): Pose {
  const g = GAITS[kind] ?? GAITS.hero;
  if (!moving) {
    const b = Math.sin(t * 2.4) * 0.025;
    pose.slot = g.cycle === STRIDE ? 'idle' : g.cycle[0];
    pose.sx = 1 - b * 0.5;
    pose.sy = 1 + b;
    pose.rot = 0;
    return pose;
  }
  const step = t * g.fps;
  pose.slot = g.cycle[Math.floor(step) % g.cycle.length];
  // um balanço por quadro: a figura "pisa" a cada troca de quadro
  const s = Math.sin((step % 1) * Math.PI);
  pose.sx = 1 - s * g.squash * 0.7;
  pose.sy = 1 + s * g.squash;
  pose.rot = Math.sin(t * g.fps * Math.PI * 0.5) * g.tilt;
  return pose;
}
