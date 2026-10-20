import type { Element } from './weapons';

export type EnemyId = 'slime' | 'bat' | 'goblin' | 'wolf' | 'skeleton' | 'orc' | 'demon'
  | 'slime_fire' | 'slime_water' | 'goblin_earth' | 'bat_air'
  | 'slime_spit' | 'slime_magma' | 'slime_bomb' | 'orc_chief'
  | 'frog' | 'croc' | 'mosquito' | 'sporeshroom' | 'frog_shaman' | 'frog_king'
  | 'scorpion' | 'vulture' | 'cactus_spitter' | 'sandworm' | 'lizard_shaman' | 'scorpion_emperor'
  | 'werewolf' | 'wisp' | 'spider' | 'witch' | 'ancient_ent'
  | 'king_slime' | 'alpha_wolf' | 'magma_lord' | 'goblin_warlord' | 'croc_king' | 'grand_frog_shaman'
  | 'colossal_worm' | 'lizard_elder' | 'werewolf_alpha' | 'elder_witch';

/**
 * Como o inimigo luta: corpo a corpo (encosta); à distância (mantém distância e atira, com aviso);
 * conjurador (usa uma habilidade do herói com nível); explosivo (corre, pisca e explode).
 */
export type Behavior = 'melee' | 'ranged' | 'caster' | 'exploder' | 'charger' | 'burrower';

/** Habilidade de ataque de um inimigo (à distância, conjurador ou explosivo). */
export interface EnemySkill {
  /**
   * tiro (gosma, esporos, espinhos), teia (tiro que prende o herói), bola de fogo, onda, tornado e raio
   * (habilidades do herói), explosão, bote (avança de repente) ou toca (se enterra, anda por baixo da
   * areia e irrompe sob o herói)
   */
  kind: 'spit' | 'web' | 'fireball' | 'wave' | 'tornado' | 'strike' | 'explode' | 'charge' | 'burrow';
  /** tiros por disparo, em leque (padrão 1) */
  count?: number;
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
  demon: { id: 'demon', kind: 'demon', name: 'Demônio Ancestral', texture: 'demon', hp: 15000, speed: 42, damage: 25, xp: 150, scale: 1.6, radius: 22, knockback: 0, resist: 0.75, boss: true },
} satisfies Record<string, EnemyDef>;

/*
 * Chefes de fase ficam bem maiores que os monstros (cerca de 120 px de altura, quase 3× o herói) para
 * se destacarem na multidão: a escala de cada um compensa a altura da arte.
 */

/** Variante elemental: mesma criatura com outra cor, elemento e números um pouco maiores. */
function variant(of: EnemyDef, id: EnemyId, name: string, element: Element, extra: Partial<EnemyDef> = {}): EnemyDef {
  return { ...of, id, name, texture: id, element, hp: Math.round(of.hp * 1.4), xp: of.xp + 1, ...extra };
}

