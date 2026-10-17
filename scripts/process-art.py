# Prepara a arte cartoon para o jogo: remove o fundo magenta, recorta e reduz cada imagem de
# art/source/ ao tamanho de art/manifest.mjs, salvando em src/assets/art/ e o índice em src/art/sprites.json.
#
#   python3 scripts/process-art.py [nome ...]
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps

SRC = Path('art/source')
OUT = Path('src/assets/art')
INDEX = Path('src/art/sprites.json')
GROUND = 64  # lado lógico do ladrilho de grama
GROUND_HD = 2


def manifest():
    js = "import('./art/manifest.mjs').then((m) => console.log(JSON.stringify(m.ART)))"
    return json.loads(subprocess.check_output(['node', '-e', js]))


def border_color(im):
    w, h = im.size
    px = im.load()
    samples = [px[x, y] for x in range(0, w, 8) for y in (0, h - 1)] + [px[x, y] for y in range(0, h, 8) for x in (0, w - 1)]
    return tuple(sorted(c[i] for c in samples)[len(samples) // 2] for i in range(3))


def cut_background(im):
    """Alfa pela distância à cor do fundo, com borda suave e sem o reflexo magenta."""
    im = im.convert('RGB')
    bg = border_color(im)
    rgba = Image.new('RGBA', im.size)
    src, dst = im.load(), rgba.load()
    lo, hi = 40, 120
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
                r, b = min(r, m), min(b, m)
            dst[x, y] = (r, g, b, a)
    # erosão leve para tirar ruído isolado do fundo
    alpha = rgba.getchannel('A').filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    rgba.putalpha(alpha)
    # caixa só pelos pixels bem opacos (ignora restos fracos do fundo)
    return rgba.crop(alpha.point(lambda v: 255 if v >= 128 else 0).getbbox())


def premul_resize(im, size):
    """Redimensiona sem deixar halo escuro nas bordas transparentes."""
    r, g, b, a = im.split()
    pre = Image.composite(Image.merge('RGB', (r, g, b)), Image.new('RGB', im.size), a).resize(size, Image.LANCZOS)
    a2 = a.resize(size, Image.LANCZOS)
    pr, pa = pre.load(), a2.load()
    out = Image.new('RGBA', size)
    o = out.load()
    for y in range(size[1]):
        for x in range(size[0]):
            al = pa[x, y]
            o[x, y] = (0, 0, 0, 0) if al == 0 else tuple(min(255, pr[x, y][i] * 255 // al) for i in range(3)) + (al,)
    return out


def with_shadow(im):
    """Sombra oval sob os pés: centrada na largura dos pés, metade para baixo da sola."""
    w, h = im.size
    alpha = im.getchannel('A')
    feet = alpha.crop((0, int(h * 0.85), w, h)).point(lambda v: 255 if v >= 128 else 0).getbbox()
    fx0, fx1 = (feet[0], feet[2]) if feet else (0, w)
    sw = max((fx1 - fx0) * 1.3, w * 0.35)
    sh = sw * 0.28
    cx = (fx0 + fx1) / 2
    out = Image.new('RGBA', (w, h + round(sh / 2)))
    shadow = Image.new('L', out.size)
    ImageDraw.Draw(shadow).ellipse((cx - sw / 2, h - sh / 2, cx + sw / 2, h + sh / 2), fill=90)
    shadow = shadow.filter(ImageFilter.GaussianBlur(sh / 6))
    out.paste((10, 14, 8, 255), (0, 0), shadow)
    out.alpha_composite(im)
    return out


def ground(path):
    """Ladrilho de grama repetível: desloca meia textura e cobre a emenda com o centro original."""
    im = Image.open(path).convert('RGB')
    w, h = im.size
    s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w + s) // 2, (h + s) // 2)).resize((512, 512), Image.LANCZOS)
    half, r = 256, 160
    tile = Image.new('RGB', im.size)
    for sx, sy, dx, dy in ((0, 0, half, half), (half, 0, 0, half), (0, half, half, 0), (half, half, 0, 0)):
        tile.paste(im.crop((sx, sy, sx + half, sy + half)), (dx, dy))
    mask = Image.new('L', (2 * r, 2 * r))
    m = mask.load()
    for y in range(2 * r):
        for x in range(2 * r):
            d = max(abs(x - r), abs(y - r))
            m[x, y] = 255 if d < 100 else max(0, int(255 * (r - d) / (r - 100)))
    tile.paste(im.crop((half - r, half - r, half + r, half + r)), (half - r, half - r), mask)
    return tile.resize((GROUND * GROUND_HD,) * 2, Image.LANCZOS)


def main():
    art = manifest()
    only = sys.argv[1:]
    OUT.mkdir(parents=True, exist_ok=True)
    index = json.loads(INDEX.read_text()) if INDEX.exists() else {}
    for name, a in art.items():
        if only and name not in only:
            continue
        src = SRC / f'{name}.png'
        if not src.exists():
            print('falta', src)
            continue
        hd = a.get('hd', 2)
        cut = cut_background(Image.open(src))
        if a.get('flip'):
            cut = ImageOps.mirror(cut)
        if hd == 4 and not name.startswith('hero_'):
            # ícones: caixa quadrada para alinhar nas molduras
            side = max(cut.size)
            sq = Image.new('RGBA', (side, side))
            sq.paste(cut, ((side - cut.width) // 2, (side - cut.height) // 2))
            cut = sq
        variants = [(name, hd)] + ([(f'portrait_{name}', a['portrait'])] if 'portrait' in a else [])
        for key, res in variants:
            if 'w' in a:
                w = a['w'] * res
                h = max(1, round(cut.height * w / cut.width))
            else:
                h = a['h'] * res
                w = max(1, round(cut.width * h / cut.height))
            img = premul_resize(cut, (w, h))
            if a.get('shadow'):
                img = with_shadow(img)
            img.save(OUT / f'{key}.png', optimize=True)
            index[key] = res
            print(key, img.size, f'hd {res}')
    if not only or 'ground' in only:
        ground(SRC / 'grass.png').save(OUT / 'ground.png', optimize=True)
        index['ground'] = GROUND_HD
    INDEX.write_text(json.dumps(dict(sorted(index.items())), indent=1) + '\n')


main()
