#!/usr/bin/env python3
"""
The free-games (salting) chef's head with a feathered "skirt" under the jaw:

  special_head_v4_c@0.798x.webp   head v3 (scripts/build-special-hair.py) plus SKIRT texture rows of the
                                  ORIGINAL art (special_base_v12h, the untouched rest pose) just below the
                                  head's bottom edge — the under-chin shadow and the top of the neck —
                                  drawn under the head and fading out over SKIRT px. It moves with the
                                  head, so a tilt or lift no longer uncovers the body under the jaw (first
                                  the old jaw, then special_body_v2's refill, showed there as a second
                                  jaw / a cut-off chin). At rest it is the original art pixel for pixel.

The texture grows by SKIRT rows at the bottom, so GUY_CROPS.specialHead's y1 grows with it (printed).
The head crop starts at frame (511, 140.4), the base's at (511, 0): head texture px (x, y) sits on
base texture px (x, y + HEAD_DY). K = 0.798 texture px per frame px.

    python3 scripts/build-special-head-skirt.py
"""
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
GUYS = os.path.join(HERE, '..', 'static/assets/mcschmutzo/guys')
K = 0.798
HEAD_ORIGIN = (511, 140.4)
HEAD_DY = 112  # round(140.4 * 0.798)
SKIRT = 16  # texture px the skirt reaches below the head's edge, fading out


def build():
    base = np.array(Image.open(os.path.join(GUYS, 'special_base_v12h_c@0.798x.webp')).convert('RGBA')).astype(float)
    head = np.array(Image.open(os.path.join(GUYS, 'special_head_v3_c@0.798x.webp')).convert('RGBA')).astype(float)
    hh, hw = head.shape[:2]
    tall = hh + SKIRT

    canvas = np.zeros((tall, hw, 4))
    canvas[:hh] = head
    inside = np.zeros((tall, hw), bool)
    inside[:hh] = head[..., 3] > 128
    # straight down from the head's edge (a vertical skirt: no copies spread sideways over the shoulders)
    weight = np.zeros((tall, hw))
    for k in range(1, SKIRT + 1):
        below = np.zeros_like(inside)
        below[k:] = inside[:-k]
        weight = np.where(below & ~inside & (weight == 0), 1 - (k - 1) / SKIRT, weight)

    art = np.zeros((tall, hw, 4))
    rows = min(tall, base.shape[0] - HEAD_DY)
    art[:rows] = base[HEAD_DY:HEAD_DY + rows, :hw]
    skirt_a = art[..., 3:4] / 255 * weight[..., None]

    head_a = canvas[..., 3:4] / 255
    out_a = head_a + skirt_a * (1 - head_a)
    out = np.zeros_like(canvas)
    out[..., :3] = (canvas[..., :3] * head_a + art[..., :3] * skirt_a * (1 - head_a)) / np.maximum(out_a, 1e-6)
    out[..., 3:4] = out_a * 255
    Image.fromarray(out.clip(0, 255).astype(np.uint8)).save(
        os.path.join(GUYS, 'special_head_v4_c@0.798x.webp'), quality=92, method=6)

    ox, oy = HEAD_ORIGIN
    print('specialHead: { x0: %.1f, y0: %.1f, x1: %.1f, y1: %.1f }' % (ox, oy, ox + hw / K, oy + tall / K))


if __name__ == '__main__':
    build()
