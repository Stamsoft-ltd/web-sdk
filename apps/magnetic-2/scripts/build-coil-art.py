#!/usr/bin/env python3
"""Cut the MOTHERSHIP ASTRONAUT (L3) into its animatable layers.

    art-src/coil2/master.png      the ONE source the design draws all four parts from: a free-
                                  standing alien on the left and an empty helmet on the right,
                                  both already transparent    (rawImages of 9126:19253)
    art-src/coil2/design_ref.png  the assembled lockup, 65x98  (9133:10682)

The brief named four Figma nodes -- 9126:19253 the helmet, 9126:19254 the head, 9126:19255 and
9126:19256 the two eyes. They are NOT four separate images: every one of them is a rounded-rectangle
whose image fill crops the same uploaded sheet. So the node boxes are useless as geometry (the eye
nodes are 17x12, a landscape box around a portrait eye, because the fill is set to CROP) and the
parts have to be cut out of the sheet here instead.

The eyes are the reason the head is cut at all. The brief is "in static make the eyes like looking
around and in win make the head zoom in/out and shake" -- so the eyes must move inside the face, and
the face must move inside the helmet. Three layers, nested: helmet (still), head (zooms and shakes),
eyes (drift within the head).

Lifting the eyes off the face leaves two holes. `flood_green` paints them over with the face's own
green before the eye sprites go back on top, so a drifting eye can never expose a transparent bite
out of the alien's head. It grows the FACE colour inward rather than smearing the nearest pixel of
anything: the nearest pixel to an eye's outer edge is the head's dark outline, and letting that
bleed in would ring each socket in black.

Outputs onto the shared 328x264 symbol canvas:

    coil.webp / coil_mobile.webp   the helmet alone -- the static base
    coil_head.webp                 the alien's head with both eyes removed and filled
    coil_eye_l.webp                the alien's own left eye (screen right)
    coil_eye_r.webp                the alien's own right eye (screen left)

Run:  python3 scripts/build-coil-art.py
"""

from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art-src" / "coil2"
OUT = ROOT / "static" / "assets" / "components" / "symbols" / "magnetic" / "low"
VERIFY = SRC / "verify_coil.png"

CANVAS_W, CANVAS_H = 328, 264
# The share of the canvas the helmet may fill, width and height. NOT one margin: the helmet is
# nearly square (aspect 1.046) where most of this set is tall and narrow, so fitting it to a single
# inset makes it height-limited and it comes out reading much larger than its neighbours even
# though no dimension is bigger. These are the compass's numbers -- the other round symbol in the
# set -- which is what makes the two sit at the same visual weight in a reel.
MAX_W, MAX_H = 0.80, 0.845

# The head's box relative to the HELMET's OPAQUE box, MEASURED off design_ref.png rather than read
# off the lockup's node geometry. The node numbers say 0.6106 x 0.5681 anchored 3.6% right of
# centre; the render says 0.5518 x 0.5714, dead centre. The node numbers are the wrong ones: node
# 19249's image fill is the whole two-figure sheet, so its 65x97.5 box holds the helmet PLUS the
# sheet's transparent margin, and every ratio taken against that box comes out ~9% too small.
#
# The measured box is 32x32 against a head crop whose own aspect is 1.137, so the design squeezes
# the alien ~12% narrower. That is kept, not "corrected": squeezed is what makes the face read as
# round and young, and un-squeezing it fills the visor to its edges and loses the blue ring.
HEAD_BOX = (0.5 - 0.5518 / 2, 0.5 - 0.5714 / 2, 0.5 + 0.5518 / 2, 0.5 + 0.5714 / 2)

# How far the eye sprites may be nudged before the fill behind them shows. Reported, not applied --
# the component owns the motion; this is the ceiling it was measured against.
EYE_SAFE = 0.02


def die(msg: str) -> None:
    sys.exit(f"build-coil-art: {msg}")


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
    """Everything not reachable from the border through the mask's complement."""
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


def bbox(mask: np.ndarray):
    ys, xs = np.nonzero(mask)
    if len(xs) == 0:
        die("a mask matched nothing")
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def alpha_bbox(im: Image.Image, thresh: int = 8):
    b = im.getchannel("A").point(lambda v: 255 if v > thresh else 0).getbbox()
    if b is None:
        die("a layer came out fully transparent")
    return b


