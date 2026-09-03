#!/usr/bin/env python3
"""Cut the MOTHERSHIP WILD into its animatable layers.

    art-src/wild/magnet_ns.png   the red/blue horseshoe with its N and S caps   (9053:27270)
    art-src/wild/plaque.png      the purple WILD bar with four green studs      (9053:27271)
    art-src/wild/bolt.png        the yellow lightning                           (9053:27272)
    art-src/wild/eyeblob.png     the green eye blob, no eye on it               (9053:27279)
    art-src/wild/eye.svg         the eye itself: sclera, iris, pupil, glint     (9053:27273)
    art-src/wild/reference.png   the composed lockup, supplied by the designer

The four rasters do NOT share a frame -- they are 1254x1254, 2172x724 and 1217x1293 -- so their own
coordinates carry no relative information whatsoever. Every placement has to come from the
reference, and this script works entirely in REFERENCE coordinates: each part is keyed by colour in
the reference to find where it sits, and keyed by the SAME colour in its own raster to find how much
of it that key leaves out. The ratio between the two boxes then expands the reference box back to
the part's full extent, outline and all.

That two-image comparison is doing real work, because in this lockup almost every part is occluded:

  * The eye BLOB's stem disappears behind the arch crown, so it scales from width, anchored top.
  * The PLAQUE's top edge is behind the N and S caps, so it scales from width anchored on its
    BOTTOM.
  * The magnet's CROWN is behind the blob -- but the crown is a pale highlight that the red/blue key
    misses in BOTH images, so it cancels out and never reaches the measurement.

**The N and S caps are placed separately from the arch, and that is not an occlusion fix.** Placing
the whole magnet by one mapping puts the arch dead on -- a 50% overlay against the reference shows
no doubling anywhere along it -- and still lands the caps 27 reference-px too low, with the N glyph
14% too tall. The design moved the caps UP relative to the arch; the raster is not a uniform scale
of what the designer composed. So the arch is placed from the two LIMB blobs and each cap is placed
from its own blob, all four of which the colour keys separate cleanly because every cap carries a
full dark outline that cuts it off from the limb it sits on.

The arch layer is the FULL magnet raster, caps included, rather than a cut-out. Its own caps end up
entirely underneath the repositioned ones (same x to within 2px, and everything below the plaque
line is covered anyway), so cutting them out would buy nothing and would risk exposing a bite in the
limb ends if a future reposition moved a cap the other way.

Outputs onto the shared 328x264 symbol canvas:

    wild.webp / wild_mobile.webp   the magnet with its caps re-seated, the static base
    wild_plaque.webp               the WILD bar
    wild_word.webp                 just the letters, for the additive "the wild lights" ghost
    wild_blob.webp                 the eye blob
    wild_eye.webp                  the eye, rendered from the SVG
    wild_bolt.webp                 the lightning

It also prints the four studs' centres, which pulse with the word.

Run:  python3 scripts/build-wild-art.py
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art-src" / "wild"
OUT = ROOT / "static" / "assets" / "components" / "symbols" / "magnetic" / "special"
PREVIEW = SRC / "preview_wild_layers.png"
VERIFY = SRC / "verify_wild.png"

CANVAS_W, CANVAS_H = 328, 264
SUPERSAMPLE = 4

# eye.svg is a 8-unit box holding a circle of r=3.76 stroked at 0.479, so the ink reaches r=4.0 --
# exactly the viewBox -- while the cream FILL the reference key sees only reaches 3.76 - 0.479/2.
# The keyed box therefore has to grow by this factor to become the drawn box.
EYE_INK_R = 4.0
EYE_FILL_R = 3.76047 - 0.47907 / 2


def die(msg: str) -> None:
    sys.exit(f"build-wild-art: {msg}")


def keys(rgb: np.ndarray, alpha: np.ndarray | None = None) -> dict:
    r, g, b = rgb[:, :, 0].astype(int), rgb[:, :, 1].astype(int), rgb[:, :, 2].astype(int)
    op = np.ones(r.shape, bool) if alpha is None else alpha > 120
    return {
        "red": op & (r > 190) & (g < 130) & (b < 130),
        "blue": op & (b > 200) & (g > 100) & (g < 200) & (r < 130),
        "green": op & (g > 150) & (r < 200) & (b < 130) & (g > r + 30) & (g > b + 60),
        "yellow": op & (r > 210) & (g > 180) & (b < 130) & (r > b + 80) & (g > b + 60),
        "purple": op & (r > 60) & (r < 130) & (g > 30) & (g < 95) & (b > 140) & (b < 215),
        "pink": op & (r > 200) & (g > 110) & (g < 200) & (b > 200),
        "cream": op & (r > 240) & (g > 235) & (b > 200) & (b < 240),
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


def grow(mask: np.ndarray, n: int) -> np.ndarray:
    """Binary dilation by n 4-connected steps."""
    m = mask.copy()
    for _ in range(n):
        g = m.copy()
        g[1:, :] |= m[:-1, :]
        g[:-1, :] |= m[1:, :]
        g[:, 1:] |= m[:, :-1]
        g[:, :-1] |= m[:, 1:]
        m = g
    return m


def cap_and_limb(mask: np.ndarray, name: str):
    """Split one pole's colour into its LIMB and its CAP, as (mask, box) pairs.

    Every cap is drawn with a full dark outline where it meets the limb, so the two never touch and
    a plain connected-component pass separates them. The cap is the lower of the two.
    """
    bs = blobs(mask, 2000)
    if len(bs) != 2:
        die(f"expected a limb and a cap for the {name} pole, found {len(bs)} blobs")
    out = []
    for pts in bs:
        m = np.zeros_like(mask)
        for y, x in pts:
            m[y, x] = True
        out.append((m, bb(pts)))
    out.sort(key=lambda t: t[1][1])
    return out[0], out[1]


def cap_ink(cap: np.ndarray, limb: np.ndarray):
    """The cap grown out to take its own outline with it, but not the limb it sits against.

    Grown one step at a time and stopped just before the growth touches the limb's colour: the gap
    between the two IS the outline, so the last safe radius covers the outline and nothing else.
    """
    grown = cap
    for r in range(1, 60):
        nxt = grow(cap, r)
        if (nxt & limb).any():
            return grown, r - 1
        grown = nxt
    die("a cap's outline never closed; the growth ran away")


def glyph(rgb: np.ndarray, alpha, box, name: str):
    """The white N or S inside a cap's box.

    Pure white (>= 250) separates it from the reference's 245 background without needing an alpha
    channel, which the reference does not have.
    """
    r, g, b = rgb[:, :, 0].astype(int), rgb[:, :, 1].astype(int), rgb[:, :, 2].astype(int)
    op = np.ones(r.shape, bool) if alpha is None else alpha > 120
    m = op & (r >= 250) & (g >= 250) & (b >= 250)
    m[: box[1], :] = False
    m[box[3]:, :] = False
    m[:, : box[0]] = False
    m[:, box[2]:] = False
    if not m.any():
        die(f"no glyph found inside the {name} cap")
    return mbb(m)


def place(ref_key, src_key, src_alpha, anchor: str):
    """The part's FULL box in reference coordinates.

    Scale always comes from WIDTH -- in this lockup every part has clean left and right extremes and
    at least one occluded horizontal edge. `anchor` says which vertical edge of the key box is
    trustworthy; the other one is derived from the art's own aspect rather than measured.
    """
    scale = (ref_key[2] - ref_key[0]) / (src_key[2] - src_key[0])
    x0 = ref_key[0] + (src_alpha[0] - src_key[0]) * scale
    w = (src_alpha[2] - src_alpha[0]) * scale
    h = (src_alpha[3] - src_alpha[1]) * scale
    if anchor == "top":
        y0 = ref_key[1] + (src_alpha[1] - src_key[1]) * scale
    elif anchor == "bottom":
        y0 = ref_key[3] + (src_alpha[3] - src_key[3]) * scale - h
    else:
        die(f"unknown anchor {anchor}")
    return (x0, y0, x0 + w, y0 + h)


def main() -> None:
    for n in ("magnet_ns.png", "plaque.png", "bolt.png", "eyeblob.png", "eye.svg", "reference.png"):
        if not (SRC / n).exists():
            die(f"missing source art-src/wild/{n}")
    OUT.mkdir(parents=True, exist_ok=True)

    ref = np.array(Image.open(SRC / "reference.png").convert("RGB"))
    rk = keys(ref)

    parts = {}
    for name in ("magnet_ns", "plaque", "bolt", "eyeblob"):
        im = Image.open(SRC / f"{name}.png").convert("RGBA")
        a = np.array(im)
        parts[name] = (im, keys(a[:, :, :3], a[:, :, 3]), alpha_bbox(im))

    # --- where each part BELONGS, in reference coordinates -------------------------------------
    mag_im, mag_k, mag_a = parts["magnet_ns"]
    # Limbs and caps, separately, in both images. The ARCH mapping comes from the limbs alone.
    (_, ref_limb_n), (_, ref_cap_n) = cap_and_limb(rk["red"], "N (reference)")
    (_, ref_limb_s), (_, ref_cap_s) = cap_and_limb(rk["blue"], "S (reference)")
    (src_limb_n_m, src_limb_n), (src_cap_n_m, src_cap_n) = cap_and_limb(mag_k["red"], "N (source)")
    (src_limb_s_m, src_limb_s), (src_cap_s_m, src_cap_s) = cap_and_limb(mag_k["blue"], "S (source)")

    boxes = {
        "magnet": place(
            union(ref_limb_n, ref_limb_s), union(src_limb_n, src_limb_s), mag_a, "top",
        ),
        "blob": place(
            biggest(rk["green"], 400), mbb(parts["eyeblob"][1]["green"]), parts["eyeblob"][2], "top"
        ),
        "bolt": place(
            biggest(rk["yellow"], 200), mbb(parts["bolt"][1]["yellow"]), parts["bolt"][2], "top"
        ),
        "plaque": place(
            biggest(rk["purple"], 400), mbb(parts["plaque"][1]["purple"]), parts["plaque"][2],
            "bottom",
        ),
    }
    # The eye is not in any raster -- it is only in the reference and in the SVG, whose ink box is
    # its viewBox. Grow the keyed cream disc back out to the stroked disc.
    ec = biggest(rk["cream"], 60)
    cx, cy = (ec[0] + ec[2]) / 2, (ec[1] + ec[3]) / 2
    er = (ec[2] - ec[0]) / 2 * (EYE_INK_R / EYE_FILL_R)
    boxes["eye"] = (cx - er, cy - er, cx + er, cy + er)

    # The caps, each from its OWN blob. Anchored on the TOP: in the reference their bottoms run
    # under the plaque, and their tops are the whole reason they are placed separately.
    #
    # The caps are scaled NON-UNIFORMLY, and that is deliberate. Matching the cap's width and then
    # taking its height from the art's own aspect leaves the cap 13% too tall: the design squashed
    # them. The vertical scale therefore comes from the white N / S GLYPH, which is fully visible in
    # both images and is the only vertical feature inside a cap that the plaque does not cut.
    mag_rgb = np.array(mag_im)[:, :, :3]
    mag_al = np.array(mag_im)[:, :, 3]
    cap_layers = {}
    for tag, ref_cap, src_cap, cap_m, limb_m in (
        ("cap_n", ref_cap_n, src_cap_n, src_cap_n_m, src_limb_n_m),
        ("cap_s", ref_cap_s, src_cap_s, src_cap_s_m, src_limb_s_m),
    ):
        ink, radius = cap_ink(cap_m, limb_m)
        ink_box = mbb(ink)
        ref_glyph = glyph(ref, None, ref_cap, f"{tag} (reference)")
        src_glyph = glyph(mag_rgb, mag_al, src_cap, f"{tag} (source)")
        sx = (ref_cap[2] - ref_cap[0]) / (src_cap[2] - src_cap[0])
        sy = (ref_glyph[3] - ref_glyph[1]) / (src_glyph[3] - src_glyph[1])
        # Cross-check against a second, independent vertical measure -- the gap from the cap's top
        # edge to the glyph's. It uses a much smaller span, so it is the noisier of the two and is
        # only a guard, not the value used.
        alt = (ref_glyph[1] - ref_cap[1]) / (src_glyph[1] - src_cap[1])
        if abs(alt - sy) / sy > 0.08:
            die(f"{tag}: glyph height says y-scale {sy:.4f} but the cap-to-glyph gap says {alt:.4f}")
        x0 = ref_cap[0] + (ink_box[0] - src_cap[0]) * sx
        y0 = ref_glyph[1] - (src_glyph[1] - ink_box[1]) * sy
        boxes[tag] = (
            x0, y0,
            x0 + (ink_box[2] - ink_box[0]) * sx,
            y0 + (ink_box[3] - ink_box[1]) * sy,
        )
        cap_layers[tag] = (ink, ink_box, radius, sx, sy)

    # --- fit the assembly to the canvas --------------------------------------------------------
    content = union(*boxes.values())
    cw, ch = content[2] - content[0], content[3] - content[1]
    fit = min(CANVAS_W / cw, CANVAS_H / ch)
    ox = (CANVAS_W - cw * fit) / 2 - content[0] * fit
    oy = (CANVAS_H - ch * fit) / 2 - content[1] * fit

    def to_canvas(b):
        return (ox + b[0] * fit, oy + b[1] * fit, ox + b[2] * fit, oy + b[3] * fit)

    def frac(b):
        x0, y0, x1, y1 = to_canvas(b)
        return {
            "dx": round((x0 + x1) / 2 / CANVAS_W - 0.5, 4),
            "dy": round((y0 + y1) / 2 / CANVAS_H - 0.5, 4),
            "w": round((x1 - x0) / CANVAS_W, 4),
            "h": round((y1 - y0) / CANVAS_H, 4),
        }

    # --- render each layer ---------------------------------------------------------------------
    rendered = {}

    def raster(name: str, key: str):
        im, _, a = parts[name]
        crop = im.crop(a)
        b = to_canvas(boxes[key])
        size = (max(1, round(b[2] - b[0])), max(1, round(b[3] - b[1])))
        rendered[key] = crop.resize(size, Image.LANCZOS)

    raster("magnet_ns", "magnet")
    raster("eyeblob", "blob")
    raster("bolt", "bolt")
    raster("plaque", "plaque")

    # Each cap: the magnet's pixels masked to the grown cap, cropped to that mask's box.
    for tag in ("cap_n", "cap_s"):
        ink, ink_box, _, _, _ = cap_layers[tag]
        cut = np.array(mag_im)
        cut[:, :, 3] = np.where(ink, cut[:, :, 3], 0)
        b = to_canvas(boxes[tag])
        rendered[tag] = Image.fromarray(cut).crop(ink_box).resize(
            (max(1, round(b[2] - b[0])), max(1, round(b[3] - b[1]))), Image.LANCZOS
        )

    # The WORD is not cut out of the plaque -- it is the plaque's own pixels, masked. Drawn
    # additively at the plaque's placement it lights exactly the letters, with no hole to fill and
    # no second copy of the bar to keep aligned.
    plaque_im, plaque_k, plaque_a = parts["plaque"]
    word_mask = plaque_k["pink"][plaque_a[1]:plaque_a[3], plaque_a[0]:plaque_a[2]]
    word = np.array(plaque_im.crop(plaque_a))
    word[:, :, 3] = np.where(word_mask, word[:, :, 3], 0)
    rendered["word"] = Image.fromarray(word).resize(rendered["plaque"].size, Image.LANCZOS)

    # The eye comes from the vector, rendered at SUPERSAMPLE x its on-screen size.
    eb = to_canvas(boxes["eye"])
    eye_px = max(1, round(eb[2] - eb[0]))
    try:
        import cairosvg
    except ImportError:
        die("cairosvg is needed to render eye.svg")
    png = cairosvg.svg2png(
        url=str(SRC / "eye.svg"), output_width=eye_px * SUPERSAMPLE, output_height=eye_px * SUPERSAMPLE
    )
    rendered["eye"] = Image.open(io.BytesIO(png)).convert("RGBA").resize((eye_px, eye_px), Image.LANCZOS)

    # --- write -----------------------------------------------------------------------------------
    plate = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    for key in ("magnet", "cap_n", "cap_s"):
        b = to_canvas(boxes[key])
        plate.alpha_composite(rendered[key], (round(b[0]), round(b[1])))
    plate.save(OUT / "wild.webp", lossless=True, method=6)
    plate.resize((CANVAS_W // 2, CANVAS_H // 2), Image.LANCZOS).save(
        OUT / "wild_mobile.webp", lossless=True, method=6
    )
    for key, fname in (
        ("plaque", "wild_plaque"), ("word", "wild_word"),
        ("blob", "wild_blob"), ("eye", "wild_eye"), ("bolt", "wild_bolt"),
    ):
        rendered[key].save(OUT / f"{fname}.webp", lossless=True, method=6)

    # --- the four studs, as fractions of the SYMBOL box ------------------------------------------
    studs = sorted(
        (bb(p) for p in blobs(plaque_k["green"], 300)),
        key=lambda b: (b[0], b[1]),
    )
    if len(studs) != 4:
        die(f"expected four studs on the plaque, found {len(studs)}")
    pb = to_canvas(boxes["plaque"])
    stud_out = []
    for s in studs:
        # stud centre, as a fraction of the plaque's own alpha box, then onto the canvas
        u = ((s[0] + s[2]) / 2 - plaque_a[0]) / (plaque_a[2] - plaque_a[0])
        v = ((s[1] + s[3]) / 2 - plaque_a[1]) / (plaque_a[3] - plaque_a[1])
        r = (s[2] - s[0]) / 2 / (plaque_a[2] - plaque_a[0]) * (pb[2] - pb[0])
        stud_out.append({
            "dx": round((pb[0] + u * (pb[2] - pb[0])) / CANVAS_W - 0.5, 4),
            "dy": round((pb[1] + v * (pb[3] - pb[1])) / CANVAS_H - 0.5, 4),
            "r": round(r / CANVAS_W, 4),
        })

    print(f"fit {fit:.4f}  content {tuple(round(v, 1) for v in content)}")
    for tag in ("cap_n", "cap_s"):
        _, _, rad, sx, sy = cap_layers[tag]
        print(f"{tag}: outline {rad}px, x-scale {sx:.4f}, y-scale {sy:.4f} (squash {sy / sx:.3f})")
    for name, key in (("PLAQUE", "plaque"), ("BLOB", "blob"), ("EYE", "eye"), ("BOLT", "bolt")):
        f = frac(boxes[key])
        print(f"const {name} = {{ dx: {f['dx']}, dy: {f['dy']}, w: {f['w']}, h: {f['h']} }};")
    print("const STUDS = [")
    for s in stud_out:
        print(f"\t{{ dx: {s['dx']}, dy: {s['dy']}, r: {s['r']} }},")
    print("];")

    # --- proof -----------------------------------------------------------------------------------
    check = Image.new("RGBA", (CANVAS_W, CANVAS_H), (18, 12, 40, 255))
    check.alpha_composite(Image.open(OUT / "wild.webp").convert("RGBA"))
    for key in ("bolt", "plaque", "blob", "eye"):
        b = to_canvas(boxes[key])
        check.alpha_composite(rendered[key], (round(b[0]), round(b[1])))
    check.resize((CANVAS_W * 3, CANVAS_H * 3), Image.NEAREST).save(VERIFY)

    order = ("magnet", "cap_n", "cap_s", "bolt", "plaque", "word", "blob", "eye")
    strip = Image.new("RGBA", (CANVAS_W * len(order), CANVAS_H), (18, 12, 40, 255))
    for i, key in enumerate(order):
        cell = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
        b = to_canvas(boxes["plaque" if key == "word" else key])
        cell.alpha_composite(rendered[key], (round(b[0]), round(b[1])))
        strip.alpha_composite(cell, (i * CANVAS_W, 0))
    strip.resize((CANVAS_W * len(order) * 2, CANVAS_H * 2), Image.NEAREST).save(PREVIEW)
    print(f"wrote {VERIFY.name} and {PREVIEW.name}")


if __name__ == "__main__":
    main()
