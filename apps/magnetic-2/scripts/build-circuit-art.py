#!/usr/bin/env python3
"""Cut the MOTHERSHIP CIRCUIT CHIP (L4) into its animatable layers.

    art-src/circuit2/r4.png         the purple frame with its circuit board and the square hole
                                    the alien sits in, transparent, 1254px      (9053:27227)
    art-src/circuit2/f4.png         the alien's face plate -- antennae and mouth, NO eyes  (9053:27240)
    art-src/circuit2/s4.png         ONE sheet holding BOTH slime blobs          (9053:27249 + 27250)
    art-src/circuit2/eye.svg        one eye, as vector                          (9053:27228 / 27234)
    art-src/circuit/reference.png   the assembled lockup at 264x260             (9053:27244)

The brief re-briefed this symbol: 9053:27244 is what the game already ships (`energy_screw.webp`),
and the seven part nodes are that same lockup taken apart so it can move --

> maybe make the green 9053:27249 move or drop animated in static mode, and in win make the alien
> zoom and become happy and maybe some lightning.

So nothing here changes what the symbol LOOKS like at rest. Every placement is measured off the
assembled reference, and the verify sheet at the end is the proof.

Two things are cut that the brief does not name, because the brief cannot be met without them:

  * The MOUTH is lifted off the face plate and its hole filled with the face's own green, so "become
    happy" can open it into a grin. The plate ships with a small neutral mouth; there is no second
    drawing of a happy one.
  * The two EYES come from the vector, not from the plate -- the plate has no eyes at all -- and are
    rendered once and used twice, because the two nodes are the same drawing.

The gold pins are NOT a part node worth cutting: 9053:27243 is a single 6x8 rounded rectangle and the
lockup has twelve of them, so they are redrawn from that node's own spec (see PIN_*) and baked into
the base. What is taken from the reference is only WHERE each one sits.

Their bounds cannot be taken from the reference, and the first cut of this script did exactly that
and came out wrong. Keying the GOLD finds the pin's visible fill -- which is the pin minus its black
stroke, and minus the whole inner half that runs under the frame. Drawn at those bounds the pins came
out stubby squares with a thin brown edge instead of tall gold tabs with a black one. So each pin's
outer box is reconstructed from the design's proportions instead: the gold is 4.8/6 of the pin's
width, and the pin is 8/6 as long as it is wide, growing INWARD from the edge of the artboard that it
touches -- which is where the design puts every one of the twelve.

Outputs onto the shared 328x264 symbol canvas:

    energy_screw.webp / _mobile   pins + frame, the static base
    circuit_face.webp             the face plate with the mouth removed and filled
    circuit_mouth.webp            the mouth alone
    circuit_eye.webp              one eye (drawn twice by the component)
    circuit_slime_a.webp          the long blob that hangs off the top-right corner  (27249)
    circuit_slime_b.webp          the round blob at the bottom-left                  (27250)

Run:  python3 scripts/build-circuit-art.py
"""

from __future__ import annotations

import io
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art-src" / "circuit2"
REF = ROOT / "art-src" / "circuit" / "reference.png"
OUT = ROOT / "static" / "assets" / "components" / "symbols" / "magnetic" / "low"
VERIFY = SRC / "verify_circuit.png"

CANVAS_W, CANVAS_H = 328, 264
# The share of the canvas the assembly may fill. Matched to the symbol this replaces (0.765 x 0.943)
# so the reel does not visibly shift when the art is swapped.
MAX_W, MAX_H = 0.79, 0.945
SUPERSAMPLE = 4

PAGE = np.array([245, 245, 245])

# The pin, straight off 9053:27243: a 6x8 box holding a rounded rect inset 0.3 with rx 0.7, filled
# #EBB133 and stroked black at 0.6. Everything below is that node divided by its 6-unit SHORT side,
# so it applies to the upright top/bottom pins and the lying-down side ones alike.
PIN_FILL = (235, 177, 51)
PIN_EDGE = (0, 0, 0)
PIN_ASPECT = 8 / 6
PIN_STROKE_F = 0.6 / 6
PIN_RADIUS_F = 0.7 / 6
# What share of the pin's width the KEYED GOLD covers: the rect is stroked on its centre line, so the
# fill runs 0.6..5.4 of the 6.
PIN_GOLD_F = 4.8 / 6


