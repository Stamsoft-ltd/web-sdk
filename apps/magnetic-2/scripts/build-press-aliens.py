#!/usr/bin/env python3
"""The alien row that HOLDS the press hint — MOTHERSHIP design 9273:27091 ("you won gravity").

The congratulations screen's press line used to be a text line on a dark pill, with a row of alien
HEADS standing behind the pad's bottom edge. The design (2026-09-09) has the aliens hold a board
with the line written on it, so the row and the hint are one object.

The design draws that object ONCE, with three aliens (Figma 9273:27398, a 558x248 group of 57
vector parts plus a text node). The game needs 3, 4 AND 5 of them — one per triggering scatter —
so this script rebuilds the group from its parts and widens it:

  * Every part is rasterised from its own SVG (art-src/press_aliens/<node>.svg, downloaded from the
    design) at its own box out of parts.tsv, in document order. The TEXT is not among them, which
    is the point: the board is baked without a line on it and <WonPanel> draws the localised one.
  * The row is then cut at the two gaps BETWEEN aliens and re-assembled as
    left-cap + middle x (n - 2) + right-cap. The board is flat between the aliens, so a seam in
    that gap is invisible, and every variant keeps the design's own end caps and its exact pitch.

Widths (design units, the 1200x670 frame): 3 -> 558, 4 -> 712.86, 5 -> 867.72; height is always
248. WonPanel centres them on the pad and places the text off BOARD_* below.

Run:  python3 scripts/build-press-aliens.py
"""

from __future__ import annotations

from pathlib import Path

import cairosvg
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art-src" / "press_aliens"
OUT = ROOT / "static" / "assets" / "components" / "ui"

WEBP = dict(quality=92, method=6, alpha_quality=100)

#: Rendered at this multiple of the design's own size. The row is drawn about 0.72 of the canvas
#: width, so 3x covers a 2400px-wide canvas without softening.
SCALE = 3
GROUP_W, GROUP_H = 558.0, 248.0

#: The three aliens' own x spans in the group, off the design's node boxes. The seams are the
#: midpoints of the two gaps between them.
ALIEN_SPANS = [(58.99, 187.29), (215.11, 341.64), (370.49, 496.98)]
SEAMS = [
    (ALIEN_SPANS[0][1] + ALIEN_SPANS[1][0]) / 2,
    (ALIEN_SPANS[1][1] + ALIEN_SPANS[2][0]) / 2,
]


def compose() -> Image.Image:
    """The design's three-alien group, rasterised part by part, text excluded."""
    canvas = Image.new("RGBA", (round(GROUP_W * SCALE), round(GROUP_H * SCALE)), (0, 0, 0, 0))
    for line in (SRC / "parts.tsv").read_text().split("\n"):
        if not line.strip():
            continue
        node, _uuid, x, y, w, h = line.split()
        png = cairosvg.svg2png(
            url=str(SRC / f"{node}.svg"),
            output_width=max(1, round(float(w) * SCALE)),
            output_height=max(1, round(float(h) * SCALE)),
        )
        part = Image.open(__import__("io").BytesIO(png)).convert("RGBA")
        canvas.alpha_composite(part, (round(float(x) * SCALE), round(float(y) * SCALE)))
    return canvas


def widen(row: Image.Image, aliens: int) -> Image.Image:
    """`aliens` of them, by repeating the middle slice — the board is flat where it is cut."""
    s0, s1 = (round(seam * SCALE) for seam in SEAMS)
    left, middle, right = row.crop((0, 0, s0, row.height)), row.crop((s0, 0, s1, row.height)), row.crop((s1, 0, row.width, row.height))
    out = Image.new("RGBA", (left.width + middle.width * (aliens - 2) + right.width, row.height), (0, 0, 0, 0))
    x = 0
    for tile in [left, *[middle] * (aliens - 2), right]:
        out.alpha_composite(tile, (x, 0))
        x += tile.width
    return out


def board_box(row: Image.Image) -> tuple[float, float, float, float]:
    """The board's own box in group units, measured off the composed art: the purple is the only
    thing on the row that is neither the aliens' green nor their dark outline."""
    px = row.load()
    xs, ys = [], []
    for y in range(0, row.height, 2):
        for x in range(0, row.width, 2):
            r, g, b, a = px[x, y]
            if a > 200 and b > 90 and b > g + 40 and r > 40:  # purple fill / its edge
                xs.append(x)
                ys.append(y)
    return (min(xs) / SCALE, min(ys) / SCALE, max(xs) / SCALE, max(ys) / SCALE)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    row = compose()
    x0, y0, x1, y1 = board_box(row)
    print(f"group {row.width}x{row.height}px  ({GROUP_W}x{GROUP_H} design units at {SCALE}x)")
    print(f"board box in group units: x {x0:.1f}..{x1:.1f}  y {y0:.1f}..{y1:.1f}")
    for aliens in (3, 4, 5):
        art = row if aliens == 3 else widen(row, aliens)
        dst = OUT / f"my_press_aliens_{aliens}.webp"
        art.save(dst, "WEBP", **WEBP)
        print(
            f"{aliens} aliens  {art.width}x{art.height}px  "
            f"({art.width / SCALE:.2f}x{art.height / SCALE:.2f} design)  ->  {dst.name}  {dst.stat().st_size}B"
        )


if __name__ == "__main__":
    main()
