// Folha de arte para desenvolvimento: desenha todos os sprites ampliados.
import { SHEET } from './sheet';

const SCALE = Number(new URLSearchParams(location.search).get('s') ?? 5);
const c = document.getElementById('c') as HTMLCanvasElement;
const items = SHEET();
const pad = 6;
let x = pad, y = pad, rowH = 0;
const maxW = 1400;
const placed: { canvas: HTMLCanvasElement; x: number; y: number; label: string }[] = [];
for (const it of items) {
  const w = it.canvas.width * SCALE, h = it.canvas.height * SCALE;
  if (x + w > maxW) { x = pad; y += rowH + 18; rowH = 0; }
  placed.push({ canvas: it.canvas, x, y, label: it.label });
  x += w + pad; rowH = Math.max(rowH, h);
}
c.width = maxW; c.height = y + rowH + 24;
const ctx = c.getContext('2d')!;
ctx.imageSmoothingEnabled = false;
ctx.fillStyle = '#4f6b4a'; ctx.fillRect(0, 0, c.width, c.height);
for (const p of placed) {
  ctx.drawImage(p.canvas, p.x, p.y, p.canvas.width * SCALE, p.canvas.height * SCALE);
  ctx.fillStyle = '#fff'; ctx.fillText(p.label, p.x, p.y + p.canvas.height * SCALE + 12);
}
(window as any).__ready = true;
