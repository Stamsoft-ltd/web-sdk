#!/usr/bin/env python3
"""Assemble the Version2 COMPASS (H1) and cut it into its animatable layers.

This one is different from the scatter and the battery: Figma has NO composed lockup for the
compass. Node 9012:11949 (given as the "end look") is byte-identical to the bare bezel 9012:11972,
so the arrangement below is an authored layout, not a measurement, and was approved from
art-src/compass/compass_layout_mock.png. Treat LAYOUT as the source of truth for it -- there is
nothing in Figma to diff against.

    compass.webp        bezel with the two chevrons baked in  (the cell's base sprite)
    compass_needle.webp the magnet bar that rotates
    compass_alien.webp  the face that zooms on a win
    compass_n.webp      N badge, pops on a win
    compass_s.webp      S badge, pops on a win

The two chevrons are ONE source mirrored: Figma serves both nodes the same raster (identical md5)
and flips one with a transform, so this bakes the source on the right and its mirror on the left.

Canvas: 328 x 264. The compass is SQUARE, so it letterboxes to full height at 264 x 264.

Run:  python3 scripts/build-compass-art.py
"""

from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art-src" / "compass"
OUT = ROOT / "static" / "assets" / "components" / "symbols" / "magnetic" / "premium"
PREVIEW = SRC / "preview_compass_layers.png"

CANVAS_W, CANVAS_H = 328, 264

# The bezel's own coordinate space (it is 103 x 103 in Figma). Every placement below is in these
# units, measured from the bezel's top-left, so the layout can be reasoned about as a clock face.
FU = 103.0
CENTRE = 51.5

# Approved layout: (centre_x, centre_y, height) in bezel units.
LAYOUT = {
    "chevron_w": (26.0, CENTRE, 26.0),
    "chevron_e": (77.0, CENTRE, 26.0),
    "badge_n": (CENTRE, 21.0, 20.0),
    "badge_s": (CENTRE, 82.0, 17.0),
    "needle": (CENTRE, CENTRE, 52.0),
    "alien": (CENTRE, 53.0, 26.0),
}

# Loose layers are composited at ~35-65px on the board and the win state scales them; 2x is headroom.
SUPERSAMPLE = 2
BG_TOLERANCE = 20


def die(msg: str) -> None:
    sys.exit(f"build-compass-art: {msg}")


