import Phaser from 'phaser';
import { CHARACTERS } from '../data/characters';
import { META_UPGRADES, metaCost } from '../data/meta';
import { WEAPONS } from '../data/weapons';
import { createAnimations, generateTextures } from '../art/textures';
import { loadSave, writeSave } from '../systems/save';
import { setSoundEnabled, sfx, unlockAudio } from '../systems/sfx';
import { COLORS, FONT, button, panel, text } from '../ui/theme';
import { formatTime } from './HudScene';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    generateTextures(this);
    createAnimations(this);
    setSoundEnabled(loadSave().sound);
    this.scene.start('Menu');
  }
}

/** Fundo animado compartilhado pelos menus. */
function menuBackground(scene: Phaser.Scene) {
  const { width, height } = scene.scale;
  const ground = scene.add.tileSprite(0, 0, width, height, 'ground').setOrigin(0).setAlpha(0.5);
  scene.add.rectangle(0, 0, width, height, COLORS.bg, 0.55).setOrigin(0);
  scene.events.on(Phaser.Scenes.Events.UPDATE, (_t: number, dt: number) => {
    ground.tilePositionX += dt * 0.01;
    ground.tilePositionY += dt * 0.006;
  });
}

function goldLabel(scene: Phaser.Scene, gold: number) {
  const { width } = scene.scale;
  scene.add.image(width - 16, 14, 'coin').setScale(1.5);
  return scene.add.text(width - 26, 14, String(gold), { fontFamily: FONT, fontSize: '8px', color: '#ffcd75' }).setOrigin(1, 0.5);
}

export class MenuScene extends Phaser.Scene {
  private index = 0;

  constructor() {
    super('Menu');
  }

