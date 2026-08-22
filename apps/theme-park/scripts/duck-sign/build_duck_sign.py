#!/usr/bin/env python3
"""Build the DUCK YOUR LUCK symbol out of its layers, so its wings can flap.

The redesigned scatter (Figma 7057:7971) is a duck in a top hat holding a DUCK YOUR LUCK sign, with
a wing sticking out either side of it. Its win presentation is the lockup rocking and those two
wings beating, which means they cannot ship baked into one PNG — the runtime needs the wings as
their own sprites, and it needs to know where they sit and what they turn about.

THE WINGS WERE REDRAWN, and that is what this last pass is about. The first set were the duck's own
wings, spread and then all but covered by the sign: 141px blobs of flat gold with the feathers
pointing DOWN and out, soft at the edges and, at the size a symbol is drawn, more of a smudge either
side of the sign than a pair of wings. The replacements (7115:27451 and 7115:27449, one drawing and
its mirror) are a proper fanned wing with drawn primaries and a hard outline, and they sweep UP and
out to the sign's top corners, which is the pose a bird holds when it is showing something off. They
arrive four times the resolution of what they replace.

Nothing else changed. The duck (7115:27450) and the sign with its two gripping wingtips
(7115:27452) are the same drawings, re-exported from the same frame so that every layer still shares
one coordinate system.

    python3 scripts/duck-sign/build_duck_sign.py

It writes:

  static/assets/theme-park/v2/modes/duck-your-luck-{desktop,mobile,mobile-landscape}-marquee.png
  static/assets/theme-park/v2/symbols/duck-sign-wing-{left,right}-fan.png
  src/game/duckSignParts.ts
  scripts/duck-sign/verify_duck_sign.png

WHY IT IS BUILT THIS WAY

The design frame is 112x90 and every symbol in this game is drawn in a 448x360 one — the same
aspect, so a x4 export of the frame lands on our frame exactly, with no re-centring and no fudge.
Everything under source/ is such an export: the whole composition, and then the three layers it is
made of — the loose wings, the duck, and the sign with the two wingtips gripping it.

Nothing is placed from the node coordinates in Figma's metadata. Those are pre-rotation origins: the
left wing's box is at y=204 where the design renders it at 182, and the right wing's runs past the
bottom of the frame entirely. Each layer is LOCATED instead — slid over the composition until the
most of it matches pixel for pixel. Every one lands at its metadata x to the pixel, which is what
says the search found the real placement and not a lookalike.

Assembled rather than subtracted, and that was the second attempt. Cutting the wings back out of the
flattened composition looked like it should work — the wings are the backmost layer, so wherever one
shows there is nothing behind it — but the frame export and the node export resample a hair
differently, enough that flat gold matched and thin black outlines did not. What came out was a base
with the wings' outlines still ghosted into it. Compositing the layers has no such seam.

Each wing's PIVOT is the middle of the part of it the duck covers: the root, where it goes behind
the body. A wing turning about its root beats; one turning about its centre swims.

Always eyeball verify_duck_sign.png. It puts the rebuilt symbol beside the design's own render, so a
layer an inch out shows up as a difference rather than as a number that looks fine.
"""

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent / "source"
MODES_DIR = ROOT / "static/assets/theme-park/v2/modes"
SYMBOL_DIR = ROOT / "static/assets/theme-park/v2/symbols"
TABLE = ROOT / "src/game/duckSignParts.ts"
VERIFY = Path(__file__).resolve().parent / "verify_duck_sign.png"

FRAME = (448, 360)
# Same widths the rest of the symbol set ships at, so the scatter is not the one symbol that costs a
# full-size texture on a phone. Heights come from the frame aspect, so no variant is squeezed.
MODE_VARIANTS = [("desktop", 448), ("mobile", 184), ("mobile-landscape", 216)]

# Figma exports are always opaque, and this file's paper is #f5f5f5.
PAPER = np.array([245, 245, 245])
PAPER_TOLERANCE = 10
# How close two pixels have to be to count as the same drawing, summed over the three channels.
# Generous enough to absorb the exports' own resampling, tight enough that gold does not match gold.
SAME = 24


def keyed(path):
    """The export with its paper knocked out.

    Flooded in from the border rather than keyed by colour everywhere, so a near-white specular
    highlight inside the drawing — and both wings have one — stays part of the drawing.
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
    return np.dstack([rgb, np.where(seen, 0, 255)]).astype(int)


def locate(composition, part):
    """Where `part` sits in `composition`, and how much of it shows there.

    Scored on how much of the part matches EXACTLY rather than on mean difference: most of a wing is
    hidden behind the duck, and an average taken over the hidden half is dominated by whatever is
    covering it. What identifies the placement is the sliver that lines up perfectly.
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
    difference = np.abs(composition[y : y + ph, x : x + pw, :3] - part[..., :3]).sum(axis=2)
    return x, y, share, ink & (difference < SAME)


