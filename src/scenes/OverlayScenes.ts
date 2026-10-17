import Phaser from 'phaser';
import { getCharacter } from '../data/characters';
import { loadSave, writeSave } from '../systems/save';
import { sfx } from '../systems/sfx';
import { describeOption, type UpgradeOption } from '../systems/upgrades';
import { COLORS, FONT, button, panel, text } from '../ui/theme';
import type { GameScene, RunResult } from './GameScene';
import { formatTime } from './HudScene';

function dim(scene: Phaser.Scene, alpha = 0.7) {
  const { width, height } = scene.scale;
  return scene.add.rectangle(0, 0, width, height, COLORS.bg, alpha).setOrigin(0).setInteractive();
}

export class LevelUpScene extends Phaser.Scene {
  constructor() {
    super('LevelUp');
  }

  create(data: { options: UpgradeOption[]; rerolls: number }) {
    const { width, height } = this.scale;
    const game = this.scene.get('Game') as GameScene;
    dim(this);
    const title = text(this, width / 2, height * 0.16, 'SUBIU DE NÍVEL!', 16, '#ffcd75').setStroke('#1a1c2c', 4);
    this.tweens.add({ targets: title, scale: { from: 1.4, to: 1 }, duration: 250, ease: 'Back.Out' });
    text(this, width / 2, height * 0.16 + 22, 'Escolha uma melhoria', 8, '#94b0c2');

    const cardW = width - 32;
    const cardH = 70;
    const startY = height * 0.16 + 60;
    let chosen = false;
    data.options.forEach((opt, i) => {
      const info = describeOption(opt);
      const y = startY + i * (cardH + 10) + cardH / 2;
      const c = this.add.container(width / 2, y);
      const bg = panel(this, 0, 0, cardW, cardH, COLORS.panel, opt.kind === 'weapon' ? COLORS.accent : COLORS.border);
      const iconBg = this.add.rectangle(-cardW / 2 + 30, 0, 44, 44, COLORS.bg, 1);
      const icon = this.add.image(-cardW / 2 + 30, 0, info.icon);
      icon.setScale(Math.floor(32 / Math.max(icon.width, icon.height)) || 1);
      const left = -cardW / 2 + 62;
      const t = this.add.text(left, -22, info.title, { fontFamily: FONT, fontSize: '8px', color: '#f4f4f4' });
      const tag = this.add.text(left, -10, info.tag, { fontFamily: FONT, fontSize: '8px', color: '#ffcd75' }).setScale(0.75);
      const desc = this.add.text(left, 2, info.text, {
        fontFamily: FONT, fontSize: '8px', color: '#94b0c2', wordWrap: { width: cardW - 72 }, lineSpacing: 3,
      });
      c.add([bg, iconBg, icon, t, tag, desc]);
      c.setSize(cardW, cardH).setInteractive({ useHandCursor: true });
      c.setAlpha(0).setX(width / 2 + 30);
      this.tweens.add({ targets: c, alpha: 1, x: width / 2, duration: 180, delay: 80 * i });
      c.on('pointerup', () => {
        if (chosen) return;
        chosen = true;
        sfx('select');
        this.tweens.add({ targets: c, scale: 1.05, duration: 80, yoyo: true, onComplete: () => game.chooseUpgrade(opt) });
      });
    });

    if (data.rerolls > 0) {
      button(this, width / 2, startY + data.options.length * (cardH + 10) + 20, `TROCAR (${data.rerolls})`, () => {
        if (chosen) return;
        const opts = game.rerollOptions();
        if (opts) this.scene.restart({ options: opts, rerolls: game.rerolls });
      }, { width: 150 });
    }
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
    text(this, width / 2, height * 0.3, 'PAUSADO', 16, '#ffcd75').setStroke('#1a1c2c', 4);
    button(this, width / 2, height * 0.45, 'CONTINUAR', () => game.resumeFromPause(), { width: 180, height: 32 });
    button(this, width / 2, height * 0.45 + 44, 'DESISTIR', () => {
      this.scene.stop();
      game.endRun(false);
      game.scene.resume();
    }, { width: 180, height: 32 });
    this.input.keyboard?.on('keydown-ESC', () => game.resumeFromPause());
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
    if (result.victory) save.victories++;
    writeSave(save);

    dim(this, 0.82);
    const title = result.victory ? 'VITÓRIA!' : 'VOCÊ CAIU...';
    const t = text(this, width / 2, height * 0.2, title, 16, result.victory ? '#ffcd75' : '#b13e53').setStroke('#1a1c2c', 4);
    this.tweens.add({ targets: t, scale: { from: 0.5, to: 1 }, duration: 400, ease: 'Back.Out' });
    text(this, width / 2, height * 0.2 + 22, getCharacter(result.character).name, 8, '#94b0c2');

    const rows: [string, string][] = [
      ['TEMPO', formatTime(result.time) + (newRecord ? '  RECORDE!' : '')],
      ['ABATES', String(result.kills)],
      ['NÍVEL', String(result.level)],
      ['OURO', `+${result.gold}`],
    ];
    panel(this, width / 2, height * 0.43, width - 60, rows.length * 22 + 20);
    rows.forEach(([k, v], i) => {
      const y = height * 0.43 - ((rows.length - 1) * 22) / 2 + i * 22;
      this.add.text(50, y, k, { fontFamily: FONT, fontSize: '8px', color: '#94b0c2' }).setOrigin(0, 0.5);
      this.add.text(width - 50, y, v, { fontFamily: FONT, fontSize: '8px', color: k === 'OURO' ? '#ffcd75' : '#f4f4f4' }).setOrigin(1, 0.5);
    });
    text(this, width / 2, height * 0.6, `Ouro total: ${save.gold}`, 8, '#ffcd75');

    const restart = (target: 'Game' | 'Menu') => {
      sfx('select');
      this.scene.stop('Game');
      this.scene.stop('Hud');
      this.scene.stop();
      this.scene.start(target);
    };
    button(this, width / 2, height * 0.7, 'JOGAR DE NOVO', () => restart('Game'), { width: 190, height: 32 });
    button(this, width / 2, height * 0.7 + 44, 'MENU', () => restart('Menu'), { width: 190, height: 32 });
  }
}
