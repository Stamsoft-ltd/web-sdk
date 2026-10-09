#!/usr/bin/env python3
"""
The free-games (salting) chef's body with the OLD head's leftovers painted out from under his head:

  special_body_v2_c@0.798x.webp   special_body_v1 (scripts/build-special-head.py) had the original jaw
                                  still painted where the head layer covers it — a dark jaw-shaped band
                                  and a bit of chin. Every tilt or lift of the head uncovered it as a
                                  second jaw ("the old head stays below"). Here every body pixel the head
                                  hides at rest (except the white collar, which is real) is refilled from
                                  its surroundings — an onion-peel fill, each ring the mean of its
                                  already-known neighbours — so what the head uncovers is shirt and neck.

Both layers are crops of the same 0.798-scale frame: the body's starts at frame (511, 0), the head's at
(511, 140.4), so head texture px (x, y) sits on body texture px (x, y + HEAD_DY). The rest pose is
unchanged (the head covers everything that was refilled).

    python3 scripts/build-special-body-fill.py
"""
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
GUYS = os.path.join(HERE, '..', 'static/assets/mcschmutzo/guys')
HEAD_DY = 112  # round(140.4 * 0.798)
KEEP_LUM = 200  # hidden pixels at least this light (the white collar) are real and stay


def build():
    body = np.array(Image.open(os.path.join(GUYS, 'special_body_v1_c@0.798x.webp')).convert('RGBA')).astype(float)
    head = np.array(Image.open(os.path.join(GUYS, 'special_head_v3_c@0.798x.webp')).convert('RGBA'))
    over = np.zeros(body.shape[:2], bool)
    hh, hw = head.shape[:2]
    over[HEAD_DY:HEAD_DY + hh, :hw] = head[..., 3] > 0

    fill = over & (body[..., 3] > 0) & (body[..., :3].mean(-1) < KEEP_LUM)
    known = (body[..., 3] > 200) & ~fill
    rgb = body[..., :3].copy()
    todo = fill.copy()
    while todo.any():
        acc = np.zeros_like(rgb)
        n = np.zeros(fill.shape)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy == dx == 0:
                    continue
                k = np.roll(np.roll(known, dy, 0), dx, 1)
                acc += np.roll(np.roll(rgb, dy, 0), dx, 1) * k[..., None]
                n += k
        ring = todo & (n >= 2)
        if not ring.any():
            break
        rgb[ring] = acc[ring] / n[ring][:, None]
        known |= ring
        todo &= ~ring

    out = body.copy()
    out[fill, :3] = rgb[fill]
    out[todo, 3] = 0  # (a few px with no known neighbours: hidden under the head anyway)
    Image.fromarray(out.clip(0, 255).astype(np.uint8)).save(
        os.path.join(GUYS, 'special_body_v2_c@0.798x.webp'), quality=92, method=6)
    print('refilled', int(fill.sum()), 'px;', int(todo.sum()), 'left transparent')


if __name__ == '__main__':
    build()
