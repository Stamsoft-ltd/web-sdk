#!/usr/bin/env python3
"""Cut the MOTHERSHIP SCATTER into its animatable layers and measure its windows.

The redesign supplies the symbol as four separate pieces, which is a far better hand than the first
pass got. That one had a single flat lockup in which the alien sat ON TOP of the glass, so the tube
interior had to be RECONSTRUCTED by inpainting the alien out of it, and the word SCATTER had to be
cut off the plate and the hole behind it filled. Nothing is reconstructed here.

    art-src/scatter/machine.png   the capsule: EMPTY tube, empty base plaque, two green lamps
                                  (Figma 9041:26985)
    art-src/scatter/word.png      the word SCATTER on its own                (9041:27047)
    art-src/scatter/alien.svg     the alien body, vector                     (9041:27059)
    art-src/scatter/eye.svg       the eye, vector                            (9041:27051)

Outputs, all onto the shared 328x264 symbol canvas with the portrait content letterboxed to full
height, matching every other symbol:

    scatter.webp        the capsule
    scatter_mobile.webp half-res
    scatter_word.webp   the word, sized into the base plaque
    scatter_alien.webp  the alien, sized into the tube
    scatter_eye.webp    the eye
    scatter_dome.webp   the LID, cut a second time as a FRONT occluder

The dome layer is what lets the alien hop at all. The alien fills the tube to within a hair of the
lid, so any hop worth seeing would draw it over the machine's metal top; redrawn over the alien, the
same pixels occlude it instead and it rises BEHIND the lid the way it physically would. The script
prints HOP_LIMIT -- the headroom before that occlusion begins -- so the component's HOP_H can be
checked against it rather than guessed.

The alien and the eye are VECTORS with no placement rect anywhere in the file, so their size and
position inside the tube are AUTHORED in the constants below, not measured -- the same situation as
the compass. Everything else is measured off the capsule AFTER it has been fitted to the canvas, so
the layers and the base can never drift apart.

Run:  python3 scripts/build-scatter-art.py
      python3 scripts/measure-green-lights.py   # afterwards: it reads the built plate
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

import cairosvg
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art-src" / "scatter"
OUT = ROOT / "static" / "assets" / "components" / "symbols" / "magnetic" / "special"
PREVIEW = SRC / "preview_scatter_layers.png"

CANVAS_W, CANVAS_H = 328, 264

# Layers the runtime scales UP (the alien squashes, the word zooms ~13%) are rasterised above their
# on-screen size, or the pop resolves into a soft edge.
SUPERSAMPLE = 3

# --- authored placements ---------------------------------------------------------------------
# Expressed against the TUBE, not the canvas: the alien lives in the tube, so it should keep its
# relation to the tube if the capsule art ever changes proportion.
ALIEN_OF_TUBE_W = 0.62
"""Alien width as a fraction of the tube's width.

Not larger. At 0.78 the alien stood 107px tall in a 114px tube and HOP_LIMIT came out at 0.0000 --
its head already touching the lid, so the hop had nowhere to go and every frame of it was eaten by
the dome occluder. Check HOP_LIMIT in this script's output after changing this."""
ALIEN_BOTTOM_PAD = 0.06
"""Gap under the alien as a fraction of the tube's height -- it stands on the tube floor."""
EYE_OF_ALIEN = 0.42
"""Eye width as a fraction of the alien's width."""
EYE_CY_OF_ALIEN = 0.44
"""Eye centre down the alien's box, 0 = top."""

# The word is INSET in the plaque rather than filling it: the plaque is a bezel, the glyphs need to
# sit clear of its inner edge, and the win state zooms them without touching it.
WORD_OF_PLAQUE = 0.82


def die(msg: str) -> None:
    sys.exit(f"build-scatter-art: {msg}")


def alpha_bbox(im: Image.Image, thresh: int = 8):
    bb = im.getchannel("A").point(lambda v: 255 if v > thresh else 0).getbbox()
    if bb is None:
        die("layer came out fully transparent")
    return bb


def fit_canvas(content: Image.Image, cw: int, ch: int):
    """Scale to fill canvas HEIGHT, centre horizontally, and hand back the transform."""
    bb = alpha_bbox(content)
    cropped = content.crop(bb)
    scale = ch / cropped.height
    new = cropped.resize((max(1, round(cropped.width * scale)), ch), Image.LANCZOS)
    if new.width > cw:
        die(f"content {new.width}px wider than the {cw}px canvas -- lockup is not portrait")
    x0 = (cw - new.width) // 2
    out = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    out.alpha_composite(new, (x0, 0))
    return out, scale, x0


def render_svg(path: Path, width: int) -> Image.Image:
    """Rasterise a vector part at an explicit width, preserving its own aspect."""
    png = cairosvg.svg2png(url=str(path), output_width=max(2, int(width)))
    im = Image.open(io.BytesIO(png)).convert("RGBA")
    return im.crop(alpha_bbox(im))


