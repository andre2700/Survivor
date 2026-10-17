# Prepara as imagens do teste de estilo (docs/ART_PLAN.md) para o jogo:
# remove o fundo magenta, recorta, reduz ao tamanho lógico do jogo e salva em dev/art-test/<estilo>/.
#
#   python3 scripts/process-art-test.py
#
# Pixel art sai no tamanho lógico (o jogo amplia sem suavizar); cartoon sai em 2× (resolução física com zoom 2).
from pathlib import Path

from PIL import Image, ImageFilter

RAW = Path('art-tests/raw')
OUT = Path('dev/art-test')

# altura lógica de cada sprite, igual à arte atual de src/art/
HEIGHTS = {
    'hero': 40, 'slime': 20, 'goblin': 30, 'wolf': 26, 'demon': 68, 'tree': 64,
    'icon_sword': 16, 'icon_bolt': 16, 'icon_orb': 16,
}
GRASS = 64
CARTOON_SCALE = 2


def border_color(im):
    w, h = im.size
    px = im.load()
    samples = [px[x, y] for x in range(0, w, 8) for y in (0, h - 1)] + [px[x, y] for y in range(0, h, 8) for x in (0, w - 1)]
    return tuple(sorted(c[i] for c in samples)[len(samples) // 2] for i in range(3))


def cut_background(im, soft):
    """Alfa pela distância à cor do fundo; `soft` gera borda suave e tira o reflexo magenta."""
    im = im.convert('RGB')
    bg = border_color(im)
    rgba = Image.new('RGBA', im.size)
    src, dst = im.load(), rgba.load()
    lo, hi = (40, 120) if soft else (90, 91)
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            r, g, b = src[x, y]
            d = ((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2) ** 0.5
            a = 0 if d <= lo else 255 if d >= hi else int(255 * (d - lo) / (hi - lo))
            if 0 < a < 255:
                # remove a parte do fundo misturada na borda
                t = a / 255
                r, g, b = (max(0, min(255, int((c - bg[i] * (1 - t)) / t))) for i, c in enumerate((r, g, b)))
                # magenta residual: limita vermelho e azul ao verde + margem
                m = g + 40
                r, b = min(r, max(m, g)), min(b, max(m, g))
            dst[x, y] = (r, g, b, a)
    # erosão leve para tirar ruído isolado do fundo
    alpha = rgba.getchannel('A').filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    rgba.putalpha(alpha)
    # caixa só pelos pixels bem opacos (ignora restos fracos do fundo)
    return rgba.crop(alpha.point(lambda v: 255 if v >= 128 else 0).getbbox())


def premul_resize(im, size):
    """Redimensiona sem deixar halo escuro/magenta nas bordas transparentes."""
    r, g, b, a = im.split()
    rgb = Image.merge('RGB', (r, g, b))
    black = Image.new('RGB', im.size)
    pre = Image.composite(rgb, black, a).resize(size, Image.LANCZOS)
    a2 = a.resize(size, Image.LANCZOS)
    pr, pa = pre.load(), a2.load()
    out = Image.new('RGBA', size)
    o = out.load()
    for y in range(size[1]):
        for x in range(size[0]):
            al = pa[x, y]
            if al == 0:
                o[x, y] = (0, 0, 0, 0)
            else:
                o[x, y] = tuple(min(255, pr[x, y][i] * 255 // al) for i in range(3)) + (al,)
    return out


def pixelize(im, size):
    """Reduz por média de área, binariza o alfa e limita a paleta (pixels limpos)."""
    small = im.resize(size, Image.BOX)
    alpha = small.getchannel('A').point(lambda v: 255 if v >= 128 else 0)
    rgb = small.convert('RGB').quantize(colors=24, method=Image.Quantize.MEDIANCUT).convert('RGB')
    rgb.putalpha(alpha)
    return rgb


def grass(path, style):
    im = Image.open(path).convert('RGB')
    w, h = im.size
    s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w + s) // 2, (h + s) // 2))
    # repetível: desloca meia textura (as bordas viram a emenda central) e cobre a emenda
    # com o centro da imagem original, em degradê
    im = im.resize((512, 512), Image.LANCZOS)
    half, r = 256, 160
    rolled = Image.new('RGB', im.size)
    for sx, sy, dx, dy in ((0, 0, half, half), (half, 0, 0, half), (0, half, half, 0), (half, half, 0, 0)):
        rolled.paste(im.crop((sx, sy, sx + half, sy + half)), (dx, dy))
    mask = Image.new('L', (2 * r, 2 * r))
    m = mask.load()
    for y in range(2 * r):
        for x in range(2 * r):
            d = max(abs(x - r), abs(y - r))
            m[x, y] = 255 if d < 100 else max(0, int(255 * (r - d) / (r - 100)))
    tile = rolled
    tile.paste(im.crop((half - r, half - r, half + r, half + r)), (half - r, half - r), mask)
    if style == 'pixel':
        return tile.resize((GRASS, GRASS), Image.BOX).quantize(colors=16).convert('RGB')
    return tile.resize((GRASS * CARTOON_SCALE, GRASS * CARTOON_SCALE), Image.LANCZOS)


for style in ('pixel', 'cartoon'):
    dst = OUT / style
    dst.mkdir(parents=True, exist_ok=True)
    for name, h in HEIGHTS.items():
        cut = cut_background(Image.open(RAW / style / f'{name}.png'), soft=style == 'cartoon')
        if name.startswith('icon'):  # ícones: caixa quadrada
            side = max(cut.size)
            sq = Image.new('RGBA', (side, side))
            sq.paste(cut, ((side - cut.width) // 2, (side - cut.height) // 2))
            cut = sq
        w = max(1, round(cut.width * h / cut.height))
        if style == 'pixel':
            img = pixelize(cut, (w, h))
        else:
            img = premul_resize(cut, (w * CARTOON_SCALE, h * CARTOON_SCALE))
        img.save(dst / f'{name}.png')
        print(style, name, img.size)
    grass(RAW / style / 'grass.png', style).save(dst / 'grass.png')
