// Mini motor de pixel art: desenha formas com sombreamento por luz, contorno automático
// e rampas de cor. Toda a arte do jogo é gerada aqui, sem arquivos de imagem.

/** Rampa de cor do mais escuro ao mais claro. */
export type Ramp = string[];

type RGB = [number, number, number];

const cache = new Map<string, RGB>();
export function rgb(hex: string): RGB {
  let c = cache.get(hex);
  if (!c) {
    const v = parseInt(hex.slice(1), 16);
    c = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
    cache.set(hex, c);
  }
  return c;
}

/** Luz padrão: de cima-esquerda, levemente de frente. */
const LIGHT = normalize([-0.55, -0.75, 0.55]);

function normalize(v: number[]) {
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
}

/** Matriz de Bayer 4×4 para pontilhar a transição entre tons. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16 - 0.5);

export class PixelBuffer {
  readonly data: Uint8ClampedArray;

  constructor(readonly w: number, readonly h: number) {
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  inside(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  set(x: number, y: number, color: string | null, alpha = 255) {
    x = Math.round(x);
    y = Math.round(y);
    if (!this.inside(x, y)) return;
    const i = (y * this.w + x) * 4;
    if (color === null) {
      this.data[i + 3] = 0;
      return;
    }
    const [r, g, b] = rgb(color);
    this.data[i] = r;
    this.data[i + 1] = g;
    this.data[i + 2] = b;
    this.data[i + 3] = alpha;
  }

  alphaAt(x: number, y: number) {
    if (!this.inside(x, y)) return 0;
    return this.data[(y * this.w + x) * 4 + 3];
  }

  rgbAt(x: number, y: number): RGB {
    const i = (y * this.w + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2]];
  }

  rect(x: number, y: number, w: number, h: number, color: string) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, color);
  }

  /** Retângulo sombreado como cilindro vertical (claro à esquerda). */
  shadedRect(x: number, y: number, w: number, h: number, ramp: Ramp, topLight = true) {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const nx = w <= 1 ? 0 : (i / (w - 1)) * 2 - 1;
        const ny = topLight ? (j / Math.max(1, h - 1)) * 0.6 - 0.3 : 0;
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx * 0.7));
        this.set(x + i, y + j, this.shade(ramp, [nx * 0.84, ny, nz], x + i, y + j));
      }
    }
  }

  /** Escolhe o tom da rampa pela iluminação da normal, com pontilhado leve. */
  shade(ramp: Ramp, n: number[], x: number, y: number, bias = 0) {
    const d = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2];
    let t = (d + 0.35) / 1.25 + bias;
    t += BAYER[(y & 3) * 4 + (x & 3)] * 0.06;
    const idx = Math.max(0, Math.min(ramp.length - 1, Math.floor(t * ramp.length)));
    return ramp[idx];
  }

  /** Elipse preenchida com uma cor. */
  ellipse(cx: number, cy: number, rx: number, ry: number, color: string) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, color);
      }
    }
  }

  /** Elipse sombreada como esfera. `bias` clareia (+) ou escurece (-). */
  sphere(cx: number, cy: number, rx: number, ry: number, ramp: Ramp, bias = 0) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        const d2 = dx * dx + dy * dy;
        if (d2 > 1) continue;
        this.set(x, y, this.shade(ramp, [dx, dy, Math.sqrt(1 - d2)], x, y, bias));
      }
    }
  }

  /** Polígono preenchido (regra par-ímpar), opcionalmente sombreado por gradiente vertical. */
  poly(points: [number, number][], color: string | Ramp) {
    const ys = points.map((p) => p[1]);
    const y0 = Math.floor(Math.min(...ys));
    const y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) {
      const sy = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [ax, ay] = points[i];
        const [bx, by] = points[(i + 1) % points.length];
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) {
          if (typeof color === 'string') this.set(x, y, color);
          else {
            const t = (y - y0) / Math.max(1, y1 - y0);
            this.set(x, y, color[Math.max(0, Math.min(color.length - 1, Math.floor((1 - t) * color.length)))]);
          }
        }
      }
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, color: string, thick = 1) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= steps; i++) {
      const x = x0 + ((x1 - x0) * i) / steps;
      const y = y0 + ((y1 - y0) * i) / steps;
      if (thick <= 1) this.set(x, y, color);
      else this.rect(Math.round(x - thick / 2 + 0.5), Math.round(y - thick / 2 + 0.5), thick, thick, color);
    }
  }

  /** Copia outro buffer por cima (respeitando transparência). */
  blit(src: PixelBuffer, dx: number, dy: number, flipX = false) {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const sx = flipX ? src.w - 1 - x : x;
        const si = (y * src.w + sx) * 4;
        const a = src.data[si + 3];
        if (!a) continue;
        const tx = dx + x;
        const ty = dy + y;
        if (!this.inside(tx, ty)) continue;
        const ti = (ty * this.w + tx) * 4;
        this.data[ti] = src.data[si];
        this.data[ti + 1] = src.data[si + 1];
        this.data[ti + 2] = src.data[si + 2];
        this.data[ti + 3] = a;
      }
    }
  }

  /**
   * Contorno seletivo: pixels transparentes vizinhos de opacos recebem uma versão
   * bem escura da cor vizinha (mais bonito que um contorno preto chapado).
   */
  outline(base = '#140c1c', strength = 0.62) {
    const out: [number, number, string][] = [];
    const [br, bg, bb] = rgb(base);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.alphaAt(x, y)) continue;
        let n: RGB | null = null;
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (this.alphaAt(x + ox, y + oy) > 128) {
            n = this.rgbAt(x + ox, y + oy);
            break;
          }
        }
        if (!n) continue;
        const r = Math.round(n[0] * (1 - strength) + br * strength);
        const g = Math.round(n[1] * (1 - strength) + bg * strength);
        const b = Math.round(n[2] * (1 - strength) + bb * strength);
        out.push([x, y, `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`]);
      }
    }
    for (const [x, y, c] of out) this.set(x, y, c);
    return this;
  }

  /** Sombra suave no chão, só onde ainda é transparente (fica "atrás" do desenho). */
  shadowUnder(cx: number, cy: number, rx: number, ry: number, alpha = 90) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        const d = dx * dx + dy * dy;
        if (d > 1 || !this.inside(x, y) || this.alphaAt(x, y)) continue;
        this.set(x, y, '#0a0c14', Math.round(alpha * (d > 0.6 ? 0.65 : 1)));
      }
    }
    return this;
  }

  /** Brilho radial (para efeitos aditivos): cor no centro, sumindo nas bordas. */
  glow(cx: number, cy: number, r: number, color: string, power = 1.6) {
    const [cr, cg, cb] = rgb(color);
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if (!this.inside(x, y)) continue;
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
        if (d >= 1) continue;
        const a = Math.pow(1 - d, power) * 255;
        const i = (y * this.w + x) * 4;
        if (a <= this.data[i + 3]) continue;
        this.data[i] = cr;
        this.data[i + 1] = cg;
        this.data[i + 2] = cb;
        this.data[i + 3] = a;
      }
    }
    return this;
  }

  toCanvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    const ctx = c.getContext('2d')!;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(this.data), this.w, this.h), 0, 0);
    return c;
  }
}

