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
// chefe: o quadro parado faz o papel das pernas juntas
const STRIDE = ['walk_a', 'idle', 'walk_b', 'idle'];
// criatura que dorme no mapa: o descanso é a estátua / o baú fechado, então o passo alterna só os dois quadros
const FLAP = ['walk_a', 'walk_b'];
const GAITS: Record<string, Gait> = {
  // herói correndo: passo com o pé de perto, passagem, passo com o pé de longe, passagem
  hero: { fps: 10, cycle: STEP, squash: 0.025, tilt: 0.01 },
  slime: { fps: 6, cycle: ['walk_a', 'walk_mid', 'walk_b', 'walk_a'], squash: 0.05, tilt: 0 },
  bat: { fps: 12, cycle: STEP, squash: 0.03, tilt: 0.05 },
  goblin: { fps: 8, cycle: STEP, squash: 0.03, tilt: 0.05 },
  wolf: { fps: 10, cycle: STEP, squash: 0.03, tilt: 0.05 },
  skeleton: { fps: 7, cycle: STEP, squash: 0.025, tilt: 0.05 },
  orc: { fps: 6, cycle: STEP, squash: 0.03, tilt: 0.04 },
  demon: { fps: 4, cycle: STRIDE, squash: 0.02, tilt: 0.025 },
  // Pântano
  frog: { fps: 6, cycle: STEP, squash: 0.06, tilt: 0 },
  croc: { fps: 7, cycle: STEP, squash: 0.02, tilt: 0.03 },
  mosquito: { fps: 14, cycle: STEP, squash: 0.03, tilt: 0.06 },
  sporeshroom: { fps: 6, cycle: STEP, squash: 0.04, tilt: 0.05 },
  frog_shaman: { fps: 7, cycle: STEP, squash: 0.03, tilt: 0.04 },
  frog_king: { fps: 4, cycle: STRIDE, squash: 0.04, tilt: 0.02 },
  // Dunas
  scorpion: { fps: 10, cycle: STEP, squash: 0.02, tilt: 0.02 },
  vulture: { fps: 8, cycle: STEP, squash: 0.03, tilt: 0.06 },
  cactus_spitter: { fps: 6, cycle: STEP, squash: 0.05, tilt: 0.04 },
  sandworm: { fps: 6, cycle: STEP, squash: 0.05, tilt: 0.02 },
  lizard_shaman: { fps: 7, cycle: STEP, squash: 0.03, tilt: 0.04 },
  scorpion_emperor: { fps: 5, cycle: STRIDE, squash: 0.02, tilt: 0.015 },
  // Floresta Sombria
  werewolf: { fps: 9, cycle: STEP, squash: 0.03, tilt: 0.04 },
  wisp: { fps: 8, cycle: STEP, squash: 0.05, tilt: 0.05 },
  spider: { fps: 11, cycle: STEP, squash: 0.02, tilt: 0.02 },
  witch: { fps: 6, cycle: STEP, squash: 0.03, tilt: 0.04 },
  ancient_ent: { fps: 3.5, cycle: STRIDE, squash: 0.02, tilt: 0.02 },
  goblin_king: { fps: 4, cycle: STRIDE, squash: 0.03, tilt: 0.02 },
  // Pico Congelado
  yeti: { fps: 6, cycle: STEP, squash: 0.03, tilt: 0.03 },
  snow_golem: { fps: 6, cycle: STEP, squash: 0.03, tilt: 0.03 },
  frost_wraith: { fps: 6, cycle: STEP, squash: 0.03, tilt: 0.04 },
  penguin: { fps: 9, cycle: STEP, squash: 0.04, tilt: 0.06 },
  snow_owl: { fps: 9, cycle: STEP, squash: 0.03, tilt: 0.05 },
  ice_dragon: { fps: 4, cycle: STRIDE, squash: 0.02, tilt: 0.015 },
  // Vulcão
  salamander: { fps: 9, cycle: STEP, squash: 0.03, tilt: 0.03 },
  ember_bat: { fps: 12, cycle: STEP, squash: 0.03, tilt: 0.05 },
  magma_golem: { fps: 5, cycle: STRIDE, squash: 0.03, tilt: 0.02 },
  fire_imp: { fps: 8, cycle: STEP, squash: 0.03, tilt: 0.05 },
  lava_serpent: { fps: 6, cycle: STEP, squash: 0.05, tilt: 0.02 },
  magma_titan: { fps: 3.5, cycle: STRIDE, squash: 0.02, tilt: 0.015 },
  // Ruínas Malditas
  zombie: { fps: 5, cycle: STEP, squash: 0.03, tilt: 0.06 },
  lost_soul: { fps: 8, cycle: STEP, squash: 0.05, tilt: 0.05 },
  phantom_knight: { fps: 6, cycle: STEP, squash: 0.02, tilt: 0.03 },
  skeleton_archer: { fps: 7, cycle: STEP, squash: 0.025, tilt: 0.05 },
  gargoyle: { fps: 7, cycle: FLAP, squash: 0.03, tilt: 0.05 },
  necromancer: { fps: 6, cycle: STEP, squash: 0.03, tilt: 0.04 },
  mimic: { fps: 6, cycle: FLAP, squash: 0.06, tilt: 0.03 },
  lich_king: { fps: 4, cycle: STRIDE, squash: 0.02, tilt: 0.015 },
  // Cidadela Demoníaca
  winged_imp: { fps: 12, cycle: STEP, squash: 0.03, tilt: 0.06 },
  hellhound: { fps: 10, cycle: STEP, squash: 0.03, tilt: 0.04 },
  demon_brute: { fps: 5, cycle: STEP, squash: 0.03, tilt: 0.03 },
  floating_eye: { fps: 7, cycle: STEP, squash: 0.05, tilt: 0.03 },
  demon_witch: { fps: 6, cycle: STEP, squash: 0.03, tilt: 0.04 },
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
    pose.slot = g.cycle === STRIDE || kind === 'hero' ? 'idle' : g.cycle[0];
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
