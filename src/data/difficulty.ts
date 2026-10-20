// Dificuldades de cada fase: Normal, Difícil, Muito Difícil, Pesadelo e depois Pesadelo+1, +2... sem
// fim. Cada uma se libera vencendo o chefe final da anterior na mesma fase. Inimigos mais fortes,
// recompensas maiores.

/** Progresso numa dificuldade de uma fase: estrelas (objetivos) e quantos dos 3 chefes já venceu. */
export interface TierProgress {
  stars: boolean[];
  /** maior número de chefes vencidos numa partida (0 a 3) */
  bosses: number;
}

const NAMES = ['Normal', 'Difícil', 'Muito Difícil', 'Pesadelo'];

export function tierName(tier: number): string {
  return NAMES[tier] ?? `Pesadelo+${tier - 3}`;
}

/** Cor da etiqueta de cada dificuldade. */
export function tierColor(tier: number): number {
  return [0x8cf08a, 0xffd86a, 0xff9a4a, 0xff4a5a][tier] ?? 0xd06aff;
}

/** Multiplicadores de cada dificuldade (exponenciais, sem teto). */
export function tierScaling(tier: number) {
  return {
    hp: Math.pow(1.8, tier),
    damage: Math.pow(1.35, tier),
    /** ouro e experiência */
    reward: 1 + tier * 0.8,
    /** inimigos por segundo */
    rate: 1 + tier * 0.1,
  };
}

/** A dificuldade está liberada: a Normal sempre; as outras ao vencer o chefe final da anterior. */
export function tierUnlocked(progress: TierProgress[] | undefined, tier: number): boolean {
  return tier === 0 || !!progress?.[tier - 1]?.stars[0];
}

/** Maior dificuldade liberada da fase. */
export function maxTier(progress: TierProgress[] | undefined): number {
  let t = 0;
  while (tierUnlocked(progress, t + 1)) t++;
  return t;
}
