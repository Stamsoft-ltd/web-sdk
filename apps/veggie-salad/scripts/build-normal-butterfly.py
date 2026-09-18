#!/usr/bin/env python3
"""Layers for the NORMAL bonus butterfly (Figma node 9363:59335).

One traced vector in the design; five layers here so the CSS can flap the wings, wiggle the
antennae and bob the body independently. All on one shared canvas (`inset: 0` in the component,
transform-origins carry the geometry):

    background/bonus-normal/butterfly/body.webp       head and abdomen, drawn on top
    background/bonus-normal/butterfly/wing-l.webp     left wings, both of them
    background/bonus-normal/butterfly/wing-r.webp     right wings
    background/bonus-normal/butterfly/antenna-l.webp  left stalk and ball
    background/bonus-normal/butterfly/antenna-r.webp  right stalk and ball

The body stacks above the wings and the antennae, which is what makes the split forgiving: a
flapping wing squashes towards the body's centre line and disappears under the head, and an
antenna's pivot sits under the head's outline, so neither seam is ever visible. Masks are
hand-placed polygons on the 8x render (the tracing wobbles, it is not on a clean grid).
Run from anywhere:

    python3 apps/veggie-salad/scripts/build-normal-butterfly.py
"""
from __future__ import annotations

from io import BytesIO
from pathlib import Path

import cairosvg
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
SRC = HERE / 'art/butterfly-9363-59335.svg'
OUT = HERE.parents[0] / 'static/assets/veggie-salad/pixel/background/bonus-normal/butterfly'

SCALE = 8  # the SVG is 113px; masks below are in 8x coordinates
CROP = (40, 100, 864, 810)
OUT_SIZE = (412, 355)  # CROP at 4x of the design — it renders at ~100px

BODY = [(330, 290), (580, 290), (580, 545), (525, 545), (525, 760), (380, 760), (380, 545), (330, 545)]
ANTENNA_L = [(290, 110), (405, 110), (405, 230), (450, 300), (450, 330), (415, 330), (330, 240), (290, 240)]
ANTENNA_R = [(904 - x, y) for x, y in ANTENNA_L]
CENTRE_X = 452


def polygon_mask(size, pts):
    mask = Image.new('L', size, 0)
    ImageDraw.Draw(mask).polygon(pts, fill=255)
    return mask


def cut(im, mask):
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out


def save(im, name):
    OUT.mkdir(parents=True, exist_ok=True)
    im.crop(CROP).resize(OUT_SIZE, Image.LANCZOS).save(OUT / f'{name}.webp', lossless=True, quality=100, method=6)


def main():
    size = 113 * SCALE
    im = Image.open(BytesIO(cairosvg.svg2png(url=str(SRC), output_width=size, output_height=size))).convert('RGBA')
    body = polygon_mask(im.size, BODY)
    ant_l = polygon_mask(im.size, ANTENNA_L)
    ant_r = polygon_mask(im.size, ANTENNA_R)
    # wings: everything on each side of the centre line that is not body or antenna
    from PIL import ImageChops

    rest = ImageChops.subtract(im.getchannel('A'), ImageChops.lighter(body, ImageChops.lighter(ant_l, ant_r)))
    half_l = polygon_mask(im.size, [(0, 0), (CENTRE_X, 0), (CENTRE_X, size), (0, size)])
    half_r = polygon_mask(im.size, [(CENTRE_X, 0), (size, 0), (size, size), (CENTRE_X, size)])
    save(cut(im, body), 'body')
    save(cut(im, ImageChops.multiply(rest, half_l)), 'wing-l')
    save(cut(im, ImageChops.multiply(rest, half_r)), 'wing-r')
    save(cut(im, ant_l), 'antenna-l')
    save(cut(im, ant_r), 'antenna-r')


if __name__ == '__main__':
    main()
