#!/usr/bin/env python3
"""Prepare the alien ship's PARTS and measure how they assemble.

The ship used to be one sprite cut out of the room painting (build-room-art.py's `split_ufo`). The
designer then supplied it as loose pieces so it can be animated, which is what this script builds:

    art-src/ufo/hull.png       the saucer, no antenna     -> ui/ufo_hull.webp
    art-src/ufo/antenna.png    the ball on its stem       -> ui/ufo_antenna.webp
    art-src/ufo/reference.png  the designer's composite   -> MEASURED, never shipped

The tractor beam is NOT an asset any more — Background.svelte draws it, so it can pulse, sweep and
carry motes up into the hull. What this script still has to hand over is where the beam LEAVES the
hull: the bright opening on the saucer's underside, measured below.

The two loose parts are exported at unrelated scales (the antenna is 21% large against the hull if
you simply trust their pixel sizes), so the antenna's size comes from the RATIO measured in the
designer's composite, not from its own file. Only its aspect comes from the file.

Run:  python3 scripts/build-ufo-art.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art-src" / "ufo"
OUT = ROOT / "static" / "assets" / "components" / "ui"
PREVIEW = SRC / "preview_ufo.png"

# The hull is the biggest thing here and it hangs at ~21% of the background width, so 560px is
# already generous. Transparent art in this game is lossy + capped: a lossless save of the room's
# ship was 648KB.
MAX_HULL_W = 560
RGBA_WEBP = dict(quality=90, method=6, alpha_quality=95)


def die(msg: str) -> None:
    sys.exit(f"build-ufo-art: {msg}")


def trim(im: Image.Image) -> Image.Image:
    bb = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if bb is None:
        die("a transparent source came out empty")
    return im.crop(bb)


def spans(mask: np.ndarray) -> np.ndarray:
    """Width of each row's occupied run — the shape's silhouette, row by row."""
    out = np.zeros(mask.shape[0], int)
    for r in range(mask.shape[0]):
        xs = np.nonzero(mask[r])[0]
        if len(xs):
            out[r] = xs.max() - xs.min() + 1
    return out


def measure_emitter(hull: Image.Image) -> dict:
    """The lit opening on the saucer's underside — where the drawn beam is anchored.

    Keyed on brightness rather than on hue: the opening is the one washed-out, near-white part of
    an otherwise saturated blue hull, while the magenta running lights around the rim are dark
    enough to fall out on their own.
    """
    a = np.asarray(hull).astype(int)
    h, w = a.shape[:2]
    rgb, vis = a[..., :3], a[..., 3] > 60
    win = np.zeros((h, w), bool)
    win[int(h * 0.6) :, int(w * 0.3) : int(w * 0.7)] = True
    lit = win & vis & (rgb.sum(axis=2) > 560) & (rgb[..., 0] > 190) & (rgb[..., 2] > 200)
    if lit.sum() < 100:
        die("could not find the lit opening on the hull's underside")
    ys, xs = np.nonzero(lit)
    return {
        "cx": round(((xs.min() + xs.max()) / 2) / w, 4),
        "cy": round(((ys.min() + ys.max()) / 2) / h, 4),
        "w": round((xs.max() - xs.min() + 1) / w, 4),
        "bottom": round((ys.max() + 1) / h, 4),
    }


def measure_reference(ref: Image.Image) -> dict:
    """How big the antenna is against the hull, from the designer's own composite.

    The composite is a screenshot over a blurred room, so everything here is keyed inside a narrow
    column band around the ship's axis — the blurred background out at the edges answers to a plain
    "is it blue" test just as readily as the hull does.
    """
    a = np.asarray(ref.convert("RGB")).astype(int)
    h, w = a.shape[:2]
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # The ship's blue is far deeper than anything around it (b-r 142 on the hull against 74 for the
    # splash's dim veil, which a looser test happily selects across the whole top of the frame).
    hull_mask = (b > 150) & (b - r > 100) & (b - g > 90)
    ball_mask = (b > 170) & (g < 90) & (r > 85) & (r < 200) & (b - g > 100)

    sp = spans(hull_mask)
    rim = int(np.argmax(sp))
    hull_w = int(sp[rim])
    xs = np.nonzero(hull_mask[rim])[0]
    cx = (xs.min() + xs.max()) / 2

    # Up from the widest row to where the dome ends and the stem begins.
    dome_top = rim
    while dome_top > 0 and sp[dome_top - 1] > hull_w * 0.10:
        dome_top -= 1

    # The stem and the ball, inside a band that only the ship can occupy.
    band = np.zeros((h, w), bool)
    band[:dome_top, int(cx - hull_w * 0.10) : int(cx + hull_w * 0.10)] = True
    ant = (hull_mask | ball_mask) & band
    ys, axs = np.nonzero(ant)
    if len(ys) < 200:
        die("could not find the antenna above the dome in the reference")
    ball_w = int(spans(ant).max())
    ant_h = int(dome_top - ys.min())
    if not (0.03 < ball_w / hull_w < 0.2):
        die(f"antenna/hull width ratio {ball_w / hull_w:.3f} is not believable")
    return {
        "hull_w": hull_w,
        "dome_top": dome_top,
        "antenna_of_hull_w": round(ball_w / hull_w, 4),
        "antenna_h_px": ant_h,
        "ball_w_px": ball_w,
    }


def main() -> None:
    for n in ("hull.png", "antenna.png", "reference.png"):
        if not (SRC / n).exists():
            die(f"missing art-src/ufo/{n}")

    OUT.mkdir(parents=True, exist_ok=True)
    hull = trim(Image.open(SRC / "hull.png").convert("RGBA"))
    antenna = trim(Image.open(SRC / "antenna.png").convert("RGBA"))

    emitter = measure_emitter(hull)
    ref = measure_reference(Image.open(SRC / "reference.png"))

    if hull.width > MAX_HULL_W:
        hull = hull.resize((MAX_HULL_W, round(hull.height * MAX_HULL_W / hull.width)), Image.LANCZOS)
    ant_w = round(hull.width * ref["antenna_of_hull_w"] * 2)  # 2x, it is a small piece drawn small
    antenna_out = antenna.resize((ant_w, round(ant_w * antenna.height / antenna.width)), Image.LANCZOS)

    hull.save(OUT / "ufo_hull.webp", **RGBA_WEBP)
    antenna_out.save(OUT / "ufo_antenna.webp", **RGBA_WEBP)

    hull_aspect = hull.width / hull.height
    ant_aspect = antenna.width / antenna.height

    print("written to", OUT.relative_to(ROOT))
    for f in ("ufo_hull.webp", "ufo_antenna.webp"):
        p = OUT / f
        print(f"  {f:18s} {Image.open(p).size} {p.stat().st_size // 1024}KB")

    print("\nconstants for Background.svelte's UFO_PART:")
    print(f"  hull aspect    {hull_aspect:.4f}   (w/h — size the hull from its WIDTH and keep this)")
    print(f"  antenna aspect {ant_aspect:.4f}")
    print(f"  antenna width  {ref['antenna_of_hull_w']:.4f} of the hull's width")
    print(f"  emitter        cx={emitter['cx']:.4f} cy={emitter['cy']:.4f}"
          f" w={emitter['w']:.4f} bottom={emitter['bottom']:.4f}  (fractions of the HULL box)")
    print("\nreference cross-check (the designer's composite, in its own pixels):")
    print(f"  hull {ref['hull_w']}px wide, antenna {ref['ball_w_px']}x{ref['antenna_h_px']}"
          f" -> aspect {ref['ball_w_px'] / ref['antenna_h_px']:.3f}"
          f" vs the antenna file's {ant_aspect:.3f}")

    # --- preview: the parts re-assembled the way the game will assemble them -------------------
    hw = 520
    hh = round(hw / hull_aspect)
    aw = round(hw * ref["antenna_of_hull_w"])
    ah = round(aw / ant_aspect)
    OVERLAP = 0.03
    canvas = Image.new("RGBA", (hw + 40, hh + round(ah * (1 - OVERLAP)) + 40), (26, 24, 48, 255))
    canvas.alpha_composite(antenna.resize((aw, ah), Image.LANCZOS), ((canvas.width - aw) // 2, 20))
    canvas.alpha_composite(
        hull.resize((hw, hh), Image.LANCZOS), (20, 20 + round(ah * (1 - OVERLAP)))
    )
    # Mark the emitter the drawn beam will hang off.
    mark = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ex = 20 + emitter["cx"] * hw
    ey = 20 + round(ah * (1 - OVERLAP)) + emitter["bottom"] * hh
    er = emitter["w"] * hw / 2
    from PIL import ImageDraw

    ImageDraw.Draw(mark).line([(ex - er, ey), (ex + er, ey)], fill=(255, 90, 200, 255), width=3)
    canvas.alpha_composite(mark)
    canvas.save(PREVIEW)
    print("\npreview (parts assembled, emitter marked):", PREVIEW.relative_to(ROOT))


if __name__ == "__main__":
    main()
