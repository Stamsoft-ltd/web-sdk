"""Locate the marquee bulbs baked into each win panel and medallion ring.

"Make the lights look like they light" needs per-bulb control, and the bulbs are painted into the
art — there is no bulb layer to animate. So find their centres offline; the game then draws an
additive glow on each one and the painted art stays the unlit state underneath.

Detection is a brightness-peak search, but brightness ALONE does not work: every panel has a field
of painted star sparkles that reach the same luminance as a bulb (measured: legendary's field peaks
at 233 against a bulb median of 213), and saturation does not separate them either because the bulb
hue changes per tier. What does separate them is position — bulbs only ever sit on the frame or on
the amount plate, never out in the field — so the field is excluded as a region and the peak search
is left alone. All five panels share one layout, so one set of numbers covers them.

The ring is the same idea in polar form: its bulbs sit on one circle, so peaks are kept by radius.
"""

import json
import os
import pathlib

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

BASE = os.path.dirname(os.path.abspath(__file__))
APP = pathlib.Path(__file__).resolve().parents[2]
PARTS = str(APP / 'static/assets/theme-park/v2/wins/parts')
TIERS = ['sweet', 'wild', 'epic', 'mythic', 'legendary']

# The open field, as fractions of the panel image: inside the frame and above the amount plate.
# Anything here is star texture, not a bulb.
FIELD = (0.11, 0.11, 0.89, 0.75)
# The ring's bulbs, as a fraction of the ring image's half-diagonal.
RING_BAND = (0.72, 1.0)


def peaks(img, percentile, min_gap, window=9):
    a = np.array(img).astype(float)
    lum = a[..., :3].mean(2) * (a[..., 3] / 255.0)
    cut = np.percentile(lum[lum > 0], percentile)
    top = np.array(
        Image.fromarray(lum.astype(np.uint8), 'L').filter(ImageFilter.MaxFilter(window))
    ).astype(float)
    ys, xs = np.where((lum >= top - 0.5) & (lum >= cut))
    order = np.argsort(-lum[ys, xs])
    gap = min_gap * max(img.size)
    kept = []
    for i in order:
        x, y = float(xs[i]), float(ys[i])
        if all((x - kx) ** 2 + (y - ky) ** 2 >= gap * gap for kx, ky in kept):
            kept.append((x, y))
    return [(x / img.width, y / img.height) for x, y in kept]


def panel_bulbs(path):
    img = Image.open(path).convert('RGBA')
    x0, y0, x1, y1 = FIELD
    pts = [p for p in peaks(img, 98.6, 0.022) if not (x0 < p[0] < x1 and y0 < p[1] < y1)]
    return pts, img


def ring_bulbs(path):
    img = Image.open(path).convert('RGBA')
    lo, hi = RING_BAND
    out = []
    for x, y in peaks(img, 96.5, 0.05):
        # Normalised radius from the image centre, so a non-square ring image still works.
        r = np.hypot((x - 0.5) * 2, (y - 0.5) * 2 * img.height / img.width)
        if lo <= r / 1.0 <= hi * 1.6:
            out.append((x, y))
    return out, img


def preview(img, pts, cols=(0, 255, 90)):
    bg = Image.new('RGBA', img.size, (18, 5, 32, 255))
    bg.alpha_composite(img)
    d = ImageDraw.Draw(bg)
    r = max(img.size) * 0.012
    for fx, fy in pts:
        x, y = fx * img.width, fy * img.height
        d.ellipse([x - r, y - r, x + r, y + r], outline=(*cols, 255), width=3)
    return bg.convert('RGB').resize((420, round(420 * img.height / img.width)))


if __name__ == '__main__':
    lights = {}
    strip = Image.new('RGB', (420 * len(TIERS), 900), (10, 4, 20))
    for i, tier in enumerate(TIERS):
        p, pimg = panel_bulbs(f'{PARTS}/{tier}/panel.webp')
        r, rimg = ring_bulbs(f'{PARTS}/{tier}/ring.webp')
        lights[tier] = {
            'panel': [[round(x, 4), round(y, 4)] for x, y in p],
            'ring': [[round(x, 4), round(y, 4)] for x, y in r],
        }
        print(f'{tier:10s} panel={len(p):3d} ring={len(r):3d}')
        strip.paste(preview(pimg, p), (i * 420, 0))
        strip.paste(preview(rimg, r, (255, 60, 200)).resize((210, 210)), (i * 420 + 100, 450))
    strip.save(os.path.join(BASE, 'verify_bulbs.png'))
    json.dump(lights, open(os.path.join(BASE, 'bulbs.json'), 'w'))
