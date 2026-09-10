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

# The plate art was replaced 2026-09-08 with the design's belly-less drawing (Figma 9148:31503,
# art-src/win/plate.png; the retired export with the saucer's belly baked into its top edge is
# kept as plate_belly_retired.png). That node sits loose on the canvas, not in a win screen, so it
# has no render box in the frame: the plate is placed by its SLAB instead — the purple body,
# measured on the retired export exactly as WIN_CARD_PLATE_SLAB was (rows with >=70% horizontal
# ink coverage, columns with >=25% vertical) and mapped through the LOCKUP plate box:
SLAB = (289.0, 233.5, 636.0, 197.5)
# The new drawing is proportionally wider (slab 3.6:1 against the retired 3.2:1), so it is fitted
# by WIDTH at its own aspect and centred on the retired slab's centre line.
#
# With no belly in the plate, the saucer (which has its own) is drawn OVER the plate, at its
# design box — belly visible above the wordmark exactly as the screens show it. The retired belly
# ran down to the slab top while the saucer sprite's stops 27 units short of it; that band lies
# behind the wordmark on every tier (its top is 20-60 units above the saucer's bottom), so it is
# not bridged. Seating the saucer on the plate instead was tried and rejected: it pushed the belly
# behind the wordmark and left a bare dome.
SLAB_ROW_COVER = 0.70
SLAB_COL_COVER = 0.25

# The saucer was replaced the same day with the design's ship (Figma 9148:31504 — the one the
# in-game background flies, art-src/win/saucer.png is static/assets/components/ui/ufo_ship.webp;
# the retired dome-and-belly export is saucer_retired.png). It too has no box in a win screen, so
# it is fitted by WIDTH to the retired saucer's ink and bottom-aligned to it — these are the
# retired export's ink fractions (x, y, w, h of its 552x434 file), which through the LOCKUP saucer
# box gave the 260.5-wide rect the table used to carry.
SAUCER_RETIRED_FRAC = (14 / 552, 31 / 434, 521 / 552, 368 / 434)
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


Rect = tuple[float, float, float, float]  # x, y, w, h in frame units


def place(box, frac) -> Rect:
    """A node box + the art's ink fractions -> the ink's rect in frame units."""
    bx, by, bw, bh = box
    fx, fy, fw, fh = frac
    return (bx + bw * fx, by + bh * fy, bw * fw, bh * fh)


def fmt(rect: Rect, key: str | None = None) -> str:
    """A frame rect as the centre-relative TS literal winCardTiers.ts uses."""
    x, y, w, h = rect
    lead = f"key: '{key}', " if key else ""
    return f"{{ {lead}cx: {x + w / 2 - FRAME_W / 2:.1f}, cy: {y + h / 2 - FRAME_H / 2:.1f}, w: {w:.1f}, h: {h:.1f} }}"


def slab_fracs(art: Image.Image) -> Rect:
    """The plate body inside the trimmed art, as fractions (left, top, right, bottom)."""
    a = art.getchannel("A").point(lambda v: 255 if v > 8 else 0)
    w, h = a.size
    px = a.load()
    rows = [y for y in range(h) if sum(1 for x in range(w) if px[x, y]) >= SLAB_ROW_COVER * w]
    cols = [x for x in range(w) if sum(1 for y in range(h) if px[x, y]) >= SLAB_COL_COVER * h]
    return (cols[0] / w, rows[0] / h, (cols[-1] + 1) / w, (rows[-1] + 1) / h)


