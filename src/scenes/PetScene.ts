import Phaser from 'phaser';
import { frameHd } from '../art/textures';
import { formatNumber } from '../core/format';
import {
  PETS, PET_STAGE_LEVELS, STAGE_NAMES, feedCost, feedXp, getPet, petStage, petXpToNext, type PetDef, type PetId,
} from '../data/pets';
import { eggReady, feed, hatch, type Egg } from '../systems/pets';
import { loadSave, writeSave } from '../systems/save';
import { sfx } from '../systems/sfx';
import { button, goldTitle, panel, text } from '../ui/theme';
import { VIEW, WIDE_COL, col, isWide, setupCamera } from '../ui/view';
import { goldPill, menuBackground } from './MenuScenes';

const ELEMENT_NAMES: Record<string, string> = { fire: 'Fogo', water: 'Água', air: 'Ar', earth: 'Terra', light: 'Luz', dark: 'Sombra', physical: 'Físico' };

/**
 * Pets: o pet em destaque (estágio, nível, XP, o que faz e as evoluções), a coleção dos 6 pets (os que
 * faltam aparecem como "?"), a chocadeira com os ovos e os botões de levar na partida e dar ração.
 */
export class PetScene extends Phaser.Scene {
  private view?: PetId;

  constructor() {
    super('Pets');
  }

  init(data: { view?: PetId }) {
    this.view = data.view;
  }

  create() {
    setupCamera(this);
    const { width, height } = VIEW;
    const save = loadSave();
    menuBackground(this, 0.6);
    goldPill(this, save.gold);
    const wide = isWide();
    const leftX = wide ? col(-1) : width / 2;
    const rightX = wide ? col(1) : width / 2;
    const colW = wide ? WIDE_COL : width - 24;
    goldTitle(this, leftX, wide ? 30 : 58, 'PETS', 28);

    const owned = PETS.filter((p) => save.pets[p.id]);
    const shown = this.view && save.pets[this.view] ? getPet(this.view) : owned.find((p) => p.id === save.activePet) ?? owned[0];

    // pet em destaque
    const topY = wide ? 60 : 92;
    const cardH = 272;
    panel(this, leftX, topY + cardH / 2, colW, cardH, 'ui_panel_dark');
    if (shown) this.petCard(shown, leftX, topY, colW, save.activePet === shown.id);
    else {
      this.add.image(leftX, topY + 90, 'egg_dragon').setScale(3.4).setTintFill(0x2a2c3a).setAlpha(0.8);
      text(this, leftX, topY + 150, 'Nenhum pet ainda', 16, '#ffd86a', { bold: true });
      text(this, leftX, topY + 190, 'Vença um chefe para ganhar seu primeiro ovo.\nOvos caem de chefes e elites e chocam enquanto você joga.', 11, '#c8cce0', { wrap: colW - 30 }).setAlign('center');
    }

    // coleção
    let y = wide ? topY : topY + cardH + 24;
    text(this, rightX, y, `COLEÇÃO · ${owned.length}/${PETS.length}`, 12, '#ffd86a', { bold: true });
    y += 40;
    const cell = Math.min(60, (colW - 10) / PETS.length);
    PETS.forEach((p, i) => {
      const x = rightX + (i - (PETS.length - 1) / 2) * cell;
      const have = save.pets[p.id];
      const g = this.add.graphics();
      const sel = shown?.id === p.id;
      g.fillStyle(0x14121f, 0.9).fillRoundedRect(x - cell / 2 + 3, y - cell / 2 + 3, cell - 6, cell - 6, 8);
      g.lineStyle(sel ? 3 : 1.5, sel ? 0xffd86a : have ? 0x8a8ca0 : 0x3a3a4a, 1).strokeRoundedRect(x - cell / 2 + 3, y - cell / 2 + 3, cell - 6, cell - 6, 8);
      if (have) {
        const img = this.add.image(x, y, p.textures[petStage(have.level)]);
        img.setScale(((cell * 0.72) / Math.max(img.width, img.height)) * frameHd(img));
        text(this, x, y + cell / 2 - 8, `nv ${have.level}`, 9, '#ffe9a0', { bold: true, strokeThickness: 3 });
        const hit = this.add.zone(x, y, cell, cell).setInteractive({ useHandCursor: true });
        hit.on('pointerup', () => {
          sfx('select');
          this.scene.restart({ view: p.id });
        });
      } else text(this, x, y - 2, '?', 22, p.available ? '#8a8ca0' : '#4a4c5a', { bold: true });
    });
    y += cell / 2 + 10;
    text(this, rightX, y, 'Os "?" são pets ainda não encontrados', 10, '#8a8ca0');

    // chocadeira
    y += 30;
    text(this, rightX, y, 'CHOCADEIRA', 12, '#ffd86a', { bold: true });
    y += 16;
    if (!save.eggs.length) {
      text(this, rightX, y + 22, 'Sem ovos. Chefes e elites às vezes deixam um ovo no baú.', 11, '#a8acc4', { wrap: colW - 20 });
    } else {
      save.eggs.forEach((egg, i) => this.eggRow(egg, i, rightX, y + 32 + i * 50, colW));
    }

    button(this, width / 2, height - 30, 'VOLTAR', () => {
      sfx('select');
      this.scene.start('Menu');
    }, { width: 180, height: 38, size: 14 });
  }

