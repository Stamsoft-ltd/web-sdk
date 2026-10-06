#!/usr/bin/env python3
"""
The phone (portrait) chef — Figma McShmutzo 8870:32978 (base game) / 8870:33637 (free games): a small
bust over the board's top-right corner, pointing at the reels, holding the ketchup bottle (base) or
the salt shaker (free games). Figma only exports these OPAQUE (on white), so the sources in
art-src/mobile-chef/ (scale-4 exports of the layers) are keyed here:

  body        8870:33050  the pointing chef, face + nametag included (shared by both phases)
  bottle hand 8870:32981  drawn BEHIND the body, shakes about the wrist
  salt hand   8870:33640  drawn behind the body in free games, shakes the salt

Every outer edge of this art is a dark outline, so the key is exact: the white connected to the
image border is background, and in the anti-aliased band along the outline a grey pixel is
outline-over-white (colour = (1 - a) * white) → black at alpha 1 - L. Writes
static/assets/mcschmutzo/guys/mobile_{body,bottle,salt}_v1.webp.

    python3 scripts/build-mobile-chef.py
"""
import os
from collections import deque

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'art-src', 'mobile-chef')
OUT = os.path.join(HERE, '..', 'static', 'assets', 'mcschmutzo', 'guys')
PARTS = {
    'body': 'body_8870-33050@4x.png',
    'bottle': 'bottle-hand_8870-32981@4x.png',
    'salt': 'salt-hand_8870-33640@4x.png',
}
WHITE = 236  # min channel above this = paper white
BAND = 2  # px of anti-aliasing band to un-mix along the outline


def key(img):
    a = np.array(img.convert('RGB')).astype(float)
    h, w, _ = a.shape
    white = a.min(axis=2) > WHITE
    # flood the border-connected white
    bg = np.zeros((h, w), bool)
    q = deque((y, x) for y in range(h) for x in (0, w - 1) if white[y, x])
    q.extend((y, x) for x in range(w) for y in (0, h - 1) if white[y, x])
    for y, x in q:
        bg[y, x] = True
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and white[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True
                q.append((ny, nx))
    alpha = np.where(bg, 0.0, 1.0)
    rgb = a.copy()
    # the band next to the background: unsaturated pixels are outline mixed with white
    near = bg.copy()
    for _ in range(BAND):
        n = near.copy()
        n[1:] |= near[:-1]
        n[:-1] |= near[1:]
        n[:, 1:] |= near[:, :-1]
        n[:, :-1] |= near[:, 1:]
        near = n
    band = near & ~bg
    L = a.mean(axis=2)
    grey = (a.max(axis=2) - a.min(axis=2)) < 40
    mix = band & grey
    alpha[mix] = np.clip(1 - L[mix] / 255, 0, 1) ** 0.9
    rgb[mix] = 0
    out = np.dstack([rgb, alpha * 255]).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(out, 'RGBA')
    return im.crop(im.getbbox()), im.getbbox(), (w, h)


if __name__ == '__main__':
    for name, src in PARTS.items():
        im, box, size = key(Image.open(os.path.join(SRC, src)))
        im.save(os.path.join(OUT, f'mobile_{name}_v1.webp'), quality=92, method=6)
        print(f'mobile_{name}_v1.webp', im.size, 'crop box in the export', box, 'of', size)
