#!/usr/bin/env python3
"""Cut the BATTERY (L1) into its animatable layers and measure its panel window.

Unlike the scatter, nothing has to be reconstructed here: the Figma housing (MOTHERSHIP nodes
9034:25820 / 9034:26096, which serve the same raster) is already drawn with an EMPTY red panel, and
the battery cell (9034:26061) is a separate node. So this only normalises them onto the shared
symbol canvas and measures where the panel window sits, which is what the balloons and the cell
have to be confined to at runtime.

There is no composed lockup for this symbol -- 9034:26096 returns the bare housing, exactly as the
compass did -- so the cell's size and position inside the panel are AUTHORED here, not measured.

    battery.webp       the housing, empty red panel  (the cell's base sprite)
    battery_cell.webp  the battery character that pops inside it

The balloons are NOT textures. Figma supplies them as 3x3 and 2x2 SVG circles (9034:26069 /
9034:26092) -- that is a size and a colour, not artwork, and the brief calls for random big and
small ones. So they are drawn procedurally from the colour printed below.

Canvas: 328 x 264, portrait content letterboxed to full height, matching every other symbol.

Run:  python3 scripts/build-battery-art.py
"""

from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art-src" / "battery"
OUT = ROOT / "static" / "assets" / "components" / "symbols" / "magnetic" / "low"
PREVIEW = SRC / "preview_battery_layers.png"

CANVAS_W, CANVAS_H = 328, 264

# The MOTHERSHIP redesign supplies the balloons as two SVG circles, nodes 9034:26069 (r=1.5) and
# 9034:26092 (r=1) -- both filled #FD5947. So the design varies SIZE, not colour: what was two
# swatches in the first pass is one colour in two radii now, and the runtime must not invent a
# second hue to tell big from small.
BALLOON = (253, 89, 71)

# The cell is composited at ~55px tall on the board and the win state pops it; 2x leaves headroom.
CELL_SUPERSAMPLE = 2

BG_TOLERANCE = 18


def die(msg: str) -> None:
    sys.exit(f"build-battery-art: {msg}")


def key_backdrop(im: Image.Image) -> Image.Image:
    """Flood the flat export backdrop to transparent from the border.

    Border-flood rather than a global colour key: the cell's face has white highlights that a
    global key would punch straight through.
    """
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


def alpha_bbox(im: Image.Image, thresh: int = 8):
    bb = im.getchannel("A").point(lambda v: 255 if v > thresh else 0).getbbox()
    if bb is None:
        die("layer came out fully transparent")
    return bb


def fit_canvas(content: Image.Image, cw: int, ch: int):
    """Scale to fill canvas HEIGHT, centre, and hand back the transform.

    The transform is returned because the panel rect has to be expressed in the SAME canvas
    fractions the runtime uses — deriving it from the source image independently would drift.
    """
    bb = alpha_bbox(content)
    cropped = content.crop(bb)
    scale = ch / cropped.height
    new = cropped.resize((max(1, round(cropped.width * scale)), ch), Image.LANCZOS)
    if new.width > cw:
        die(f"content {new.width}px wider than the {cw}px canvas -- lockup is not portrait")
    x0 = (cw - new.width) // 2
    out = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    out.alpha_composite(new, (x0, 0))
    return out, scale, x0, bb


