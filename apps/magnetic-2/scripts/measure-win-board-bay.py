#!/usr/bin/env python3
"""Measure the amount-plaque BAY of each win board art.

The bay is the flat dark region between the plaque's bright top rail and its bottom
ornament — the slot the win amount sits in. WinBoard.svelte drives BOTH the amount's
position and its font size from these numbers (TIER_BAY), so re-run this whenever the
board art is re-exported and paste the output into that table.

Detection: within the lower half of the art, find the longest contiguous run of rows
whose 95th-percentile luminance (over the central 36% of the width) stays below the
rail threshold. Percentile rather than mean because the bay carries a faint texture
and a coloured wash — only the metal rails are actually bright.

    python3 scripts/measure-win-board-bay.py static/assets/components/win_boards/*.webp
"""

import sys

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

RAIL_LUMA = 90  # above this the row/column is plaque frame, not bay


def measure(path):
    im = Image.open(path).convert('RGBA')
    W, H = im.size
    a = np.asarray(im)
    alpha = a[..., 3] / 255.0
    rgb = a[..., :3].astype(np.float32)
    lum = (0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]) * alpha

    solid = alpha > 0.5
    cols_any, rows_any = solid.any(axis=0), solid.any(axis=1)
    x0, x1 = np.argmax(cols_any), W - 1 - np.argmax(cols_any[::-1])
    y0, y1 = np.argmax(rows_any), H - 1 - np.argmax(rows_any[::-1])

    p95 = np.percentile(lum[:, int(W * 0.32):int(W * 0.68)], 95, axis=1)
    dark = [y for y in range(int(H * 0.58), int(H * 0.97)) if p95[y] < RAIL_LUMA]
    if not dark:
        return None
    runs, cur = [], [dark[0]]
    for y in dark[1:]:
        if y == cur[-1] + 1:
            cur.append(y)
        else:
            runs.append(cur)
            cur = [y]
    runs.append(cur)
    run = max(runs, key=len)
    by0, by1 = run[0], run[-1]

    # Horizontal extent: columns that stay below the rail threshold across the bay rows.
    cp95 = np.percentile(lum[by0:by1 + 1, :], 95, axis=0)
    cx = (x0 + x1) // 2
    bx0, bx1 = cx, cx
    while bx0 > x0 and cp95[bx0 - 1] < RAIL_LUMA:
        bx0 -= 1
    while bx1 < x1 and cp95[bx1 + 1] < RAIL_LUMA:
        bx1 += 1

    return dict(
        cy=((by0 + by1) / 2 - H / 2) / H,
        w=(bx1 - bx0 + 1) / W,
        h=(by1 - by0 + 1) / H,
    )


def main(paths):
    for p in paths:
        m = measure(p)
        name = p.rsplit('/', 1)[-1]
        if m is None:
            print(f'{name}: NO BAY FOUND')
            continue
        print(f"{name}: {{ cy: {m['cy']:.3f}, w: {m['w']:.3f}, h: {m['h']:.3f} }}")


if __name__ == '__main__':
    main(sys.argv[1:] or sys.exit(__doc__))
