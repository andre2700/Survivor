// Inimigos desenhados por código, cada um com 4 quadros de animação.
import { PixelBuffer, R } from './pixel';

const EYE = '#140c1c';

export function slimeFrames(): PixelBuffer[] {
  const shapes = [[9, 7], [10.5, 5.8], [9, 7], [8, 8.2]];
  return shapes.map(([rx, ry]) => {
    const b = new PixelBuffer(24, 20);
    const cy = 18 - ry;
    b.sphere(12, cy, rx, ry, R.slime, 0.05);
    // brilho
    b.ellipse(9, cy - ry * 0.45, rx * 0.28, ry * 0.2, R.slime[4]);
    b.set(8, Math.round(cy - ry * 0.5), '#ffffff');
    // olhos e boca
    const ey = Math.round(cy - 1);
    b.rect(13, ey, 2, 3, EYE);
    b.rect(17, ey, 2, 3, EYE);
    b.set(13, ey, '#e8ffe0');
    b.set(17, ey, '#e8ffe0');
    b.line(14, ey + 4, 17, ey + 4, R.slime[0]);
    return b.outline();
  });
}

export function batFrames(): PixelBuffer[] {
  const flap = [-8, -3, 4, -3];
  return flap.map((t, f) => {
    const b = new PixelBuffer(30, 22);
    const cy = 11 + (f === 2 ? 1 : 0);
    // asas (membrana com "dedos")
    for (const side of [-1, 1]) {
      const x0 = 15 + side * 3;
      const tip = 15 + side * 13;
      b.poly([[x0, cy - 2], [tip, cy + t], [15 + side * 10, cy + t / 2 + 4], [15 + side * 6, cy + 3], [x0, cy + 2]], R.bat.slice(0, 3));
      b.line(x0, cy - 2, tip, cy + t, R.bat[3]);
    }
    b.sphere(15, cy, 4.5, 4.2, R.bat, 0.1);
    // orelhas
    b.poly([[12, cy - 3], [13, cy - 7], [14, cy - 3]], R.bat[2]);
    b.poly([[16, cy - 3], [17, cy - 7], [18, cy - 3]], R.bat[2]);
    b.set(13, cy, '#ff4a4a');
    b.set(17, cy, '#ff4a4a');
    b.set(14, cy + 2, '#f4f0ff');
    b.set(16, cy + 2, '#f4f0ff');
    return b.outline();
  });
}

const LEGS = [[1, -1], [3, -2], [-1, 1], [-2, 3]];

export function skeletonFrames(): PixelBuffer[] {
  return LEGS.map(([front, back], f) => {
    const b = new PixelBuffer(28, 36);
    const bob = f % 2 ? -1 : 0;
    const bone = R.bone;
    // pernas (ossos finos)
    for (const [dx, shade] of [[back, 1], [front, 3]] as const) {
      b.line(12 + dx, 26 + bob, 12 + dx, 33, bone[shade], 2);
      b.rect(12 + dx, 33, 3, 2, bone[shade - 1]);
    }
    // pelve e costelas
    b.rect(10, 24 + bob, 8, 2, bone[2]);
    b.line(14, 15 + bob, 14, 24 + bob, bone[3], 2);
    for (let i = 0; i < 3; i++) b.line(10, 16 + i * 2 + bob, 18, 16 + i * 2 + bob, bone[3 - (i === 2 ? 1 : 0)]);
    // braços
    b.line(9, 16 + bob, 8, 23 + bob, bone[2]);
    b.line(19, 16 + bob, 21, 22 + bob, bone[3]);
    // espada enferrujada
    b.line(21, 22 + bob, 26, 13 + bob, '#8a7d70', 2);
    b.line(20, 21 + bob, 23, 24 + bob, R.leather[2]);
    // crânio
    b.sphere(14, 9 + bob, 6, 5.6, bone, 0.1);
    b.rect(11, 12 + bob, 7, 3, bone[2]);
    b.rect(15, 7 + bob, 3, 3, EYE);
    b.rect(11, 7 + bob, 2, 3, EYE);
    b.set(16, 8 + bob, '#ff5040');
    b.set(12, 8 + bob, '#ff5040');
    for (let i = 0; i < 3; i++) b.set(12 + i * 2, 13 + bob, EYE);
    return b.outline();
  });
}

