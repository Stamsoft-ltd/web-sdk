#!/usr/bin/env python3
"""Take the WILD apart so its letter can pop.

The redesigned wild is a gold oval plate (Figma 7052:7925) with a tri-colour W on it (7052:7927),
and the design ships those two halves apart because the letter is what moves: on a win it pops up
from nothing to full size. So the symbol cannot ship as one PNG, and the runtime needs to know where
on the plate the W belongs.

    python3 scripts/wild/build_wild.py

It writes:

  static/assets/theme-park/v2/modes/wild-{desktop,mobile,mobile-landscape}-marquee.png
  static/assets/theme-park/v2/symbols/wild-w.webp
  src/game/wildParts.ts
  scripts/wild/verify_wild.png

WHY IT IS BUILT THIS WAY

Every symbol in this game is drawn in a 448x360 frame and these design nodes sit in a 112x90 one, so
a x4 export lands on our frame exactly, with no re-centring and no per-symbol fudge. The exports are
opaque on #f5f5f5 paper, which is flooded out from the border rather than keyed by colour everywhere,
so the star's white highlight stays part of the drawing. Same as scripts/duck-sign — read that one
for the long version.

Unlike the duck sign, there is nothing to LOCATE the W against. Figma has no node with the two
assembled: 7052:7921 is the plate again at a slightly different crop, not a lockup. So the W is
CENTRED on the plate's field — the big purple oval inside the gold rim, found here rather than typed
out, so re-drawing the plate moves the letter with it — and sized to a share of that field's width.
That one number is the only judgement call in this file.
"""

from collections import deque
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.figma_paper import keyed, resized  # noqa: E402
from lib.web_image import save_web  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent / "source"
MODES_DIR = ROOT / "static/assets/theme-park/v2/modes"
SYMBOL_DIR = ROOT / "static/assets/theme-park/v2/symbols"
TABLE = ROOT / "src/game/wildParts.ts"
VERIFY = Path(__file__).resolve().parent / "verify_wild.png"

FRAME = (448, 360)
# Where the design puts the plate inside its 112x90 frame, times four. Its own node box, which for a
# lone image is the placement — there is no rotation on it to make the number lie.
PLACEMENT = (44, 24)
MODE_VARIANTS = [("desktop", 448), ("mobile", 184), ("mobile-landscape", 216)]

# How wide the W's INK is drawn, as a share of the plate's purple field. Sized off the field rather
# than off the frame so the letter keeps its margin if the plate is ever re-drawn a different size.
LETTER_SHARE = 0.74


def largest_run(mask):
    """The biggest 4-connected True region of `mask`, as its (x0, y0, x1, y1) box."""
    h, w = mask.shape
    seen = np.zeros((h, w), bool)
    best = None
    for sy, sx in zip(*np.nonzero(mask)):
        if seen[sy, sx]:
            continue
        queue = deque([(sy, sx)])
        seen[sy, sx] = True
        points = []
        while queue:
            y, x = queue.popleft()
            points.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    queue.append((ny, nx))
        if best is None or len(points) > len(best):
            best = points
    points = np.array(best)
    return points[:, 1].min(), points[:, 0].min(), points[:, 1].max(), points[:, 0].max()


def field_of(plate):
    """The plate's purple field: the flat oval inside the gold rim.

    Keyed on blue-over-red-over-green, which is the plate's purple and nothing else on it — the rim
    and the star's frame are gold, the star's own fill is a lighter purple but it sits outside the
    oval. The three gems are the same purple as the field, so the largest connected run is taken
    rather than the whole mask's extent: the gems are separate islands on the rim.
    """
    r, g, b = plate[..., 0], plate[..., 1], plate[..., 2]
    purple = (plate[..., 3] > 0) & (b > r + 20) & (b > g + 40) & (r > g)
    return largest_run(purple)


