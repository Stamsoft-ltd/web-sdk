#!/usr/bin/env python3
"""Cut the MOTHERSHIP COMPASS (H1) into its animatable layers.

    art-src/compass/bezel.png       the ring: plate, green arcs, cyan dashes, two pink dots
    art-src/compass/lamp.png        ONE green glossy lamp -- there are two, left and right
    art-src/compass/alien.png       the head WITH both antennae and its mouth, outline included
    art-src/compass/eye.svg         the eye
    art-src/compass/badge_n.png     the N hexagon
    art-src/compass/badge_s.png     the S hexagon
    art-src/compass/design_ref.png  the ASSEMBLED lockup

Outputs onto the shared 328x264 symbol canvas:

    compass.webp / _mobile.webp                     lamps + bezel, the static base
    compass_face.webp                               the head, no antennae
    compass_antenna_l.webp / compass_antenna_r.webp one antenna each
    compass_eye.webp, compass_n.webp, compass_s.webp

WHAT THE FIRST VERSION GOT WRONG
--------------------------------
Three separate things, all of which showed up on the board at once:

  * Every placement was a HAND-PICKED RATIO of the bezel's well -- FACE_OF_WELL = 0.52,
    BADGE_OF_WELL = 0.26, EYE_OF_FACE = 0.30 -- rather than a measurement of the design. The face
    came out roughly half again too big, which in turn made the badges look small and left the
    antennae reading as two extra heads.

  * The face and the antennae were cut from alien.svg by splitting it on its FILLS, so they came out
    with no dark outline while every other symbol on the board has one.

  * The two green LAMPS were never placed at all. The queue recorded lamp.png as "a green glossy
    ball with no obvious home", which was the wrong conclusion: it has two homes, left and right,
    and it is mostly hidden behind the bezel, which is exactly why it did not look like anything on
    its own.

Everything here is now measured in the design reference. Three measurements are worth explaining:

  1. THE BEZEL IS ANCHORED ON ITS TWO PINK DOTS, by the distance between their centres. Not by their
     size: at this scale a dot is ten pixels across and antialiasing eats a pixel off each edge, so
     its width is ~8% short while the distance between two of them is exact.

  2. THE HEAD'S DIAMETER IS ITS WIDEST ROW, not a circle fitted to its lower arc. Over the central
     70% of a 49px circle that arc is nearly flat, and a least-squares circle through it is wildly
     ill-conditioned -- it returned R = 29.2 where the true radius is 24.5, a 19% error that looks
     entirely plausible until you draw it.

  3. THE LAMPS' DIAMETER COMES FROM A CIRCLE FIT, because a lamp is mostly BEHIND the bezel and its
     visible bounding box is a chord, not a diameter. Here the fit IS well-conditioned: the visible
     sliver is the part of the circle furthest from the centre, so it is the most curved. The two
     lamps are fitted independently and must agree, and must be symmetric about the bezel.

Run:  python3 scripts/build-compass-art.py
"""

import io
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art-src" / "compass"
OUT = ROOT / "static" / "assets" / "components" / "symbols" / "magnetic" / "premium"
VERIFY = SRC / "verify_compass.png"
PREVIEW = SRC / "preview_compass_layers.png"

CANVAS_W, CANVAS_H = 328, 264
SUPERSAMPLE = 3

STROKE = np.array([127, 60, 238])
PANEL = np.array([175, 177, 247])
FRAME_INSET = 6

# How far past the head's fitted circle to cut, so the head keeps its own dark outline.
HEAD_CUT = 1.03


def die(msg: str):
    sys.exit(f"build-compass-art: {msg}")


def keys(rgb):
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    return {
        "green": (g > 170) & (r > 90) & (r < 215) & (b < 160),
        "pink": (r > 200) & (b > 170) & (g > 90) & (g < 190),
        "cyan": (b > 200) & (g > 190) & (r < 180),
        "white": (r > 215) & (g > 215) & (b > 215),
    }


def load(name):
    im = Image.open(SRC / name).convert("RGBA")
    a = np.asarray(im).astype(int)
    return im, a[:, :, :3], a[:, :, 3] > 128


def region(mask, x0, y0, x1, y1):
    out = np.zeros_like(mask)
    out[y0:y1, x0:x1] = mask[y0:y1, x0:x1]
    return out


def components(mask, min_area=1):
    h, w = mask.shape
    seen = np.zeros_like(mask, bool)
    out = []
    ys, xs = np.where(mask)
    for sy, sx in zip(ys, xs):
        if seen[sy, sx]:
            continue
        stack, pts = [(sy, sx)], []
        seen[sy, sx] = True
        while stack:
            y, x = stack.pop()
            pts.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
        if len(pts) >= min_area:
            out.append(np.array(pts))
    return sorted(out, key=len, reverse=True)


