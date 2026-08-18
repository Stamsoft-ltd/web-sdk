#!/usr/bin/env python3
"""Rebuild the marquee symbol art and the bulb table that lights it.

Most of this game's symbols are marquee signs — the five royals (A, K, Q, J, 10), the ferris wheel,
the wild, and the three feature facades (MEGA COASTER, ROLLER WILDS, DUCK YOUR LUCK) — and their
bulbs are drawn into the art UNLIT. Their win presentation lights those bulbs from code — see
`SymbolBulbs.svelte` — which means the runtime needs to know where every bulb is. Hand-placing 400
coordinates would go stale the first time a symbol is re-drawn, so this script measures them off the
art itself and writes `src/game/symbolBulbs.ts`.

It also installs the art, because the two jobs share the same input and the same frame: a symbol that
ships one file goes to symbols/, one that ships a file per layout goes to modes/, and either way the
bulb coordinates are fractions of the frame so the same table serves every size.

Finding a bulb is a SHAPE problem, not a brightness one: A's letter body is gold and the 10's outline
is gold, so anything that keys on "bright and warm" returns the letter. What actually separates a
bulb is that it is a small, round, solid blob — hence the roundness, fill-ratio and
radius-population filters in `find_bulbs`.

Colour only ever narrows the field, and no single colour rule works, because a bulb is not drawn the
same way twice across this set. It can be:

  - CREAM on a gold body (the royals' bulbs, and the white dots on COASTER's blue letters)
  - saturated YELLOW on purple or red (the wheel's spokes, the W's three strokes)
  - a HOLE in a gold ribbon (the bulbs running the red bands of ROLLER WILDS, where the bulb fill is
    darker than the gold piping around it, so it registers as an enclosed gap and not as ink)

Mega Coaster carries all three at once. So rather than assign a rule per symbol and get it wrong,
`find_bulbs` runs every rule at every threshold, clusters the detections that landed on the same
bulb, and lets the shape and population filters throw out what the loose colour rules dragged in.
That is what closed the ferris wheel's outer rim, which resisted every positive-ink approach tried
(colour census, erosion, matched-disc, circle fitting, distance transform) for the simple reason that
those bulbs are not ink at all — they are holes punched through the rim arcs.

    python3 scripts/build-symbol-bulbs.py ~/Downloads

Sources must be a whole fraction of the 448x360 frame every symbol in this game is authored in — the
`-draw-high` exports are 448x360 exactly, so nothing is resampled. An earlier half-scale set worked
too (a uniform upscale lands each symbol where the artist put it, with no re-centring and no
per-symbol fudge), but any art arriving below full size will be visibly softer than its siblings.

Always eyeball the result. The overlay loop is three lines: parse the generated table back, draw a
ring per bulb over the source, and look at it — a count alone will not tell you a whole ring is
missing.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SYMBOL_DIR = ROOT / "static/assets/theme-park/v2/symbols"
MODES_DIR = ROOT / "static/assets/theme-park/v2/modes"
TABLE = ROOT / "src/game/symbolBulbs.ts"

FRAME = (448, 360)
# Asset stem -> (source file stem, board symbol name, palette, label for the generated comment). The
# royal source stems are Cyrillic А and К: that is how the exports arrived, and renaming them here
# would only hide it.
SOURCE_SUFFIX = "-draw-high"
# Layout variants for the symbols that ship one file per layout (the mobile builds carry a
# downscaled copy to keep texture memory down). Widths only — heights come from the frame aspect, so
# no variant is ever squeezed. Bulb coordinates are FRACTIONS of the frame, so one table serves all
# three sizes.
MODE_VARIANTS = [("desktop", 448), ("mobile", 184), ("mobile-landscape", 216)]

# stem = output filename stem. source = the artist's own filename stem (theirs, not ours: the royals
# arrived as Cyrillic А/К, the coaster car as "car", the balloons misspelt). name = the board symbol
# whose bulbs get measured, or None to install the art and detect nothing. variants = ships one file
# per layout under modes/ instead of a single frame under symbols/.
SYMBOLS = [
    dict(stem="l1-a", source="А", name="L1", label="A"),
    dict(stem="l2-k", source="К", name="L2", label="K"),
    dict(stem="l3-q", source="Q", name="L3", label="Q"),
    dict(stem="l4-j", source="J", name="L4", label="J"),
    dict(stem="l5-10", source="10", name="L5", label="10"),
    dict(stem="h5-ferris", source="wheel", name="H5", label="ferris wheel"),
    # The wilds and the feature facades are all marquee signs thick with bulbs, and all ship one file
    # per layout. Bulb coordinates are fractions of the frame, so one table serves all three sizes.
    dict(stem="wild", source="WILD", name="W", label="wild", variants=True),
    # The Mega Wild is not a board symbol — it is a full-reel plaque drawn by <MegaWildFullReel> — so
    # its bulbs cannot live in a table keyed by SymbolName. It gets its own export instead.
    dict(stem="mega-wild", source="mega wild", export="MEGA_WILD_BULBS", label="mega wild",
         variants=True),
    dict(stem="mega-coaster", source="mega coaster", name="S_COASTER", label="mega coaster",
         variants=True),
    dict(stem="roller-wilds", source="roller wilds", name="S_ROLLER", label="roller wilds",
         variants=True),
    dict(stem="duck-your-luck", source="duckyourluck", name="S_DUCK", label="duck your luck",
         variants=True),
    # name None = install the art, detect nothing. Flat cartoons from the same batch, but nothing on
    # them is a marquee bulb, so a detector would only invent coordinates out of the balloons' dots
    # and the popcorn's highlights.
    dict(stem="h1-coaster", source="car", name=None, label="coaster car"),
    dict(stem="h2-duck", source="duck", name=None, label="duck"),
    dict(stem="h3-balloons", source="baloons", name=None, label="balloons"),
    dict(stem="h4-popcorn", source="popcorn", name=None, label="popcorn"),
]


# Foreground is 8-connected and background 4-connected, which is the pairing that makes "hole" mean
# what `enclosed` needs it to mean. It also matters for the shape filters: at 4-connectivity the
# anti-aliased crumbs along a letter's outline stay separate little round islands and sail through as
# bulbs, where at 8-connectivity they join up into the streak they actually are and get rejected.
NEIGHBOURS = ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1))


def components(mask):
    """Label 8-connected True runs, returning one (y, x) array per blob."""
    h, w = mask.shape
    seen = np.zeros((h, w), bool)
    out = []
    for sy, sx in zip(*np.nonzero(mask)):
        if seen[sy, sx]:
            continue
        stack = [(sy, sx)]
        seen[sy, sx] = True
        pts = []
        while stack:
            y, x = stack.pop()
            pts.append((y, x))
            for dy, dx in NEIGHBOURS:
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        out.append(np.array(pts))
    return out


def enclosed(mask):
    """The holes in `mask` — True runs of background that the border cannot reach.

    This is the negative-polarity detector. On ROLLER WILDS and the ferris wheel's rim the bulbs are
    DARKER than the gold piping they sit in, so they leave no ink of their own; what they leave is a
    perfectly round gap punched through a ribbon. Flood the background in from the edges and whatever
    it fails to reach is a hole.
    """
    h, w = mask.shape
    free = ~mask
    seen = np.zeros((h, w), bool)
    stack = []
    for y, x in [(y, x) for y in (0, h - 1) for x in range(w)] + [
        (y, x) for x in (0, w - 1) for y in range(h)
    ]:
        if free[y, x] and not seen[y, x]:
            seen[y, x] = True
            stack.append((y, x))
    while stack:
        y, x = stack.pop()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and free[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                stack.append((ny, nx))
    return free & ~seen


def closed(mask, alpha):
    """Bridge the 1px specular splits inside a bulb so it stays one blob."""
    grown = mask.copy()
    grown[1:, :] |= mask[:-1, :]
    grown[:-1, :] |= mask[1:, :]
    grown[:, 1:] |= mask[:, :-1]
    grown[:, :-1] |= mask[:, 1:]
    return grown & (alpha > 200)


def round_blobs(mask, scale):
    """Every small, round, solid component of `mask`, as (x, y, radius)."""
    out = []
    for pts in components(mask):
        (y0, x0), (y1, x1) = pts.min(axis=0), pts.max(axis=0)
        bw, bh = x1 - x0 + 1, y1 - y0 + 1
        if bw < 2 or bh < 2 or len(pts) < 7:
            continue
        radius = (bw + bh) / 4
        if not 0.62 <= bw / bh <= 1.6:  # round, not a streak along a bevel
            continue
        if len(pts) / (bw * bh) < 0.55:  # solid, not a ring or a wisp
            continue
        # The lower bound is deliberately loose. It used to be 0.012 of the symbol, tuned on the
        # royals where a dozen fat bulbs fill a letter; the facades pack a couple of hundred small
        # ones along their ribbons and that bound rejected every single one of them.
        if not 0.005 * scale <= radius <= 0.16 * scale:
            continue
        cy, cx = pts.mean(axis=0)
        out.append((float(cx), float(cy), float(radius)))
    return out


def find_bulbs(image):
    a = np.asarray(image).astype(np.float32)
    rgb, alpha = a[..., :3], a[..., 3]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    value = rgb.max(axis=2) / 255.0

    ink = np.argwhere(alpha > 16)
    (iy0, ix0), (iy1, ix1) = ink.min(axis=0), ink.max(axis=0)
    scale = min(ix1 - ix0 + 1, iy1 - iy0 + 1)

    # A bulb keeps a high BLUE channel where a saturated gold body does not.
    cream = lambda v: closed((alpha > 200) & (value > v) & (rgb.min(axis=2) / 255.0 > 0.55), alpha)
    # Saturated yellow, which `cream` rejects outright. Keyed off the red-blue spread, which the
    # purple spokes and red bands these sit on cannot fake.
    warm = lambda v: closed((alpha > 200) & (value > v) & (r >= g * 0.85) & (g > b) & ((g - b) > 90), alpha)
    # Same warm ribbon, read the other way up: the bulbs are the gaps in it.
    hole = lambda v: enclosed((alpha > 200) & (value > v) & (r >= g * 0.85) & (g > b) & ((g - b) > 90))

    # Sweep the threshold on every rule rather than picking a winner. Contrast between a bulb and the
    # body it sits on varies within one symbol, let alone across the set, and a bulb that only
    # separates at one threshold is still a bulb — the filters below are what keep the noise out.
    found = []
    for build in (cream, warm, hole):
        for v in (0.86, 0.82, 0.90, 0.78):
            found += round_blobs(build(v), scale)

    # Every rule, at every threshold, reports the same bulb slightly differently. Cluster the
    # detections by centre and collapse each cluster to one bulb: mean centre, MEDIAN radius. Median
    # rather than max, because a low threshold lets a bulb bleed into the body around it and the
    # inflated radius would be the one that then reaches the size cull.
    found.sort(key=lambda t: (t[1], t[0]))
    clusters = []
    for x, y, radius in found:
        for seed, members in clusters:
            if (x - seed[0]) ** 2 + (y - seed[1]) ** 2 <= (0.8 * radius) ** 2:
                members.append((x, y, radius))
                break
        else:
            clusters.append(((x, y), [(x, y, radius)]))
    bulbs = [
        (
            sum(m[0] for m in members) / len(members),
            sum(m[1] for m in members) / len(members),
            sorted(m[2] for m in members)[len(members) // 2],
        )
        for _, members in clusters
    ]

    # Drop the highlights and jewels that survived the shape filters. What separates a bulb from a
    # one-off highlight is not its size but how many things share that size: a design repeats a bulb
    # dozens of times. Measured as a band around each bulb's OWN radius — fixed buckets put two bulbs
    # of the same nominal size either side of an edge, and a single median would assume one bulb size
    # per symbol, which is false for the wild, whose fat letter bulbs and thin frame ring are both
    # real.
    radii = [bulb[2] for bulb in bulbs]
    return [b for b in bulbs if sum(abs(other - b[2]) <= 0.2 * b[2] for other in radii) >= 3]


def num(value):
    """Four decimal places with trailing zeros trimmed — what Prettier would leave behind.

    Matching its output means re-running this script does not show up as a diff of nothing.
    """
    return f"{value:.4f}".rstrip("0").rstrip(".") or "0"


def main():
    source_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "~/Downloads").expanduser()
    blocks, extras = [], []
    for entry in SYMBOLS:
        stem, label = entry["stem"], entry["label"]
        image = Image.open(source_dir / f'{entry["source"]}{SOURCE_SUFFIX}.png').convert("RGBA")
        if FRAME[0] % image.width or FRAME[1] % image.height:
            raise SystemExit(f"{stem}: {image.size} is not a whole fraction of {FRAME}")
        if entry.get("variants"):
            for suffix, width in MODE_VARIANTS:
                height = round(width * FRAME[1] / FRAME[0])
                image.resize((width, height), Image.LANCZOS).save(
                    MODES_DIR / f"{stem}-{suffix}-marquee.png"
                )
        else:
            image.resize(FRAME, Image.LANCZOS).save(SYMBOL_DIR / f"{stem}-marquee.png")
        if not entry.get("name") and not entry.get("export"):
            print(f"{stem}: {image.size} -> {FRAME}, art only")
            continue

        bulbs = find_bulbs(image)
        # Top-to-bottom then left-to-right, which is the order the chase runs in.
        bulbs.sort(key=lambda b: (round(b[1] / image.height, 2), b[0]))
        print(f"{stem}: {image.size} -> {FRAME}, {len(bulbs)} bulbs")

        indent = "\t" if entry.get("name") else ""
        rows = "\n".join(
            f"{indent}\t{{ x: {num(x / image.width)}, y: {num(y / image.height)}, "
            f"r: {num(r / image.width)} }},"
            for x, y, r in bulbs
        )
        if entry.get("name"):
            blocks.append(f'\t// {label} — {len(bulbs)} bulbs\n\t{entry["name"]}: [\n{rows}\n\t],')
        else:
            extras.append(
                f'\n/** {label} — {len(bulbs)} bulbs. */\n'
                f'export const {entry["export"]}: SymbolBulb[] = [\n{rows}\n];\n'
            )

    TABLE.write_text(HEADER + "\n".join(blocks) + "\n};\n" + "".join(extras))
    print(f"wrote {TABLE.relative_to(ROOT)}")


HEADER = """import type { SymbolName } from './types';

/**
 * Where the marquee bulbs sit on each symbol, and how big they are.
 *
 * GENERATED by `scripts/build-symbol-bulbs.py` — edit that, not this. The bulbs are drawn into the
 * symbol art unlit and lit from code on a win (<SymbolBulbs>), so these coordinates are measured off
 * the art itself rather than typed out; re-run the script whenever a symbol is re-exported.
 *
 * Coordinates are fractions of the symbol FRAME, origin top-left, so they survive any change to how
 * big a symbol is drawn on the board. `r` is a fraction of the frame's WIDTH.
 *
 * Ordered top-to-bottom then left-to-right, which is the order the chase runs in.
 */
export type SymbolBulb = { x: number; y: number; r: number };

export const SYMBOL_BULBS: Partial<Record<SymbolName, SymbolBulb[]>> = {
"""


main()