/** Junta vários quadros lado a lado numa tira (spritesheet horizontal). */
export function strip(frames: PixelBuffer[]): HTMLCanvasElement {
  const w = frames[0].w;
  const h = frames[0].h;
  const all = new PixelBuffer(w * frames.length, h);
  frames.forEach((f, i) => all.blit(f, i * w, 0));
  return all.toCanvas();
}

// ---------- Rampas de cor (escuro → claro) ----------

export const R = {
  skin: ['#6b3326', '#a8573d', '#dc8f68', '#f3bf98', '#fbe0c4'],
  skinDark: ['#3a1f17', '#6b3c26', '#9c5f3a', '#c4855a'],
  steel: ['#232838', '#3d4559', '#68738c', '#a3aec4', '#e3eaf5'],
  gold: ['#5a2d16', '#a3601c', '#dba131', '#f7d96a', '#fff6c2'],
  blue: ['#141638', '#232e7a', '#3456c0', '#5d8ced', '#a8c8ff'],
  red: ['#2e0b16', '#6e1626', '#b52a36', '#e85a4f', '#ff9c7a'],
  purple: ['#1c0d2e', '#3e1c63', '#6834a3', '#9d62d6', '#d0a6ff'],
  green: ['#0f2618', '#1b4d2b', '#2e7d3c', '#5bb04f', '#a6e07a'],
  leather: ['#24140d', '#4d2b19', '#7d4a2a', '#ad7445', '#d8a66c'],
  wood: ['#2a170d', '#52301a', '#7e4f2a', '#a8723f'],
  slime: ['#0c3322', '#1b6b3c', '#34a852', '#6fdc72', '#c8ffb8'],
  bone: ['#2f2b36', '#5e5a68', '#9a96a2', '#d5d1d6', '#f7f4ee'],
  orc: ['#16260f', '#2f4d1d', '#4f7a2c', '#7aab42', '#b3d96a'],
  demon: ['#1f070f', '#4d0f1d', '#8f1d2b', '#d23b35', '#ff8a5c'],
  bat: ['#120a1e', '#2c1a45', '#4c2d73', '#7a4fa8', '#ad86d6'],
  fur: ['#2e1f12', '#5a3f24', '#8c6a3e', '#c09a62', '#e8c995'],
  hairRed: ['#3d120a', '#7d2a12', '#c2491c', '#ef7a2e', '#ffb15e'],
  hairBlond: ['#5c3d12', '#a3701f', '#e0b03a', '#f8dc74'],
  leaf: ['#0d2418', '#18452a', '#26703a', '#44a04a', '#86cc5c', '#c4ec84'],
  stone: ['#1e1f2a', '#3a3c4e', '#5f6378', '#8f94aa', '#c7cbd9'],
  water: ['#0b1b3a', '#14407a', '#2273c2', '#4fb0ee', '#b6ecff'],
  fire: ['#4a0c08', '#a3200f', '#e8551a', '#ffa22e', '#ffe48a', '#fffbe0'],
  arcane: ['#0e1a4a', '#1c45a8', '#3a8af0', '#7fd3ff', '#e6fbff'],
  holy: ['#5a3a10', '#b07a1c', '#f0c040', '#ffe98a', '#fffbe0'],
  shadow: ['#0a0612', '#1b1030', '#33205a'],
};
