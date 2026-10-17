export type EnemyId = 'slime' | 'bat' | 'goblin' | 'wolf' | 'skeleton' | 'orc' | 'demon';

export interface EnemyDef {
  id: EnemyId;
  texture: string;
  hp: number;
  speed: number;
  damage: number;
  xp: number;
  scale: number;
  /** raio do corpo (px, antes da escala) */
  radius: number;
  /** resistência a empurrão (0 = sem empurrão, 1 = normal) */
  knockback: number;
}

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  slime: { id: 'slime', texture: 'slime', hp: 12, speed: 34, damage: 6, xp: 1, scale: 1, radius: 9, knockback: 1 },
  bat: { id: 'bat', texture: 'bat', hp: 8, speed: 60, damage: 5, xp: 1, scale: 1, radius: 8, knockback: 1.2 },
  goblin: { id: 'goblin', texture: 'goblin', hp: 18, speed: 44, damage: 7, xp: 1, scale: 1, radius: 8, knockback: 1 },
  wolf: { id: 'wolf', texture: 'wolf', hp: 22, speed: 66, damage: 8, xp: 2, scale: 1, radius: 11, knockback: 0.9 },
  skeleton: { id: 'skeleton', texture: 'skeleton', hp: 28, speed: 40, damage: 9, xp: 2, scale: 1, radius: 8, knockback: 0.8 },
  orc: { id: 'orc', texture: 'orc', hp: 75, speed: 31, damage: 14, xp: 4, scale: 1, radius: 13, knockback: 0.4 },
  demon: { id: 'demon', texture: 'demon', hp: 15000, speed: 42, damage: 25, xp: 150, scale: 1.3, radius: 22, knockback: 0 },
};

/** Cor das partículas quando o inimigo morre. */
export const DEATH_TINT: Record<EnemyId, number> = {
  slime: 0x6fdc72, bat: 0x7a4fa8, goblin: 0x5bb04f, wolf: 0x8f96a6, skeleton: 0xd5d1d6, orc: 0x7aab42, demon: 0xd23b35,
};
