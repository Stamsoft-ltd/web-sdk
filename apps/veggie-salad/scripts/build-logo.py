#!/usr/bin/env python3
"""The VEGGIE SALAD wordmark, from design 9471:47883 ("logo_veggie").

The design draws the logo as flat pixel art, but as traced vectors: 158 paths in 20 flat colours,
on a grid that is not whole cells (the flower petals and the G/S counters sit on half cells).
Snapping it to a native cell grid moved those features (tried 2026-09-25: petals lost, G read as
C), so it is rasterised at its final size and every pixel palette-snapped to the design's own
fills, alpha cut at 50%: the anti-aliased rim goes, nothing moves.

The canvas keeps the old logo-px.webp's frame (857x304, art full width, centred on y 148.5), at
2x, so the splash, the HUD brand, the info panel and the splash-to-game fly all place it unchanged.

Source: scripts/art/logo-9471-47883/logo_veggie.svg (the design's SVG export).
Writes: static/assets/veggie-salad/pixel/logo-v2.webp

Run from anywhere:

    python3 apps/veggie-salad/scripts/build-logo.py
"""
from __future__ import annotations

import io
import re
from pathlib import Path

import cairosvg
import numpy as np
from PIL import Image

APP = Path(__file__).resolve().parents[1]
SRC = APP / 'scripts/art/logo-9471-47883/logo_veggie.svg'
OUT = APP / 'static/assets/veggie-salad/pixel/logo-v2.webp'
# The old logo's canvas and the centre line its art sat on, x2.
CANVAS = (857 * 2, 304 * 2)
CENTRE_Y = 148.5 * 2


def main():
    svg = SRC.read_text()
    fills = sorted({tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
                    for h in re.findall(r'fill="#([0-9A-Fa-f]{6})"', svg)})
    pal = np.array(fills, float)

    # Render large once to find the art's box, then at the size that box fills the canvas width.
    probe = Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(), scale=10)))
    x0, y0, x1, y1 = probe.getbbox()
    scale = 10 * CANVAS[0] / (x1 - x0)
    while True:
        im = Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(), scale=scale)))
        im = im.convert('RGBA').crop(im.getbbox())
        # The anti-aliased rim can add a pixel; shrink until the art fits the canvas.
        if im.width <= CANVAS[0]:
            break
        scale *= (CANVAS[0] - 0.5) / im.width

    a = np.array(im).astype(float)
    alpha = a[..., 3:] / 255
    rgb = np.divide(a[..., :3], alpha, out=np.zeros_like(a[..., :3]), where=alpha > 0)
    k = ((rgb[..., None, :] - pal) ** 2).sum(-1).argmin(-1)
    out = np.zeros(a.shape, np.uint8)
    on = a[..., 3] >= 128
    out[on, :3] = pal[k[on]]
    out[on, 3] = 255

    canvas = Image.new('RGBA', CANVAS)
    art = Image.fromarray(out)
    canvas.alpha_composite(art, ((CANVAS[0] - art.width) // 2, round(CENTRE_Y - art.height / 2)))
    canvas.save(OUT, lossless=True, quality=100, method=6)
    print(f'{len(fills)} colours, art {art.size} on {CANVAS} -> {OUT.name} '
          f'{OUT.stat().st_size // 1024}K')


if __name__ == '__main__':
    main()