// os chefes gigantes entram logo abaixo (giant), por isso o tipo é afirmado aqui
export const ENEMIES = {
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
    hp: 15000, speed: 40, damage: 22, xp: 120, scale: 2.8, radius: 15, knockback: 0, resist: 0.7, boss: true,
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
  frog_king: { id: 'frog_king', kind: 'frog_king', name: 'Rei Sapo', texture: 'frog_king', element: 'water', hp: 15000, speed: 40, damage: 26, xp: 160, scale: 1.7, radius: 24, knockback: 0, resist: 0.75, boss: true },
  // ---------- Dunas Escaldantes ----------
  scorpion: { id: 'scorpion', kind: 'scorpion', name: 'Escorpião', texture: 'scorpion', element: 'earth', hp: 34, speed: 42, damage: 11, xp: 2, scale: 1, radius: 11, knockback: 0.7, resist: 0.15 },
  vulture: { id: 'vulture', kind: 'vulture', name: 'Abutre', texture: 'vulture', element: 'air', hp: 14, speed: 70, damage: 7, xp: 1, scale: 1, radius: 9, knockback: 1.1, resist: 0 },
  // à distância: um leque de espinhos
  cactus_spitter: {
    id: 'cactus_spitter', kind: 'cactus_spitter', name: 'Cacto Atirador', texture: 'cactus_spitter', element: 'earth', hp: 38, speed: 24, damage: 9, xp: 2, scale: 1, radius: 10, knockback: 0.6, resist: 0.2,
    behavior: 'ranged', skill: { kind: 'spit', damage: 1, cooldown: 3, range: 160, windup: 0.5, speed: 170, radius: 5, level: 1, count: 3 },
  },
  // toca: se enterra (aviso), anda como um monte de areia e irrompe sob o herói (círculo no chão)
  sandworm: {
    id: 'sandworm', kind: 'sandworm', name: 'Verme da Areia', texture: 'sandworm', element: 'earth', hp: 90, speed: 34, damage: 15, xp: 4, scale: 1, radius: 12, knockback: 0.4, resist: 0.35,
    behavior: 'burrower', skill: { kind: 'burrow', damage: 1.6, cooldown: 4.5, range: 200, windup: 0.5, speed: 150, radius: 30, level: 1 },
  },
  // conjurador: lança o Tornado do herói (com nível), que persegue devagar e puxa
  lizard_shaman: {
    id: 'lizard_shaman', kind: 'lizard_shaman', name: 'Xamã Lagarto', texture: 'lizard_shaman', element: 'air', hp: 48, speed: 32, damage: 11, xp: 3, scale: 1, radius: 9, knockback: 0.8, resist: 0.2,
    behavior: 'caster', skill: { kind: 'tornado', damage: 1.2, cooldown: 5, range: 180, windup: 0.9, speed: 70, radius: 18, level: 1 },
  },
  scorpion_emperor: { id: 'scorpion_emperor', kind: 'scorpion_emperor', name: 'Imperador Escorpião', texture: 'scorpion_emperor', element: 'earth', hp: 16000, speed: 44, damage: 30, xp: 180, scale: 1.8, radius: 26, knockback: 0, resist: 0.8, boss: true },
  // ---------- Floresta Sombria ----------
  // bote: se agacha (aviso) e salta em linha reta
  werewolf: {
    id: 'werewolf', kind: 'werewolf', name: 'Lobisomem', texture: 'werewolf', hp: 85, speed: 48, damage: 16, xp: 4, scale: 1, radius: 11, knockback: 0.5, resist: 0.3,
    behavior: 'charger', skill: { kind: 'charge', damage: 1.5, cooldown: 3, range: 130, windup: 0.5, speed: 300, radius: 0, level: 1 },
  },
  wisp: { id: 'wisp', kind: 'wisp', name: 'Fogo-Fátuo', texture: 'wisp', element: 'air', hp: 12, speed: 78, damage: 7, xp: 1, scale: 1, radius: 8, knockback: 1.2, resist: 0 },
  // à distância: cospe teia que prende o herói (fica bem mais lento por um instante)
  spider: {
    id: 'spider', kind: 'spider', name: 'Aranha Sombria', texture: 'spider', element: 'earth', hp: 40, speed: 40, damage: 10, xp: 2, scale: 1, radius: 10, knockback: 0.7, resist: 0.15,
    behavior: 'ranged', skill: { kind: 'web', damage: 0.8, cooldown: 3.4, range: 150, windup: 0.5, speed: 160, radius: 7, level: 1 },
  },
  // conjuradora: o Raio do herói (com nível: mais raios em volta), com círculo de aviso onde cai
  witch: {
    id: 'witch', kind: 'witch', name: 'Bruxa', texture: 'witch', element: 'air', hp: 55, speed: 30, damage: 12, xp: 3, scale: 1, radius: 9, knockback: 0.8, resist: 0.2,
    behavior: 'caster', skill: { kind: 'strike', damage: 1.8, cooldown: 4.5, range: 190, windup: 1, speed: 0, radius: 24, level: 1 },
  },
  ancient_ent: { id: 'ancient_ent', kind: 'ancient_ent', name: 'Ent Ancião Corrompido', texture: 'ancient_ent', element: 'earth', hp: 16000, speed: 36, damage: 34, xp: 200, scale: 1.6, radius: 28, knockback: 0, resist: 0.85, boss: true },
} as Record<EnemyId, EnemyDef>;

