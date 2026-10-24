// Missões diárias (3 por dia, sorteadas pela data) e conquistas (em níveis, para a vida toda).
// As diárias dão ouro e pó; completar as 3 abre o Baú Diário (item Raro ou melhor). As conquistas
// dão ouro e pó, e as mais difíceis, Cristais de Evolução e Fragmentos Ancestrais.

/** O que uma partida soma nas missões e conquistas. */
export type RunStat = 'runs' | 'kills' | 'seconds' | 'bosses' | 'gems' | 'reactions' | 'elites' | 'petRuns' | 'gold' | 'victories';
/** Contadores da vida toda (as conquistas usam estes, mais os de fora da partida). */
export type LifeStat = RunStat | 'forged' | 'evolved' | 'hatched';

export interface DailyDef {
  id: string;
  stat: RunStat;
  target: number;
  text: string;
}

export const DAILY_POOL: DailyDef[] = [
  { id: 'kills', stat: 'kills', target: 500, text: 'Derrote 500 inimigos' },
  { id: 'kills2', stat: 'kills', target: 1200, text: 'Derrote 1.200 inimigos' },
  { id: 'seconds', stat: 'seconds', target: 600, text: 'Sobreviva 10 minutos (somando as partidas)' },
  { id: 'bosses', stat: 'bosses', target: 2, text: 'Vença 2 chefes' },
  { id: 'gems', stat: 'gems', target: 400, text: 'Colete 400 gemas' },
  { id: 'reactions', stat: 'reactions', target: 40, text: 'Cause 40 reações elementais' },
  { id: 'runs', stat: 'runs', target: 3, text: 'Jogue 3 partidas' },
  { id: 'elites', stat: 'elites', target: 8, text: 'Derrote 8 inimigos de elite' },
  { id: 'petRuns', stat: 'petRuns', target: 2, text: 'Jogue 2 partidas com um pet' },
  { id: 'gold', stat: 'gold', target: 300, text: 'Ganhe 300 de ouro nas partidas' },
];

export const DAILY_COUNT = 3;