def largest_blob(mask: np.ndarray) -> np.ndarray:
    """Keep only the biggest connected component of `mask`.

    Needed for the base plaque: the dark indigo of the well is also the OUTLINE colour used all
    over the capsule, so the key returns the well plus a hairline tracing the whole base, and the
    bounding box of that is the base -- which put the word straight over the two green lamps.
    The well is the one large blob; the outline is thin and disconnected from it.
    """
    h, w = mask.shape
    seen = np.zeros_like(mask)
    best = None
    for y0 in range(h):
        for x0 in range(w):
            if not mask[y0, x0] or seen[y0, x0]:
                continue
            seen[y0, x0] = True
            stack = [(y0, x0)]
            pts = []
            while stack:
                y, x = stack.pop()
                pts.append((y, x))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
            if best is None or len(pts) > len(best):
                best = pts
    out = np.zeros_like(mask)
    if best:
        for y, x in best:
            out[y, x] = True
    return out


def box_of(mask: np.ndarray, name: str):
    ys = np.nonzero(mask.any(axis=1))[0]
    xs = np.nonzero(mask.any(axis=0))[0]
    if ys.size == 0 or xs.size == 0:
        die(f"could not locate {name} on the capsule")
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def frac(x0, y0, x1, y1):
    """A pixel box as centre-offset fractions of the symbol box -- what the component multiplies."""
    return {
        "dx": (x0 + x1) / 2 / CANVAS_W - 0.5,
        "dy": (y0 + y1) / 2 / CANVAS_H - 0.5,
        "w": (x1 - x0) / CANVAS_W,
        "h": (y1 - y0) / CANVAS_H,
    }


def emit(name: str, f: dict) -> str:
    return f"  {name:11s} dx={f['dx']:+.4f} dy={f['dy']:+.4f} w={f['w']:.4f} h={f['h']:.4f}"


