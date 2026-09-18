#!/usr/bin/env python3
"""Layers for the SUPER bonus wolf pup (Figma "vulk", node 9359:59247).

The design ships the pup as one traced vector. The night garden wants it alive — ears that flick
and eyes that wander and blink — so this splits the render into layers the CSS can move on their
own, all on ONE shared canvas so the component stacks them with `inset: 0` and no per-layer offsets:

    background/bonus-super/wolf/body.webp    everything, eyes inpainted with the fur around them
    background/bonus-super/wolf/ear-l.webp   the left ear, overlaid on the intact body
    background/bonus-super/wolf/ear-r.webp   the right ear, likewise
    background/bonus-super/wolf/eyes.webp    both eyes: rims, pupils and glints

The ears stay painted on the body underneath their overlays on purpose: a flick is a stretch from
the ear's base plus a few degrees of tilt, which keeps the overlay covering its own painted twin,
so nothing needs a hole in the head and no gap ever opens at the base. The eyes cannot work that
way — a moved eye must not leave the old one behind — so their sockets are filled row by row from
the nearest fur outside the mask.

The tracing is not on a clean pixel grid (edges wobble by a few source pixels), so the masks are
hand-placed polygons and colour picks at 4x, not grid cells. Run from anywhere:

    python3 apps/veggie-salad/scripts/build-super-wolf.py
"""
from __future__ import annotations

from collections import deque
from pathlib import Path

import cairosvg
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
SRC = HERE / 'art/vulk-9359-59247.svg'
OUT = HERE.parents[0] / 'static/assets/veggie-salad/pixel/background/bonus-super/wolf'

SCALE = 4  # the SVG is 246px; masks below are in 4x coordinates
CROP = (40, 100, 910, 910)  # the pup's bounds with a little air, 4x
OUT_SIZE = (435, 405)  # CROP at 2x — plenty for the ~200px it renders at

EAR_L = [(468, 104), (664, 104), (664, 258), (560, 300), (468, 300)]
EAR_R = [(776, 136), (906, 136), (906, 332), (858, 332), (800, 285), (776, 230)]
# (x0, y0, x1, y1) around each eye; the right box also clips the nose out of its bottom-left
EYE_BOXES = [(578, 346, 675, 446), (738, 350, 816, 474)]
NOSE = lambda x, y: x < 756 and y >= 462


def is_dark(c):
    return c[3] > 0 and abs(c[0] - 30) < 20 and abs(c[1] - 11) < 20 and abs(c[2] - 6) < 20


def is_glint(c):
    return c[3] > 0 and c[0] > 235 and c[1] > 235 and c[2] > 235


def polygon_mask(size, pts):
    mask = Image.new('L', size, 0)
    ImageDraw.Draw(mask).polygon(pts, fill=255)
    return mask


def eye_mask(im):
    """Dark rim + pupil + glint inside each box, holes (the grey between them) filled in."""
    px = im.load()
    mask = Image.new('L', im.size, 0)
    mp = mask.load()
    for x0, y0, x1, y1 in EYE_BOXES:
        for y in range(y0, y1):
            for x in range(x0, x1):
                c = px[x, y]
                if (is_dark(c) or is_glint(c)) and not NOSE(x, y):
                    mp[x, y] = 255
        # flood from the box border over non-eye pixels; whatever is left unreached is enclosed
        seen = set()
        queue = deque(
            [(x, y) for x in range(x0, x1) for y in (y0, y1 - 1) if mp[x, y] == 0]
            + [(x, y) for y in range(y0, y1) for x in (x0, x1 - 1) if mp[x, y] == 0]
        )
        while queue:
            x, y = queue.popleft()
            if (x, y) in seen or not (x0 <= x < x1 and y0 <= y < y1) or mp[x, y]:
                continue
            seen.add((x, y))
            queue.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
        for y in range(y0, y1):
            for x in range(x0, x1):
                if mp[x, y] == 0 and (x, y) not in seen:
                    mp[x, y] = 255
    return mask


def inpaint(im, mask):
    """Fill the masked pixels from the nearest unmasked pixel on the same row."""
    out = im.copy()
    src, dst, mp = im.load(), out.load(), mask.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            if not mp[x, y]:
                continue
            l = x
            while l > 0 and mp[l, y]:
                l -= 1
            r = x
            while r < w - 1 and mp[r, y]:
                r += 1
            dst[x, y] = src[l if x - l <= r - x else r, y]
    return out


def cut(im, mask):
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out


def save(im, name):
    OUT.mkdir(parents=True, exist_ok=True)
    im.crop(CROP).resize(OUT_SIZE, Image.LANCZOS).save(OUT / f'{name}.webp', lossless=True, quality=100, method=6)


def main():
    size = 246 * SCALE
    png = cairosvg.svg2png(url=str(SRC), output_width=size, output_height=size)
    from io import BytesIO

    im = Image.open(BytesIO(png)).convert('RGBA')
    eyes = eye_mask(im)
    save(inpaint(im, eyes), 'body')
    save(cut(im, polygon_mask(im.size, EAR_L)), 'ear-l')
    save(cut(im, polygon_mask(im.size, EAR_R)), 'ear-r')
    save(cut(im, eyes), 'eyes')


if __name__ == '__main__':
    main()
