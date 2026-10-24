// Configurações do jogador (som, vibração, tremor de tela, números de dano, idioma), guardadas à parte
// do save do progresso: "reiniciar o progresso" não apaga as preferências.
export type Language = 'pt' | 'en';

export interface Settings {
  sound: boolean;
  vibration: boolean;
  /** tremor da câmera em golpes, explosões e chefes */
  shake: boolean;
  /** números de dano sobre os inimigos (os destaques, como crítico e reação, aparecem sempre) */
  damageNumbers: boolean;
  language: Language;
}

const KEY = 'survivor-settings';
const DEFAULTS: Settings = { sound: true, vibration: true, shake: true, damageNumbers: true, language: 'pt' };

function load(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings: Settings = load();

export function setSettings(patch: Partial<Settings>) {
  Object.assign(settings, patch);
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
}

/** Vibração curta (dano no herói, chefe vencido); no celular, quando permitido. */
export function vibrate(ms: number | number[]) {
  if (!settings.vibration) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    // sem suporte
  }
}
