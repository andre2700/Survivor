const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];

/** Formata números grandes: 950 · 1,2K · 3,4M · 1,5e21. */
export function formatNumber(n: number): string {
  if (!isFinite(n)) return '∞';
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(n);
  if (v < 1000) return sign + String(Math.round(v));
  const tier = Math.floor(Math.log10(v) / 3);
  if (tier >= SUFFIXES.length) return sign + v.toExponential(1).replace('.', ',').replace('+', '');
  const scaled = v / Math.pow(1000, tier);
  const digits = scaled < 10 ? 1 : 0;
  return sign + scaled.toFixed(digits).replace('.', ',').replace(/,0$/, '') + SUFFIXES[tier];
}

/** Percentual com sinal opcional: 0.15 → "15%". */
export function formatPct(n: number): string {
  return `${formatNumber(Math.round(n * 1000) / 10)}%`;
}
