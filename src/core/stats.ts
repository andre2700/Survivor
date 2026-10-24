// Atributos globais: o mesmo sistema serve para herói, aliados e (parcialmente) inimigos.
// Nenhum atributo tem teto; atributos que poderiam "quebrar" o jogo usam retorno decrescente.

export const STAT_IDS = [
  'power', 'attackSpeed', 'amount', 'area', 'duration', 'projectileSpeed', 'pierce',
  'critChance', 'critDamage', 'elementalPower',
  'maxHp', 'regen', 'defense', 'dodge', 'lifesteal', 'thorns',
  'moveSpeed', 'magnet', 'luck', 'wisdom', 'greed', 'revives', 'curse',
] as const;

export type StatId = (typeof STAT_IDS)[number];
export type Stats = Record<StatId, number>;

/** Um modificador soma `flat` ao valor base e `pct` ao multiplicador percentual. */
export interface Modifier {
  stat: StatId;
  flat?: number;
  pct?: number;
}

/** Valores base de qualquer herói antes de personagem, meta e cartas. */
export const BASE_STATS: Stats = {
  power: 0, // +% de dano (0.25 = +25%)
  attackSpeed: 0, // +% de velocidade de ataque
  amount: 0, // projéteis/golpes extras
  area: 0,
  duration: 0,
  projectileSpeed: 0,
  pierce: 0,
  critChance: 0.05,
  critDamage: 1.5, // multiplicador do crítico
  elementalPower: 0,
  maxHp: 100,
  regen: 0, // vida por segundo
  defense: 0, // pontos
  dodge: 0, // pontos
  lifesteal: 0, // fração do dano causado
  thorns: 0, // dano devolvido ao toque
  moveSpeed: 60, // px/s
  magnet: 40, // px
  luck: 0, // pontos
  wisdom: 0, // +% de XP
  greed: 0, // +% de ouro
  revives: 0,
  curse: 0, // +% inimigos e recompensas
};

/** Combina base + modificadores: (base + Σflat) × (1 + Σpct). */
export function combine(base: Stats, mods: Modifier[]): Stats {
  const flat: Partial<Record<StatId, number>> = {};
  const pct: Partial<Record<StatId, number>> = {};
  for (const m of mods) {
    if (m.flat) flat[m.stat] = (flat[m.stat] ?? 0) + m.flat;
    if (m.pct) pct[m.stat] = (pct[m.stat] ?? 0) + m.pct;
  }
  const out = { ...base };
  for (const id of STAT_IDS) out[id] = (base[id] + (flat[id] ?? 0)) * (1 + (pct[id] ?? 0));
  return out;
}

// ---------- Valores derivados ----------

export const damageMult = (s: Stats) => Math.max(0.1, 1 + s.power);
/** Recarga nunca chega a zero: base ÷ (1 + velocidade de ataque). */
export const cooldownMult = (s: Stats) => 1 / (1 + Math.max(-0.5, s.attackSpeed));
export const areaMult = (s: Stats) => Math.max(0.2, 1 + s.area);
export const durationMult = (s: Stats) => Math.max(0.2, 1 + s.duration);
export const projectileSpeedMult = (s: Stats) => Math.max(0.2, 1 + s.projectileSpeed);
export const xpMult = (s: Stats) => 1 + s.wisdom;
export const goldMult = (s: Stats) => (1 + s.greed) * (1 + s.curse);

/** Retorno decrescente: p / (p + k), entre 0 e 1. */
export const diminishing = (p: number, k: number) => (p <= 0 ? 0 : p / (p + k));

/** Fração de dano bloqueada pela defesa (20 pontos = 50%). */
export const defenseReduction = (s: Stats) => diminishing(s.defense, 20);
/** Chance de esquiva (50 pontos = 50%). */
export const dodgeChance = (s: Stats) => diminishing(s.dodge, 50);

/** Velocidade de movimento com retorno decrescente acima do dobro da base. */
export function moveSpeed(s: Stats, base = BASE_STATS.moveSpeed): number {
  const ratio = s.moveSpeed / base;
  if (ratio <= 2) return s.moveSpeed;
  return base * (2 + Math.sqrt(ratio - 2) * 0.6);
}

/**
 * Nível de crítico de um golpe: 0 normal, 1 crítico, 2 supercrítico, ...
 * A parte inteira da chance é garantida; a fração é a chance do próximo nível.
 */
export function rollCritTier(chance: number, rnd: () => number = Math.random): number {
  if (chance <= 0) return 0;
  const whole = Math.floor(chance);
  return whole + (rnd() < chance - whole ? 1 : 0);
}

export const critMultiplier = (s: Stats, tier: number) => (tier <= 0 ? 1 : Math.pow(Math.max(1, s.critDamage), tier));

/** Dano recebido após defesa (mínimo 1). */
export function damageTaken(raw: number, s: Stats): number {
  return Math.max(1, raw * (1 - defenseReduction(s)));
}
