import Phaser from 'phaser';
import { frameHd, slotsOf } from '../art/textures';
import { formatNumber } from '../core/format';
import {
  MAX_EGGS, MAX_HEARTS, PETS, STAGE_CAP, STAGE_NAMES, eggName, feedCost, nextRequirements, stageLabel, feedXp, getPet, hearts, petXpToNext, type PetDef, type PetId,
} from '../data/pets';
import { atCap, canEvolve, eggReady, evolve, feed, hatch, reqProgress, type Egg } from '../systems/pets';
import { loadSave, writeSave, type SaveData } from '../systems/save';
import { getPref, nextPref } from '../ui/prefs';
import { sfx } from '../systems/sfx';
import { button, goldTitle, panel, text } from '../ui/theme';
import { VIEW, WIDE_COL, col, isWide, setupCamera } from '../ui/view';
import { goldPill, menuBackground } from './MenuScenes';

const PET_ORDERS = ['element', 'level', 'stage'] as const;
type PetOrder = (typeof PET_ORDERS)[number];
const PET_ORDER_NAMES: Record<PetOrder, string> = { element: 'ELEMENTO', level: 'NÍVEL', stage: 'ESTÁGIO' };

/** Linhagens na ordem escolhida: as encontradas primeiro, as outras no fim. */
function sortPets(save: SaveData, order: PetOrder): PetDef[] {
  const rank = (p: PetDef) => {
    const s = save.pets[p.id];
    if (!s) return -1;
    return order === 'level' ? s.level : order === 'stage' ? s.stage * 1000 + s.plus * 100 + s.level : 0;
  };
  return [...PETS].sort((a, b) => Number(!!save.pets[b.id]) - Number(!!save.pets[a.id]) || rank(b) - rank(a));
}

/** Imagem de uma forma de pet (quadro `slot`), do tamanho `size` (lado maior). */
function petImage(scene: Phaser.Scene, x: number, y: number, texture: string, size: number, slot = 'walk_a') {
  const img = scene.add.image(x, y, texture, slotsOf(texture)[slot] ?? 0);
  img.setScale((size / Math.max(img.width, img.height)) * frameHd(img));
  return img;
}

