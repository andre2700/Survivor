import Phaser from 'phaser';
import { PALETTE, PALETTE_SWAPS, SPRITES, expandFrame } from './sprites';

function drawFrame(ctx: CanvasRenderingContext2D, rows: string[], ox: number, swap: Record<string, string>) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const color = PALETTE[swap[ch] ?? ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(ox + x, y, 1, 1);
    }
  });
}

interface AtlasPart {
  name: string;
  canvas: HTMLCanvasElement;
  sx: number;
  w: number;
  h: number;
}

/** Todas as imagens também vão para um atlas único ('atlas'), para o WebGL desenhar tudo num só lote. */
let atlasParts: AtlasPart[] = [];

/** Nome do quadro no atlas: `slime:0`, `coin:0`... */
export const frameName = (key: string, i = 0) => `${key}:${i}`;

function addPixelSprite(scene: Phaser.Scene, key: string, base: string, swap: Record<string, string> = {}) {
  const def = SPRITES[base];
  const frames = def.frames.map((f) => expandFrame(f, def.mirror));
  const h = frames[0].length;
  const w = frames[0][0].length;
  const canvas = document.createElement('canvas');
  canvas.width = w * frames.length;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  frames.forEach((rows, i) => drawFrame(ctx, rows, i * w, swap));
  const tex = scene.textures.addCanvas(key, canvas)!;
  frames.forEach((_, i) => {
    tex.add(i, 0, i * w, 0, w, h);
    atlasParts.push({ name: frameName(key, i), canvas, sx: i * w, w, h });
  });
}

/** Gera um canvas com função de desenho e registra como textura. */
function addCanvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!);
  scene.textures.addCanvas(key, canvas);
  if (key !== 'ground') atlasParts.push({ name: frameName(key), canvas, sx: 0, w, h });
}

/** Empacota as partes em prateleiras numa textura única. */
function buildAtlas(scene: Phaser.Scene) {
  const width = 512;
  const pad = 1;
  let x = 0;
  let y = 0;
  let shelf = 0;
  const placed: { part: AtlasPart; x: number; y: number }[] = [];
  const parts = [...atlasParts].sort((a, b) => b.h - a.h);
  for (const part of parts) {
    if (x + part.w > width) {
      x = 0;
      y += shelf + pad;
      shelf = 0;
    }
    placed.push({ part, x, y });
    x += part.w + pad;
    shelf = Math.max(shelf, part.h);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = y + shelf;
  const ctx = canvas.getContext('2d')!;
  for (const { part, x: px, y: py } of placed) ctx.drawImage(part.canvas, part.sx, 0, part.w, part.h, px, py, part.w, part.h);
  const tex = scene.textures.addCanvas('atlas', canvas)!;
  for (const { part, x: px, y: py } of placed) tex.add(part.name, 0, px, py, part.w, part.h);
  atlasParts = [];
}

/** RNG determinístico simples (mulberry32) para texturas procedurais. */
function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateTextures(scene: Phaser.Scene) {
  atlasParts = [];
  for (const key of Object.keys(SPRITES)) addPixelSprite(scene, key, key);
  for (const [key, { base, swap }] of Object.entries(PALETTE_SWAPS)) addPixelSprite(scene, key, base, swap);

  // Chão de grama (128x128, repetível)
  addCanvasTexture(scene, 'ground', 128, 128, (ctx) => {
    const rnd = seeded(7);
    ctx.fillStyle = '#2f6b3f';
    ctx.fillRect(0, 0, 128, 128);
    // manchas maiores para quebrar a repetição
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = rnd() < 0.5 ? '#2c653b' : '#327043';
      const x = Math.floor(rnd() * 128);
      const y = Math.floor(rnd() * 128);
      const r = 6 + Math.floor(rnd() * 10);
      for (let dy = -r; dy <= r; dy++) {
        const w = Math.floor(Math.sqrt(r * r - dy * dy));
        ctx.fillRect((x - w + 128) % 128, (y + dy + 128) % 128, w * 2, 1);
        if (x + w > 128) ctx.fillRect(0, (y + dy + 128) % 128, x + w - 128, 1);
      }
    }
    const shades = ['#2a613a', '#357545', '#3b7f4b'];
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = shades[Math.floor(rnd() * shades.length)];
      ctx.fillRect(Math.floor(rnd() * 128), Math.floor(rnd() * 128), 1 + Math.floor(rnd() * 2), 1);
    }
    // tufos de grama
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(rnd() * 124) + 2;
      const y = Math.floor(rnd() * 124) + 2;
      ctx.fillStyle = '#428a4d';
      ctx.fillRect(x, y, 1, 2);
      ctx.fillRect(x - 1, y + 1, 1, 1);
      ctx.fillRect(x + 1, y, 1, 2);
    }
    // florzinhas discretas
    const flowers = ['#c9a85e', '#b8c4cc', '#c06a4e'];
    for (let i = 0; i < 4; i++) {
      const x = Math.floor(rnd() * 120) + 4;
      const y = Math.floor(rnd() * 120) + 4;
      ctx.fillStyle = flowers[i % flowers.length];
      ctx.fillRect(x, y, 1, 1);
      ctx.fillRect(x + 2, y + 1, 1, 1);
      ctx.fillRect(x + 1, y + 3, 1, 1);
    }
  });

  // Sombra elíptica sob os personagens
  addCanvasTexture(scene, 'shadow', 12, 4, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(2, 0, 8, 4);
    ctx.fillRect(0, 1, 12, 2);
  });

  // Pixel branco para partículas
  addCanvasTexture(scene, 'px', 2, 2, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 2, 2);
  });

  // Golpe de espada (meia-lua) 40x24
  addCanvasTexture(scene, 'slash', 40, 24, (ctx) => {
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 40; x++) {
        const nx = (x - 4) / 36;
        const ny = (y - 12) / 12;
        const outer = nx * nx + ny * ny <= 1;
        const inner = ((x - 0) / 30) ** 2 + ny * ny <= 1;
        if (outer && !inner && x > 4) {
          const edge = ((x - 4) / 36) ** 2 + ny * ny > 0.82;
          ctx.fillStyle = edge ? '#f4f4f4' : '#94b0c2';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  });

  // Anel da aura (circular, desenhado em pixels) 96x96
  addCanvasTexture(scene, 'aura', 96, 96, (ctx) => {
    for (let y = 0; y < 96; y++) {
      for (let x = 0; x < 96; x++) {
        const d = Math.hypot(x - 47.5, y - 47.5);
        if (d < 47) {
          const a = d > 44 ? 0.55 : d > 40 ? 0.22 : 0.1;
          ctx.fillStyle = `rgba(239,125,87,${a})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  });
  buildAtlas(scene);
}

export function createAnimations(scene: Phaser.Scene) {
  const walkers = ['hero_knight', 'hero_mage', 'hero_ranger', 'hero_barbarian', 'slime', 'bat', 'skeleton', 'orc', 'demon'];
  for (const key of walkers) {
    if (scene.anims.exists(`${key}_walk`)) continue;
    scene.anims.create({
      key: `${key}_walk`,
      frames: scene.anims.generateFrameNumbers(key, { start: 0, end: 1 }),
      frameRate: key === 'bat' ? 8 : 5,
      repeat: -1,
    });
  }
}
