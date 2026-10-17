import Phaser from 'phaser';

export const FONT = '"Jersey 15", sans-serif';

/** A Jersey 15 é condensada: os tamanhos são ampliados para manter a leitura. */
export const FONT_SCALE = 1.3;
export const px = (size: number) => `${Math.round(size * FONT_SCALE)}px`;

export const COLORS = {
  bg: 0x12131f,
  panel: 0x2a2f4a,
  panelDark: 0x1a1c2e,
  border: 0x8c95c4,
  accent: 0xffcd75,
  xp: 0x41a6f6,
  hp: 0xd23b35,
  hpBack: 0x4a1424,
  good: 0x4fd06a,
};

export interface TextOptions {
  bold?: boolean;
  stroke?: string;
  strokeThickness?: number;
  align?: 'left' | 'center' | 'right';
  wrap?: number;
  shadow?: boolean;
}

/** Texto com a fonte do jogo, centralizado por padrão. */
export function text(scene: Phaser.Scene, x: number, y: number, str: string, size = 12, color = '#f4f4f4', opts: TextOptions = {}) {
  const t = scene.add.text(x, y, str, {
    fontFamily: FONT,
    fontSize: px(size),
    fontStyle: opts.bold ? 'bold' : 'normal',
    color,
    stroke: opts.stroke ?? '#0b0a14',
    strokeThickness: opts.strokeThickness ?? (size >= 16 ? 4 : 0),
    align: opts.align ?? 'center',
    wordWrap: opts.wrap ? { width: opts.wrap } : undefined,
    lineSpacing: 2,
  });
  if (opts.shadow) t.setShadow(0, 2, '#05060c', 0, true, true);
  return t.setOrigin(0.5);
}

/** Título com gradiente dourado (logo e cabeçalhos grandes). */
export function goldTitle(scene: Phaser.Scene, x: number, y: number, str: string, size: number) {
  const t = text(scene, x, y, str, size, '#ffffff', { bold: true, stroke: '#2a1206', strokeThickness: Math.max(4, Math.round(size / 6)) });
  const grad = t.context.createLinearGradient(0, 0, 0, t.height);
  grad.addColorStop(0.15, '#fff6c2');
  grad.addColorStop(0.5, '#f7c948');
  grad.addColorStop(0.85, '#c2621c');
  t.setFill(grad);
  t.setShadow(0, Math.max(2, size / 10), '#05060c', 0, true, false);
  return t;
}

/** Painel com moldura 9-slice (`key` = estilo da moldura). */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, key = 'ui_panel') {
  return scene.add.nineslice(x, y, key, undefined, Math.round(w), Math.round(h), 8, 8, 8, 8);
}

export type ButtonVariant = 'normal' | 'primary' | 'purple';

export interface ButtonOptions {
  width?: number;
  height?: number;
  size?: number;
  variant?: ButtonVariant;
  color?: string;
  disabled?: boolean;
  icon?: string;
}

const VARIANT_KEY: Record<ButtonVariant, string> = { normal: 'ui_btn', primary: 'ui_btn_primary', purple: 'ui_btn_purple' };

/** Botão com moldura, efeito de pressionar e rótulo. */
export function button(scene: Phaser.Scene, x: number, y: number, label: string, onClick: () => void, opts: ButtonOptions = {}) {
  const w = opts.width ?? 160;
  const h = opts.height ?? 32;
  const key = opts.disabled ? 'ui_btn_off' : VARIANT_KEY[opts.variant ?? 'normal'];
  const container = scene.add.container(x, y);
  const bg = scene.add.nineslice(0, 0, key, undefined, w, h, 8, 8, 8, 8);
  const size = opts.size ?? 13;
  const color = opts.disabled ? '#6a6c80' : opts.color ?? (opts.variant === 'primary' ? '#2a1206' : '#f4f4f4');
  const t = scene.add.text(0, -1, label, {
    fontFamily: FONT, fontSize: px(size), fontStyle: 'bold', color,
    stroke: opts.variant === 'primary' && !opts.disabled ? '#ffe9a0' : '#0b0a14', strokeThickness: opts.variant === 'primary' ? 0 : 3,
  }).setOrigin(0.5);
  container.add([bg, t]);
  if (opts.icon) {
    const ic = scene.add.image(-w / 2 + 16, 0, opts.icon);
    container.add(ic);
    t.setX(8);
  }
  container.setSize(w, h);
  container.setInteractive({ useHandCursor: true });
  const press = (down: boolean) => {
    if (opts.disabled) return;
    if (opts.variant === 'normal' || !opts.variant) bg.setTexture(down ? 'ui_btn_down' : 'ui_btn');
    container.setScale(down ? 0.96 : 1);
  };
  container.on('pointerdown', () => press(true));
  container.on('pointerout', () => press(false));
  container.on('pointerup', () => {
    press(false);
    onClick();
  });
  return container;
}

/** Barra de progresso com moldura (vida, XP, chefe). */
export function drawBar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, frac: number, fill: number, back = 0x14121f) {
  const f = Phaser.Math.Clamp(frac, 0, 1);
  g.fillStyle(0x0b0a14, 1).fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle(back, 1).fillRect(x, y, w, h);
  g.fillStyle(fill, 1).fillRect(x, y, Math.round(w * f), h);
  g.fillStyle(0xffffff, 0.3).fillRect(x, y, Math.round(w * f), Math.max(1, Math.floor(h / 3)));
  g.fillStyle(0x000000, 0.25).fillRect(x, y + h - 1, Math.round(w * f), 1);
}