def main() -> None:
    machine_p, word_p = SRC / "machine.png", SRC / "word.png"
    alien_p, eye_p = SRC / "alien.svg", SRC / "eye.svg"
    for p in (machine_p, word_p, alien_p, eye_p):
        if not p.exists():
            die(f"missing source {p.relative_to(ROOT)}")

    OUT.mkdir(parents=True, exist_ok=True)
    capsule, _scale, _x0 = fit_canvas(Image.open(machine_p).convert("RGBA"), CANVAS_W, CANVAS_H)
    capsule.save(OUT / "scatter.webp", lossless=True, method=6)
    capsule.resize((CANVAS_W // 2, CANVAS_H // 2), Image.LANCZOS).save(
        OUT / "scatter_mobile.webp", lossless=True, method=6
    )

    a = np.array(capsule).astype(int)
    r, g, b, al = a[:, :, 0], a[:, :, 1], a[:, :, 2], a[:, :, 3]
    solid = al > 200

    # --- tube: the one large cyan field -------------------------------------------------------
    tube = box_of(solid & (b > 150) & (g > 110) & (r < 90), "the cyan tube")
    tx0, ty0, tx1, ty1 = tube

    # --- lid band: the magenta pill on top ----------------------------------------------------
    dome_band = box_of(solid & (r > 200) & (b > 150) & (g < 110), "the lid's magenta band")

    # --- base plaque: the dark indigo well the word sits in ------------------------------------
    # Fenced BELOW the tube. That same dark indigo is the outline colour used all over the capsule,
    # so an unfenced key returns the whole symbol's bounding box instead of the well.
    plaque_key = solid & (r > 35) & (r < 80) & (g > 30) & (g < 70) & (b > 110) & (b < 170)
    plaque_key[:ty1, :] = False
    plaque = box_of(largest_blob(plaque_key), "the base plaque")

    # --- lower band: the collar between the tube's foot and the plaque -------------------------
    # Authored from the two measured boxes rather than keyed. It is the machine's own body colour,
    # so there is no colour that isolates it -- but it is exactly the gap between the tube's bottom
    # and the plaque's top, which are both measured, so deriving it keeps it tied to the art.
    lower_band = (
        round(tx0 + (tx1 - tx0) * 0.16), ty1,
        round(tx1 - (tx1 - tx0) * 0.16), round(ty1 + (plaque[1] - ty1) * 0.55),
    )

    # --- lid, as a front occluder -------------------------------------------------------------
    # Cut at the first row of glass: that row IS the bottom of the lid, so nothing is invented and
    # at rest the strip composites pixel-identically over itself.
    dome = capsule.crop((0, 0, CANVAS_W, ty0))
    dome.save(OUT / "scatter_dome.webp", lossless=True, method=6)

    # --- word, sized into the plaque ----------------------------------------------------------
    word_src = Image.open(word_p).convert("RGBA")
    word_src = word_src.crop(alpha_bbox(word_src))
    px0, py0, px1, py1 = plaque
    word_w = (px1 - px0) * WORD_OF_PLAQUE
    word_h = word_w * word_src.height / word_src.width
    if word_h > (py1 - py0) * WORD_OF_PLAQUE:  # a tall plaque: fit by height instead
        word_h = (py1 - py0) * WORD_OF_PLAQUE
        word_w = word_h * word_src.width / word_src.height
    word_out = word_src.resize(
        (max(1, round(word_w * SUPERSAMPLE)), max(1, round(word_h * SUPERSAMPLE))), Image.LANCZOS
    )
    word_out.save(OUT / "scatter_word.webp", lossless=True, method=6)
    wcx, wcy = (px0 + px1) / 2, (py0 + py1) / 2
    word_box = (wcx - word_w / 2, wcy - word_h / 2, wcx + word_w / 2, wcy + word_h / 2)

    # --- alien and eye, authored into the tube -------------------------------------------------
    tube_w, tube_h = tx1 - tx0, ty1 - ty0
    alien_w = tube_w * ALIEN_OF_TUBE_W
    alien_src = render_svg(alien_p, round(alien_w * SUPERSAMPLE))
    alien_h = alien_w * alien_src.height / alien_src.width
    alien_src.save(OUT / "scatter_alien.webp", lossless=True, method=6)
    acx = (tx0 + tx1) / 2
    acy = ty1 - tube_h * ALIEN_BOTTOM_PAD - alien_h / 2
    alien_box = (acx - alien_w / 2, acy - alien_h / 2, acx + alien_w / 2, acy + alien_h / 2)

    eye_w = alien_w * EYE_OF_ALIEN
    eye_src = render_svg(eye_p, round(eye_w * SUPERSAMPLE))
    eye_h = eye_w * eye_src.height / eye_src.width
    eye_src.save(OUT / "scatter_eye.webp", lossless=True, method=6)
    ecy = alien_box[1] + alien_h * EYE_CY_OF_ALIEN
    eye_box = (acx - eye_w / 2, ecy - eye_h / 2, acx + eye_w / 2, ecy + eye_h / 2)

    # --- report --------------------------------------------------------------------------------
    print("layers written to", OUT.relative_to(ROOT))
    for name, im in (
        ("scatter.webp", capsule), ("scatter_word.webp", word_out),
        ("scatter_alien.webp", alien_src), ("scatter_eye.webp", eye_src),
        ("scatter_dome.webp", dome),
    ):
        print(f"  {name:20s} {im.size}")

    print("\nplacements (fractions of the 328x264 symbol box, offsets from its centre):")
    print(emit("TUBE", frac(*tube)))
    print(emit("DOME_BAND", frac(*dome_band)))
    print(emit("LOWER_BAND", frac(*lower_band)))
    print(emit("PLAQUE", frac(*plaque)))
    print(emit("WORD", frac(*[round(v) for v in word_box])))
    print(emit("ALIEN", frac(*[round(v) for v in alien_box])))
    print(emit("EYE", frac(*[round(v) for v in eye_box])))
    print(f"  {'DOME_FRONT':11s} dy={ty0 / 2 / CANVAS_H - 0.5:+.4f} h={ty0 / CANVAS_H:.4f}"
          "   (top-aligned, full canvas width)")
    # Headroom before the lid starts eating the hop: how far the alien can rise, as a fraction of
    # the box, before scatter_dome occludes it -- which is exactly what that layer is there for.
    print(f"  {'HOP_LIMIT':11s} {(alien_box[1] - ty0) / CANVAS_H:+.4f}")

    # --- preview -------------------------------------------------------------------------------
    def checker(im):
        bg = Image.new("RGBA", im.size, (0, 0, 0, 0))
        for yy in range(0, im.height, 16):
            for xx in range(0, im.width, 16):
                c = (92, 92, 102, 255) if ((xx // 16 + yy // 16) % 2 == 0) else (56, 56, 64, 255)
                bg.paste(c, (xx, yy, min(xx + 16, im.width), min(yy + 16, im.height)))
        bg.alpha_composite(im)
        return bg

    # Fourth tile: everything assembled at rest, drawn in the runtime's own order (alien, eye, then
    # the dome occluder over them, then the word) so the authored placements can be judged without
    # booting the game.
    demo = capsule.copy()

    def place(layer, bx):
        bw, bh = round(bx[2] - bx[0]), round(bx[3] - bx[1])
        demo.alpha_composite(layer.resize((max(1, bw), max(1, bh)), Image.LANCZOS),
                             (round(bx[0]), round(bx[1])))

    place(alien_src, alien_box)
    place(eye_src, eye_box)
    demo.alpha_composite(dome, (0, 0))
    place(word_out, word_box)

    tiles = [checker(capsule), checker(word_out), checker(alien_src), checker(demo)]
    W = sum(t.width for t in tiles) + 10 + 15 * len(tiles)
    H = max(t.height for t in tiles) + 20
    sheet = Image.new("RGBA", (W, H), (26, 26, 32, 255))
    xoff = 10
    for t in tiles:
        sheet.alpha_composite(t, (xoff, 10))
        xoff += t.width + 15
    sheet.save(PREVIEW)
    print("\npreview:", PREVIEW.relative_to(ROOT))


if __name__ == "__main__":
    main()
