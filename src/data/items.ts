// Itens equipáveis (Marco 5): montados fora da partida, valem para todas as partidas. Cada item tem
// raridade, um atributo base do espaço, atributos aleatórios e, a partir do Raro, um efeito único que
// se vê na partida. A força acompanha onde o item caiu (fase e dificuldade); a forja melhora sem teto.
import type { Modifier, StatId } from '../core/stats';

export type SlotId = 'weapon' | 'offhand' | 'helm' | 'armor' | 'boots' | 'cape' | 'ring' | 'amulet' | 'relic';
/** Espaços do herói (dois anéis). */
export type EquipSlot = 'weapon' | 'offhand' | 'helm' | 'armor' | 'boots' | 'cape' | 'ring1' | 'ring2' | 'amulet' | 'relic';
export const EQUIP_SLOTS: EquipSlot[] = ['weapon', 'offhand', 'helm', 'armor', 'boots', 'cape', 'ring1', 'ring2', 'amulet', 'relic'];
export const slotOf = (s: EquipSlot): SlotId => (s === 'ring1' || s === 'ring2' ? 'ring' : s);

export const SLOT_NAMES: Record<SlotId, string> = {
  weapon: 'Arma', offhand: 'Mão secundária', helm: 'Elmo', armor: 'Armadura', boots: 'Botas', cape: 'Capa', ring: 'Anel', amulet: 'Amuleto', relic: 'Relíquia',
};

export const RARITIES = [
  { name: 'Comum', color: 0xc8ccd8, stats: 0, mult: 1 },
  { name: 'Incomum', color: 0x6ad86a, stats: 1, mult: 1.35 },
  { name: 'Raro', color: 0x5aa8ff, stats: 2, mult: 1.8 },
  { name: 'Épico', color: 0xb46aff, stats: 3, mult: 2.4 },
  { name: 'Lendário', color: 0xffa83a, stats: 3, mult: 3.2 },
  { name: 'Mítico', color: 0xff4a6a, stats: 4, mult: 4.3 },
] as const;
/** A partir desta raridade o item tem efeito único. */
export const EFFECT_RARITY = 2;

/** Quanto vale 1 ponto de cada atributo de item (Comum, nível de item 1). */
const STAT_ROLL: Partial<Record<StatId, { flat?: number; pct?: number }>> = {
  power: { flat: 0.04 },
  attackSpeed: { flat: 0.03 },
  critChance: { flat: 0.015 },
  critDamage: { flat: 0.08 },
  area: { flat: 0.04 },
  elementalPower: { flat: 0.05 },
  maxHp: { pct: 0.05 },
  defense: { flat: 1.5 },
  dodge: { flat: 2 },
  regen: { flat: 0.4 },
  lifesteal: { flat: 0.004 },
  moveSpeed: { pct: 0.03 },
  magnet: { pct: 0.1 },
  luck: { flat: 3 },
  wisdom: { flat: 0.04 },
  greed: { flat: 0.06 },
};
const RANDOM_STATS = Object.keys(STAT_ROLL) as StatId[];

/** Efeitos únicos (a partir do Raro), com o texto que aparece no item. */
export type EffectId =
  | 'executioner' | 'mirror' | 'dragonBreath' | 'thornBurst' | 'fireTrail' | 'stormCloak' | 'vampire' | 'chaos' | 'frostNova' | 'magnetPulse' | 'secondWind';

export const EFFECTS: Record<EffectId, { name: string; text: (k: number) => string }> = {
  executioner: { name: 'Carrasco', text: (k) => `Inimigos comuns com menos de ${Math.round(8 + 6 * k)}% de vida morrem na hora` },
  mirror: { name: 'Espelho', text: (k) => `${Math.round(Math.min(80, 20 + 15 * k))}% de chance de refletir tiros inimigos de volta` },
  dragonBreath: { name: 'Sopro do Dragão', text: (k) => `A cada ${Math.max(3, 9 - k).toFixed(0)} s, um sopro de fogo na direção em que você anda` },
  thornBurst: { name: 'Explosão de Espinhos', text: (k) => `Ao levar dano, espinhos explodem em volta (${Math.round(40 * k)} de dano base)` },
  fireTrail: { name: 'Passos Ígneos', text: (k) => `Deixa um rastro de fogo que queima (${Math.round(15 * k)} de dano base por segundo)` },
  stormCloak: { name: 'Manto da Tempestade', text: (k) => `Ao levar dano, raios atingem ${Math.min(10, 2 + Math.round(k))} inimigos` },
  vampire: { name: 'Vampiro', text: (k) => `Cada abate cura ${(0.4 + 0.3 * k).toFixed(1)} de vida` },
  chaos: { name: 'Caos', text: () => '+1 opção de carta a cada nível' },
  frostNova: { name: 'Nova de Gelo', text: (k) => `A cada ${Math.max(4, 11 - k).toFixed(0)} s, congela os inimigos em volta` },
  magnetPulse: { name: 'Ímã Ancestral', text: (k) => `A cada ${Math.max(8, 24 - 2 * k).toFixed(0)} s, puxa todas as gemas do mapa` },
  secondWind: { name: 'Segundo Fôlego', text: (k) => `Abaixo de 30% de vida, fica invulnerável por ${(1.5 + 0.5 * k).toFixed(1)} s (1 vez por minuto)` },
};

