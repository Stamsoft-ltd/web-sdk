#!/usr/bin/env python3
"""Build the DUCK YOUR LUCK lockup the bonus screen wears, from the layers it is drawn in.

    python3 scripts/duck-sign/build_duck_pond_logo.py

It writes:

  static/assets/theme-park/v2/duckpond/logo.webp
  scripts/duck-sign/verify_duck_pond_logo.png

The bonus screen used to wear the old lockup: bulb-lit letters on a purple slab, fanned stacks of
gold coins behind it, a jewelled top hat and a jewelled bow tie. Nothing else in this game is drawn
that way any more — the symbols, the signs and the frame were all redrawn flat — and it was also the
last place the OLD duck appeared, so the bonus opened on a duck that looked nothing like the
twenty-five bobbing in the pond below it. Figma 7057:7971 is the replacement, and it is the same
drawing the scatter symbol already ships: a top-hatted duck holding a gold-edged DUCK YOUR LUCK
sign, a gold wing fanned out either side of it.

BUILT FROM THE LAYERS, NOT FROM A FLAT EXPORT, because the flat export of that frame is 448x360 and
the bonus draws this lockup about as wide as the whole board is tall. Blown up to the ~640px the
screen wants it is visibly softer than the symbols sitting next to it. The layers under source/logo/
are the same drawings at their own resolution, so the composition can be laid out at 14px per frame
unit and brought down to size, which is sharper than any amount of upscaling.

They are lossless WebP rather than PNG only because that is half the bytes for the same pixels, and
each one is stored no larger than SUPERSAMPLE places it — there is no point carrying resolution the
build throws away.

PLACED FROM THE FIGMA BOXES, and that is safe here in a way it was not for `build_duck_sign.py`'s
wings: those two are rotated, so their node boxes are pre-rotation origins that do not say where the
art lands. Every box below belongs to an unrotated layer. `verify()` proves it — it rebuilds at the
flat export's own 4px per unit and compares, and the only thing that differs is the one-pixel
antialiased rim, which the flat export lost when its paper was keyed out.

Always eyeball verify_duck_pond_logo.png: the rebuild beside the design's own render.
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent / "source"
LAYERS = SOURCE / "logo"
OUT = ROOT / "static/assets/theme-park/v2/duckpond/logo.webp"
VERIFY = Path(__file__).resolve().parent / "verify_duck_pond_logo.png"

# The design frame, in the units every box below is written in.
FRAME = (112.0, 90.0)
# The flat export in source/ is that frame at x4, and is what verify() checks against.
FLAT = SOURCE / "composition.png"
FLAT_SCALE = 4
# Figma exports are opaque and this file's paper is #f5f5f5.
PAPER = (245, 245, 245)

# Laid out at 14px per frame unit and brought down, so every edge in the lockup is resolved by more
# than one output pixel. 640 is the height the old lockup shipped at and the height the three
# <DuckPondBonus> layouts are sized against, so nothing on the screen has to move.
SUPERSAMPLE = 14
HEIGHT = 640

# name, left, top, width, height (frame units) and whether Figma mirrors it, back to front, exactly
# as node 7057:7971 stacks them. Both wings are one drawing; so are both gripping wingtips.
PLACEMENTS = (
    ("wing", 56.02, 36.61, 44.977, 39.747, True),
    ("duck", 13.14, 0.0, 84.724, 97.276, False),
    ("wing", 10.0, 36.61, 44.977, 39.747, False),
    ("sign", 25.44, 41.11, 61.161, 44.971, False),
    ("wingtip", 35.34, 36.61, 15.29, 10.793, False),
    ("wingtip", 63.22, 36.61, 15.29, 10.793, False),
)


def compose(scale):
    """The lockup on a transparent frame, at `scale` pixels per frame unit."""
    canvas = Image.new("RGBA", (round(FRAME[0] * scale), round(FRAME[1] * scale)), (0, 0, 0, 0))
    for name, x, y, width, height, mirror in PLACEMENTS:
        art = Image.open(LAYERS / f"{name}.webp").convert("RGBA")
        if mirror:
            art = art.transpose(Image.FLIP_LEFT_RIGHT)
        art = art.resize((round(width * scale), round(height * scale)), Image.LANCZOS)
        canvas.alpha_composite(art, (round(x * scale), round(y * scale)))
    return canvas


def verify():
    """How much of a rebuild at the flat export's scale lands on the flat export, pixel for pixel."""
    flat = Image.open(FLAT).convert("RGB")
    rebuilt = Image.new("RGB", flat.size, PAPER)
    layered = compose(FLAT_SCALE)
    rebuilt.paste(layered, (0, 0), layered)
    difference = np.abs(np.asarray(rebuilt, int) - np.asarray(flat, int)).sum(axis=2)
    return rebuilt, (difference < 24).mean()


def main():
    rebuilt, share = verify()
    print(f"rebuild matches the design's own render on {share:.1%} of the frame")
    if share < 0.85:
        raise SystemExit("layers no longer land on the design — check source/logo against Figma")

    lockup = compose(SUPERSAMPLE)
    lockup = lockup.crop(lockup.getbbox())
    width = round(lockup.width * HEIGHT / lockup.height)
    lockup = lockup.resize((width, HEIGHT), Image.LANCZOS)
    lockup.save(OUT, quality=88, method=6)
    print(f"wrote {OUT.relative_to(ROOT)} ({lockup.width}x{lockup.height}, {OUT.stat().st_size:,}B)")

    flat = Image.open(FLAT).convert("RGB")
    check = Image.new("RGB", (flat.width * 3 + 48, flat.height), (26, 26, 34))
    shown = lockup.resize((round(flat.height * lockup.width / lockup.height), flat.height))
    paper = Image.new("RGB", shown.size, PAPER)
    paper.paste(shown, (0, 0), shown)
    check.paste(paper, (0, 0))
    check.paste(rebuilt, (flat.width + 24, 0))
    check.paste(flat, (flat.width * 2 + 48, 0))
    check.save(VERIFY)
    print(f"wrote {VERIFY.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