/** Dia de hoje (no fuso do aparelho), como texto: as missões mudam à meia-noite. */
export function today(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** As 3 missões do dia: sorteio fixo pela data (todo mundo recebe as mesmas no mesmo dia). */
export function dailyFor(day: string): DailyDef[] {
  let seed = 0;
  for (const ch of day) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const pool = [...DAILY_POOL];
  const out: DailyDef[] = [];
  while (out.length < DAILY_COUNT && pool.length) {
    const d = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    // nunca duas missões do mesmo contador no mesmo dia
    if (!out.some((o) => o.stat === d.stat)) out.push(d);
  }
  return out;
}

/** Recompensa de cada missão diária (cresce com as fases vencidas). */
export const dailyReward = (stagesCleared: number) => ({ gold: 150 + 100 * stagesCleared, dust: 20 });

export interface Reward {
  gold?: number;
  dust?: number;
  crystals?: number;
  shards?: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  icon: string;
  stat: LifeStat | 'stagesCleared' | 'maxTier';
  /** níveis: meta e recompensa */
  tiers: { target: number; reward: Reward }[];
  text: (target: number) => string;
}

const n = (v: number) => v.toLocaleString('pt-BR');
const TIER_NAMES = ['Normal', 'Difícil', 'Muito Difícil', 'Pesadelo'];

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'kills', name: 'Exterminador', icon: 'icon_skull', stat: 'kills', text: (t) => `Derrote ${n(t)} inimigos`,
    tiers: [
      { target: 1000, reward: { gold: 300 } }, { target: 5000, reward: { gold: 800, dust: 50 } }, { target: 20000, reward: { gold: 2000, dust: 120 } },
      { target: 100000, reward: { gold: 6000, crystals: 1 } }, { target: 500000, reward: { gold: 20000, shards: 1 } },
    ],
  },
  {
    id: 'bosses', name: 'Caçador de Chefes', icon: 'icon_star', stat: 'bosses', text: (t) => `Vença ${n(t)} chefes`,
    tiers: [
      { target: 5, reward: { gold: 400 } }, { target: 25, reward: { gold: 1200, dust: 80 } }, { target: 100, reward: { gold: 4000, crystals: 1 } },
      { target: 300, reward: { gold: 12000, shards: 1 } },
    ],
  },
  {
    id: 'victories', name: 'Lenda', icon: 'icon_star', stat: 'victories', text: (t) => `Vença ${n(t)} ${t === 1 ? 'fase' : 'fases'} (chefe final)`,
    tiers: [{ target: 1, reward: { gold: 500 } }, { target: 5, reward: { gold: 1500, dust: 100 } }, { target: 20, reward: { gold: 5000, crystals: 1 } }, { target: 50, reward: { gold: 15000, shards: 1 } }],
  },
  {
    id: 'stages', name: 'Desbravador', icon: 'icon_boot', stat: 'stagesCleared', text: (t) => `Vença ${t} ${t === 1 ? 'fase diferente' : 'fases diferentes'}`,
    tiers: [{ target: 1, reward: { gold: 300 } }, { target: 3, reward: { gold: 1000, dust: 60 } }, { target: 6, reward: { gold: 3000, crystals: 1 } }, { target: 9, reward: { gold: 10000, shards: 1 } }],
  },
  {
    id: 'tier', name: 'Sem Medo', icon: 'icon_skull', stat: 'maxTier', text: (t) => `Vença uma fase no ${TIER_NAMES[t] ?? `Pesadelo+${t - 3}`}`,
    tiers: [{ target: 1, reward: { gold: 1500, crystals: 1 } }, { target: 2, reward: { gold: 4000, crystals: 1 } }, { target: 3, reward: { gold: 10000, shards: 1 } }],
  },
  {
    id: 'minutes', name: 'Sobrevivente', icon: 'icon_potion', stat: 'seconds', text: (t) => `Sobreviva ${n(t / 60)} minutos no total`,
    tiers: [{ target: 3600, reward: { gold: 400 } }, { target: 18000, reward: { gold: 1500, dust: 80 } }, { target: 60000, reward: { gold: 5000, crystals: 1 } }],
  },
  {
    id: 'reactions', name: 'Alquimista', icon: 'icon_element', stat: 'reactions', text: (t) => `Cause ${n(t)} reações elementais`,
    tiers: [{ target: 500, reward: { gold: 400 } }, { target: 5000, reward: { gold: 1500, dust: 80 } }, { target: 25000, reward: { gold: 5000, crystals: 1 } }],
  },
  {
    id: 'hatched', name: 'Criador', icon: 'egg_dragon', stat: 'hatched', text: (t) => `Choque ${t} ${t === 1 ? 'ovo' : 'ovos'}`,
    tiers: [{ target: 1, reward: { gold: 300 } }, { target: 6, reward: { gold: 1500, dust: 80 } }, { target: 20, reward: { gold: 5000, crystals: 1 } }],
  },
  {
    id: 'evolved', name: 'Evolução', icon: 'egg_fairy', stat: 'evolved', text: (t) => `Evolua pets ${t} ${t === 1 ? 'vez' : 'vezes'}`,
    tiers: [{ target: 1, reward: { gold: 400 } }, { target: 5, reward: { gold: 1500, dust: 80 } }, { target: 15, reward: { gold: 5000, crystals: 1 } }, { target: 30, reward: { gold: 15000, shards: 1 } }],
  },
  {
    id: 'forged', name: 'Ferreiro', icon: 'icon_anvil', stat: 'forged', text: (t) => `Forje itens ${t} vezes`,
    tiers: [{ target: 5, reward: { gold: 300, dust: 40 } }, { target: 25, reward: { gold: 1200, dust: 120 } }, { target: 100, reward: { gold: 4000, dust: 300 } }],
  },
];