/**
 * Chefes do início e do meio de cada fase: criaturas da própria fase em versão gigante, com golpes de
 * chefe (data/bosses.ts). Usam a arte da criatura original, ampliada (cerca de 100 px de altura).
 */
function giant(of: EnemyDef, id: EnemyId, name: string, hp: number, scale: number, extra: Partial<EnemyDef> = {}): EnemyDef {
  return {
    ...of, id, name, hp, scale, boss: true, behavior: undefined, skill: undefined,
    damage: of.damage * 2.4, speed: of.speed * 0.8, xp: 60, radius: of.radius, knockback: 0, resist: 0.7, ...extra,
  };
}

Object.assign(ENEMIES, {
  king_slime: giant(ENEMIES.slime, 'king_slime', 'Rei Slime', 3500, 4.4),
  alpha_wolf: giant(ENEMIES.wolf, 'alpha_wolf', 'Lobo Alfa', 7000, 3.6, { speed: 60 }),
  magma_lord: giant(ENEMIES.slime_magma, 'magma_lord', 'Magma Primordial', 3500, 4.2),
  goblin_warlord: giant(ENEMIES.goblin_earth, 'goblin_warlord', 'Senhor da Guerra Goblin', 7000, 3.2),
  croc_king: giant(ENEMIES.croc, 'croc_king', 'Jacaré Rei', 3500, 3.6),
  grand_frog_shaman: giant(ENEMIES.frog_shaman, 'grand_frog_shaman', 'Grão-Xamã Sapo', 7000, 3.1),
  colossal_worm: giant(ENEMIES.sandworm, 'colossal_worm', 'Verme Colossal', 3800, 3.2),
  lizard_elder: giant(ENEMIES.lizard_shaman, 'lizard_elder', 'Ancião Lagarto', 7500, 3.1),
  werewolf_alpha: giant(ENEMIES.werewolf, 'werewolf_alpha', 'Lobisomem Alfa', 3800, 2.9, { speed: 52 }),
  elder_witch: giant(ENEMIES.witch, 'elder_witch', 'Bruxa Anciã', 7500, 3),
} satisfies Partial<Record<EnemyId, EnemyDef>>);

/** Cor das partículas quando o inimigo morre. */
export const DEATH_TINT: Record<EnemyId, number> = {
  slime: 0x6fdc72, bat: 0x7a4fa8, goblin: 0x5bb04f, wolf: 0x8f96a6, skeleton: 0xd5d1d6, orc: 0x7aab42, demon: 0xd23b35,
  slime_fire: 0xff7a2e, slime_water: 0x41a6f6, goblin_earth: 0xc69c6d, bat_air: 0xa7f070,
  slime_spit: 0xc06ad8, slime_magma: 0xff4a1a, slime_bomb: 0x5a4a4a, orc_chief: 0xb5532e,
  frog: 0x6fdc72, croc: 0x4fa040, mosquito: 0xe8c040, sporeshroom: 0xa070d0, frog_shaman: 0x41a6f6, frog_king: 0x5ab84a,
  king_slime: 0x6fdc72, alpha_wolf: 0x8f96a6, magma_lord: 0xff4a1a, goblin_warlord: 0xc69c6d, croc_king: 0x4fa040,
  grand_frog_shaman: 0x41a6f6, colossal_worm: 0xd8b880, lizard_elder: 0x9ad050, werewolf_alpha: 0x8a8f9a, elder_witch: 0x7ac050,
  scorpion: 0xe08a3a, vulture: 0x8a6a4a, cactus_spitter: 0x6ab84a, sandworm: 0xd8b880, lizard_shaman: 0x9ad050, scorpion_emperor: 0xe8c040,
  werewolf: 0x8a8f9a, wisp: 0x9af0f0, spider: 0x7a4fa8, witch: 0x7ac050, ancient_ent: 0x9a50d0,
};
