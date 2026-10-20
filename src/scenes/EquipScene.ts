import Phaser from 'phaser';
import { formatNumber } from '../core/format';
import { getCharacter } from '../data/characters';
import {
  EFFECTS, EQUIP_SLOTS, RARITIES, SLOT_NAMES, baseOf, describeModifier, effectPower, forgeCost, itemModifiers, itemName, itemPower,
  salvageValue, type EquipSlot, type ItemInstance,
} from '../data/items';
import { canForge, equip, equipmentModifiers, equippedSlot, findItem, forge, salvage, unequip } from '../systems/inventory';
import { loadSave, writeSave } from '../systems/save';
import { sfx } from '../systems/sfx';
import { FONT, button, goldTitle, panel, px, text } from '../ui/theme';
import { itemCard, rarityHex } from '../ui/items';
import { VIEW, WIDE_COL, col, isWide, pointerPos, setupCamera } from '../ui/view';
import { goldPill, menuBackground } from './MenuScenes';

/** Ícone de cada espaço vazio do herói. */
const SLOT_ICON: Record<EquipSlot, string> = {
  weapon: 'item_blade', offhand: 'item_shield', helm: 'item_helm', armor: 'item_plate', boots: 'item_boots', cape: 'item_cape',
  ring1: 'item_ring', ring2: 'item_ring', amulet: 'item_amulet', relic: 'item_relic',
};

/** Resumo dos atributos que o equipamento soma (os mais relevantes). */
function equipmentSummary(mods: ReturnType<typeof equipmentModifiers>) {
  const total = new Map<string, { stat: (typeof mods)[number]['stat']; flat: number; pct: number }>();
  for (const m of mods) {
    const t = total.get(m.stat) ?? { stat: m.stat, flat: 0, pct: 0 };
    t.flat += m.flat ?? 0;
    t.pct += m.pct ?? 0;
    total.set(m.stat, t);
  }
  return [...total.values()].map((t) => describeModifier({ stat: t.stat, flat: t.flat, pct: t.pct }));
}

/**
 * Equipamento: o herói no meio com os 10 espaços em volta, a mochila embaixo (rolável, das mais
 * raras para as mais comuns). Tocar num item abre os detalhes: atributos, efeito único, comparação
 * com o equipado, e os botões de equipar, forjar e desmanchar.
 */
