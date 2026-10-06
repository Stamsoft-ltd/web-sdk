#!/usr/bin/env python3
"""The portrait base-game lamp's light beam (background-portrait.webp's pendant, bulb at ~(133, 122)
of 941×1672, shade rim y≈140 from x≈35 to 235): a soft warm cone, drawn ADDITIVELY over the painted
one by Background.svelte (with a halo + filament flicker), so the lamp reads as really lit.

The texture covers BEAM_RECT of the background image (image px): its top edge is the shade's rim,
the cone widens down-right like the painted beam, and fades out with distance and toward its edges.

    python3 scripts/build-lamp-beam.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'static/assets/mcschmutzo/lamp-beam.webp'

# Background.svelte's PORTRAIT_LAMP.beam = this rect (image px): x, y, w, h
X0, Y0, W, H = -40, 136, 640, 520
S = 0.5  # texture scale (soft art; half-res is plenty)
w, h = int(W * S), int(H * S)

ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
ix = X0 + xs / S  # image px
iy = Y0 + ys / S
t = np.clip((iy - Y0) / H, 0, 1)  # 0 at the rim → 1 at the bottom
# the cone's edges: from the rim's ends, the left edge drops almost straight, the right spreads wide
left = 40 - 60 * t
right = 232 + 360 * t
mid = (left + right) / 2
half = (right - left) / 2
u = np.abs(ix - mid) / half  # 0 centre → 1 edge
edge = np.clip((1 - u) / 0.45, 0, 1)
edge = edge * edge * (3 - 2 * edge)  # smoothstep: soft sides
fall = (1 - t) ** 1.7  # fades with distance
near = np.clip(t / 0.04, 0, 1)  # tucked under the rim (no hard top line)
a = edge * fall * near
# warm lamp light: brighter + whiter near the bulb, amber further out
r = 255 * np.ones_like(a)
g = 236 - 40 * t
b = 190 - 110 * t
img = np.dstack([r, g, b, 255 * a]).clip(0, 255).astype(np.uint8)
im = Image.fromarray(img, 'RGBA').filter(ImageFilter.GaussianBlur(6))
im.save(OUT, 'WEBP', quality=90, method=6)
print(OUT.name, im.size)
