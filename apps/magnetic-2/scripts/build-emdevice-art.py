#!/usr/bin/env python3
"""Cut the MOTHERSHIP ELECTROMAGNETIC DEVICE (H4) into its animatable layers.

    art-src/emdevice/body.png        the drum: shells, orange barrel, cyan and pink bars, feet
    art-src/emdevice/arm.png         the big green hook on the rear shell -- static
    art-src/emdevice/antennae.png    BOTH antennae in one raster, side by side
    art-src/emdevice/lens.png        the cyan/magenta lens on the front face
    art-src/emdevice/design_ref.png  the ASSEMBLED lockup

Outputs onto the shared 328x264 symbol canvas:

    electromagnetic_device.webp / _mobile.webp   drum + arm, the static base
    em_antenna_l.webp / em_antenna_r.webp        one antenna each, split out of the sheet
    em_lens.webp                                 the lens, loose so a win can flash it

THE MISTAKE THIS SCRIPT EXISTS TO UNDO
--------------------------------------
The first version of this script asserted that the four parts "share a frame AND are already
positioned, so alpha_composite in layer order reproduces the lockup". That was WRONG, and it is
worth being precise about why, because the check that would have caught it takes one minute.

The parts do share a 1254x1254 frame. They are NOT positioned in it: each part is drawn LARGE,
filling most of its own frame, because that is how the artist exported them. Compositing them at
frame coordinates therefore drew a lens the width of the whole symbol, antennae the size of the
drum, and a green arm across the middle. It shipped, and it was obvious on the board immediately.

"Same frame" tells you nothing about placement. The only way to know is to composite the parts and
LOOK at the result next to the design -- which is now the last thing this script does, every run.

HOW PLACEMENT IS ACTUALLY DERIVED
---------------------------------
Everything is measured in the DESIGN REFERENCE, in three steps:

  1. The BODY is anchored on the ORANGE BARREL. Orange appears nowhere else in the symbol, in any
     layer, so its bounding box is an unambiguous landmark in both the reference and body.png. Two
     independent scale estimates (from its width and from its height) agree to 0.6%.

  2. With the body placed, the RESIDUAL -- reference pixels the body does not explain -- is exactly
     the four parts that are left. This is what makes the rest easy: no part has to be found in a
     busy image, only in what is provably not the drum.

  3. Each part is fitted on its own COLOUR CORE, never on its silhouette: the antennae and the arm
     on their green, the lens on its cyan. A silhouette includes the dark outline, and the outline
     is a constant width in the SOURCE while the part is being scaled down ~6x, so matching
     silhouettes systematically undersizes every part. Colour cores have no outline on either side.

Run:  python3 scripts/build-emdevice-art.py
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art-src" / "emdevice"
OUT = ROOT / "static" / "assets" / "components" / "symbols" / "magnetic" / "premium"
VERIFY = SRC / "verify_emdevice.png"
PREVIEW = SRC / "preview_emdevice_layers.png"

CANVAS_W, CANVAS_H = 328, 264

# The reference is a capture of the design's own cell: a saturated purple stroke around a flat
# lavender panel. Both are keyed rather than cropped by hand so a re-capture at another zoom still
# lands.
STROKE = np.array([127, 60, 238])
PANEL = np.array([175, 177, 247])
FRAME_INSET = 6


def die(msg: str):
    sys.exit(f"build-emdevice-art: {msg}")


def keys(rgb):
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    return {
        "green": (g > 195) & (r > 100) & (r < 225) & (b < 150),
        "pink": (r > 210) & (b > 210) & (g > 70) & (g < 190),
        "cyan": (b > 195) & (g > 175) & (r < 175),
        "orange": (r > 200) & (g > 110) & (g < 200) & (b < 110),
    }


def box(mask, what="mask"):
    ys, xs = np.where(mask)
    if not len(xs):
        die(f"{what} is empty")
    return (int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1))


def region(mask, x0, y0, x1, y1):
    out = np.zeros_like(mask)
    out[y0:y1, x0:x1] = mask[y0:y1, x0:x1]
    return out


def largest_blob(mask, what="mask"):
    """The biggest 8-connected component of a colour key.

    A window's bounding box is NOT good enough here. The drum's own cyan bar and the reference's
    resample fringe both leave stray pixels of the right colour inside any window loose enough to
    contain the part, and a bbox silently grows to include them -- which is what made the lens's two
    scale estimates disagree by 34% while each looked individually plausible.
    """
    h, w = mask.shape
    seen = np.zeros_like(mask, bool)
    best = None
    ys, xs = np.where(mask)
    if not len(xs):
        die(f"{what} is empty")
    for sy, sx in zip(ys, xs):
        if seen[sy, sx]:
            continue
        stack = [(sy, sx)]
        seen[sy, sx] = True
        pts = []
        while stack:
            y, x = stack.pop()
            pts.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
        if best is None or len(pts) > len(best):
            best = pts
    p = np.array(best)
    return (int(p[:, 1].min()), int(p[:, 0].min()), int(p[:, 1].max() + 1), int(p[:, 0].max() + 1))


def load(name):
    im = Image.open(SRC / name).convert("RGBA")
    a = np.asarray(im).astype(int)
    return im, a[:, :, :3], a[:, :, 3] > 128


def fit_scale(ref_box, part_box, tag, tol=0.10):
    """Scale from a colour core measured on both sides, with the two axes cross-checking."""
    sx = (ref_box[2] - ref_box[0]) / (part_box[2] - part_box[0])
    sy = (ref_box[3] - ref_box[1]) / (part_box[3] - part_box[1])
    if abs(sx - sy) / sx > tol:
        die(f"{tag}: width says scale {sx:.4f} but height says {sy:.4f} -- the colour key is "
            f"catching something that is not the part")
    return (sx + sy) / 2


def main():
    # --- the reference, cropped to the design's own cell -----------------------------------------
    ref_full = Image.open(SRC / "design_ref.png").convert("RGB")
    rf = np.asarray(ref_full).astype(int)
    st = np.abs(rf - STROKE).sum(2) < 60
    sb = box(st, "the reference's frame stroke")
    ref_im = ref_full.crop((sb[0] + FRAME_INSET, sb[1] + FRAME_INSET,
                            sb[2] - FRAME_INSET, sb[3] - FRAME_INSET))
    ref = np.asarray(ref_im).astype(int)
    RK = keys(ref)

    # --- 1. the body, anchored on the orange barrel -----------------------------------------------
    body_im, body_rgb, body_a = load("body.png")
    BK = {k: v & body_a for k, v in keys(body_rgb).items()}
    r_orange = box(RK["orange"], "orange in the reference")
    b_orange = box(BK["orange"], "orange in body.png")
    scale = fit_scale(r_orange, b_orange, "body", tol=0.03)
    body_x = r_orange[0] - b_orange[0] * scale
    body_y = r_orange[1] - b_orange[1] * scale
    body_scaled = body_im.resize(
        (round(body_im.width * scale), round(body_im.height * scale)), Image.LANCZOS
    )

    # --- 2. the residual: what the drum does not explain -------------------------------------------
    plate = Image.new("RGB", ref_im.size, tuple(PANEL))
    plate.paste(body_scaled, (round(body_x), round(body_y)), body_scaled)
    residual = np.abs(ref - np.asarray(plate).astype(int)).sum(2) > 70

    # --- 3. each part, fitted on its colour core ---------------------------------------------------
    # Search windows come from the residual's own solid blobs; they only have to separate the four
    # parts from each other, which they do with room to spare.
    REF_BOX = {
        "antL": largest_blob(region(RK["green"] & residual, 40, 55, 105, 115), "the left ball"),
        "antR": largest_blob(region(RK["green"] & residual, 270, 15, 340, 72), "the right ball"),
        "arm": largest_blob(region(RK["green"] & residual, 292, 92, 358, 180), "the arm"),
        "lens": largest_blob(region(RK["cyan"] & residual, 35, 185, 100, 265), "the lens"),
    }

    # The two antennae arrive in ONE raster. They are cleanly separated in x, so a column-run split
    # is exact; the script CHECKS that rather than assuming it.
    ant_im, ant_rgb, ant_a = load("antennae.png")
    AK = {k: v & ant_a for k, v in keys(ant_rgb).items()}
    cols = np.where((AK["green"] | AK["pink"]).any(0))[0]
    runs, start, prev = [], cols[0], cols[0]
    for c in cols[1:]:
        if c > prev + 1:
            runs.append((start, prev))
            start = c
        prev = c
    runs.append((start, prev))
    if len(runs) != 2:
        die(f"expected the antennae to be two separated column runs, found {len(runs)}: {runs}")
    split = (runs[0][1] + runs[1][0]) // 2

    halves = {}
    for tag, sl in (("a", slice(0, split)), ("b", slice(split, ant_im.width))):
        ball = region(AK["green"], sl.start or 0, 0, sl.stop, ant_im.height)
        base = region(AK["pink"], sl.start or 0, 0, sl.stop, ant_im.height)
        full = region(ant_a, sl.start or 0, 0, sl.stop, ant_im.height)
        bb, pb, fb = largest_blob(ball), largest_blob(base), box(full)
        halves[tag] = {
            "ball": bb,
            "crop": fb,
            # Which way the antenna leans: its ball sits to one side of its base. That, not the
            # order they happen to sit in the sheet, decides which one is the left antenna.
            "lean": (bb[0] + bb[2]) / 2 - (pb[0] + pb[2]) / 2,
            # The PIVOT is the bottom centre of the flared base -- the point the stalk turns about.
            # Anchored at the box centre instead, the antenna slides sideways rather than leaning.
            "pivot": ((pb[0] + pb[2]) / 2, pb[3]),
        }
    if halves["a"]["lean"] * halves["b"]["lean"] >= 0:
        die("both antennae lean the same way; cannot tell left from right")
    left = min(halves, key=lambda t: halves[t]["lean"])
    right = max(halves, key=lambda t: halves[t]["lean"])

    arm_im, arm_rgb, arm_a = load("arm.png")
    lens_im, lens_rgb, lens_a = load("lens.png")

    PARTS = {
        "antL": (ant_im, halves[left]["crop"], halves[left]["ball"], halves[left]["pivot"]),
        "antR": (ant_im, halves[right]["crop"], halves[right]["ball"], halves[right]["pivot"]),
        "arm": (arm_im, box(arm_a), largest_blob(keys(arm_rgb)["green"] & arm_a, "arm green"), None),
        "lens": (lens_im, box(lens_a), largest_blob(keys(lens_rgb)["cyan"] & lens_a, "lens cyan"), None),
    }

    placed = {}
    for name, (im, crop, core, pivot) in PARTS.items():
        rb = REF_BOX[name]
        s = fit_scale(rb, core, name)
        px = rb[0] - (core[0] - crop[0]) * s
        py = rb[1] - (core[1] - crop[1]) * s
        w = max(1, round((crop[2] - crop[0]) * s))
        h = max(1, round((crop[3] - crop[1]) * s))
        piv = None
        if pivot is not None:
            piv = ((pivot[0] - crop[0]) / (crop[2] - crop[0]),
                   (pivot[1] - crop[1]) / (crop[3] - crop[1]))
        placed[name] = {"box": (px, py, px + w, py + h), "img": im.crop(crop), "pivot": piv}

    # --- assemble, in the component's own layer order ---------------------------------------------
    # body < arm < antennae < lens. The arm merges into the base (nothing moves it); the antenna
    # stalks run behind the lens, which is what hides each joint while the antenna leans.
    body_box = (body_x, body_y,
                body_x + body_im.width * scale, body_y + body_im.height * scale)
    # The body raster's own alpha box, not its frame -- the frame is mostly empty.
    ba = box(body_a, "body.png alpha")
    body_ink = (body_x + ba[0] * scale, body_y + ba[1] * scale,
                body_x + ba[2] * scale, body_y + ba[3] * scale)

    boxes = {"body": body_ink, **{k: v["box"] for k, v in placed.items()}}
    content = (min(b[0] for b in boxes.values()), min(b[1] for b in boxes.values()),
               max(b[2] for b in boxes.values()), max(b[3] for b in boxes.values()))
    cw, ch = content[2] - content[0], content[3] - content[1]
    fit = min(CANVAS_W / cw, CANVAS_H / ch)
    ox = (CANVAS_W - cw * fit) / 2 - content[0] * fit
    oy = (CANVAS_H - ch * fit) / 2 - content[1] * fit

    def to_canvas(b):
        return (ox + b[0] * fit, oy + b[1] * fit, ox + b[2] * fit, oy + b[3] * fit)

    def size_of(b):
        return (max(1, round(b[2] - b[0])), max(1, round(b[3] - b[1])))

    C = {k: to_canvas(v) for k, v in boxes.items()}

    # --- write the layers --------------------------------------------------------------------------
    base = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    bimg = body_im.crop(ba).resize(size_of(C["body"]), Image.LANCZOS)
    base.alpha_composite(bimg, (round(C["body"][0]), round(C["body"][1])))
    aimg = placed["arm"]["img"].resize(size_of(C["arm"]), Image.LANCZOS)
    base.alpha_composite(aimg, (round(C["arm"][0]), round(C["arm"][1])))
    base.save(OUT / "electromagnetic_device.webp", lossless=True, method=6)
    base.resize((CANVAS_W // 2, CANVAS_H // 2), Image.LANCZOS).save(
        OUT / "electromagnetic_device_mobile.webp", lossless=True, method=6
    )
    for name, out_name in (("antL", "em_antenna_l"), ("antR", "em_antenna_r"), ("lens", "em_lens")):
        placed[name]["img"].resize(size_of(C[name]), Image.LANCZOS).save(
            OUT / f"{out_name}.webp", lossless=True, method=6
        )

    # --- the placements the component needs --------------------------------------------------------
    def frac(b):
        cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        return dict(dx=(cx - CANVAS_W / 2) / CANVAS_W, dy=(cy - CANVAS_H / 2) / CANVAS_H,
                    w=(b[2] - b[0]) / CANVAS_W, h=(b[3] - b[1]) / CANVAS_H)

    print(f"fit {fit:.4f}  body scale {scale:.4f}  content {tuple(round(v,2) for v in content)}\n")
    for name, const in (("antL", "ANTENNA_L"), ("antR", "ANTENNA_R"), ("lens", "LENS")):
        f = frac(C[name])
        print(f"const {const} = {{ dx: {f['dx']:.4f}, dy: {f['dy']:.4f}, "
              f"w: {f['w']:.4f}, h: {f['h']:.4f} }};")
    for name, const in (("antL", "PIVOT_L"), ("antR", "PIVOT_R")):
        p = placed[name]["pivot"]
        print(f"const {const} = {{ x: {p[0]:.4f}, y: {p[1]:.4f} }};")
    # The arc's endpoints are the two balls' centres, in the same fractions.
    for name, const in (("antL", "TERM_L"), ("antR", "TERM_R")):
        rb = REF_BOX[name]
        b = to_canvas((rb[0], rb[1], rb[2], rb[3]))
        cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        print(f"const {const} = {{ dx: {(cx-CANVAS_W/2)/CANVAS_W:.4f}, "
              f"dy: {(cy-CANVAS_H/2)/CANVAS_H:.4f} }};")

    # --- verify: the assembly next to the design, every run ----------------------------------------
    full = base.copy()
    for name in ("antL", "antR", "lens"):
        full.alpha_composite(
            placed[name]["img"].resize(size_of(C[name]), Image.LANCZOS),
            (round(C[name][0]), round(C[name][1])),
        )
    ref_fit = ref_im.copy()
    ref_fit.thumbnail((CANVAS_W, CANVAS_H), Image.LANCZOS)
    sheet = Image.new("RGBA", (CANVAS_W * 2, CANVAS_H), (175, 177, 247, 255))
    sheet.paste(ref_fit, ((CANVAS_W - ref_fit.width) // 2, (CANVAS_H - ref_fit.height) // 2))
    sheet.alpha_composite(full, (CANVAS_W, 0))
    sheet.resize((CANVAS_W * 4, CANVAS_H * 2), Image.NEAREST).convert("RGB").save(VERIFY)

    strip = Image.new("RGBA", (CANVAS_W * 4, CANVAS_H), (40, 40, 55, 255))
    strip.alpha_composite(base, (0, 0))
    for i, name in enumerate(("antL", "antR", "lens")):
        layer = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
        layer.alpha_composite(
            placed[name]["img"].resize(size_of(C[name]), Image.LANCZOS),
            (round(C[name][0]), round(C[name][1])),
        )
        strip.alpha_composite(layer, (CANVAS_W * (i + 1), 0))
    strip.convert("RGB").save(PREVIEW)
    print(f"\nverify -> {VERIFY.relative_to(ROOT)}   layers -> {PREVIEW.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
