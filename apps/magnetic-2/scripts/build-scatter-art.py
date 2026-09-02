#!/usr/bin/env python3
"""Cut the Version2 SCATTER (containment capsule + alien) into its animatable layers.

The Figma lockup (node 9010:11165, a 79 x 106.24 frame) is a single flat composition: the alien
sits ON TOP of the glass tube, and the eye on top of the alien. Nothing in it can move. The board
needs three separate textures so the alien can jump and the eye can blink:

    scatter.webp        the capsule with an EMPTY tube  (the cell's base sprite)
    scatter_alien.webp  the alien body, no eye
    scatter_eye.webp    the eye alone

Figma cannot export the capsule without the alien -- the alien is a sibling layer in the same
group, and there is no node that means "everything except that". So the tube interior it covers is
RECONSTRUCTED here: the tube is near-flat cyan with its highlight streaks at the left/right edges
and the purple ring crossing it, all of which stay visible either side of the alien. Filling each
covered scanline by interpolating from its nearest uncovered neighbours therefore rebuilds the real
gradient rather than guessing it. Verify against preview_scatter_layers.png, not by eye on the board.

Canvas: 328 x 264 to match every other symbol in the set. The capsule is PORTRAIT, so it is
letterboxed to full canvas height -- which is what the art it replaces already did (its content
measured 188 x 263 in the same canvas), so the cell geometry is untouched.

Run:  python3 scripts/build-scatter-art.py
"""

from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art-src" / "scatter"
OUT = ROOT / "static" / "assets" / "components" / "symbols" / "magnetic" / "special"
PREVIEW = ROOT / "art-src" / "scatter" / "preview_scatter_layers.png"

# The Figma frame this was measured in. Every rect below is in these units so the numbers can be
# read straight off the node inspector.
FW, FH = 79.0, 106.24137878417969

# Sub-rects of the lockup, in frame units (x, y, w, h), read off the Figma node inspector.
ALIEN = (21.7927003, 29.9655084, 35.4137917, 43.5862083)
# The two glowing bands the win state arcs lightning across, and the glass tube the bubbles rise
# in. Node ids are the vectors these were measured from, so they can be re-checked in Figma.
DOME_BAND = (29.9225488, 25.4935598, 19.2448406, 5.4556808)   # 9010:11232
LOWER_BAND = (32.1146283, 73.4705801, 14.9690886, 4.0330729)  # 9010:11209
TUBE = (16.5226636, 31.3042993, 46.0194855, 38.2985306)       # 9010:11191
# The eye is a child of the alien frame at +10.8967, +13.6207 -- resolved to frame-absolute here.
EYE = (ALIEN[0] + 10.8966866, ALIEN[1] + 13.6206684, 13.6206894, 13.6206894)

# Symbol canvas, shared with every other symbol in the set.
CANVAS_W, CANVAS_H = 328, 264

# Oversample for the loose layers: they are composited at ~88px and ~34px wide on the board, and
# the win state scales the alien up. 2x leaves headroom without a second texture.
ALIEN_SUPERSAMPLE = 2

BG_TOLERANCE = 18  # flat #f5f5f5 export backdrop


def die(msg: str) -> None:
    sys.exit(f"build-scatter-art: {msg}")


def key_backdrop(im: Image.Image) -> Image.Image:
    """Flood the flat export backdrop to transparent from the corners.

    A global colour key would also punch the white glint in the eye and the white specular on the
    dome. Flooding only from the border reaches the backdrop and nothing enclosed by the artwork.
    """
    im = im.convert("RGBA")
    a = np.array(im)
    h, w = a.shape[:2]
    rgb = a[:, :, :3].astype(np.int16)
    seed = rgb[0, 0]
    near = (np.abs(rgb - seed).max(axis=2) <= BG_TOLERANCE)

    out = np.zeros((h, w), dtype=bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x] and not out[y, x]:
                out[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x] and not out[y, x]:
                out[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and near[ny, nx] and not out[ny, nx]:
                out[ny, nx] = True
                q.append((ny, nx))

    a[:, :, 3] = np.where(out, 0, a[:, :, 3])
    return Image.fromarray(a, "RGBA")


def inpaint_rows(im: Image.Image, mask: np.ndarray) -> Image.Image:
    """Rebuild pixels under `mask` by interpolating across each scanline.

    Horizontal (not vertical) because the tube's structure runs vertically: flat cyan in the
    middle, highlight streaks down both edges, and the purple ring as horizontal bands. Every one
    of those is continuous along a row, so a row-wise fill reproduces them; a column-wise fill
    would smear the ring down the tube.
    """
    a = np.array(im).astype(np.float32)
    h, w = a.shape[:2]
    for y in range(h):
        m = mask[y]
        if not m.any():
            continue
        keep = np.flatnonzero(~m)
        if keep.size == 0:
            continue  # fully covered row: nothing to interpolate from, leave it
        idx = np.flatnonzero(m)
        for c in range(4):
            a[y, idx, c] = np.interp(idx, keep, a[y, keep, c])
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), "RGBA")


