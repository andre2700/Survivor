export type EnemyId = 'slime' | 'bat' | 'skeleton' | 'orc' | 'demon';

export interface EnemyDef {
  id: EnemyId;
  texture: string;
  hp: number;
  speed: number;
  damage: number;
  xp: number;
  scale: number;
  /** raio do corpo físico (px, antes da escala) */
  radius: number;
  /** resistência a empurrão (0 = sem empurrão, 1 = normal) */
  knockback: number;
}

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  slime: { id: 'slime', texture: 'slime', hp: 12, speed: 34, damage: 6, xp: 1, scale: 1, radius: 5, knockback: 1 },
  bat: { id: 'bat', texture: 'bat', hp: 8, speed: 58, damage: 5, xp: 1, scale: 1, radius: 5, knockback: 1.2 },
  skeleton: { id: 'skeleton', texture: 'skeleton', hp: 28, speed: 40, damage: 9, xp: 2, scale: 1, radius: 5, knockback: 0.8 },
  orc: { id: 'orc', texture: 'orc', hp: 75, speed: 31, damage: 14, xp: 4, scale: 1.5, radius: 6, knockback: 0.4 },
  demon: { id: 'demon', texture: 'demon', hp: 6000, speed: 42, damage: 25, xp: 150, scale: 3, radius: 6, knockback: 0 },
};
