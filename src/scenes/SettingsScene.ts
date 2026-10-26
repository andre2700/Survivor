import Phaser from 'phaser';
import { loadSave, writeSave } from '../systems/save';
import { settings, setSettings, vibrate, type Settings } from '../systems/settings';
import { setMusicEnabled } from '../systems/music';
import { setSoundEnabled, sfx } from '../systems/sfx';
import { button, goldTitle, panel, text } from '../ui/theme';
import { VIEW, setupCamera } from '../ui/view';

/**
 * Ajustes do jogador: som, vibração, tremor de tela, números de dano, idioma e rever o tutorial.
 * Abre por cima do menu ou da pausa e volta para quem chamou.
 */
export class SettingsScene extends Phaser.Scene {
  private from = 'Menu';

  constructor() {
    super('Settings');
  }

  init(data: { from?: string }) {
    this.from = data.from ?? 'Menu';
  }

  create() {
    // aberta por cima da pausa (que vem depois na lista de cenas): fica na frente
    this.scene.bringToTop();
    setupCamera(this);
    const { width, height } = VIEW;
    this.add.rectangle(-VIEW.bleed, 0, VIEW.screenWidth, height, 0x0b0a14, 0.9).setOrigin(0).setInteractive();
    const top = Math.max(30, height / 2 - 230);
    goldTitle(this, width / 2, top, 'AJUSTES', 30);
    const pw = Math.min(width - 30, 360);
    const yes = (on: boolean) => (on ? 'LIGADO' : 'DESLIGADO');
    const toggle = (key: keyof Omit<Settings, 'language'>, after?: () => void) => () => {
      setSettings({ [key]: !settings[key] } as Partial<Settings>);
      after?.();
    };
    const rows: [string, string, () => void, boolean][] = [
      ['Efeitos sonoros', yes(settings.sound), toggle('sound', () => setSoundEnabled(settings.sound)), settings.sound],
      ['Música', yes(settings.music), toggle('music', () => setMusicEnabled(settings.music)), settings.music],
      ['Vibração', yes(settings.vibration), toggle('vibration', () => vibrate(60)), settings.vibration],
      ['Tremor de tela', yes(settings.shake), toggle('shake'), settings.shake],
      ['Números de dano', yes(settings.damageNumbers), toggle('damageNumbers'), settings.damageNumbers],
      ['Idioma', settings.language === 'pt' ? 'PORTUGUÊS' : 'ENGLISH', () => setSettings({ language: 'pt' }), true],
    ];
    const y0 = top + 50;
    const rowH = VIEW.height < 600 ? 38 : 46;
    panel(this, width / 2, y0 + (rows.length * rowH) / 2 + 6, pw, rows.length * rowH + 24, 'ui_panel_dark');
    rows.forEach(([label, value, fn, on], i) => {
      const y = y0 + 24 + i * rowH;
      text(this, width / 2 - pw / 2 + 20, y, label, 15, '#e8ecff', { bold: true }).setOrigin(0, 0.5);
      button(this, width / 2 + pw / 2 - 74, y, value, () => {
        sfx('select');
        fn();
        this.scene.restart({ from: this.from });
      }, { width: 120, height: 32, size: 12, variant: on ? 'primary' : undefined });
    });
    let y = y0 + rows.length * rowH + 30;
    text(this, width / 2, y, 'English: em breve', 10, '#8a8ca0');
    y += VIEW.height < 600 ? 14 : 30;
    // rever o tutorial na próxima partida
    const save = loadSave();
    button(this, width / 2, y + 10, save.tutorial >= 0 && save.tutorial < 99 ? 'TUTORIAL NA PRÓXIMA PARTIDA ✓' : 'VER O TUTORIAL DE NOVO', () => {
      const s = loadSave();
      s.tutorial = 0;
      s.tips = [];
      writeSave(s);
      sfx('select');
      this.scene.restart({ from: this.from });
    }, { width: Math.min(pw, 280), height: 34, size: 12 });

    button(this, width / 2, height - 34, 'VOLTAR', () => {
      sfx('select');
      if (this.from === 'Menu') {
        this.scene.start('Menu');
        return;
      }
      this.scene.stop();
      this.scene.resume(this.from);
    }, { width: 200, height: 40, size: 15, variant: 'primary' });
  }
}
