#!/usr/bin/env python3
"""Strip the baked-in glare spots from the info modal's neon frame.

The frame art ships with half a dozen bright blobs painted onto the neon line. InfoBorderLights
already runs a pair of travelling lights around that same line, so the painted ones read as lights
that are broken — permanently stuck on, and out of step with the ones that move.

Removing them is a 1-D median filter run ALONG each straight edge. The frame's colour changes only
slowly from one end of an edge to the other, so a median in that direction leaves the gradient
essentially untouched while a blob — narrow, and far brighter than its surroundings — is exactly
what a median discards. The corners are left alone: no blob sits on one, and filtering round a bend
would smear the gradient's sharpest turn.

    python3 scripts/info/build_info_frame.py

Reads scripts/info/source/tutorial-bg-lit.webp (the original art, kept out of static/ so it is not
shipped) and writes static/assets/theme-park/v2/info/tutorial-bg.webp.
"""

from __future__ import annotations

import os
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent / 'source' / 'tutorial-bg-lit.webp'
OUT = ROOT / 'static/assets/theme-park/v2/info/tutorial-bg.webp'

# How deep the neon line and its glow reach in from each edge.
BAND = 46
# Kept clear of the rounded corners, whose gradient turns too fast to median along.
CORNER = 90
# Wider than the widest blob, so the median never sees one as the majority.
WINDOW = 161


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

    # Top and bottom run left-to-right; left and right run top-to-bottom. Each is taken as a
    # (length, depth, channels) strip so one routine handles all four.
    lo, hi = CORNER, w - CORNER
    out[:BAND, lo:hi] = median_along(a[:BAND, lo:hi].transpose(1, 0, 2), WINDOW).transpose(1, 0, 2)
    out[h - BAND :, lo:hi] = median_along(
        a[h - BAND :, lo:hi].transpose(1, 0, 2), WINDOW
    ).transpose(1, 0, 2)

    lo, hi = CORNER, h - CORNER
    out[lo:hi, :BAND] = median_along(a[lo:hi, :BAND], WINDOW)
    out[lo:hi, w - BAND :] = median_along(a[lo:hi, w - BAND :], WINDOW)

    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA').save(
        OUT, 'WEBP', quality=94, method=6
    )
    print(f'{OUT.relative_to(ROOT)}  {img.size[0]}x{img.size[1]}  {os.path.getsize(OUT)/1024:.1f} KB')


if __name__ == '__main__':
    main()
