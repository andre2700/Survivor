// Mochila e equipamento: o que está equipado, modificadores e efeitos que entram na partida,
// guardar itens novos (o excesso mais fraco vira pó), equipar, forjar e desmanchar.
import type { Modifier } from '../core/stats';
import {
  BAG_SIZE, EQUIP_SLOTS, baseOf, effectPower, forgeCost, itemModifiers, itemPower, salvageValue, slotOf,
  type EffectId, type EquipSlot, type ItemInstance,
} from '../data/items';
import type { SaveData } from './save';

export function findItem(save: SaveData, uid: number) {
  return save.items.find((i) => i.uid === uid);
}

/** Itens equipados (os que ainda existem na mochila). */
export function equippedItems(save: SaveData): ItemInstance[] {
  return EQUIP_SLOTS.map((s) => save.equipped[s]).filter((u): u is number => u !== undefined)
    .map((u) => findItem(save, u)).filter((i): i is ItemInstance => !!i);
}

export function equipmentModifiers(save: SaveData): Modifier[] {
  return equippedItems(save).flatMap(itemModifiers);
}

/** Efeitos únicos ativos e a força de cada um (dois itens com o mesmo efeito somam). */
export function activeEffects(save: SaveData): Partial<Record<EffectId, number>> {
  const out: Partial<Record<EffectId, number>> = {};
  for (const it of equippedItems(save)) if (it.effect) out[it.effect] = (out[it.effect] ?? 0) + effectPower(it);
  return out;
}

/** Em qual espaço o item está equipado (ou undefined). */
export function equippedSlot(save: SaveData, uid: number): EquipSlot | undefined {
  return EQUIP_SLOTS.find((s) => save.equipped[s] === uid);
}

/** Equipa no espaço do item (anel: no espaço livre, senão no primeiro). */
export function equip(save: SaveData, uid: number, target?: EquipSlot) {
  const it = findItem(save, uid);
  if (!it) return;
  const slot = baseOf(it.base).slot;
  const current = equippedSlot(save, uid);
  if (current) delete save.equipped[current];
  let to: EquipSlot = target ?? (slot === 'ring' ? (save.equipped.ring1 === undefined ? 'ring1' : save.equipped.ring2 === undefined ? 'ring2' : 'ring1') : slot);
  if (slotOf(to) !== slot) to = slot === 'ring' ? 'ring1' : (slot as EquipSlot);
  save.equipped[to] = uid;
}

export function unequip(save: SaveData, uid: number) {
  const s = equippedSlot(save, uid);
  if (s) delete save.equipped[s];
}

export function canForge(save: SaveData, it: ItemInstance) {
  const c = forgeCost(it);
  return save.gold >= c.gold && save.dust >= c.dust;
}

export function forge(save: SaveData, uid: number): boolean {
  const it = findItem(save, uid);
  if (!it || !canForge(save, it)) return false;
  const c = forgeCost(it);
  save.gold -= c.gold;
  save.dust -= c.dust;
  it.forge++;
  return true;
}

/** Desmancha o item (não equipado) e devolve o pó ganho. */
export function salvage(save: SaveData, uid: number): number {
  if (equippedSlot(save, uid)) return 0;
  const i = save.items.findIndex((x) => x.uid === uid);
  if (i < 0) return 0;
  const dust = salvageValue(save.items[i]);
  save.items.splice(i, 1);
  save.dust += dust;
  return dust;
}

/** Guarda itens novos; se a mochila passar do limite, os mais fracos (não equipados) viram pó. */
export function addItems(save: SaveData, items: ItemInstance[]) {
  save.items.push(...items);
  while (save.items.length > BAG_SIZE) {
    const free = save.items.filter((i) => !equippedSlot(save, i.uid));
    if (!free.length) break;
    const weakest = free.reduce((a, b) => (itemPower(a) <= itemPower(b) ? a : b));
    salvage(save, weakest.uid);
  }
}

/** Próximo uid de item (fica salvo para nunca repetir). */
export function nextUid(save: SaveData) {
  return save.nextItem++;
}