def main() -> None:
    house_path = SRC / "housing.png"
    cell_path = SRC / "cell_4x.png"
    for p in (house_path, cell_path):
        if not p.exists():
            die(f"missing source {p.relative_to(ROOT)}")

    house = Image.open(house_path).convert("RGBA")
    OUT.mkdir(parents=True, exist_ok=True)

    battery, _fit_scale, _fit_x0, _fit_bb = fit_canvas(house, CANVAS_W, CANVAS_H)
    battery.save(OUT / "battery.webp", lossless=True, method=6)
    battery.resize((CANVAS_W // 2, CANVAS_H // 2), Image.LANCZOS).save(
        OUT / "battery_mobile.webp", lossless=True, method=6
    )

    # --- panel window --------------------------------------------------------------------------
    # Measured on the FITTED canvas, not the source, so the fractions are exactly what the runtime
    # multiplies by the symbol box. The panel is the one large saturated-red field.
    arr = np.array(battery).astype(int)
    red = (arr[:, :, 3] > 200) & (arr[:, :, 0] > 150) & (arr[:, :, 1] < 80) & (arr[:, :, 2] < 70)
    # Drop stray red pixels (outline speckle) by keeping only rows/cols that are substantially red.
    rows = np.nonzero(red.sum(axis=1) > red.sum(axis=1).max() * 0.4)[0]
    cols = np.nonzero(red.sum(axis=0) > red.sum(axis=0).max() * 0.4)[0]
    if rows.size == 0 or cols.size == 0:
        die("could not locate the red panel window")
    px0, px1, py0, py1 = cols.min(), cols.max(), rows.min(), rows.max()

    cell = key_backdrop(Image.open(cell_path))
    cell = cell.crop(alpha_bbox(cell))
    # Sized against the PANEL, not the canvas: the cell lives inside the window, and the balloons
    # need room to pass behind it.
    panel_h = (py1 - py0) / CANVAS_H
    panel_w = (px1 - px0) / CANVAS_W
    cell_h = panel_h * 0.70
    cell_w = cell_h * (cell.width / cell.height) * (CANVAS_H / CANVAS_W)
    cell_out = cell.resize(
        (
            max(1, round(cell_w * CANVAS_W * CELL_SUPERSAMPLE)),
            max(1, round(cell_h * CANVAS_H * CELL_SUPERSAMPLE)),
        ),
        Image.LANCZOS,
    )
    cell_out.save(OUT / "battery_cell.webp", lossless=True, method=6)

    print("layers written to", OUT.relative_to(ROOT))
    for name, im in (
        ("battery.webp", battery),
        ("battery_cell.webp", cell_out),
    ):
        print(f"  {name:22s} {im.size}")

    print("\nplacements (fractions of the 328x264 symbol canvas, cx/cy as offsets from centre):")
    print(
        f"  {'PANEL':6s} dx={((px0 + px1) / 2) / CANVAS_W - 0.5:+.4f} "
        f"dy={((py0 + py1) / 2) / CANVAS_H - 0.5:+.4f} "
        f"w={panel_w:.4f} h={panel_h:.4f}"
    )
    print(f"  {'CELL':6s} w={cell_w:.4f} h={cell_h:.4f}  (centred in the panel)")
    print(f"  balloons: rgb{BALLOON} = 0x{'%02x%02x%02x' % BALLOON} (one colour, two radii)")
    print(f"  panel mean rgb {arr[red][:, :3].mean(axis=0).round(1)} -- balloons must read against this")

    # --- preview -------------------------------------------------------------------------------
    def checker(im):
        bg = Image.new("RGBA", im.size, (0, 0, 0, 0))
        for yy in range(0, im.height, 16):
            for xx in range(0, im.width, 16):
                c = (92, 92, 102, 255) if ((xx // 16 + yy // 16) % 2 == 0) else (56, 56, 64, 255)
                bg.paste(c, (xx, yy, min(xx + 16, im.width), min(yy + 16, im.height)))
        bg.alpha_composite(im)
        return bg

    # Third tile: the assembled symbol with the cell placed and a few sample balloons, so the
    # panel rect and cell size can be checked without booting the game.
    demo = battery.copy()
    cw2, ch2 = round(cell_w * CANVAS_W), round(cell_h * CANVAS_H)
    demo.alpha_composite(
        cell_out.resize((cw2, ch2), Image.LANCZOS),
        (round((px0 + px1) / 2 - cw2 / 2), round((py0 + py1) / 2 - ch2 / 2)),
    )
    tiles = [checker(battery), checker(cell_out), checker(demo)]
    W = sum(t.width for t in tiles) + 40
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