def rgba(array):
    return Image.fromarray(array.astype(np.uint8), "RGBA")


def num(value):
    """Four decimal places, trailing zeros trimmed — what Prettier would leave behind."""
    return f"{value:.4f}".rstrip("0").rstrip(".") or "0"


def main():
    composition = keyed(SOURCE / "composition.png")
    if composition.shape[:2] != (FRAME[1], FRAME[0]):
        raise SystemExit(f"composition is {composition.shape[1::-1]}, expected {FRAME}")

    layers = {}
    for name in ("wing-left", "wing-right", "duck", "sign"):
        part = keyed(SOURCE / f"{name}.png")
        x, y, share, visible = locate(composition, part)
        layers[name] = (part, x, y, visible)
        print(f"{name}: {part.shape[1]}x{part.shape[0]} at ({x}, {y}), {share:.0%} of it shows")

    # The base is everything that does not move, in the design's own order: the duck, then the sign
    # and the wingtips gripping it. The wings go behind it at runtime.
    base = Image.new("RGBA", FRAME, (0, 0, 0, 0))
    for name in ("duck", "sign"):
        part, x, y, _ = layers[name]
        base.alpha_composite(rgba(part), (x, y))
    for suffix, width in MODE_VARIANTS:
        height = round(width * FRAME[1] / FRAME[0])
        base.resize((width, height), Image.LANCZOS).save(
            MODES_DIR / f"duck-your-luck-{suffix}-marquee.png"
        )

    rows = []
    for side in ("left", "right"):
        part, x, y, visible = layers[f"wing-{side}"]
        rgba(part).save(SYMBOL_DIR / f"duck-sign-wing-{side}-fan.png")
        # The root: the middle of the part the duck covers.
        ys, xs = np.nonzero((part[..., 3] > 0) & ~visible)
        rows.append(
            f"\t{side}: {{\n"
            f"\t\tx: {num(x / FRAME[0])},\n"
            f"\t\ty: {num(y / FRAME[1])},\n"
            f"\t\twidth: {num(part.shape[1] / FRAME[0])},\n"
            f"\t\theight: {num(part.shape[0] / FRAME[1])},\n"
            f"\t\tpivotX: {num((x + xs.mean()) / FRAME[0])},\n"
            f"\t\tpivotY: {num((y + ys.mean()) / FRAME[1])},\n"
            f"\t}},"
        )
    TABLE.write_text(HEADER + "\n".join(rows) + "\n};\n")
    print(f"wrote {TABLE.relative_to(ROOT)}")

    rebuilt = Image.new("RGBA", FRAME, (0, 0, 0, 0))
    for side in ("left", "right"):
        _, x, y, _ = layers[f"wing-{side}"]
        rebuilt.alpha_composite(Image.open(SYMBOL_DIR / f"duck-sign-wing-{side}-fan.png"), (x, y))
    rebuilt.alpha_composite(base)
    check = Image.new("RGBA", (FRAME[0] * 2 + 24, FRAME[1]), (26, 26, 34, 255))
    check.alpha_composite(rebuilt, (0, 0))
    check.alpha_composite(Image.open(SOURCE / "composition.png").convert("RGBA"), (FRAME[0] + 24, 0))
    check.save(VERIFY)
    print(f"wrote {VERIFY.relative_to(ROOT)}")


HEADER = """/**
 * The DUCK YOUR LUCK scatter's two loose wings: where each sits on the symbol frame, and the point
 * it beats about.
 *
 * GENERATED by `scripts/duck-sign/build_duck_sign.py` — edit that, not this. The symbol ships as a
 * base (the duck, the sign and the wingtips gripping it) plus these two wings, so that a win can
 * flap them; drawing them at these coordinates behind the base reproduces the design exactly.
 * See <DuckSign>.
 *
 * All six numbers are fractions of the symbol FRAME, origin top-left, so they survive any change to
 * how big the symbol is drawn. `pivotX`/`pivotY` are in the same frame space, not in the wing's.
 */
export type DuckSignWing = {
\tx: number;
\ty: number;
\twidth: number;
\theight: number;
\tpivotX: number;
\tpivotY: number;
};

export const DUCK_SIGN_WINGS: Record<'left' | 'right', DuckSignWing> = {
"""


main()
