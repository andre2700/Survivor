// Texturas de interface: molduras 9-slice para painéis, botões e cartas.
import { PixelBuffer } from './pixel';

interface FrameStyle {
  fillTop: string;
  fillBottom: string;
  border: string;
  borderDark: string;
  highlight: string;
  outline?: string;
  rivet?: string;
}

function lerpHex(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

/** Moldura 24×24 (cantos de 8 px) para usar como NineSlice. */
export function frame(style: FrameStyle, size = 24): PixelBuffer {
  const b = new PixelBuffer(size, size);
  const o = style.outline ?? '#0b0a14';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const edge = Math.min(x, y, size - 1 - x, size - 1 - y);
      // cantos arredondados
      const cx = Math.min(x, size - 1 - x);
      const cy = Math.min(y, size - 1 - y);
      if (cx + cy < 2) continue;
      if (edge === 0 || cx + cy === 2) b.set(x, y, o);
      else if (edge === 1) b.set(x, y, y < size / 2 && x < size - 2 ? style.border : style.borderDark);
      else if (edge === 2) b.set(x, y, style.borderDark);
      else b.set(x, y, lerpHex(style.fillTop, style.fillBottom, y / size));
    }
  }
  // brilho interno superior
  for (let x = 4; x < size - 4; x++) b.set(x, 3, style.highlight);
  if (style.rivet) for (const [x, y] of [[3, 3], [size - 4, 3], [3, size - 4], [size - 4, size - 4]]) b.set(x, y, style.rivet);
  return b;
}

export const UI_FRAMES: Record<string, FrameStyle> = {
  ui_panel: { fillTop: '#2a2f4a', fillBottom: '#1c1f33', border: '#8c95c4', borderDark: '#4a5078', highlight: '#3a4166', rivet: '#e6b13a' },
  ui_panel_dark: { fillTop: '#1a1c2e', fillBottom: '#12131f', border: '#4a5078', borderDark: '#2c3050', highlight: '#22253a' },
  ui_btn: { fillTop: '#4a5486', fillBottom: '#2c325a', border: '#b4bde6', borderDark: '#3a4170', highlight: '#6a76b0' },
  ui_btn_down: { fillTop: '#2c325a', fillBottom: '#3a4373', border: '#7d86b8', borderDark: '#2a2f52', highlight: '#2c325a' },
  ui_btn_primary: { fillTop: '#e9a83a', fillBottom: '#b5631f', border: '#ffe9a0', borderDark: '#8a4214', highlight: '#ffd27a', outline: '#2a1206' },
  ui_btn_purple: { fillTop: '#8a4ad0', fillBottom: '#4e2280', border: '#d8b4ff', borderDark: '#3a1866', highlight: '#a874e0' },
  ui_btn_off: { fillTop: '#2a2c3a', fillBottom: '#1e1f2a', border: '#4a4c5e', borderDark: '#2a2b38', highlight: '#33354a' },
  ui_card_0: { fillTop: '#2c3150', fillBottom: '#1d2036', border: '#a8b4cc', borderDark: '#566080', highlight: '#3a4166' },
  ui_card_1: { fillTop: '#1f3a66', fillBottom: '#162545', border: '#7fc4ff', borderDark: '#2a5aa0', highlight: '#2c4f86', rivet: '#7fc4ff' },
  ui_card_2: { fillTop: '#3c2160', fillBottom: '#24143c', border: '#d6a6ff', borderDark: '#6a3aa8', highlight: '#4e2c7a', rivet: '#d6a6ff' },
  ui_card_3: { fillTop: '#5a3a14', fillBottom: '#2e1d0c', border: '#ffe08a', borderDark: '#b07a1c', highlight: '#7a5220', rivet: '#fff6c2' },
  ui_slot: { fillTop: '#13141f', fillBottom: '#0d0e17', border: '#3a3f60', borderDark: '#262a44', highlight: '#181a28' },
};

/** Vinheta: escurece as bordas da tela. */
export function vignette(): PixelBuffer {
  const s = 128;
  const b = new PixelBuffer(s, s);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = (x + 0.5) / s - 0.5;
      const dy = (y + 0.5) / s - 0.5;
      const d = Math.sqrt(dx * dx * 1.2 + dy * dy) * 2;
      const a = Math.max(0, Math.min(1, (d - 0.55) / 0.6));
      b.set(x, y, '#05060c', Math.round(a * a * 200));
    }
  }
  return b;
}