def saucer_belt(art: Image.Image) -> float:
    """Where the saucer's glass dome ends and its purple belly begins, as a fraction of the sprite's
    height, read down the CENTRE fifth of the sprite: the first row, from the top, whose opaque
    pixels there average purple (R and G both more than 60 below B) for four rows running. Only
    the centre counts because the alien stands on the centre line and the design's ship (Figma
    9148:31504) seats its glass INSIDE the hull's rim — whole-row averages went purple at the rim's
    top, 60 units above where the glass actually ends, and clipped the alien down to its antennae.
    The beacon and its stem sit above the glass on the same centre line (the stem is purple too),
    so the search first has to reach the GLASS — four rows of pale blue, G within 60 of B — and
    only then takes the next purple band."""
    px = art.convert("RGBA").load()
    w, h = art.size
    x0, x1 = int(w * 0.4), int(w * 0.6)

    def mean(y: int) -> tuple[float, float, float] | None:
        pts = [px[x, y] for x in range(x0, x1) if px[x, y][3] > 128]
        if len(pts) < (x1 - x0) * 0.5:
            return None
        n = len(pts)
        return (sum(p[0] for p in pts) / n, sum(p[1] for p in pts) / n, sum(p[2] for p in pts) / n)

    # Sampled down the ship's centre column: beacon (185,90,208) and stem (64,21,133) are red
    # over green; the glass is (121,186,250) — green a clear 40+ over red under a bright blue —
    # for a third of the height; then the hull's top light (146,223,29) and hull (80,61,149).
    # So the glass is "green well above red, bright blue", and the hull is simply the first band
    # after the glass that is not glass. (A "purple = R and G both under B" test reads the glass
    # itself as purple, which is what clipped the alien down to its antennae.)
    def glass(y: int) -> bool:
        m = mean(y)
        return m is not None and m[2] > 200 and m[1] > m[0] + 40

    def solid(y: int) -> bool:
        return mean(y) is not None

    glass_top: float | None = None
    for y in range(0, h - 4):
        if glass_top is None:
            if all(glass(y + k) for k in range(4)):
                glass_top = y / h
        elif all(solid(y + k) and not glass(y + k) for k in range(4)):
            return glass_top, y / h
    sys.exit("build-win-card: no hull found under the saucer's glass")


def alien_head_frac(art: Image.Image) -> float:
    """How much of the alien sprite, from the top, is HEAD: the last row at least 80% as wide as
    the widest row, as a fraction of the height. The head is the widest part by far; the neck
    and body below it are under half its width."""
    a = art.getchannel("A").point(lambda v: 255 if v > 8 else 0)
    w, h = a.size
    px = a.load()
    widths = [sum(1 for x in range(w) if px[x, y]) for y in range(h)]
    widest = max(widths)
    last = max(y for y, wd in enumerate(widths) if wd >= 0.8 * widest)
    return (last + 1) / h


def place_plate(slab: Rect, art: Image.Image, sf: Rect) -> tuple[Rect, float]:
    """Fit the plate art by width so its own slab spans `slab`, centred on its centre line.
    Returns the plate rect and the top of its slab in frame units."""
    sl, st, sr, sb = sf
    w = slab[2] / (sr - sl)
    h = w * art.height / art.width
    x = slab[0] - sl * w
    slab_h = h * (sb - st)
    slab_top = slab[1] + slab[3] / 2 - slab_h / 2
    return (x, slab_top - st * h, w, h), slab_top


def place_saucer(box, art: Image.Image) -> Rect:
    """The design's ship, as wide as the retired saucer's ink and standing on its bottom line."""
    old = place(box, SAUCER_RETIRED_FRAC)
    w = old[2]
    h = w * art.height / art.width
    return (old[0], old[1] + old[3] - h, w, h)


# How much of the glass band the alien's head fills, top to bottom. The design's sample shows the
# whole head inside the dome with air around it — the head must fit the glass, not be cut by the
# hull, which is what carrying the retired dome's 145-unit alien box onto a 58-unit glass did.
ALIEN_HEAD_FILL = 0.8


