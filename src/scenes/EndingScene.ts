import Phaser from 'phaser';
import { loadSave, writeSave } from '../systems/save';
import { sfx } from '../systems/sfx';
import { button, goldTitle, text } from '../ui/theme';
import { VIEW, setupCamera } from '../ui/view';
import type { RunResult } from './GameScene';

/** Linhas do final: a história fecha e os créditos sobem devagar. */
const LINES: [string, number, string][] = [
  ['O Demônio Ancestral caiu.', 16, '#ffe9a0'],
  ['A Cidadela desmorona e o céu vermelho se apaga.', 13, '#e8e2d0'],
  ['Da Clareira às Ruínas, as terras voltam a respirar.', 13, '#e8e2d0'],
  ['', 10, ''],
  ['Mas a escuridão nunca dorme por muito tempo...', 13, '#d6a6ff'],
  ['Dificuldades maiores esperam em cada fase,', 13, '#e8e2d0'],
  ['e o Modo Infinito não tem fim.', 13, '#e8e2d0'],
  ['', 10, ''],
  ['SURVIVOR', 22, '#ffd86a'],
  ['Obrigado por jogar!', 14, '#ffffff'],
];

/**
 * Final do jogo: aparece uma vez, ao vencer o Demônio Ancestral na Cidadela (Normal), antes da tela
 * de vitória. Ao continuar, abre a vitória de sempre (modo infinito ou encerrar).
 */
export class EndingScene extends Phaser.Scene {
  constructor() {
    super('Ending');
  }

  create(result: RunResult) {
    this.scene.bringToTop();
    setupCamera(this);
    const { width, height } = VIEW;
    this.add.rectangle(-VIEW.bleed, 0, VIEW.screenWidth, height, 0x07050c, 0.94).setOrigin(0).setInteractive();
    const short = height < 600;
    const title = goldTitle(this, width / 2, short ? 40 : height * 0.14, 'A CIDADELA CAIU!', short ? 30 : 36);
    this.tweens.add({ targets: title, scale: { from: 0.4, to: 1 }, alpha: { from: 0, to: 1 }, duration: 900, ease: 'Back.Out' });
    let y = short ? 82 : height * 0.24;
    const gap = short ? 21 : 30;
    LINES.forEach(([line, size, color], i) => {
      if (!line) {
        y += gap * 0.5;
        return;
      }
      const t = size > 16 ? goldTitle(this, width / 2, y, line, short ? 24 : 30) : text(this, width / 2, y, line, short ? Math.min(size, 15) : size, color, { wrap: width - 40, shadow: true });
      t.setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, y: { from: y + 12, to: y }, duration: 700, delay: 700 + i * 450 });
      y += gap + (size > 16 ? 14 : 0);
    });
    sfx('levelup');
    const save = loadSave();
    save.endingSeen = true;
    writeSave(save);
    const b = button(this, width / 2, height - (short ? 30 : 60), 'CONTINUAR', () => {
      sfx('select');
      this.scene.stop();
      this.scene.launch('Victory', result);
    }, { width: 220, height: 44, size: 17, variant: 'primary' });
    b.setAlpha(0);
    this.tweens.add({ targets: b, alpha: 1, duration: 500, delay: 700 + LINES.length * 450 });
  }
}
