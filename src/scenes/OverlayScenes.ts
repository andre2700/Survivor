import Phaser from 'phaser';
import { eggName, getPet } from '../data/pets';
import { VIEW, WIDE_COL, col, isWide, setupCamera } from '../ui/view';
import { formatNumber } from '../core/format';
import { getCharacter } from '../data/characters';
import { TAGS } from '../data/tags';
import { WEAPONS, type Tag, type WeaponId } from '../data/weapons';
import { loadSave, writeSave } from '../systems/save';
import { DEV_TOOLS } from '../systems/dev';
import { sfx } from '../systems/sfx';
import { RARITIES, describeOption } from '../systems/upgrades';
import { FONT, button, goldTitle, panel, starIcon, text, px } from '../ui/theme';
import { tierName } from '../data/difficulty';
import { RARITIES as ITEM_RARITIES, itemName } from '../data/items';
import { itemCard, rarityHex } from '../ui/items';
import { getStage } from '../data/stages';
import type { GameScene, RunResult } from './GameScene';
import { formatTime } from './HudScene';

function dim(scene: Phaser.Scene, alpha = 0.72) {
  const { height } = VIEW;
  scene.add.image(-VIEW.bleed, 0, 'vignette').setOrigin(0).setDisplaySize(VIEW.screenWidth, height).setDepth(-1);
  return scene.add.rectangle(-VIEW.bleed, 0, VIEW.screenWidth, height, 0x0b0a14, alpha).setOrigin(0).setInteractive().setDepth(-2);
}

/** Raios de luz girando atrás de um título (vitória, nível). */
function rays(scene: Phaser.Scene, x: number, y: number, color: number) {
  const g = scene.add.graphics({ x, y }).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.18);
  g.fillStyle(color, 1);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.fillTriangle(0, 0, Math.cos(a - 0.12) * 260, Math.sin(a - 0.12) * 260, Math.cos(a + 0.12) * 260, Math.sin(a + 0.12) * 260);
  }
  scene.tweens.add({ targets: g, angle: 360, duration: 20000, repeat: -1 });
  return g;
}

type CardMode = 'pick' | 'banish' | 'lock';

export class LevelUpScene extends Phaser.Scene {
  private mode: CardMode = 'pick';

  constructor() {
    super('LevelUp');
  }

  init() {
    this.mode = 'pick';
  }

  create() {
    setupCamera(this);
    this.render();
  }

