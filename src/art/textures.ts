import Phaser from 'phaser';
import SPRITES from './sprites.json';
import { auraRing, glowDot, slash, softShadow, spark, vignette } from './fx';
import { SLICE, UI_FRAMES, UI_HD, frame } from './ui';

// A arte cartoon vem de PNGs (src/assets/art/, gerados por scripts/process-art.py) em resolução
// maior que a lógica: cada textura guarda seu fator `hd` e é desenhada no tamanho lógico.

const URLS = import.meta.glob('../assets/art/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
/** hd: resolução; frames: quantos quadros lado a lado (tira de animação). */
const SPRITE = SPRITES as Record<string, { hd: number; frames?: number }>;
const FX_HD = 2;

/** Nome do quadro no atlas: `slime:0`, `coin:0`... */
export const frameName = (key: string, i = 0) => `${key}:${i}`;

/** Fator de resolução de uma textura (1 = tamanho lógico). */
export const hdOf = (key: string) => SPRITE[key]?.hd ?? 1;

/** Quantidade de quadros de animação de uma textura. */
export const frameCount = (key: string) => SPRITE[key]?.frames ?? 1;

const meta = (f: Phaser.Textures.Frame) => f.customData as { hd?: number };

/** Fator de resolução do quadro de um objeto (para medir o tamanho lógico). */
export const frameHd = (obj: { frame: Phaser.Textures.Frame }) => meta(obj.frame).hd ?? 1;

/**
 * Faz Image/Sprite com quadros de alta resolução aparecerem no tamanho lógico, sem mudar a escala
 * vista pelo jogo (o `setScale` continua relativo ao tamanho lógico). Precisa do renderizador WebGL.
 */
export function installHdSprites() {
  const proto = Phaser.Renderer.WebGL.Pipelines.MultiPipeline.prototype as unknown as {
    batchSprite: (go: { frame: Phaser.Textures.Frame; _scaleX: number; _scaleY: number }, ...rest: unknown[]) => void;
  };
  const batch = proto.batchSprite;
  proto.batchSprite = function (go, ...rest) {
    const hd = meta(go.frame).hd;
    if (!hd) return batch.call(this, go, ...rest);
    const sx = go._scaleX;
    const sy = go._scaleY;
    go._scaleX = sx / hd;
    go._scaleY = sy / hd;
    batch.call(this, go, ...rest);
    go._scaleX = sx;
    go._scaleY = sy;
  };
}

export function preloadArt(scene: Phaser.Scene) {
  for (const [path, url] of Object.entries(URLS)) scene.load.image(path.replace(/^.*\/|\.png$/g, ''), url);
}

interface AtlasPart {
  name: string;
  source: CanvasImageSource;
  sx: number;
  w: number;
  h: number;
  hd: number;
}

/**
 * Monta as texturas do jogo. Cada imagem vira:
 * - um quadro no atlas único 'atlas' (o jogo desenha milhares de sprites num só lote);
 * - e também uma textura própria (interface, menus).
 */
export function generateTextures(scene: Phaser.Scene) {
  const parts: AtlasPart[] = [];
  const mark = (key: string, hd: number) => {
    if (hd !== 1) meta(scene.textures.get(key).get()).hd = hd;
  };

  for (const [key, { hd, frames = 1 }] of Object.entries(SPRITE)) {
    if (!scene.textures.exists(key)) continue;
    mark(key, hd);
    if (key === 'ground') continue;
    const tex = scene.textures.get(key);
    const source = tex.getSourceImage() as HTMLImageElement;
    const w = source.width / frames;
    for (let i = 0; i < frames; i++) {
      // quadros numerados também na textura própria (menus): image(x, y, key, i)
      if (frames > 1 && hd !== 1) meta(tex.add(i, 0, i * w, 0, w, source.height)!).hd = hd;
      parts.push({ name: frameName(key, i), source, sx: i * w, w, h: source.height, hd });
    }
  }

  const fx = (key: string, source: HTMLCanvasElement, hd: number) => {
    scene.textures.addCanvas(key, source);
    mark(key, hd);
    parts.push({ name: frameName(key), source, sx: 0, w: source.width, h: source.height, hd });
  };
  // partículas usam estes quadros direto do atlas e não passam pelo ajuste de resolução: ficam em 1×
  fx('glow', glowDot(32), 1);
  fx('px', spark(), 1);
  fx('shadow', softShadow(FX_HD), FX_HD);
  fx('slash', slash(FX_HD), FX_HD);
  fx('aura', auraRing(FX_HD), FX_HD);

  for (const [key, style] of Object.entries(UI_FRAMES)) scene.textures.addCanvas(key, frame(style));
  scene.textures.addCanvas('vignette', vignette());

  buildAtlas(scene, parts);
}

/** Empacota as partes em prateleiras numa textura única. */
function buildAtlas(scene: Phaser.Scene, parts: AtlasPart[]) {
  const width = 2048;
  const pad = 2;
  let x = 0;
  let y = 0;
  let shelf = 0;
  const placed: { part: AtlasPart; x: number; y: number }[] = [];
  for (const part of [...parts].sort((a, b) => b.h - a.h)) {
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
  for (const { part, x: px, y: py } of placed) ctx.drawImage(part.source, part.sx, 0, part.w, part.h, px, py, part.w, part.h);
  const tex = scene.textures.addCanvas('atlas', canvas)!;
  for (const { part, x: px, y: py } of placed) {
    const f = tex.add(part.name, 0, px, py, part.w, part.h)!;
    if (part.hd !== 1) meta(f).hd = part.hd;
  }
}

/** Chão de grama repetido; `scroll` desloca a textura em unidades lógicas. */
export function groundSprite(scene: Phaser.Scene, x: number, y: number, w: number, h: number) {
  return scene.add.tileSprite(x, y, w, h, 'ground').setTileScale(1 / hdOf('ground'));
}

export function scrollGround(ground: Phaser.GameObjects.TileSprite, x: number, y: number) {
  const hd = hdOf('ground');
  ground.tilePositionX = x * hd;
  ground.tilePositionY = y * hd;
}

/** Moldura 9-slice no tamanho lógico w×h. */
export function nineSlice(scene: Phaser.Scene, x: number, y: number, key: string, w: number, h: number) {
  return scene.add.nineslice(x, y, key, undefined, Math.round(w * UI_HD), Math.round(h * UI_HD), SLICE, SLICE, SLICE, SLICE)
    .setScale(1 / UI_HD);
}
