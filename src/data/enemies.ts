import type { Element } from './weapons';

export type EnemyId = 'slime' | 'bat' | 'goblin' | 'wolf' | 'skeleton' | 'orc' | 'demon'
  | 'slime_fire' | 'slime_water' | 'goblin_earth' | 'bat_air'
  | 'slime_spit' | 'slime_magma' | 'slime_bomb' | 'orc_chief'
  | 'frog' | 'croc' | 'mosquito' | 'sporeshroom' | 'frog_shaman' | 'frog_king';

/**
 * Como o inimigo luta: corpo a corpo (encosta); à distância (mantém distância e atira, com aviso);
 * conjurador (usa uma habilidade do herói com nível); explosivo (corre, pisca e explode).
 */
export type Behavior = 'melee' | 'ranged' | 'caster' | 'exploder' | 'charger';

/** Habilidade de ataque de um inimigo (à distância, conjurador ou explosivo). */
export interface EnemySkill {
  /** tiro (gosma, esporos), bola de fogo e onda (habilidades do herói), explosão ou bote (avança de repente) */
  kind: 'spit' | 'fireball' | 'wave' | 'explode' | 'charge';
  /** dano em múltiplos do dano de contato do inimigo */
  damage: number;
  cooldown: number;
  /** distância em que ele usa a habilidade */
  range: number;
  /** tempo de aviso antes do disparo (s) */
  windup: number;
  speed: number;
  /** raio da área (bola de fogo, explosão) */
  radius: number;
  /** nível base da habilidade: cresce com a fase e o tempo (mais projéteis, área maior) */
  level: number;
}

export interface EnemyDef {
  id: EnemyId;
  /** criatura base (animação e comportamento): variantes elementais usam a da original */
  kind: string;
  name: string;
  texture: string;
  /** elemento do inimigo: resiste ao próprio elemento e não sofre o efeito dele (ver data/elements.ts) */
  element?: Element;
  hp: number;
  speed: number;
  damage: number;
  xp: number;
  scale: number;
  /** raio do corpo (px, antes da escala) */
  radius: number;
  /** peso: quanto um empurrão o move (0 = não se move, 1 = normal) */
  knockback: number;
  /** Resistência a controle (0 a 1): empurrão, congelamento, lentidão, puxão. Ver controlRoll. */
  resist: number;
  behavior?: Behavior;
  skill?: EnemySkill;
  /** chefe de fase: barra de vida na tela e pancada com aviso no chão */
  boss?: boolean;
}

/** Números da Resistência a controle. */
export const CONTROL_RULES = {
  /** chance de ignorar o controle = resistência × ignore */
  ignore: 0.6,
  /** quando pega, força e duração caem para 1 − resistência × reduce */
  reduce: 0.7,
  /** resistência extra dos elites */
  elite: 0.25,
  max: 0.9,
};

/**
 * Teste de controle contra a Resistência: 0 = ignorou; senão, o fator de força/duração do controle.
 * Monstros comuns (resistência 0) sofrem o controle inteiro; chefes ignoram muitas vezes e, quando
 * pegos, vão menos longe e ficam menos tempo.
 */
export function controlRoll(resist: number, rnd: () => number = Math.random): number {
  if (resist <= 0) return 1;
  if (rnd() < resist * CONTROL_RULES.ignore) return 0;
  return 1 - resist * CONTROL_RULES.reduce;
}

/** Força de um controle contínuo (lentidão, puxão), sem sorteio. */
export const controlScale = (resist: number) => 1 - resist * CONTROL_RULES.reduce;

const BASE = {
  slime: { id: 'slime', kind: 'slime', name: 'Slime', texture: 'slime', hp: 12, speed: 34, damage: 6, xp: 1, scale: 1, radius: 9, knockback: 1, resist: 0 },
  bat: { id: 'bat', kind: 'bat', name: 'Morcego', texture: 'bat', hp: 8, speed: 60, damage: 5, xp: 1, scale: 1, radius: 8, knockback: 1.2, resist: 0 },
  goblin: { id: 'goblin', kind: 'goblin', name: 'Goblin', texture: 'goblin', hp: 18, speed: 44, damage: 7, xp: 1, scale: 1, radius: 8, knockback: 1, resist: 0.05 },
  wolf: { id: 'wolf', kind: 'wolf', name: 'Lobo', texture: 'wolf', hp: 22, speed: 66, damage: 8, xp: 2, scale: 1, radius: 11, knockback: 0.9, resist: 0.1 },
  skeleton: { id: 'skeleton', kind: 'skeleton', name: 'Esqueleto', texture: 'skeleton', hp: 28, speed: 40, damage: 9, xp: 2, scale: 1, radius: 8, knockback: 0.8, resist: 0.15 },
  orc: { id: 'orc', kind: 'orc', name: 'Orc', texture: 'orc', hp: 75, speed: 31, damage: 14, xp: 4, scale: 1, radius: 13, knockback: 0.4, resist: 0.35 },
  demon: { id: 'demon', kind: 'demon', name: 'Demônio Ancestral', texture: 'demon', hp: 15000, speed: 42, damage: 25, xp: 150, scale: 1.3, radius: 22, knockback: 0, resist: 0.75, boss: true },
} satisfies Record<string, EnemyDef>;