  private render() {
    this.children.removeAll(true);
    const { width, height } = VIEW;
    const game = this.scene.get('Game') as GameScene;
    const meta = loadSave().meta;
    const options = game.currentOptions;
    dim(this);

    const titleY = 36;
    if (this.mode === 'pick') rays(this, width / 2, titleY, 0xffe9a0);
    const title = goldTitle(this, width / 2, titleY, 'SUBIU DE NÍVEL!', 26);
    if (this.mode === 'pick') this.tweens.add({ targets: title, scale: { from: 1.3, to: 1 }, duration: 260, ease: 'Back.Out' });
    const hint = this.mode === 'banish' ? 'Toque na carta para BANIR' : this.mode === 'lock' ? 'Toque na carta para FIXAR' : `Nível ${game.level} · escolha uma melhoria`;
    text(this, width / 2, titleY + 26, hint, 12, this.mode === 'pick' ? '#c8cce0' : '#ff9a7a', { bold: this.mode !== 'pick' });

    const showTools = (meta.reroll ?? 0) > 0 || (meta.banish ?? 0) > 0 || (meta.lock ?? 0) > 0;
    const top = titleY + 44;
    const bottom = height - (showTools ? 62 : 18);
    const n = options.length;
    const gap = 8;
    const cardH = Math.min(96, Math.floor((bottom - top - gap * (n - 1)) / n));
    const cardW = width - 24;
    let busy = false;

    options.forEach((opt, i) => {
      const info = describeOption(opt, game.loadout, game.stats, game.statsWith);
      const rarity = RARITIES[opt.rarity];
      const y = top + i * (cardH + gap) + cardH / 2;
      const c = this.add.container(width / 2, y);
      const key = this.mode === 'banish' ? 'ui_card_0' : `ui_card_${opt.rarity}`;
      const bg = panel(this, 0, 0, cardW, cardH, key);
      if (this.mode !== 'pick') bg.setTint(this.mode === 'banish' ? 0xff9a9a : 0x9ad0ff);
      const slot = Math.min(52, cardH - 18);
      const sx = -cardW / 2 + 12 + slot / 2;
      const slotBg = panel(this, sx, 0, slot, slot, 'ui_slot');
      const icon = this.add.image(sx, 0, info.icon).setScale(slot >= 44 ? 2 : 1.5);
      const left = sx + slot / 2 + 10;
      // largura útil até a borda direita do cartão
      const textW = cardW / 2 - left - 12;
      const yTop = -cardH / 2 + 8;
      const t = this.add.text(left, yTop, info.title, { fontFamily: FONT, fontSize: px(15), fontStyle: 'bold', color: '#ffffff', stroke: '#0b0a14', strokeThickness: 3 });
      fitText(t, textW, 22, 10);
      const tag = this.add.text(left, yTop + 19, info.tag, { fontFamily: FONT, fontSize: px(11), fontStyle: 'bold', color: rarity.text });
      fitText(tag, textW, 16, 8);
      const showChange = !!info.change && cardH >= 70;
      const descTop = yTop + 33;
      const descBottom = cardH / 2 - (showChange ? 20 : 6);
      const desc = this.add.text(left, descTop, info.text, { fontFamily: FONT, fontSize: px(12), color: '#dfe3f5', wordWrap: { width: textW }, lineSpacing: 0 });
      fitText(desc, textW, descBottom - descTop, 8);
      c.add([bg, slotBg, icon, t, tag, desc]);
      if (showChange) {
        const ch = this.add.text(left, cardH / 2 - 6, info.change!, { fontFamily: FONT, fontSize: px(11), fontStyle: 'bold', color: '#8cf08a' }).setOrigin(0, 1);
        fitText(ch, textW, 16, 8);
        c.add(ch);
      }
      if (opt.rarity >= 2) {
        // brilho nas cartas épicas e lendárias
        const shine = this.add.image(sx, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(rarity.color).setScale(2.2).setAlpha(0.5);
        c.addAt(shine, 1);
        this.tweens.add({ targets: shine, alpha: 0.15, duration: 700, yoyo: true, repeat: -1 });
      }
      if (game.isLocked(opt)) {
        c.add(this.add.text(cardW / 2 - 10, -cardH / 2 + 8, 'FIXADA', { fontFamily: FONT, fontSize: px(11), fontStyle: 'bold', color: '#7fc4ff' }).setOrigin(1, 0));
      }
      c.setSize(cardW, cardH).setInteractive({ useHandCursor: true });
      if (this.mode === 'pick') {
        c.setAlpha(0).setX(width / 2 + 30);
        this.tweens.add({ targets: c, alpha: 1, x: width / 2, duration: 200, delay: 70 * i, ease: 'Quad.Out' });
      }
      c.on('pointerup', () => {
        if (busy) return;
        if (this.mode === 'banish') {
          if (game.banish(i)) sfx('select');
          this.mode = 'pick';
          this.render();
          return;
        }
        if (this.mode === 'lock') {
          if (game.lock(i)) sfx('select');
          this.mode = 'pick';
          this.render();
          return;
        }
        busy = true;
        sfx('select');
        this.tweens.add({ targets: c, scale: 1.05, duration: 90, yoyo: true, onComplete: () => game.chooseUpgrade(opt) });
      });
    });

    if (!showTools) return;
    const tools: { label: string; count: number; onClick: () => void; show: boolean }[] = [
      {
        label: `ROLAR ${game.rerolls}`, count: game.rerolls, show: (meta.reroll ?? 0) > 0,
        onClick: () => {
          if (game.reroll()) {
            sfx('select');
            this.mode = 'pick';
            this.render();
          }
        },
      },
      {
        label: `BANIR ${game.banishes}`, count: game.banishes, show: (meta.banish ?? 0) > 0,
        onClick: () => {
          this.mode = this.mode === 'banish' ? 'pick' : 'banish';
          this.render();
        },
      },
      {
        label: `FIXAR ${game.locks}`, count: game.locks, show: (meta.lock ?? 0) > 0,
        onClick: () => {
          this.mode = this.mode === 'lock' ? 'pick' : 'lock';
          this.render();
        },
      },
    ];
    const visible = tools.filter((tl) => tl.show);
    const bw = Math.min(118, (width - 24 - (visible.length - 1) * 8) / visible.length);
    visible.forEach((tl, i) => {
      const x = width / 2 + (i - (visible.length - 1) / 2) * (bw + 8);
      button(this, x, height - 34, tl.label, tl.onClick, { width: bw, height: 38, size: 13, disabled: tl.count <= 0 });
    });
  }
}

export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create() {
    setupCamera(this);
    const { width, height } = VIEW;
    const game = this.scene.get('Game') as GameScene;
    dim(this, 0.78);
    // deitado: botões à esquerda, atributos à direita
    const wide = isWide();
    const bx = wide ? col(-1) : width / 2;
    const by = wide ? height * 0.42 : height * 0.26;
    goldTitle(this, bx, wide ? by - 90 : height * 0.14, 'PAUSADO', 34);
    button(this, bx, by, 'CONTINUAR', () => game.resumeFromPause(), { width: 220, height: 44, size: 16, variant: 'primary' });
    button(this, bx, by + 54, 'DESISTIR', () => {
      this.scene.stop();
      game.state = 'playing';
      game.endRun(game.endless);
      game.scene.resume();
    }, { width: 220, height: 38, size: 14 });
    if (wide) statsPanel(this, game, Math.max(16, (height - 300) / 2), col(1), WIDE_COL);
    else statsPanel(this, game, by + 96);
    if (DEV_TOOLS) {
      button(this, 34 - VIEW.bleed, 20, 'DEV', () => {
        this.scene.pause();
        this.scene.launch('Dev', { from: 'Pause' });
      }, { width: 56, height: 24, size: 11, variant: 'purple' });
    }
    this.input.keyboard?.on('keydown-ESC', () => game.resumeFromPause());
  }
}

