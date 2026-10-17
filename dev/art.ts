// Folha de arte para desenvolvimento: mostra todos os sprites no tamanho lógico × escala (?s=2 padrão).
import SPRITES from '../src/art/sprites.json';

const SCALE = Number(new URLSearchParams(location.search).get('s') ?? 2);
const URLS = import.meta.glob('../src/assets/art/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const HD = SPRITES as Record<string, number>;
const c = document.getElementById('c') as HTMLCanvasElement;

const load = (url: string) => new Promise<HTMLImageElement>((ok) => {
  const img = new Image();
  img.onload = () => ok(img);
  img.src = url;
});

const items = await Promise.all(Object.entries(URLS)
  .map(([path, url]) => [path.replace(/^.*\/|\.png$/g, ''), url] as const)
  .filter(([name]) => !name.startsWith('portrait_'))
  .map(async ([name, url]) => ({ name, img: await load(url), k: SCALE / (HD[name] ?? 1) })));

const pad = 8;
const maxW = 1400;
let x = pad, y = pad, rowH = 0;
const placed = items.map((it) => {
  const w = it.img.width * it.k, h = it.img.height * it.k;
  if (x + w > maxW) { x = pad; y += rowH + 18; rowH = 0; }
  const p = { ...it, x, y, w, h };
  x += w + pad; rowH = Math.max(rowH, h);
  return p;
});
c.width = maxW; c.height = y + rowH + 24;
const ctx = c.getContext('2d')!;
ctx.fillStyle = '#5f9446'; ctx.fillRect(0, 0, c.width, c.height);
for (const p of placed) {
  ctx.drawImage(p.img, p.x, p.y, p.w, p.h);
  ctx.fillStyle = '#fff'; ctx.fillText(p.name, p.x, p.y + p.h + 12);
}
(window as any).__ready = true;
