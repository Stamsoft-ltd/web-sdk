#!/usr/bin/env python3
"""Strip the baked light blobs from the neon "S pad" frame.

Same problem and same remedy as build_info_frame.py: the art has half a dozen bright spots painted
onto the neon line, which read as broken bulbs once real marching lights run round the same line.
A 1-D median filter ALONG each straight edge removes them — the frame's colour changes only slowly
from one end of an edge to the other, so the median leaves the gradient alone while a narrow, much
brighter blob is exactly what it discards.

Geometry is measured off the file rather than assumed: the neon line peaks at x 21/590 and y 18/270
in the 615x309 canvas, and the corner curve is about 40px, so each edge is filtered only over its
straight run.

    python3 scripts/info/build_neon_frame.py

Reads static/assets/theme-park/v2/hud/neon-frame.png (still shipped — the HUD uses the lit version)
and writes neon-frame-plain.png beside it.
"""

from __future__ import annotations

import os
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'static/assets/theme-park/v2/hud/neon-frame.png'
OUT = ROOT / 'static/assets/theme-park/v2/hud/neon-frame-plain.png'

# Where the neon line sits, and how far its glow reaches to either side of it.
LINE = {'left': 21, 'right': 590, 'top': 18, 'bottom': 270}
GLOW = 22
# Straight run of each edge: everything outside the corner curve.
CORNER = 40
# Wider than the widest blob (~14px), so the median never sees one as the majority.
WINDOW_H = 61
WINDOW_V = 45


def median_along(strip: np.ndarray, window: int) -> np.ndarray:
    """Median-filter `strip` (length, depth, channels) along its first axis."""
    half = window // 2
    padded = np.pad(strip, ((half, half), (0, 0), (0, 0)), mode='edge')
    windows = np.lib.stride_tricks.sliding_window_view(padded, window, axis=0)
    return np.median(windows, axis=-1).astype(np.float32)


def main() -> None:
    img = Image.open(SOURCE).convert('RGBA')
    a = np.asarray(img).astype(np.float32)
    h, w, _ = a.shape
    out = a.copy()

    # Horizontal edges run left-to-right; vertical edges top-to-bottom. Each is taken as a
    # (length, depth, channels) strip so one routine handles all four.
    x0, x1 = LINE['left'] + CORNER, LINE['right'] - CORNER
    for y0, y1 in ((0, LINE['top'] + GLOW), (LINE['bottom'] - GLOW, h)):
        band = a[y0:y1, x0:x1].transpose(1, 0, 2)
        out[y0:y1, x0:x1] = median_along(band, WINDOW_H).transpose(1, 0, 2)

    y0, y1 = LINE['top'] + CORNER, LINE['bottom'] - CORNER
    for cx0, cx1 in ((0, LINE['left'] + GLOW), (LINE['right'] - GLOW, w)):
        out[y0:y1, cx0:cx1] = median_along(a[y0:y1, cx0:cx1], WINDOW_V)

    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA').save(OUT)
    print(f'{OUT.relative_to(ROOT)}  {w}x{h}  {os.path.getsize(OUT)/1024:.1f} KB')


if __name__ == '__main__':
    main()