export function goblinFrames(): PixelBuffer[] {
  return LEGS.map(([front, back], f) => {
    const b = new PixelBuffer(28, 30);
    const bob = f % 2 ? -1 : 0;
    const skin = R.green;
    b.shadedRect(11 + back, 22, 3, 6, R.leather);
    b.shadedRect(14 + front, 22, 3, 6, R.leather);
    b.rect(11 + back, 27, 3, 2, R.leather[0]);
    b.rect(14 + front, 27, 4, 2, R.leather[0]);
    // corpo com trapo
    b.shadedRect(10, 15 + bob, 9, 8, R.leather);
    b.line(10, 21 + bob, 18, 21 + bob, R.leather[0]);
    b.shadedRect(8, 16 + bob, 2, 5, skin);
    b.shadedRect(19, 16 + bob, 2, 5, skin);
    // adaga
    b.line(20, 20 + bob, 25, 15 + bob, R.steel[4]);
    // cabeça grande com orelhas pontudas
    b.poly([[6, 6 + bob], [10, 9 + bob], [9, 11 + bob]], skin.slice(1));
    b.poly([[22, 6 + bob], [18, 9 + bob], [19, 11 + bob]], skin.slice(1));
    b.sphere(14, 10 + bob, 5.6, 5, skin, 0.05);
    b.rect(15, 9 + bob, 2, 2, '#ffd23a');
    b.rect(11, 9 + bob, 2, 2, '#ffd23a');
    b.set(16, 9 + bob, EYE);
    b.set(12, 9 + bob, EYE);
    b.line(12, 13 + bob, 17, 13 + bob, skin[0]);
    b.set(16, 14 + bob, '#f4f0ff');
    return b.outline();
  });
}

export function wolfFrames(): PixelBuffer[] {
  const legs = [[2, -2, -2, 2], [3, -3, 0, 0], [-2, 2, 2, -2], [0, 0, 3, -3]];
  return legs.map(([fl, fr, bl, br], f) => {
    const b = new PixelBuffer(38, 26);
    const bob = f % 2 ? -1 : 0;
    const fur = ['#24262e', '#40444f', '#646a78', '#8f96a6', '#c3c9d6'];
    // patas traseiras (atrás do corpo)
    b.line(10 + bl, 17 + bob, 10 + bl * 1.5, 24, fur[1], 2);
    b.line(26 + fl, 17 + bob, 26 + fl * 1.5, 24, fur[1], 2);
    // cauda
    b.poly([[6, 12 + bob], [1, 8 + bob], [2, 12 + bob], [5, 15 + bob]], fur.slice(1));
    // corpo
    b.sphere(17, 14 + bob, 11, 5.6, fur, 0.05);
    b.ellipse(17, 17 + bob, 8, 2, fur[3]);
    // patas da frente
    b.line(12 + br, 17 + bob, 12 + br * 1.5, 24, fur[2], 2);
    b.line(28 + fr, 17 + bob, 28 + fr * 1.5, 24, fur[2], 2);
    // cabeça
    b.sphere(30, 10 + bob, 5, 4.4, fur, 0.1);
    b.poly([[33, 10 + bob], [37, 12 + bob], [33, 14 + bob]], fur.slice(1));
    b.poly([[27, 7 + bob], [28, 2 + bob], [30, 6 + bob]], fur.slice(0, 3));
    b.poly([[30, 6 + bob], [32, 2 + bob], [33, 7 + bob]], fur.slice(0, 3));
    b.set(32, 9 + bob, '#ffd23a');
    b.set(37, 12 + bob, EYE);
    b.line(34, 14 + bob, 36, 14 + bob, '#f4f0ff');
    return b.outline();
  });
}

