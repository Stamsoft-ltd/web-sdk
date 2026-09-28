#!/usr/bin/env python3
"""The dusk (NORMAL bonus) garden's cloud: the base game's pixel cloud, recoloured for a purple sky.

The garden's own cloud.webp is a soft pink/lilac haze at 40% alpha; against the dusk sky
(~#7261BC) it all but vanished ("on the other than base games ... to have clouds ... colored
according the background", user 2026-09-25). The base cloud is crisp, flat pixel art in four
shades; each keeps its place and takes the matching step of a lavender-to-pink ramp lit from the
sunset side, so the shape is the base game's and the colour is the dusk's.

Writes static/assets/veggie-salad/pixel/background/bonus-normal/cloud-dusk.webp

Run from anywhere:

    python3 apps/veggie-salad/scripts/build-dusk-cloud.py
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

APP = Path(__file__).resolve().parents[1]
SRC = APP / 'static/assets/veggie-salad/pixel/background/base-cloud.webp'
OUT = APP / 'static/assets/veggie-salad/pixel/background/bonus-normal/cloud-dusk.webp'
# Brightest to darkest: the lit crown, then three lavender shades still well above the sky.
RAMP = [(250, 222, 236), (222, 190, 232), (199, 168, 226), (178, 150, 219)]


def main():
    a = np.array(Image.open(SRC).convert('RGBA'))
    on = a[..., 3] > 0
    colours, inverse = np.unique(a[on][:, :3], axis=0, return_inverse=True)
    # Rank the source's colours by luminance and spread them over the ramp.
    lum = colours @ np.array([0.299, 0.587, 0.114])
    rank = np.argsort(np.argsort(-lum))
    step = np.minimum((rank * len(RAMP)) // max(1, len(colours)), len(RAMP) - 1)
    mapped = np.array(RAMP, np.uint8)[step]
    out = a.copy()
    out[on, :3] = mapped[inverse.ravel()]
    Image.fromarray(out).save(OUT, lossless=True, quality=100, method=6)
    print(f'{len(colours)} source colours -> {len(RAMP)}-step dusk ramp, {OUT.name} {out.shape[1]}x{out.shape[0]}')


if __name__ == '__main__':
    main()
