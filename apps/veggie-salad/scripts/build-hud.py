#!/usr/bin/env python3
"""The bottom bar's furniture, from design 9456:158078 (the HUD strip, "Group 123").

The design draws every control as pixel art: each small button is a 49-unit frame of stepped
vectors (dark fill, orange keyline, notched corners), BONUS is a 126x54 stepped orange plate with a
highlight, and the spin button is a stepped orange coin under a separate glowing arrow. The icons
inside are uploaded rasters. The page had been approximating all of it in CSS — square boxes, a
flat rectangle, a smooth disc — which is what "this is not fixed" (user, 2026-09-24) pointed at.

Sources in scripts/art/hud-9456-158078/: the three SVG exports (each carries the page's #F5F5F5
backdrop rect, and the button/spin exports embed their icon; both are stripped here so the frame
and the icon stay separate layers) and the icon rasters (the design's transparent originals).

Writes, into static/assets/veggie-salad/pixel/hud/:

    frame.webp  frame-pressed.webp  bonus.webp  spin-coin.webp  spin-arrow.webp
    icon-menu.webp  icon-minus.webp  icon-plus.webp  icon-auto.webp
    icon-turbo.webp  icon-turbo-on.webp  icon-turbo-max.webp

The glyphs are pixel art on a shared grid (review 2026-09-25, "inconsistent style": the design's
icon rasters are smooth, anti-aliased vector drawings, and next to the stepped frames and coin they
were the softest things on screen, spin arrow 0.85 on the softness scan). Each one is either
re-rasterised onto whole cells — area coverage, then a hard 50% cut — or, where a thin ring would
break up at this size (spin, auto), drawn cell by cell below. Every glyph cell is ~3.6% of its
button, against the frame's ~4.2% and the coin's ~4.5%.

Run from anywhere:

    python3 apps/veggie-salad/scripts/build-hud.py
"""
from __future__ import annotations

import io
import re
from pathlib import Path

import cairosvg
import numpy as np
from PIL import Image

APP = Path(__file__).resolve().parents[1]
ART = APP / 'scripts/art/hud-9456-158078'
OUT = APP / 'static/assets/veggie-salad/pixel/hud'
SCALE = 4
# The design's gold for an engaged control (the BONUS plate's face).
GOLD = (247, 150, 12)


def vector(name: str) -> Image.Image:
    svg = (ART / name).read_text()
    # The export's page backdrop, and any rect filled from an embedded image (the icon).
    svg = re.sub(r'<rect width="[\d.]+" height="[\d.]+" fill="#F5F5F5"/>', '', svg, count=1)
    svg = re.sub(r'<rect [^>]*fill="url\(#pattern[^"]*\)"[^>]*/>', '', svg)
    png = cairosvg.svg2png(bytestring=svg.encode(), scale=SCALE)
    return Image.open(io.BytesIO(png)).convert('RGBA')


# Clockwise, open on the right with the head on the top end — the design's arrow at 16 cells.
SPIN_ARROW = """
.....######.......
...##########.....
..####....####....
.###........###...
.##..........##...
###..........##...
##.........######.
##..........####..
##...........##...
##................
###...............
.##...............
.###..............
..####....####....
...##########.....
.....######.......
"""
# Two arrows chasing round a ring, the design's autoplay glyph at 12 cells.
AUTO = """
....####....
..###..###.#
.##......###
.#......####
##..........
##..........
..........##
..........##
####......#.
###......##.
#.###..###..
....####....
"""
# Bars of two cells on one-cell gaps; the plus is the minus crossed, both on an even grid so a
# two-cell bar can sit dead centre.
MENU = """
##########
##########
..........
##########
##########
..........
##########
##########
"""
MINUS = """
########
########
"""
PLUS = """
...##...
...##...
...##...
########
########
...##...
...##...
...##...
"""
# The design's arrow colour (its lilac-white face) and the coin's shadow brown, which the page
# drew as a blurred CSS glow; here it is one cell under the stroke.
ARROW = (253, 229, 252)
ARROW_SHADOW = (152, 94, 0)


def drawn(cells: str, colour, scale: int, shadow=None) -> Image.Image:
    m = np.array([[c == '#' for c in row] for row in cells.strip().splitlines()])
    h, w = m.shape
    a = np.zeros((h + (1 if shadow else 0), w, 4), np.uint8)
    if shadow:
        a[1:][m, :3] = shadow
        a[1:][m, 3] = 255
    a[:h][m, :3] = colour
    a[:h][m, 3] = 255
    im = Image.fromarray(a)
    return im.resize((im.width * scale, im.height * scale), Image.NEAREST)


def pixel_icon(name: str, cells: int, scale: int) -> Image.Image:
    """The design raster on a grid `cells` high: each cell's coverage (premultiplied, so the
    anti-aliased rim does not tint it) cut hard at 50%, then NEAREST-upscaled."""
    im = Image.open(ART / name).convert('RGBA')
    im = im.crop(im.getbbox())
    a = np.array(im).astype(np.float32)
    alpha = a[..., 3:] / 255
    pm = np.concatenate([a[..., :3] * alpha, alpha * 255], axis=-1)
    w = max(1, round(im.width * cells / im.height))
    small = np.stack(
        [np.array(Image.fromarray(pm[..., i]).resize((w, cells), Image.BOX)) for i in range(4)],
        axis=-1,
    )
    cover = small[..., 3] / 255
    out = np.zeros((cells, w, 4), np.uint8)
    on = cover >= 0.5
    out[on, :3] = np.clip(small[on, :3] / cover[on, None], 0, 255).round()
    out[on, 3] = 255
    im = Image.fromarray(out)
    return im.resize((w * scale, cells * scale), Image.NEAREST)


def tinted(im: Image.Image, colour) -> Image.Image:
    a = np.array(im)
    a[..., :3] = colour
    return Image.fromarray(a)


def save(name: str, im: Image.Image) -> None:
    im.save(OUT / f'{name}.webp', lossless=True, quality=100, method=6)
    print(f'{name:18} {im.size}')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    frame = vector('button-9456-156724.svg')
    save('frame', frame)
    # Pressed: the design has no pressed frame, so the fill warms toward the keyline's orange.
    a = np.array(frame).astype(int)
    fill = (np.abs(a[..., :3] - [56, 31, 2]).max(axis=2) < 12) & (a[..., 3] > 200)
    a[fill, :3] = [104, 60, 6]
    save('frame-pressed', Image.fromarray(a.astype('uint8')))
    save('bonus', vector('bonus-9456-156634.svg'))
    save('spin-coin', vector('spin-9456-155006.svg'))
    save('spin-arrow', drawn(SPIN_ARROW, ARROW, 20, ARROW_SHADOW))

    save('icon-menu', drawn(MENU, (255, 255, 255), 6))
    save('icon-auto', drawn(AUTO, (255, 255, 255), 4))
    cell = 7
    bolt = pixel_icon('icon-turbo.png', 14, cell)
    save('icon-turbo', bolt)
    save('icon-turbo-on', tinted(bolt, GOLD))
    # The second bolt 0.7 of a bolt along, in whole cells so both sit on one grid.
    pair = Image.new('RGBA', (bolt.width + round(bolt.width * 0.7 / cell) * cell, bolt.height))
    pair.alpha_composite(tinted(bolt, GOLD), (0, 0))
    pair.alpha_composite(tinted(bolt, GOLD), (pair.width - bolt.width, 0))
    save('icon-turbo-max', pair)
    save('icon-minus', drawn(MINUS, (255, 255, 255), 7))
    save('icon-plus', drawn(PLUS, (255, 255, 255), 7))


if __name__ == '__main__':
    main()