/** Variante elemental: mesma criatura com outra cor, elemento e números um pouco maiores. */
function variant(of: EnemyDef, id: EnemyId, name: string, element: Element, extra: Partial<EnemyDef> = {}): EnemyDef {
  return { ...of, id, name, texture: id, element, hp: Math.round(of.hp * 1.4), xp: of.xp + 1, ...extra };
}

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  ...BASE,
  slime_fire: variant(BASE.slime, 'slime_fire', 'Slime de Fogo', 'fire', { damage: 8 }),
  slime_water: variant(BASE.slime, 'slime_water', "Slime d'Água", 'water', { speed: 38 }),
  goblin_earth: variant(BASE.goblin, 'goblin_earth', 'Goblin da Terra', 'earth', { hp: 32, speed: 40 }),
  bat_air: variant(BASE.bat, 'bat_air', 'Morcego do Vento', 'air', { speed: 72 }),
  // à distância: fica longe e cospe gosma no herói
  slime_spit: variant(BASE.slime, 'slime_spit', 'Slime Cuspidor', 'water', {
    hp: 16, speed: 30, behavior: 'ranged',
    skill: { kind: 'spit', damage: 1.2, cooldown: 2.6, range: 150, windup: 0.45, speed: 150, radius: 6, level: 1 },
  }),
  // conjurador: lança a Bola de Fogo do herói, com nível
  slime_magma: variant(BASE.slime, 'slime_magma', 'Slime de Magma', 'fire', {
    hp: 26, speed: 28, damage: 9, behavior: 'caster', resist: 0.1,
    skill: { kind: 'fireball', damage: 1.6, cooldown: 4, range: 170, windup: 0.8, speed: 120, radius: 22, level: 1 },
  }),
  // explosivo: corre, pisca e explode (fere o herói e os inimigos em volta)
  slime_bomb: variant(BASE.slime, 'slime_bomb', 'Slime Bomba', 'fire', {
    hp: 10, speed: 62, damage: 6, behavior: 'exploder',
    skill: { kind: 'explode', damage: 2.5, cooldown: 0, range: 26, windup: 0.6, speed: 0, radius: 40, level: 1 },
  }),
  // chefe do Bosque Outonal
  orc_chief: variant(BASE.orc, 'orc_chief', 'Chefe Orc', 'earth', {
    hp: 9000, speed: 40, damage: 22, xp: 120, scale: 2, radius: 15, knockback: 0, resist: 0.7, boss: true,
  }),
  // ---------- Pântano Enevoado ----------
  frog: { id: 'frog', kind: 'frog', name: 'Sapo do Brejo', texture: 'frog', element: 'water', hp: 20, speed: 46, damage: 8, xp: 1, scale: 1, radius: 9, knockback: 1, resist: 0 },
  // bote: para, se encolhe (aviso) e avança muito rápido em linha reta
  croc: {
    id: 'croc', kind: 'croc', name: 'Jacaré', texture: 'croc', element: 'earth', hp: 60, speed: 30, damage: 13, xp: 3, scale: 1, radius: 12, knockback: 0.5, resist: 0.25,
    behavior: 'charger', skill: { kind: 'charge', damage: 1.4, cooldown: 3.2, range: 120, windup: 0.6, speed: 260, radius: 0, level: 1 },
  },
  mosquito: { id: 'mosquito', kind: 'mosquito', name: 'Mosquito Gigante', texture: 'mosquito', element: 'air', hp: 6, speed: 74, damage: 4, xp: 1, scale: 1, radius: 7, knockback: 1.3, resist: 0 },
  // à distância: solta uma nuvem de esporos no herói
  sporeshroom: {
    id: 'sporeshroom', kind: 'sporeshroom', name: 'Cogumelo de Esporos', texture: 'sporeshroom', element: 'earth', hp: 26, speed: 26, damage: 8, xp: 2, scale: 1, radius: 10, knockback: 0.8, resist: 0.1,
    behavior: 'ranged', skill: { kind: 'spit', damage: 1.3, cooldown: 2.8, range: 150, windup: 0.5, speed: 120, radius: 7, level: 1 },
  },
  // conjurador: lança a Onda do herói (com nível) contra você
  frog_shaman: {
    id: 'frog_shaman', kind: 'frog_shaman', name: 'Xamã Sapo', texture: 'frog_shaman', element: 'water', hp: 40, speed: 30, damage: 10, xp: 3, scale: 1, radius: 9, knockback: 0.8, resist: 0.15,
    behavior: 'caster', skill: { kind: 'wave', damage: 1.5, cooldown: 4.5, range: 170, windup: 0.9, speed: 150, radius: 26, level: 1 },
  },
  frog_king: { id: 'frog_king', kind: 'frog_king', name: 'Rei Sapo', texture: 'frog_king', element: 'water', hp: 22000, speed: 40, damage: 26, xp: 160, scale: 1, radius: 24, knockback: 0, resist: 0.75, boss: true },
};

/** Cor das partículas quando o inimigo morre. */
export const DEATH_TINT: Record<EnemyId, number> = {
  slime: 0x6fdc72, bat: 0x7a4fa8, goblin: 0x5bb04f, wolf: 0x8f96a6, skeleton: 0xd5d1d6, orc: 0x7aab42, demon: 0xd23b35,
  slime_fire: 0xff7a2e, slime_water: 0x41a6f6, goblin_earth: 0xc69c6d, bat_air: 0xa7f070,
  slime_spit: 0xc06ad8, slime_magma: 0xff4a1a, slime_bomb: 0x5a4a4a, orc_chief: 0xb5532e,
  frog: 0x6fdc72, croc: 0x4fa040, mosquito: 0xe8c040, sporeshroom: 0xa070d0, frog_shaman: 0x41a6f6, frog_king: 0x5ab84a,
};
