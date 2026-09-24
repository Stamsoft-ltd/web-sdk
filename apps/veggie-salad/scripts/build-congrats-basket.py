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


def main():
    bed = clean_bed()
    frame = Image.new('RGBA', FRAME)
    frame.alpha_composite(bed, BED_AT)
    for name, cx, foot in VEG:
        art = Image.open(PIXEL / f'board/{name}.webp').convert('RGBA')
        art = art.crop(art.getbbox())
        art = art.resize((round(art.width * VEG_SCALE), round(art.height * VEG_SCALE)), Image.NEAREST)
        frame.alpha_composite(art, (round(cx - art.width / 2), foot - art.height))
    frame.alpha_composite(Image.open(SOURCES / 'crate.webp').convert('RGBA'), CRATE_AT)
    still = frame.crop((BED_AT[0], BED_AT[1], BED_AT[0] + 1161, BED_AT[1] + 463))
    still.save(OUT / 'basket-v2.webp', lossless=True, quality=100, method=6)
    print('basket-v2.webp', (OUT / 'basket-v2.webp').stat().st_size // 1024, 'K')


if __name__ == '__main__':
    main()