def flood_green(rgba: np.ndarray, holes: np.ndarray, seed: np.ndarray) -> np.ndarray:
    """Grow `seed`'s colour into `holes`, one ring per pass, averaging the ring's known neighbours.

    Deliberately seeded on the FACE GREEN only. Seeding on "every opaque pixel that is not a hole"
    would let the head's dark outline -- which touches the outer edge of each eye -- creep in and
    print a black ring around each empty socket.
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
        kf = known.astype(np.float32)[:, :, None]
        kc = col * kf
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            acc += np.roll(np.roll(kc, dy, 0), dx, 1)
            cnt += np.roll(np.roll(known.astype(np.float32), dy, 0), dx, 1)
        safe = np.maximum(cnt, 1e-3)[:, :, None]
        col = np.where(ring[:, :, None], acc / safe, col)
        known |= ring
        todo &= ~ring
    out = rgba.copy()
    out[:, :, :3] = np.clip(col, 0, 255).astype(np.uint8)
    out[:, :, 3] = np.where(holes, 255, out[:, :, 3])
    return out


def main() -> None:
    for n in ("master.png", "design_ref.png"):
        if not (SRC / n).exists():
            die(f"missing source art-src/coil2/{n}")
    OUT.mkdir(parents=True, exist_ok=True)

    master = Image.open(SRC / "master.png").convert("RGBA")
    m = np.array(master)
    opaque = m[:, :, 3] > 40

    # --- split the sheet -------------------------------------------------------------------------
    # The two figures are drawn side by side with a wide empty gutter between them. Find the gutter
    # rather than hard-coding a column: the sheet is a re-uploadable source.
    cols = opaque.any(0)
    gaps = []
    run = None
    for x in range(len(cols) + 1):
        inside = x < len(cols) and not cols[x]
        if inside and run is None:
            run = x
        elif not inside and run is not None:
            if 0 < run and x < len(cols) and x - run > 20:
                gaps.append((run, x))
            run = None
    if len(gaps) != 1:
        die(f"expected exactly one gutter between the alien and the helmet, found {len(gaps)}")
    split = (gaps[0][0] + gaps[0][1]) // 2

    alien_box = bbox(opaque & (np.arange(m.shape[1])[None, :] < split))
    helmet_box = bbox(opaque & (np.arange(m.shape[1])[None, :] >= split))
    helmet = master.crop(helmet_box)

    # --- cut the head off at the neck --------------------------------------------------------------
    # The alien is a head on a small body. The neck is the narrowest row in the figure's upper half
    # -- both the head above it and the shoulders below it are wider than it is.
    alien = master.crop(alien_box)
    aa = np.array(alien)[:, :, 3] > 40
    widths = aa.sum(1)
    upper = widths[: int(len(widths) * 0.72)]
    neck = int(np.argmin(np.where(np.arange(len(upper)) > len(upper) * 0.5, upper, 10**6)))
    if not 0.5 < neck / len(widths) < 0.85:
        die(f"the neck landed at {neck}/{len(widths)}, which is not where a neck is")
    head_im = alien.crop((0, 0, alien.size[0], neck)).crop(
        alpha_bbox(alien.crop((0, 0, alien.size[0], neck)))
    )
    ha = np.array(head_im)

    # --- the two eyes ------------------------------------------------------------------------------
    # Dark and blue-leaning: the face is green, the outline is a dark GREEN, and the sparkles inside
    # each eye are white (so they fall out of this key and are put back by fill_holes below).
    dark = (ha[:, :, 3] > 120) & (ha[:, :, :3].sum(2) < 330) & (ha[:, :, 2] > ha[:, :, 1])
    eyes = sorted(components(dark, 400), key=lambda c: c[:, 1].min())
    if len(eyes) != 2:
        die(f"expected two eyes in the alien's face, found {len(eyes)}")

    eye_masks = []
    for pts in eyes:
        mk = np.zeros(dark.shape, bool)
        mk[pts[:, 0], pts[:, 1]] = True
        # fill first (the sparkle is a hole), then grow to pick up the eye's pale outer rim.
        eye_masks.append(grow(fill_holes(mk), 2) & (ha[:, :, 3] > 8))

    face = (
        (ha[:, :, 3] > 200)
        & (ha[:, :, 1] > 150)
        & (ha[:, :, 1].astype(int) > ha[:, :, 2].astype(int) + 30)
        & ~grow(eye_masks[0] | eye_masks[1], 3)
    )
    if face.sum() < 2000:
        die("could not find enough face green to fill the eye sockets with")

    holes = eye_masks[0] | eye_masks[1]
    head_plain = Image.fromarray(flood_green(ha, holes, face), "RGBA")

    eye_ims = []
    for mk in eye_masks:
        e = ha.copy()
        e[:, :, 3] = np.where(mk, e[:, :, 3], 0)
        im = Image.fromarray(e, "RGBA")
        eye_ims.append((im.crop(alpha_bbox(im)), bbox(mk)))

    # --- lay the assembly out on the symbol canvas ---------------------------------------------------
    hw, hh = helmet.size
    fit = min(CANVAS_W * MAX_W / hw, CANVAS_H * MAX_H / hh)
    helmet_w, helmet_h = round(hw * fit), round(hh * fit)
    helmet_x = (CANVAS_W - helmet_w) / 2
    helmet_y = (CANVAS_H - helmet_h) / 2

    hx0 = helmet_x + HEAD_BOX[0] * helmet_w
    hy0 = helmet_y + HEAD_BOX[1] * helmet_h
    head_w = (HEAD_BOX[2] - HEAD_BOX[0]) * helmet_w
    head_h = (HEAD_BOX[3] - HEAD_BOX[1]) * helmet_h
    natural = head_im.size[0] / head_im.size[1]
    squeeze = (head_w / head_h) / natural
    if not 0.82 < squeeze < 1.02:
        die(f"the head would be squeezed to {squeeze:.3f} of its aspect, which is not the design's")

    # --- write the layers ------------------------------------------------------------------------
    plate = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    plate.alpha_composite(helmet.resize((helmet_w, helmet_h), Image.LANCZOS),
                          (round(helmet_x), round(helmet_y)))
    plate.save(OUT / "coil.webp", lossless=True, method=6)
    plate.resize((CANVAS_W // 2, CANVAS_H // 2), Image.LANCZOS).save(
        OUT / "coil_mobile.webp", lossless=True, method=6
    )

    head_sx = head_w / head_im.size[0]
    head_sy = head_h / head_im.size[1]
    head_out = head_plain.resize(
        (max(1, round(head_w)), max(1, round(head_h))), Image.LANCZOS
    )
    head_out.save(OUT / "coil_head.webp", lossless=True, method=6)

    # Eye placements are reported relative to the HEAD's CENTRE, because the component nests them in
    # a container that zooms and shakes the head -- an eye placed against the symbol box would slide
    # out of the face the moment the head moved.
    def frac_box(x0, y0, w, h):
        return {
            "dx": round((x0 + w / 2) / CANVAS_W - 0.5, 4),
            "dy": round((y0 + h / 2) / CANVAS_H - 0.5, 4),
            "w": round(w / CANVAS_W, 4),
            "h": round(h / CANVAS_H, 4),
        }

    print(f"helmet {helmet.size} -> {helmet_w}x{helmet_h} at ({helmet_x:.1f},{helmet_y:.1f})")
    print(f"head   {head_im.size} -> {head_w:.1f}x{head_h:.1f} at ({hx0:.1f},{hy0:.1f})"
          f"  squeezed to {squeeze:.3f} of its natural aspect")
    f = frac_box(hx0, hy0, head_w, head_h)
    print(f"const HEAD = {{ dx: {f['dx']}, dy: {f['dy']}, w: {f['w']}, h: {f['h']} }};")

    names = ("coil_eye_r.webp", "coil_eye_l.webp")  # sorted left-to-right on screen
    consts = ("EYE_R", "EYE_L")
    eye_boxes = []
    for name, const, (im, box) in zip(names, consts, eye_ims):
        # x and y scale separately: the head is squeezed, so an eye scaled uniformly would sit
        # right of where its socket ended up.
        ex = hx0 + box[0] * head_sx
        ey = hy0 + box[1] * head_sy
        ew = (box[2] - box[0]) * head_sx
        eh = (box[3] - box[1]) * head_sy
        im.resize((max(1, round(ew)), max(1, round(eh))), Image.LANCZOS).save(
            OUT / name, lossless=True, method=6
        )
        eye_boxes.append((ex, ey, ew, eh, name))
        g = frac_box(ex - (hx0 + head_w / 2) + CANVAS_W / 2,
                     ey - (hy0 + head_h / 2) + CANVAS_H / 2, ew, eh)
        print(f"const {const} = {{ dx: {g['dx']}, dy: {g['dy']}, w: {g['w']}, h: {g['h']} }};")
    print(f"eyes may drift up to {EYE_SAFE:.2f} of the symbol box before the fill shows")

    # --- proof ------------------------------------------------------------------------------------
    # Assembled beside the design, both at the same height. Every rebuild in this app has been
    # wrong at least once in a way only this picture caught.
    built = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    built.alpha_composite(plate)
    built.alpha_composite(head_out, (round(hx0), round(hy0)))
    for ex, ey, ew, eh, name in eye_boxes:
        built.alpha_composite(Image.open(OUT / name).convert("RGBA"), (round(ex), round(ey)))

    ref = Image.open(SRC / "design_ref.png").convert("RGBA")
    ref = ref.resize((round(ref.size[0] * CANVAS_H / ref.size[1]), CANVAS_H), Image.LANCZOS)
    sheet = Image.new("RGBA", (CANVAS_W + ref.size[0] + 24, CANVAS_H), (18, 12, 40, 255))
    sheet.alpha_composite(built, (0, 0))
    sheet.alpha_composite(ref, (CANVAS_W + 24, 0))
    sheet.resize((sheet.size[0] * 3, sheet.size[1] * 3), Image.LANCZOS).save(VERIFY)
    print(f"wrote {VERIFY.name}")


if __name__ == "__main__":
    main()
