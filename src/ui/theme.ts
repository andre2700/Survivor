import Phaser from 'phaser';

export const FONT = '"Press Start 2P", monospace';

export const COLORS = {
  bg: 0x1a1c2c,
  panel: 0x333c57,
  panelDark: 0x262b44,
  border: 0x94b0c2,
  accent: 0xffcd75,
  xp: 0x41a6f6,
  hp: 0xb13e53,
  hpBack: 0x5d275d,
  good: 0x38b764,
};

export function text(scene: Phaser.Scene, x: number, y: number, str: string, size = 8, color = '#f4f4f4') {
  return scene.add
    .text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, color, resolution: 1 })
    .setOrigin(0.5);
}

/** Painel retangular com borda (estilo pixel). */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, fill = COLORS.panel, border = COLORS.border) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.4).fillRect(x - w / 2 + 2, y - h / 2 + 2, w, h);
  g.fillStyle(fill, 1).fillRect(x - w / 2, y - h / 2, w, h);
  g.lineStyle(2, border, 1).strokeRect(x - w / 2 + 1, y - h / 2 + 1, w - 2, h - 2);
  return g;
}

export interface ButtonOptions {
  width?: number;
  height?: number;
  size?: number;
  fill?: number;
  color?: string;
  disabled?: boolean;
}

/** Botão simples com feedback de toque. */
export function button(scene: Phaser.Scene, x: number, y: number, label: string, onClick: () => void, opts: ButtonOptions = {}) {
  const w = opts.width ?? 160;
  const h = opts.height ?? 28;
  const container = scene.add.container(x, y);
  const bg = scene.add.graphics();
  const draw = (pressed: boolean) => {
    bg.clear();
    const fill = opts.disabled ? COLORS.panelDark : opts.fill ?? COLORS.panel;
    bg.fillStyle(0x000000, 0.5).fillRect(-w / 2 + 2, -h / 2 + 2, w, h);
    bg.fillStyle(fill, 1).fillRect(-w / 2 + (pressed ? 2 : 0), -h / 2 + (pressed ? 2 : 0), w, h);
    bg.lineStyle(2, opts.disabled ? 0x566c86 : COLORS.border, 1).strokeRect(-w / 2 + 1 + (pressed ? 2 : 0), -h / 2 + 1 + (pressed ? 2 : 0), w - 2, h - 2);
  };
  draw(false);
  const t = text(scene, 0, 0, label, opts.size ?? 8, opts.disabled ? '#566c86' : opts.color ?? '#f4f4f4');
  container.add([bg, t]);
  container.setSize(w, h);
  container.setInteractive({ useHandCursor: true });
  container.on('pointerdown', () => {
    draw(true);
    t.setPosition(2, 2);
  });
  const release = () => {
    draw(false);
    t.setPosition(0, 0);
  };
  container.on('pointerout', release);
  container.on('pointerup', () => {
    release();
    onClick();
  });
  return container;
}