export function orcFrames(): PixelBuffer[] {
  return LEGS.map(([front, back], f) => {
    const b = new PixelBuffer(40, 42);
    const bob = f % 2 ? -1 : 0;
    const skin = R.orc;
    // pernas
    b.shadedRect(14 + back, 30, 5, 8, R.leather);
    b.shadedRect(20 + front, 30, 5, 8, R.leather);
    b.rect(14 + back, 37, 6, 3, R.leather[0]);
    b.rect(20 + front, 37, 6, 3, R.leather[0]);
    // braço de trás
    b.shadedRect(9, 19 + bob, 4, 9, skin.slice(0, 3));
    // tronco com armadura de couro e ombreira
    b.shadedRect(12, 17 + bob, 15, 14, skin);
    b.shadedRect(13, 22 + bob, 13, 8, R.leather);
    b.line(13, 25 + bob, 25, 25 + bob, R.leather[0]);
    b.set(19, 25 + bob, R.gold[3]);
    b.sphere(13, 18 + bob, 4, 3.4, R.steel, 0.1);
    // cabeça
    b.sphere(21, 11 + bob, 7, 6.4, skin, 0.05);
    b.rect(16, 14 + bob, 10, 3, skin[2]);
    b.rect(21, 9 + bob, 3, 2, '#ff3a2a');
    b.set(17, 9 + bob, '#ff3a2a');
    b.line(17, 7 + bob, 25, 7 + bob, skin[0]);
    // presas
    b.rect(19, 15 + bob, 1, 2, '#f7f4ee');
    b.rect(24, 15 + bob, 1, 2, '#f7f4ee');
    // braço da frente e clava
    b.shadedRect(26, 19 + bob, 4, 9, skin);
    b.line(30, 27 + bob, 36, 12 + bob, R.wood[2], 3);
    b.sphere(36, 12 + bob, 3.4, 3.4, R.wood, 0.1);
    b.sphere(28, 28 + bob, 2.4, 2.2, skin);
    return b.outline();
  });
}

export function demonFrames(): PixelBuffer[] {
  return [0, 1, 2, 3].map((f) => {
    const b = new PixelBuffer(72, 68);
    const bob = [0, -1, -2, -1][f];
    const wing = [-4, 0, 4, 0][f];
    const d = R.demon;
    // asas
    for (const side of [-1, 1]) {
      const x0 = 36 + side * 8;
      b.poly(
        [[x0, 20 + bob], [36 + side * 34, 6 + wing], [36 + side * 30, 22 + wing], [36 + side * 33, 34 + wing / 2], [36 + side * 20, 30], [x0, 34 + bob]],
        R.shadow.concat(['#4a1a3a']),
      );
      b.line(x0, 20 + bob, 36 + side * 34, 6 + wing, '#5e2350', 2);
      b.line(36 + side * 34, 6 + wing, 36 + side * 30, 22 + wing, '#3a1430');
    }
    // pernas
    b.shadedRect(26, 46 + bob, 8, 14 - bob, d.slice(0, 4));
    b.shadedRect(39, 46 + bob, 8, 14 - bob, d.slice(0, 4));
    b.poly([[24, 60], [35, 60], [35, 64], [22, 64]], R.shadow);
    b.poly([[38, 60], [49, 60], [51, 64], [38, 64]], R.shadow);
    // tronco musculoso
    b.sphere(36, 36 + bob, 14, 13, d, 0.05);
    b.line(36, 28 + bob, 36, 46 + bob, d[1]);
    b.line(29, 34 + bob, 43, 34 + bob, d[2]);
    // braços com garras
    b.sphere(20, 36 + bob, 5, 9, d.slice(0, 4));
    b.sphere(52, 36 + bob, 5, 9, d);
    for (const x of [17, 20, 23]) b.line(x, 44 + bob, x - 1, 48 + bob, '#f7f4ee');
    for (const x of [49, 52, 55]) b.line(x, 44 + bob, x + 1, 48 + bob, '#f7f4ee');
    // cabeça com chifres
    b.poly([[26, 16 + bob], [31, 12 + bob], [28, 5 + bob], [21, 0], [23, 8 + bob]], R.bone);
    b.poly([[46, 16 + bob], [41, 12 + bob], [44, 5 + bob], [51, 0], [49, 8 + bob]], R.bone);
    b.sphere(36, 18 + bob, 9, 8, d, 0.1);
    // olhos brilhantes e boca
    b.rect(30, 16 + bob, 4, 2, '#ffe14a');
    b.rect(39, 16 + bob, 4, 2, '#ffe14a');
    b.set(31, 16 + bob, '#ffffff');
    b.set(40, 16 + bob, '#ffffff');
    b.rect(31, 22 + bob, 10, 2, '#1a0508');
    for (let x = 32; x <= 40; x += 2) b.set(x, 22 + bob, '#f7f4ee');
    return b.outline('#0c0408', 0.7);
  });
}
