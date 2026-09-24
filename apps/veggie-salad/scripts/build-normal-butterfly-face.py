#!/usr/bin/env python3
"""Face patches for the NORMAL bonus butterfly, so it blinks, glances and talks.

The butterfly's body (build-normal-butterfly.py) had one fixed face — the wings flapped and the
antennae wiggled, but the face never moved ("maybe move the eyes and mouth too", user
2026-09-24). These are patches on the body's own 412x355 canvas, opaque only over the part they
change, so the page stacks them over body.webp and the eyes and mouth animate independently:

    face-blink.webp   both eyes shut: a lid line where the eye was, skin above and below
    face-look-l.webp  both glints shifted left inside their eyes
    face-look-r.webp  …and right
    face-mouth.webp   the little w-smile opened into a dark mouth with a tongue

Coordinates are body.webp pixels, read off its dark/white masks. The drawing sits on an uneven
grid of ~11-12px blocks whose glints are smaller than a block, so edits are made at the file's
own resolution in half-block (6px) steps rather than on a recovered native grid.

Run from anywhere:

    python3 apps/veggie-salad/scripts/build-normal-butterfly-face.py
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

OUT = Path(__file__).resolve().parents[1] / 'static/assets/veggie-salad/pixel/background/bonus-normal/butterfly'
SKIN = (253, 218, 185, 255)
INK = (40, 17, 9, 255)
TONGUE = (233, 101, 104, 255)
# Eye boxes (x0, y0, x1, y1), inclusive-exclusive, around each eye's dark shape and glint.
EYES = [(157, 150, 191, 198), (213, 150, 246, 198)]
MOUTH = (184, 184, 220, 212)
GLANCE = 6


def grow(mask: np.ndarray, n: int) -> np.ndarray:
    img = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * n + 1))
    return np.array(img) > 0


def shrink(mask: np.ndarray, n: int) -> np.ndarray:
    img = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(2 * n + 1))
    return np.array(img) > 0


def eye_masks(a: np.ndarray, box):
    """The eye inside `box`: every pixel that is not skin, grown a pixel so its anti-aliased rim
    goes too (or a blink leaves a ghost outline), and the glint's bounding box (pure white)."""
    x0, y0, x1, y1 = box
    region = a[y0:y1, x0:x1, :3]
    eye = grow(np.abs(region - np.array(SKIN[:3])).max(axis=2) > 12, 1)
    ys, xs = np.nonzero(region.min(axis=2) > 240)
    return eye, (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)


def patch(base: np.ndarray, edited: np.ndarray, boxes) -> Image.Image:
    out = np.zeros_like(base)
    for x0, y0, x1, y1 in boxes:
        out[y0:y1, x0:x1] = edited[y0:y1, x0:x1]
    return Image.fromarray(out.astype(np.uint8))


def blink(a: np.ndarray) -> np.ndarray:
    b = a.copy()
    for box in EYES:
        x0, y0, x1, y1 = box
        eye, _ = eye_masks(a, box)
        ys, xs = np.nonzero(eye)
        ex0, ex1 = xs.min() + x0 + 1, xs.max() + x0
        b[y0:y1, x0:x1][eye] = SKIN
        # Lid: one half-block line across the eye's lower half, its ends dipped one step so it
        # reads as a closed eye rather than a dash.
        mid = (ys.min() + ys.max()) // 2 + y0 + 6
        b[mid:mid + 6, ex0 + 5:ex1 - 5] = INK
        b[mid + 3:mid + 9, ex0 + 1:ex0 + 5] = INK
        b[mid + 3:mid + 9, ex1 - 5:ex1 - 1] = INK
    return b


def glance(a: np.ndarray, dx: int) -> np.ndarray:
    """Redraw the eye's inside as flat ink (its soft rim against the skin stays) and put the
    glint back as a clean block, `dx` over, clipped to the ink."""
    b = a.copy()
    for box in EYES:
        x0, y0, x1, y1 = box
        eye, (gx0, gy0, gx1, gy1) = eye_masks(a, box)
        inner = shrink(eye, 2)
        region = b[y0:y1, x0:x1]
        region[inner] = INK
        glint = np.zeros_like(inner)
        glint[gy0:gy1, max(0, gx0 + dx):gx1 + dx] = True
        region[glint & inner] = (255, 255, 255, 255)
    return b


def mouth(a: np.ndarray) -> np.ndarray:
    """The w-smile opened: its two corner dots go, and a small rounded dark mouth with a tongue
    fills the space under them — one block wide plus a half-block each side."""
    b = a.copy()
    x0, y0, x1, y1 = MOUTH
    region = b[y0:y1, x0:x1]
    ink = np.abs(region[..., :3] - np.array(SKIN[:3])).max(axis=2) > 30
    region[ink] = SKIN
    ys, xs = np.nonzero(ink)
    cx = (xs.min() + xs.max() + 1) // 2 + x0
    top = ys.min() + y0 + 2
    b[top:top + 16, cx - 9:cx + 9] = INK
    for dy, dx in ((0, 0), (15, 0)):
        b[top + dy, cx - 9:cx - 6] = SKIN
        b[top + dy, cx + 6:cx + 9] = SKIN
    b[top:top + 3, cx - 9:cx - 8] = SKIN
    b[top:top + 3, cx + 8:cx + 9] = SKIN
    b[top + 13:top + 16, cx - 9:cx - 8] = SKIN
    b[top + 13:top + 16, cx + 8:cx + 9] = SKIN
    b[top + 8:top + 13, cx - 5:cx + 5] = TONGUE
    return b


def main():
    a = np.array(Image.open(OUT / 'body.webp').convert('RGBA')).astype(int)
    frames = {
        'face-blink': (blink(a), EYES),
        'face-look-l': (glance(a, -GLANCE), EYES),
        'face-look-r': (glance(a, GLANCE), EYES),
        'face-mouth': (mouth(a), [MOUTH]),
    }
    for name, (edited, boxes) in frames.items():
        patch(a, edited, boxes).save(OUT / f'{name}.webp', lossless=True, quality=100, method=6)
        print(name, (OUT / f'{name}.webp').stat().st_size, 'bytes')


if __name__ == '__main__':
    main()
