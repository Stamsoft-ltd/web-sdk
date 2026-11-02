#!/usr/bin/env python3
"""The Buy Bonus menu's card art (Figma 11402:9764, 2026-10-30), from the design's image fills in
art-src/buy/ (the get_design_context downloads, untinted, at their source sizes).

Each card's backdrop (its gradient and every layer under its hero) is baked into one WebP at 2x;
the hero (boat, volcano, blob house, candy tree, candy house) is cut out on its own so the page can
move it, and the dark foot gradient over it stays CSS. Positions are the node boxes (outer card
coords, object-fit cover) as get_design_context gives them.

The bonus cards are baked 525 wide with the design's 346 centred in it: landscape shows the middle
346 (background-position center), the portrait column shows all 525.

    python3 apps/split-party/scripts/build-buy-cards.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'art-src' / 'buy'
OUT = ROOT / 'public' / 'buy' / 'v3'  # v3: the 3x set (a new folder busts the cache)
# 3 since 2026-11-02: the menu is zoomed by --k (to ~1.33), so 2x landed at ~0.75 of retina.
S = 3  # output px per design px


def load(name: str) -> Image.Image:
    """The Real-ESRGAN master when there is one (upscale-art.py), else the Figma fill."""
    hd = SRC / '2x' / f'{name}.png'
    return Image.open(hd if hd.exists() else SRC / f'{name}.png').convert('RGBA')


def cover(im: Image.Image, w: float, h: float) -> Image.Image:
    """object-fit: cover into a w×h box (design px), at S."""
    W, H = round(w * S), round(h * S)
    k = max(W / im.width, H / im.height)
    r = im.resize((max(W, round(im.width * k)), max(H, round(im.height * k))), Image.LANCZOS)
    x, y = (r.width - W) // 2, (r.height - H) // 2
    return r.crop((x, y, x + W, y + H))


def paste(canvas: Image.Image, im: Image.Image, x: float, y: float, alpha: float = 1.0, clip=None):
    """Draws im (already at S) at design (x, y); clip = (x0, y0, x1, y1) design px it can't leave."""
    if alpha < 1:
        a = im.getchannel('A').point(lambda v: round(v * alpha))
        im = im.copy()
        im.putalpha(a)
    layer = Image.new('RGBA', canvas.size)
    layer.paste(im, (round(x * S), round(y * S)))
    if clip:
        m = Image.new('L', canvas.size, 0)
        ImageDraw.Draw(m).rectangle([round(c * S) for c in clip], fill=255)
        layer.putalpha(Image.composite(layer.getchannel('A'), Image.new('L', canvas.size, 0), m))
    canvas.alpha_composite(layer)


def vgradient(w: float, h: float, stops: list[tuple[float, str]]) -> Image.Image:
    W, H = round(w * S), round(h * S)
    col = Image.new('RGBA', (1, H))
    rgb = [(p, tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))) for p, c in stops]
    for y in range(H):
        t = y / max(1, H - 1)
        if t <= rgb[0][0]:
            c = rgb[0][1]
        elif t >= rgb[-1][0]:
            c = rgb[-1][1]
        else:
            for (p0, c0), (p1, c1) in zip(rgb, rgb[1:]):
                if p0 <= t <= p1:
                    f = (t - p0) / (p1 - p0)
                    c = tuple(round(a + (b - a) * f) for a, b in zip(c0, c1))
                    break
        col.putpixel((0, y), (*c, 255))
    return col.resize((W, H))


def fade_left(w: float, h: float, color: str, solid: float, clear: float) -> Image.Image:
    """Tailwind bg-gradient-to-l: `color` from the right edge to `solid` of the width, transparent
    by `clear`."""
    W, H = round(w * S), round(h * S)
    rgb = tuple(int(color[i:i + 2], 16) for i in (1, 3, 5))
    row = Image.new('RGBA', (W, 1))
    for x in range(W):
        p = 1 - x / max(1, W - 1)  # 0 at the right edge
        a = 1 if p <= solid else 0 if p >= clear else 1 - (p - solid) / (clear - solid)
        row.putpixel((x, 0), (*rgb, round(255 * a)))
    return row.resize((W, H))


