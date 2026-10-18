// Rachaduras no chão (poderes de terra): abertura escura que engrossa no meio e afina nas pontas,
// com a parede de terra aparecendo de um lado, borda iluminada e galhos finos saindo dela.
import type Phaser from 'phaser';

interface Pt {
  x: number;
  y: number;
}

const WALL = 0x5c3f24;
const DEPTH = 0x140c06;
const LIP = 0xd9b07c;

/** Rachadura que pode crescer ponto a ponto; o sorteio de cada ponto fica guardado para redesenhar igual. */
export class Crack {
  private pts: Pt[] = [];
  /** galhos finos: cada um sai de um ponto da rachadura */
  private branches: { at: number; path: Pt[] }[] = [];
  /** largura extra (abertura maior) em alguns pontos */
  private bulge: number[] = [];

  constructor(x: number, y: number, private width: number) {
    this.pts.push({ x, y });
    this.bulge.push(1);
  }

  get length() {
    return this.pts.length;
  }

  get tip() {
    return this.pts[this.pts.length - 1];
  }

  /** Avança até (x, y) em zigue-zague, com chance de soltar um galho fino. */
  extend(x: number, y: number) {
    const a = this.tip;
    const dx = x - a.x;
    const dy = y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    // dois desvios laterais por trecho: o traço fica quebrado, não reto
    for (const u of [0.35, 0.7]) {
      const j = (Math.random() - 0.5) * len * 0.35;
      this.pts.push({ x: a.x + dx * u + nx * j, y: a.y + dy * u + ny * j });
      this.bulge.push(Math.random() < 0.15 ? 1.6 : 0.8 + Math.random() * 0.4);
    }
    this.pts.push({ x, y });
    this.bulge.push(0.8 + Math.random() * 0.4);
    if (Math.random() < 0.55) this.branch(this.pts.length - 2, len);
  }

  private branch(at: number, len: number) {
    const p = this.pts[at];
    const q = this.pts[at + 1] ?? this.pts[at - 1];
    let a = Math.atan2(q.y - p.y, q.x - p.x) + (Math.random() < 0.5 ? 1 : -1) * (0.6 + Math.random() * 0.7);
    const path = [{ x: p.x, y: p.y }];
    let x = p.x;
    let y = p.y;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      a += (Math.random() - 0.5) * 0.9;
      const l = len * (0.25 + Math.random() * 0.25);
      x += Math.cos(a) * l;
      y += Math.sin(a) * l * 0.8;
      path.push({ x, y });
    }
    this.branches.push({ at, path });
  }

  /** Abre rachaduras curtas em volta de um ponto (impacto). */
  static burst(gfx: Phaser.GameObjects.Graphics, x: number, y: number, n: number, len: number, width: number) {
    for (let k = 0; k < n; k++) {
      let a = (k / n) * Math.PI * 2 + Math.random() * 0.6;
      const c = new Crack(x + Math.cos(a) * 3, y + Math.sin(a) * 2, width);
      let cx = x;
      let cy = y;
      for (let j = 0; j < 3; j++) {
        a += (Math.random() - 0.5) * 0.7;
        cx += Math.cos(a) * (len / 3);
        cy += Math.sin(a) * (len / 3) * 0.75;
        c.extend(cx, cy);
      }
      c.draw(gfx);
    }
  }

  draw(gfx: Phaser.GameObjects.Graphics) {
    const pts = this.pts;
    const n = pts.length;
    if (n < 2) return;
    // largura de cada ponto: afina nas duas pontas
    const w = pts.map((_, i) => {
      const u = i / (n - 1);
      return this.width * Math.min(1, u * 4, (1 - u) * 3) * this.bulge[i];
    });
    const left: Pt[] = [];
    const right: Pt[] = [];
    const inner: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(n - 1, i + 1)];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nx = -(b.y - a.y) / len;
      const ny = (b.x - a.x) / len;
      left.push({ x: pts[i].x + nx * w[i] * 0.5, y: pts[i].y + ny * w[i] * 0.5 });
      right.push({ x: pts[i].x - nx * w[i] * 0.5, y: pts[i].y - ny * w[i] * 0.5 });
      // o fundo escuro fica mais para baixo: a parede de cima aparece (efeito de profundidade)
      inner.push({ x: pts[i].x, y: pts[i].y + w[i] * 0.22 });
    }
    // fios nas pontas, continuando a rachadura
    gfx.lineStyle(1, DEPTH, 0.8);
    gfx.beginPath().moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < n; i++) gfx.lineTo(pts[i].x, pts[i].y);
    gfx.strokePath();
    // galhos finos
    for (const br of this.branches) {
      if (br.at >= n) continue;
      gfx.lineStyle(1.2, DEPTH, 0.85);
      gfx.beginPath().moveTo(br.path[0].x, br.path[0].y);
      for (let i = 1; i < br.path.length; i++) {
        if (i === 2) gfx.strokePath().lineStyle(0.8, DEPTH, 0.7).beginPath().moveTo(br.path[1].x, br.path[1].y);
        gfx.lineTo(br.path[i].x, br.path[i].y);
      }
      gfx.strokePath();
    }
    // parede de terra, fundo escuro e borda clara do lado de cima
    gfx.fillStyle(WALL, 0.95).fillPoints([...left, ...right.slice().reverse()], true);
    const deep: Pt[] = [];
    const deepR: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const dx = left[i].x - pts[i].x;
      const dy = left[i].y - pts[i].y;
      deep.push({ x: inner[i].x + dx * 0.55, y: inner[i].y + dy * 0.55 });
      deepR.push({ x: inner[i].x - dx * 0.7, y: inner[i].y - dy * 0.7 });
    }
    gfx.fillStyle(DEPTH, 0.95).fillPoints([...deep, ...deepR.reverse()], true);
    const top = left.map((p, i) => (p.y <= right[i].y ? p : right[i]));
    gfx.lineStyle(1, LIP, 0.75);
    gfx.beginPath().moveTo(top[0].x, top[0].y - 0.5);
    for (let i = 1; i < n; i++) gfx.lineTo(top[i].x, top[i].y - 0.5);
    gfx.strokePath();
  }
}