  private petCard(p: PetDef, cx: number, top: number, w: number, active: boolean) {
    const save = loadSave();
    const st = save.pets[p.id]!;
    const stage = petStage(st.level);
    const left = cx - w / 2;
    // arte grande do estágio atual, flutuando
    const img = this.add.image(left + 74, top + 82, p.textures[stage]).setScale(3.6 - stage * 0.55);
    this.tweens.add({ targets: img, y: img.y - 5, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const tx = left + 150;
    text(this, tx, top + 22, p.name, 17, '#ffd86a', { bold: true, strokeThickness: 4 }).setOrigin(0, 0.5);
    text(this, tx, top + 44, `${STAGE_NAMES[stage]} · ${ELEMENT_NAMES[p.element]}`, 11, '#c8cce0').setOrigin(0, 0.5);
    text(this, tx, top + 66, `Nível ${st.level}`, 14, '#ffffff', { bold: true }).setOrigin(0, 0.5);
    // barra de XP
    const bw = w - 168;
    const need = petXpToNext(st.level);
    const g = this.add.graphics();
    g.fillStyle(0x0d0b16, 1).fillRoundedRect(tx, top + 80, bw, 10, 5);
    g.fillStyle(0x8cf08a, 1).fillRoundedRect(tx, top + 80, Math.max(6, bw * (st.xp / need)), 10, 5);
    text(this, tx + bw, top + 98, `${formatNumber(st.xp)}/${formatNumber(need)} XP`, 9, '#a8acc4').setOrigin(1, 0.5);
    // evoluções
    const ey = top + 152;
    for (let k = 0; k < 3; k++) {
      const x = left + 50 + k * ((w - 100) / 2);
      const e = this.add.image(x, ey, p.textures[k]);
      e.setScale((40 / Math.max(e.width, e.height)) * frameHd(e));
      if (k > stage) e.setTintFill(0x1a1a28);
      text(this, x, ey + 26, k > stage ? `nv ${PET_STAGE_LEVELS[k]}` : STAGE_NAMES[k], 10, k === stage ? '#ffd86a' : k < stage ? '#c8cce0' : '#8a8ca0', { bold: k === stage });
      if (k < 2) text(this, x + (w - 100) / 4, ey, '›', 18, '#8a8ca0', { bold: true });
    }
    text(this, cx, top + 200, p.skills[stage], 11, '#ffe9a0', { wrap: w - 30 });
    // botões
    const by = top + 234;
    const cost = feedCost(st.level);
    button(this, cx - 74, by, `RAÇÃO ${formatNumber(cost)}`, () => {
      if (!feed(save, p.id)) return sfx('hurt');
      writeSave(save);
      sfx('pickup');
      this.scene.restart({ view: p.id });
    }, { width: 136, height: 32, size: 11, icon: 'coin', disabled: save.gold < cost });
    if (active) text(this, cx + 74, by, '✓ VAI NA PARTIDA', 11, '#8cf08a', { bold: true });
    else {
      button(this, cx + 74, by, 'LEVAR NA PARTIDA', () => {
        save.activePet = p.id;
        writeSave(save);
        sfx('select');
        this.scene.restart({ view: p.id });
      }, { width: 136, height: 32, size: 10, variant: 'primary' });
    }
    text(this, cx, by + 26, `Ração: +${formatNumber(feedXp(st.level))} XP`, 9, '#8a8ca0');
  }

  private eggRow(egg: Egg, i: number, cx: number, y: number, w: number) {
    const p = getPet(egg.pet);
    const left = cx - w / 2 + 16;
    const img = this.add.image(left + 18, y, p.egg).setScale(1.6);
    const ready = eggReady(egg);
    if (ready) this.tweens.add({ targets: img, angle: { from: -8, to: 8 }, duration: 160, yoyo: true, repeat: -1 });
    text(this, left + 44, y - 10, `Ovo de ${p.name}`, 12, '#ffffff', { bold: true }).setOrigin(0, 0.5);
    if (ready) {
      button(this, cx + w / 2 - 70, y, 'CHOCAR!', () => this.hatchEgg(egg, img), { width: 110, height: 32, size: 13, variant: 'primary' });
      text(this, left + 44, y + 9, 'Pronto!', 10, '#8cf08a', { bold: true }).setOrigin(0, 0.5);
      return;
    }
    if (i > 0) {
      text(this, left + 44, y + 9, 'Na fila: choca depois do ovo de cima', 10, '#8a8ca0').setOrigin(0, 0.5);
      return;
    }
    const bw = w - 90;
    const g = this.add.graphics();
    g.fillStyle(0x0d0b16, 1).fillRoundedRect(left + 44, y + 4, bw, 8, 4);
    g.fillStyle(0xffd86a, 1).fillRoundedRect(left + 44, y + 4, Math.max(5, bw * (egg.progress / egg.need)), 8, 4);
    const left_ = Math.ceil((egg.need - egg.progress) / 60);
    text(this, left + 44, y + 20, `Chocando: faltam ${left_} min de partida`, 9, '#a8acc4').setOrigin(0, 0.5);
  }

  /** Ovo treme, racha num clarão e o pet aparece. */
  private hatchEgg(egg: Egg, img: Phaser.GameObjects.Image) {
    const save = loadSave();
    const res = hatch(save, egg.uid);
    if (!res) return;
    writeSave(save);
    this.input.enabled = false;
    const { width, height } = VIEW;
    const shade = this.add.rectangle(width / 2, height / 2, VIEW.screenWidth, height, 0x07060c, 0.8).setDepth(50);
    const big = this.add.image(width / 2, height / 2, img.texture.key).setScale(4).setDepth(51);
    sfx('select');
    this.tweens.add({
      targets: big, angle: { from: -12, to: 12 }, duration: 110, yoyo: true, repeat: 7,
      onComplete: () => {
        sfx('levelup');
        const flash = this.add.circle(width / 2, height / 2, 40, 0xfff2b0, 1).setDepth(52);
        this.tweens.add({ targets: flash, scale: 8, alpha: 0, duration: 600, onComplete: () => flash.destroy() });
        big.destroy();
        const p = getPet(res.pet);
        const pet = this.add.image(width / 2, height / 2, p.textures[petStage(save.pets[res.pet]!.level)]).setScale(0).setDepth(51);
        this.tweens.add({ targets: pet, scale: 4, duration: 500, ease: 'Back.Out' });
        goldTitle(this, width / 2, height / 2 - 120, res.isNew ? 'NOVO PET!' : 'PET MAIS FORTE!', 26).setDepth(53);
        text(this, width / 2, height / 2 + 100, res.isNew ? p.name : `${p.name}: +${res.levels} ${res.levels === 1 ? 'nível' : 'níveis'}`, 16, '#ffd86a', { bold: true, strokeThickness: 4 }).setDepth(53);
        this.time.delayedCall(1900, () => {
          this.input.enabled = true;
          shade.setInteractive();
          this.scene.restart({ view: res.pet });
        });
      },
    });
  }
}
