"""
The neon plate a REGULAR win's amount is drawn inside — see `<Win>`.

    python3 scripts/win-plate/build_win_plate.py

## What changed, and why this stopped being a compositor

v1 was assembled here: the flat neon card of Figma 7100:26891 squashed into a landscape box, with
the Roller Wilds star from the sign lockup composited onto its top rail, because the amount is
centred in the card and the star hangs outside that box.

v2 is one authored drawing (`art/concepts/small-win-plate-neon-v2.png`) — a plain neon lozenge, no
star — so there is nothing left to composite and this only CUTS it: crop to the art's own extent and
ship it at the width the game draws it. The crop matters. The drawing carries a wide violet halo
faded out to nothing on a canvas that is wider still, and shipping the canvas would put the plate's
centre off the amount's centre and waste a third of the pixels on transparency.

The measurements it prints are the ones `<Win>` places the amount with (PLAQUE_ASPECT and the
PLAQUE_TEXT_* family). Re-run it after re-drawing the art and carry them across — the number is
centred in the FIELD, which is not the same rect as the image.
"""

from pathlib import Path

import numpy as np
from PIL import Image

APP = Path(__file__).resolve().parents[2]
SOURCE = APP / "art" / "concepts" / "small-win-plate-neon-v2.png"
OUTPUT = APP / "static" / "assets" / "theme-park" / "v2" / "wins" / "small-win-plate-neon-v2.png"

#: The plate is drawn ~258 design units wide (SYMBOL_SIZE * 1.5 * aspect) on a 1200-unit frame, so
#: it lands near 500px once the stage is scaled up to a desktop canvas. v1 shipped 244 and was soft.
WIDTH = 512

#: The dark field inside the magenta keyline — where the amount has to land. The keyline and the
#: violet halo around it are far more RED than the field is, which is the test.
FIELD = lambda a: (a[..., 3] > 200) & (a[..., 0] < 90) & (a[..., 2] > 60)


def run_through(mask):
    """The CONTIGUOUS run of `mask` containing its middle, as (start, end-exclusive).

    Not `nonzero().min()..max()`: the keyline is bordered on BOTH sides by dark purple, so the thin
    ring outside it passes the field test too, and a min/max would hand back a rect a keyline's
    width too big on every side and let the amount sit on the neon.
    """
    middle = len(mask) // 2
    start = middle
    while start > 0 and mask[start - 1]:
        start -= 1
    end = middle
    while end < len(mask) - 1 and mask[end + 1]:
        end += 1
    return start, end + 1


def field_rect(rgba):
    """The field's edges as fractions of the art, scanned down/across the middle of the plate."""
    mask = FIELD(rgba)
    h, w = mask.shape
    top, bottom = run_through(mask[:, w // 2 - 2 : w // 2 + 3].all(1))
    left, right = run_through(mask[h // 2 - 2 : h // 2 + 3, :].all(0))
    return {
        "top": top / h,
        "bottom": bottom / h,
        "left": left / w,
        "right": right / w,
    }


def main() -> None:
    art = Image.open(SOURCE).convert("RGBA")
    art = art.crop(art.getbbox())
    field = field_rect(np.asarray(art).astype(int))

    out = art.resize((WIDTH, round(WIDTH * art.height / art.width)), Image.LANCZOS)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    out.save(OUTPUT, optimize=True)

    print(f"{OUTPUT.relative_to(APP)}  {out.width}x{out.height}  {OUTPUT.stat().st_size // 1024} KB")
    print(f"PLAQUE_ASPECT   {art.width / art.height:.4f}  ({art.width}x{art.height} cut)")
    print(f"field x {field['left']:.4f}..{field['right']:.4f}  y {field['top']:.4f}..{field['bottom']:.4f}")
    print(f"field w {field['right'] - field['left']:.4f}  h {field['bottom'] - field['top']:.4f}")
    print(f"field centre y {(field['top'] + field['bottom']) / 2 - 0.5:+.4f} of the plate's height")


if __name__ == "__main__":
    main()