def bbox_of(pts):
    return (int(pts[:, 1].min()), int(pts[:, 0].min()),
            int(pts[:, 1].max() + 1), int(pts[:, 0].max() + 1))


def largest_box(mask, what):
    c = components(mask)
    if not c:
        die(f"{what} is empty")
    return bbox_of(c[0])


def grow(mask, n):
    out = mask.copy()
    for _ in range(n):
        p = np.pad(out, 1, constant_values=False)
        out = out | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
    return out


def shrink(mask, n):
    out = mask.copy()
    for _ in range(n):
        p = np.pad(out, 1, constant_values=True)
        out = out & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
    return out


def widest_disc(mask, what):
    """Centre and radius of a disc, from its WIDEST ROW.

    See the header: a circle fitted to a disc's lower arc is ill-conditioned at these sizes. The
    widest row is exact and needs no fitting -- for a circle it IS the diameter, through the centre.
    """
    rows = [(np.where(mask[y])[0], y) for y in range(mask.shape[0]) if mask[y].any()]
    if not rows:
        die(f"{what} is empty")
    xs, y = max(rows, key=lambda t: t[0].max() - t[0].min())
    return ((xs.min() + xs.max() + 1) / 2, y + 0.5, (xs.max() + 1 - xs.min()) / 2)


def fit_circle(pts):
    x = pts[:, 0].astype(float)
    y = pts[:, 1].astype(float)
    sol, *_ = np.linalg.lstsq(np.c_[2 * x, 2 * y, np.ones(len(x))], x**2 + y**2, rcond=None)
    cx, cy, c = sol
    return cx, cy, float(np.sqrt(c + cx * cx + cy * cy))


def render_svg(path, width):
    import cairosvg

    png = cairosvg.svg2png(url=str(path), output_width=width)
    return Image.open(io.BytesIO(png)).convert("RGBA")