def ink_box(part):
    """The part's drawn extent, ignoring the transparent margin its export carries."""
    ys, xs = np.nonzero(part[..., 3] > 0)
    return xs.min(), ys.min(), xs.max(), ys.max()


def rgba(array):
    return Image.fromarray(array.astype(np.uint8), "RGBA")


def num(value):
    """Four decimal places, trailing zeros trimmed — what Prettier would leave behind."""
    return f"{value:.4f}".rstrip("0").rstrip(".") or "0"


def main():
    plate = keyed(SOURCE / "plate.png")
    letter = keyed(SOURCE / "w.png")

    # The plate is the whole base art — the mode files are it and nothing else, because the W is now a
    # separate sprite the runtime draws on top.
    base = Image.new("RGBA", FRAME, (0, 0, 0, 0))
    base.alpha_composite(rgba(plate), PLACEMENT)
    for suffix, width in MODE_VARIANTS:
        height = round(width * FRAME[1] / FRAME[0])
        save_web(resized(base, (width, height)), MODES_DIR / f"wild-{suffix}-marquee.webp")
    print(f"plate: {plate.shape[1]}x{plate.shape[0]} at {PLACEMENT}, {len(MODE_VARIANTS)} modes written")

    fx0, fy0, fx1, fy1 = field_of(plate)
    field_w, field_h = fx1 - fx0 + 1, fy1 - fy0 + 1
    print(f"field: {field_w}x{field_h} at ({fx0 + PLACEMENT[0]}, {fy0 + PLACEMENT[1]}) in the frame")

    # Trim the letter to its ink before measuring it. The export carries a transparent margin whose
    # width is an accident of how Figma bounded the node, and sizing off the untrimmed box would let
    # that margin decide how big the W is drawn.
    ix0, iy0, ix1, iy1 = ink_box(letter)
    ink = rgba(letter[iy0 : iy1 + 1, ix0 : ix1 + 1])
    save_web(ink, SYMBOL_DIR / "wild-w.webp")
    print(f"W: {ink.width}x{ink.height} of ink, trimmed from {letter.shape[1]}x{letter.shape[0]}")

    width = LETTER_SHARE * field_w
    height = width * ink.height / ink.width
    x = PLACEMENT[0] + fx0 + field_w / 2
    y = PLACEMENT[1] + fy0 + field_h / 2
    TABLE.write_text(
        HEADER
        + f"export const WILD_LETTER: WildLetter = {{\n"
        f"\tx: {num(x / FRAME[0])},\n"
        f"\ty: {num(y / FRAME[1])},\n"
        f"\twidth: {num(width / FRAME[0])},\n"
        f"\theight: {num(height / FRAME[1])},\n"
        f"}};\n"
    )
    print(f"wrote {TABLE.relative_to(ROOT)}")

    # The right half is the design's own wild, so a glance says whether the W landed where the artist
    # drew it and is drawn the size they drew it.
    rebuilt = base.copy()
    placed = resized(ink, (round(width), round(height)))
    rebuilt.alpha_composite(placed, (round(x - width / 2), round(y - height / 2)))
    check = Image.new("RGBA", (FRAME[0] * 2 + 24, FRAME[1]), (26, 26, 34, 255))
    check.alpha_composite(rebuilt, (0, 0))
    check.alpha_composite(rgba(keyed(SOURCE / "composition.png")), (FRAME[0] + 24, 0))
    check.save(VERIFY)
    print(f"wrote {VERIFY.relative_to(ROOT)}")


HEADER = """/**
 * Where the W sits on the wild's plate.
 *
 * GENERATED by `scripts/wild/build_wild.py` — edit that, not this. The symbol ships as a bare gold
 * plate plus this letter, so that a win can pop the letter on its own; see <WildLetter>.
 *
 * `x`/`y` are the letter's CENTRE and all four numbers are fractions of the symbol FRAME, origin
 * top-left, so they survive any change to how big the symbol is drawn.
 */
export type WildLetter = { x: number; y: number; width: number; height: number };

"""


main()
