// Itens, projéteis, efeitos e ícones de interface (16×16).
import { PixelBuffer, R, type Ramp } from './pixel';

// ---------- Coletáveis ----------

export function gem(ramp: Ramp): PixelBuffer {
  const b = new PixelBuffer(12, 14);
  b.poly([[6, 1], [11, 6], [6, 13], [1, 6]], ramp.slice(1, 4));
  b.poly([[6, 1], [11, 6], [6, 6]], ramp[3]);
  b.poly([[1, 6], [6, 6], [6, 13]], ramp[1]);
  b.poly([[6, 6], [11, 6], [6, 13]], ramp[2]);
  b.line(4, 4, 5, 3, '#ffffff');
  return b.outline();
}

export function coinFrames(): PixelBuffer[] {
  const widths = [5, 3.6, 1.2, 3.6];
  return widths.map((rx, f) => {
    const b = new PixelBuffer(12, 12);
    b.sphere(6, 6, rx, 5, R.gold, 0.1);
    if (rx > 2) {
      b.ellipse(6, 6, rx * 0.55, 2.8, R.gold[1]);
      b.line(6, 4, 6, 8, R.gold[3]);
    }
    if (f === 0) b.set(4, 3, '#ffffff');
    return b.outline();
  });
}

export function heart(): PixelBuffer {
  const b = new PixelBuffer(14, 13);
  b.sphere(4.5, 4.5, 3.6, 3.6, R.red, 0.15);
  b.sphere(9.5, 4.5, 3.6, 3.6, R.red, 0.1);
  b.poly([[1, 5], [13, 5], [7, 12]], R.red.slice(1, 4));
  b.set(3, 3, '#ffffff');
  b.set(4, 3, R.red[4]);
  return b.outline();
}

// ---------- Projéteis e efeitos ----------

export function boltProjectile(): PixelBuffer {
  const b = new PixelBuffer(14, 14);
  b.glow(7, 7, 7, R.arcane[2], 1.4);
  b.sphere(7, 7, 3.4, 3.4, R.arcane.slice(2), 0.4);
  b.ellipse(7, 7, 1.6, 1.6, '#ffffff');
  return b;
}

export function knifeProjectile(): PixelBuffer {
  const b = new PixelBuffer(14, 6);
  b.poly([[4, 1], [13, 3], [4, 5]], R.steel.slice(2));
  b.line(5, 2, 12, 3, '#ffffff');
  b.rect(1, 2, 3, 2, R.leather[2]);
  b.rect(3, 1, 1, 4, R.gold[2]);
  return b.outline();
}

export function axeProjectile(): PixelBuffer {
  const b = new PixelBuffer(18, 18);
  b.line(9, 3, 9, 16, R.wood[2], 2);
  b.poly([[9, 2], [16, 0], [17, 6], [15, 10], [9, 8]], R.steel);
  b.poly([[9, 2], [2, 0], [1, 6], [3, 10], [9, 8]], R.steel.slice(0, 4));
  b.line(16, 0, 17, 6, '#ffffff');
  return b.outline();
}

export function holyOrb(): PixelBuffer {
  const b = new PixelBuffer(16, 16);
  b.glow(8, 8, 8, R.holy[2], 1.3);
  b.sphere(8, 8, 4, 4, R.holy.slice(1), 0.35);
  b.set(6, 6, '#ffffff');
  return b;
}

/** Meia-lua do golpe de espada (gradiente branco → azul). */
export function slash(): PixelBuffer {
  const b = new PixelBuffer(48, 30);
  for (let y = 0; y < 30; y++) {
    for (let x = 0; x < 48; x++) {
      const nx = (x - 4) / 43;
      const ny = (y - 15) / 15;
      const outer = nx * nx + ny * ny <= 1;
      const inner = ((x + 4) / 36) ** 2 + ny * ny <= 1;
      if (!outer || inner || x < 4) continue;
      const edge = nx * nx + ny * ny;
      const fade = 1 - Math.abs(ny) * 0.6;
      const color = edge > 0.85 ? '#ffffff' : edge > 0.7 ? '#cfe6ff' : '#7fb2ff';
      b.set(x, y, color, Math.round(255 * fade * (edge > 0.7 ? 1 : 0.75)));
    }
  }
  return b;
}

/** Anel da aura de fogo (usado com mistura aditiva). */
export function auraRing(): PixelBuffer {
  const size = 96;
  const b = new PixelBuffer(size, size);
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c) / (c - 1);
      if (d > 1) continue;
      const ring = Math.max(0, 1 - Math.abs(d - 0.9) * 8);
      const fill = d < 0.9 ? 0.18 * d : 0;
      const a = Math.min(1, ring + fill);
      if (a <= 0.02) continue;
      b.set(x, y, d > 0.86 ? '#ffb347' : '#e8551a', Math.round(a * 255));
    }
  }
  return b;
}

export function glowDot(size = 16, color = '#ffffff'): PixelBuffer {
  return new PixelBuffer(size, size).glow(size / 2, size / 2, size / 2, color, 1.8);
}

export function spark(): PixelBuffer {
  const b = new PixelBuffer(3, 3);
  b.set(1, 0, '#ffffff');
  b.set(0, 1, '#ffffff');
  b.set(1, 1, '#ffffff');
  b.set(2, 1, '#ffffff');
  b.set(1, 2, '#ffffff');
  return b;
}

export function softShadow(): PixelBuffer {
  return new PixelBuffer(20, 8).shadowUnder(10, 4, 9.5, 3.5, 110);
}