def key_backdrop(im: Image.Image) -> Image.Image:
    """Flood the flat export backdrop to transparent from the border."""
    im = im.convert("RGBA")
    a = np.array(im)
    h, w = a.shape[:2]
    rgb = a[:, :, :3].astype(np.int16)
    near = np.abs(rgb - rgb[0, 0]).max(axis=2) <= BG_TOLERANCE
    seen = np.zeros((h, w), dtype=bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and near[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    a[:, :, 3] = np.where(seen, 0, a[:, :, 3])
    return Image.fromarray(a, "RGBA")


def trimmed(im: Image.Image) -> Image.Image:
    bb = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if bb is None:
        die("a source came out fully transparent")
    return im.crop(bb)


def main() -> None:
    need = ["bezel_4x.png", "needle.png", "badge_n.png", "badge_s.png", "chevron.png", "alien.png"]
    for n in need:
        if not (SRC / n).exists():
            die(f"missing source art-src/compass/{n}")

    bezel = key_backdrop(Image.open(SRC / "bezel_4x.png"))
    # The bezel IS the compass frame, so its own box defines the unit grid.
    upx = bezel.width / FU

    needle = trimmed(key_backdrop(Image.open(SRC / "needle.png")))
    chevron = trimmed(Image.open(SRC / "chevron.png").convert("RGBA"))
    badge_n = trimmed(Image.open(SRC / "badge_n.png").convert("RGBA"))
    badge_s = trimmed(Image.open(SRC / "badge_s.png").convert("RGBA"))
    alien = trimmed(Image.open(SRC / "alien.png").convert("RGBA"))

    def paste(canvas: Image.Image, im: Image.Image, key: str, unit: float, mirror: bool = False):
        cx, cy, h = LAYOUT[key]
        art = im.transpose(Image.FLIP_LEFT_RIGHT) if mirror else im
        th = max(1, round(h * unit))
        tw = max(1, round(art.width * (h * unit) / art.height))
        canvas.alpha_composite(
            art.resize((tw, th), Image.LANCZOS), (round(cx * unit - tw / 2), round(cy * unit - th / 2))
        )

    # --- base: bezel + the two static chevrons ---------------------------------------------
    base_src = bezel.copy()
    paste(base_src, chevron, "chevron_e", upx)
    paste(base_src, chevron, "chevron_w", upx, mirror=True)

    # Fit to canvas height. The compass is square, so content is 264 x 264 inside 328 x 264.
    body = trimmed(base_src)
    scale = CANVAS_H / body.height
    fitted = body.resize((max(1, round(body.width * scale)), CANVAS_H), Image.LANCZOS)
    if fitted.width > CANVAS_W:
        die("compass content is wider than the canvas")
    x0 = (CANVAS_W - fitted.width) // 2
    compass = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    compass.alpha_composite(fitted, (x0, 0))

    OUT.mkdir(parents=True, exist_ok=True)
    compass.save(OUT / "compass.webp", lossless=True, method=6)
    compass.resize((CANVAS_W // 2, CANVAS_H // 2), Image.LANCZOS).save(
        OUT / "compass_mobile.webp", lossless=True, method=6
    )

    # Canvas pixels per bezel unit, and where the bezel's origin lands. Derived from the SAME fit
    # that produced compass.webp -- computing it from CANVAS_H/FU instead would ignore the bezel's
    # own transparent margin and shift every loose layer.
    bez_bb = trimmed(base_src)
    full_bb = base_src.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    cpu = upx * scale  # canvas px per bezel unit
    ox = x0 - full_bb[0] * scale
    oy = -full_bb[1] * scale
    del bez_bb

    # --- loose layers ------------------------------------------------------------------------
    loose = {
        "compass_needle.webp": (needle, "needle"),
        "compass_alien.webp": (alien, "alien"),
        "compass_n.webp": (badge_n, "badge_n"),
        "compass_s.webp": (badge_s, "badge_s"),
    }
    placements = {}
    for fname, (im, key) in loose.items():
        cx, cy, h = LAYOUT[key]
        th = h * cpu
        tw = im.width * th / im.height
        im.resize(
            (max(1, round(tw * SUPERSAMPLE)), max(1, round(th * SUPERSAMPLE))), Image.LANCZOS
        ).save(OUT / fname, lossless=True, method=6)
        placements[key] = (
            (ox + cx * cpu) / CANVAS_W - 0.5,
            (oy + cy * cpu) / CANVAS_H - 0.5,
            tw / CANVAS_W,
            th / CANVAS_H,
        )

    print("layers written to", OUT.relative_to(ROOT))
    print(f"  {'compass.webp':22s} {compass.size}")
    for fname in loose:
        print(f"  {fname:22s} {Image.open(OUT / fname).size}")

    print("\nplacements (fractions of the 328x264 canvas, dx/dy offset from centre):")
    for key, (dx, dy, w, h) in placements.items():
        print(f"  {key:9s} dx={dx:+.4f} dy={dy:+.4f} w={w:.4f} h={h:.4f}")
    # The needle rotates about the bezel centre; the runtime needs that pivot explicitly.
    print(
        f"  {'PIVOT':9s} dx={(ox + CENTRE * cpu) / CANVAS_W - 0.5:+.4f} "
        f"dy={(oy + CENTRE * cpu) / CANVAS_H - 0.5:+.4f}"
    )

    # --- preview -------------------------------------------------------------------------------
    demo = compass.copy()
    for key in ("needle", "alien", "badge_n", "badge_s"):
        fname = {
            "needle": "compass_needle.webp",
            "alien": "compass_alien.webp",
            "badge_n": "compass_n.webp",
            "badge_s": "compass_s.webp",
        }[key]
        dx, dy, w, h = placements[key]
        art = Image.open(OUT / fname).convert("RGBA")
        tw, th = round(w * CANVAS_W), round(h * CANVAS_H)
        demo.alpha_composite(
            art.resize((tw, th), Image.LANCZOS),
            (round((0.5 + dx) * CANVAS_W - tw / 2), round((0.5 + dy) * CANVAS_H - th / 2)),
        )

    def checker(im):
        bg = Image.new("RGBA", im.size, (0, 0, 0, 0))
        for yy in range(0, im.height, 16):
            for xx in range(0, im.width, 16):
                c = (92, 92, 102, 255) if ((xx // 16 + yy // 16) % 2 == 0) else (56, 56, 64, 255)
                bg.paste(c, (xx, yy, min(xx + 16, im.width), min(yy + 16, im.height)))
        bg.alpha_composite(im)
        return bg

    tiles = [checker(compass), checker(demo)]
    sheet = Image.new(
        "RGBA", (sum(t.width for t in tiles) + 30, max(t.height for t in tiles) + 20), (26, 26, 32, 255)
    )
    xo = 10
    for t in tiles:
        sheet.alpha_composite(t, (xo, 10))
        xo += t.width + 10
    sheet.save(PREVIEW)
    print("\npreview:", PREVIEW.relative_to(ROOT))


if __name__ == "__main__":
    main()
