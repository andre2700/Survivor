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

/**
 * Círculo (elipse no chão) que se enche até o golpe. Sem `g`, cria e destrói o próprio desenho; com
 * `g`, desenha nele e quem chamou cuida de destruir.
 */
export function warnCircle(scene: Phaser.Scene, x: number, y: number, r: number, color: number, time: number, g?: Phaser.GameObjects.Graphics, flat = 0.8, from = 0) {
  const own = !g;
  const gfx = g ?? scene.add.graphics().setDepth(LAYER.warn);
  const w = r * 2;
  const h = r * 2 * flat;
  animate(scene, gfx, time, own, (k) => {
    gfx.clear();
    gfx.fillStyle(color, 0.14).fillEllipse(x, y, w, h);
    gfx.fillStyle(color, 0.3).fillEllipse(x, y, w * k, h * k);
    gfx.lineStyle(1.5, 0xffffff, 0.45 * k).strokeEllipse(x, y, w * k, h * k);
    const p = pulse(k);
    gfx.lineStyle(5, DARK, 0.45 * p).strokeEllipse(x, y, w, h);
    gfx.lineStyle(2.5, color, 0.95 * p).strokeEllipse(x, y, w, h);
  }, from);
  return gfx;
}

/** Faixa reta de (x1, y1) a (x2, y2), meia largura `half`, que se enche do começo ao fim. */
export function warnLane(scene: Phaser.Scene, x1: number, y1: number, x2: number, y2: number, half: number, color: number, time: number, g?: Phaser.GameObjects.Graphics) {
  const own = !g;
  const gfx = g ?? scene.add.graphics().setDepth(LAYER.warn);
  const a = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.hypot(x2 - x1, y2 - y1);
  const nx = -Math.sin(a) * half;
  const ny = Math.cos(a) * half;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const quad = (d0: number, d1: number) => [
    { x: x1 + ux * d0 + nx, y: y1 + uy * d0 + ny }, { x: x1 + ux * d1 + nx, y: y1 + uy * d1 + ny },
    { x: x1 + ux * d1 - nx, y: y1 + uy * d1 - ny }, { x: x1 + ux * d0 - nx, y: y1 + uy * d0 - ny },
  ] as Phaser.Math.Vector2[];
  animate(scene, gfx, time, own, (k) => {
    gfx.clear();
    gfx.fillStyle(color, 0.14).fillPoints(quad(0, len), true);
    gfx.fillStyle(color, 0.3).fillPoints(quad(0, len * k), true);
    // setas apontando para onde o golpe vai
    for (let d = 26; d < len - 10; d += 46) {
      const cx = x1 + ux * d;
      const cy = y1 + uy * d;
      const s = Math.min(9, half * 0.6);
      const tip = { x: cx + ux * s, y: cy + uy * s };
      const l = { x: cx - ux * s + (nx / half) * s, y: cy - uy * s + (ny / half) * s };
      const rr = { x: cx - ux * s - (nx / half) * s, y: cy - uy * s - (ny / half) * s };
      gfx.lineStyle(2.5, 0xffffff, 0.55 + 0.3 * k).strokePoints([l, tip, rr] as Phaser.Math.Vector2[]);
    }
    const p = pulse(k);
    gfx.lineStyle(5, DARK, 0.45 * p).strokePoints(quad(0, len), true);
    gfx.lineStyle(2.5, color, 0.95 * p).strokePoints(quad(0, len), true);
  });
  return gfx;
}
