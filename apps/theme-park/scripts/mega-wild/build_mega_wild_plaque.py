#!/usr/bin/env python3
"""Re-letter the Mega Wild locomotive plaque as ROLLER WILD.

    python3 scripts/mega-wild/build_mega_wild_plaque.py

It writes:

  static/assets/theme-park/v2/modes/mega-wild-{desktop,mobile,mobile-landscape}-marquee.png
  scripts/mega-wild/verify_mega_wild_plaque.png

WHAT CHANGED, AND WHAT DID NOT

The design supplied three pieces: the locomotive with an EMPTY boiler face, and the two words that
go on it. The engine is the same drawing that shipped — measured, not assumed: scaled to the shipped
plaque's ink box, the two silhouettes agree to an IoU of 0.995. Only the lettering is new.

So the shipped plaque is the BASE, kept pixel for pixel, and the only thing this script repaints is
the patch of boiler face the old MEGA / WILD sat on. It does not rebuild the engine from the
supplied export, which is a smaller drawing (340x332 against the plaque's 323x306 ink box) and comes
back from any resample with softer gold. That is not cosmetic: `build_mega_wild_bulbs.py` finds the
six lit fittings on the finished PNG by the colour of their glass and the gold of their bezels, and
a resampled engine loses about a sixth of its gold — enough that a bezel stops reading as a ring
around its lamp and the table cannot be regenerated at all. Keeping the shipped pixels means the
lamp table comes out byte-identical, which is what "same train, same animation" has to mean.

The supplied engine is still used, for the one thing it alone has: the boiler face WITHOUT lettering,
which is what gets painted into the hole where the old words were. Resampling softness is harmless
there — the face is a flat dark gradient.

WHERE THE WORDS GO

The old lockup is isolated by differencing the shipped plaque against that empty face, inside a box
generous enough to hold the letters and no more; LOCKUP_BOX below is the ink box that difference
came out at. The new pair is fitted into it by ONE uniform scale, so the relative sizes the design
drew (WILD set larger than ROLLER, as it was larger than MEGA) survive.

The fit is width-limited, and that is correct rather than a compromise: ROLLER has six letters where
MEGA had four, so the pair is proportionally wider (1.57 against the old 1.44) and matching the old
HEIGHT would run the words 184 wide. The boiler face measures 178 across at the top of the text band
— the words would foul its curve. Matching the width instead keeps the design's own margin, and the
letters come out a little shorter, which is simply what a longer word at a fixed width does.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent / "source"
MODES_DIR = ROOT / "static/assets/theme-park/v2/modes"
VERIFY = Path(__file__).resolve().parent / "verify_mega_wild_plaque.png"

FRAME = (448, 360)
# Same widths the rest of the symbol set ships at; heights follow the frame aspect, so no variant is
# squeezed. These are the sizes the three marquee PNGs already have.
MODE_VARIANTS = [("desktop", 448), ("mobile", 184), ("mobile-landscape", 216)]

# The shipped plaque's ink box in the 448x360 frame; the empty face is scaled onto it so the two
# drawings line up before they are differenced.
TRAIN_IN_FRAME = (62, 27, 385, 333)
# The ink box the old MEGA / WILD lockup occupied, measured by that difference.
LOCKUP_BOX = (140, 122, 308, 239)
# Where the difference is allowed to look. Big enough to hold the letters with room around them,
# small enough to stay inside the boiler face, so a resampling seam at the engine's edge cannot be
# mistaken for lettering and repainted.
SEARCH_BOX = (126, 108, 322, 253)
# A pixel differing by more than this is lettering rather than resampling noise.
LETTER_DIFF = 80
# The repaint has to reach past the letters' own antialiasing, and then fade in rather than land on
# a hard edge.
GROW, FEATHER = 5, 2.0
# The old lockup's two rows sat 3px apart in a block 117 tall. Kept as a share so the gap scales with
# the words instead of staying 3px however large they are drawn.
GAP_SHARE = 3 / 117


def ink(image: Image.Image, threshold: int = 8) -> Image.Image:
    """The drawing with its transparent margin cropped away."""
    box = image.getchannel("A").point(lambda v: 255 if v > threshold else 0).getbbox()
    if box is None:
        raise ValueError("source contains no visible pixels")
    return image.crop(box)


def empty_face() -> Image.Image:
    """The supplied lettering-free engine, laid over the shipped plaque's ink box."""
    train = ink(Image.open(SOURCE / "train-empty.png").convert("RGBA"))
    x0, y0, x1, y1 = TRAIN_IN_FRAME
    frame = Image.new("RGBA", FRAME, (0, 0, 0, 0))
    frame.alpha_composite(train.resize((x1 - x0, y1 - y0), Image.LANCZOS), (x0, y0))
    return frame


