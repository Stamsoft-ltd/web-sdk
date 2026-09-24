#!/usr/bin/env python3
"""The board's symbols, from the splash's newer vegetable set.

Design 9451:148386 ("Menu") fills the base-game board with the same seven drawings the splash
plants either side of it (build-splash-crop.py): garlic, pepper, eggplant, tomato, potato, cabbage
and radish. So the board's copies are cut from the same sources, through the same eye finder, and
each gets the glance and blink frames symbolLiveness.ts plays at rest.

Tomato, pepper and cabbage are not cut here any more: the board draws the design's premium
versions of them (sunglasses, scripts/build-board-premium.py).

Every sprite sits on one square canvas that stands for the design's cell height (the tablo's pads
are 86x69 units; the game's cells are square, so height is the dimension that carries over), so the
page draws every symbol in the same box and needs no per-symbol sizes.

The board shares ONE pixel size. The scatter king (onion.webp) is drawn on an 89-pixel grid across
the cell; every vegetable pixel is exactly three of his (UNIT canvas px on an 89 x 3 canvas), and
each sprite lands on his grid. The drawings were made at different resolutions (20 to 27 pixels
tall), so one pixel size means their sizes can no longer all be the design's: each keeps its own
pixel count, and the design's size (PLACEMENT, measured off the tablo render) now only decides the
offset. Sizes move by up to about 15% (the script prints each one against the design).

Two drawings break the rule on purpose. Potato and garlic were drawn with the most pixels, so at
the shared size they read 127% and 118% of the median symbol's area ("i think this one is bigger
than others?", user 2026-09-24). Coarsening them lost their shape (potato turned squat at 22
pixels; garlic's vector source always fits its own 24x26 grid), so they draw at UNIT_OF instead —
pixels 11% smaller than the rest, which is not visible at cell size, and areas back to 100%/93%.

Writes, into static/assets/veggie-salad/pixel/board/:

    <name>.webp  <name>-look-l.webp  <name>-look-r.webp  <name>-blink.webp

Run from anywhere:

    python3 apps/veggie-salad/scripts/build-board-crop.py
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

from PIL import Image

APP = Path(__file__).resolve().parents[1]
OUT = APP / 'static/assets/veggie-salad/pixel/board'
KING_GRID = 89
UNIT = 9
UNIT_OF = {'potato': 8, 'garlic': 8}
CANVAS = KING_GRID * UNIT // 3
PAD_H = 69.27
# Visible art in the design's pad, in design units: longest side, then the centre's offset from
# the pad's centre (x right, y down). Measured off the 9451:148598 tablo render.
PLACEMENT = {
    'garlic': (53, 0.0, 0.4),
    'eggplant': (58, 0.5, 0.9),
    'potato': (54, -0.5, -0.1),
    'radish': (61, -0.5, 0.4),
}


def crop_module():
    spec = importlib.util.spec_from_file_location('crop', APP / 'scripts/build-splash-crop.py')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main():
    crop = crop_module()
    OUT.mkdir(parents=True, exist_ok=True)
    k = CANVAS / PAD_H
    for name, (longest, dx, dy) in PLACEMENT.items():
        frames, info = crop.frames(name, UNIT_OF.get(name, UNIT))
        art = frames['']
        # Top-left on the king's grid (UNIT / 3 canvas px).
        snap = UNIT // 3
        x = round(((CANVAS - art.width) / 2 + dx * k) / snap) * snap
        y = round(((CANVAS - art.height) / 2 + dy * k) / snap) * snap
        for key, frame in frames.items():
            canvas = Image.new('RGBA', (CANVAS, CANVAS))
            canvas.paste(frame, (x, y))
            canvas.save(OUT / f'{name}{key}.webp', lossless=True, quality=100, method=6)
        print(f'{info}  size {max(art.size) / (longest * k):.0%} of design')


if __name__ == '__main__':
    main()
