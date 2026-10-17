// Cenário: chão, árvores, arbustos, pedras, flores e cogumelos.
import { PixelBuffer, R } from './pixel';

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Chão de grama 128×128, repetível sem emendas visíveis. */
export function grassTile(): PixelBuffer {
  const S = 128;
  const b = new PixelBuffer(S, S);
  const rnd = rng(11);
  const base = ['#31703d', '#34743f', '#36763f', '#2f6c3b'];
  b.rect(0, 0, S, S, '#33703d');
  // manchas grandes de tom (envolvem as bordas)
  for (let i = 0; i < 22; i++) {
    const cx = rnd() * S;
    const cy = rnd() * S;
    const r = 8 + rnd() * 16;
    const col = base[Math.floor(rnd() * base.length)];
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) b.ellipse(cx + ox * S, cy + oy * S, r, r * 0.7, col);
  }
  // ruído fino
  const fine = ['#2e6838', '#3a7a44', '#2f6a3a'];
  for (let i = 0; i < 700; i++) b.set(Math.floor(rnd() * S), Math.floor(rnd() * S), fine[Math.floor(rnd() * fine.length)]);
  // folhas de grama (traços de 2–3 px com ponta clara)
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(rnd() * S);
    const y = Math.floor(rnd() * S);
    const h = 2 + Math.floor(rnd() * 2);
    const lean = rnd() < 0.5 ? -1 : 1;
    for (let k = 0; k < h; k++) b.set((x + (k === h - 1 ? lean : 0) + S) % S, (y - k + S) % S, k === h - 1 ? '#6fb85a' : '#4f9a4c');
  }
  // trevos e florzinhas discretas
  const flowers = ['#f4e9c8', '#ffd86a', '#e88a9a', '#a8c8ff'];
  for (let i = 0; i < 3; i++) {
    const x = Math.floor(rnd() * (S - 4)) + 2;
    const y = Math.floor(rnd() * (S - 4)) + 2;
    const c = flowers[i % flowers.length];
    b.set(x, y - 1, c);
    b.set(x - 1, y, c);
    b.set(x + 1, y, c);
    b.set(x, y + 1, c);
    b.set(x, y, '#e8b030');
    b.set(x + 1, y + 2, '#3f8a42');
  }
  return b;
}

export function tree(variant = 0): PixelBuffer {
  const b = new PixelBuffer(48, 64);
  const rnd = rng(100 + variant);
  // tronco com raízes
  b.shadedRect(20, 38, 8, 22, R.wood);
  b.poly([[17, 60], [20, 54], [22, 60]], R.wood.slice(0, 3));
  b.poly([[26, 60], [28, 54], [31, 60]], R.wood.slice(0, 3));
  b.line(23, 44, 23, 58, R.wood[0]);
  // copa feita de vários "cachos" sombreados
  const blobs: [number, number, number][] = [
    [24, 30, 13], [13, 28, 9], [35, 28, 9], [18, 18, 11], [31, 18, 11], [24, 11, 10], [24, 24, 12],
  ];
  for (const [x, y, r] of blobs) b.sphere(x + (rnd() - 0.5) * 2, y, r, r * 0.86, R.leaf, (y < 20 ? 0.12 : 0) - 0.02);
  // pontos de luz e frutinhas
  for (let i = 0; i < 14; i++) b.set(14 + Math.floor(rnd() * 20), 8 + Math.floor(rnd() * 14), R.leaf[5]);
  if (variant === 1) for (let i = 0; i < 5; i++) b.ellipse(12 + rnd() * 24, 16 + rnd() * 18, 1.2, 1.2, '#e8404a');
  b.outline('#0c1a12', 0.55);
  return b.shadowUnder(24, 61, 15, 3.5, 100);
}

export function bush(): PixelBuffer {
  const b = new PixelBuffer(28, 20);
  b.sphere(9, 12, 7, 6, R.leaf, -0.05);
  b.sphere(19, 12, 7, 6, R.leaf, -0.08);
  b.sphere(14, 8, 7, 6, R.leaf, 0.08);
  b.set(12, 5, R.leaf[5]);
  b.set(17, 6, R.leaf[5]);
  b.outline('#0c1a12', 0.55);
  return b.shadowUnder(14, 18, 12, 2.4, 90);
}