def save(im: Image.Image, name: str, alpha=True):
    path = OUT / f'{name}.webp'
    (im if alpha else im.convert('RGB')).save(path, 'WEBP', quality=90, alpha_quality=100, method=6)
    print(f'{path.relative_to(ROOT)}: {im.width}x{im.height}, {path.stat().st_size // 1024} KB')


OUT.mkdir(parents=True, exist_ok=True)
SKY = [(0, '#34a9fd'), (1, '#67d4fd')]


# Extra Chance (11402:9988) and Feature Spin (11402:10004): 525×166.
def wide(panorama_at, fade_at):
    c = vgradient(525, 166, SKY)
    paste(c, cover(load('hills'), 527, 295), 0, -76)
    pan = load('panorama').resize((round(545 * 1.1869 * S), 215 * S), Image.LANCZOS)
    x, y = panorama_at
    paste(c, pan, x, y, clip=(x, y, x + 545, y + 215))
    return c


extra = wide((-14, -50), None)
water = load('water').resize((525 * S, round(66 * 2.6525 * S)), Image.LANCZOS)
paste(extra, water, 0, 79 - 66 * 0.8625, clip=(0, 79, 525, 145))
paste(extra, fade_left(309, 165, '#3fb2fc', 0.55357, 0.87572), 216, 1)
save(extra, 'extra', alpha=False)
save(cover(load('boat'), 55, 47), 'boat')

feature = wide((-15, -32), None)
paste(feature, fade_left(449, 165, '#3fb2fc', 0.55357, 0.87572), 76, 1)
save(feature, 'feature', alpha=False)
save(cover(load('volcano'), 169, 169), 'volcano')

# The bonus cards: 346×326 each, baked 525 wide (design card at OX).
BW, OX = 525, (525 - 346) / 2
DUSK = [(0, '#985efb'), (0.30496, '#ce5cf3'), (0.58238, '#fc68cb'), (0.73992, '#fd80b3'), (1, '#fd979b')]
SUNSET = [(0, '#985efb'), (0.046781, '#ce5cf3'), (0.14028, '#fc68cb'), (0.24804, '#fda895'), (0.33044, '#fdcd80')]


def clouds(c):
    cl = load('cloud')
    paste(c, cover(cl, 156, 52), OX + 150, 9, alpha=0.6)
    paste(c, cover(cl, 102, 34), OX + 8, 35, alpha=0.6)


normal = vgradient(BW, 326, DUSK)
clouds(normal)
paste(normal, cover(load('dunes-normal'), 1045, 349), OX - 266, 0)
save(normal, 'normal', alpha=False)
save(cover(load('house'), 148, 152), 'house')

sup = vgradient(BW, 326, SUNSET)
clouds(sup)
paste(sup, cover(load('dunes-super'), 1133, 379), OX - 371, 2)
save(sup, 'super', alpha=False)
save(cover(load('tree'), 285, 312), 'tree')

mystery = vgradient(BW, 326, SUNSET)
paste(mystery, cover(load('arches'), 522, 295), OX + 0, -25)
save(mystery, 'mystery', alpha=False)
save(cover(load('candy-house'), 222, 192), 'candy-house')

# Chip icons (Component 34's 18×18 blob wearing its flower; Component 33's egg), at 4x.
K = 4
icon = Image.new('RGBA', (18 * K, 18 * K))
blob = load('chip-blob')
bw = 18 * 1.087 * K
# (alpha_composite can't take a negative offset: the blob's box overhangs the icon's left.)
layer = Image.new('RGBA', icon.size)
layer.paste(blob.resize((round(bw), round(bw * 1166 / 1349)), Image.LANCZOS), (round(-0.783 * K), round(1.1 * K)))
icon.alpha_composite(layer)
fw = 18 * (1 - 0.2029 - 0.2174) * K
icon.alpha_composite(load('chip-flower').resize((round(fw), round(fw / 1.5)), Image.LANCZOS), (round(18 * 0.2029 * K), round(0.28 * K)))
save(icon, 'chip-blob')
save(load('egg').resize((16 * K, 16 * K), Image.LANCZOS), 'chip-egg')