// ---------- Ícones 16×16 ----------

function icon(draw: (b: PixelBuffer) => void): PixelBuffer {
  const b = new PixelBuffer(16, 16);
  draw(b);
  return b.outline();
}

export const ICONS: Record<string, () => PixelBuffer> = {
  // armas
  bolt: () => icon((b) => {
    b.line(3, 13, 10, 6, R.wood[2], 2);
    b.glow(11, 5, 5, R.arcane[3]);
    b.sphere(11, 5, 2.6, 2.6, R.arcane.slice(2), 0.3);
  }),
  icon_sword: () => icon((b) => {
    b.line(4, 12, 13, 3, R.steel[3], 2);
    b.line(5, 11, 13, 3, R.steel[4]);
    b.line(2, 10, 6, 14, R.gold[2], 2);
    b.line(2, 14, 3, 13, R.leather[2], 2);
  }),
  axe: () => icon((b) => {
    b.line(4, 14, 10, 3, R.wood[2], 2);
    b.poly([[8, 3], [13, 1], [15, 6], [13, 10], [9, 7]], R.steel);
    b.line(13, 1, 15, 6, '#ffffff');
  }),
  orb: () => icon((b) => {
    b.glow(8, 8, 8, R.holy[2]);
    b.sphere(8, 8, 4.4, 4.4, R.holy.slice(1), 0.3);
    b.set(6, 6, '#ffffff');
  }),
  icon_fire: () => icon((b) => {
    b.poly([[8, 1], [13, 8], [12, 14], [4, 14], [3, 8], [6, 5]], R.fire.slice(1, 4));
    b.poly([[8, 6], [11, 10], [10, 14], [6, 14], [5, 10]], R.fire.slice(3));
  }),
  icon_bolt: () => icon((b) => {
    b.poly([[10, 1], [4, 9], [8, 9], [6, 15], [12, 6], [8, 6]], ['#c2a020', '#ffe14a', '#fff6b0']);
  }),
  knife: () => icon((b) => {
    b.poly([[3, 13], [12, 3], [13, 4], [5, 14]], R.steel.slice(2));
    b.line(5, 12, 12, 4, '#ffffff');
    b.line(2, 11, 6, 15, R.gold[2]);
  }),
  // atributos
  icon_potion: () => icon((b) => {
    b.rect(7, 2, 3, 3, R.wood[2]);
    b.sphere(8.5, 10, 5, 4.6, R.red, 0.15);
    b.set(6, 8, '#ffffff');
  }),
  icon_book: () => icon((b) => {
    b.shadedRect(3, 2, 10, 12, R.blue);
    b.rect(4, 3, 1, 10, R.blue[4]);
    b.rect(12, 3, 1, 11, '#f4efe0');
    b.rect(7, 6, 4, 1, R.gold[3]);
    b.rect(7, 8, 3, 1, R.gold[3]);
  }),
  icon_boot: () => icon((b) => {
    b.shadedRect(4, 2, 6, 9, R.leather);
    b.poly([[4, 10], [13, 10], [14, 14], [4, 14]], R.leather);
    b.line(4, 13, 14, 13, R.leather[0]);
    b.line(13, 4, 15, 2, '#ffffff');
  }),
  icon_magnet: () => icon((b) => {
    b.line(4, 3, 4, 9, R.red[2], 3);
    b.line(12, 3, 12, 9, R.steel[3], 3);
    b.poly([[3, 9], [6, 9], [8, 12], [10, 9], [13, 9], [11, 14], [5, 14]], R.red.slice(1, 4));
    b.rect(3, 2, 3, 2, '#f4f4f4');
    b.rect(11, 2, 3, 2, '#f4f4f4');
  }),
  icon_cross: () => icon((b) => {
    b.shadedRect(6, 2, 4, 12, R.green);
    b.shadedRect(2, 6, 12, 4, R.green);
  }),
  icon_shield: () => icon((b) => {
    b.poly([[2, 2], [14, 2], [13, 9], [8, 15], [3, 9]], R.steel);
    b.poly([[5, 4], [11, 4], [10, 9], [8, 12], [6, 9]], R.blue.slice(1));
    b.set(8, 6, R.gold[3]);
  }),
  icon_dice: () => icon((b) => {
    b.shadedRect(2, 2, 12, 12, ['#a0a0b0', '#d8d8e4', '#f4f4fa']);
    for (const [x, y] of [[5, 5], [10, 5], [8, 8], [5, 11], [10, 11]]) b.rect(x - 1, y - 1, 2, 2, '#b52a36');
  }),
  heart: () => icon((b) => b.blit(heart(), 1, 2)),
  coin: () => icon((b) => b.blit(coinFrames()[0], 2, 2)),
  gem: () => icon((b) => b.blit(gem(R.water), 2, 1)),
  gem_green: () => icon((b) => b.blit(gem(R.green), 2, 1)),
  gem_red: () => icon((b) => b.blit(gem(R.red), 2, 1)),
  icon_skull: () => icon((b) => {
    b.sphere(8, 7, 5.5, 5, R.bone, 0.1);
    b.rect(5, 10, 6, 3, R.bone[2]);
    b.rect(5, 6, 2, 2, '#140c1c');
    b.rect(9, 6, 2, 2, '#140c1c');
  }),
  icon_star: () => icon((b) => {
    b.poly([[8, 1], [10, 6], [15, 6], [11, 9], [13, 15], [8, 11], [3, 15], [5, 9], [1, 6], [6, 6]], R.gold.slice(1));
  }),
};
