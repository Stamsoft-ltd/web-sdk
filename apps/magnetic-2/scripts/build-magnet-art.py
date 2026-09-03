#!/usr/bin/env python3
"""Cut the MOTHERSHIP MAGNET (aTile, the horseshoe) into its animatable layers.

    art-src/magnet/body.png       the orange horseshoe with its +/- caps, no face   (9046:16277)
    art-src/magnet/parts.png      ONE sheet holding the face, both antennae and both green
                                  hands. All five "part" nodes -- 9046:16278, 16279, 16280,
                                  16281, 16282 -- serve this same raster; there is no per-part
                                  node to download.
    art-src/magnet/reference.png  the composed lockup, supplied by the designer

Body and parts are both 1536x1024 in the same frame, so compositing them directly looks like it
should reproduce the symbol. It does NOT. The sheet is a loose-parts LAYOUT, not a composition: the
face lands low across the magnet's gap, the antennae sit inward, and the green hands sit on the
terminal caps instead of the arch's shoulders. The only place the real arrangement exists is
reference.png.

So this script takes the ART from parts.png and the PLACEMENT from reference.png, mapping between
the two through the body, which appears in both. Both are keyed by colour, which works because
every part is its own hue: the antennae are cyan, the face purple, the hands green.

The reference-to-source scale comes from the body's HEIGHT alone. Its width is unusable: the green
hands overlap the arch's shoulders in the reference and hide ~22px of orange, so the visible orange
box is 5.6% narrower there than in body.png and a width-derived scale bakes that error into every
placement. Height is unobstructed at both ends, and x is anchored on the body's centre, which is
safe because the shape is symmetric and any occlusion is symmetric with it.

Outputs onto the shared 328x264 symbol canvas:

    nut.webp / nut_mobile.webp    the body (the name is historical -- this slot was a nut once)
    magnet_face.webp              the face
    magnet_antenna_l/r.webp       the two antennae
    magnet_hand_l/r.webp          the two green hands

It also measures the centres of the green - and + marks on the caps, which are the endpoints the
win state arcs electricity between.

Run:  python3 scripts/build-magnet-art.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art-src" / "magnet"
OUT = ROOT / "static" / "assets" / "components" / "symbols" / "magnetic" / "low"
PREVIEW = SRC / "preview_magnet_layers.png"

CANVAS_W, CANVAS_H = 328, 264
SUPERSAMPLE = 3


def die(msg: str) -> None:
    sys.exit(f"build-magnet-art: {msg}")


def keys(im: Image.Image):
    a = np.array(im.convert("RGBA")).astype(int)
    r, g, b, al = a[:, :, 0], a[:, :, 1], a[:, :, 2], a[:, :, 3]
    op = al > 120
    return {
        "orange": op & (r > 200) & (g > 90) & (g < 190) & (b < 90),
        "cyan": op & (b > 200) & (g > 150) & (r < 150),
        "purple": op & (r > 90) & (r < 170) & (g < 110) & (b > 180),
        "green": op & (g > 190) & (r > 100) & (r < 200) & (b < 110),
    }


def blobs(mask: np.ndarray, minpx: int = 60):
    h, w = mask.shape
    seen = np.zeros_like(mask)
    out = []
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
            if len(pts) >= minpx:
                out.append(pts)
    return out


def bb(pts):
    ys = [p[0] for p in pts]
    xs = [p[1] for p in pts]
    return min(xs), min(ys), max(xs) + 1, max(ys) + 1


def union(*boxes):
    return (min(b[0] for b in boxes), min(b[1] for b in boxes),
            max(b[2] for b in boxes), max(b[3] for b in boxes))


def alpha_bbox(im: Image.Image, thresh: int = 8):
    b = im.getchannel("A").point(lambda v: 255 if v > thresh else 0).getbbox()
    if b is None:
        die("layer came out fully transparent")
    return b


def pair(boxes, name):
    """Group blobs into a LEFT and a RIGHT part, merging any that share a side.

    Each antenna keys as two blobs — the ball and the stalk are different cyans — so a plain
    "expect two blobs" check fails on them.
    """
    if len(boxes) < 2:
        die(f"expected two {name}, found {len(boxes)}")
    mid = (min(b[0] for b in boxes) + max(b[2] for b in boxes)) / 2
    left = [b for b in boxes if (b[0] + b[2]) / 2 < mid]
    right = [b for b in boxes if (b[0] + b[2]) / 2 >= mid]
    if not left or not right:
        die(f"could not split {name} into a left and a right")
    return union(*left), union(*right)


def main() -> None:
    for n in ("body.png", "parts.png", "reference.png"):
        if not (SRC / n).exists():
            die(f"missing source art-src/magnet/{n}")
    OUT.mkdir(parents=True, exist_ok=True)

    body = Image.open(SRC / "body.png").convert("RGBA")
    parts = Image.open(SRC / "parts.png").convert("RGBA")
    ref = Image.open(SRC / "reference.png").convert("RGBA")

    bk, pk, rk = keys(body), keys(parts), keys(ref)

    # --- the mapping, off the body's silhouette in both images -------------------------------
    body_box = bb(max(blobs(bk["orange"], 400), key=len))
    ref_box = bb(max(blobs(rk["orange"], 400), key=len))
    scale = (body_box[3] - body_box[1]) / (ref_box[3] - ref_box[1])
    ref_cx = (ref_box[0] + ref_box[2]) / 2
    body_cx = (body_box[0] + body_box[2]) / 2

    def to_src(box):
        """A box measured in the reference, expressed in the 1536x1024 source frame."""
        return (
            body_cx + (box[0] - ref_cx) * scale,
            body_box[1] + (box[1] - ref_box[1]) * scale,
            body_cx + (box[2] - ref_cx) * scale,
            body_box[1] + (box[3] - ref_box[1]) * scale,
        )

    # --- where each part BELONGS, from the reference -------------------------------------------
    ref_ant_l, ref_ant_r = pair([bb(p) for p in blobs(rk["cyan"], 150)], "antennae")
    ref_face = bb(max(blobs(rk["purple"], 400), key=len))
    ref_hands = sorted((bb(p) for p in blobs(rk["green"], 400)), key=lambda b: b[0])
    if len(ref_hands) < 2:
        die(f"expected two green hands in the reference, found {len(ref_hands)}")
    ref_hand_l, ref_hand_r = ref_hands[0], ref_hands[-1]

    # --- what each part LOOKS LIKE, from the sheet ---------------------------------------------
    src_ant_l, src_ant_r = pair([bb(p) for p in blobs(pk["cyan"], 150)], "antennae")
    src_face = bb(max(blobs(pk["purple"], 400), key=len))
    src_hands = sorted((bb(p) for p in blobs(pk["green"], 400)), key=lambda b: b[0])
    src_hand_l, src_hand_r = src_hands[0], src_hands[-1]

    # --- fit the ASSEMBLY to the canvas --------------------------------------------------------
    # Not the body. The antennae stand well above the arch, so fitting the body to full canvas
    # height puts them at dy -0.55 -- off the top of the symbol box, where they are simply clipped.
    # What has to fit is the union of the body with every part at its reference position.
    crop = alpha_bbox(body)
    content = union(
        crop,
        *(tuple(to_src(b)) for b in (ref_ant_l, ref_ant_r, ref_face, ref_hand_l, ref_hand_r)),
    )
    cw, ch = content[2] - content[0], content[3] - content[1]
    fit = min(CANVAS_H / ch, CANVAS_W / cw)
    # ox/oy are where the BODY CROP's origin lands on the canvas: the assembly is centred, then the
    # body sits however far into the assembly it starts. That offset is added, not subtracted --
    # subtracting it pushes the body up by the very gap the antennae were supposed to occupy, and
    # the arch loses its top off the canvas.
    ox = (CANVAS_W - cw * fit) / 2 + (crop[0] - content[0]) * fit
    oy = (CANVAS_H - ch * fit) / 2 + (crop[1] - content[1]) * fit
    body_c = body.crop(crop)
    fitted = body_c.resize(
        (max(1, round(body_c.width * fit)), max(1, round(body_c.height * fit))), Image.LANCZOS
    )
    plate = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    plate.alpha_composite(fitted, (round(ox), round(oy)))
    plate.save(OUT / "nut.webp", lossless=True, method=6)
    plate.resize((CANVAS_W // 2, CANVAS_H // 2), Image.LANCZOS).save(
        OUT / "nut_mobile.webp", lossless=True, method=6
    )

    def to_canvas(box):
        """Source-frame box -> canvas pixels, through the same transform the body took."""
        return (
            ox + (box[0] - crop[0]) * fit, oy + (box[1] - crop[1]) * fit,
            ox + (box[2] - crop[0]) * fit, oy + (box[3] - crop[1]) * fit,
        )

    def frac(box):
        x0, y0, x1, y1 = box
        return {
            "dx": (x0 + x1) / 2 / CANVAS_W - 0.5,
            "dy": (y0 + y1) / 2 / CANVAS_H - 0.5,
            "w": (x1 - x0) / CANVAS_W,
            "h": (y1 - y0) / CANVAS_H,
        }

    placed = {}
    for name, src_box, ref_box_i in (
        ("antenna_l", src_ant_l, ref_ant_l),
        ("antenna_r", src_ant_r, ref_ant_r),
        ("face", src_face, ref_face),
        ("hand_l", src_hand_l, ref_hand_l),
        ("hand_r", src_hand_r, ref_hand_r),
    ):
        target = to_canvas(to_src(ref_box_i))
        art = parts.crop(tuple(int(v) for v in src_box))
        art = art.crop(alpha_bbox(art))
        w = max(1, round((target[2] - target[0]) * SUPERSAMPLE))
        h = max(1, round((target[3] - target[1]) * SUPERSAMPLE))
        art.resize((w, h), Image.LANCZOS).save(
            OUT / f"magnet_{name}.webp", lossless=True, method=6
        )
        placed[name] = target

    # --- terminal marks: the endpoints the win electricity arcs between ------------------------
    marks = sorted((bb(p) for p in blobs(bk["green"], 300)), key=lambda b: b[0])
    if len(marks) < 2:
        die(f"expected the - and + marks on the caps, found {len(marks)}")
    term = {"minus": to_canvas(marks[0]), "plus": to_canvas(marks[-1])}

    # --- report ---------------------------------------------------------------------------------
    print("layers written to", OUT.relative_to(ROOT))
    print(f"  reference->source scale {scale:.4f} (from the body's HEIGHT; its width is occluded"
          f" by the hands)")
    print("\nplacements (fractions of the 328x264 symbol box, offsets from its centre):")
    for name in ("face", "antenna_l", "antenna_r", "hand_l", "hand_r"):
        f = frac(placed[name])
        print(f"  {name.upper():11s} dx={f['dx']:+.4f} dy={f['dy']:+.4f} "
              f"w={f['w']:.4f} h={f['h']:.4f}")
    for name in ("minus", "plus"):
        f = frac(term[name])
        print(f"  {('TERM_' + name).upper():11s} dx={f['dx']:+.4f} dy={f['dy']:+.4f} "
              f"w={f['w']:.4f} h={f['h']:.4f}")

    # --- preview -----------------------------------------------------------------------------
    demo = plate.copy()
    for name in ("antenna_l", "antenna_r", "hand_l", "hand_r", "face"):
        t = placed[name]
        im = Image.open(OUT / f"magnet_{name}.webp").convert("RGBA")
        demo.alpha_composite(
            im.resize((max(1, round(t[2] - t[0])), max(1, round(t[3] - t[1]))), Image.LANCZOS),
            (round(t[0]), round(t[1])),
        )
    side = ref.resize((round(ref.width * CANVAS_H / ref.height), CANVAS_H), Image.LANCZOS)
    sheet = Image.new("RGBA", (CANVAS_W * 2 + side.width + 40, CANVAS_H + 20), (26, 26, 32, 255))
    sheet.alpha_composite(plate, (10, 10))
    sheet.alpha_composite(demo, (CANVAS_W + 20, 10))
    sheet.alpha_composite(side, (CANVAS_W * 2 + 30, 10))
    sheet.save(PREVIEW)
    print("\npreview (body | assembled | designer reference):", PREVIEW.relative_to(ROOT))


if __name__ == "__main__":
    main()
