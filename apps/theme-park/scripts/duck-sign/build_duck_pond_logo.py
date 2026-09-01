#!/usr/bin/env python3
"""Build the DUCK YOUR LUCK lockup the bonus screen wears, from the scatter's own arrangement.

    python3 scripts/duck-sign/build_duck_pond_logo.py

It writes:

  static/assets/theme-park/v2/duckpond/logo.webp
  scripts/duck-sign/verify_duck_pond_logo.png

THE SAME LOCKUP, NOT A SECOND ONE. The bonus screen and the scatter symbol are the same brand seen
at two sizes, and for as long as each was built from its own table of boxes they were free to drift
— which is exactly what happened: the scatter was redrawn from the painted Figma layers on
2026-08-28 and the bonus screen was left wearing the older flat drawing, so the feature opened on a
duck that did not match the one that had just triggered it. There is no layout in this file any
more. It calls `build_duck_sign.compose()`, which is the arrangement the symbol ships, and the two
cannot disagree because there is only one of them.

WITH THE WINGS IN IT, unlike the symbol's base. On the reel the wings are separate sprites so a win
can beat them; here the lockup is a still and they are simply part of the picture.

BUILT BIG AND BROUGHT DOWN. The bonus draws this about as wide as the whole board is tall, so it is
composed at SUPERSAMPLE times the symbol's frame — where the painted masters are still being
downsampled rather than blown up — and resized once to HEIGHT. That is sharper than any amount of
upscaling of the 448px symbol, which is what building it from the symbol's own PNG would have been.

Always eyeball verify_duck_pond_logo.png: the logo this writes beside the scatter it has to match,
brought to the same height. They are the same drawing, so anything that separates them is a bug.
"""

import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from build_duck_sign import FRAME, compose  # noqa: E402
from lib.figma_paper import resized  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "static/assets/theme-park/v2/duckpond/logo.webp"
VERIFY = Path(__file__).resolve().parent / "verify_duck_pond_logo.png"
SYMBOL = ROOT / "static/assets/theme-park/v2/modes/duck-your-luck-desktop-marquee.webp"

# Times the symbol's 448x360 frame. At 4 the sign is laid out across ~1250px against a master with
# about 1390px of ink in it, so every layer is still being reduced. Raising this past about 4.4
# starts upscaling the sign, which buys nothing.
SUPERSAMPLE = 4
# The height the old lockup shipped at, and the height the three <DuckPondBonus> layouts are sized
# against — nothing on the screen has to move.
HEIGHT = 640
# The paper the design is drawn on, for the verify sheet only. Nothing that ships is opaque.
PAPER = (245, 245, 245)


def logo():
    """The lockup, trimmed to its own ink and brought down to the height the screen wants."""
    art = compose(SUPERSAMPLE)
    art = art.crop(art.getbbox())
    return resized(art, (round(art.width * HEIGHT / art.height), HEIGHT))


def on_paper(art, height):
    """`art` at `height`, over the design's paper, so a sheet shows its rim rather than eating it."""
    shown = resized(art, (round(art.width * height / art.height), height))
    sheet = Image.new("RGB", shown.size, PAPER)
    sheet.paste(shown, (0, 0), shown)
    return sheet


def main():
    art = logo()
    art.save(OUT, quality=88, method=6)
    print(f"wrote {OUT.relative_to(ROOT)} ({art.width}x{art.height}, {OUT.stat().st_size:,}B)")

    # The scatter with its wings put back on, which is what this logo is a large copy of.
    symbol = resized(compose(), FRAME)
    shipped = Image.open(SYMBOL).convert("RGBA")
    panels = [on_paper(art, 360), on_paper(symbol, 360), on_paper(shipped, 360)]
    width = sum(panel.width for panel in panels) + 24 * (len(panels) - 1)
    check = Image.new("RGB", (width, 360), (26, 26, 34))
    at = 0
    for panel in panels:
        check.paste(panel, (at, 0))
        at += panel.width + 24
    check.save(VERIFY)
    print(f"wrote {VERIFY.relative_to(ROOT)}  — the logo, the same lockup at symbol size, the symbol")


if __name__ == "__main__":
    main()
