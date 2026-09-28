#!/usr/bin/env python3
"""The info panel's basket still, refilled with the board's vegetables.

The overview page shows the old outro basket (design 9044:16622 before its 2026-09-24 update)
as one still. Its vegetables were the OLD set (broccoli, corn, carrot, cauliflower…), so this
recomposes it from the old cut's leafy bed and crate with the board's own sprites (board/*.webp)
in their place. The bonus outro itself no longer has a basket: the updated design perches five
vegetables on the sign (PixelEventOverlay.svelte BASKET_VEG).

The bed's old fill under each vegetable was flat horizontal smears the old vegetables covered
exactly; the new ones have other shapes, so smears (flat runs > 30px) and everything not
leaf-green are dropped and only large leaf clusters (and their dark outline) are kept.

Sources (the old cut) live in scripts/art/congrats-sources/, outside static/, whose every image
the loader preloads. Writes static/.../overlays/v2/congrats/basket-v2.webp.

Kept on the pixel grid (review 2026-09-25, softness 0.23): the bed and crate are the old cut's soft
raster, so each is palette-snapped on its own (build-crisp-art.snap — one shared palette dropped
the veggies' small colours); the plain board sprites are taken down to their native cells and back
up by one unit less (9 -> 8, garlic 8 -> 7, ~0.87x) instead of a 0.85 NEAREST that made their
cells 7 and 8 pixels wide at random. The premium -shades sprites are a vector render with a baked
glow, on no grid, so they keep the 0.85 scale — they look as they do on the board.

Run from anywhere:

    python3 apps/veggie-salad/scripts/build-congrats-basket.py
"""
from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

APP = Path(__file__).resolve().parents[1]
PIXEL = APP / 'static/assets/veggie-salad/pixel'
OUT = PIXEL / 'overlays/v2/congrats'
SOURCES = APP / 'scripts/art/congrats-sources'
BED_SRC = SOURCES / 'bed.webp'
FRAME = (1234, 522)
BED_AT = (40, 15)
CRATE_AT = (40 + 76, 15 + 322)
VEG_SCALE = 0.85
# Board pixel size per sprite (build-board-crop.py UNIT / UNIT_OF); -shades are off-grid.
UNIT = 9
UNIT_OF = {'garlic': 8}
# Back to front: board sprite, centre x, foot y.
VEG = [
    ('eggplant', 470, 290),
    ('radish', 700, 300),
    ('pepper-shades', 860, 318),
    ('tomato-shades', 315, 368),
    ('garlic', 565, 362),
    ('cabbage-shades', 1000, 382),
]


def grow(mask: np.ndarray, n: int) -> np.ndarray:
    img = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * n + 1))
    return np.array(img) > 0


def components(mask: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    h, w = mask.shape
    lab = np.zeros((h, w), int)
    sizes = [0]
    for y0 in range(h):
        for x0 in range(w):
            if not mask[y0, x0] or lab[y0, x0]:
                continue
            n = len(sizes)
            lab[y0, x0] = n
            queue, size = deque([(y0, x0)]), 0
            while queue:
                y, x = queue.popleft()
                size += 1
                for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not lab[ny, nx]:
                        lab[ny, nx] = n
                        queue.append((ny, nx))
            sizes.append(size)
    return lab, np.array(sizes)


def clean_bed() -> Image.Image:
    a = np.array(Image.open(BED_SRC).convert('RGBA')).astype(int)
    r, g, b, alpha = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    green = (g > r + 8) & (g > b) & (alpha > 0)
    key = r << 16 | g << 8 | b
    flat = np.zeros_like(green)
    for y in range(key.shape[0]):
        x = 0
        while x < key.shape[1]:
            x2 = x
            while x2 < key.shape[1] and key[y, x2] == key[y, x]:
                x2 += 1
            if x2 - x > 30:
                flat[y, x:x2] = True
            x = x2
    lab, sizes = components(green & ~grow(flat, 1))
    keep = (sizes[lab] > 2500) & (lab > 0)
    keep |= (a[..., :3].max(axis=2) < 60) & (alpha > 0) & grow(keep, 3)
    a[~keep, 3] = 0
    return Image.fromarray(a.astype(np.uint8))


def crisp_module():
    import importlib.util

    spec = importlib.util.spec_from_file_location('crisp', APP / 'scripts/build-crisp-art.py')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def snapped(crisp, im: Image.Image) -> Image.Image:
    a = np.array(im.convert('RGBA'))
    return Image.fromarray(crisp.snap(a, crisp.palette(a)))


def veggie(name: str) -> Image.Image:
    art = Image.open(PIXEL / f'board/{name}.webp').convert('RGBA')
    if name.endswith('-shades'):
        art = art.crop(art.getbbox())
        return art.resize((round(art.width * VEG_SCALE), round(art.height * VEG_SCALE)), Image.NEAREST)
    # The crop sprites sit on their grid from the canvas origin; crop to whole cells first.
    unit = UNIT_OF.get(name, UNIT)
    x0, y0, x1, y1 = art.getbbox()
    x0, y0 = x0 // unit * unit, y0 // unit * unit
    x1, y1 = -(-x1 // unit) * unit, -(-y1 // unit) * unit
    cells = art.crop((x0, y0, x1, y1)).resize(((x1 - x0) // unit, (y1 - y0) // unit), Image.NEAREST)
    return cells.resize((cells.width * (unit - 1), cells.height * (unit - 1)), Image.NEAREST)


def main():
    crisp = crisp_module()
    bed = snapped(crisp, clean_bed())
    frame = Image.new('RGBA', FRAME)
    frame.alpha_composite(bed, BED_AT)
    for name, cx, foot in VEG:
        art = veggie(name)
        frame.alpha_composite(art, (round(cx - art.width / 2), foot - art.height))
    frame.alpha_composite(snapped(crisp, Image.open(SOURCES / 'crate.webp')), CRATE_AT)
    still = frame.crop((BED_AT[0], BED_AT[1], BED_AT[0] + 1161, BED_AT[1] + 463))
    still.save(OUT / 'basket-v2.webp', lossless=True, quality=100, method=6)
    print('basket-v2.webp', (OUT / 'basket-v2.webp').stat().st_size // 1024, 'K')


if __name__ == '__main__':
    main()