  create() {
    const { width, height } = this.scale;
    const save = loadSave();
    this.index = Math.max(0, CHARACTERS.findIndex((c) => c.id === save.selected));
    menuBackground(this);
    goldLabel(this, save.gold);

    const sound = button(this, 22, 14, save.sound ? 'SOM' : 'MUDO', () => {
      save.sound = !save.sound;
      setSoundEnabled(save.sound);
      writeSave(save);
      this.scene.restart();
    }, { width: 40, height: 18, color: save.sound ? '#f4f4f4' : '#566c86' });
    sound.setScale(0.9);

    const title = text(this, width / 2, height * 0.13, 'SURVIVOR', 24, '#ffcd75').setStroke('#b13e53', 6);
    this.tweens.add({ targets: title, y: title.y - 4, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    text(this, width / 2, height * 0.13 + 28, 'Sobreviva às hordas', 8, '#94b0c2');

    // Seleção de herói
    const cy = height * 0.4;
    panel(this, width / 2, cy, width - 40, 170, COLORS.panelDark);
    const hero = this.add.sprite(width / 2, cy - 38, CHARACTERS[this.index].texture, 0).setScale(4);
    const shadow = this.add.image(width / 2, cy - 4, 'shadow').setScale(4);
    shadow.setDepth(-1);
    const name = text(this, width / 2, cy + 14, '', 8, '#f4f4f4');
    const desc = this.add.text(width / 2, cy + 30, '', {
      fontFamily: FONT, fontSize: '8px', color: '#94b0c2', align: 'center', wordWrap: { width: width - 70 }, lineSpacing: 3,
    }).setOrigin(0.5, 0);
    const weaponIcon = this.add.image(width / 2 - 40, cy + 68, 'bolt').setScale(1.5);
    const weaponName = this.add.text(width / 2 - 28, cy + 68, '', { fontFamily: FONT, fontSize: '8px', color: '#ffcd75' }).setOrigin(0, 0.5);

    let action: Phaser.GameObjects.Container | null = null;
    const refresh = () => {
      const c = CHARACTERS[this.index];
      const unlocked = save.unlocked.includes(c.id);
      hero.setTexture(c.texture, 0).play(`${c.texture}_walk`).setTint(unlocked ? 0xffffff : 0x333c57);
      name.setText(unlocked ? c.name.toUpperCase() : `${c.name.toUpperCase()} (BLOQUEADO)`);
      desc.setText(c.description);
      weaponIcon.setTexture(WEAPONS[c.weapon].icon);
      weaponName.setText(WEAPONS[c.weapon].name);
      if (unlocked) {
        save.selected = c.id;
        writeSave(save);
      }
      action?.destroy();
      if (unlocked) {
        action = button(this, width / 2, height * 0.68, 'JOGAR', () => this.startGame(), { width: 200, height: 40, size: 16, fill: 0x257179 });
      } else {
        const can = save.gold >= c.cost;
        action = button(this, width / 2, height * 0.68, `LIBERAR  ${c.cost}`, () => {
          if (save.gold < c.cost) return;
          save.gold -= c.cost;
          save.unlocked.push(c.id);
          writeSave(save);
          sfx('levelup');
          this.scene.restart();
        }, { width: 200, height: 40, color: can ? '#ffcd75' : '#566c86', disabled: !can });
      }
    };
    const cycle = (d: number) => {
      unlockAudio();
      sfx('select');
      this.index = (this.index + d + CHARACTERS.length) % CHARACTERS.length;
      refresh();
    };
    button(this, 40, cy - 38, '<', () => cycle(-1), { width: 32, height: 32, size: 16 });
    button(this, width - 40, cy - 38, '>', () => cycle(1), { width: 32, height: 32, size: 16 });
    refresh();

    button(this, width / 2, height * 0.68 + 50, 'MELHORIAS', () => {
      unlockAudio();
      sfx('select');
      this.scene.start('Shop');
    }, { width: 200, height: 32 });

    if (save.bestTime > 0) {
      text(this, width / 2, height - 30, `Recorde: ${formatTime(save.bestTime)}  |  ${save.bestKills} abates`, 8, '#566c86');
    }
    text(this, width / 2, height - 14, 'Arraste para mover. Ataques são automáticos.', 8, '#566c86').setScale(0.75);

    this.input.keyboard?.once('keydown-ENTER', () => this.startGame());
  }

  private startGame() {
    const save = loadSave();
    const c = CHARACTERS[this.index];
    if (!save.unlocked.includes(c.id)) return;
    unlockAudio();
    sfx('select');
    this.cameras.main.fadeOut(200, 26, 28, 44);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Game'));
  }
}

export class ShopScene extends Phaser.Scene {
  constructor() {
    super('Shop');
  }

  create() {
    const { width, height } = this.scale;
    const save = loadSave();
    menuBackground(this);
    goldLabel(this, save.gold);
    text(this, width / 2, 40, 'MELHORIAS', 16, '#ffcd75').setStroke('#1a1c2c', 4);
    text(this, width / 2, 58, 'Permanentes para todas as partidas', 8, '#94b0c2').setScale(0.75);

    const rowH = Math.min(46, (height - 140) / META_UPGRADES.length);
    META_UPGRADES.forEach((def, i) => {
      const lvl = save.meta[def.id] ?? 0;
      const maxed = lvl >= def.maxLevel;
      const cost = metaCost(def, lvl);
      const y = 72 + i * rowH + rowH / 2;
      panel(this, width / 2, y, width - 20, rowH - 4, COLORS.panelDark);
      const icon = this.add.image(26, y, def.icon);
      icon.setScale(Math.floor(20 / Math.max(icon.width, icon.height)) || 1);
      this.add.text(44, y - 9, def.name, { fontFamily: FONT, fontSize: '8px', color: '#f4f4f4' }).setOrigin(0, 0.5);
      this.add.text(44, y + 3, def.description, { fontFamily: FONT, fontSize: '8px', color: '#94b0c2' }).setOrigin(0, 0.5).setScale(0.75);
      for (let p = 0; p < def.maxLevel; p++) {
        this.add.rectangle(44 + p * 9, y + 13, 7, 4, p < lvl ? COLORS.accent : 0x566c86).setOrigin(0, 0.5);
      }
      const can = !maxed && save.gold >= cost;
      button(this, width - 50, y, maxed ? 'MÁX' : String(cost), () => {
        if (!can) return;
        save.gold -= cost;
        save.meta[def.id] = lvl + 1;
        writeSave(save);
        sfx('levelup');
        this.scene.restart();
      }, { width: 64, height: Math.min(26, rowH - 12), color: maxed ? '#38b764' : can ? '#ffcd75' : '#566c86', disabled: !can && !maxed });
    });

    button(this, width / 2, height - 30, 'VOLTAR', () => {
      sfx('select');
      this.scene.start('Menu');
    }, { width: 160, height: 30 });
  }
}
