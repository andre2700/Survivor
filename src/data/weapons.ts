export type WeaponId = 'wand' | 'sword' | 'axe' | 'orb' | 'aura' | 'lightning' | 'knives';

export interface WeaponStats {
  damage: number;
  /** segundos entre ataques (para orbe/aura: intervalo de dano por inimigo) */
  cooldown: number;
  amount: number;
  pierce: number;
  /** multiplicador de área/tamanho */
  area: number;
  /** velocidade do projétil (px/s) ou rotação (rad/s) no caso do orbe */
  speed: number;
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  icon: string;
  description: string;
  /** Stats absolutos por nível (índice 0 = nível 1). */
  levels: WeaponStats[];
  /** Texto exibido ao subir para o nível N (índice 0 = nível 2). */
  upgrades: string[];
}

function lv(base: WeaponStats, ...changes: Partial<WeaponStats>[]): WeaponStats[] {
  const out = [base];
  for (const c of changes) out.push({ ...out[out.length - 1], ...c });
  return out;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  wand: {
    id: 'wand',
    name: 'Varinha Mágica',
    icon: 'bolt',
    description: 'Dispara orbes no inimigo mais próximo.',
    levels: lv(
      { damage: 10, cooldown: 1.1, amount: 1, pierce: 1, area: 1, speed: 240 },
      { amount: 2 },
      { damage: 15 },
      { cooldown: 0.85 },
      { amount: 3 },
      { damage: 22, pierce: 2 },
    ),
    upgrades: ['+1 projétil', '+50% de dano', 'Dispara mais rápido', '+1 projétil', '+dano e atravessa inimigos'],
  },
  sword: {
    id: 'sword',
    name: 'Espada',
    icon: 'icon_sword',
    description: 'Golpe em arco na direção em que você anda.',
    levels: lv(
      { damage: 20, cooldown: 1.05, amount: 1, pierce: 99, area: 1, speed: 0 },
      { damage: 28 },
      { amount: 2 },
      { area: 1.3 },
      { damage: 38 },
      { cooldown: 0.8, area: 1.5 },
    ),
    upgrades: ['+33% de dano', 'Golpeia para os dois lados', '+30% de alcance', '+33% de dano', 'Mais rápido e maior'],
  },
  axe: {
    id: 'axe',
    name: 'Machado',
    icon: 'axe',
    description: 'Arremessa machados em arco. Dano alto.',
    levels: lv(
      { damage: 25, cooldown: 1.8, amount: 1, pierce: 3, area: 1, speed: 300 },
      { amount: 2 },
      { damage: 35 },
      { pierce: 5, area: 1.25 },
      { amount: 3 },
      { damage: 50 },
    ),
    upgrades: ['+1 machado', '+40% de dano', 'Maior e atravessa mais', '+1 machado', '+40% de dano'],
  },
  orb: {
    id: 'orb',
    name: 'Orbe Sagrado',
    icon: 'orb',
    description: 'Orbes giram ao seu redor causando dano.',
    levels: lv(
      { damage: 8, cooldown: 0.5, amount: 2, pierce: 99, area: 1, speed: 3 },
      { amount: 3 },
      { damage: 12 },
      { area: 1.3, speed: 3.8 },
      { amount: 4 },
      { damage: 18, amount: 5 },
    ),
    upgrades: ['+1 orbe', '+50% de dano', 'Raio maior e mais rápido', '+1 orbe', '+dano e +1 orbe'],
  },
  aura: {
    id: 'aura',
    name: 'Aura de Fogo',
    icon: 'icon_fire',
    description: 'Queima inimigos próximos continuamente.',
    levels: lv(
      { damage: 5, cooldown: 0.5, amount: 1, pierce: 99, area: 1, speed: 0 },
      { area: 1.2 },
      { damage: 8 },
      { area: 1.4 },
      { cooldown: 0.38 },
      { damage: 12, area: 1.6 },
    ),
    upgrades: ['+20% de área', '+60% de dano', '+20% de área', 'Queima mais rápido', '+dano e +área'],
  },
  lightning: {
    id: 'lightning',
    name: 'Raio',
    icon: 'icon_bolt',
    description: 'Raios atingem inimigos aleatórios na tela.',
    levels: lv(
      { damage: 22, cooldown: 2.2, amount: 2, pierce: 99, area: 1, speed: 0 },
      { amount: 3 },
      { damage: 32 },
      { cooldown: 1.7 },
      { amount: 4 },
      { damage: 45, area: 1.5 },
    ),
    upgrades: ['+1 raio', '+45% de dano', 'Cai mais rápido', '+1 raio', '+dano e área maior'],
  },
  knives: {
    id: 'knives',
    name: 'Adagas',
    icon: 'knife',
    description: 'Lança adagas rápidas na direção do movimento.',
    levels: lv(
      { damage: 7, cooldown: 0.45, amount: 1, pierce: 1, area: 1, speed: 360 },
      { amount: 2 },
      { damage: 10 },
      { cooldown: 0.34 },
      { amount: 3 },
      { damage: 13, pierce: 2 },
    ),
    upgrades: ['+1 adaga', '+40% de dano', 'Lança mais rápido', '+1 adaga', '+dano e atravessa'],
  },
};

export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];
export const MAX_WEAPONS = 5;
