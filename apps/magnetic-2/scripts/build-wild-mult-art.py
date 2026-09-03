#!/usr/bin/env python3
"""Cut the MOTHERSHIP MULTIPLIER WILD's extra layers.

    art-src/wildmult/disc.png            the empty violet disc with its two green studs (9074:16748)
    art-src/wildmult/reference.png        the composed x10 lockup, cropped from the designer's sheet
    art-src/wildmult/reference_stacked.png the OTHER variant the designer drew, kept for the record
    art-src/wildmult/chakra-petch-700.ttf  the game's own display face, unpacked from the shipped
                                           woff2 so PIL can set the numbers

This script is small because the multiplier wild turned out to be the NORMAL wild with one part
swapped. The designer's sheet ships the magnet, the plaque, the eye blob and the eye again alongside
the disc, and every one of them is byte-identical in layout: keying both references and lining their
magnets up gives a constant offset of (+63, +31), under which the blob, the plaque and the word all
land within 1px. So there is no second lockup to measure -- only the disc, mapped through that
offset into the wild's reference frame and then through the wild's own canvas transform.

**There were two candidate layouts and the ART chose between them.** The designer drew an `x10` disc
over the magnet's gap next to a variant with `WILD` / `x10` stacked on a taller plaque. Only the
first is buildable: the parts delivered are the disc plus the standard-height WILD plaque, and the
taller stacked plaque was never exported. `reference_stacked.png` is kept so the decision can be
re-checked rather than re-litigated.

**The number is set in Chakra Petch, not in the design's face.** The `x10` in the reference is a
heavy ROUNDED display sans, the same face as the WILD wordmark -- and that font is not in the repo
and was not delivered. Chakra Petch 700 is what the redesigned UI already sets its text in
(WinSign, WinAmountPlaque, InfoBox), it ships with the app, and it is OFL, so it is the honest
substitute. The lift-the-digits-from-the-old-art option was checked and rejected: the pre-redesign
multiplier textures set their numbers in a plain angular grotesque on a grey metal plaque.

Outputs into the shared symbol folder:

    wild_disc.webp                 the empty disc
    wild_mult_x2 .. x10.webp       one number per multiplier the game can roll

Run:  python3 scripts/build-wild-mult-art.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art-src" / "wildmult"
WILD = ROOT / "art-src" / "wild"
OUT = ROOT / "static" / "assets" / "components" / "symbols" / "magnetic" / "special"
VERIFY = SRC / "verify_wildmult.png"

CANVAS_W, CANVAS_H = 328, 264
SUPERSAMPLE = 4

# The multipliers game/utils.ts can roll. Kept here rather than imported so the script stays
# runnable on its own; MULTIPLIER_WILD_KEYS is the list to check it against.
MULTIPLIERS = (2, 3, 4, 5, 7, 9, 10)

# Taken from scripts/build-wild-art.py's own output -- the SAME canvas transform, so the disc lands
# in the frame the wild's layers already share. Re-run that script and copy these across if its
# content box ever moves.
WILD_CONTENT = (83.5, 96.5, 483.3, 519.2)
WILD_FIT = 0.6246

# The number, as fractions of the disc's own box, measured off the reference's own x10: how wide the
# WIDEST number may run, how tall a digit stands, and how far the row sits below the disc centre.
# Plain white, no outline -- the design has none, and the violet face is dark enough not to need one.
NUM_MAX_W = 0.79
NUM_DIGIT_H = 0.47
NUM_DY = 0.049
NUM_FILL = (255, 255, 255, 255)


def die(msg: str) -> None:
    sys.exit(f"build-wild-mult-art: {msg}")


def keys(rgb: np.ndarray, alpha: np.ndarray | None = None) -> dict:
    r, g, b = rgb[:, :, 0].astype(int), rgb[:, :, 1].astype(int), rgb[:, :, 2].astype(int)
    op = np.ones(r.shape, bool) if alpha is None else alpha > 120
    return {
        "red": op & (r > 190) & (g < 130) & (b < 130),
        "blue": op & (b > 200) & (g > 100) & (g < 200) & (r < 130),
        "green": op & (g > 150) & (r < 200) & (b < 130) & (g > r + 30) & (g > b + 60),
        # The disc's violet is far bluer than the plaque's purple (101,9,252 against 87,55,171),
        # which is what lets one key find the disc without also finding the bar under it.
        "violet": op & (r > 80) & (r < 165) & (g < 70) & (b > 225),
    }


def mbb(mask: np.ndarray):
    ys, xs = np.nonzero(mask)
    if len(xs) == 0:
        die("a colour key matched nothing")
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def union(*boxes):
    return (min(b[0] for b in boxes), min(b[1] for b in boxes),
            max(b[2] for b in boxes), max(b[3] for b in boxes))


def alpha_bbox(im: Image.Image, thresh: int = 8):
    b = im.getchannel("A").point(lambda v: 255 if v > thresh else 0).getbbox()
    if b is None:
        die("a source layer is fully transparent")
    return b


def main() -> None:
    for n in ("disc.png", "reference.png", "chakra-petch-700.ttf"):
        if not (SRC / n).exists():
            die(f"missing source art-src/wildmult/{n}")
    if not (WILD / "reference.png").exists():
        die("missing art-src/wild/reference.png -- the multiplier is placed relative to it")
    OUT.mkdir(parents=True, exist_ok=True)

    wild_ref = np.array(Image.open(WILD / "reference.png").convert("RGB"))
    mult_ref = np.array(Image.open(SRC / "reference.png").convert("RGB"))
    wk, mk = keys(wild_ref), keys(mult_ref)

    # --- prove the two lockups are the same, then take the offset -----------------------------
    wild_mag = union(mbb(wk["red"]), mbb(wk["blue"]))
    mult_mag = union(mbb(mk["red"]), mbb(mk["blue"]))
    if abs((wild_mag[2] - wild_mag[0]) - (mult_mag[2] - mult_mag[0])) > 3:
        die("the two references are not at the same scale; the constant-offset shortcut is invalid")
    off = (wild_mag[0] - mult_mag[0], wild_mag[1] - mult_mag[1])
    # Cross-check on a part that is NOT the magnet. If the designer had moved anything, this is
    # where it would show, and the whole shortcut would have to be abandoned for a full re-measure.
    wild_green, mult_green = mbb(wk["green"]), mbb(mk["green"])
    drift = max(abs(mult_green[i] + off[i % 2] - wild_green[i]) for i in range(4))
    if drift > 3:
        die(f"the blob drifts {drift}px between the two lockups; re-measure instead of offsetting")

    disc_ref = mbb(mk["violet"])
    disc_in_wild = (
        disc_ref[0] + off[0], disc_ref[1] + off[1],
        disc_ref[2] + off[0], disc_ref[3] + off[1],
    )

    # --- the disc's own art, and how much of it the violet key misses --------------------------
    disc_im = Image.open(SRC / "disc.png").convert("RGBA")
    da = np.array(disc_im)
    disc_key = mbb(keys(da[:, :, :3], da[:, :, 3])["violet"])
    disc_alpha = alpha_bbox(disc_im)
    scale = (disc_in_wild[2] - disc_in_wild[0]) / (disc_key[2] - disc_key[0])
    box = (
        disc_in_wild[0] + (disc_alpha[0] - disc_key[0]) * scale,
        disc_in_wild[1] + (disc_alpha[1] - disc_key[1]) * scale,
        disc_in_wild[0] + (disc_alpha[2] - disc_key[0]) * scale,
        disc_in_wild[1] + (disc_alpha[3] - disc_key[1]) * scale,
    )

    # --- onto the canvas, through the WILD's transform ------------------------------------------
    cw = WILD_CONTENT[2] - WILD_CONTENT[0]
    ch = WILD_CONTENT[3] - WILD_CONTENT[1]
    ox = (CANVAS_W - cw * WILD_FIT) / 2 - WILD_CONTENT[0] * WILD_FIT
    oy = (CANVAS_H - ch * WILD_FIT) / 2 - WILD_CONTENT[1] * WILD_FIT
    cb = (
        ox + box[0] * WILD_FIT, oy + box[1] * WILD_FIT,
        ox + box[2] * WILD_FIT, oy + box[3] * WILD_FIT,
    )
    disc_w = max(1, round(cb[2] - cb[0]))
    disc_h = max(1, round(cb[3] - cb[1]))
    disc_im.crop(disc_alpha).resize((disc_w, disc_h), Image.LANCZOS).save(
        OUT / "wild_disc.webp", lossless=True, method=6
    )

    print(f"const DISC = {{ dx: {round((cb[0] + cb[2]) / 2 / CANVAS_W - 0.5, 4)}, "
          f"dy: {round((cb[1] + cb[3]) / 2 / CANVAS_H - 0.5, 4)}, "
          f"w: {round((cb[2] - cb[0]) / CANVAS_W, 4)}, "
          f"h: {round((cb[3] - cb[1]) / CANVAS_H, 4)} }};")

    # --- the numbers ----------------------------------------------------------------------------
    # ONE font size for all seven, not one per string. Sizing each number to fill the disc would
    # give x2 far bigger digits than x10 -- the design keeps the digit height constant and lets the
    # short numbers simply be narrower. So the size is driven by the digit height, then reduced if
    # the widest number would overflow.
    #
    # Each is drawn centred on a FIXED box, so the component needs one placement rather than seven.
    num_w = round(disc_w * NUM_MAX_W)
    num_h = round(disc_h * NUM_DIGIT_H)
    font_path = str(SRC / "chakra-petch-700.ttf")
    widest = f"x{max(MULTIPLIERS)}"

    def fitted(size: int):
        f = ImageFont.truetype(font_path, size)
        return f, f.getbbox("0")[3] - f.getbbox("0")[1], f.getbbox(widest)[2] - f.getbbox(widest)[0]

    size = 4
    for candidate in range(4, num_h * SUPERSAMPLE * 4):
        f, dh_px, ww = fitted(candidate)
        if dh_px > num_h * SUPERSAMPLE or ww > num_w * SUPERSAMPLE:
            break
        size = candidate
    font = ImageFont.truetype(font_path, size)
    _, digit_h, widest_w = fitted(size)
    print(f"number font {size}px at {SUPERSAMPLE}x -> digit {digit_h}px, '{widest}' {widest_w}px "
          f"(caps {num_h * SUPERSAMPLE} / {num_w * SUPERSAMPLE})")

    for m in MULTIPLIERS:
        text = f"x{m}"
        big = Image.new("RGBA", (num_w * SUPERSAMPLE, num_h * SUPERSAMPLE), (0, 0, 0, 0))
        d = ImageDraw.Draw(big)
        l, t, r, b = font.getbbox(text)
        # Centred on the box horizontally; vertically the DIGITS are centred, not the ink box, so a
        # number with a lowercase x sits on the same line as one without.
        dl, dt, dr, db = font.getbbox("0")
        d.text(
            ((big.width - (r - l)) / 2 - l, (big.height - (db - dt)) / 2 - dt),
            text, font=font, fill=NUM_FILL,
        )
        big.resize((num_w, num_h), Image.LANCZOS).save(
            OUT / f"wild_mult_x{m}.webp", lossless=True, method=6
        )

    print(f"const NUM = {{ dx: {round((cb[0] + cb[2]) / 2 / CANVAS_W - 0.5, 4)}, "
          f"dy: {round(((cb[1] + cb[3]) / 2 + (cb[3] - cb[1]) * NUM_DY) / CANVAS_H - 0.5, 4)}, "
          f"w: {round(num_w / CANVAS_W, 4)}, h: {round(num_h / CANVAS_H, 4)} }};")

    # --- proof -----------------------------------------------------------------------------------
    check = Image.new("RGBA", (CANVAS_W * len(MULTIPLIERS), CANVAS_H), (18, 12, 40, 255))
    base = Image.open(OUT / "wild.webp").convert("RGBA")
    plaque = Image.open(OUT / "wild_plaque.webp").convert("RGBA")
    blob = Image.open(OUT / "wild_blob.webp").convert("RGBA")
    eye = Image.open(OUT / "wild_eye.webp").convert("RGBA")
    disc = Image.open(OUT / "wild_disc.webp").convert("RGBA")
    # Placements copied from build-wild-art.py's output; the verify render is the only consumer.
    PLAQUE = (0.0, 0.3639, 0.7614, 0.2721)
    BLOB = (0.0115, -0.3359, 0.2061, 0.3283)
    EYE = (0.0078, -0.3853, 0.1147, 0.1424)

    def paste(dst, im, spec, xoff):
        x = (spec[0] + 0.5) * CANVAS_W - im.width / 2 + xoff
        y = (spec[1] + 0.5) * CANVAS_H - im.height / 2
        dst.alpha_composite(im, (round(x), round(y)))

    for i, m in enumerate(MULTIPLIERS):
        xoff = i * CANVAS_W
        check.alpha_composite(base, (xoff, 0))
        check.alpha_composite(disc, (round(cb[0]) + xoff, round(cb[1])))
        num = Image.open(OUT / f"wild_mult_x{m}.webp").convert("RGBA")
        paste(check, num, ((cb[0] + cb[2]) / 2 / CANVAS_W - 0.5,
                           ((cb[1] + cb[3]) / 2 + (cb[3] - cb[1]) * NUM_DY) / CANVAS_H - 0.5), xoff)
        paste(check, plaque, PLAQUE, xoff)
        paste(check, blob, BLOB, xoff)
        paste(check, eye, EYE, xoff)
    check.resize((CANVAS_W * len(MULTIPLIERS) * 2, CANVAS_H * 2), Image.LANCZOS).save(VERIFY)
    print(f"wrote {VERIFY.name}")


if __name__ == "__main__":
    main()
