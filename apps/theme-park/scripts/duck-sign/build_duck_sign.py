#!/usr/bin/env python3
"""Build the DUCK YOUR LUCK symbol out of its layers, so its wings can flap.

    python3 scripts/duck-sign/build_duck_sign.py

It writes:

  static/assets/theme-park/v2/modes/duck-your-luck-{desktop,mobile,mobile-landscape}-marquee.png
  static/assets/theme-park/v2/symbols/duck-sign-wing-{left,right}-fan.png
  src/game/duckSignParts.ts
  scripts/duck-sign/verify_duck_sign.png

WHY IT WAS REBUILT (2026-08-28)

The scatter's flap looked, in the reviewer's words, stupid, and the cause was not the animation. The
lockup that shipped was ONE painted picture with the wings already in it, and <DuckSign> drew two
more wings behind it — so a win swung a second pair of wings out from behind a pair that never
moved. No timing change could have fixed that. What was missing was the lockup as LAYERS.

Those layers are what this now builds from. `source/painted-{duck,wing,sign}.png` are the design's
own pieces (Figma 7115:27433 the duck, 7115:27434 and :27435 the wing, 7063:17878 the sign), and the
symbol is composed here rather than exported flat:

* the BASE — the duck and the sign it holds — is what ships as the three marquee files, and it has no
  wings in it at all, so the only wings on screen are the two that move;
* the two WINGS ship as their own sprites, drawn behind the base at the placements written into
  `duckSignParts.ts`.

ONE WING, MIRRORED. The two wing nodes are the same drawing — byte for byte, checked — so the right
wing is the left one flipped. They are also stored ALREADY ROTATED to their rest pose: the runtime
adds the beat on top of `REST_TURN`, and a sprite that has to be turned 15 degrees before it is even
at rest cannot be turned about its root by a single rotation.

A WING STARTS AT A SHOULDER. Each wing is placed by the one point on it that means anything — the
rounded mass at its lower right, which is the end that meets a bird — and it is turned about that
same point, because a wing turning about its root beats and one turning about its centre swims.

That shoulder is put BEHIND the sign, low enough to be on the duck's body. It was on the duck's HEAD
until 2026-08-28: the wings were placed by their middles at the sign's top edge, so what showed above
the sign was the whole inner half of each wing, sprouting either side of the hat (reviewer). Most of
a wing placed honestly is hidden — the duck is holding a sign in front of itself — and what is left
above the line is the fan, which is the part that reads as a wing anyway.

THE LAYOUT IS THE ONE THING TUNED BY LOOKING. Everything else follows from it. Always eyeball
verify_duck_sign.png: it shows the symbol assembled at rest and at both ends of the beat, so a wing
that swings out of the frame or unroots itself shows up as a picture rather than as a number.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.figma_paper import resized, turned  # noqa: E402
from lib.web_image import save_web  # noqa: E402

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

#: Where the two fixed pieces sit: centre x, centre y and width, all as fractions of the frame.
#: Picked against rendered candidates rather than derived — the design supplies the pieces and not an
#: arrangement of them. The constraints that decided it: the sign has to clear the bottom edge, and
#: the duck's head and hat have to clear the sign's top.
LAYOUT = {
    "duck": (0.5, 0.358, 0.32),
    "sign": (0.5, 0.657, 0.7),
}
#: The wing's shoulder, as a fraction of the wing DRAWING: the rounded mass at its lower right. The
#: feathers fan up and away from it, so this is the end a bird would be on.
WING_SHOULDER = (0.88, 0.72)
#: Where that shoulder goes on the FRAME, for the left wing; the right one mirrors it. Below the
#: sign's top edge (0.42 against 0.32) on purpose — see the note on shoulders above.
WING_ROOT = (0.4, 0.42)
#: How wide the wing is drawn, as a fraction of the frame. Wide enough that a shoulder hidden this
#: far down still puts the fan clear of the sign's sides.
WING_WIDTH = 0.36
#: The wings' rest pose, in degrees out from the drawing. Baked into the sprites — see the note on
#: mirroring above.
#:
#: NEGATIVE, and that is the whole difference between a duck and a badge. The drawing's feathers fan
#: up and away from the shoulder, so turning the left wing anti-clockwise about that shoulder swings
#: the fan DOWN: what came out was a pair of wings lying flat along the sign's top rail with their
#: tips drooping outward, which is emblem heraldry and not a bird (reviewer, 2026-08-28). Turned the
#: other way the fan lifts, the tips clear the hat, and the two wings make a V whose lines meet
#: somewhere behind the sign — which is exactly where the duck's body is.
REST_TURN = -20
#: Room around the frame for a wing to be turned in without the rotation clipping it. Only ever used
#: while composing; nothing this wide ships.
PAD = 160
#: How far <DuckSign> swings a wing either side of that. Only used here, to check at build time that
#: a wing at full beat still lands inside the frame; the component holds its own copy in radians.
FLAP = 13


def trimmed(name):
    """One source layer, cropped to its ink.

    Cropped rather than used whole because the exports carry different amounts of empty margin, and
    a placement is only meaningful against the drawing itself.
    """
    image = Image.open(SOURCE / f"painted-{name}.png").convert("RGBA")
    ys, xs = np.nonzero(np.asarray(image)[..., 3] > 8)
    return image.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


def scaled(art, width, scale, mirror=False):
    """`art` at `width` of the frame, optionally flipped."""
    piece = art.transpose(Image.FLIP_LEFT_RIGHT) if mirror else art
    pixels = round(FRAME[0] * scale * width)
    # Resampled premultiplied. Pillow mixes the colour under a zero alpha into every edge it touches,
    # so a straight-alpha scale of a cut-out drawing darkens its own outline — see the note in
    # lib/figma_paper.py.
    return resized(piece, (pixels, round(pixels * piece.height / piece.width)))


def corner(piece, centre_x, centre_y, scale):
    """Top-left of `piece` when its middle is put at (`centre_x`, `centre_y`) of the frame."""
    return (
        round(FRAME[0] * scale * centre_x - piece.width / 2),
        round(FRAME[1] * scale * centre_y - piece.height / 2),
    )


def num(value):
    """Four decimal places, trailing zeros trimmed — what Prettier would leave behind."""
    return f"{value:.4f}".rstrip("0").rstrip(".") or "0"


def build(scale=1):
    """The two fixed layers at `scale` times the frame: the piece, and where its top-left goes."""
    placed = {}
    for name, (centre_x, centre_y, width) in LAYOUT.items():
        piece = scaled(trimmed(name), width, scale)
        placed[name] = (piece, corner(piece, centre_x, centre_y, scale))
    return placed


def winged(scale=1, beat=0):
    """Both wings at rest (or `beat` degrees off it): the sprite, its top-left, and its root.

    Turned about the ROOT rather than about the sprite's middle, and turned on a padded frame rather
    than with trigonometry: the root then lands on exactly the frame coordinate `WING_ROOT` asked
    for, and the sprite is whatever ink is left around it. That matters because the same root is
    written into the parts table for <DuckSign> to beat about — a pivot derived twice, once here and
    once by arithmetic, is a pivot that can disagree with itself.
    """
    art = scaled(trimmed("wing"), WING_WIDTH, scale)
    pad = round(PAD * scale)
    width, height = round(FRAME[0] * scale), round(FRAME[1] * scale)
    placed = {}
    for side in ("left", "right"):
        mirror = side == "right"
        piece = art.transpose(Image.FLIP_LEFT_RIGHT) if mirror else art
        shoulder = (
            (1 - WING_SHOULDER[0] if mirror else WING_SHOULDER[0]) * piece.width,
            WING_SHOULDER[1] * piece.height,
        )
        root = ((1 - WING_ROOT[0] if mirror else WING_ROOT[0]) * width, WING_ROOT[1] * height)
        canvas = Image.new("RGBA", (width + pad * 2, height + pad * 2), (0, 0, 0, 0))
        canvas.alpha_composite(
            piece, (round(pad + root[0] - shoulder[0]), round(pad + root[1] - shoulder[1]))
        )
        turn = REST_TURN + beat
        canvas = turned(
            canvas, -turn if mirror else turn, expand=False, centre=(pad + root[0], pad + root[1])
        )
        box = canvas.getbbox()
        placed[side] = (canvas.crop(box), (box[0] - pad, box[1] - pad), root)
    return placed


def compose(scale=1, wings=True):
    """The whole lockup on a transparent frame, or just the part of it that never moves.

    `wings=False` is the symbol's BASE — see the note at the top on why the wings must not be in it.
    `scale` is what lets the bonus screen wear the same lockup at four times the size without a
    second layout to keep in step with this one: <DuckPondBonus>'s logo is this call, and the two
    cannot drift apart because there is only one arrangement.
    """
    pad = round(PAD * scale)
    width, height = round(FRAME[0] * scale), round(FRAME[1] * scale)
    # Composed with the padding still on, and cropped to the frame at the end: a wing placed by its
    # shoulder can reach outside the frame, and `alpha_composite` cannot be given a negative corner.
    canvas = Image.new("RGBA", (width + pad * 2, height + pad * 2), (0, 0, 0, 0))
    if wings:
        # Behind the bird that owns them.
        for piece, (left, top), _ in winged(scale).values():
            canvas.alpha_composite(piece, (pad + left, pad + top))
    placed = build(scale)
    for name in ("duck", "sign"):
        piece, (left, top) = placed[name]
        canvas.alpha_composite(piece, (pad + left, pad + top))
    return canvas.crop((pad, pad, pad + width, pad + height))


def main():
    # The base is what does not move, in the design's own order: the duck, then the sign it holds in
    # front of itself. No wings — that is the whole point of this rebuild.
    base = compose(wings=False)
    for suffix, width in MODE_VARIANTS:
        height = round(width * FRAME[1] / FRAME[0])
        out = MODES_DIR / f"duck-your-luck-{suffix}-marquee.webp"
        save_web(resized(base, (width, height)), out)
        print(f"wrote {out.relative_to(ROOT)}  {width}x{height}")

    # A wing has to be ON the duck. The shoulder is placed by hand, so the one thing worth checking
    # is that the hand was not wrong: the pixels the duck covers are what makes this a bird with
    # wings rather than a sign with wings.
    duck_piece, duck_at = build()["duck"]
    duck_mask = np.zeros(FRAME[::-1], bool)
    stamp = np.asarray(duck_piece)[..., 3] > 8
    duck_mask[duck_at[1] : duck_at[1] + stamp.shape[0], duck_at[0] : duck_at[0] + stamp.shape[1]] = (
        stamp
    )

    rows = []
    roots = {}
    for side, (piece, (left, top), root) in winged().items():
        out = SYMBOL_DIR / f"duck-sign-wing-{side}-fan.webp"
        save_web(piece, out)
        roots[side] = root
        wing_mask = np.zeros(FRAME[::-1], bool)
        ink = np.asarray(piece)[..., 3] > 8
        window = (slice(max(top, 0), top + ink.shape[0]), slice(max(left, 0), left + ink.shape[1]))
        wing_mask[window] = ink[: window[0].stop - window[0].start, : window[1].stop - window[1].start]
        rooted = (wing_mask & duck_mask).sum()
        if not rooted:
            raise SystemExit(f"{side} wing does not reach the duck — it is a sign with wings")
        print(
            f"wrote {out.relative_to(ROOT)}  {piece.width}x{piece.height} at ({left}, {top}), "
            f"root ({root[0]:.0f}, {root[1]:.0f}), {rooted}px of it on the duck"
        )
        rows.append(
            f"\t{side}: {{\n"
            f"\t\tx: {num(left / FRAME[0])},\n"
            f"\t\ty: {num(top / FRAME[1])},\n"
            f"\t\twidth: {num(piece.width / FRAME[0])},\n"
            f"\t\theight: {num(piece.height / FRAME[1])},\n"
            f"\t\tpivotX: {num(root[0] / FRAME[0])},\n"
            f"\t\tpivotY: {num(root[1] / FRAME[1])},\n"
            f"\t}},"
        )
    TABLE.write_text(HEADER + "\n".join(rows) + "\n};\n")
    print(f"wrote {TABLE.relative_to(ROOT)}")

    # The sheet: the symbol at rest and at both ends of the beat, each wing turned about the root
    # just written — which is the same arithmetic <DuckSign> does, so a wing that leaves the frame
    # or slides off its root is visible here before it is visible on a board.
    panels = []
    for beat in (0, 1, -1):
        panel = Image.new("RGBA", FRAME, (30, 24, 48, 255))
        for side, (piece, (left, top), _) in winged(beat=FLAP * beat).items():
            whole = Image.new("RGBA", FRAME, (0, 0, 0, 0))
            box = (max(left, 0), max(top, 0))
            whole.alpha_composite(piece.crop((box[0] - left, box[1] - top, piece.width, piece.height)), box)
            panel.alpha_composite(whole)
        panel.alpha_composite(base)
        panels.append(panel)
    sheet = Image.new("RGBA", (FRAME[0] * 3 + 40, FRAME[1] + 20), (30, 24, 48, 255))
    for index, panel in enumerate(panels):
        sheet.alpha_composite(panel, (10 + (FRAME[0] + 10) * index, 10))
    sheet.save(VERIFY)
    print(f"wrote {VERIFY.relative_to(ROOT)}  — at rest, and at both ends of the beat")
    return 0


HEADER = """/**
 * The DUCK YOUR LUCK scatter's two loose wings: where each sits on the symbol frame, and the point
 * it beats about.
 *
 * GENERATED by `scripts/duck-sign/build_duck_sign.py` — edit that, not this. The symbol ships as a
 * base with NO wings in it — just the duck and the sign it holds — plus these two, so that the only
 * wings on screen are the ones that move. Drawing them at these coordinates behind the base
 * reproduces the design. See <DuckSign>.
 *
 * All six numbers are fractions of the symbol FRAME, origin top-left, so they survive any change to
 * how big the symbol is drawn. `pivotX`/`pivotY` are in the same frame space, not in the wing's, and
 * each is that wing's SHOULDER — the point where it meets the duck, which the sign hides.
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


if __name__ == "__main__":
    raise SystemExit(main())