def lockup_rects(lock, fracs, arts, sf: Rect, slab: Rect, glass, head: float) -> dict[str, Rect]:
    """Plate by slab, saucer by the retired saucer's footprint, alien SIZED AND CENTRED BY THE
    GLASS: the alien's node box was measured against the retired saucer's tall dome, and the
    design's ship carries a shallow bubble higher up, so the box's own y and size put the head
    under the hull. Here the head fills ALIEN_HEAD_FILL of the glass band and sits centred in it,
    on the ship's centre line, at the alien art's own aspect."""
    plate, _slab_top = place_plate(slab, arts["plate"], sf)
    saucer = place_saucer(lock["saucer"], arts["saucer"])
    glass_top = saucer[1] + saucer[3] * glass[0]
    glass_h = saucer[3] * (glass[1] - glass[0])
    art = arts["alien"]
    h = glass_h * ALIEN_HEAD_FILL / head
    w = h * art.width / art.height
    x = saucer[0] + saucer[2] / 2 - w / 2
    y = glass_top + glass_h / 2 - h * head / 2
    return {"plate": plate, "saucer": saucer, "alien": (x, y, w, h)}


def max_slab(slab: Rect) -> Rect:
    """The MAX screen draws the lockup through one similarity: map the slab the same way."""
    k = LOCKUP_MAX["plate"][2] / LOCKUP["plate"][2]
    x = LOCKUP_MAX["plate"][0] + (slab[0] - LOCKUP["plate"][0]) * k
    y = LOCKUP_MAX["plate"][1] + (slab[1] - LOCKUP["plate"][1]) * k
    return (x, y, slab[2] * k, slab[3] * k)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    fracs: dict[str, tuple[float, float, float, float]] = {}
    arts: dict[str, Image.Image] = {}
    total = 0
    for name, key in PIECES.items():
        art, frac = trim(name)
        fracs[name] = frac
        arts[name] = art
        art.save(OUT / f"{key}.webp", **WEBP)
        kb = (OUT / f"{key}.webp").stat().st_size // 1024
        total += kb
        print(f"  {key}.webp {art.size} {kb}KB")
    print(f"  -- {total}KB total\n")

    sf = slab_fracs(arts["plate"])
    glass = saucer_belt(arts["saucer"])
    head = alien_head_frac(arts["alien"])
    print(f"  saucer glass {glass[0]:.3f} -> hull {glass[1]:.3f} of its height; alien head {head:.3f} of its height\n")
    print("// ---- generated by scripts/build-win-card.py, paste into winCardTiers.ts ----")
    print(f"export const WIN_CARD_SAUCER_BELT = {glass[1]:.3f};")
    print(
        f"export const WIN_CARD_PLATE_SLAB = {{ left: {sf[0]:.3f}, right: {sf[2]:.3f},"
        f" top: {sf[1]:.3f}, bottom: {sf[3]:.3f} }};\n"
    )
    for tier, spec in TIERS.items():
        lock = spec.get("lockup", LOCKUP)
        slab = max_slab(SLAB) if lock is LOCKUP_MAX else SLAB
        rects = lockup_rects(lock, fracs, arts, sf, slab, glass, head)
        plaq = spec.get("plaque", PLAQUE)
        word_name, word_box = spec["word"]
        print(f"\t{tier}: {{")
        print(f"\t\tword: {fmt(place(word_box, fracs[word_name]), PIECES[word_name])},")
        for part in ("plate", "saucer", "alien"):
            print(f"\t\t{part}: {fmt(rects[part])},")
        px, py, pw, ph = plaq
        print(
            f"\t\tplaque: {{ cx: {px + pw / 2 - FRAME_W / 2:.1f}, cy: {py + ph / 2 - FRAME_H / 2:.1f},"
            f" w: {pw:.1f}, h: {ph:.1f} }},"
        )
        print("\t\tblobs: [")
        for blob_name, blob_box in spec["blobs"]:
            print(f"\t\t\t{fmt(place(blob_box, fracs[blob_name]), PIECES[blob_name])},")
        print("\t\t],")
        print("\t},")


if __name__ == "__main__":
    main()