/** Modelos de item: espaço, nome, ícone, atributo base e efeitos possíveis. */
export interface ItemBase {
  id: string;
  slot: SlotId;
  name: string;
  icon: string;
  stat: StatId;
  effects: EffectId[];
}

export const ITEM_BASES: ItemBase[] = [
  { id: 'blade', slot: 'weapon', name: 'Lâmina', icon: 'item_blade', stat: 'power', effects: ['executioner'] },
  { id: 'warhammer', slot: 'weapon', name: 'Martelo de Guerra', icon: 'item_warhammer', stat: 'critDamage', effects: ['executioner'] },
  { id: 'staff', slot: 'weapon', name: 'Cajado', icon: 'item_staff', stat: 'elementalPower', effects: ['executioner'] },
  { id: 'shield', slot: 'offhand', name: 'Escudo', icon: 'item_shield', stat: 'defense', effects: ['mirror'] },
  { id: 'tome', slot: 'offhand', name: 'Tomo', icon: 'item_tome', stat: 'wisdom', effects: ['mirror', 'chaos'] },
  { id: 'dagger', slot: 'offhand', name: 'Adaga', icon: 'item_dagger', stat: 'critChance', effects: ['mirror'] },
  { id: 'helm', slot: 'helm', name: 'Elmo', icon: 'item_helm', stat: 'maxHp', effects: ['dragonBreath'] },
  { id: 'hood', slot: 'helm', name: 'Capuz', icon: 'item_hood', stat: 'dodge', effects: ['dragonBreath'] },
  { id: 'plate', slot: 'armor', name: 'Armadura de Placas', icon: 'item_plate', stat: 'defense', effects: ['thornBurst'] },
  { id: 'robe', slot: 'armor', name: 'Manto', icon: 'item_robe', stat: 'maxHp', effects: ['thornBurst'] },
  { id: 'boots', slot: 'boots', name: 'Botas', icon: 'item_boots', stat: 'moveSpeed', effects: ['fireTrail'] },
  { id: 'cape', slot: 'cape', name: 'Capa', icon: 'item_cape', stat: 'dodge', effects: ['stormCloak'] },
  { id: 'ring', slot: 'ring', name: 'Anel', icon: 'item_ring', stat: 'attackSpeed', effects: ['vampire', 'chaos'] },
  { id: 'signet', slot: 'ring', name: 'Anel de Sinete', icon: 'item_signet', stat: 'power', effects: ['vampire'] },
  { id: 'amulet', slot: 'amulet', name: 'Amuleto', icon: 'item_amulet', stat: 'luck', effects: ['frostNova'] },
  { id: 'relic', slot: 'relic', name: 'Relíquia', icon: 'item_relic', stat: 'area', effects: ['magnetPulse', 'secondWind'] },
  { id: 'idol', slot: 'relic', name: 'Ídolo', icon: 'item_idol', stat: 'greed', effects: ['magnetPulse', 'secondWind'] },
];

export const baseOf = (id: string) => ITEM_BASES.find((b) => b.id === id) ?? ITEM_BASES[0];

export interface ItemInstance {
  uid: number;
  base: string;
  rarity: number;
  /** nível do item (onde caiu: fase e dificuldade); a força dos atributos cresce com ele */
  ilvl: number;
  /** melhorias na forja (sem teto) */
  forge: number;
  /** atributos aleatórios: atributo e quantos pontos */
  rolls: { stat: StatId; points: number }[];
  effect?: EffectId;
}

/** Força de um item: raridade × nível do item × forja. */
export function itemPower(it: ItemInstance) {
  return RARITIES[it.rarity].mult * (1 + (it.ilvl - 1) * 0.18) * (1 + it.forge * 0.1);
}

/** Força do efeito único (cresce com raridade e forja). */
export function effectPower(it: ItemInstance) {
  return (it.rarity - EFFECT_RARITY + 1) * (1 + it.forge * 0.08);
}

function statValue(stat: StatId, points: number, power: number): Modifier {
  const r = STAT_ROLL[stat] ?? { flat: 0 };
  return { stat, flat: (r.flat ?? 0) * points * power, pct: (r.pct ?? 0) * points * power };
}

