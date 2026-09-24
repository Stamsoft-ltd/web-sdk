#!/usr/bin/env python3
"""The congrats sign's king, from the design's vector.

Design 9050:17100 draws the scatter king on the congrats sign as a 119px VECTOR (its `potato`
frame, 9363:60186, kept at scripts/art/congrats-king-9363-60186.svg). The sign used to draw the
89px board sprite at four times its size, which is what "the scatter image is bad quality"
(user, 2026-09-18) was. This renders the SVG at 4x (476px) for the sign:

    overlays/v2/congrats/king.webp        the design's frame — eyes shut, which is the blink
    overlays/v2/congrats/king-open.webp   the same render with open eyes

The open eyes are scatter_open.webp's own eye pixels (rows 47-53 of the 89px sprite, the
black-and-glint block that sprite carries) painted over the shut arcs at the vector's pitch, which
is read off the brows: each brow is 3 art rows / 7 art columns in the sprite and its box in the
render gives the px per art px. Run from anywhere:

    python3 apps/veggie-salad/scripts/build-congrats-king.py
"""
from __future__ import annotations

from collections import deque
from pathlib import Path

import cairosvg
import numpy as np
from PIL import Image

APP = Path(__file__).resolve().parents[1]
PIX = APP / 'static/assets/veggie-salad/pixel'
SVG = APP / 'scripts/art/congrats-king-9363-60186.svg'
OUT = PIX / 'overlays/v2/congrats'
SCALE = 4
# The sprite's brows: art columns 34-40 / 48-54 on rows 44-46; its open eyes fill rows 47-53 of
# columns 33-40 / 47-54 (the brow joins the eye on the outer column).
BROWS = [(34, 40), (48, 54)]
BROW_ROWS = (44, 46)
EYE_COLS = [(33, 40), (47, 54)]
EYE_ROWS = (47, 53)


def black(a):
    return (a[..., 3] > 200) & (a[..., :3].max(axis=2) < 70)


def blobs(mask):
    h, w = mask.shape
    seen = np.zeros_like(mask, bool)
    for y in range(h):
        for x in range(w):
            if not mask[y, x] or seen[y, x]:
                continue
            q = deque([(y, x)])
            seen[y, x] = True
            pts = []
            while q:
                cy, cx = q.popleft()
                pts.append((cy, cx))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        q.append((ny, nx))
            ys = [p[0] for p in pts]
            xs = [p[1] for p in pts]
            yield len(pts), min(xs), min(ys), max(xs), max(ys)


def open_eyes(shut):
    """The king render (RGBA int array, eyes shut) with scatter_open.webp's eyes painted over the
    arcs at the render's own pitch."""
    h, w = shut.shape[:2]
    # The face's black marks: two brows (upper) and two shut arcs (lower), left to right.
    m = black(shut).copy()
    m[: int(h * 0.48)] = False
    m[int(h * 0.62):] = False
    m[:, : int(w * 0.25)] = False
    m[:, int(w * 0.75):] = False
    marks = [b for b in blobs(m) if b[0] > 50]
    brows = sorted([b for b in marks if b[2] < h * 0.53], key=lambda b: b[1])
    arcs = sorted([b for b in marks if b[2] >= h * 0.53], key=lambda b: b[1])
    assert len(brows) == 2 and len(arcs) == 2, (brows, arcs)

    sprite = np.array(Image.open(PIX / 'scatter_open.webp').convert('RGBA')).astype(int)
    out = shut.copy()
    for i in range(2):
        _, bx0, by0, bx1, by1 = brows[i]
        sx0, sx1 = BROWS[i]
        px = (bx1 - bx0 + 1) / (sx1 - sx0 + 1)
        py = (by1 - by0 + 1) / (BROW_ROWS[1] - BROW_ROWS[0] + 1)
        col = lambda x: int(round(bx0 + (x - sx0) * px))  # noqa: E731
        row = lambda y: int(round(by0 + (y - BROW_ROWS[0]) * py))  # noqa: E731
        # Paint the arc out with the skin under it, then lay the sprite's eye block over it.
        _, ax0, ay0, ax1, ay1 = arcs[i]
        skin = shut[ay1 + 6, (ax0 + ax1) // 2]
        out[ay0 - 2 : ay1 + 3, ax0 - 2 : ax1 + 3] = skin
        for y in range(EYE_ROWS[0], EYE_ROWS[1] + 1):
            for x in range(EYE_COLS[i][0], EYE_COLS[i][1] + 1):
                p = sprite[y, x]
                if p[3] < 100:
                    continue
                if p[:3].max() < 70:
                    fill = (0, 0, 0, 255)
                elif p[:3].min() > 200:
                    fill = (255, 255, 255, 255)
                else:
                    continue
                out[row(y) : row(y + 1), col(x) : col(x + 1)] = fill
    return out, brows, arcs


def main():
    cairosvg.svg2png(url=str(SVG), write_to=str(OUT / 'king.png'), scale=SCALE)
    shut = np.array(Image.open(OUT / 'king.png').convert('RGBA')).astype(int)
    (OUT / 'king.png').unlink()
    h, w = shut.shape[:2]
    out, brows, arcs = open_eyes(shut)
    Image.fromarray(shut.astype('uint8')).save(OUT / 'king.webp', lossless=True, quality=100, method=6)
    Image.fromarray(out.astype('uint8')).save(OUT / 'king-open.webp', lossless=True, quality=100, method=6)
    print(f'king {w}x{h} brows={[(b[1], b[2], b[3], b[4]) for b in brows]} arcs={[(a[1], a[2], a[3], a[4]) for a in arcs]}')

if __name__ == '__main__':
    main()
