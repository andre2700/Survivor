import Phaser from 'phaser';
import { VIEW, pointerPos, setupCamera } from '../ui/view';
import { formatNumber } from '../core/format';
import { RUN_DURATION } from '../data/waves';
import { WEAPONS } from '../data/weapons';
import { COLORS, FONT, button, drawBar, panel, text, px } from '../ui/theme';
import type { GameScene } from './GameScene';

const JOY_RADIUS = 34;

export function formatTime(sec: number) {
  const s = Math.floor(sec);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export class HudScene extends Phaser.Scene {
  private game$!: GameScene;
  private bars!: Phaser.GameObjects.Graphics;
  private levelText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private killText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private bossText!: Phaser.GameObjects.Text;
  private bossPanel!: Phaser.GameObjects.NineSlice;
  private announceText!: Phaser.GameObjects.Text;
  private icons!: Phaser.GameObjects.Container;
  private iconSig = '';
  private joyBase!: Phaser.GameObjects.Image;
  private joyKnob!: Phaser.GameObjects.Image;
  private joyPointer: number | null = null;
  private joyOrigin = new Phaser.Math.Vector2();
  private last = { level: -1, time: -1, kills: -1, gold: -1 };

  constructor() {
    super('Hud');
  }

  create() {
    setupCamera(this);
    this.game$ = this.scene.get('Game') as GameScene;
    const { width } = VIEW;
    this.last = { level: -1, time: -1, kills: -1, gold: -1 };
    this.iconSig = '';

    // faixa superior: XP + nível
    panel(this, width / 2, 14, width - 8, 26, 'ui_panel_dark');
    this.bars = this.add.graphics();
    this.add.circle(26, 15, 17, 0x0b0a14);
    this.add.circle(26, 15, 15, 0x3456c0).setStrokeStyle(2, 0xa8c8ff);
    this.levelText = text(this, 26, 14, '1', 14, '#ffffff', { bold: true, strokeThickness: 3 });

    // cronômetro, abates e ouro
    this.timeText = text(this, width / 2, 46, '00:00', 22, '#ffffff', { bold: true, strokeThickness: 5 });
    this.add.image(18, 44, 'icon_skull');
    this.killText = text(this, 30, 44, '0', 13, '#f4f4f4', { bold: true, strokeThickness: 3 }).setOrigin(0, 0.5);
    this.add.image(18, 64, 'coin');
    this.goldText = text(this, 30, 64, '0', 13, '#ffd86a', { bold: true, strokeThickness: 3 }).setOrigin(0, 0.5);
    this.icons = this.add.container(8, 78);

    button(this, width - 24, 48, 'II', () => this.game$.openPause(), { width: 34, height: 30, size: 14 });

    this.bossPanel = panel(this, width / 2, 128, width - 40, 34, 'ui_panel_dark').setVisible(false).setDepth(-1);
    this.bossText = text(this, width / 2, 120, '', 11, '#ff9a7a', { bold: true, strokeThickness: 3 }).setVisible(false);
    this.announceText = text(this, width / 2, 170, '', 16, '#ffd86a', { bold: true, strokeThickness: 5 }).setAlpha(0);

    this.joyBase = this.add.image(0, 0, 'aura').setTint(0xc8d4ff).setAlpha(0.45).setScale((JOY_RADIUS * 2.4) / 96).setVisible(false);
    this.joyKnob = this.add.image(0, 0, 'glow').setTint(0xffffff).setScale(1.1).setVisible(false);

    this.input.addPointer(2);
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);

    this.events.on(Phaser.Scenes.Events.PAUSE, this.releaseJoystick, this);
    const onAnnounce = (msg: string) => this.announce(msg);
    this.game$.events.on('announce', onAnnounce);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game$.events.off('announce', onAnnounce));
  }

  private onDown(pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) {
    if (over.length > 0 || this.joyPointer !== null) return;
    this.joyPointer = pointer.id;
    const p = pointerPos(this, pointer);
    this.joyOrigin.set(p.x, p.y);
    this.joyBase.setPosition(p.x, p.y).setVisible(true);
    this.joyKnob.setPosition(p.x, p.y).setVisible(true);
  }

  private onMove(pointer: Phaser.Input.Pointer) {
    if (pointer.id !== this.joyPointer) return;
    const p = pointerPos(this, pointer);
    const v = new Phaser.Math.Vector2(p.x - this.joyOrigin.x, p.y - this.joyOrigin.y);
    const len = v.length();
    if (len > JOY_RADIUS) {
      // a base acompanha o dedo quando ele passa do limite
      const excess = v.clone().normalize().scale(len - JOY_RADIUS);
      this.joyOrigin.add(excess);
      this.joyBase.setPosition(this.joyOrigin.x, this.joyOrigin.y);
      v.setLength(JOY_RADIUS);
    }
    this.joyKnob.setPosition(this.joyOrigin.x + v.x, this.joyOrigin.y + v.y);
    const mag = v.length() / JOY_RADIUS;
    if (mag < 0.15) {
      this.game$.joy.x = this.game$.joy.y = 0;
    } else {
      v.normalize();
      const m = Math.min(1, (mag - 0.15) / 0.6);
      this.game$.joy.x = v.x * m;
      this.game$.joy.y = v.y * m;
    }
  }

  private onUp(pointer: Phaser.Input.Pointer) {
    if (pointer.id === this.joyPointer) this.releaseJoystick();
  }

  private releaseJoystick() {
    this.joyPointer = null;
    this.joyBase.setVisible(false);
    this.joyKnob.setVisible(false);
    if (this.game$) this.game$.joy.x = this.game$.joy.y = 0;
  }

  private announce(msg: string) {
    this.announceText.setText(msg).setAlpha(1).setScale(1.4);
    this.tweens.killTweensOf(this.announceText);
    this.tweens.add({ targets: this.announceText, scale: 1, duration: 260, ease: 'Back.Out' });
    this.tweens.add({ targets: this.announceText, alpha: 0, delay: 2200, duration: 500 });
  }

  update() {
    const g = this.game$;
    const { width } = VIEW;

    this.bars.clear();
    drawBar(this.bars, 48, 9, width - 62, 10, g.xp / g.xpNext, COLORS.xp, 0x141a3a);

    if (g.level !== this.last.level) {
      this.last.level = g.level;
      this.levelText.setText(String(g.level)).setFontSize(g.level >= 100 ? 11 : 14);
    }
    const sec = Math.floor(g.elapsed);
    if (sec !== this.last.time) {
      this.last.time = sec;
      const label = g.endless ? `${formatTime(sec)} · C${g.cycle}` : formatTime(sec);
      this.timeText.setText(label).setColor(g.endless ? '#d6a6ff' : sec >= RUN_DURATION ? '#ff9a7a' : '#ffffff');
    }
    if (g.kills !== this.last.kills) this.killText.setText(formatNumber((this.last.kills = g.kills)));
    const gold = Math.floor(g.gold);
    if (gold !== this.last.gold) this.goldText.setText(formatNumber((this.last.gold = gold)));

    this.updateIcons();

    const boss = g.boss;
    const showBoss = !!boss && boss.active;
    this.bossPanel.setVisible(showBoss);
    this.bossText.setVisible(showBoss);
    if (showBoss && boss) {
      this.bossText.setText('DEMÔNIO ANCESTRAL');
      drawBar(this.bars, 30, 130, width - 60, 8, boss.hp / boss.maxHp, COLORS.hp, COLORS.hpBack);
    }
  }

  private updateIcons() {
    const weapons = this.game$.ownedWeapons.map((w) => [w.id, w.level] as const);
    const sig = JSON.stringify(weapons);
    if (sig === this.iconSig) return;
    this.iconSig = sig;
    this.icons.removeAll(true);
    // sem limite de armas: quebra em linhas de 8 ícones
    weapons.forEach(([id, lvl], i) => this.addIcon(WEAPONS[id].icon, lvl, (i % 8) * 24, Math.floor(i / 8) * 24));
  }

  private addIcon(key: string, level: number, x: number, y: number) {
    const slot = panel(this, x + 11, y + 11, 22, 22, 'ui_slot');
    const img = this.add.image(x + 11, y + 11, key);
    const pip = this.add.text(x + 22, y + 23, formatNumber(level), {
      fontFamily: FONT, fontSize: px(10), fontStyle: 'bold', color: level >= 10 ? '#ffd86a' : '#ffffff', stroke: '#0b0a14', strokeThickness: 3,
    }).setOrigin(1, 1);
    this.icons.add([slot, img, pip]);
  }
}