def die(msg: str) -> None:
    sys.exit(f"build-circuit-art: {msg}")


def components(mask: np.ndarray, minpx: int):
    """8-connected labelling. scipy is not a dependency of this repo."""
    h, w = mask.shape
    seen = np.zeros_like(mask)
    out = []
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]:
            continue
        seen[y0, x0] = True
        q = deque([(y0, x0)])
        pts = []
        while q:
            y, x = q.popleft()
            pts.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        q.append((ny, nx))
        if len(pts) >= minpx:
            out.append(np.array(pts))
    return out


def grow(mask: np.ndarray, n: int = 1) -> np.ndarray:
    m = mask.copy()
    for _ in range(n):
        g = m.copy()
        g[1:, :] |= m[:-1, :]
        g[:-1, :] |= m[1:, :]
        g[:, 1:] |= m[:, :-1]
        g[:, :-1] |= m[:, 1:]
        m = g
    return m


def fill_holes(mask: np.ndarray) -> np.ndarray:
    h, w = mask.shape
    free = ~mask
    seen = np.zeros_like(mask)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if free[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if free[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and free[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    return ~seen


def cbox(pts) -> tuple[int, int, int, int]:
    return (int(pts[:, 1].min()), int(pts[:, 0].min()), int(pts[:, 1].max()) + 1, int(pts[:, 0].max()) + 1)


def mbox(mask: np.ndarray) -> tuple[int, int, int, int]:
    ys, xs = np.nonzero(mask)
    if len(xs) == 0:
        die("a key matched nothing")
    return (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)


def alpha_box(im: Image.Image, thresh: int = 8) -> tuple[int, int, int, int]:
    b = im.getchannel("A").point(lambda v: 255 if v > thresh else 0).getbbox()
    if b is None:
        die("a layer came out fully transparent")
    return b


def union(*boxes):
    return (min(b[0] for b in boxes), min(b[1] for b in boxes),
            max(b[2] for b in boxes), max(b[3] for b in boxes))


def flood_colour(rgba: np.ndarray, holes: np.ndarray, seed: np.ndarray) -> np.ndarray:
    """Grow `seed`'s colour into `holes`, one ring at a time.

    Seeded on the face's GREEN only. Seeding on "any opaque pixel that is not a hole" would let the
    mouth's own black outline -- which is what surrounds the hole -- creep back in and ring the
    filled socket in black, which is exactly what it was cut out to remove.
    """
    col = rgba[:, :, :3].astype(np.float32).copy()
    known = seed.copy()
    todo = holes & ~known
    for _ in range(400):
        if not todo.any():
            break
        ring = grow(known, 1) & todo
        if not ring.any():
            break
        acc = np.zeros(col.shape, np.float32)
        cnt = np.zeros(col.shape[:2], np.float32)
        kc = col * known.astype(np.float32)[:, :, None]
        kf = known.astype(np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            acc += np.roll(np.roll(kc, dy, 0), dx, 1)
            cnt += np.roll(np.roll(kf, dy, 0), dx, 1)
        col = np.where(ring[:, :, None], acc / np.maximum(cnt, 1e-3)[:, :, None], col)
        known |= ring
        todo &= ~ring
    out = rgba.copy()
    out[:, :, :3] = np.clip(col, 0, 255).astype(np.uint8)
    out[:, :, 3] = np.where(holes, 255, out[:, :, 3])
    return out


def svg(path: Path, w: int, h: int) -> Image.Image:
    try:
        import cairosvg
    except ImportError:
        die("cairosvg is needed to render the eye")
    return Image.open(io.BytesIO(cairosvg.svg2png(url=str(path), output_width=w, output_height=h))).convert("RGBA")


def main() -> None:
    for n in ("r4.png", "f4.png", "s4.png", "eye.svg"):
        if not (SRC / n).exists():
            die(f"missing source art-src/circuit2/{n}")
    if not REF.exists():
        die("missing art-src/circuit/reference.png (the assembled lockup, 9053:27244)")
    OUT.mkdir(parents=True, exist_ok=True)

    # ---------------------------------------------------------------- the reference's geometry
    ref = np.array(Image.open(REF).convert("RGB")).astype(int)
    r, g, b = ref[:, :, 0], ref[:, :, 1], ref[:, :, 2]
    page = np.abs(ref - PAGE).max(2) < 14

    gold = (r > 200) & (g > 140) & (g < 215) & (b < 95)
    gold_boxes = sorted((cbox(c) for c in components(gold, 25)), key=lambda t: (t[1], t[0]))
    if len(gold_boxes) != 12:
        die(f"expected twelve gold pins in the reference, found {len(gold_boxes)}")
    if max(abs(int(v) - c) for v, c in zip(np.median(ref[gold], axis=0), PIN_FILL)) > 12:
        die(f"the reference's gold is {np.median(ref[gold], axis=0)}, not 9053:27243's {PIN_FILL}")

    rh, rw = gold.shape

    def pin_box(gb):
        """A pin's OUTER box, from the visible gold and the artboard edge it points at.

        The gold is only the fill: no stroke, and no inner half (that runs under the frame). The
        short axis is recovered by dividing out PIN_GOLD_F and re-centring; the long axis is the
        design's 8/6 of that, measured from the edge the pin touches. Which edge that is decides
        the pin's orientation, so it is read off the gold rather than assumed.
        """
        x0, y0, x1, y1 = gb
        near = min(y0, x0, rh - y1, rw - x1)
        vertical = min(y0, rh - y1) <= min(x0, rw - x1)
        short = (x1 - x0) if vertical else (y1 - y0)
        outer = short / PIN_GOLD_F
        pad = (outer - short) / 2
        long = outer * PIN_ASPECT
        if vertical:
            return (x0 - pad, 0.0, x1 + pad, long) if y0 <= rh - y1 else (x0 - pad, rh - long, x1 + pad, float(rh))
        return (0.0, y0 - pad, long, y1 + pad) if x0 <= rw - x1 else (rw - long, y0 - pad, float(rw), y1 + pad)

    pins = [pin_box(gb) for gb in gold_boxes]

    # The bright green appears FOUR times: the face plate's rim, the alien's head inside it, and the
    # two slime blobs. The plate is the pair that overlaps; the slimes are the two that do not.
    green = (g > 210) & (r > 150) & (r < 235) & (b < 110)
    greens = sorted(components(green, 200), key=lambda c: -len(c))
    if len(greens) < 4:
        die(f"expected at least four bright-green blobs in the reference, found {len(greens)}")
    face_ref = union(cbox(greens[0]), cbox(greens[1]))
    slime_ref = sorted((cbox(c) for c in greens[2:4]), key=lambda t: -(t[2] - t[0]))
    slime_long_ref, slime_round_ref = slime_ref[0], slime_ref[1]
    # Centres, not edges: the long blob hangs over the frame's top-right corner and its bbox still
    # overlaps the face plate's, so an edge test rejects the correct art.
    def mid(t):
        return ((t[0] + t[2]) / 2, (t[1] + t[3]) / 2)
    fcx, fcy = mid(face_ref)
    (lx, ly), (rx, ry) = mid(slime_long_ref), mid(slime_round_ref)
    if not (lx > fcx and ly < fcy and rx < fcx and ry > fcy):
        die("the two slime blobs are not where the reference puts them (top-right and bottom-left)")

    # The two pale screws on the circuit board -- the terminals the win's lightning jumps between.
    # Keyed on their blue-grey ring; the alien's eyes are cream (#FEF7DE) and do not match.
    pale = (b > 195) & (b < 245) & (r > 150) & (r < 225) & (g > 160) & (g < 235) & (b > r + 8)
    screws = sorted((cbox(c) for c in components(pale, 40)), key=lambda t: t[1])
    if len(screws) != 2:
        die(f"expected the board's two screws, found {len(screws)}")

    # The frame is the LARGEST BLOB of what is neither the page, nor a pin, nor a slime -- not the
    # bbox of that mask. Each pin keeps a sliver of its own dark outline after the gold is keyed out,
    # and those slivers sit at the very edge of the reference, so a plain bbox returns the whole
    # image and the frame gets drawn over its own pins.
    frame_mask = ~page & ~grow(gold, 3)
    for sb in (slime_long_ref, slime_round_ref):
        frame_mask[sb[1]:sb[3], sb[0]:sb[2]] = False
    frame_blobs = components(frame_mask, 2000)
    if not frame_blobs:
        die("the frame did not survive keying the pins and the slime out of the reference")
    frame_ref = cbox(max(frame_blobs, key=len))

    # The eyes are keyed on the IRIS -- the only purple on the plate -- then opened out to the whole
    # eye by the vector's own ratio. eye.svg is an 8-unit box whose iris is 5.3333 across, so the
    # sclera, its stroke and the highlight all come along at 1.5x the iris box.
    iris = (r > 70) & (r < 150) & (b > 130) & (g < 70)
    # Filtered to ROUND blobs: the same purple runs down the edge of each pink side bar, and those
    # slivers are one pixel wide and forty tall, which clears a plain pixel-count threshold.
    def roundish(t):
        bw, bh = t[2] - t[0], t[3] - t[1]
        return bw > 10 and bh > 10 and 0.75 < bw / bh < 1.33
    eyes = sorted((t for t in (cbox(c) for c in components(iris, 40)) if roundish(t)), key=lambda t: t[0])
    if len(eyes) != 2:
        die(f"expected two eyes in the reference, found {len(eyes)}")
    eye_ref = []
    for e in eyes:
        cx, cy = (e[0] + e[2]) / 2, (e[1] + e[3]) / 2
        half = (e[2] - e[0]) / 2 * (8.0 / (2 * 2.66667))
        eye_ref.append((cx - half, cy - half, cx + half, cy + half))

    # ---------------------------------------------------------------- the parts
    frame_im = Image.open(SRC / "r4.png").convert("RGBA")
    frame_im = frame_im.crop(alpha_box(frame_im))

    face_im = Image.open(SRC / "f4.png").convert("RGBA")
    face_im = face_im.crop(alpha_box(face_im))
    fa = np.array(face_im).astype(int)
    fop = fa[:, :, 3] > 40

    # The mouth: the pink tongue plus the dark hole it sits in. Keyed off the pink first (there is no
    # other pink on the plate) and then grown into whichever dark blob contains it -- keying the dark
    # alone would return the plate's entire outline.
    pink = (fa[:, :, 0] > 180) & (fa[:, :, 2] > 90) & (fa[:, :, 1] < 110) & fop
    if pink.sum() < 200:
        die("could not find the alien's mouth on the face plate")
    dark = (fa[:, :, :3].sum(2) < 260) & fop
    pb = mbox(pink)
    mouth = None
    for c in components(dark, 200):
        box = cbox(c)
        if box[0] <= pb[0] and box[1] <= pb[1] and box[2] >= pb[2] and box[3] >= pb[3]:
            if (box[2] - box[0]) < face_im.size[0] * 0.5:
                m = np.zeros(dark.shape, bool)
                m[c[:, 0], c[:, 1]] = True
                mouth = m
                break
    if mouth is None:
        die("the mouth's dark outline did not come back as one blob around the tongue")
    mouth = grow(fill_holes(mouth | pink), 1) & fop

    face_green = (fa[:, :, 1] > 200) & (fa[:, :, 1] > fa[:, :, 2] + 60) & fop & ~grow(mouth, 3)
    if face_green.sum() < 5000:
        die("not enough face green to fill the mouth with")
    face_plain = Image.fromarray(flood_colour(fa.astype(np.uint8), mouth, face_green), "RGBA")

    ma = np.array(face_im)
    ma[:, :, 3] = np.where(mouth, ma[:, :, 3], 0)
    mouth_im = Image.fromarray(ma, "RGBA")
    mouth_box_src = mbox(mouth)
    mouth_im = mouth_im.crop(mouth_box_src)

    # Both slime blobs arrive on ONE sheet; split them and tell them apart by shape, not position --
    # the sheet is a re-uploadable source and the two could swap corners in it.
    slime_im = Image.open(SRC / "s4.png").convert("RGBA")
    sa = np.array(slime_im)
    blobs = sorted(components(sa[:, :, 3] > 40, 800), key=lambda c: -len(c))
    if len(blobs) != 2:
        die(f"expected two slime blobs on the sheet, found {len(blobs)}")
    cut = []
    for c in blobs:
        m = np.zeros(sa.shape[:2], bool)
        m[c[:, 0], c[:, 1]] = True
        piece = sa.copy()
        piece[:, :, 3] = np.where(m, piece[:, :, 3], 0)
        box = cbox(c)
        cut.append((Image.fromarray(piece, "RGBA").crop(box), (box[2] - box[0]) / (box[3] - box[1])))
    cut.sort(key=lambda t: -t[1])  # widest-relative-to-tall first == the long one
    slime_long, slime_round = cut[0][0], cut[1][0]

    # ---------------------------------------------------------------- fit onto the canvas
    content = union(frame_ref, slime_long_ref, slime_round_ref, *[
        (p[0], p[1], p[2], p[3]) for p in pins
    ])
    cw, ch = content[2] - content[0], content[3] - content[1]
    fit = min(CANVAS_W * MAX_W / cw, CANVAS_H * MAX_H / ch)
    ox = (CANVAS_W - cw * fit) / 2 - content[0] * fit
    oy = (CANVAS_H - ch * fit) / 2 - content[1] * fit

    def to_canvas(box):
        return (ox + box[0] * fit, oy + box[1] * fit, ox + box[2] * fit, oy + box[3] * fit)

    def size_of(box):
        c = to_canvas(box)
        return max(1, round(c[2] - c[0])), max(1, round(c[3] - c[1]))

    def place(im, box, target):
        c = to_canvas(box)
        target.alpha_composite(im.resize(size_of(box), Image.LANCZOS), (round(c[0]), round(c[1])))

    # --- the base: pins under the frame ---------------------------------------------------------
    # Drawn, not resampled: the pin is one rounded rectangle and 9053:27243 gives its every dimension,
    # where the reference offers a 24px crop of one that is half hidden under the frame. Supersampled
    # because at this size the corner radius is about two canvas pixels.
    plate = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    from PIL import ImageDraw

    big = Image.new("RGBA", (CANVAS_W * SUPERSAMPLE, CANVAS_H * SUPERSAMPLE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(big)
    for p in pins:
        c = [v * SUPERSAMPLE for v in to_canvas(p)]
        short = min(c[2] - c[0], c[3] - c[1])
        stroke = max(1, round(short * PIN_STROKE_F))
        # The stroke sits on the rect's centre line in the design, so the drawn rect is inset by half
        # of it -- otherwise the pin ends up a stroke wider than the node and the twelve of them push
        # the whole symbol out of its box.
        h = stroke / 2
        draw.rounded_rectangle(
            [c[0] + h, c[1] + h, c[2] - 1 - h, c[3] - 1 - h],
            radius=short * PIN_RADIUS_F,
            fill=PIN_FILL + (255,), outline=PIN_EDGE + (255,), width=stroke,
        )
    plate.alpha_composite(big.resize((CANVAS_W, CANVAS_H), Image.LANCZOS))
    place(frame_im, frame_ref, plate)
    plate.save(OUT / "energy_screw.webp", lossless=True, method=6)
    plate.resize((CANVAS_W // 2, CANVAS_H // 2), Image.LANCZOS).save(
        OUT / "energy_screw_mobile.webp", lossless=True, method=6
    )

    # --- the alien -------------------------------------------------------------------------------
    face_w, face_h = size_of(face_ref)
    face_out = face_plain.resize((face_w, face_h), Image.LANCZOS)
    face_out.save(OUT / "circuit_face.webp", lossless=True, method=6)

    # The mouth's box comes from its position INSIDE the plate, scaled by the plate's own scale --
    # not from a key on the reference, where the mouth is 12 pixels across.
    sx = face_w / face_im.size[0]
    sy = face_h / face_im.size[1]
    fc = to_canvas(face_ref)
    mouth_box = (fc[0] + mouth_box_src[0] * sx, fc[1] + mouth_box_src[1] * sy,
                 fc[0] + mouth_box_src[2] * sx, fc[1] + mouth_box_src[3] * sy)
    mw = max(1, round(mouth_box[2] - mouth_box[0]))
    mh = max(1, round(mouth_box[3] - mouth_box[1]))
    mouth_im.resize((mw, mh), Image.LANCZOS).save(OUT / "circuit_mouth.webp", lossless=True, method=6)

    ew, eh = size_of(eye_ref[0])
    svg(SRC / "eye.svg", ew * SUPERSAMPLE, eh * SUPERSAMPLE).resize((ew, eh), Image.LANCZOS).save(
        OUT / "circuit_eye.webp", lossless=True, method=6
    )

    place_boxes = {}
    for name, im, box in (
        ("circuit_slime_a.webp", slime_long, slime_long_ref),
        ("circuit_slime_b.webp", slime_round, slime_round_ref),
    ):
        im.resize(size_of(box), Image.LANCZOS).save(OUT / name, lossless=True, method=6)
        place_boxes[name] = box

    # ---------------------------------------------------------------- the numbers
    def frac(box):
        """`box` is in CANVAS pixels. Everything measured off the reference has to go through
        to_canvas() BEFORE it gets here -- an earlier version tried to tell the two apart by whether
        the numbers were floats, and silently reported the eyes at their reference coordinates."""
        x0, y0, x1, y1 = box
        return {
            "dx": round((x0 + x1) / 2 / CANVAS_W - 0.5, 4),
            "dy": round((y0 + y1) / 2 / CANVAS_H - 0.5, 4),
            "w": round((x1 - x0) / CANVAS_W, 4),
            "h": round((y1 - y0) / CANVAS_H, 4),
        }

    print(f"fit {fit:.4f}  content {content}  pins {len(pins)}")
    for label, box in (("FACE", face_ref), ("SLIME_A", slime_long_ref), ("SLIME_B", slime_round_ref),
                       ("EYE_L", eye_ref[0]), ("EYE_R", eye_ref[1])):
        f = frac(to_canvas(box))
        print(f"const {label} = {{ dx: {f['dx']}, dy: {f['dy']}, w: {f['w']}, h: {f['h']} }};")
    for label, box in (("SCREW_A", screws[0]), ("SCREW_B", screws[1])):
        f = frac(to_canvas(box))
        print(f"const {label} = {{ dx: {f['dx']}, dy: {f['dy']} }};")

    # The alien's own parts, printed RELATIVE TO THE FACE'S CENTRE: the component nests them in a
    # container that zooms the alien, so an eye placed against the symbol box would slide out of the
    # head the moment the head grew.
    fp = frac(to_canvas(face_ref))
    print("// relative to the FACE's centre -- these go inside the alien's container:")
    for label, box in (("EYE_L", to_canvas(eye_ref[0])), ("EYE_R", to_canvas(eye_ref[1])),
                       ("MOUTH", mouth_box)):
        f = frac(box)
        print(f"const {label} = {{ dx: {round(f['dx'] - fp['dx'], 4)}, "
              f"dy: {round(f['dy'] - fp['dy'], 4)}, w: {f['w']}, h: {f['h']} }};")

    # ---------------------------------------------------------------- proof
    built = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    built.alpha_composite(plate)
    place(face_out, face_ref, built)
    built.alpha_composite(Image.open(OUT / "circuit_mouth.webp").convert("RGBA"),
                          (round(mouth_box[0]), round(mouth_box[1])))
    for e in eye_ref:
        c = to_canvas(e)
        built.alpha_composite(Image.open(OUT / "circuit_eye.webp").convert("RGBA"),
                              (round(c[0]), round(c[1])))
    for name in ("circuit_slime_a.webp", "circuit_slime_b.webp"):
        c = to_canvas(place_boxes[name])
        built.alpha_composite(Image.open(OUT / name).convert("RGBA"), (round(c[0]), round(c[1])))

    shot = Image.open(REF).convert("RGBA")
    shot = shot.resize((round(shot.size[0] * CANVAS_H / shot.size[1]), CANVAS_H), Image.LANCZOS)
    sheet = Image.new("RGBA", (CANVAS_W + shot.size[0] + 24, CANVAS_H), (18, 12, 40, 255))
    sheet.alpha_composite(built, (0, 0))
    sheet.alpha_composite(shot, (CANVAS_W + 24, 0))
    sheet.resize((sheet.size[0] * 3, sheet.size[1] * 3), Image.LANCZOS).save(VERIFY)
    print(f"wrote {VERIFY.name}")


if __name__ == "__main__":
    main()
