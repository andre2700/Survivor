// Ferramentas de desenvolvedor: atalhos para testar o jogo (moedas, duração, imortalidade, velocidade).
// Ficam salvas à parte do save do jogador. Desligar DEV_TOOLS antes do lançamento.
import { RUN_DURATION } from '../data/waves';

/** Mostra o botão DEV no menu e na pausa. */
export const DEV_TOOLS = true;

export interface DevSettings {
  infiniteGold: boolean;
  /** duração da partida padrão até o chefe (min); as ondas de 15 min são comprimidas nela */
  runMinutes: number;
  heroImmortal: boolean;
  enemiesImmortal: boolean;
  /** multiplicador da velocidade do jogo */
  speed: number;
  /** todas as fases liberadas no mapa-múndi */
  allStages: boolean;
}

export const RUN_OPTIONS = [15, 5, 3, 1];
export const SPEED_OPTIONS = [1, 2, 4];
export const INFINITE_GOLD = 9_999_999;

const KEY = 'survivor-dev';
const DEFAULTS: DevSettings = { infiniteGold: false, runMinutes: 15, heroImmortal: false, enemiesImmortal: false, speed: 1, allStages: false };

function load(): DevSettings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export const dev: DevSettings = load();

export function setDev(patch: Partial<DevSettings>) {
  Object.assign(dev, patch);
  try {
    localStorage.setItem(KEY, JSON.stringify(dev));
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
}

/** Segundos até o chefe na partida padrão. */
export const runDuration = () => dev.runMinutes * 60;

/** Converte o tempo da partida no relógio das ondas (a linha de 15 min comprimida na duração escolhida). */
export const waveClock = (t: number) => t * (RUN_DURATION / runDuration());

/** Próxima opção de uma lista (os botões do painel giram entre os valores). */
export function cycle<T>(list: T[], current: T): T {
  return list[(list.indexOf(current) + 1) % list.length];
}