/** Modificadores de atributo do item (base + aleatórios). */
export function itemModifiers(it: ItemInstance): Modifier[] {
  const p = itemPower(it);
  const base = baseOf(it.base);
  return [statValue(base.stat, 2, p), ...it.rolls.map((r) => statValue(r.stat, r.points, p))];
}

/** Texto curto de um modificador ("+12% de dano"). */
export function describeModifier(m: Modifier): string {
  const NAMES: Partial<Record<StatId, [string, boolean]>> = {
    power: ['de dano', true], attackSpeed: ['de vel. de ataque', true], critChance: ['de chance crítica', true], critDamage: ['de dano crítico', true],
    area: ['de área', true], elementalPower: ['de potência elemental', true], maxHp: ['de vida máxima', true], defense: ['de defesa', false],
    dodge: ['de esquiva', false], regen: ['de vida por segundo', false], lifesteal: ['de roubo de vida', true], moveSpeed: ['de velocidade', true],
    magnet: ['de alcance de coleta', true], luck: ['de sorte', false], wisdom: ['de experiência', true], greed: ['de ouro', true],
  };
  const [name, percent] = NAMES[m.stat] ?? [m.stat, false];
  const v = (m.flat ?? 0) + (m.pct ?? 0);
  const shown = percent || m.pct ? `${(v * 100).toFixed(v * 100 >= 10 ? 0 : 1)}%` : v >= 10 ? v.toFixed(0) : v.toFixed(1);
  return `+${shown} ${name}`;
}

/** Nome completo: "Botas Lendárias" etc. (o efeito dá o sobrenome). */
export function itemName(it: ItemInstance) {
  const base = baseOf(it.base);
  return it.effect ? `${base.name} — ${EFFECTS[it.effect].name}` : base.name;
}

/**
 * Sorteio de raridade. `luck` (Sorte do herói) e `bonus` (fase, dificuldade, chefe) empurram para as
 * raras; `min` garante uma raridade mínima (chefe final).
 */
export function rollRarity(luck: number, bonus: number, min = 0, rnd = Math.random): number {
  const k = 1 + luck / 100 + bonus;
  const weights = [60, 26 * k, 9.5 * k, 3.4 * k * k, 0.9 * k * k, 0.2 * k * k * k];
  let r = rnd() * weights.reduce((a, b) => a + b, 0);
  let i = 0;
  while (i < weights.length - 1 && (r -= weights[i]) > 0) i++;
  return Math.max(min, i);
}

/** Cria um item: base (do espaço sorteado), raridade, nível e atributos aleatórios. */
export function makeItem(uid: number, rarity: number, ilvl: number, rnd = Math.random, baseId?: string): ItemInstance {
  const base = baseId ? baseOf(baseId) : ITEM_BASES[Math.floor(rnd() * ITEM_BASES.length)];
  const pool = RANDOM_STATS.filter((s) => s !== base.stat);
  const rolls: ItemInstance['rolls'] = [];
  for (let i = 0; i < RARITIES[rarity].stats; i++) {
    const stat = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    rolls.push({ stat, points: 1 + Math.floor(rnd() * 2) });
  }
  const effect = rarity >= EFFECT_RARITY ? base.effects[Math.floor(rnd() * base.effects.length)] : undefined;
  return { uid, base: base.id, rarity, ilvl: Math.max(1, Math.round(ilvl)), forge: 0, rolls, effect };
}

/** Preço da forja (ouro e pó), crescendo a cada nível; sem teto. */
export function forgeCost(it: ItemInstance) {
  return {
    gold: Math.round(40 * (1 + it.rarity) * Math.pow(1.32, it.forge) * (1 + (it.ilvl - 1) * 0.1)),
    dust: Math.round((2 + it.forge * 2) * (1 + it.rarity * 0.5)),
  };
}

/** Pó de forja ao desmanchar. */
export function salvageValue(it: ItemInstance) {
  return Math.round((1 + it.rarity) ** 2 * (1 + it.forge * 0.5) * (1 + it.ilvl * 0.05));
}

/** Nível de item que cai numa partida: cresce com a fase e com a dificuldade. */
export function dropLevel(stageIndex: number, tier: number) {
  return 1 + stageIndex * 2 + tier * 3;
}

/** Quantos itens o baú de fim de partida dá: 1 por sobreviver 3 min, +1 por chefe, +1 na vitória. */
export function lootCount(seconds: number, bosses: number, victory: boolean) {
  return (seconds >= 180 ? 1 : 0) + bosses + (victory ? 1 : 0);
}

/** Limite da mochila (o excesso mais fraco vira pó automaticamente). */
export const BAG_SIZE = 80;
