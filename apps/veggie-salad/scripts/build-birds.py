#!/usr/bin/env python3
"""The base game's background birds: a small pixel gull seen from behind, four flap frames.

Drawn cell by cell ("add some bird flying in the background ... small", user 2026-09-25), so the
silhouette sits on whole pixels like the rest of the scene; symmetric, so a bird flying either way
needs no mirrored copy. Frames run up, level, down, level and loop with steps(4) in CSS.

Writes, into static/assets/veggie-salad/pixel/background/:

    bird.webp          the gull: 4 frames of 11x5 cells, symmetric (seen from behind)
    bird-sparrow.webp  a sparrow in profile, facing right: 4 frames of 12x7 cells ("or different
                       birds", user 2026-09-25); flipped in code when it flies left

Run from anywhere:

    python3 apps/veggie-salad/scripts/build-birds.py
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

APP = Path(__file__).resolve().parents[1]
OUT = APP / 'static/assets/veggie-salad/pixel/background/bird.webp'
SCALE = 4
# Wing and body: the dark slate of the mountains' shadow side, the body a shade deeper, so the
# silhouette reads against the blue sky and the white clouds alike.
WING = (42, 59, 77)
BODY = (27, 39, 51)

UP = """
#.........#
##.......##
.##.....##.
..##.b.##..
....bbb....
"""
LEVEL = """
...........
...........
####bbb####
.....b.....
...........
"""
DOWN = """
...........
....bbb....
..##.b.##..
.##.....##.
##.......##
"""


# The sparrow: brown back, cream belly, dark wing, orange beak, black eye; facing right.
SPARROW = {
    'b': (143, 92, 52),
    'c': (236, 214, 168),
    'w': (92, 56, 30),
    'o': (247, 150, 12),
    'e': (20, 12, 6),
}
SPARROW_UP = """
....ww......
....www.....
.....www....
...bbbbbbb..
bbbbbbbbbeb.
..cccccbbbbo
...cccc.....
"""
SPARROW_LEVEL = """
............
............
............
..wwwbbbbb..
bbbbwwwbbeb.
..cccccbbbbo
...cccc.....
"""
SPARROW_DOWN = """
............
............
............
...bbbbbbb..
bbbbbbbbbeb.
..cwwwcbbbbo
...www......
"""


def paint(cells: str, palette: dict) -> np.ndarray:
    rows = cells.strip().splitlines()
    a = np.zeros((len(rows), len(rows[0]), 4), np.uint8)
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            if c in palette:
                a[y, x] = (*palette[c], 255)
    return a


def frame(cells: str) -> np.ndarray:
    rows = cells.strip().splitlines()
    a = np.zeros((len(rows), len(rows[0]), 4), np.uint8)
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            if c == '#':
                a[y, x] = (*WING, 255)
            elif c == 'b':
                a[y, x] = (*BODY, 255)
    return a


def main():
    strip = np.concatenate([frame(f) for f in (UP, LEVEL, DOWN, LEVEL)], axis=1)
    im = Image.fromarray(strip)
    im = im.resize((im.width * SCALE, im.height * SCALE), Image.NEAREST)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    im.save(OUT, lossless=True, quality=100, method=6)
    print(f'bird strip {strip.shape[1]}x{strip.shape[0]} cells -> {im.size} {OUT.name}')
    frames = [paint(f, SPARROW) for f in (SPARROW_UP, SPARROW_LEVEL, SPARROW_DOWN, SPARROW_LEVEL)]
    strip = np.concatenate(frames, axis=1)
    im = Image.fromarray(strip)
    im = im.resize((im.width * SCALE, im.height * SCALE), Image.NEAREST)
    out = OUT.with_name('bird-sparrow.webp')
    im.save(out, lossless=True, quality=100, method=6)
    print(f'sparrow strip {strip.shape[1]}x{strip.shape[0]} cells -> {im.size} {out.name}')


if __name__ == '__main__':
    main()
