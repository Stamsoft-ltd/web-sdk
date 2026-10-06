#!/usr/bin/env python3
"""The soup pot's two painted drip clusters (special-pot-v3 / v2, identical there; 1080×777) cut into
one layer per FINGER, so each can ooze longer and let a drop go (game/potDrips.ts drives them on the
pixi pot — SpecialMascot — and the HTML phone pot — FreeSpinPanelHtml).

A finger = the green (body, highlight, olive outline) below CUT_Y in its column run; the blob on the
rim above CUT_Y stays in the base art, so a layer stretched down from its top edge joins it seamlessly
(at rest the layer sits exactly on its own painted pixels). Alpha = "greenness" (g − b), so edges
stay soft and the pot's grey/black never comes along.

    python3 scripts/build-pot-drips.py   # prints the DRIPS table for game/potDrips.ts
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'static/assets/mcschmutzo/special-pot-v3.webp'
OUT = ROOT / 'static/assets/mcschmutzo/pot-drips'
OUT.mkdir(exist_ok=True)

CUT_Y = 362  # just under the rim blobs of both clusters
REGIONS = [(185, 400), (730, 900)]  # left / right cluster columns (the spoon's drip is left alone)

im = np.asarray(Image.open(SRC).convert('RGBA')).astype(np.float32)
r, g, b, a = im[..., 0], im[..., 1], im[..., 2], im[..., 3]
green = np.clip((g - b - 25) / 35, 0, 1) * (g >= r * 0.92) * (a / 255)
green[:CUT_Y] = 0

rows = []
PROBE = (400, 420)  # rows where the fingers hang apart
for x0, x1 in REGIONS:
    cols = green[PROBE[0] : PROBE[1], x0:x1].max(axis=0) > 0.5
    runs, start = [], None
    for i, on in enumerate(list(cols) + [False]):
        if on and start is None:
            start = i
        if not on and start is not None:
            if i - start >= 12:
                runs.append((x0 + start, x0 + i))
            start = None
    # each finger owns the columns up to the midpoint of the gap to its neighbour (the joined part
    # just under the cut is shared out that way); the outer fingers reach the cluster's edge
    for j, (cx0, cx1) in enumerate(runs):
        lx0 = x0 if j == 0 else (runs[j - 1][1] + cx0) // 2
        lx1 = x1 if j == len(runs) - 1 else (cx1 + runs[j + 1][0]) // 2
        m = green[:, lx0:lx1].copy()
        ys = np.nonzero(m.max(axis=1) > 0.5)[0]
        y1 = int(ys.max()) + 3
        m = m[CUT_Y:y1]
        rgba = im[CUT_Y:y1, lx0:lx1].copy()
        rgba[..., 3] = 255 * m
        tip_row = m[-8:].sum(axis=0)
        tip_x = lx0 + float((tip_row * np.arange(lx1 - lx0)).sum() / max(tip_row.sum(), 1e-6))
        k = len(rows)
        Image.fromarray(rgba.clip(0, 255).astype(np.uint8), 'RGBA').save(OUT / f'drip-{k}.webp', 'WEBP', quality=92, method=6)
        rows.append((k, lx0, CUT_Y, lx1 - lx0, y1 - CUT_Y, round(tip_x, 1)))

print('// x, y, w, h (pot-image px, 1080×777) + the tip x the drop falls from')
for k, x, y, w, h, tx in rows:
    print(f"\t{{ key: 'potDrip{k}', x: {x}, y: {y}, w: {w}, h: {h}, tipX: {tx} }},")
