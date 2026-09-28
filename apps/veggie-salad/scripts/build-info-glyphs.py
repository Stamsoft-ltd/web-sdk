#!/usr/bin/env python3
"""The info panel's glyphs as pixel art, in the design's cream (#F2CB8C).

The panel drew its controls with the design's vector exports (ui_glyph_*.svg, nav_arrow.svg) and a
Poppins "x" for close: smooth curves next to pixel frames and a pixel HUD, the "inconsistent
style" the review scores kept pointing at (2026-09-25). The glyphs the HUD also shows (menu, auto,
turbo, bet +/-) are the HUD's own cells from build-hud.py, recoloured, so the UI guide draws exactly
what is on the bar; the rest are drawn here on grids of the same size, strokes two cells wide.

Writes, into static/assets/veggie-salad/pixel/info/px/:

    arrow  arrow-next  close  info  sound  music  menu  auto  turbo  plus  minus

(arrow-next is the arrow mirrored in the file, for the UI guide card, which has no CSS hook.)

Run from anywhere:

    python3 apps/veggie-salad/scripts/build-info-glyphs.py
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

import numpy as np
from PIL import Image

APP = Path(__file__).resolve().parents[1]
OUT = APP / 'static/assets/veggie-salad/pixel/info/px'
CREAM = (242, 203, 140)
SCALE = 6

# Pointing left; NEXT mirrors it in CSS.
ARROW = """
....##......
...##.......
..##........
.##.........
############
############
.##.........
..##........
...##.......
....##......
"""
CLOSE = """
##......##
###....###
.###..###.
..######..
...####...
...####...
..######..
.###..###.
###....###
##......##
"""
INFO = """
..##..
..##..
......
####..
..##..
..##..
..##..
..##..
..##..
######
"""
SOUND = """
.....##.......
....###....#..
...####..#..#.
..#####...#..#
#######...#..#
#######...#..#
#######...#..#
#######...#..#
..#####...#..#
...####..#..#.
....###....#..
.....##.......
"""
MUSIC = """
....########
....########
....##....##
....##....##
....##....##
....##....##
....##....##
..####..####
.#####.#####
#####.#####.
.###...###..
"""


def hud_module():
    spec = importlib.util.spec_from_file_location('hud', APP / 'scripts/build-hud.py')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def cells(bitmap: str) -> np.ndarray:
    return np.array([[c == '#' for c in row] for row in bitmap.strip().splitlines()])


def render(mask: np.ndarray) -> Image.Image:
    a = np.zeros((*mask.shape, 4), np.uint8)
    a[mask, :3] = CREAM
    a[mask, 3] = 255
    im = Image.fromarray(a)
    return im.resize((im.width * SCALE, im.height * SCALE), Image.NEAREST)


def main():
    hud = hud_module()
    OUT.mkdir(parents=True, exist_ok=True)
    # The turbo bolt is the one HUD glyph re-rasterised rather than drawn: the same raster at
    # scale 1 is its cells.
    bolt = np.array(hud.pixel_icon('icon-turbo.png', 14, 1))[..., 3] > 0
    glyphs = {
        'arrow': cells(ARROW),
        'arrow-next': cells(ARROW)[:, ::-1],
        'close': cells(CLOSE),
        'info': cells(INFO),
        'sound': cells(SOUND),
        'music': cells(MUSIC),
        'menu': cells(hud.MENU),
        'auto': cells(hud.AUTO),
        'turbo': bolt,
        'plus': cells(hud.PLUS),
        'minus': cells(hud.MINUS),
    }
    for name, mask in glyphs.items():
        im = render(mask)
        im.save(OUT / f'{name}.webp', lossless=True, quality=100, method=6)
        print(f'{name:6} {mask.shape[1]}x{mask.shape[0]} cells -> {im.size}')


if __name__ == '__main__':
    main()
