#!/usr/bin/env python3
"""Build the struck-through SOUND glyph for the menu popover and the bar's mute button.

MUSIC has had an "off" icon since the Version2 art landed -- menu_music_off.webp, the note with a
diagonal slash drawn through it -- but SOUND never did, so muted sound was signalled by dimming the
speaker to 40% opacity. Two rows one above the other, one struck through and one merely faded, do
not read as the same control in two states (user pass 2026-09-04: "make the sound button to be like
the music with /").

There is no exported off-state for the speaker, so it is drawn here from the ON-state SVG plus the
SAME slash the note wears, measured off menu_music_off.webp:

    corner to corner of a square box, 45 degrees, 8.27% of the box across (perpendicular)

The canvas is SQUARE while ic_sound.svg is 22.5 x 16.09, and that is deliberate: both icons are
`contain`-fitted into the same 20x20 glyph box, so a square off-state whose speaker is drawn at the
on-state's own aspect puts the two speakers at exactly the same size, and lets the slash overhang
into the empty space above and below -- which is what the note's does. Squaring the box after the
fact is what forced menu_music_off's 0.895 correction in HudHtml; this one needs none.

Run:  python3 scripts/build-sound-off-icon.py
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

import cairosvg
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / "static" / "assets" / "components" / "navbar" / "icons"
SRC = ICONS / "v2" / "ic_sound.svg"
REF = ICONS / "menu_music_off.webp"
OUT = ICONS / "menu_sound_off.webp"

# ic_sound.svg's own viewBox.
ART_W, ART_H = 22.5, 16.09
# Output box, and the supersample it is drawn at before downscaling.
SIZE = 96
SS = 8
# Slash, as fractions of the box side: perpendicular thickness, measured off menu_music_off.webp
# (an 11px horizontal run at 45 degrees on a 94px box -> 11 / sqrt(2) / 94).
SLASH_W = 0.0827
# How far past the corners the slash is drawn, so its ends are cut square by the box edge exactly
# as the note's are, rather than landing as two chamfered points inside it.
SLASH_OVERRUN = 0.12


def die(msg: str) -> None:
    sys.exit(f"build-sound-off-icon: {msg}")


def main() -> None:
    if not SRC.exists():
        die(f"missing {SRC}")

    big = SIZE * SS
    art_w = big
    art_h = round(big * ART_H / ART_W)
    png = cairosvg.svg2png(url=str(SRC), output_width=art_w, output_height=art_h)
    art = Image.open(io.BytesIO(png)).convert("RGBA")

    canvas = Image.new("RGBA", (big, big), (255, 255, 255, 0))
    canvas.alpha_composite(art, (0, (big - art_h) // 2))

    # The slash is UNION'd with the glyph (the note's is too -- there is no gap between the two,
    # they are one white shape), so a plain draw on the same layer is right.
    slash = Image.new("L", (big, big), 0)
    d = ImageDraw.Draw(slash)
    over = big * SLASH_OVERRUN
    d.line(
        [(-over, -over), (big + over, big + over)],
        fill=255,
        width=round(SLASH_W * big * 2**0.5),
    )
    a = np.array(canvas)
    a[:, :, 3] = np.maximum(a[:, :, 3], np.array(slash))
    a[:, :, :3] = 255

    out = Image.fromarray(a, "RGBA").resize((SIZE, SIZE), Image.LANCZOS)
    out.save(OUT, "WEBP", lossless=True, quality=100)

    ref = np.array(Image.open(REF).convert("RGBA"))[:, :, 3] > 128
    got = np.array(out)[:, :, 3] > 128
    print(f"wrote {OUT.relative_to(ROOT)}  {OUT.stat().st_size} bytes")
    print(f"  coverage {got.mean():.3f}  (menu_music_off {ref.mean():.3f})")


if __name__ == "__main__":
    main()
