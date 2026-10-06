#!/usr/bin/env python3
"""
special-pot-v2 → special-pot-v3: the free-games soup pot with its three PAINTED bubbles (domes + their
ripple rings) removed from the surface, so the soup can boil live (SpecialMascot drawBubbles): painted
domes never pop, and next to live bubbles that swell and burst they read as frozen.

Each bubble region is refilled row by row, interpolating between the clean pixels just left and right
of it — the surface is horizontal bands (pot wall → olive back edge → soup), so that rebuilds the back
edge behind the tallest dome too. A sample that isn't soup or wall (the spoon beside the right-hand
bubble) is replaced by the other side's. Run with --preview DIR for a before/after crop.

    python3 scripts/build-special-pot.py [--preview DIR]
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'static/assets/mcschmutzo')
SRC = 'special-pot-v2.webp'
OUT = 'special-pot-v3.webp'
VBLEND = 5  # rows

# (cx, cy, rx, ry) ellipses covering each painted bubble: its dome and its ripple rings (texture px)
BUBBLES = [
    [(375, 270, 64, 40), (374, 293, 90, 25)],  # big dome, left
    [(587, 248, 50, 32), (589, 268, 70, 23)],  # back dome, touching the back edge
    [(626, 309, 46, 31), (626, 325, 60, 17)],  # front dome by the spoon
]


def is_spoon(px):
    r, g, b = px[:3]
    return r > g + 25 or r + g + b < 200  # brown wood or its dark outline; soup is green, the wall grey


def build():
    im = Image.open(os.path.join(ROOT, SRC)).convert('RGBA')
    a = np.array(im).astype(float)
    w, h = im.size
    m = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(m)
    for shapes in BUBBLES:
        for cx, cy, rx, ry in shapes:
            d.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=255)
    hard = np.array(m) > 127
    out = a.copy()
    for y in range(h):
        xs = np.nonzero(hard[y])[0]
        if not len(xs):
            continue
        # contiguous runs in this row
        runs = np.split(xs, np.nonzero(np.diff(xs) > 1)[0] + 1)
        for run in runs:
            x0, x1 = run[0] - 3, run[-1] + 3
            # the median of a few px just outside: one dark ring pixel or speck can't streak the row
            L = np.median(a[y, max(0, x0 - 5) : x0 + 1], axis=0)
            R = np.median(a[y, x1 : min(w, x1 + 6)], axis=0)
            if is_spoon(R):
                R = L
            if is_spoon(L):
                L = R
            u = (np.arange(x0 + 1, x1) - x0) / (x1 - x0)
            out[y, x0 + 1 : x1] = L[None, :] * (1 - u[:, None]) + R[None, :] * u[:, None]
    # a short VERTICAL blend inside the fill only (rows → each other), so neighbouring rows' samples
    # agree; horizontal structure — the back edge — stays sharp
    k = np.ones(VBLEND) / VBLEND
    sm = np.apply_along_axis(lambda col: np.convolve(col, k, mode='same'), 0, out)
    out[hard] = sm[hard]
    soft = np.array(m.filter(ImageFilter.GaussianBlur(1.0))).astype(float)[..., None] / 255
    out = a * (1 - soft) + out * soft
    res = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
    res.save(os.path.join(ROOT, OUT), quality=92, method=6)
    print('wrote', OUT, res.size)
    return im, res


def preview(out_dir, before, after):
    box = (160, 200, 900, 360)
    bg = (60, 60, 90, 255)
    tiles = []
    for img in (before, after):
        c = Image.new('RGBA', img.size, bg)
        c.alpha_composite(img)
        c = c.crop(box)
        tiles.append(c.resize((c.width * 2, c.height * 2)))
    sheet = Image.new('RGBA', (tiles[0].width, tiles[0].height * 2))
    sheet.paste(tiles[0], (0, 0))
    sheet.paste(tiles[1], (0, tiles[0].height))
    p = os.path.join(out_dir, 'special-pot-v3.png')
    sheet.save(p)
    print('preview', p)


if __name__ == '__main__':
    built = build()
    if '--preview' in sys.argv:
        preview(sys.argv[sys.argv.index('--preview') + 1], *built)
