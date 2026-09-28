#!/usr/bin/env python3
"""The house on the base game's hills, the slope that hides its foot, and its chimney smoke.

The hills left of the board were an empty stretch of flat teal ("add small house maybe lodge and
a smoke from it ... cause its empty", user 2026-09-25). The house is design 9524:57297, tucked
into the hills: it stands behind the mid-teal slope that steps down under the dark ridge, so only
its roof and upper walls show ("more cozy and hidden in mountain", user 2026-09-25).

The design draws the house as traced vectors in 13 flat colours; like the logo (build-logo.py)
it is rasterised at size and every pixel snapped to the design's own fills, alpha cut at 50%.

The hills are one flat image, so the slope in front of the house is cut out of it: inside BOX,
every pixel nearer the mid-teal slope's colour than the dark ridge's, below the ridge's crown,
is kept at its own colour and position. Drawn over the house at the same place, it puts the
house's foot behind the hill. BOX and HOUSE are in base-mountains.webp's own pixels (5028x998),
the coordinates the CSS places both by.

Writes, into static/assets/veggie-salad/pixel/background/:

    house.webp        the house, design 9524:57297
    house-front.webp  the slope in front of it, cut from base-mountains.webp at BOX
    lodge-smoke.webp  one grey smoke puff; CSS sends several up and fades them

Run from anywhere:

    python3 apps/veggie-salad/scripts/build-lodge.py
"""
from __future__ import annotations

import io
import re
from pathlib import Path

import cairosvg
import numpy as np
from PIL import Image

APP = Path(__file__).resolve().parents[1]
OUT = APP / 'static/assets/veggie-salad/pixel/background'
SRC = APP / 'scripts/art/house-9524-57297/house.svg'
HILLS = OUT / 'base-mountains.webp'

# The house's box on the hills (x, y, width); height follows the design's aspect.
HOUSE = (575, 515, 260)
# The cut-out of the slope: covers the house's lower half and a margin either side.
BOX = (520, 545, 340, 215)
# Rows above this are the dark ridge's crown and the far hills behind it.
SLOPE_TOP = 545
RIDGE = np.array([8, 80, 72])
SLOPE = np.array([32, 120, 120])
LIGHT = np.array([136, 208, 200])

SMOKE = """
.aaaa.
aaaaab
aaaabb
.abbb.
..bb..
"""
SMOKE_PAL = {'a': (222, 222, 228), 'b': (178, 178, 190)}
SMOKE_SCALE = 8


def house() -> Image.Image:
    svg = SRC.read_text()
    fills = sorted({tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
                    for h in re.findall(r'fill="#([0-9A-Fa-f]{6})"', svg)})
    pal = np.array(fills, float)
    im = Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(), scale=4))).convert('RGBA')
    a = np.array(im).astype(float)
    alpha = a[..., 3:] / 255
    rgb = np.divide(a[..., :3], alpha, out=np.zeros_like(a[..., :3]), where=alpha > 0)
    k = ((rgb[..., None, :] - pal) ** 2).sum(-1).argmin(-1)
    out = np.zeros(a.shape, np.uint8)
    on = a[..., 3] >= 128
    out[on, :3] = pal[k[on]]
    out[on, 3] = 255
    print(f'house: {len(fills)} colours, {im.size}')
    return Image.fromarray(out)


def slope_front() -> Image.Image:
    hills = np.array(Image.open(HILLS).convert('RGBA'))
    x, y, w, h = BOX
    a = hills[y:y + h, x:x + w].copy()
    rgb = a[..., :3].astype(float)
    d = np.stack([((rgb - c) ** 2).sum(-1) for c in (RIDGE, SLOPE, LIGHT)])
    front = (d.argmin(0) != 0) & (a[..., 3] > 0)
    front[: max(0, SLOPE_TOP - y)] = False
    a[~front] = 0
    print(f'slope: {front.mean():.0%} of the {w}x{h} box is in front of the house')
    return Image.fromarray(a)


def smoke() -> Image.Image:
    g = np.array([list(r) for r in SMOKE.strip().splitlines()])
    a = np.zeros((*g.shape, 4), np.uint8)
    for k, rgb in SMOKE_PAL.items():
        a[g == k] = (*rgb, 255)
    im = Image.fromarray(a)
    return im.resize((im.width * SMOKE_SCALE, im.height * SMOKE_SCALE), Image.NEAREST)


def main():
    house().save(OUT / 'house.webp', lossless=True, quality=100, method=6)
    slope_front().save(OUT / 'house-front.webp', lossless=True, quality=100, method=6)
    smoke().save(OUT / 'lodge-smoke.webp', lossless=True, quality=100, method=6)


if __name__ == '__main__':
    main()