/**
 * Pets: o pet em destaque (forma, nível com o teto do estágio, XP, afinidade, a linha de evolução e
 * os requisitos da próxima), a coleção das 6 linhagens (as que faltam aparecem como "?"), a
 * chocadeira e os botões de evoluir, dar ração e levar na partida.
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
    goldTitle(this, leftX, wide ? 26 : 50, 'PETS', 28);
    // materiais de evolução
    text(this, 14, wide ? 54 : 20, `◆ ${save.evoCrystals}  Cristais   ✦ ${save.ancientShards}  Fragmentos`, 10, '#d6a6ff', { bold: true }).setOrigin(0, 0.5);

    const owned = PETS.filter((p) => save.pets[p.id]);
    const shown = this.view && save.pets[this.view] ? getPet(this.view) : owned.find((p) => p.id === save.activePet) ?? owned[0];

    // pet em destaque
    const topY = wide ? 44 : 76;
    const cardH = wide ? 360 : 392;
    panel(this, leftX, topY + cardH / 2, colW, cardH, 'ui_panel_dark');
    if (shown) this.petCard(shown, leftX, topY, colW, cardH, save.activePet === shown.id);
    else {
      this.add.image(leftX, topY + 110, 'egg_dragon').setScale(3.4).setTintFill(0x2a2c3a).setAlpha(0.8);
      text(this, leftX, topY + 180, 'Nenhum pet ainda', 16, '#ffd86a', { bold: true });
      text(this, leftX, topY + 220, 'Vença um chefe para ganhar seu primeiro ovo.\nOvos caem de chefes e elites e chocam enquanto você joga.', 11, '#c8cce0', { wrap: colW - 30 }).setAlign('center');
    }

    // coleção (ordem escolhida; as linhagens não encontradas ficam no fim, como "?")
    let y = wide ? topY + 14 : topY + cardH + 22;
    const order = getPref('petOrder', PET_ORDERS);
    text(this, rightX - colW / 2 + 4, y, `COLEÇÃO · ${owned.length}/${PETS.length}`, 12, '#ffd86a', { bold: true }).setOrigin(0, 0.5);
    button(this, rightX + colW / 2 - 56, y, `ORDEM: ${PET_ORDER_NAMES[order]}`, () => {
      sfx('select');
      nextPref('petOrder', PET_ORDERS);
      this.scene.restart({ view: this.view });
    }, { width: 108, height: 22, size: 9 });
    y += 38;
    const cell = Math.min(58, (colW - 10) / PETS.length);
    sortPets(save, order).forEach((p, i) => {
      const x = rightX + (i - (PETS.length - 1) / 2) * cell;
      const have = save.pets[p.id];
      const g = this.add.graphics();
      const sel = shown?.id === p.id;
      g.fillStyle(0x14121f, 0.9).fillRoundedRect(x - cell / 2 + 3, y - cell / 2 + 3, cell - 6, cell - 6, 8);
      g.lineStyle(sel ? 3 : 1.5, sel ? 0xffd86a : have ? 0x8a8ca0 : 0x3a3a4a, 1).strokeRoundedRect(x - cell / 2 + 3, y - cell / 2 + 3, cell - 6, cell - 6, 8);
      if (have) {
        petImage(this, x, y - 3, p.forms[have.stage].texture, cell * 0.7);
        text(this, x, y + cell / 2 - 9, have.plus ? `+${have.plus}` : `nv ${have.level}`, 9, '#ffe9a0', { bold: true, strokeThickness: 3 });
        if (save.activePet === p.id) text(this, x + cell / 2 - 9, y - cell / 2 + 10, '✓', 10, '#8cf08a', { bold: true, strokeThickness: 3 });
        this.add.zone(x, y, cell, cell).setInteractive({ useHandCursor: true }).on('pointerup', () => {
          sfx('select');
          this.scene.restart({ view: p.id });
        });
      } else text(this, x, y - 2, '?', 22, p.available ? '#8a8ca0' : '#4a4c5a', { bold: true });
    });
    y += cell / 2 + 8;
    text(this, rightX, y, 'Os "?" são linhagens ainda não encontradas · ✓ vai na partida', 9, '#8a8ca0');

    // chocadeira: todos os ovos numa grade; o primeiro é o que está chocando, e tocar num ovo o põe na frente
    y += 26;
    text(this, rightX - colW / 2 + 4, y, `CHOCADEIRA · ${save.eggs.length}/${MAX_EGGS}`, 12, '#ffd86a', { bold: true }).setOrigin(0, 0.5);
    if (!save.eggs.length) text(this, rightX, y + 26, 'Sem ovos. Chefes e elites às vezes deixam um ovo no baú.', 11, '#a8acc4', { wrap: colW - 20 });
    else {
      text(this, rightX + colW / 2 - 4, y, 'toque: chocar este primeiro', 9, '#8a8ca0').setOrigin(1, 0.5);
      const ecell = Math.min(60, (colW - 10) / MAX_EGGS);
      save.eggs.forEach((egg, i) => this.eggCard(egg, i, rightX - colW / 2 + 5 + ecell * i + ecell / 2, y + 40, ecell));
      const first = save.eggs[0];
      const msg = eggReady(first) ? `${eggName(first.pet)} pronto para chocar!` : `Chocando ${eggName(first.pet)}: faltam ${Math.ceil((first.need - first.progress) / 60)} min de partida`;
      text(this, rightX, y + 40 + ecell / 2 + 16, msg, 10, eggReady(first) ? '#8cf08a' : '#c8cce0', { bold: eggReady(first) });
    }

    button(this, width / 2, height - 28, 'VOLTAR', () => {
      sfx('select');
      this.scene.start('Menu');
    }, { width: 180, height: 36, size: 14 });
  }

  private petCard(p: PetDef, cx: number, top: number, w: number, h: number, active: boolean) {
    const save = loadSave();
    const st = save.pets[p.id]!;
    const f = p.forms[st.stage];
    const left = cx - w / 2;
    // pet animado (movimento), flutuando
    const img = petImage(this, left + 70, top + 70, f.texture, 92);
    const move = f.move ?? ['walk_a', 'walk_b'];
    const slots = slotsOf(f.texture);
    let k = 0;
    this.time.addEvent({ delay: p.flies ? 170 : 220, loop: true, callback: () => img.setFrame(slots[move[++k % move.length]] ?? 0) });
    this.tweens.add({ targets: img, y: img.y - 5, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const tx = left + 134;
    text(this, tx, top + 20, st.plus ? `${f.name} +${st.plus}` : f.name, 17, '#ffd86a', { bold: true, strokeThickness: 4 }).setOrigin(0, 0.5);
    text(this, tx, top + 40, `${stageLabel(st.stage, st.plus)} · ${p.label}`, 11, '#c8cce0').setOrigin(0, 0.5);
    const cap = STAGE_CAP[st.stage];
    text(this, tx, top + 60, cap === Infinity ? `Nível ${st.level}` : `Nível ${st.level}/${cap}`, 13, '#ffffff', { bold: true }).setOrigin(0, 0.5);
    // XP (no teto do estágio, a barra fica cheia e pede evolução)
    const bw = w - 150;
    const need = petXpToNext(st.level);
    const capped = atCap(st);
    const g = this.add.graphics();
    g.fillStyle(0x0d0b16, 1).fillRoundedRect(tx, top + 72, bw, 9, 4);
    g.fillStyle(capped ? 0xffd86a : 0x8cf08a, 1).fillRoundedRect(tx, top + 72, Math.max(6, bw * (capped ? 1 : st.xp / need)), 9, 4);
    text(this, tx + bw, top + 89, capped ? 'Nível máximo do estágio: evolua!' : `${formatNumber(st.xp)}/${formatNumber(need)} XP`, 9, capped ? '#ffd86a' : '#a8acc4').setOrigin(1, 0.5);
    // afinidade: corações
    const hs = hearts(st.runs);
    for (let i = 0; i < MAX_HEARTS; i++) text(this, tx + 6 + i * 12, top + 106, '♥', 12, i < hs ? '#ff5a7a' : '#3a3046', { bold: true });
    text(this, tx + 6 + MAX_HEARTS * 12, top + 106, ' Afinidade', 9, '#a8acc4').setOrigin(0, 0.5);

    // linha de evolução: as formas já alcançadas e, das próximas, só a silhueta preta (cada vez maior)
    const ey = top + 150;
    const step = (w - 60) / 4;
    const sizes = [24, 29, 34, 40, 48];
    for (let i = 0; i < 5; i++) {
      const x = left + 30 + i * step;
      const future = i > st.stage;
      if (future) {
        const glow = this.add.image(x, ey, 'atlas', 'glow:0').setTint(0x6a4aa0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setScale(sizes[i] / 14);
        this.tweens.add({ targets: glow, alpha: 0.15, duration: 1200 + i * 150, yoyo: true, repeat: -1 });
      }
      const e = petImage(this, x, ey, p.forms[i].texture, sizes[i]);
      if (future) e.setTintFill(0x07060c);
      const label = i === 4 ? stageLabel(4, st.stage === 4 ? st.plus : 0) : STAGE_NAMES[i];
      text(this, x, ey + 30, label, 9, i === st.stage ? '#ffd86a' : i < st.stage ? '#c8cce0' : '#6a6c7a', { bold: i === st.stage });
      if (i < 4) text(this, x + step / 2, ey, '›', 16, '#6a6c7a', { bold: true });
    }
    text(this, cx, top + 200, f.skill, 11, '#ffe9a0', { wrap: w - 30 });

    // requisitos da próxima evolução
    let ry = top + 226;
    const reqs = nextRequirements(p, st.stage, st.plus);
    {
      const next = st.stage < 4 ? `PARA EVOLUIR PARA ${STAGE_NAMES[st.stage + 1].toUpperCase()}` : `PARA ASCENDER A SUPREMO+${st.plus + 1} (+25% DE FORÇA)`;
      text(this, left + 16, ry, next, 10, '#ffd86a', { bold: true }).setOrigin(0, 0.5);
      ry += 18;
      for (const r of reqs) {
        const have = Math.min(r.target, reqProgress(save, p.id, r));
        const done = have >= r.target;
        const line = text(this, left + 16, ry - 7, `${done ? '✓' : '○'} ${r.text}`, 10, done ? '#8cf08a' : '#d8dcef', { wrap: w - 110 }).setOrigin(0, 0).setAlign('left');
        if (r.target > 1) text(this, left + w - 16, ry, `${formatNumber(have)}/${formatNumber(r.target)}`, 10, done ? '#8cf08a' : '#a8acc4', { bold: true }).setOrigin(1, 0.5);
        ry += Math.max(17, line.displayHeight + 4);
      }
    }

    // botões
    const by = top + h - 26;
    if (canEvolve(save, p.id)) {
      const b = button(this, cx - 74, by, st.stage < 4 ? 'EVOLUIR!' : 'ASCENDER!', () => this.evolvePet(p), { width: 136, height: 34, size: 15, variant: 'primary' });
      this.tweens.add({ targets: b, scale: 1.06, duration: 500, yoyo: true, repeat: -1 });
    } else {
      const cost = feedCost(st.level);
      button(this, cx - 74, by, `RAÇÃO ${formatNumber(cost)}`, () => {
        if (!feed(save, p.id)) return sfx('hurt');
        writeSave(save);
        sfx('pickup');
        this.scene.restart({ view: p.id });
      }, { width: 136, height: 32, size: 11, icon: 'coin', disabled: save.gold < cost });
      text(this, cx - 74, by + 22, capped ? 'Ração: conta para evoluir' : `+${formatNumber(feedXp(st.level))} XP`, 8, '#8a8ca0');
    }
    if (active) text(this, cx + 74, by, '✓ VAI NA PARTIDA', 11, '#8cf08a', { bold: true });
    else {
      button(this, cx + 74, by, 'LEVAR NA PARTIDA', () => {
        save.activePet = p.id;
        writeSave(save);
        sfx('select');
        this.scene.restart({ view: p.id });
      }, { width: 136, height: 32, size: 10, variant: 'primary' });
    }
  }

  /** Ovo na grade da chocadeira: pronto treme; o primeiro mostra o progresso; tocar choca ou põe na frente. */
  private eggCard(egg: Egg, i: number, x: number, y: number, cell: number) {
    const g = this.add.graphics();
    const ready = eggReady(egg);
    g.fillStyle(0x14121f, 0.9).fillRoundedRect(x - cell / 2 + 3, y - cell / 2 + 3, cell - 6, cell - 6, 8);
    g.lineStyle(i === 0 || ready ? 2.5 : 1.5, ready ? 0x8cf08a : i === 0 ? 0xffd86a : 0x5a5c6a, 1).strokeRoundedRect(x - cell / 2 + 3, y - cell / 2 + 3, cell - 6, cell - 6, 8);
    const img = this.add.image(x, y - 4, getPet(egg.pet).egg).setScale(1.25);
    if (ready) this.tweens.add({ targets: img, angle: { from: -8, to: 8 }, duration: 160, yoyo: true, repeat: -1 });
    // barra de progresso embaixo
    const bw = cell - 16;
    g.fillStyle(0x0d0b16, 1).fillRoundedRect(x - bw / 2, y + cell / 2 - 12, bw, 5, 2);
    g.fillStyle(ready ? 0x8cf08a : 0xffd86a, 1).fillRoundedRect(x - bw / 2, y + cell / 2 - 12, Math.max(3, bw * (egg.progress / egg.need)), 5, 2);
    if (ready) text(this, x, y - cell / 2 + 10, 'PRONTO', 8, '#8cf08a', { bold: true, strokeThickness: 3 });
    this.add.zone(x, y, cell, cell).setInteractive({ useHandCursor: true }).on('pointerup', () => {
      if (ready) return this.hatchEgg(egg, img);
      if (i === 0) return;
      // passa este ovo para a frente da fila (o progresso de cada ovo fica guardado)
      const save = loadSave();
      const k = save.eggs.findIndex((e) => e.uid === egg.uid);
      if (k > 0) save.eggs.unshift(...save.eggs.splice(k, 1));
      writeSave(save);
      sfx('select');
      this.scene.restart({ view: this.view });
    });
  }

  /** Tela escura no centro, para as cerimônias (chocar e evoluir). */
  private stageOverlay() {
    const { width, height } = VIEW;
    this.input.enabled = false;
    const shade = this.add.rectangle(width / 2, height / 2, VIEW.screenWidth, height, 0x07060c, 0.85).setDepth(50);
    return { cx: width / 2, cy: height / 2, shade };
  }

  private finish(view: PetId, delay = 2000) {
    this.time.delayedCall(delay, () => {
      this.input.enabled = true;
      this.scene.restart({ view });
    });
  }

  /** Ovo treme, racha num clarão e o pet aparece. */
  private hatchEgg(egg: Egg, img: Phaser.GameObjects.Image) {
    const save = loadSave();
    const res = hatch(save, egg.uid);
    if (!res) return;
    writeSave(save);
    const { cx, cy } = this.stageOverlay();
    const big = this.add.image(cx, cy, img.texture.key).setScale(4).setDepth(51);
    sfx('select');
    this.tweens.add({
      targets: big, angle: { from: -12, to: 12 }, duration: 110, yoyo: true, repeat: 7,
      onComplete: () => {
        sfx('levelup');
        this.flash(cx, cy);
        big.destroy();
        const p = getPet(res.pet);
        const pet = petImage(this, cx, cy, p.forms[save.pets[res.pet]!.stage].texture, 130).setDepth(51);
        const s = pet.scale;
        pet.setScale(0);
        this.tweens.add({ targets: pet, scale: s, duration: 500, ease: 'Back.Out' });
        goldTitle(this, cx, cy - 120, res.isNew ? 'NOVO PET!' : 'PET MAIS FORTE!', 26).setDepth(53);
        const name = p.forms[save.pets[res.pet]!.stage].name;
        text(this, cx, cy + 100, res.isNew ? name : `${name}: +${res.levels} ${res.levels === 1 ? 'nível' : 'níveis'}`, 16, '#ffd86a', { bold: true, strokeThickness: 4 }).setDepth(53);
        this.finish(res.pet);
      },
    });
  }

  private flash(x: number, y: number) {
    const flash = this.add.circle(x, y, 40, 0xfff2b0, 1).setDepth(52);
    this.tweens.add({ targets: flash, scale: 9, alpha: 0, duration: 700, onComplete: () => flash.destroy() });
  }

  /**
   * Cerimônia de evolução: a forma atual vira silhueta brilhante e pisca alternando com a nova, cada
   * vez mais rápido; um clarão revela a nova forma com o nome.
   */
  private evolvePet(p: PetDef) {
    const save = loadSave();
    const from = save.pets[p.id]!.stage;
    if (!evolve(save, p.id)) return;
    writeSave(save);
    const to = save.pets[p.id]!.stage;
    if (from === 4) return this.ascend(p, save.pets[p.id]!.plus);
    const { cx, cy } = this.stageOverlay();
    const rays = this.add.image(cx, cy, 'aura').setTint(0xffe9a0).setBlendMode(Phaser.BlendModes.ADD).setDepth(50.5).setScale(3).setAlpha(0);
    this.tweens.add({ targets: rays, alpha: 0.8, scale: 5, angle: 180, duration: 2600 });
    const oldImg = petImage(this, cx, cy, p.forms[from].texture, 120).setDepth(51);
    const newImg = petImage(this, cx, cy, p.forms[to].texture, 150).setDepth(51).setTintFill(0xffffff).setVisible(false);
    const title = text(this, cx, cy - 130, `${p.forms[from].name} está evoluindo...`, 15, '#ffffff', { bold: true, strokeThickness: 4 }).setDepth(53);
    sfx('select');
    this.time.delayedCall(500, () => oldImg.setTintFill(0xffffff));
    // pisca entre as duas silhuetas, acelerando
    let t = 700;
    let gap = 260;
    let show = false;
    while (gap > 40) {
      const s = show;
      this.time.delayedCall(t, () => {
        oldImg.setVisible(!s);
        newImg.setVisible(s);
        sfx('pickup');
      });
      show = !show;
      t += gap;
      gap *= 0.84;
    }
    this.time.delayedCall(t + 100, () => {
      sfx('levelup');
      this.flash(cx, cy);
      this.cameras.main.shake(300, 0.006);
      oldImg.destroy();
      title.destroy();
      newImg.setVisible(true).clearTint();
      const s = newImg.scale;
      newImg.setScale(s * 0.6);
      this.tweens.add({ targets: newImg, scale: s, duration: 500, ease: 'Back.Out' });
      goldTitle(this, cx, cy - 130, 'EVOLUIU!', 30).setDepth(53);
      text(this, cx, cy + 105, p.forms[to].name, 20, '#ffd86a', { bold: true, strokeThickness: 5 }).setDepth(53);
      text(this, cx, cy + 132, `${STAGE_NAMES[to]} · ${p.forms[to].skill}`, 11, '#ffe9a0', { wrap: VIEW.width - 60 }).setDepth(53);
      this.finish(p.id, 2600);
    });
  }

  /** Ascensão do Supremo: o pet se enche de luz, a aura cresce e explode num clarão. */
  private ascend(p: PetDef, plus: number) {
    const { cx, cy } = this.stageOverlay();
    const f = p.forms[4];
    const aura = this.add.image(cx, cy, 'atlas', 'glow:0').setTint(0xffd86a).setBlendMode(Phaser.BlendModes.ADD).setDepth(50.5).setScale(2).setAlpha(0.6);
    const pet = petImage(this, cx, cy, f.texture, 160).setDepth(51);
    const title = text(this, cx, cy - 140, `${f.name} está ascendendo...`, 15, '#ffffff', { bold: true, strokeThickness: 4 }).setDepth(53);
    sfx('select');
    this.tweens.add({ targets: aura, scale: 14, alpha: 0.9, duration: 1800, ease: 'Quad.In' });
    this.tweens.add({ targets: pet, y: cy - 8, duration: 220, yoyo: true, repeat: 3 });
    this.time.delayedCall(1100, () => pet.setTintFill(0xfff6c0));
    this.time.delayedCall(1900, () => {
      sfx('levelup');
      this.flash(cx, cy);
      this.cameras.main.shake(400, 0.008);
      title.destroy();
      pet.clearTint();
      aura.setScale(6).setAlpha(0.5);
      this.tweens.add({ targets: aura, scale: 7, alpha: 0.3, duration: 900, yoyo: true, repeat: -1 });
      goldTitle(this, cx, cy - 140, 'ASCENDEU!', 30).setDepth(53);
      text(this, cx, cy + 115, `${f.name} +${plus}`, 20, '#ffd86a', { bold: true, strokeThickness: 5 }).setDepth(53);
      text(this, cx, cy + 142, `Supremo+${plus} · +${plus * 25}% de força`, 11, '#ffe9a0').setDepth(53);
      this.finish(p.id, 2400);
    });
  }
}
