import Phaser from 'phaser';
import { formatNumber } from '../core/format';
import { getCharacter } from '../data/characters';
import { TAGS } from '../data/tags';
import { WEAPONS, type Tag, type WeaponId } from '../data/weapons';
import { loadSave, writeSave } from '../systems/save';
import { sfx } from '../systems/sfx';
import { RARITIES, describeOption } from '../systems/upgrades';
import { COLORS, FONT, button, panel, text } from '../ui/theme';
import type { GameScene, RunResult } from './GameScene';
import { formatTime } from './HudScene';

function dim(scene: Phaser.Scene, alpha = 0.7) {
  const { width, height } = scene.scale;
  return scene.add.rectangle(0, 0, width, height, COLORS.bg, alpha).setOrigin(0).setInteractive();
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
    this.render();
  }

  private render() {
    this.children.removeAll(true);
    const { width, height } = this.scale;
    const game = this.scene.get('Game') as GameScene;
    const meta = loadSave().meta;
    const options = game.currentOptions;
    dim(this, 0.75);

    const titleY = 30;
    const title = text(this, width / 2, titleY, 'SUBIU DE NÍVEL!', 16, '#ffcd75').setStroke('#1a1c2c', 4);
    if (this.mode === 'pick') this.tweens.add({ targets: title, scale: { from: 1.3, to: 1 }, duration: 220, ease: 'Back.Out' });
    const hint = this.mode === 'banish' ? 'Toque na carta para BANIR' : this.mode === 'lock' ? 'Toque na carta para FIXAR' : `Nível ${game.level} · escolha uma melhoria`;
    text(this, width / 2, titleY + 20, hint, 8, this.mode === 'pick' ? '#94b0c2' : '#ef7d57');

    const showTools = (meta.reroll ?? 0) > 0 || (meta.banish ?? 0) > 0 || (meta.lock ?? 0) > 0;
    const top = titleY + 38;
    const bottom = height - (showTools ? 56 : 16);
    const n = options.length;
    const gap = 8;
    const cardH = Math.min(78, Math.floor((bottom - top - gap * (n - 1)) / n));
    const cardW = width - 24;
    let busy = false;

    options.forEach((opt, i) => {
      const info = describeOption(opt, game.loadout, game.stats, game.statsWith);
      const rarity = RARITIES[opt.rarity];
      const y = top + i * (cardH + gap) + cardH / 2;
      const c = this.add.container(width / 2, y);
      const border = this.mode === 'banish' ? 0xb13e53 : this.mode === 'lock' ? 0x41a6f6 : rarity.color;
      const bg = panel(this, 0, 0, cardW, cardH, COLORS.panel, border);
      const iconSize = Math.min(44, cardH - 16);
      const iconBg = this.add.rectangle(-cardW / 2 + 8 + iconSize / 2, 0, iconSize, iconSize, COLORS.bg, 1);
      const icon = this.add.image(iconBg.x, 0, info.icon);
      icon.setScale(Math.max(1, Math.floor((iconSize - 8) / Math.max(icon.width, icon.height))));
      const left = -cardW / 2 + iconSize + 16;
      const textW = cardW - iconSize - 24;
      const yTop = -cardH / 2 + 7;
      const t = this.add.text(left, yTop, info.title, { fontFamily: FONT, fontSize: '8px', color: '#f4f4f4' });
      const tag = this.add.text(left, yTop + 12, info.tag, { fontFamily: FONT, fontSize: '8px', color: rarity.text });
      const desc = this.add.text(left, yTop + 24, info.text, {
        fontFamily: FONT, fontSize: '8px', color: '#c8d4dc', wordWrap: { width: textW }, lineSpacing: 3,
      });
      c.add([bg, iconBg, icon, t, tag, desc]);
      if (info.change) {
        c.add(this.add.text(left, cardH / 2 - 13, info.change, { fontFamily: FONT, fontSize: '8px', color: '#a7f070' }));
      }
      if (game.isLocked(opt)) {
        c.add(this.add.text(cardW / 2 - 6, -cardH / 2 + 6, 'FIXADA', { fontFamily: FONT, fontSize: '8px', color: '#41a6f6' }).setOrigin(1, 0));
      }
      c.setSize(cardW, cardH).setInteractive({ useHandCursor: true });
      if (this.mode === 'pick') {
        c.setAlpha(0).setX(width / 2 + 24);
        this.tweens.add({ targets: c, alpha: 1, x: width / 2, duration: 160, delay: 60 * i });
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
        this.tweens.add({ targets: c, scale: 1.04, duration: 80, yoyo: true, onComplete: () => game.chooseUpgrade(opt) });
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
    const bw = Math.min(104, (width - 24 - (visible.length - 1) * 8) / visible.length);
    visible.forEach((tl, i) => {
      const x = width / 2 + (i - (visible.length - 1) / 2) * (bw + 8);
      button(this, x, height - 30, tl.label, tl.onClick, { width: bw, height: 30, disabled: tl.count <= 0 });
    });
  }
}

export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create() {
    const { width, height } = this.scale;
    const game = this.scene.get('Game') as GameScene;
    dim(this, 0.75);
    text(this, width / 2, height * 0.22, 'PAUSADO', 16, '#ffcd75').setStroke('#1a1c2c', 4);
    button(this, width / 2, height * 0.34, 'CONTINUAR', () => game.resumeFromPause(), { width: 180, height: 32 });
    button(this, width / 2, height * 0.34 + 44, 'DESISTIR', () => {
      this.scene.stop();
      game.state = 'playing';
      game.endRun(game.endless);
      game.scene.resume();
    }, { width: 180, height: 32 });
    statsPanel(this, game, height * 0.34 + 84);
    this.input.keyboard?.on('keydown-ESC', () => game.resumeFromPause());
  }
}

/** Painel de atributos atuais e bônus de tags (visível na pausa). */
function statsPanel(scene: Phaser.Scene, game: GameScene, y0: number) {
  const { width } = scene.scale;
  const s = game.stats;
  const pct = (v: number) => `${formatNumber(Math.round(v * 100))}%`;
  const rows: [string, string][] = [
    ['Dano', `+${pct(s.power)}`],
    ['Vel. de ataque', `+${pct(s.attackSpeed)}`],
    ['Área', `+${pct(s.area)}`],
    ['Quantidade', `+${formatNumber(Math.floor(s.amount))}`],
    ['Crítico', `${pct(s.critChance)} ×${s.critDamage.toFixed(1)}`],
    ['Vida', `${formatNumber(game.hp)}/${formatNumber(s.maxHp)}`],
    ['Defesa', formatNumber(s.defense)],
    ['Sorte', formatNumber(s.luck)],
  ];
  const tags = (Object.entries(game.tagCounts) as [Tag, number][]).filter(([, n]) => n > 0).map(([t, n]) => `${TAGS[t].name} ${n}`);
  const h = rows.length * 13 + 24;
  panel(scene, width / 2, y0 + h / 2, width - 40, h, COLORS.panelDark);
  rows.forEach(([k, v], i) => {
    const y = y0 + 14 + i * 13;
    scene.add.text(32, y, k, { fontFamily: FONT, fontSize: '8px', color: '#94b0c2' }).setOrigin(0, 0.5);
    scene.add.text(width - 32, y, v, { fontFamily: FONT, fontSize: '8px', color: '#f4f4f4' }).setOrigin(1, 0.5);
  });
  if (tags.length) {
    scene.add.text(width / 2, y0 + h + 10, `Tags: ${tags.join(' · ')}`, {
      fontFamily: FONT, fontSize: '8px', color: '#566c86', align: 'center', wordWrap: { width: width - 40 },
    }).setOrigin(0.5, 0);
  }
}

export class VictoryScene extends Phaser.Scene {
  constructor() {
    super('Victory');
  }

  create(result: RunResult) {
    const { width, height } = this.scale;
    const game = this.scene.get('Game') as GameScene;
    dim(this, 0.82);
    const t = text(this, width / 2, height * 0.18, 'VITÓRIA!', 24, '#ffcd75').setStroke('#b13e53', 6);
    this.tweens.add({ targets: t, scale: { from: 0.5, to: 1 }, duration: 400, ease: 'Back.Out' });
    text(this, width / 2, height * 0.18 + 30, `${formatTime(result.time)} · ${result.kills} abates · nível ${result.level}`, 8, '#94b0c2');

    panel(this, width / 2, height * 0.45, width - 40, 130, COLORS.panelDark, 0xc56cf0);
    text(this, width / 2, height * 0.45 - 48, 'MODO INFINITO', 8, '#c56cf0');
    this.add.text(width / 2, height * 0.45 - 34, 'Continue com a sua build. A cada 5 minutos, um novo chefe e inimigos bem mais fortes. As recompensas crescem a cada ciclo. Morrer aqui não conta como derrota.', {
      fontFamily: FONT, fontSize: '8px', color: '#c8d4dc', align: 'center', wordWrap: { width: width - 64 }, lineSpacing: 5,
    }).setOrigin(0.5, 0);

    button(this, width / 2, height * 0.68, 'CONTINUAR', () => {
      sfx('levelup');
      game.continueEndless();
    }, { width: 220, height: 36, size: 8, fill: 0x5d275d });
    button(this, width / 2, height * 0.68 + 48, 'ENCERRAR E COLETAR', () => {
      sfx('select');
      this.scene.stop();
      game.state = 'playing';
      game.endRun(true);
      game.scene.resume();
    }, { width: 220, height: 32 });
  }
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(result: RunResult) {
    const { width, height } = this.scale;
    const save = loadSave();
    save.gold += result.gold;
    const newRecord = result.time > save.bestTime;
    save.bestTime = Math.max(save.bestTime, result.time);
    save.bestKills = Math.max(save.bestKills, result.kills);
    save.bestCycle = Math.max(save.bestCycle ?? 0, result.cycle);
    if (result.victory && !result.endless) save.victories++;
    writeSave(save);

    dim(this, 0.85);
    const title = result.endless ? 'FIM DA JORNADA' : result.victory ? 'VITÓRIA!' : 'VOCÊ CAIU...';
    const color = result.endless ? '#c56cf0' : result.victory ? '#ffcd75' : '#b13e53';
    const t = text(this, width / 2, 40, title, 16, color).setStroke('#1a1c2c', 4);
    this.tweens.add({ targets: t, scale: { from: 0.5, to: 1 }, duration: 400, ease: 'Back.Out' });
    text(this, width / 2, 60, getCharacter(result.character).name, 8, '#94b0c2');

    const rows: [string, string][] = [
      ['TEMPO', formatTime(result.time) + (newRecord ? '  RECORDE!' : '')],
      ...(result.endless ? [['CICLO INFINITO', String(result.cycle)] as [string, string]] : []),
      ['ABATES', formatNumber(result.kills)],
      ['NÍVEL', String(result.level)],
      ['OURO', `+${formatNumber(result.gold)}`],
    ];
    const rowsH = rows.length * 18 + 16;
    const y0 = 76;
    panel(this, width / 2, y0 + rowsH / 2, width - 40, rowsH);
    rows.forEach(([k, v], i) => {
      const y = y0 + 16 + i * 18;
      this.add.text(36, y, k, { fontFamily: FONT, fontSize: '8px', color: '#94b0c2' }).setOrigin(0, 0.5);
      this.add.text(width - 36, y, v, { fontFamily: FONT, fontSize: '8px', color: k === 'OURO' ? '#ffcd75' : '#f4f4f4' }).setOrigin(1, 0.5);
    });

    // dano por arma: ajuda a entender o que funcionou
    const weapons = [...result.weapons].sort((a, b) => b.dealt - a.dealt).slice(0, 6);
    const total = weapons.reduce((s, w) => s + w.dealt, 0) || 1;
    let y = y0 + rowsH + 22;
    text(this, width / 2, y, 'DANO POR ARMA', 8, '#ffcd75');
    y += 16;
    for (const w of weapons) {
      const def = WEAPONS[w.id as WeaponId];
      this.add.image(32, y, def.icon).setScale(def.icon === 'axe' ? 0.8 : 1);
      this.add.text(44, y - 4, `${def.name} Nv${w.level}`, { fontFamily: FONT, fontSize: '8px', color: '#c8d4dc' });
      const barW = (width - 140) * (w.dealt / total);
      this.add.rectangle(44, y + 6, Math.max(2, barW), 4, 0x41a6f6).setOrigin(0, 0.5);
      this.add.text(width - 32, y, formatNumber(w.dealt), { fontFamily: FONT, fontSize: '8px', color: '#f4f4f4' }).setOrigin(1, 0.5);
      y += 22;
    }

    text(this, width / 2, height - 108, `Ouro total: ${formatNumber(save.gold)}`, 8, '#ffcd75');
    const restart = (target: 'Game' | 'Menu') => {
      sfx('select');
      this.scene.stop('Game');
      this.scene.stop('Hud');
      this.scene.stop();
      this.scene.start(target);
    };
    button(this, width / 2, height - 80, 'JOGAR DE NOVO', () => restart('Game'), { width: 190, height: 30 });
    button(this, width / 2, height - 42, 'MENU', () => restart('Menu'), { width: 190, height: 30 });
  }
}