export function rock(): PixelBuffer {
  const b = new PixelBuffer(20, 14);
  b.sphere(10, 8, 8, 5.4, R.stone, 0.05);
  b.sphere(5, 9, 4, 3.4, R.stone, -0.1);
  b.line(9, 5, 12, 9, R.stone[1]);
  b.set(13, 9, R.stone[1]);
  b.set(7, 4, R.stone[4]);
  b.outline();
  return b.shadowUnder(10, 12, 9, 2, 90);
}

export function flowers(): PixelBuffer {
  const b = new PixelBuffer(16, 12);
  const rnd = rng(7);
  for (let i = 0; i < 5; i++) {
    const x = 2 + Math.floor(rnd() * 12);
    const y = 5 + Math.floor(rnd() * 5);
    b.line(x, y, x, y + 3, '#3f8a42');
    const c = ['#ffd86a', '#f4e9c8', '#e88a9a', '#a8c8ff', '#ff8a5c'][i];
    b.set(x - 1, y, c);
    b.set(x + 1, y, c);
    b.set(x, y - 1, c);
    b.set(x, y + 1, c);
    b.set(x, y, '#e8b030');
  }
  return b;
}

export function mushroom(): PixelBuffer {
  const b = new PixelBuffer(14, 14);
  b.shadedRect(5, 7, 4, 6, ['#c8b8a0', '#efe4d0', '#fff8ea']);
  b.sphere(7, 6, 6, 4, R.red, 0.15);
  b.rect(1, 6, 12, 1, R.red[1]);
  b.set(5, 4, '#ffffff');
  b.set(9, 3, '#ffffff');
  b.set(10, 5, '#ffffff');
  b.outline();
  return b.shadowUnder(7, 13, 5, 1.5, 80);
}

export function stump(): PixelBuffer {
  const b = new PixelBuffer(20, 16);
  b.shadedRect(4, 6, 12, 8, R.wood);
  b.ellipse(10, 6, 6, 2.4, R.wood[3]);
  b.ellipse(10, 6, 3.4, 1.2, R.wood[2]);
  b.poly([[2, 14], [4, 10], [6, 14]], R.wood.slice(0, 2));
  b.poly([[14, 14], [16, 10], [18, 14]], R.wood.slice(0, 2));
  b.outline();
  return b.shadowUnder(10, 14, 9, 2, 90);
}

export function tallGrass(): PixelBuffer {
  const b = new PixelBuffer(14, 12);
  const blades: [number, number, number][] = [[2, 6, -1], [4, 9, 0], [6, 11, 1], [8, 8, 0], [10, 10, -1], [12, 6, 1]];
  for (const [x, h, lean] of blades) {
    for (let k = 0; k < h; k++) {
      const c = k > h - 3 ? '#8cd06a' : k > h / 2 ? '#5aae4a' : '#3f8a42';
      b.set(x + (k > h * 0.6 ? lean : 0), 11 - k, c);
    }
  }
  return b;
}

/** Trecho de terra batida com bordas irregulares e pedrinhas. */
export function dirtPatch(variant = 0): PixelBuffer {
  const b = new PixelBuffer(72, 44);
  const rnd = rng(300 + variant);
  const dirt = ['#5c4128', '#6e4f30', '#7d5b38', '#8a6740'];
  const blobs: [number, number, number, number][] = [];
  for (let i = 0; i < 7; i++) blobs.push([14 + rnd() * 44, 12 + rnd() * 20, 8 + rnd() * 10, 5 + rnd() * 6]);
  for (const [x, y, rx, ry] of blobs) b.ellipse(x, y, rx, ry, dirt[1]);
  for (let i = 0; i < 260; i++) {
    const x = Math.floor(rnd() * 72);
    const y = Math.floor(rnd() * 44);
    if (b.alphaAt(x, y)) b.set(x, y, dirt[Math.floor(rnd() * dirt.length)]);
  }
  for (let i = 0; i < 10; i++) {
    const x = 10 + Math.floor(rnd() * 52);
    const y = 6 + Math.floor(rnd() * 30);
    if (b.alphaAt(x, y)) {
      b.set(x, y, '#9a948a');
      b.set(x + 1, y, '#6a645c');
    }
  }
  // borda de grama sobreposta: transição suave para o gramado
  for (let y = 0; y < 44; y++) {
    for (let x = 0; x < 72; x++) {
      if (!b.alphaAt(x, y)) continue;
      const edge = !b.alphaAt(x + 1, y) || !b.alphaAt(x - 1, y) || !b.alphaAt(x, y + 1) || !b.alphaAt(x, y - 1);
      if (edge) b.set(x, y, rnd() < 0.5 ? '#3f7a3f' : '#4a5a30');
    }
  }
  return b;
}
