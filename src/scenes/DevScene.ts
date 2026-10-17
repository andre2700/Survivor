import Phaser from 'phaser';
import { WEAPONS, WEAPON_IDS } from '../data/weapons';
import { INFINITE_GOLD, RUN_OPTIONS, SPEED_OPTIONS, cycle, dev, setDev } from '../systems/dev';
import { loadSave, writeSave } from '../systems/save';
import { sfx } from '../systems/sfx';
import { button, goldTitle, panel, text } from '../ui/theme';
import { VIEW, setupCamera } from '../ui/view';
import type { GameScene } from './GameScene';

/** Ouro real do jogador, guardado enquanto as moedas infinitas estão ligadas. */
const REAL_GOLD_KEY = 'survivor-dev-gold';

/**
 * Painel de desenvolvedor. Aberto do menu (só configurações) ou da pausa (configurações e
 * ações na partida: níveis, armas, chefe...).
 */
export class DevScene extends Phaser.Scene {
  private from = 'Menu';

  constructor() {
    super('Dev');
  }

  init(data: { from?: string }) {
    this.from = data.from ?? 'Menu';
  }

  create() {
    setupCamera(this);
    const { width, height } = VIEW;
    const inRun = this.from === 'Pause';
    const game = this.scene.get('Game') as GameScene;
    this.add.rectangle(-VIEW.bleed, 0, VIEW.screenWidth, height, 0x0b0a14, 0.92).setOrigin(0).setInteractive();
    goldTitle(this, width / 2, 34, 'DEV', 30);
    const refresh = () => this.scene.restart({ from: this.from });
    const yes = (on: boolean) => (on ? 'SIM' : 'NÃO');

    // ---------- Configurações (valem também para as próximas partidas) ----------
    const settings: [string, () => void][] = [
      [`Moedas infinitas: ${yes(dev.infiniteGold)}`, () => {
        const save = loadSave();
        if (!dev.infiniteGold) {
          localStorage.setItem(REAL_GOLD_KEY, String(save.gold));
          setDev({ infiniteGold: true });
          save.gold = INFINITE_GOLD;
        } else {
          setDev({ infiniteGold: false });
          save.gold = Number(localStorage.getItem(REAL_GOLD_KEY) ?? 0);
        }
        writeSave(save);
      }],
      [`Partida: ${dev.runMinutes} min`, () => setDev({ runMinutes: cycle(RUN_OPTIONS, dev.runMinutes) })],
      [`Herói imortal: ${yes(dev.heroImmortal)}`, () => setDev({ heroImmortal: !dev.heroImmortal })],
      [`Inimigos imortais: ${yes(dev.enemiesImmortal)}`, () => setDev({ enemiesImmortal: !dev.enemiesImmortal })],
      [`Velocidade: ${dev.speed}×`, () => {
        setDev({ speed: cycle(SPEED_OPTIONS, dev.speed) });
        if (inRun) game.applyDevSpeed();
      }],
    ];
    let y = 78;
    panel(this, width / 2, y + (settings.length * 40) / 2 + 4, width - 24, settings.length * 40 + 20, 'ui_panel_dark');
    settings.forEach(([label, fn], i) => {
      button(this, width / 2, y + 24 + i * 40, label, () => {
        sfx('select');
        fn();
        refresh();
      }, { width: width - 60, height: 34, size: 13 });
    });
    y += settings.length * 40 + 30;

    // ---------- Ações na partida ----------
    if (inRun) {
      text(this, width / 2, y, 'NA PARTIDA', 13, '#ffd86a', { bold: true });
      const actions: [string, () => void][] = [
        ['+1 nível', () => game.devLevelUp(1)],
        ['+5 níveis', () => game.devLevelUp(5)],
        ['Todas as armas +5', () => game.devWeapon(5)],
        ['Chamar o chefe', () => game.devBoss()],
        ['Matar todos', () => game.devKillAll()],
        ['Avançar 1 min', () => game.devSkip(60)],
        ['Curar', () => game.devHeal()],
      ];
      const bw = (width - 44) / 2;
      actions.forEach(([label, fn], i) => {
        const x = width / 2 + (i % 2 === 0 ? -1 : 1) * (bw / 2 + 4);
        button(this, x, y + 26 + Math.floor(i / 2) * 40, label, () => {
          sfx('select');
          fn();
          refresh();
        }, { width: bw, height: 34, size: 12 });
      });
      y += 26 + Math.ceil(actions.length / 2) * 40;

      // uma arma por ícone: toque = +1 nível
      text(this, width / 2, y, 'ARMAS (toque = +1 nível)', 11, '#b8bdd8');
      const cols = 5;
      const cell = (width - 40) / cols;
      WEAPON_IDS.forEach((id, i) => {
        const cx = 20 + cell * (i % cols) + cell / 2;
        const cy = y + 34 + Math.floor(i / cols) * 54;
        const level = game.loadout.weapons[id] ?? 0;
        panel(this, cx, cy, 40, 40, level ? 'ui_card_1' : 'ui_slot');
        const icon = this.add.image(cx, cy, WEAPONS[id].icon).setScale(1.5).setAlpha(level ? 1 : 0.5);
        text(this, cx, cy + 26, level ? `nv ${level}` : '—', 10, level ? '#ffffff' : '#6a6e88', { bold: true });
        icon.setInteractive({ useHandCursor: true }).on('pointerup', () => {
          sfx('select');
          game.devWeapon(1, id);
          refresh();
        });
      });
    }

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
