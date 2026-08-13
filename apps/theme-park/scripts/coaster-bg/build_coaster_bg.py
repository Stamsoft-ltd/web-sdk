#!/usr/bin/env python3
"""Build the Mega Coaster backdrop from the Figma master (node 6824:5157).

The design places a 1672x941 render as a 1439x810 image at (-172, -46) in the 1200x670 frame — i.e.
cropped and cover-scaled — and puts a soft layer blur on it so the reels read against it. This
reproduces both: crop the frame's window out of the master, then blur.

The blur radius was fitted against the design's own render rather than guessed: at 1200x670, a
Gaussian of 2px minimises mean absolute error against it (1.24/255 vs 2.58 unblurred). The output
ships at the node's placed size, so the radius is scaled by the same factor.

    python3 scripts/coaster-bg/build_coaster_bg.py

Reads scripts/coaster-bg/source/coaster-bg-raw.png (the untouched Figma master, kept out of static/
so it is not shipped) and writes static/assets/theme-park/v2/features/coaster-bg.webp.
"""

from __future__ import annotations

import os
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent / 'source' / 'coaster-bg-raw.png'
OUT = ROOT / 'static/assets/theme-park/v2/features/coaster-bg.webp'

# The design's frame, and how the master is placed inside it (node 6824:5157).
FRAME_W, FRAME_H = 1200, 670
PLACED_W, PLACED_X, PLACED_Y = 1439, -172, -46
# Shipped size — the placed size, so the art is never upscaled in game.
OUT_W, OUT_H = 1440, 804
# Fitted against the design render at 1200 wide; scaled to the output width below.
BLUR_AT_1200 = 2.0


def main() -> None:
    src = Image.open(SOURCE).convert('RGB')
    # Master -> frame scale, then the frame's window expressed back in master pixels.
    scale = PLACED_W / src.size[0]
    box = (
        round(-PLACED_X / scale),
        round(-PLACED_Y / scale),
        round((-PLACED_X + FRAME_W) / scale),
        round((-PLACED_Y + FRAME_H) / scale),
    )
    out = src.crop(box).resize((OUT_W, OUT_H), Image.LANCZOS)
    out = out.filter(ImageFilter.GaussianBlur(BLUR_AT_1200 * OUT_W / FRAME_W))
    out.save(OUT, 'WEBP', quality=88, method=6)
    print(f'{OUT.relative_to(ROOT)}  {OUT_W}x{OUT_H}  {os.path.getsize(OUT)/1024:.1f} KB')


if __name__ == '__main__':
    main()
