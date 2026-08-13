"""Cut the falling coin out of the win screen's coin-rain layer (Figma 6089:3467).

The win card's own coins are balloon medallions — the symbol, not currency — and using them for the
rain was wrong. The design's rain uses a plain gold coin, and the layer it comes from shows it at
every tilt from edge-on to face-on as it tumbles.

Only the most face-on coin is cut: the game reproduces the tumble by animating the sprite's WIDTH
(a coin spinning about its vertical axis is exactly a horizontal squash), so one face-on sprite
covers every angle in that layer and stays sharp at any size.

It also derives the coin's RIM — see `build_rim` — which is the other half of making that squash
read as a solid object rather than a flat cutout being scaled.

Blobs are found with an explicit flood fill rather than scipy, which is not installed here.
"""

import os
import pathlib
import sys

import numpy as np
from PIL import Image

APP = pathlib.Path(__file__).resolve().parents[2]
OUT = APP / 'static/assets/theme-park/v2/wins/parts/rain_coin.webp'
OUT_RIM = APP / 'static/assets/theme-park/v2/wins/parts/rain_coin_rim.webp'
ALPHA_FLOOR = 24
MAX_EDGE = 256


def blobs(mask):
    """Label 4-connected regions, returning (area, bbox) per region."""
    h, w = mask.shape
    seen = np.zeros((h, w), dtype=bool)
    found = []
    for sy in range(h):
        row = mask[sy]
        for sx in range(w):
            if not row[sx] or seen[sy, sx]:
                continue
            stack = [(sy, sx)]
            seen[sy, sx] = True
            x0 = x1 = sx
            y0 = y1 = sy
            area = 0
            while stack:
                y, x = stack.pop()
                area += 1
                if x < x0:
                    x0 = x
                if x > x1:
                    x1 = x
                if y < y0:
                    y0 = y
                if y > y1:
                    y1 = y
                for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
            found.append((area, (x0, y0, x1 + 1, y1 + 1)))
    return found


def build_rim(coin):
    """The coin's edge: a plain metal band, in the coin's own silhouette.

    The first attempt at a 3D tumble drew the rim as a squashed copy of the FACE, which looked like
    a second coin peeking out from behind the first — squash a detailed disc and it still reads as a
    disc, complete with its P and its bevel ring. A rim has none of that. This keeps only the
    silhouette (so squashing it gives the lens shape a cylinder's side actually projects to) and
    fills it with a gradient: brightest a third of the way down where the light catches it, falling
    off to the top and bottom where the band curves away.

    Colours are sampled from the coin so the two always match.
    """
    rgba = np.array(coin).astype(float)
    alpha = rgba[..., 3]
    lit = rgba[..., :3][alpha > 200]
    base = lit.mean(0) if len(lit) else np.array([210.0, 150.0, 50.0])

    height, width = alpha.shape
    ys = np.arange(height)[:, None] / max(1, height - 1)
    # Vertical falloff: peak at 0.33, and never fully dark — this is metal, not a shadow.
    band = 0.5 + 0.62 * np.cos((ys - 0.33) * np.pi * 1.25)
    # A slight bulge across the sliver's width, so the very edges stay darker than its middle.
    xs = np.arange(width)[None, :] / max(1, width - 1)
    curve = 0.86 + 0.14 * np.sin(xs * np.pi)
    level = np.clip(band * curve, 0.22, 1.35)

    out = np.zeros_like(rgba)
    for channel in range(3):
        out[..., channel] = np.clip(base[channel] * level, 0, 255)
    out[..., 3] = alpha
    return Image.fromarray(out.astype('uint8'), 'RGBA')


def main(src):
    img = Image.open(src).convert('RGBA')
    alpha = np.array(img)[..., 3]
    found = blobs(alpha > ALPHA_FLOOR)
    # The one we want is big AND face-on: score by area, rejecting anything far from square, which
    # is how the edge-on coins in the layer present.
    scored = []
    for area, (x0, y0, x1, y1) in found:
        w, h = x1 - x0, y1 - y0
        if w < 40 or h < 40:
            continue
        aspect = w / h
        if not 0.86 <= aspect <= 1.16:
            continue
        scored.append((area, (x0, y0, x1, y1), aspect))
    scored.sort(key=lambda row: -row[0])
    if not scored:
        print('no face-on coin found')
        return
    area, box, aspect = scored[0]
    print(f'{len(found)} blobs, chose one of {area}px, box {box}, aspect {aspect:.3f}')

    coin = img.crop(box)
    scale = MAX_EDGE / max(coin.size)
    coin = coin.resize((round(coin.width * scale), round(coin.height * scale)), Image.LANCZOS)
    coin.save(OUT, 'WEBP', quality=92, method=6)
    print(f'{OUT}  {coin.size}  {os.path.getsize(OUT) / 1024:.0f}KB')
    write_rim(coin)


def write_rim(coin):
    rim = build_rim(coin)
    rim.save(OUT_RIM, 'WEBP', quality=92, method=6)
    print(f'{OUT_RIM}  {rim.size}  {os.path.getsize(OUT_RIM) / 1024:.0f}KB')


if __name__ == '__main__':
    # With no argument, re-derive just the rim from the coin already cut.
    if len(sys.argv) > 1:
        main(sys.argv[1])
    else:
        write_rim(Image.open(OUT).convert('RGBA'))