def alpha_bbox(im: Image.Image, thresh: int = 8):
    bb = im.getchannel("A").point(lambda v: 255 if v > thresh else 0).getbbox()
    if bb is None:
        die("layer came out fully transparent")
    return bb


def fit_canvas(content: Image.Image, cw: int, ch: int):
    """Scale `content` to fill the canvas HEIGHT and centre it. Portrait art, landscape canvas.

    Returns the placed image AND the transform used, because the loose layers have to land on the
    same grid. Fitting the CONTENT BBOX (not the Figma frame) is deliberate -- it makes the capsule
    fill the canvas exactly like the art it replaces, whose content measured 263 of 264 rows -- but
    it means the frame->canvas mapping is only knowable here. Deriving the placements from
    CANVAS_H/FH instead silently shifts every layer by the frame's internal margin.
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
    comp_path = SRC / "composite_4x.png"
    alien_path = SRC / "alien_body.png"
    eye_path = SRC / "eye_4x.png"
    for p in (comp_path, alien_path, eye_path):
        if not p.exists():
            die(f"missing source {p.relative_to(ROOT)}")

    comp = key_backdrop(Image.open(comp_path))
    px_per_unit = comp.width / FW
    if abs(comp.height / FH - px_per_unit) > 0.02:
        die("composite aspect does not match the Figma frame")

    # --- alien silhouette, placed exactly where Figma puts it -------------------------------
    # NOT cropped to its content bbox: Figma maps the WHOLE raster -- transparent margin included
    # -- into the placement rect. Cropping first scales the visible alien up by its own padding,
    # which lands it oversized in the tube and drags the eye off its socket.
    alien_src = Image.open(alien_path).convert("RGBA")
    ax, ay, aw, ah = ALIEN
    box = (round(aw * px_per_unit), round(ah * px_per_unit))
    alien_in_place = Image.new("RGBA", comp.size, (0, 0, 0, 0))
    alien_in_place.alpha_composite(
        alien_src.resize(box, Image.LANCZOS), (round(ax * px_per_unit), round(ay * px_per_unit))
    )

    # Dilate the silhouette: the alien carries a dark outline and a soft contact shadow, and any
    # surviving fringe of it would read as dirt on the empty tube.
    m = np.array(alien_in_place.getchannel("A")) > 6
    for _ in range(3):
        g = m.copy()
        g[1:, :] |= m[:-1, :]
        g[:-1, :] |= m[1:, :]
        g[:, 1:] |= m[:, :-1]
        g[:, :-1] |= m[:, 1:]
        m = g

    base = inpaint_rows(comp, m)
    # Re-key: interpolation runs across the transparent surround too, which re-tints those pixels.
    base = key_backdrop(Image.fromarray(np.dstack(
        [np.array(base)[:, :, :3], np.array(comp.getchannel("A"))]
    ), "RGBA"))

    # --- write layers ------------------------------------------------------------------------
    OUT.mkdir(parents=True, exist_ok=True)
    scatter, fit_scale, fit_x0, fit_bb = fit_canvas(base, CANVAS_W, CANVAS_H)
    scatter.save(OUT / "scatter.webp", lossless=True, method=6)

    # Canvas pixels per Figma frame unit, and where frame-origin lands on the canvas. Every
    # placement and every loose-layer size below is expressed through these two, so the layers and
    # the base can never drift apart.
    art_scale = px_per_unit * fit_scale
    origin_x = fit_x0 - fit_bb[0] * fit_scale
    origin_y = -fit_bb[1] * fit_scale

    mob = scatter.resize((CANVAS_W // 2, CANVAS_H // 2), Image.LANCZOS)
    mob.save(OUT / "scatter_mobile.webp", lossless=True, method=6)

    # The dome, cut again as a FRONT layer. Without it the alien cannot jump at all: it already
    # fills the tube to within 0.019 of the cell height of the lid, so any hop worth seeing would
    # draw the alien straight over the machine's metal top. Re-drawn over the alien, the same
    # pixels occlude it instead, so it rises BEHIND the lid the way it physically would.
    # The strip is a straight crop of the base at the same position -- nothing is reconstructed,
    # and at rest it composites pixel-identically over itself.
    arr_a = np.array(scatter).astype(int)
    glass = (
        (arr_a[:, :, 3] > 200)
        & (arr_a[:, :, 2] > 150)
        & (arr_a[:, :, 1] > 110)
        & (arr_a[:, :, 0] < 90)
    )
    gys = np.nonzero(glass.any(axis=1))[0]
    if gys.size == 0:
        die("could not find the glass tube -- dome cut needs the cyan interior")
    dome_cut = int(gys.min())  # first row of glass == bottom of the lid
    dome = scatter.crop((0, 0, CANVAS_W, dome_cut))
    dome.save(OUT / "scatter_dome.webp", lossless=True, method=6)

    alien_out = alien_src.resize(
        (round(aw * art_scale * ALIEN_SUPERSAMPLE), round(ah * art_scale * ALIEN_SUPERSAMPLE)),
        Image.LANCZOS,
    )
    alien_out.save(OUT / "scatter_alien.webp", lossless=True, method=6)

    eye = key_backdrop(Image.open(eye_path))  # same whole-raster rule as the alien above
    ew, eh = EYE[2], EYE[3]
    eye_out = eye.resize(
        (round(ew * art_scale * ALIEN_SUPERSAMPLE), round(eh * art_scale * ALIEN_SUPERSAMPLE)),
        Image.LANCZOS,
    )
    eye_out.save(OUT / "scatter_eye.webp", lossless=True, method=6)

    # --- placement constants, as fractions of the 328x264 canvas -----------------------------
    def frac(rect):
        x, y, w, h = rect
        px, py = origin_x + x * art_scale, origin_y + y * art_scale
        return {
            "cx": (px + w * art_scale / 2) / CANVAS_W,
            "cy": (py + h * art_scale / 2) / CANVAS_H,
            "w": (w * art_scale) / CANVAS_W,
            "h": (h * art_scale) / CANVAS_H,
        }

    print("layers written to", OUT.relative_to(ROOT))
    for name, im in (
        ("scatter.webp", scatter),
        ("scatter_alien.webp", alien_out),
        ("scatter_eye.webp", eye_out),
        ("scatter_dome.webp", dome),
    ):
        print(f"  {name:22s} {im.size}")
    ALIEN_F = frac(ALIEN)
    print("\nplacements (fractions of the 328x264 symbol canvas):")
    for name, rect in (
        ("ALIEN", ALIEN),
        ("EYE", EYE),
        ("DOME_BAND", DOME_BAND),
        ("LOWER_BAND", LOWER_BAND),
        ("TUBE", TUBE),
    ):
        f = frac(rect)
        print(f"  {name:11s} cx={f['cx']:.4f} cy={f['cy']:.4f} w={f['w']:.4f} h={f['h']:.4f}")

    # Dome front layer + the headroom it buys, both as fractions of the symbol box.
    alien_top_pad = np.nonzero((np.array(alien_out)[:, :, 3] > 8).any(axis=1))[0].min() / alien_out.height
    alien_vis_top = ALIEN_F["cy"] - 0.5 - ALIEN_F["h"] / 2 + alien_top_pad * ALIEN_F["h"]
    print(f"  {'DOME_FRONT':11s} cy={dome_cut / 2 / CANVAS_H:.4f} h={dome_cut / CANVAS_H:.4f}")
    print(
        f"  {'HOP_LIMIT':11s} {alien_vis_top - (dome_cut / CANVAS_H - 0.5):.4f}"
        f"  (alien visible top {alien_vis_top:.4f} vs lid {dome_cut / CANVAS_H - 0.5:.4f};"
        f" beyond this the alien is occluded by scatter_dome, which is the point)"
    )

    # The word SCATTER is baked into the plate, so its glyph box has to be MEASURED off the render
    # rather than read from Figma: the plate is drawn art, not a text node. Bright green glyphs on a
    # dark plate key cleanly on green-dominance.
    arr = np.array(scatter).astype(int)
    green = (arr[:, :, 3] > 40) & (arr[:, :, 1] > 140) & (arr[:, :, 1] - arr[:, :, 2] > 60)
    green[: int(CANVAS_H * 0.72), :] = False  # plate only; the alien and blobs are green too
    ys, xs = np.nonzero(green)
    if ys.size:
        print(
            f"  {'WORD':11s} cx={(xs.min() + xs.max()) / 2 / CANVAS_W:.4f} "
            f"cy={(ys.min() + ys.max()) / 2 / CANVAS_H:.4f} "
            f"w={(xs.max() - xs.min()) / CANVAS_W:.4f} h={(ys.max() - ys.min()) / CANVAS_H:.4f}"
        )

    # --- preview -----------------------------------------------------------------------------
    def checker(im):
        bg = Image.new("RGBA", im.size, (0, 0, 0, 0))
        for yy in range(0, im.height, 16):
            for xx in range(0, im.width, 16):
                c = (92, 92, 102, 255) if ((xx // 16 + yy // 16) % 2 == 0) else (56, 56, 64, 255)
                bg.paste(c, (xx, yy, min(xx + 16, im.width), min(yy + 16, im.height)))
        bg.alpha_composite(im)
        return bg

    tiles = [checker(scatter), checker(alien_out), checker(eye_out.resize((132, 132), Image.NEAREST))]
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