/** Diminui a fonte do texto até caber em `maxW` × `maxH` (quebrando linhas se tiver quebra automática). */
function fitText(t: Phaser.GameObjects.Text, maxW: number, maxH: number, minSize: number) {
  let size = parseFloat(String(t.style.fontSize));
  const wraps = !!t.style.wordWrapWidth;
  while (size > minSize && (t.height > maxH || (!wraps && t.width > maxW))) {
    size -= 1;
    t.setFontSize(size);
  }
  if (!wraps && t.width > maxW) t.setScale(maxW / t.width);
}

/** Painel de atributos atuais e bônus de tags (visível na pausa). */
function statsPanel(scene: Phaser.Scene, game: GameScene, y0: number, cx = VIEW.width / 2, pw = VIEW.width - 36) {
  const s = game.stats;
  const pct = (v: number) => `${formatNumber(Math.round(v * 100))}%`;
  const rows: [string, string][] = [
    ['Dano', `+${pct(s.power)}`],
    ['Vel. de ataque', `+${pct(s.attackSpeed)}`],
    ['Área', `+${pct(s.area)}`],
    ['Quantidade', `+${formatNumber(Math.floor(s.amount))}`],
    ['Crítico', `${pct(s.critChance)} · ×${s.critDamage.toFixed(1)}`],
    ['Potência elemental', `+${pct(s.elementalPower)}`],
    ['Vida', `${formatNumber(game.hp)} / ${formatNumber(s.maxHp)}`],
    ['Defesa', formatNumber(s.defense)],
    ['Sorte', formatNumber(s.luck)],
  ];
  const h = rows.length * 20 + 40;
  panel(scene, cx, y0 + h / 2, pw, h, 'ui_panel');
  text(scene, cx, y0 + 16, 'ATRIBUTOS', 12, '#ffd86a', { bold: true });
  rows.forEach(([k, v], i) => {
    const y = y0 + 38 + i * 20;
    scene.add.text(cx - pw / 2 + 16, y, k, { fontFamily: FONT, fontSize: px(13), color: '#b8bdd8' }).setOrigin(0, 0.5);
    scene.add.text(cx + pw / 2 - 16, y, v, { fontFamily: FONT, fontSize: px(13), fontStyle: 'bold', color: '#ffffff' }).setOrigin(1, 0.5);
  });
  const tags = (Object.entries(game.tagCounts) as [Tag, number][]).filter(([, n]) => n > 0).map(([t, n]) => `${TAGS[t].name} ${n}`);
  if (tags.length) text(scene, cx, y0 + h + 16, `Tags: ${tags.join(' · ')}`, 11, '#8a8ea8', { wrap: pw - 4 });
}

