// Tradução: o jogo é escrito em português e cada texto é traduzido na hora de aparecer na tela
// (no setText de todo texto do Phaser), pelo dicionário em en.ts. Assim nenhuma tela precisa saber
// do idioma. Textos com números usam os padrões (expressões regulares) do mesmo arquivo. Texto sem
// tradução aparece em português e fica anotado em `missing` (o script de conferência lista).
import Phaser from 'phaser';
import { settings } from '../systems/settings';
import { EN, EN_PATTERNS } from './en';

/** textos que apareceram sem tradução (conferência: scripts/i18n-check.mjs) */
export const missing = new Set<string>();

const cache = new Map<string, string>();

/** Traduz um texto inteiro (ou devolve o próprio, em português). */
export function tr(s: string): string {
  if (settings.language === 'pt' || !s) return s;
  const hit = cache.get(s);
  if (hit !== undefined) return hit;
  const out = translate(s);
  cache.set(s, out);
  return out;
}

function translate(s: string): string {
  const exact = one(s);
  if (exact !== undefined) return exact;
  // textos compostos: cada linha e cada parte separada por " · " traduzidas sozinhas
  if (s.includes('\n')) return s.split('\n').map(translate).join('\n');
  if (s.includes(' · ')) return s.split(' · ').map(translate).join(' · ');
  if (s.includes(' — ')) return s.split(' — ').map(translate).join(' — ');
  // "Rótulo: valor" (cada lado traduzido)
  const colon = s.match(/^([^:]{2,40}): (.+)$/);
  if (colon) {
    const k = one(colon[1]);
    if (k !== undefined) return `${k}: ${translate(colon[2])}`;
  }
  // sinal/emoji no começo (✓, ○, ★, +, setas) e, se precisar, também no fim
  const lead = s.match(/^([^\p{L}\p{N}]+)(.+)$/u);
  if (lead) {
    const inner = one(lead[2]);
    if (inner !== undefined) return lead[1] + inner;
  }
  const deco = s.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}.!?]*)$/u);
  if (deco && (deco[1] || deco[3]) && deco[2]) {
    const inner = one(deco[2]);
    if (inner !== undefined) return deco[1] + inner + deco[3];
  }
  if (/[a-zà-ú]{2}/i.test(s) && !/^[\d\s.,:%+\-×x/()KMB]+$/.test(s) && !missing.has(s)) {
    missing.add(s);
    // guardado na sessão: a conferência lista o que faltou mesmo depois de recarregar a página
    try {
      sessionStorage.setItem('i18n-missing', JSON.stringify([...missing, ...JSON.parse(sessionStorage.getItem('i18n-missing') ?? '[]')]));
    } catch {
      // sem armazenamento: fica só na memória
    }
  }
  return s;
}

/** Tradução exata, sem diferenciar maiúsculas (mantém o texto todo em maiúsculas se o original for). */
function one(s: string): string | undefined {
  const direct = EN[s];
  if (direct !== undefined) return direct;
  const upper = s === s.toUpperCase() && /[A-ZÀ-Ú]/.test(s);
  const lower = !upper && s === s.toLowerCase();
  if (upper || lower) {
    const k = LOWER.get(s.toLowerCase());
    if (k !== undefined) return upper ? EN[k].toUpperCase() : EN[k].toLowerCase();
  }
  for (const [re, fn] of EN_PATTERNS) {
    const m = s.match(re);
    if (!m) continue;
    const out = typeof fn === 'string' ? s.replace(re, fn) : fn(m, translate, peek);
    // padrão que não soube traduzir as partes: tenta o próximo
    if (out === undefined) continue;
    return upper ? out.toUpperCase() : out;
  }
  return undefined;
}

/** Tradução sem anotar o que falta (os padrões testam pedaços antes de aceitar). */
function peek(s: string): string | undefined {
  return one(s);
}

/** índice sem maiúsculas: "CHEFE FINAL" acha "Chefe final" */
const LOWER = new Map(Object.keys(EN).map((k) => [k.toLowerCase(), k]));

/** Instala a tradução em todos os textos do Phaser (chamar uma vez, antes do jogo começar). */
export function installI18n() {
  const proto = Phaser.GameObjects.Text.prototype as unknown as { setText(v: string | string[]): unknown };
  const orig = proto.setText;
  proto.setText = function (this: Phaser.GameObjects.Text, value: string | string[]) {
    if (typeof value === 'string') value = tr(value);
    else if (Array.isArray(value)) value = value.map((v) => tr(v));
    return orig.call(this, value);
  };
  (window as unknown as { __i18nMissing: Set<string> }).__i18nMissing = missing;
}

/** Idioma trocado: limpa o cache (as telas se redesenham ao reiniciar). */
export function languageChanged() {
  cache.clear();
}