export class EquipScene extends Phaser.Scene {
  private scrollY = 0;
  private dragged = false;
  private detail: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('Equip');
  }

  create() {
    setupCamera(this);
    const { width, height } = VIEW;
    const save = loadSave();
    menuBackground(this, 0.6);
    goldPill(this, save.gold);
    const wide = isWide();
    const heroX = wide ? col(-1) : width / 2;
    goldTitle(this, heroX, wide ? 30 : 58, 'EQUIPAMENTO', 26);
    // pó de forja
    const dustX = wide ? col(-1) - WIDE_COL / 2 + 40 : 50;
    this.add.image(dustX - 16, wide ? 58 : 20, 'icon_dust').setScale(1.3);
    text(this, dustX + 2, wide ? 58 : 20, formatNumber(save.dust), 13, '#bff0ff', { bold: true, strokeThickness: 3 }).setOrigin(0, 0.5);

    // herói com os espaços em volta
    const top = wide ? 80 : 92;
    const slotSize = 44;
    const gap = 50;
    const hero = this.add.image(heroX, top + gap * 2.6, `portrait_${getCharacter(save.selected).texture}`).setOrigin(0.5, 0.5).setScale(3.4);
    hero.setAlpha(0.95);
    EQUIP_SLOTS.forEach((s, i) => {
      const left = i < 5;
      const x = heroX + (left ? -1 : 1) * (wide ? 100 : 118);
      const y = top + gap * (i % 5) + slotSize / 2;
      const it = save.equipped[s] !== undefined ? findItem(save, save.equipped[s]!) ?? null : null;
      const card = itemCard(this, x, y, it, slotSize, SLOT_ICON[s]);
      card.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        if (this.dragged) return;
        if (it) this.openDetail(it);
      });
    });
    // resumo dos bônus
    const summary = equipmentSummary(equipmentModifiers(save));
    const sumY = top + gap * 5 + 6;
    const sumText = text(this, heroX, sumY, summary.length ? summary.slice(0, 6).join(' · ') : 'Nada equipado: ganhe itens no baú do fim de cada partida', 10, '#c8f0c8', { wrap: wide ? WIDE_COL : width - 30 });

    // mochila
    const bagX = wide ? col(1) : width / 2;
    const bagW = wide ? WIDE_COL : width - 20;
    const bagTop = wide ? 60 : sumY + sumText.displayHeight * (1 - sumText.originY) + 26;
    const bagBottom = height - 60;
    text(this, bagX, bagTop - 14, `MOCHILA · ${save.items.length} itens`, 11, '#ffd86a', { bold: true });
    const cols = Math.max(4, Math.floor(bagW / 58));
    const cell = bagW / cols;
    const items = [...save.items].sort((a, b) => b.rarity - a.rarity || itemPower(b) - itemPower(a));
    const list = this.add.container(0, bagTop);
    items.forEach((it, i) => {
      const x = bagX - bagW / 2 + cell * (i % cols) + cell / 2;
      const y = Math.floor(i / cols) * cell + cell / 2;
      const card = itemCard(this, x, y, it, cell - 8);
      if (equippedSlot(save, it.uid)) card.add(this.add.text(0, cell / 2 - 10, 'EQUIPADO', { fontFamily: FONT, fontSize: px(7), fontStyle: 'bold', color: '#8cf08a', stroke: '#14101e', strokeThickness: 2 }).setOrigin(0.5, 1));
      card.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        if (this.dragged) return;
        this.openDetail(it);
      });
      list.add(card);
    });
    if (!items.length) text(this, bagX, bagTop + 40, 'Sua mochila está vazia.\nCada partida termina com um baú de itens:\nsobreviva, vença chefes e vença a fase.', 12, '#c8cce0').setAlign('center');
    const mask = this.make.graphics({}, false).fillRect(bagX - bagW / 2, bagTop - 2, bagW, bagBottom - bagTop + 4);
    list.setMask(mask.createGeometryMask());
    const contentH = Math.ceil(items.length / cols) * cell;
    const minY = Math.min(0, bagBottom - bagTop - contentH);
    this.scrollY = Phaser.Math.Clamp(this.scrollY, minY, 0);
    list.y = bagTop + this.scrollY;
    let startY = 0;
    let start = 0;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      startY = pointerPos(this, p).y;
      start = this.scrollY;
      this.dragged = false;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown || this.detail) return;
      const dy = pointerPos(this, p).y - startY;
      if (Math.abs(dy) > 6) this.dragged = true;
      this.scrollY = Phaser.Math.Clamp(start + dy, minY, 0);
      list.y = bagTop + this.scrollY;
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      this.scrollY = Phaser.Math.Clamp(this.scrollY - dy * 0.5, minY, 0);
      list.y = bagTop + this.scrollY;
    });

    button(this, width / 2, height - 30, 'VOLTAR', () => {
      sfx('select');
      this.scrollY = 0;
      this.scene.start('Menu');
    }, { width: 180, height: 38, size: 14 });
  }

  /** Detalhes do item: atributos, efeito, comparação e ações. */
  private openDetail(it: ItemInstance) {
    this.detail?.destroy();
    const { width, height } = VIEW;
    const save = loadSave();
    const c = this.add.container(0, 0).setDepth(100);
    this.detail = c;
    const shade = this.add.rectangle(width / 2, height / 2, VIEW.screenWidth, height, 0x07060c, 0.7).setInteractive();
    shade.on('pointerup', () => this.closeDetail());
    c.add(shade);
    const pw = Math.min(width - 24, 360);
    const ph = 370;
    const cx = width / 2;
    const cy = height / 2;
    c.add(panel(this, cx, cy, pw, ph, 'ui_panel_dark'));
    // impede que o toque no painel feche
    c.add(this.add.rectangle(cx, cy, pw, ph, 0, 0).setInteractive());
    const left = cx - pw / 2 + 16;
    let y = cy - ph / 2 + 18;
    const base = baseOf(it.base);
    c.add(itemCard(this, left + 26, y + 26, it, 54));
    const title = text(this, left + 64, y - 2, itemName(it), 14, rarityHex(it.rarity), { bold: true, strokeThickness: 3, wrap: pw - 96 }).setOrigin(0, 0);
    c.add(title);
    const ty = y - 2 + title.displayHeight + 8;
    c.add(text(this, left + 64, ty, `${RARITIES[it.rarity].name} · ${SLOT_NAMES[base.slot]} · nível ${it.ilvl}${it.forge ? ` · forja +${it.forge}` : ''}`, 10, '#c8cce0').setOrigin(0, 0.5));
    c.add(text(this, left + 64, ty + 16, `Força ${itemPower(it).toFixed(1)}`, 10, '#ffd86a').setOrigin(0, 0.5));
    y = Math.max(y + 70, ty + 34);
    // atributos
    for (const m of itemModifiers(it)) {
      c.add(text(this, left, y, describeModifier(m), 12, '#e8ecff').setOrigin(0, 0.5));
      y += 18;
    }
    // efeito único
    if (it.effect) {
      y += 4;
      const fx = EFFECTS[it.effect];
      c.add(text(this, left, y, `★ ${fx.name}`, 12, '#ffe9a0', { bold: true }).setOrigin(0, 0.5));
      y += 16;
      c.add(text(this, left, y, fx.text(effectPower(it)), 11, '#ffe9a0', { wrap: pw - 32 }).setOrigin(0, 0));
      y += 34;
    } else {
      c.add(text(this, left, y + 4, 'Itens Raros ou melhores têm um efeito único.', 10, '#8a8ca0').setOrigin(0, 0.5));
      y += 22;
    }
    // comparação com o equipado no mesmo espaço
    const where = equippedSlot(save, it.uid);
    if (!where) {
      const target = base.slot === 'ring' ? (save.equipped.ring1 === undefined ? 'ring1' : save.equipped.ring2 === undefined ? 'ring2' : 'ring1') : (base.slot as EquipSlot);
      const cur = save.equipped[target] !== undefined ? findItem(save, save.equipped[target]!) : undefined;
      const diff = cur ? itemPower(it) - itemPower(cur) : itemPower(it);
      const msg = !cur ? 'Espaço vazio: equipar já deixa você mais forte' : diff > 0 ? `Mais forte que o equipado (+${diff.toFixed(1)} de força)` : `Mais fraco que o equipado (${diff.toFixed(1)})`;
      c.add(text(this, cx, y + 6, msg, 11, !cur || diff > 0 ? '#8cf08a' : '#ff9a7a').setOrigin(0.5, 0.5));
    }
    // ações
    const by = cy + ph / 2 - 62;
    const bw = (pw - 40) / 3;
    const cost = forgeCost(it);
    c.add(button(this, cx - bw - 6, by, where ? 'REMOVER' : 'EQUIPAR', () => {
      const s = loadSave();
      if (where) unequip(s, it.uid);
      else equip(s, it.uid);
      writeSave(s);
      sfx('select');
      this.scene.restart();
    }, { width: bw, height: 34, size: 12, variant: where ? 'normal' : 'primary' }));
    const can = canForge(save, it);
    c.add(button(this, cx, by, `FORJAR`, () => {
      const s = loadSave();
      if (!forge(s, it.uid)) return;
      writeSave(s);
      sfx('levelup');
      this.closeDetail();
      this.openDetail(findItem(s, it.uid)!);
    }, { width: bw, height: 34, size: 12, variant: can ? 'purple' : 'normal', disabled: !can, icon: 'icon_anvil' }));
    c.add(text(this, cx, by + 26, `${formatNumber(cost.gold)} ouro · ${cost.dust} pó`, 9, can ? '#ffd86a' : '#8a8ca0'));
    c.add(button(this, cx + bw + 6, by, 'DESMANCHAR', () => {
      const s = loadSave();
      const got = salvage(s, it.uid);
      if (!got) return;
      writeSave(s);
      sfx('pickup');
      this.scene.restart();
    }, { width: bw, height: 34, size: 11, disabled: !!where }));
    c.add(text(this, cx + bw + 6, by + 26, where ? 'equipado' : `+${salvageValue(it)} pó`, 9, '#bff0ff'));
    c.add(button(this, cx, cy + ph / 2 - 18, 'FECHAR', () => this.closeDetail(), { width: 120, height: 28, size: 12 }));
  }

  private closeDetail() {
    this.detail?.destroy();
    this.detail = null;
  }
}
