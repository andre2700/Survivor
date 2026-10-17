// Efeitos desenhados por código (brilhos, golpes, anéis, vinheta), suaves como a arte cartoon.

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

/** Ponto de luz com borda suave (partículas e brilhos com mistura aditiva). */
export function glowDot(size = 32) {
  const [c, g] = canvas(size, size);
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

/** Faísca pequena (partículas de impacto). */
export function spark() {
  const [c, g] = canvas(4, 4);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(2, 2, 2, 0, Math.PI * 2);
  g.fill();
  return c;
}

/** Sombra oval no chão. */
export function softShadow(hd: number) {
  const w = 20 * hd;
  const h = 8 * hd;
  const [c, g] = canvas(w, h);
  g.translate(w / 2, h / 2);
  g.scale(1, h / w);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, w / 2);
  grad.addColorStop(0, 'rgba(10,14,8,0.45)');
  grad.addColorStop(0.7, 'rgba(10,14,8,0.3)');
  grad.addColorStop(1, 'rgba(10,14,8,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, w / 2, 0, Math.PI * 2);
  g.fill();
  return c;
}

/** Meia-lua do golpe de espada, 48×30 lógicos, aberta para a direita. */
export function slash(hd: number) {
  const w = 48 * hd;
  const h = 30 * hd;
  const [c, g] = canvas(w, h);
  g.scale(hd, hd);
  const crescent = (rx: number, inner: number) => {
    g.beginPath();
    g.ellipse(4, 15, rx, 14.5, 0, -Math.PI / 2, Math.PI / 2);
    g.ellipse(-4, 15, inner, 13, 0, Math.PI / 2, -Math.PI / 2, true);
    g.closePath();
  };
  const grad = g.createLinearGradient(0, 0, 48, 0);
  grad.addColorStop(0, 'rgba(127,178,255,0)');
  grad.addColorStop(0.55, 'rgba(160,205,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,1)');
  crescent(43, 38);
  g.fillStyle = grad;
  g.fill();
  crescent(43, 41);
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.fill();
  return c;
}

/** Anel da aura de fogo, 96 lógicos (usado com mistura aditiva). */
export function auraRing(hd: number) {
  const s = 96 * hd;
  const [c, g] = canvas(s, s);
  const r = s / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, 'rgba(232,85,26,0)');
  grad.addColorStop(0.6, 'rgba(232,85,26,0.12)');
  grad.addColorStop(0.82, 'rgba(240,110,40,0.45)');
  grad.addColorStop(0.92, 'rgba(255,190,90,1)');
  grad.addColorStop(1, 'rgba(255,179,71,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  return c;
}

/** Vinheta: escurece as bordas da tela. */
export function vignette() {
  const s = 256;
  const [c, g] = canvas(s, s);
  g.translate(s / 2, s / 2);
  g.scale(1, 1.1);
  const grad = g.createRadialGradient(0, 0, s * 0.28, 0, 0, s * 0.62);
  grad.addColorStop(0, 'rgba(5,6,12,0)');
  grad.addColorStop(1, 'rgba(5,6,12,0.75)');
  g.fillStyle = grad;
  g.fillRect(-s, -s, s * 2, s * 2);
  return c;
}
