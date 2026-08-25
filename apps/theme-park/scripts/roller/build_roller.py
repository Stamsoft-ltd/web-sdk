#!/usr/bin/env python3
"""Build the ROLLER WILDS scatter out of its layers, so the star can turn and the words can pop.

The design draws this symbol (Figma 7063:17922) as five stacked drawings rather than as a picture:
a coaster emblem of loops and rails (7063:17916), the empty purple banner that covers its bottom
half (7063:17917), the two words ROLLER (7057:7967) and WILDS (7057:7968), and the star that sits
where the banner meets the emblem (7063:17918). Kept apart, the symbol can be alive — the star turns
at rest, and a win pops the two words against each other.

    python3 scripts/roller/build_roller.py

It writes:

  static/assets/theme-park/v2/modes/roller-wilds-{desktop,mobile,mobile-landscape}-sign.png
  static/assets/theme-park/v2/modes/roller-wilds-{desktop,mobile,mobile-landscape}-still.png
  static/assets/theme-park/v2/symbols/roller-wilds-{star,word-roller,word-wilds}.png
  src/game/rollerParts.ts
  scripts/roller/verify_roller.png

WHY IT IS BUILT THIS WAY

NOTHING IS PLACED FROM FIGMA'S NODE COORDINATES. The star's box is the proof: metadata puts it at
x=69 in a frame that starts at x=7, which is the upper RIGHT of a symbol that draws its star at the
top MIDDLE. Those boxes are pre-transform origins. Every layer is LOCATED instead — its own x4
export slid over the x4 export of the whole group until the most of it matches pixel for pixel —
which is exact here because both come out of the same renderer at the same scale.

The layers come back OPAQUE, on Figma's #f5f5f5 paper, so each one is keyed by flooding in from its
border. Flooding rather than keying every near-white pixel: the star has a white specular highlight
and the words have white outlines, and a blanket key would eat both.

THE TWO WORDS ARE MEASURED, NOT THE BANNER THEY SIT ON. What a popping word needs is its own centre
to scale about, and that is the centre of its INK, not of its export box — the exports carry several
pixels of margin and the two words carry different amounts, so scaling about the box centres would
make one word drift while the other did not.

Always eyeball verify_roller.png: it puts the rebuilt symbol beside the design's own render, then
the poses either end of both animations, so a layer an inch out reads as a difference rather than as
a number that looks reasonable.
"""

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent / "source"
MODES_DIR = ROOT / "static/assets/theme-park/v2/modes"
SYMBOL_DIR = ROOT / "static/assets/theme-park/v2/symbols"
TABLE = ROOT / "src/game/rollerParts.ts"
VERIFY = Path(__file__).resolve().parent / "verify_roller.png"

FRAME = (448, 360)
# Same widths the rest of the symbol set ships at, so the scatter is not the one symbol that costs a
# full-size texture on a phone. Heights come from the frame aspect, so no variant is squeezed.
MODE_VARIANTS = [("desktop", 448), ("mobile", 184), ("mobile-landscape", 216)]

# How tall the assembled emblem is drawn in the frame. Taken from the art this replaces, whose ink
# ran 296 of the frame's 360 rows: the symbol's weight on the board is a decision that was already
# made, and this rebuild is not the place to change it.
TARGET_INK_H = 296

# Figma exports are always opaque, and this file's paper is #f5f5f5.
PAPER = np.array([245, 245, 245])
PAPER_TOLERANCE = 10
# How close two pixels have to be to count as the same drawing, summed over the three channels.
# Generous enough to absorb the exports' own resampling, tight enough that gold does not match gold.
SAME = 24

# Bottom of the stack first, which is both the design's order and the order they are composited in.
LAYERS = ("emblem", "banner", "roller", "wilds", "star")
# The three that move at runtime. The other two are the sign they move on, and ship baked together.
LOOSE = ("star", "roller", "wilds")
# The one layer whose enclosed paper is background rather than drawing — see `keyed`.
HOLED = ("emblem",)