def letter_mask(shipped: Image.Image, empty: Image.Image) -> Image.Image:
    """Where the old words are: the two engines differ there and nowhere else that matters."""
    a = np.asarray(shipped).astype(int)
    b = np.asarray(empty).astype(int)
    differs = np.abs(a[..., :3] - b[..., :3]).max(axis=2) > LETTER_DIFF

    inside = np.zeros(differs.shape, bool)
    x0, y0, x1, y1 = SEARCH_BOX
    inside[y0:y1, x0:x1] = True
    mask = Image.fromarray((differs & inside).astype(np.uint8) * 255, "L")
    # Grow over the letters' antialiased rim, then soften the edge of the patch itself.
    return mask.filter(ImageFilter.MaxFilter(GROW * 2 + 1)).filter(
        ImageFilter.GaussianBlur(FEATHER)
    )


def lockup(top: Image.Image, bottom: Image.Image) -> Image.Image:
    """The two words stacked and centred on each other, at their natural relative sizes."""
    # The gap is a share of the FINISHED block, so it is solved for rather than applied: with the two
    # word heights fixed, height = words + GAP_SHARE * height.
    words_height = top.height + bottom.height
    height = round(words_height / (1 - GAP_SHARE))
    width = max(top.width, bottom.width)
    block = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    block.alpha_composite(top, ((width - top.width) // 2, 0))
    block.alpha_composite(bottom, ((width - bottom.width) // 2, height - bottom.height))
    return block


def build() -> Image.Image:
    shipped = Image.open(SOURCE / "plaque-shipped.png").convert("RGBA")
    if shipped.size != FRAME:
        raise ValueError(f"shipped plaque is {shipped.size}, expected {FRAME}")
    empty = empty_face()

    mask = letter_mask(shipped, empty)
    covered = np.asarray(mask).astype(int)
    print(f"repainting {int((covered > 8).sum())}px of boiler face")
    frame = Image.composite(empty, shipped, mask)

    roller = ink(Image.open(SOURCE / "word-roller.png").convert("RGBA"))
    wild = ink(Image.open(SOURCE / "word-wild.png").convert("RGBA"))
    words = lockup(roller, wild)
    bx0, by0, bx1, by1 = LOCKUP_BOX
    scale = min((bx1 - bx0) / words.width, (by1 - by0) / words.height)
    size = (round(words.width * scale), round(words.height * scale))
    words = words.resize(size, Image.LANCZOS)
    frame.alpha_composite(
        words,
        (round((bx0 + bx1) / 2 - size[0] / 2), round((by0 + by1) / 2 - size[1] / 2)),
    )
    print(f"lockup {words.width}x{words.height} in a {bx1 - bx0}x{by1 - by0} box (scale {scale:.3f})")
    return frame


def main() -> int:
    plaque = build()
    for name, width in MODE_VARIANTS:
        height = round(width * FRAME[1] / FRAME[0])
        out = MODES_DIR / f"mega-wild-{name}-marquee.png"
        plaque.resize((width, height), Image.LANCZOS).save(out, optimize=True)
        print(f"wrote {out.relative_to(ROOT)}  {width}x{height}")

    sheet = Image.new("RGBA", (FRAME[0] * 2 + 60, FRAME[1] + 40), (42, 11, 79, 255))
    sheet.alpha_composite(Image.open(SOURCE / "plaque-shipped.png").convert("RGBA"), (20, 20))
    sheet.alpha_composite(plaque, (FRAME[0] + 40, 20))
    sheet.save(VERIFY)
    print(f"wrote {VERIFY.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