def main():
    # --- the reference, cropped to the design's own cell -----------------------------------------
    ref_full = Image.open(SRC / "design_ref.png").convert("RGB")
    st = np.abs(np.asarray(ref_full).astype(int) - STROKE).sum(2) < 60
    sb = largest_box(st, "the reference's frame stroke")
    ref_im = ref_full.crop((sb[0] + FRAME_INSET, sb[1] + FRAME_INSET,
                            sb[2] - FRAME_INSET, sb[3] - FRAME_INSET))
    ref = np.asarray(ref_im).astype(int)
    RW, RH = ref_im.size
    RK = keys(ref)

    # --- 1. the bezel, anchored on its two pink dots ----------------------------------------------
    bez_im, bez_rgb, bez_a = load("bezel.png")
    BK = {k: v & bez_a for k, v in keys(bez_rgb).items()}

    def dot_pair(mask, what):
        # The two dots are the two pink blobs that sit at the SAME height -- the N letter is pink
        # too, and it is the odd one out.
        cs = [(bbox_of(p), len(p)) for p in components(mask, 20)]
        if len(cs) < 2:
            die(f"{what}: found {len(cs)} pink blobs, need at least 2")
        mid = [(b, (b[1] + b[3]) / 2, (b[0] + b[2]) / 2) for b, _ in cs]
        best = None
        for i in range(len(mid)):
            for j in range(i + 1, len(mid)):
                dy = abs(mid[i][1] - mid[j][1])
                dx = abs(mid[i][2] - mid[j][2])
                if best is None or (dy, -dx) < best[0]:
                    best = ((dy, -dx), mid[i], mid[j])
        a, b = sorted((best[1], best[2]), key=lambda m: m[2])
        return (a[2], a[1]), (b[2], b[1])

    r_dots = dot_pair(RK["pink"], "reference")
    b_dots = dot_pair(BK["pink"], "bezel.png")
    scale = (r_dots[1][0] - r_dots[0][0]) / (b_dots[1][0] - b_dots[0][0])
    rm = ((r_dots[0][0] + r_dots[1][0]) / 2, (r_dots[0][1] + r_dots[1][1]) / 2)
    bm = ((b_dots[0][0] + b_dots[1][0]) / 2, (b_dots[0][1] + b_dots[1][1]) / 2)
    bez_x, bez_y = rm[0] - bm[0] * scale, rm[1] - bm[1] * scale
    print(f"bezel scale {scale:.5f}  at ({bez_x:.1f}, {bez_y:.1f})  centre x {rm[0]:.1f}")

    bez_sc = bez_im.resize((round(bez_im.width * scale), round(bez_im.height * scale)), Image.LANCZOS)
    plate = Image.new("RGB", ref_im.size, tuple(PANEL))
    plate.paste(bez_sc, (round(bez_x), round(bez_y)), bez_sc)
    residual = np.abs(ref - np.asarray(plate).astype(int)).sum(2) > 70

    # --- 2. the two lamps, from the curvature of what shows -------------------------------------
    # A window is not enough to isolate them: the bezel's own green ARCS sit at the same heights and
    # a window loose enough to hold a lamp holds arc pixels too, which drags the circle fit (26.3 and
    # 23.2 for two lamps that are the same size). The lamps are the only green OUTSIDE the bezel's
    # circle, so that is the cut -- and it needs no hand-tuned numbers.
    bez_crop0 = largest_box(bez_a, "bezel alpha")
    bez_radius = (bez_crop0[2] - bez_crop0[0]) * scale / 2
    yy, xx = np.mgrid[0:RH, 0:RW]
    outside = ((xx - rm[0]) ** 2 + (yy - rm[1]) ** 2) > (bez_radius * 0.97) ** 2

    lamps = {}
    for tag, win, side in (("L", (0, 70, 55, 140), "min"), ("R", (RW - 55, 70, RW, 140), "max")):
        m = region(RK["green"] & residual & outside, *win)
        pts = []
        for y in range(m.shape[0]):
            xs = np.where(m[y])[0]
            if len(xs):
                pts.append([xs.min() if side == "min" else xs.max(), y])
        if len(pts) < 8:
            die(f"lamp {tag}: only {len(pts)} arc points")
        cx, cy, r = fit_circle(np.array(pts))
        lamps[tag] = (cx, cy, r)
        print(f"lamp {tag}: centre ({cx:.2f}, {cy:.2f}) radius {r:.2f}")
    if abs(lamps["L"][2] - lamps["R"][2]) / lamps["L"][2] > 0.10:
        die(f"the two lamps fit different radii: {lamps['L'][2]:.2f} vs {lamps['R'][2]:.2f}")
    mirror = abs((lamps["L"][0] + lamps["R"][0]) / 2 - rm[0])
    if mirror > 4:
        die(f"the lamps are not symmetric about the bezel: midpoint off by {mirror:.1f}px")
    lamp_r = (lamps["L"][2] + lamps["R"][2]) / 2

    lamp_im, lamp_rgb, lamp_a = load("lamp.png")
    lcx, lcy, lr = widest_disc(keys(lamp_rgb)["green"] & lamp_a, "lamp.png's green")
    lamp_scale = lamp_r / lr
    lamp_crop = largest_box(lamp_a, "lamp.png alpha")

    # --- 3. the alien, anchored on the head's widest row ------------------------------------------
    # Largest CONNECTED green blob in the middle, not just a window: two stray arc pixels at
    # opposite ends of one row make widest_disc report a disc four times the real size.
    head_mask = np.zeros_like(residual)
    head_pts = components(region(RK["green"] & residual, 60, 85, 140, 140), 200)
    if not head_pts:
        die("no head found in the reference")
    head_mask[head_pts[0][:, 0], head_pts[0][:, 1]] = True
    hcx, hcy, hr = widest_disc(head_mask, "the head in the reference")
    print(f"head: centre ({hcx:.2f}, {hcy:.2f}) radius {hr:.2f}")

    alien_im, alien_rgb, alien_a = load("alien.png")
    # Split the head off by CUTTING ITS CIRCLE, not by a morphological opening.
    #
    # Opening does not work here and the failure is quiet: erode(70) does separate the head from the
    # two knobs, but dilating back by 70 reaches 70px out in every direction and swallows the stalks
    # again, so the "head" comes back as the whole alien and the antennae come back as nothing. The
    # head is a disc, so cut a disc: fitted on rows well below the stalks, where the contour is a
    # 180-degree arc and the fit is well-conditioned (unlike the shallow arc in the reference).
    hpts = []
    for y in range(alien_a.shape[0] // 2, alien_a.shape[0]):
        xs = np.where(alien_a[y])[0]
        if len(xs):
            hpts += [[xs.min(), y], [xs.max(), y]]
    ahcx, ahcy, ahr = fit_circle(np.array(hpts, float))
    yy, xx = np.mgrid[0:alien_a.shape[0], 0:alien_a.shape[1]]
    disc = ((xx - ahcx) ** 2 + (yy - ahcy) ** 2) <= (ahr * HEAD_CUT) ** 2
    head_core = alien_a & disc
    ants = components(alien_a & ~disc, 400)
    if len(ants) != 2:
        die(f"expected 2 antennae outside the head's circle, found {len(ants)}")
    if abs(len(ants[0]) - len(ants[1])) / len(ants[0]) > 0.2:
        die(f"the two antennae came out very different sizes: {len(ants[0])} vs {len(ants[1])}")
    alien_scale = hr / ahr
    print(f"alien scale {alien_scale:.5f}")

    def alien_place(box):
        """A box inside alien.png -> the same box in reference coordinates."""
        return (hcx + (box[0] - ahcx) * alien_scale, hcy + (box[1] - ahcy) * alien_scale,
                hcx + (box[2] - ahcx) * alien_scale, hcy + (box[3] - ahcy) * alien_scale)

    head_box = bbox_of(np.argwhere(head_core))
    ants.sort(key=lambda p: p[:, 1].min())
    ant_boxes = [bbox_of(p) for p in ants]

    # --- 4. eye and badges -------------------------------------------------------------------------
    eye_box = largest_box(region(RK["white"] & residual, 70, 80, 130, 132), "the eye")
    badges = {}
    for tag, part, key, win in (
        ("n", "badge_n.png", "pink", (75, 5, 125, 60)),
        ("s", "badge_s.png", "cyan", (75, 145, 125, RH)),
    ):
        r_letter = largest_box(region(RK[key] & residual, *win), f"the {tag.upper()} letter")
        im, rgb, a = load(part)
        p_letter = largest_box(keys(rgb)[key] & a, f"{part}'s letter")
        crop = largest_box(a, f"{part} alpha")
        sx = (r_letter[2] - r_letter[0]) / (p_letter[2] - p_letter[0])
        sy = (r_letter[3] - r_letter[1]) / (p_letter[3] - p_letter[1])
        if abs(sx - sy) / sx > 0.12:
            die(f"badge {tag}: letter width says {sx:.4f} but height says {sy:.4f}")
        s = (sx + sy) / 2
        badges[tag] = {
            "img": im.crop(crop),
            "box": (r_letter[0] - (p_letter[0] - crop[0]) * s,
                    r_letter[1] - (p_letter[1] - crop[1]) * s,
                    r_letter[0] + (crop[2] - p_letter[0]) * s,
                    r_letter[1] + (crop[3] - p_letter[1]) * s),
        }
        print(f"badge {tag.upper()} scale {s:.4f}")

    # --- 5. everything is in reference coordinates now; fit it to the canvas -----------------------
    bez_crop = largest_box(bez_a, "bezel alpha")
    bezel_box = (bez_x + bez_crop[0] * scale, bez_y + bez_crop[1] * scale,
                 bez_x + bez_crop[2] * scale, bez_y + bez_crop[3] * scale)

    def lamp_box(tag):
        cx, cy, _ = lamps[tag]
        w = (lamp_crop[2] - lamp_crop[0]) * lamp_scale
        h = (lamp_crop[3] - lamp_crop[1]) * lamp_scale
        x0 = cx - (lcx - lamp_crop[0]) * lamp_scale
        y0 = cy - (lcy - lamp_crop[1]) * lamp_scale
        return (x0, y0, x0 + w, y0 + h)

    boxes = {
        "bezel": bezel_box,
        "lampL": lamp_box("L"),
        "lampR": lamp_box("R"),
        "face": alien_place(head_box),
        "antL": alien_place(ant_boxes[0]),
        "antR": alien_place(ant_boxes[1]),
        "eye": tuple(float(v) for v in eye_box),
        "badgeN": badges["n"]["box"],
        "badgeS": badges["s"]["box"],
    }

    content = (min(b[0] for b in boxes.values()), min(b[1] for b in boxes.values()),
               max(b[2] for b in boxes.values()), max(b[3] for b in boxes.values()))
    cw, ch = content[2] - content[0], content[3] - content[1]
    fit = min(CANVAS_W / cw, CANVAS_H / ch)
    ox = (CANVAS_W - cw * fit) / 2 - content[0] * fit
    oy = (CANVAS_H - ch * fit) / 2 - content[1] * fit
    C = {k: (ox + b[0] * fit, oy + b[1] * fit, ox + b[2] * fit, oy + b[3] * fit)
         for k, b in boxes.items()}

    def size_of(b):
        return (max(1, round(b[2] - b[0])), max(1, round(b[3] - b[1])))

    def at(b):
        return (round(b[0]), round(b[1]))

    # --- 6. write the layers -----------------------------------------------------------------------
    lamp_part = lamp_im.crop(lamp_crop)
    base = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    for tag in ("lampL", "lampR"):
        base.alpha_composite(lamp_part.resize(size_of(C[tag]), Image.LANCZOS), at(C[tag]))
    base.alpha_composite(
        bez_im.crop(bez_crop).resize(size_of(C["bezel"]), Image.LANCZOS),
        at(C["bezel"]),
    )
    base.save(OUT / "compass.webp", lossless=True, method=6)
    base.resize((CANVAS_W // 2, CANVAS_H // 2), Image.LANCZOS).save(
        OUT / "compass_mobile.webp", lossless=True, method=6
    )

    def cut(mask, box):
        out = np.asarray(alien_im).astype(np.uint8).copy()
        out[:, :, 3] = np.where(mask, out[:, :, 3], 0)
        return Image.fromarray(out).crop(box)

    cut(head_core, head_box).resize(size_of(C["face"]), Image.LANCZOS).save(
        OUT / "compass_face.webp", lossless=True, method=6
    )
    for i, (tag, pts) in enumerate(zip(("antL", "antR"), ants)):
        m = np.zeros_like(alien_a)
        m[pts[:, 0], pts[:, 1]] = True
        cut(m, bbox_of(pts)).resize(size_of(C[tag]), Image.LANCZOS).save(
            OUT / f"compass_antenna_{'lr'[i]}.webp", lossless=True, method=6
        )
    eye_w = size_of(C["eye"])[0]
    render_svg(SRC / "eye.svg", eye_w * SUPERSAMPLE).resize(size_of(C["eye"]), Image.LANCZOS).save(
        OUT / "compass_eye.webp", lossless=True, method=6
    )
    for tag, name in (("n", "compass_n"), ("s", "compass_s")):
        key = "badgeN" if tag == "n" else "badgeS"
        badges[tag]["img"].resize(size_of(C[key]), Image.LANCZOS).save(
            OUT / f"{name}.webp", lossless=True, method=6
        )

    # --- 7. the placements the component needs -----------------------------------------------------
    def frac(b):
        cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        return (f"{{ dx: {(cx - CANVAS_W / 2) / CANVAS_W:.4f}, dy: {(cy - CANVAS_H / 2) / CANVAS_H:.4f}, "
                f"w: {(b[2] - b[0]) / CANVAS_W:.4f}, h: {(b[3] - b[1]) / CANVAS_H:.4f} }}")

    print(f"\nfit {fit:.4f}  content {tuple(round(v, 2) for v in content)}\n")
    for key, const in (("face", "FACE"), ("antL", "ANTENNA_L"), ("antR", "ANTENNA_R"),
                       ("eye", "EYE"), ("badgeN", "BADGE_N"), ("badgeS", "BADGE_S")):
        print(f"const {const} = {frac(C[key])};")

    # --- 8. verify: the assembly next to the design, every run -------------------------------------
    full = base.copy()
    order = [("face", OUT / "compass_face.webp"), ("antL", OUT / "compass_antenna_l.webp"),
             ("antR", OUT / "compass_antenna_r.webp"), ("eye", OUT / "compass_eye.webp"),
             ("badgeN", OUT / "compass_n.webp"), ("badgeS", OUT / "compass_s.webp")]
    # Antennae UNDER the head, exactly as the component draws them.
    order = [order[1], order[2], order[0], order[3], order[4], order[5]]
    for key, path in order:
        full.alpha_composite(Image.open(path).convert("RGBA"), at(C[key]))
    ref_fit = ref_im.copy()
    ref_fit.thumbnail((CANVAS_W, CANVAS_H), Image.LANCZOS)
    sheet = Image.new("RGBA", (CANVAS_W * 2, CANVAS_H), tuple(PANEL) + (255,))
    sheet.paste(ref_fit, ((CANVAS_W - ref_fit.width) // 2, (CANVAS_H - ref_fit.height) // 2))
    sheet.alpha_composite(full, (CANVAS_W, 0))
    sheet.resize((CANVAS_W * 4, CANVAS_H * 2), Image.NEAREST).convert("RGB").save(VERIFY)

    strip = Image.new("RGBA", (CANVAS_W * 4, CANVAS_H), (40, 40, 55, 255))
    strip.alpha_composite(base, (0, 0))
    for i, (key, path) in enumerate((("face", OUT / "compass_face.webp"),
                                     ("antL", OUT / "compass_antenna_l.webp"),
                                     ("eye", OUT / "compass_eye.webp"))):
        layer = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
        layer.alpha_composite(Image.open(path).convert("RGBA"), at(C[key]))
        strip.alpha_composite(layer, (CANVAS_W * (i + 1), 0))
    strip.convert("RGB").save(PREVIEW)
    print(f"\nverify -> {VERIFY.relative_to(ROOT)}   layers -> {PREVIEW.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
