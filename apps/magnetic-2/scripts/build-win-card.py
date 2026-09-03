#!/usr/bin/env python3
"""Cut the MOTHERSHIP win card's pieces and PRINT the placement table for winCardTiers.ts.

The six assembled win screens live on the Design page under SECTION 4013:920 "Types of wins"
(EPIC 9034:25341 - SWEET 9034:25584 - MYTHIC 9034:25101 - LEGENDARY 9041:26358 -
WILD 9034:25823 - MAX 7103:5231). Every one is a full 1200x670 game screen with the card
composited on top, so the card is not something to invent -- it is something to MEASURE.

Each piece is a Figma node with a known render box in that 1200x670 frame, and art-src/win holds
that node rendered at 2x. Two facts follow, and they are the whole reason this script exists:

  * the exported PNG has transparent margin (the plate's own art starts 245px down its 968px
    export), so "draw the file at the node's box" is right but "the node's box IS the art" is not;
  * a sprite drawn at anything other than its trimmed aspect is a stretched sprite.

So every piece is trimmed to its own ink here, and the ink's box is mapped back into frame
coordinates and printed centre-relative (the card is drawn around the screen centre). The
printed table is pasted verbatim into src/game/winCardTiers.ts -- it is generated data, not
hand-tuned numbers.

Blob rotation is baked into the art rather than applied in code: the slime splat appears at 0/15/
30/45 degrees across the six screens, and Figma renders a rotated node already rotated, so four
exports remove four sets of trigonometry from the component.

Run from apps/magnetic-2:  python3 scripts/build-win-card.py
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art-src" / "win"
OUT = ROOT / "static" / "assets" / "components" / "win_boards"

WEBP = dict(quality=86, method=6, alpha_quality=88)

# The design frame every box below is measured in.
FRAME_W, FRAME_H = 1200.0, 670.0

# art file -> asset key. The blob is ONE drawing; the suffix is the rotation it was exported at.
PIECES = {
    "plate": "winCardPlate",
    "saucer": "winCardSaucer",
    "alien": "winCardAlien",
    "word_sweet": "winWordSweet",
    "word_wild": "winWordWild",
    "word_epic": "winWordEpic",
    "word_mythic": "winWordMythic",
    "word_legendary": "winWordLegendary",
    "word_max": "winWordMax",
    "blob_a15": "winBlobA15",
    "blob_a30": "winBlobA30",
    "blob_b0": "winBlobB0",
    "blob_b45": "winBlobB45",
}

# Figma render boxes (absoluteRenderBounds), frame-relative, straight off the REST API.
# The lockup is shared by the five tier screens; MAX draws the same art 1.2x and 24px higher,
# because its wordmark is stacked on two lines and needs the room.
LOCKUP = {"plate": (229, 34, 742, 484), "saucer": (458, 7, 276, 217), "alien": (500, 64, 191, 160)}
LOCKUP_MAX = {
    "plate": (156, -15, 890, 581),
    "saucer": (463, -17, 276, 217),
    "alien": (506, 40, 191, 160),
}
# The amount plaque is a DRAWN rounded rect (fill #3A3981, 4px stroke, radius 17.8), not art.
PLAQUE = (389, 488, 399, 120.1)
PLAQUE_MAX = (401, 501, 399, 120.1)

TIERS = {
    "sweet": {
        "word": ("word_sweet", (294.5, 145.5, 611, 357)),
        "blobs": [("blob_a15", (824.4, 174.4, 175.7, 151.3))],
    },
    "wild": {
        "word": ("word_wild", (272, 135, 638, 372)),
        "blobs": [("blob_a30", (810.8, 179.8, 183.2, 170.5))],
        # WILD is the one screen that lifts the alien 10px -- its wordmark rides higher.
        "lockup": {**LOCKUP, "alien": (500, 54, 191, 160)},
    },
    "epic": {
        "word": ("word_epic", (295, 136, 603, 353)),
        "blobs": [("blob_a15", (805.4, 174.4, 175.7, 151.3))],
    },
    "mythic": {
        "word": ("word_mythic", (299, 154, 602, 340)),
        "blobs": [("blob_a15", (819.4, 174.4, 175.7, 151.3))],
    },
    "legendary": {
        "word": ("word_legendary", (284.5, 142, 613, 358)),
        "blobs": [("blob_a30", (834.7, 169.8, 183.2, 170.5))],
    },
    "max": {
        "word": ("word_max", (303, 40, 594, 485)),
        "lockup": LOCKUP_MAX,
        "plaque": PLAQUE_MAX,
        # MAX throws the slime across the whole screen instead of parking one splat by the mark.
        "blobs": [
            ("blob_a30", (836.8, 158.8, 272.6, 254.3)),
            ("blob_b0", (156, 200, 161, 156)),
            ("blob_b0", (874, 357, 106, 102)),
            ("blob_b0", (982, 403, 106, 102)),
            ("blob_b0", (145, 140, 91, 88)),
            ("blob_b45", (220, 58, 126.6, 126.6)),
            ("blob_b45", (81, 23, 126.6, 126.6)),
            ("blob_b45", (1048, 295, 126.6, 126.6)),
            ("blob_b45", (1090, 414, 91.7, 91.7)),
        ],
    },
}


def trim(name: str) -> tuple[Image.Image, tuple[float, float, float, float]]:
    """Return the piece trimmed to its ink, plus that ink as fractions of the export."""
    src = SRC / f"{name}.png"
    if not src.exists():
        sys.exit(f"build-win-card: missing art-src/win/{name}.png")
    im = Image.open(src).convert("RGBA")
    bb = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if bb is None:
        sys.exit(f"build-win-card: {name}.png is fully transparent")
    x0, y0, x1, y1 = bb
    frac = (x0 / im.width, y0 / im.height, (x1 - x0) / im.width, (y1 - y0) / im.height)
    return im.crop(bb), frac


def place(box, frac, key: str | None = None) -> str:
    """A node box + the art's ink fractions -> the ink's centre-relative rect, as a TS literal."""
    bx, by, bw, bh = box
    fx, fy, fw, fh = frac
    w, h = bw * fw, bh * fh
    cx = bx + bw * fx + w / 2 - FRAME_W / 2
    cy = by + bh * fy + h / 2 - FRAME_H / 2
    lead = f"key: '{key}', " if key else ""
    return f"{{ {lead}cx: {cx:.1f}, cy: {cy:.1f}, w: {w:.1f}, h: {h:.1f} }}"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    fracs: dict[str, tuple[float, float, float, float]] = {}
    total = 0
    for name, key in PIECES.items():
        art, frac = trim(name)
        fracs[name] = frac
        art.save(OUT / f"{key}.webp", **WEBP)
        kb = (OUT / f"{key}.webp").stat().st_size // 1024
        total += kb
        print(f"  {key}.webp {art.size} {kb}KB")
    print(f"  -- {total}KB total\n")

    print("// ---- generated by scripts/build-win-card.py, paste into winCardTiers.ts ----")
    for tier, spec in TIERS.items():
        lock = spec.get("lockup", LOCKUP)
        plaq = spec.get("plaque", PLAQUE)
        word_name, word_box = spec["word"]
        print(f"\t{tier}: {{")
        print(f"\t\tword: {place(word_box, fracs[word_name], PIECES[word_name])},")
        for part in ("plate", "saucer", "alien"):
            print(f"\t\t{part}: {place(lock[part], fracs[part])},")
        px, py, pw, ph = plaq
        print(
            f"\t\tplaque: {{ cx: {px + pw / 2 - FRAME_W / 2:.1f}, cy: {py + ph / 2 - FRAME_H / 2:.1f},"
            f" w: {pw:.1f}, h: {ph:.1f} }},"
        )
        print("\t\tblobs: [")
        for blob_name, blob_box in spec["blobs"]:
            print(f"\t\t\t{place(blob_box, fracs[blob_name], PIECES[blob_name])},")
        print("\t\t],")
        print("\t},")


if __name__ == "__main__":
    main()
