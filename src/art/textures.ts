import Phaser from 'phaser';
import { HERO_LOOKS, heroFrames } from './characters';
import { bush, dirtPatch, flowers, grassTile, mushroom, rock, stump, tallGrass, tree } from './environment';
import {
  ICONS, auraRing, axeProjectile, boltProjectile, coinFrames, gem, glowDot, heart, holyOrb, knifeProjectile, slash, softShadow, spark,
} from './items';
import { batFrames, demonFrames, goblinFrames, orcFrames, skeletonFrames, slimeFrames, wolfFrames } from './monsters';
import { R, type PixelBuffer } from './pixel';
import { UI_FRAMES, frame, vignette } from './ui';

interface AtlasPart {
  name: string;
  buf: PixelBuffer;
}

/** Nome do quadro no atlas: `slime:0`, `coin:2`... */
export const frameName = (key: string, i = 0) => `${key}:${i}`;

/** Animações de 4 quadros geradas para estes sprites. */
export const ANIMATED = ['hero_knight', 'hero_mage', 'hero_ranger', 'hero_barbarian', 'slime', 'bat', 'skeleton', 'goblin', 'wolf', 'orc', 'demon'];

/**
 * Gera toda a arte do jogo. Cada imagem vira:
 * - um quadro no atlas único 'atlas' (o jogo desenha milhares de sprites num só lote);
 * - e também uma textura própria (usada pela interface e pelas animações).
 */
export function generateTextures(scene: Phaser.Scene) {
  const parts: AtlasPart[] = [];
  const add = (key: string, frames: PixelBuffer[]) => {
    const w = frames[0].w;
    const h = frames[0].h;
    const canvas = document.createElement('canvas');
    canvas.width = w * frames.length;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    frames.forEach((f, i) => ctx.drawImage(f.toCanvas(), i * w, 0));
    const tex = scene.textures.addCanvas(key, canvas)!;
    frames.forEach((f, i) => {
      tex.add(i, 0, i * w, 0, w, h);
      parts.push({ name: frameName(key, i), buf: f });
    });
  };

  for (const key of Object.keys(HERO_LOOKS)) add(key, heroFrames(key));
  add('slime', slimeFrames());
  add('bat', batFrames());
  add('skeleton', skeletonFrames());
  add('goblin', goblinFrames());
  add('wolf', wolfFrames());
  add('orc', orcFrames());
  add('demon', demonFrames());

  add('gem', [gem(R.water)]);
  add('gem_green', [gem(R.green)]);
  add('gem_red', [gem(R.red)]);
  add('coin', coinFrames());
  add('heart', [heart()]);

  add('proj_bolt', [boltProjectile()]);
  add('proj_knife', [knifeProjectile()]);
  add('proj_axe', [axeProjectile()]);
  add('proj_orb', [holyOrb()]);
  add('slash', [slash()]);
  add('aura', [auraRing()]);
  add('glow', [glowDot(32)]);
  add('px', [spark()]);
  add('shadow', [softShadow()]);

  add('tree', [tree(0)]);
  add('tree2', [tree(1)]);
  add('bush', [bush()]);
  add('rock', [rock()]);
  add('stump', [stump()]);
  add('flowers', [flowers()]);
  add('mushroom', [mushroom()]);
  add('tallgrass', [tallGrass()]);
  add('dirt', [dirtPatch(0)]);
  add('dirt2', [dirtPatch(1)]);

  for (const [key, draw] of Object.entries(ICONS)) {
    // ícones com o mesmo nome de um coletável (heart, coin, gem...) ganham prefixo
    add(scene.textures.exists(key) ? `icon:${key}` : key, [draw()]);
  }
  for (const [key, style] of Object.entries(UI_FRAMES)) scene.textures.addCanvas(key, frame(style).toCanvas());
  scene.textures.addCanvas('vignette', vignette().toCanvas());
  scene.textures.addCanvas('ground', grassTile().toCanvas());

  buildAtlas(scene, parts);
}

/** Empacota as partes em prateleiras numa textura única. */
function buildAtlas(scene: Phaser.Scene, parts: AtlasPart[]) {
  const width = 1024;
  const pad = 1;
  let x = 0;
  let y = 0;
  let shelf = 0;
  const placed: { part: AtlasPart; x: number; y: number }[] = [];
  for (const part of [...parts].sort((a, b) => b.buf.h - a.buf.h)) {
    if (x + part.buf.w > width) {
      x = 0;
      y += shelf + pad;
      shelf = 0;
    }
    placed.push({ part, x, y });
    x += part.buf.w + pad;
    shelf = Math.max(shelf, part.buf.h);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = y + shelf;
  const ctx = canvas.getContext('2d')!;
  for (const { part, x: px, y: py } of placed) ctx.drawImage(part.buf.toCanvas(), px, py);
  const tex = scene.textures.addCanvas('atlas', canvas)!;
  for (const { part, x: px, y: py } of placed) tex.add(part.name, 0, px, py, part.buf.w, part.buf.h);
}

/** Chave de textura do ícone (coletáveis e ícones podem ter o mesmo nome). */
export function iconKey(scene: Phaser.Scene, key: string) {
  return scene.textures.exists(`icon:${key}`) ? `icon:${key}` : key;
}

export function createAnimations(scene: Phaser.Scene) {
  for (const key of ANIMATED) {
    if (scene.anims.exists(`${key}_walk`)) continue;
    scene.anims.create({
      key: `${key}_walk`,
      frames: scene.anims.generateFrameNumbers(key, { start: 0, end: 3 }),
      frameRate: key === 'bat' ? 12 : key === 'wolf' ? 10 : 8,
      repeat: -1,
    });
  }
}
