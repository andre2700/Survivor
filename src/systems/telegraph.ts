// Avisos de golpe no chão, todos no mesmo estilo: área translúcida com contorno forte (borda escura por
// baixo, para aparecer em qualquer chão), e um preenchimento que cresce até a hora do golpe, para o
// jogador ler quanto tempo tem. Perto do fim o contorno pulsa.
import Phaser from 'phaser';
import { LAYER } from '../scenes/GameScene';

const DARK = 0x1a0806;

/** Anima `draw(k)` de 0 a 1 em `time` s; para sozinho se o desenho for destruído antes. */
function animate(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, time: number, own: boolean, draw: (k: number) => void, from = 0) {
  draw(from);
  scene.tweens.addCounter({
    from, to: 1, duration: Math.max(1, time * 1000),
    onUpdate: (tw) => {
      if (!g.scene) return tw.stop();
      draw(tw.getValue() ?? 1);
    },
    onComplete: () => {
      if (own && g.scene) g.destroy();
    },
  });
}

const pulse = (k: number) => (k > 0.7 ? 0.75 + 0.25 * Math.sin(k * 60) : 1);

/** Ponto da elipse (raio rx, ry) no ângulo `a`. */
const ell = (x: number, y: number, rx: number, ry: number, a: number) => new Phaser.Math.Vector2(x + Math.cos(a) * rx, y + Math.sin(a) * ry);

/** Borda tracejada que gira devagar (dá vida ao aviso sem tampar o chão). */
function dashedEllipse(g: Phaser.GameObjects.Graphics, x: number, y: number, rx: number, ry: number, spin: number, n: number) {
  for (let i = 0; i < n; i++) {
    const a0 = spin + (i / n) * Math.PI * 2;
    const a1 = a0 + (Math.PI * 2) / n * 0.55;
    const pts: Phaser.Math.Vector2[] = [];
    for (let j = 0; j <= 4; j++) pts.push(ell(x, y, rx, ry, a0 + ((a1 - a0) * j) / 4));
    g.strokePoints(pts);
  }
}

/**
 * Círculo (elipse no chão) que se enche até o golpe. Sem `g`, cria e destrói o próprio desenho; com
 * `g`, desenha nele e quem chamou cuida de destruir.
 */
export function warnCircle(scene: Phaser.Scene, x: number, y: number, r: number, color: number, time: number, g?: Phaser.GameObjects.Graphics, flat = 0.8, from = 0) {
  const own = !g;
  const gfx = g ?? scene.add.graphics().setDepth(LAYER.warn);
  const rx = r;
  const ry = r * flat;
  const t0 = scene.time.now;
  animate(scene, gfx, time, own, (k) => {
    gfx.clear();
    const p = pulse(k);
    // fundo suave e uma borda que brilha para dentro (mais forte na beirada)
    gfx.fillStyle(color, 0.1).fillEllipse(x, y, rx * 2, ry * 2);
    for (let i = 0; i < 3; i++) {
      const f = 1 - i * 0.07;
      gfx.lineStyle(4, color, (0.22 - i * 0.06) * p).strokeEllipse(x, y, rx * 2 * f, ry * 2 * f);
    }
    // o tempo: a área cresce do centro até a borda; o anel claro mostra onde está
    gfx.fillStyle(color, 0.22).fillEllipse(x, y, rx * 2 * k, ry * 2 * k);
    gfx.lineStyle(2, 0xffffff, 0.35 + 0.4 * k).strokeEllipse(x, y, rx * 2 * k, ry * 2 * k);
    // borda: sombra escura fina, cor forte e o tracejado girando por fora
    gfx.lineStyle(3.5, DARK, 0.3 * p).strokeEllipse(x, y, rx * 2, ry * 2);
    gfx.lineStyle(2, color, 0.95 * p).strokeEllipse(x, y, rx * 2, ry * 2);
    if (r > 18) {
      gfx.lineStyle(2, 0xffffff, 0.5 * p);
      dashedEllipse(gfx, x, y, rx + 4, ry + 4 * flat, (scene.time.now - t0) / 900, Math.max(8, Math.round(r / 6)));
    }
  }, from);
  return gfx;
}

/** Faixa reta de (x1, y1) a (x2, y2), meia largura `half`, que se enche do começo ao fim. */
export function warnLane(scene: Phaser.Scene, x1: number, y1: number, x2: number, y2: number, half: number, color: number, time: number, g?: Phaser.GameObjects.Graphics) {
  const own = !g;
  const gfx = g ?? scene.add.graphics().setDepth(LAYER.warn);
  const a = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.hypot(x2 - x1, y2 - y1);
  const nx = -Math.sin(a);
  const ny = Math.cos(a);
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  /** faixa com pontas arredondadas, de d0 a d1 ao longo do golpe, com meia largura w */
  const capsule = (d0: number, d1: number, w: number) => {
    const pts: Phaser.Math.Vector2[] = [];
    const ax = x1 + ux * d0;
    const ay = y1 + uy * d0;
    const bx = x1 + ux * d1;
    const by = y1 + uy * d1;
    for (let j = 0; j <= 6; j++) {
      const t = -Math.PI / 2 + (j / 6) * Math.PI;
      pts.push(new Phaser.Math.Vector2(bx + (ux * Math.cos(t) + nx * Math.sin(t)) * w, by + (uy * Math.cos(t) + ny * Math.sin(t)) * w));
    }
    for (let j = 0; j <= 6; j++) {
      const t = Math.PI / 2 + (j / 6) * Math.PI;
      pts.push(new Phaser.Math.Vector2(ax + (ux * Math.cos(t) + nx * Math.sin(t)) * w, ay + (uy * Math.cos(t) + ny * Math.sin(t)) * w));
    }
    return pts;
  };
  const t0 = scene.time.now;
  animate(scene, gfx, time, own, (k) => {
    gfx.clear();
    const p = pulse(k);
    gfx.fillStyle(color, 0.1).fillPoints(capsule(0, len, half), true);
    // bordas que brilham para dentro
    gfx.lineStyle(4, color, 0.18 * p).strokePoints(capsule(0, len, half * 0.82), true);
    // o tempo: a faixa se enche na direção do golpe
    if (k > 0.02) gfx.fillStyle(color, 0.24).fillPoints(capsule(0, len * k, half), true);
    // setas finas que deslizam na direção do golpe
    const s = Math.min(7, half * 0.5);
    const shift = (((scene.time.now - t0) / 1000) * 60) % 34;
    gfx.lineStyle(2, 0xffffff, 0.3 + 0.35 * k);
    for (let d = 14 + shift; d < len - 8; d += 34) {
      const cx = x1 + ux * d;
      const cy = y1 + uy * d;
      gfx.strokePoints([
        new Phaser.Math.Vector2(cx - ux * s + nx * s, cy - uy * s + ny * s),
        new Phaser.Math.Vector2(cx, cy),
        new Phaser.Math.Vector2(cx - ux * s - nx * s, cy - uy * s - ny * s),
      ]);
    }
    gfx.lineStyle(3.5, DARK, 0.3 * p).strokePoints(capsule(0, len, half), true);
    gfx.lineStyle(2, color, 0.95 * p).strokePoints(capsule(0, len, half), true);
  });
  return gfx;
}