def keyed(path, holes=False):
    """The export with its paper knocked out.

    Flooded in from the border rather than keyed by colour everywhere, so the star's specular
    highlight and the words' white outlines stay part of the drawing.

    `holes` keys the paper the flood cannot reach as well — the gaps a drawing encloses. The emblem
    is a knot of loops with about twenty of them, and left opaque they shipped as white patches
    hanging inside the symbol on a purple board. It is off by default because for every other layer
    an enclosed white IS the drawing: the star's highlight, and the counters of the words' letters.
    """
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(int)
    h, w, _ = rgb.shape
    paper = np.abs(rgb - PAPER).max(axis=2) <= PAPER_TOLERANCE
    seen = np.zeros((h, w), bool)
    queue = deque()
    for y, x in [(y, x) for y in range(h) for x in (0, w - 1)] + [
        (y, x) for x in range(w) for y in (0, h - 1)
    ]:
        if paper[y, x] and not seen[y, x]:
            seen[y, x] = True
            queue.append((y, x))
    while queue:
        y, x = queue.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and paper[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                queue.append((ny, nx))
    return np.dstack([rgb, np.where(paper if holes else seen, 0, 255)]).astype(int)


def locate(composition, part):
    """Where `part` sits in `composition`, and how much of it shows there.

    Scored on how much of the part matches EXACTLY rather than on mean difference: the emblem is
    half covered by the banner, and an average taken over the covered half is dominated by whatever
    is covering it. What identifies the placement is the part that lines up perfectly.
    """
    ph, pw, _ = part.shape
    ink = part[..., 3] > 0
    best = None
    for y in range(composition.shape[0] - ph + 1):
        for x in range(composition.shape[1] - pw + 1):
            difference = np.abs(composition[y : y + ph, x : x + pw, :3] - part[..., :3]).sum(axis=2)
            share = (difference[ink] < SAME).mean()
            if best is None or share > best[0]:
                best = (share, x, y)
    share, x, y = best
    return x, y, share


def rgba(array):
    return Image.fromarray(array.astype(np.uint8), "RGBA")


def num(value):
    """Four decimal places, trailing zeros trimmed — what Prettier would leave behind."""
    return f"{value:.4f}".rstrip("0").rstrip(".") or "0"


def main():
    composition = keyed(SOURCE / "assembled4x.png")

    placed = {}
    for name in LAYERS:
        part = keyed(SOURCE / f"layer-{name}.png", holes=name in HOLED)
        x, y, share = locate(composition, part)
        placed[name] = (part, x, y)
        print(f"{name}: {part.shape[1]}x{part.shape[0]} at ({x}, {y}) in the x4 group, "
              f"{share:.0%} of it shows")

    # The design's own ink, and the transform that lands it in our frame at the weight the board
    # already draws this symbol at. One scale and one offset for every layer, so the composition
    # cannot come apart in the mapping.
    ink = composition[..., 3] > 0
    ys, xs = np.nonzero(ink)
    ink_box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    scale = TARGET_INK_H / (ink_box[3] - ink_box[1])
    ink_w = (ink_box[2] - ink_box[0]) * scale
    if ink_w > FRAME[0]:
        raise SystemExit(f"the emblem would be {ink_w:.0f} wide in a {FRAME[0]} frame")
    offset_x = (FRAME[0] - ink_w) / 2 - ink_box[0] * scale
    offset_y = (FRAME[1] - TARGET_INK_H) / 2 - ink_box[1] * scale
    print(f"group ink {ink_box[2] - ink_box[0]}x{ink_box[3] - ink_box[1]} "
          f"-> {ink_w:.0f}x{TARGET_INK_H} at scale {scale:.4f}")

    def into_frame(name):
        """One layer, resampled and positioned as the frame will draw it."""
        part, x, y = placed[name]
        width = max(1, round(part.shape[1] * scale))
        height = max(1, round(part.shape[0] * scale))
        return (rgba(part).resize((width, height), Image.LANCZOS),
                round(x * scale + offset_x),
                round(y * scale + offset_y))

    # The still: every layer, in order. This is what the board's spin trail ghosts and what a dimmed
    # symbol falls back to — pixi fades a container by fading each CHILD, so an assembly of
    # overlapping sprites brightens wherever two of them cross once it is faded.
    still = Image.new("RGBA", FRAME, (0, 0, 0, 0))
    # And the sign: the two layers that never move, which the live symbol draws the moving three on.
    sign = Image.new("RGBA", FRAME, (0, 0, 0, 0))
    for name in LAYERS:
        art, x, y = into_frame(name)
        still.alpha_composite(art, (x, y))
        if name not in LOOSE:
            sign.alpha_composite(art, (x, y))

    for suffix, width in MODE_VARIANTS:
        height = round(width * FRAME[1] / FRAME[0])
        still.resize((width, height), Image.LANCZOS).save(
            MODES_DIR / f"roller-wilds-{suffix}-still.png")
        sign.resize((width, height), Image.LANCZOS).save(
            MODES_DIR / f"roller-wilds-{suffix}-sign.png")

    rows = []
    for name in LOOSE:
        art, x, y = into_frame(name)
        art.save(SYMBOL_DIR / f"roller-wilds-{'star' if name == 'star' else f'word-{name}'}.png")
        # The INK's centre, not the box's: what a part scales and turns about has to be the middle
        # of the drawing, and these exports carry a different margin each.
        ays, axs = np.nonzero(np.asarray(art)[..., 3] > 0)
        rows.append(
            f"\t{name}: {{\n"
            f"\t\tx: {num((x + axs.mean() + 0.5) / FRAME[0])},\n"
            f"\t\ty: {num((y + ays.mean() + 0.5) / FRAME[1])},\n"
            f"\t\twidth: {num(art.width / FRAME[0])},\n"
            f"\t\theight: {num(art.height / FRAME[1])},\n"
            f"\t\tanchorX: {num((axs.mean() + 0.5) / art.width)},\n"
            f"\t\tanchorY: {num((ays.mean() + 0.5) / art.height)},\n"
            f"\t}},"
        )
        print(f"  {name} art {art.width}x{art.height} at ({x}, {y}), "
              f"ink centre ({x + axs.mean():.1f}, {y + ays.mean():.1f})")
    TABLE.write_text(HEADER + "\n".join(rows) + "\n};\n")
    print(f"wrote {TABLE.relative_to(ROOT)}")

    # The verify sheet: the rebuild, the design's own render, and then the extremes of both
    # animations, so a layer an inch out reads as a difference rather than as a plausible number.
    poses = [("rest", 0, 1, 1), ("star -30", -30, 1, 1), ("star +30", 30, 1, 1),
             ("win a", 0, 1.18, 0.88), ("win b", 0, 0.88, 1.18)]
    sheet = Image.new("RGBA", (FRAME[0] * (len(poses) + 1) + 24 * len(poses), FRAME[1]),
                      (26, 26, 34, 255))
    reference = rgba(composition)
    reference = reference.resize(
        (round(reference.width * scale), round(reference.height * scale)), Image.LANCZOS)
    sheet.alpha_composite(reference, (round(offset_x), round(offset_y)))
    for index, (_, turn, roller_pop, wilds_pop) in enumerate(poses):
        pane = sign.copy()
        for name, pop in (("star", 1.0), ("roller", roller_pop), ("wilds", wilds_pop)):
            art, x, y = into_frame(name)
            ays, axs = np.nonzero(np.asarray(art)[..., 3] > 0)
            pivot = (x + axs.mean(), y + ays.mean())
            moved = art
            if pop != 1.0:
                moved = art.resize((max(1, round(art.width * pop)), max(1, round(art.height * pop))),
                                   Image.LANCZOS)
            if name == "star" and turn:
                moved = moved.rotate(turn, resample=Image.BICUBIC, expand=True)
            pane.alpha_composite(moved, (round(pivot[0] - moved.width / 2),
                                         round(pivot[1] - moved.height / 2)))
        sheet.alpha_composite(pane, ((FRAME[0] + 24) * (index + 1), 0))
    sheet.save(VERIFY)
    print(f"wrote {VERIFY.relative_to(ROOT)}")


HEADER = """// GENERATED by scripts/roller/build_roller.py — edit that, not this.
//
// The ROLLER WILDS scatter's three moving parts: the star that turns while the symbol just sits
// there, and the two words that pop against each other when it wins. Everything else about the
// symbol — the coaster emblem and the banner over it — never moves and ships as one sign.
//
// Every number is a fraction of the 448x360 symbol frame, which is what makes one table serve
// every size the board draws a symbol at. See <RollerWilds>.

export type RollerPiece = {
\t/** The middle of the DRAWING in the frame: what the part turns and scales about. */
\tx: number;
\ty: number;
\twidth: number;
\theight: number;
\t/**
\t * That same point as a fraction of the part's own art, for the sprite's anchor. The exports
\t * carry a margin, and a different one each, so this is not 0.5.
\t */
\tanchorX: number;
\tanchorY: number;
};

export const ROLLER_PARTS: Record<'star' | 'roller' | 'wilds', RollerPiece> = {
"""


main()
