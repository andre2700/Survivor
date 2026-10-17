// Molduras 9-slice da interface: cantos arredondados, contorno grosso e brilho no topo (estilo cartoon).

interface FrameStyle {
  fillTop: string;
  fillBottom: string;
  border: string;
  outline?: string;
  shine?: number;
}

/** Resolução das molduras (o tamanho lógico é FRAME / UI_HD, com cantos de SLICE / UI_HD). */
export const UI_HD = 2;
const FRAME = 48;
export const SLICE = 18;

export function frame(style: FrameStyle) {
  const c = document.createElement('canvas');
  c.width = c.height = FRAME;
  const g = c.getContext('2d')!;
  const rr = (inset: number, r: number) => {
    g.beginPath();
    g.roundRect(inset, inset, FRAME - inset * 2, FRAME - inset * 2, r);
  };
  rr(0, 14);
  g.fillStyle = style.outline ?? '#14101e';
  g.fill();
  rr(3, 11);
  g.fillStyle = style.border;
  g.fill();
  rr(6, 8);
  const grad = g.createLinearGradient(0, 6, 0, FRAME - 6);
  grad.addColorStop(0, style.fillTop);
  grad.addColorStop(1, style.fillBottom);
  g.fillStyle = grad;
  g.fill();
  // brilho na metade de cima
  g.save();
  rr(6, 8);
  g.clip();
  g.fillStyle = `rgba(255,255,255,${style.shine ?? 0.12})`;
  g.beginPath();
  g.roundRect(9, 8, FRAME - 18, 7, 4);
  g.fill();
  g.restore();
  return c;
}

export const UI_FRAMES: Record<string, FrameStyle> = {
  ui_panel: { fillTop: '#3d4778', fillBottom: '#262c52', border: '#9aa6e0' },
  ui_panel_dark: { fillTop: '#262a48', fillBottom: '#181b30', border: '#545c96', shine: 0.06 },
  ui_btn: { fillTop: '#5b8fe8', fillBottom: '#3457b8', border: '#c8dcff', shine: 0.25 },
  ui_btn_down: { fillTop: '#3457b8', fillBottom: '#4570d0', border: '#9ab6f0', shine: 0.05 },
  ui_btn_primary: { fillTop: '#ffd25a', fillBottom: '#f08c1e', border: '#fff2b0', outline: '#3a1a06', shine: 0.35 },
  ui_btn_purple: { fillTop: '#b07af0', fillBottom: '#6b34b8', border: '#ecd6ff', shine: 0.25 },
  ui_btn_off: { fillTop: '#4a4c5e', fillBottom: '#33343f', border: '#6a6c80', shine: 0.05 },
  ui_card_0: { fillTop: '#46507a', fillBottom: '#2a3050', border: '#c4cce0' },
  ui_card_1: { fillTop: '#2f6ab8', fillBottom: '#1d3f7a', border: '#9ad2ff' },
  ui_card_2: { fillTop: '#7a3fc0', fillBottom: '#45207a', border: '#e4c4ff' },
  ui_card_3: { fillTop: '#c88a1e', fillBottom: '#7a4a10', border: '#fff0a0', shine: 0.2 },
  ui_slot: { fillTop: '#191b2e', fillBottom: '#24284a', border: '#4a5288', shine: 0.04 },
};