/**
 * Baú da partida: os itens ganhos aparecem um a um, com um clarão na cor da raridade. Devolve a
 * altura usada.
 */
function lootRow(scene: Phaser.Scene, result: RunResult, cx: number, y: number, w: number): number {
  const loot = result.loot ?? [];
  text(scene, cx, y, loot.length ? `BAÚ DA PARTIDA · ${loot.length} ${loot.length > 1 ? 'ITENS' : 'ITEM'}` : 'BAÚ DA PARTIDA', 13, '#ffd86a', { bold: true });
  if (!loot.length) {
    text(scene, cx, y + 22, 'Sobreviva 3 minutos ou vença chefes para ganhar itens', 11, '#a8acc4', { wrap: w });
    return 44 + petRow(scene, result, cx, y + 46, 300);
  }
  const size = 42;
  const per = Math.max(1, Math.floor(w / (size + 8)));
  loot.forEach((it, i) => {
    const row = Math.floor(i / per);
    const inRow = Math.min(per, loot.length - row * per);
    const x = cx + ((i % per) - (inRow - 1) / 2) * (size + 8);
    const iy = y + 34 + row * (size + 8);
    const card = itemCard(scene, x, iy, it, size).setScale(0);
    scene.tweens.add({ targets: card, scale: 1, duration: 260, delay: 400 + i * 220, ease: 'Back.Out', onStart: () => {
      sfx('pickup');
      if (it.rarity >= 2) {
        const flash = scene.add.circle(x, iy, size * 0.7, ITEM_RARITIES[it.rarity].color, 0.6);
        scene.tweens.add({ targets: flash, scale: 2, alpha: 0, duration: 450, onComplete: () => flash.destroy() });
      }
    } });
  });
  const rows = Math.ceil(loot.length / per);
  const best = loot.reduce((a, b) => (b.rarity > a.rarity ? b : a));
  const by = y + 34 + rows * (size + 8) - 8;
  text(scene, cx, by, `Melhor: ${itemName(best)} (${ITEM_RARITIES[best.rarity].name})`, 11, rarityHex(best.rarity), { bold: true, wrap: w });
  return by - y + 18 + petRow(scene, result, cx, by + 22, 400 + loot.length * 220);
}

/** Ovo ganho e XP do pet ativo, embaixo do baú. Devolve a altura usada. */
function petRow(scene: Phaser.Scene, result: RunResult, cx: number, y: number, delay: number): number {
  const r = result.pet;
  if (!r) return 0;
  let h = 0;
  if (r.egg) {
    const p = getPet(r.egg);
    const label = r.full ? `${eggName(r.egg)} (chocadeira cheia!)` : `${eggName(r.egg).toUpperCase()}!`;
    const t = text(scene, cx + 12, y, label, 12, r.full ? '#a8acc4' : '#8cf08a', { bold: true, strokeThickness: 3 });
    const egg = scene.add.image(cx - t.displayWidth / 2 - 4, y, p.egg).setScale(0);
    scene.tweens.add({ targets: egg, scale: 1.1, duration: 300, delay, ease: 'Back.Out', onStart: () => sfx('levelup') });
    h += 22;
  }
  if (r.crystals || r.shards) {
    const parts = [r.crystals ? `+${r.crystals} Cristal de Evolução` : '', r.shards ? `+${r.shards} Fragmento Ancestral` : ''].filter(Boolean);
    text(scene, cx, y + h, parts.join(' · '), 11, '#d6a6ff', { bold: true, strokeThickness: 3 });
    h += 18;
  }
  if (r.active) {
    const save = loadSave();
    const st = save.pets[r.active];
    const name = st ? getPet(r.active).forms[st.stage].name + (st.plus ? ` +${st.plus}` : '') : '';
    const lv = r.levels ? ` · +${r.levels} ${r.levels === 1 ? 'nível' : 'níveis'}` : '';
    const note = r.ready ? ' · PRONTO PARA EVOLUIR!' : r.capped ? ' · nível máximo: evolua!' : '';
    text(scene, cx, y + h, `${name}: +${r.xp} XP${lv}${note}`, 11, r.ready ? '#ffd86a' : '#c8cce0', { bold: r.ready });
    h += 18;
  }
  return h;
}

