import Phaser from 'phaser';
import { RUN_DURATION } from '../data/waves';
import { WEAPONS } from '../data/weapons';
import { formatNumber } from '../core/format';
import { COLORS, button, text } from '../ui/theme';
import type { GameScene } from './GameScene';

const JOY_RADIUS = 28;

export function formatTime(sec: number) {
  const s = Math.floor(sec);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export class HudScene extends Phaser.Scene {
  private game$!: GameScene;
  private xpBar!: Phaser.GameObjects.Graphics;
  private bossBar!: Phaser.GameObjects.Graphics;
  private levelText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private killText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private bossText!: Phaser.GameObjects.Text;
  private announceText!: Phaser.GameObjects.Text;
  private icons!: Phaser.GameObjects.Container;
  private iconSig = '';
  private joyBase!: Phaser.GameObjects.Graphics;
  private joyKnob!: Phaser.GameObjects.Graphics;
  private joyPointer: number | null = null;
  private joyOrigin = new Phaser.Math.Vector2();
  private last = { level: -1, time: -1, kills: -1, gold: -1 };

  constructor() {
    super('Hud');
  }

  create() {
    this.game$ = this.scene.get('Game') as GameScene;
    const { width } = this.scale;
    this.last = { level: -1, time: -1, kills: -1, gold: -1 };
    this.iconSig = '';

    this.xpBar = this.add.graphics();
    this.levelText = text(this, width - 4, 6, '', 8).setOrigin(1, 0.5);
    this.timeText = text(this, width / 2, 24, '00:00', 16).setStroke('#1a1c2c', 4);
    this.add.image(10, 23, 'skeleton', 0).setScale(0.75);
    this.killText = text(this, 20, 24, '0', 8).setOrigin(0, 0.5).setStroke('#1a1c2c', 3);
    this.add.image(10, 37, 'coin');
    this.goldText = text(this, 20, 37, '0', 8, '#ffcd75').setOrigin(0, 0.5).setStroke('#1a1c2c', 3);
    this.icons = this.add.container(4, 50);

    button(this, width - 18, 26, 'II', () => this.game$.openPause(), { width: 24, height: 20 });

    this.bossBar = this.add.graphics();
    this.bossText = text(this, width / 2, 64, '', 8, '#ef7d57').setStroke('#1a1c2c', 3).setVisible(false);
    this.announceText = text(this, width / 2, 110, '', 8, '#ffcd75').setStroke('#1a1c2c', 3).setAlpha(0);

    this.joyBase = this.add.graphics().setVisible(false);
    this.joyKnob = this.add.graphics().setVisible(false);
    this.joyBase.lineStyle(2, 0xf4f4f4, 0.5).strokeCircle(0, 0, JOY_RADIUS).fillStyle(0x1a1c2c, 0.25).fillCircle(0, 0, JOY_RADIUS);
    this.joyKnob.fillStyle(0xf4f4f4, 0.55).fillCircle(0, 0, 11);

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
    this.joyOrigin.set(pointer.x, pointer.y);
    this.joyBase.setPosition(pointer.x, pointer.y).setVisible(true);
    this.joyKnob.setPosition(pointer.x, pointer.y).setVisible(true);
  }

  private onMove(pointer: Phaser.Input.Pointer) {
    if (pointer.id !== this.joyPointer) return;
    const v = new Phaser.Math.Vector2(pointer.x - this.joyOrigin.x, pointer.y - this.joyOrigin.y);
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
    this.announceText.setText(msg).setAlpha(1).setScale(1.3);
    this.tweens.killTweensOf(this.announceText);
    this.tweens.add({ targets: this.announceText, scale: 1, duration: 200 });
    this.tweens.add({ targets: this.announceText, alpha: 0, delay: 2200, duration: 500 });
  }

  update() {
    const g = this.game$;
    const { width } = this.scale;

    this.xpBar.clear();
    this.xpBar.fillStyle(COLORS.bg, 1).fillRect(0, 0, width, 12);
    this.xpBar.fillStyle(COLORS.xp, 1).fillRect(1, 1, Math.round((width - 2) * Math.min(1, g.xp / g.xpNext)), 10);
    this.xpBar.fillStyle(0x73eff7, 1).fillRect(1, 1, Math.round((width - 2) * Math.min(1, g.xp / g.xpNext)), 2);

    if (g.level !== this.last.level) this.levelText.setText(`NV ${(this.last.level = g.level)}`);
    const sec = Math.floor(g.elapsed);
    if (sec !== this.last.time) {
      this.last.time = sec;
      const label = g.endless ? `${formatTime(sec)} C${g.cycle}` : formatTime(sec);
      this.timeText.setText(label).setColor(g.endless ? '#c56cf0' : sec >= RUN_DURATION ? '#ef7d57' : '#f4f4f4');
    }
    if (g.kills !== this.last.kills) this.killText.setText(String((this.last.kills = g.kills)));
    const gold = Math.floor(g.gold);
    if (gold !== this.last.gold) this.goldText.setText(String((this.last.gold = gold)));

    this.updateIcons();

    this.bossBar.clear();
    const boss = g.boss;
    if (boss && boss.active) {
      const w = width - 40;
      this.bossText.setVisible(true).setText('DEMÔNIO ANCESTRAL');
      this.bossBar.fillStyle(COLORS.bg, 1).fillRect(20, 72, w, 8);
      this.bossBar.fillStyle(COLORS.hp, 1).fillRect(21, 73, Math.round((w - 2) * Math.max(0, boss.hp / boss.maxHp)), 6);
    } else {
      this.bossText.setVisible(false);
    }
  }

  private updateIcons() {
    const weapons = this.game$.ownedWeapons.map((w) => [w.id, w.level] as const);
    const sig = JSON.stringify(weapons);
    if (sig === this.iconSig) return;
    this.iconSig = sig;
    this.icons.removeAll(true);
    // sem limite de armas: quebra em linhas de 10 ícones
    weapons.forEach(([id, lvl], i) => this.addIcon(WEAPONS[id].icon, lvl, (i % 10) * 14, Math.floor(i / 10) * 15));
  }

  private addIcon(key: string, level: number, x: number, y: number) {
    const bg = this.add.rectangle(x + 6, y + 6, 13, 13, 0x1a1c2c, 0.6);
    const img = this.add.image(x + 6, y + 6, key);
    const max = Math.max(img.width, img.height);
    img.setScale(max > 10 ? 10 / max : 1);
    const pip = this.add.text(x + 12, y + 12, formatNumber(level), { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ffcd75', stroke: '#1a1c2c', strokeThickness: 2 }).setOrigin(1, 1).setScale(0.75);
    this.icons.add([bg, img, pip]);
  }
}
