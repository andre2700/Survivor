// Preferências de interface (ordem e filtro das listas), guardadas à parte do save do jogador.
const KEY = 'survivor-ui';

function all(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function getPref<T extends string>(key: string, options: readonly T[]): T {
  const v = all()[key] as T | undefined;
  return v && options.includes(v) ? v : options[0];
}

export function setPref(key: string, value: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...all(), [key]: value }));
  } catch {
    // sem armazenamento: vale só nesta tela
  }
}

/** Próxima opção da lista (os botões de ordem e filtro giram entre elas). */
export function nextPref<T extends string>(key: string, options: readonly T[]): T {
  const cur = getPref(key, options);
  const next = options[(options.indexOf(cur) + 1) % options.length];
  setPref(key, next);
  return next;
}
