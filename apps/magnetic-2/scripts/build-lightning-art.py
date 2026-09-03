#!/usr/bin/env python3
"""Cut the MOTHERSHIP LIGHTNING badge (H2) into its animatable layers.

    art-src/lightning/body.png         the frame, its cyan and pink bars, and the yellow face,
                                       with no bolt and no corner balls            (9051:27147)
    art-src/lightning/ball.png         ONE green corner ball, drawn large           (9051:27151)
    art-src/lightning/bolt.svg         the bolt                                     (9051:27153)
    art-src/lightning/bolt_shadow.svg  the same shape in orange -- the bolt's offset shadow
    art-src/lightning/reference.png    the lockup exported at 4x (9051:27145)

The badge is H2. That was not recorded anywhere and had to be established: `lightning.webp` is what
`wolfTile` points at, and `wolfTile` is H2 in game/utils.ts. The redesign keeps the same slot.

The parts do NOT carry their positions. `ball.png` is one ball drawn to fill its own 1254 frame, not
four balls at the corners, and the two bolt SVGs are 8-unit boxes. So every placement comes from the
reference, keyed by colour, exactly as the wild's does -- and the reference had to be re-exported at
4x, because the node's natural size is 64x64 and measuring four corner balls on a 64px render would
have put every placement inside a pixel of noise.

The bolt is TWO shapes: a white one over an orange one, offset down and right. They are baked into a
single layer here rather than kept apart, because nothing in the brief moves them independently --
"the lightning pops and blinks" moves the pair as one object.

Outputs onto the shared 328x264 symbol canvas:

    lightning.webp / lightning_mobile.webp   body + balls, the static base
    lightning_bolt.webp                      the bolt with its shadow already under it

Run:  python3 scripts/build-lightning-art.py
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art-src" / "lightning"
OUT = ROOT / "static" / "assets" / "components" / "symbols" / "magnetic" / "premium"
PREVIEW = SRC / "preview_lightning_layers.png"
VERIFY = SRC / "verify_lightning.png"

CANVAS_W, CANVAS_H = 328, 264
SUPERSAMPLE = 4


def die(msg: str) -> None:
    sys.exit(f"build-lightning-art: {msg}")


def keys(rgb: np.ndarray, alpha: np.ndarray | None = None) -> dict:
    r, g, b = rgb[:, :, 0].astype(int), rgb[:, :, 1].astype(int), rgb[:, :, 2].astype(int)
    op = np.ones(r.shape, bool) if alpha is None else alpha > 120
    return {
        # The frame's body blue, sampled at (40,128) of the 4x reference: 85,88,199.
        "frame": op & (r > 55) & (r < 130) & (g > 55) & (g < 130) & (b > 165) & (b < 235),
        "yellow": op & (r > 235) & (g > 180) & (g < 245) & (b < 90),
        "green": op & (g > 200) & (r > 120) & (r < 225) & (b < 110),
        "white": op & (r >= 250) & (g >= 250) & (b >= 250),
        "orange": op & (r > 235) & (g > 95) & (g < 165) & (b < 60),
    }


def blobs(mask: np.ndarray, minpx: int = 40):
    h, w = mask.shape
    seen = np.zeros_like(mask)
    out = []
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]:
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


def mbb(mask: np.ndarray):
    ys, xs = np.nonzero(mask)
    if len(xs) == 0:
        die("a colour key matched nothing")
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def biggest(mask: np.ndarray, minpx: int = 40):
    bs = blobs(mask, minpx)
    if not bs:
        die("a colour key matched no blob big enough to be a part")
    return bb(max(bs, key=len))


def union(*boxes):
    return (min(b[0] for b in boxes), min(b[1] for b in boxes),
            max(b[2] for b in boxes), max(b[3] for b in boxes))


def alpha_bbox(im: Image.Image, thresh: int = 8):
    b = im.getchannel("A").point(lambda v: 255 if v > thresh else 0).getbbox()
    if b is None:
        die("a source layer is fully transparent")
    return b


def svg(path: Path, w: int, h: int) -> Image.Image:
    try:
        import cairosvg
    except ImportError:
        die("cairosvg is needed to render the bolt")
    png = cairosvg.svg2png(url=str(path), output_width=w, output_height=h)
    return Image.open(io.BytesIO(png)).convert("RGBA")


def place(ref_key, src_key, src_alpha):
    """A part's FULL box in reference coordinates, scaled from WIDTH and anchored top-left.

    Every part of this badge is unoccluded -- it is a flat lockup with nothing overlapping anything
    -- so unlike the wild there is no axis to choose here. The key-to-alpha correction still matters:
    each key finds only a part's fill, never its dark outline.
    """
    scale = (ref_key[2] - ref_key[0]) / (src_key[2] - src_key[0])
    x0 = ref_key[0] + (src_alpha[0] - src_key[0]) * scale
    y0 = ref_key[1] + (src_alpha[1] - src_key[1]) * scale
    return (x0, y0,
            x0 + (src_alpha[2] - src_alpha[0]) * scale,
            y0 + (src_alpha[3] - src_alpha[1]) * scale)


def main() -> None:
    for n in ("body.png", "ball.png", "bolt.svg", "bolt_shadow.svg", "reference.png"):
        if not (SRC / n).exists():
            die(f"missing source art-src/lightning/{n}")
    OUT.mkdir(parents=True, exist_ok=True)

    ref = np.array(Image.open(SRC / "reference.png").convert("RGB"))
    rk = keys(ref)

    body_im = Image.open(SRC / "body.png").convert("RGBA")
    ba = np.array(body_im)
    bk = keys(ba[:, :, :3], ba[:, :, 3])
    ball_im = Image.open(SRC / "ball.png").convert("RGBA")
    la = np.array(ball_im)
    lk = keys(la[:, :, :3], la[:, :, 3])

    # --- the body ------------------------------------------------------------------------------
    # Keyed on the yellow FACE, not the blue frame: the four green balls sit on the frame's corner
    # lobes and their dark outlines cut the blue into pieces, so the frame's own key box in the
    # reference is a different shape from the one in body.png. The face is untouched in both.
    boxes = {"body": place(mbb(rk["yellow"]), mbb(bk["yellow"]), alpha_bbox(body_im))}

    # --- the four balls ------------------------------------------------------------------------
    ball_blobs = sorted((bb(p) for p in blobs(rk["green"], 60)), key=lambda b: (b[1], b[0]))
    if len(ball_blobs) != 4:
        die(f"expected four corner balls in the reference, found {len(ball_blobs)}")
    ball_key = mbb(lk["green"])
    ball_alpha = alpha_bbox(ball_im)
    for i, rb in enumerate(ball_blobs):
        boxes[f"ball{i}"] = place(rb, ball_key, ball_alpha)

    # --- the bolt ------------------------------------------------------------------------------
    # White over orange. Both are the same outline, so the OFFSET between their reference boxes is
    # the whole relationship, and baking it in here means the component moves one sprite.
    white = biggest(rk["white"], 200)
    orange = biggest(rk["orange"], 200)
    boxes["bolt"] = union(white, orange)

    # --- fit the assembly ------------------------------------------------------------------------
    content = union(*boxes.values())
    cw, ch = content[2] - content[0], content[3] - content[1]
    fit = min(CANVAS_W / cw, CANVAS_H / ch)
    ox = (CANVAS_W - cw * fit) / 2 - content[0] * fit
    oy = (CANVAS_H - ch * fit) / 2 - content[1] * fit

    def to_canvas(b):
        return (ox + b[0] * fit, oy + b[1] * fit, ox + b[2] * fit, oy + b[3] * fit)

    def size_of(b):
        c = to_canvas(b)
        return max(1, round(c[2] - c[0])), max(1, round(c[3] - c[1]))

    # --- the static base: body with its four balls -----------------------------------------------
    plate = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    bc = to_canvas(boxes["body"])
    plate.alpha_composite(
        body_im.crop(alpha_bbox(body_im)).resize(size_of(boxes["body"]), Image.LANCZOS),
        (round(bc[0]), round(bc[1])),
    )
    for i in range(4):
        c = to_canvas(boxes[f"ball{i}"])
        plate.alpha_composite(
            ball_im.crop(ball_alpha).resize(size_of(boxes[f"ball{i}"]), Image.LANCZOS),
            (round(c[0]), round(c[1])),
        )
    plate.save(OUT / "lightning.webp", lossless=True, method=6)
    plate.resize((CANVAS_W // 2, CANVAS_H // 2), Image.LANCZOS).save(
        OUT / "lightning_mobile.webp", lossless=True, method=6
    )

    # --- the bolt layer ---------------------------------------------------------------------------
    bw, bh = size_of(boxes["bolt"])
    # Each SVG is rendered at the size ITS OWN reference box asks for, then dropped at that box's
    # offset inside the union. Rendering both at the union's size would stretch each by the shadow's
    # offset and the two outlines would stop lining up.
    layer = Image.new("RGBA", (bw * SUPERSAMPLE, bh * SUPERSAMPLE), (0, 0, 0, 0))
    for name, box in (("bolt_shadow.svg", orange), ("bolt.svg", white)):
        w = max(1, round((box[2] - box[0]) * fit * SUPERSAMPLE))
        h = max(1, round((box[3] - box[1]) * fit * SUPERSAMPLE))
        dx = round((box[0] - boxes["bolt"][0]) * fit * SUPERSAMPLE)
        dy = round((box[1] - boxes["bolt"][1]) * fit * SUPERSAMPLE)
        layer.alpha_composite(svg(SRC / name, w, h), (dx, dy))
    layer.resize((bw, bh), Image.LANCZOS).save(OUT / "lightning_bolt.webp", lossless=True, method=6)

    def frac(b):
        x0, y0, x1, y1 = to_canvas(b)
        return {
            "dx": round((x0 + x1) / 2 / CANVAS_W - 0.5, 4),
            "dy": round((y0 + y1) / 2 / CANVAS_H - 0.5, 4),
            "w": round((x1 - x0) / CANVAS_W, 4),
            "h": round((y1 - y0) / CANVAS_H, 4),
        }

    f = frac(boxes["bolt"])
    print(f"fit {fit:.4f}  content {content}")
    print(f"const BOLT = {{ dx: {f['dx']}, dy: {f['dy']}, w: {f['w']}, h: {f['h']} }};")
    print("const BALLS = [")
    for i in range(4):
        g = frac(boxes[f"ball{i}"])
        print(f"\t{{ dx: {g['dx']}, dy: {g['dy']}, r: {round(g['w'] / 2, 4)} }},")
    print("];")

    # --- proof -------------------------------------------------------------------------------------
    check = Image.new("RGBA", (CANVAS_W, CANVAS_H), (18, 12, 40, 255))
    check.alpha_composite(Image.open(OUT / "lightning.webp").convert("RGBA"))
    boltc = to_canvas(boxes["bolt"])
    check.alpha_composite(
        Image.open(OUT / "lightning_bolt.webp").convert("RGBA"),
        (round(boltc[0]), round(boltc[1])),
    )
    check.resize((CANVAS_W * 3, CANVAS_H * 3), Image.NEAREST).save(VERIFY)

    strip = Image.new("RGBA", (CANVAS_W * 2, CANVAS_H), (18, 12, 40, 255))
    strip.alpha_composite(Image.open(OUT / "lightning.webp").convert("RGBA"), (0, 0))
    strip.alpha_composite(
        Image.open(OUT / "lightning_bolt.webp").convert("RGBA"),
        (CANVAS_W + round(boltc[0]), round(boltc[1])),
    )
    strip.resize((CANVAS_W * 4, CANVAS_H * 2), Image.NEAREST).save(PREVIEW)
    print(f"wrote {VERIFY.name} and {PREVIEW.name}")


if __name__ == "__main__":
    main()