/** Estrelas da fase nesta partida, com o texto de cada objetivo cumprido. */
function starsRow(scene: Phaser.Scene, result: RunResult, cx: number, y: number) {
  const stage = getStage(result.stage);
  for (let k = 0; k < 3; k++) {
    const s = starIcon(scene, cx - 26 + k * 26, y, 10, !!result.stars[k]);
    if (result.stars[k]) scene.tweens.add({ targets: s, scale: { from: 0, to: 1 }, duration: 300, delay: 300 + k * 180, ease: 'Back.Out' });
  }
  const done = stage.objectives.filter((_, k) => result.stars[k]).map((o) => o.text);
  if (done.length) text(scene, cx, y + 20, done.join(' · '), 10, '#ffe9a0', { wrap: VIEW.width - 40 });
}

export class VictoryScene extends Phaser.Scene {
  constructor() {
    super('Victory');
  }

  create(result: RunResult) {
    setupCamera(this);
    const { width, height } = VIEW;
    const game = this.scene.get('Game') as GameScene;
    dim(this, 0.8);
    // deitado: resultado à esquerda, modo infinito à direita
    const wide = isWide();
    const lx = wide ? col(-1) : width / 2;
    const rx = wide ? col(1) : width / 2;
    const ty = wide ? height * 0.24 : height * 0.17;
    rays(this, lx, ty, 0xffd86a);
    const t = goldTitle(this, lx, ty, 'VITÓRIA!', 48);
    this.tweens.add({ targets: t, scale: { from: 0.4, to: 1 }, duration: 500, ease: 'Back.Out' });
    text(this, lx, ty + 42, `${formatTime(result.time)} · ${formatNumber(result.kills)} abates · nível ${result.level}`, 13, '#e8e2d0', { shadow: true });
    starsRow(this, result, lx, ty + 72);
    if (result.unlocked) text(this, lx, ty + 112, `Liberado: ${result.unlocked}!`, 14, '#8cf08a', { bold: true, strokeThickness: 3 });
    if (!wide) lootRow(this, result, lx, ty + 138, width - 40);

    const py = wide ? height * 0.36 : height * 0.58;
    const pw = wide ? WIDE_COL : width - 36;
    panel(this, rx, py, pw, 150, 'ui_card_2');
    text(this, rx, py - 52, 'MODO INFINITO', 18, '#e0c2ff', { bold: true, strokeThickness: 4 });
    text(this, rx, py + 4,
      'Continue com a sua build. A cada 5 minutos surge um novo chefe e os inimigos ficam bem mais fortes. As recompensas crescem a cada ciclo. Morrer aqui não conta como derrota.',
      12, '#eadcff', { wrap: pw - 36 });
    const by = wide ? py + 106 : height * 0.78;

    button(this, rx, by, 'CONTINUAR', () => {
      sfx('levelup');
      game.continueEndless();
    }, { width: 240, height: 48, size: 18, variant: 'purple' });
    button(this, rx, by + 56, 'ENCERRAR E COLETAR', () => {
      sfx('select');
      this.scene.stop();
      game.state = 'playing';
      game.endRun(true);
      game.scene.resume();
    }, { width: 240, height: 40, size: 14 });
  }
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(result: RunResult) {
    setupCamera(this);
    const { width, height } = VIEW;
    const save = loadSave();
    save.gold += result.gold;
    const newRecord = result.time > save.bestTime;
    save.bestTime = Math.max(save.bestTime, result.time);
    save.bestKills = Math.max(save.bestKills, result.kills);
    save.bestCycle = Math.max(save.bestCycle ?? 0, result.cycle);
    if (result.victory && !result.endless) save.victories++;
    writeSave(save);

    dim(this, 0.84);
    // deitado: resumo à esquerda, dano por arma à direita
    const wide = isWide();
    const lx = wide ? col(-1) : width / 2;
    const rx = wide ? col(1) : width / 2;
    const pw = wide ? WIDE_COL : width - 36;
    const title = result.endless ? 'FIM DA JORNADA' : result.victory ? 'VITÓRIA!' : 'VOCÊ CAIU...';
    const t = result.victory || result.endless
      ? goldTitle(this, lx, 48, title, 32)
      : text(this, lx, 48, title, 32, '#ff6a5a', { bold: true, stroke: '#2a0608', strokeThickness: 6 });
    this.tweens.add({ targets: t, scale: { from: 0.5, to: 1 }, duration: 420, ease: 'Back.Out' });
    text(this, lx, 76, `${getCharacter(result.character).name} · ${getStage(result.stage).name} · ${tierName(result.tier)}`, 13, '#c8cce0');

    const rows: [string, string][] = [
      ['Tempo', formatTime(result.time) + (newRecord ? '  · recorde!' : '')],
      ['Chefes vencidos', `${result.bosses}/3`],
      ...(result.endless ? [['Ciclo infinito', String(result.cycle)] as [string, string]] : []),
      ['Abates', formatNumber(result.kills)],
      ['Nível', String(result.level)],
      ['Ouro', `+${formatNumber(result.gold)}`],
    ];
    const rowsH = rows.length * 22 + 20;
    const y0 = 94;
    panel(this, lx, y0 + rowsH / 2, pw, rowsH, 'ui_panel');
    rows.forEach(([k, v], i) => {
      const y = y0 + 20 + i * 22;
      this.add.text(lx - pw / 2 + 16, y, k, { fontFamily: FONT, fontSize: px(14), color: '#b8bdd8' }).setOrigin(0, 0.5);
      this.add.text(lx + pw / 2 - 16, y, v, { fontFamily: FONT, fontSize: px(14), fontStyle: 'bold', color: k === 'Ouro' ? '#ffd86a' : '#ffffff' }).setOrigin(1, 0.5);
    });

    // baú de itens da partida
    const lootH = lootRow(this, result, lx, y0 + rowsH + 22, pw);
    // dano por arma: ajuda a entender o que funcionou
    const reactions = [...result.reactions].sort((a, b) => b.dealt - a.dealt);
    const weapons = [...result.weapons].sort((a, b) => b.dealt - a.dealt).slice(0, wide ? 5 : reactions.length ? 3 : 4);
    const total = weapons.reduce((s, w) => s + w.dealt, 0) || 1;
    let y = wide ? 40 : y0 + rowsH + 26 + lootH + 6;
    const left = rx - pw / 2;
    text(this, rx, y, 'DANO POR ARMA', 13, '#ffd86a', { bold: true });
    y += 22;
    for (const w of weapons) {
      const def = WEAPONS[w.id as WeaponId];
      panel(this, left + 14, y, 26, 26, 'ui_slot');
      this.add.image(left + 14, y, def.icon);
      this.add.text(left + 34, y - 6, `${def.name} · nv ${w.level}`, { fontFamily: FONT, fontSize: px(12), color: '#dfe3f5' }).setOrigin(0, 0.5);
      const barW = (pw - 114) * (w.dealt / total);
      this.add.rectangle(left + 34, y + 7, Math.max(3, barW), 5, 0x5d8ced).setOrigin(0, 0.5).setStrokeStyle(1, 0x0b0a14);
      this.add.text(rx + pw / 2 - 8, y, formatNumber(w.dealt), { fontFamily: FONT, fontSize: px(13), fontStyle: 'bold', color: '#ffffff' }).setOrigin(1, 0.5);
      y += 32;
    }
    if (reactions.length) {
      const line = reactions.map((r) => `${r.name} ${formatNumber(r.dealt)}`).join(' · ');
      text(this, rx, y + 2, `Reações: ${line}`, 12, '#9fe8ff', { bold: true, wrap: pw - 12 });
    }

    text(this, lx, height - 118, `Ouro total: ${formatNumber(save.gold)}`, 14, '#ffd86a', { bold: true });
    const restart = (target: 'Game' | 'Menu') => {
      sfx('select');
      this.scene.stop('Game');
      this.scene.stop('Hud');
      this.scene.stop();
      this.scene.start(target);
    };
    button(this, lx, height - 86, 'JOGAR DE NOVO', () => restart('Game'), { width: 220, height: 44, size: 16, variant: 'primary' });
    button(this, lx, height - 36, 'MENU', () => restart('Menu'), { width: 220, height: 38, size: 14 });
  }
}
