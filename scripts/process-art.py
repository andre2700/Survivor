# Prepara a arte cartoon para o jogo: remove o fundo magenta, recorta e reduz cada imagem de
# art/source/ ao tamanho de art/manifest.mjs, salvando em src/assets/art/ e o índice em src/art/sprites.json.
# Personagens animados (folhas <nome>_sheet.png e <nome>_action*.png) viram uma tira de quadros do mesmo
# tamanho, na ordem do modelo de quadros; o índice guarda o nome de cada quadro (slots).
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
GROUND = 128  # lado lógico do ladrilho de grama
GROUND_HD = 2


def manifest():
    js = ("import('./art/manifest.mjs').then((m) => console.log(JSON.stringify(Object.fromEntries("
          "Object.entries(m.ART).map(([k, a]) => [k, a.role ? { ...a, sheets: m.sheets(a) } : a])))))")
    return json.loads(subprocess.check_output(['node', '-e', js]))


def border_color(im):
    w, h = im.size
    px = im.load()
    samples = [px[x, y] for x in range(0, w, 8) for y in (0, h - 1)] + [px[x, y] for y in range(0, h, 8) for x in (0, w - 1)]
    return tuple(sorted(c[i] for c in samples)[len(samples) // 2] for i in range(3))


def cut_background(im):
    """Remove o fundo e recorta na caixa da figura."""
    return crop_opaque(remove_background(im))


def crop_opaque(rgba):
    """Recorta na caixa dos pixels bem opacos (ignora restos fracos do fundo)."""
    return rgba.crop(rgba.getchannel('A').point(lambda v: 255 if v >= 128 else 0).getbbox())


def remove_background(im):
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
            # às vezes o fundo magenta vem cercado de outra cor (margem branca): remove os dois
            d = min(d, ((r - 255) ** 2 + g ** 2 + (b - 255) ** 2) ** 0.5)
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
    return rgba


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


def feet_span(im):
    """Início e fim (x) dos pés: a faixa opaca nos 15% de baixo da figura."""
    w, h = im.size
    feet = im.getchannel('A').crop((0, int(h * 0.85), w, h)).point(lambda v: 255 if v >= 128 else 0).getbbox()
    return (feet[0], feet[2]) if feet else (0, w)


def with_shadow(im, size=None, cx=None):
    """Sombra oval sob os pés: centrada na largura dos pés, metade para baixo da sola.
    `size`/`cx` fixam a sombra (igual em todos os quadros de uma animação)."""
    w, h = im.size
    fx0, fx1 = feet_span(im)
    sw = size or max((fx1 - fx0) * 1.3, w * 0.35)
    sh = sw * 0.28
    cx = (fx0 + fx1) / 2 if cx is None else cx
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


def components(mask):
    """Rótulos das regiões ligadas de uma máscara (lista de listas de bool)."""
    h, w = len(mask), len(mask[0])
    label = [[0] * w for _ in range(h)]
    regions = []
    for y0 in range(h):
        for x0 in range(w):
            if not mask[y0][x0] or label[y0][x0]:
                continue
            n = len(regions) + 1
            label[y0][x0] = n
            stack, pts = [(x0, y0)], []
            while stack:
                x, y = stack.pop()
                pts.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and mask[ny][nx] and not label[ny][nx]:
                        label[ny][nx] = n
                        stack.append((nx, ny))
            regions.append(pts)
    return label, regions


def slice_sheet(path, n):
    """Separa a folha em n figuras. As divisões ficam nas colunas mais vazias perto do esperado, e cada
    parte solta (uma chama, a ponta de uma asa) vai inteira para o quadro onde está o seu centro."""
    rgba = remove_background(Image.open(path))
    w, h = rgba.size
    alpha = rgba.getchannel('A')
    px = alpha.load()
    cols = [sum(1 for y in range(0, h, 2) if px[x, y] >= 128) for x in range(w)]
    cuts = [0]
    for k in range(1, n):
        lo, hi = int(w * (k - 0.5) / n), int(w * (k + 0.5) / n)
        cuts.append(min(range(lo, hi), key=lambda x: (cols[x], abs(x - w * k / n))))
    cuts.append(w)
    # regiões ligadas numa versão reduzida (rápido) da máscara
    q = 4
    small = alpha.resize((w // q, h // q), Image.BOX).load()
    mask = [[small[x, y] >= 100 for x in range(w // q)] for y in range(h // q)]
    label, regions = components(mask)
    # região grande (figura, ou figuras encostadas): dividida pelas colunas de corte. Pedaço pequeno
    # solto (chama, ponta de asa): vai inteiro para o quadro da figura mais próxima dele
    owner = {}
    big = {i for i, pts in enumerate(regions, 1) if max(x for x, _ in pts) - min(x for x, _ in pts) >= w / n * 0.5 / q}
    edge = [p for i in big for p in regions[i - 1][::3]]
    for i, pts in enumerate(regions, 1):
        if i in big:
            continue
        sample = pts[::max(1, len(pts) // 40)]
        nx, _ = min(edge, key=lambda e: min((e[0] - x) ** 2 + (e[1] - y) ** 2 for x, y in sample))
        owner[i] = next(k for k in range(n) if nx * q < cuts[k + 1] or k == n - 1)
    frames = []
    for k in range(n):
        m = Image.new('L', (w // q, h // q))
        mp = m.load()
        for y in range(h // q):
            row = label[y]
            for x in range(w // q):
                r = row[x]
                if r and owner.get(r, k if cuts[k] <= x * q < cuts[k + 1] else -1) == k:
                    mp[x, y] = 255
        m = m.resize((w, h), Image.NEAREST).filter(ImageFilter.MaxFilter(9))
        part = Image.new('RGBA', (w, h))
        part.paste(rgba, (0, 0), m)
        frames.append(drop_slivers(crop_opaque(part)))
    return frames


def drop_slivers(im, q=4):
    """Apaga lascas do quadro vizinho: pedaços pequenos encostados na borda ou longe do corpo."""
    w, h = im.size
    small = im.getchannel('A').resize((max(1, w // q), max(1, h // q)), Image.BOX).load()
    sw, sh = max(1, w // q), max(1, h // q)
    _, regions = components([[small[x, y] >= 60 for x in range(sw)] for y in range(sh)])
    if len(regions) < 2:
        return im
    body = max(regions, key=len)
    near = body[::4]
    out = im.copy()
    for pts in regions:
        if pts is body or len(pts) >= len(body) * 0.4:
            continue
        xs = [x for x, _ in pts]
        # distância (em px reduzidos) do pedaço até o corpo
        gap = min(min((x - bx) ** 2 + (y - by) ** 2 for bx, by in near) for x, y in pts[::max(1, len(pts) // 20)]) ** 0.5
        at_edge = min(xs) <= 1 or max(xs) >= sw - 2
        if (at_edge and len(pts) < len(body) * 0.1) or gap > sh * 0.12:
            x0, x1 = min(xs) * q, (max(xs) + 1) * q
            y0, y1 = min(y for _, y in pts) * q, (max(y for _, y in pts) + 1) * q
            out.paste((0, 0, 0, 0), (max(0, x0 - q), max(0, y0 - q), min(w, x1 + q), min(h, y1 + q)))
    return crop_opaque(out)


def strip(frames, a, res, n_ref):
    """Tira de quadros do mesmo tamanho, na mesma escala, alinhados pelos pés (ou pelo centro, se voa).
    A escala vem da altura mediana dos `n_ref` primeiros quadros (os de movimento)."""
    # escala única: mantém a diferença de tamanho entre poses (achatar, esticar, cair)
    heights = sorted(f.height for f in frames[:n_ref])
    k = a['h'] * res / heights[len(heights) // 2]
    frames = [premul_resize(f, (max(1, round(f.width * k)), max(1, round(f.height * k)))) for f in frames]
    fly = not a.get('shadow')
    if a.get('shadow'):
        x0, x1 = feet_span(frames[0])
        size = max((x1 - x0) * 1.3, frames[0].width * 0.35)
        frames = [with_shadow(f, size) for f in frames]
    anchors = [(sum(feet_span(f)) / 2 if not fly else f.width / 2) for f in frames]
    left = max(anchors)
    right = max(f.width - c for f, c in zip(frames, anchors))
    cw = int(left + right) + 2
    ch = max(f.height for f in frames)
    out = Image.new('RGBA', (cw * len(frames), ch))
    for i, (f, c) in enumerate(zip(frames, anchors)):
        y = (ch - f.height) // 2 if fly else ch - f.height
        out.alpha_composite(f, (i * cw + round(left - c), y))
    return out


def recolor(im, a):
    """Variante elemental: soma `hue` graus à matiz dos pixels dentro de `range` (e ajusta sat/val)."""
    lo, hi = a['range']
    shift = a['hue'] / 360 * 255
    sat, val = a.get('sat', 1), a.get('val', 1)
    alpha = im.getchannel('A')
    h, s_, v = im.convert('RGB').convert('HSV').split()
    hp, sp, vp = h.load(), s_.load(), v.load()
    for y in range(im.height):
        for x in range(im.width):
            hue = hp[x, y] / 255 * 360
            if lo <= hue <= hi and sp[x, y] > 40:
                hp[x, y] = int(hp[x, y] + shift) % 256
                sp[x, y] = min(255, int(sp[x, y] * sat))
                vp[x, y] = min(255, int(vp[x, y] * val))
    out = Image.merge('HSV', (h, s_, v)).convert('RGBA')
    out.putalpha(alpha)
    return out


def main():
    art = manifest()
    only = sys.argv[1:]
    OUT.mkdir(parents=True, exist_ok=True)
    index = json.loads(INDEX.read_text()) if INDEX.exists() else {}
    for name, a in art.items():
        if only and name not in only:
            continue
        if a.get('variant'):
            base = OUT / f"{a['variant']}.png"
            recolor(Image.open(base).convert('RGBA'), a).save(OUT / f'{name}.png', optimize=True)
            index[name] = dict(index[a['variant']])
            print(name, 'variante de', a['variant'])
            continue
        src = SRC / f'{name}.png'
        if not src.exists():
            print('falta', src)
            continue
        if a.get('tile'):
            ground(src).save(OUT / f'{name}.png', optimize=True)
            index[name] = {'hd': GROUND_HD}
            continue
        hd = a.get('hd', 2)
        sheet = SRC / f'{name}_sheet.png'
        if a.get('role') and sheet.exists():
            plan = a['sheets']
            frames = slice_sheet(sheet, len(plan['move']))
            slots = [p['slot'] for p in plan['move']]
            for i, poses in enumerate(plan['actions']):
                action = SRC / f"{name}_action{i + 1 if i else ''}.png"
                if not action.exists():
                    break
                act = slice_sheet(action, len(poses))
                # o 1º quadro de cada folha de ação repete a 1ª pose de movimento: iguala a escala das folhas
                k = frames[0].height / act[0].height
                frames += [premul_resize(f, (max(1, round(f.width * k)), max(1, round(f.height * k)))) for f in act[1:]]
                slots += [p['slot'] for p in poses[1:]]
            if a.get('flip'):
                frames = [ImageOps.mirror(f) for f in frames]
            img = strip(frames, a, hd, len(plan['move']))
            img.save(OUT / f'{name}.png', optimize=True)
            index[name] = {'hd': hd, 'frames': len(frames), 'slots': slots}
            print(name, img.size, f'hd {hd}', ' '.join(slots))
            variants = [(f'portrait_{name}', a['portrait'])] if 'portrait' in a else []
        else:
            variants = [(name, hd)] + ([(f'portrait_{name}', a['portrait'])] if 'portrait' in a else [])
        if not variants:
            continue
        cut = cut_background(Image.open(src))
        if a.get('flip'):
            cut = ImageOps.mirror(cut)
        if hd == 4 and not name.startswith('hero_'):
            # ícones: caixa quadrada para alinhar nas molduras
            side = max(cut.size)
            sq = Image.new('RGBA', (side, side))
            sq.paste(cut, ((side - cut.width) // 2, (side - cut.height) // 2))
            cut = sq
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
            index[key] = {'hd': res}
            print(key, img.size, f'hd {res}')
    INDEX.write_text(json.dumps(dict(sorted(index.items())), indent=1) + '\n')


main()
