#!/usr/bin/env python3
"""Cut the MOTHERSHIP PORTAL (H3) into its animatable layers.

    art-src/portal/ring.png         the blue segmented ring: plate, green arcs, pink side bumps
    art-src/portal/swirl.png        the purple galaxy orb that sits in the ring
    art-src/portal/pin_a..d.png     four pink knobs on stalks, one per corner
    art-src/portal/design_ref.png   the ASSEMBLED lockup, inside a blue frame stroke
    art-src/portal/alien.svg        the alien silhouette -- FLAT green, no outline, unused (see below)
    art-src/portal/eye.svg          the eye -- unused, the reference's own eye is sharper at this size

Outputs onto the shared 328x264 symbol canvas:

    portal.webp / _mobile.webp      four pins UNDER the ring, with the ring's hole punched back out
    portal_core.webp                the orb, on its own so it can spin
    portal_head.webp                the alien head, eye included
    portal_antenna_l/r.webp         one antenna each, so they can wobble

THE THREE THINGS WORTH KNOWING
------------------------------

1. THE ORB IS BIGGER THAN THE HOLE IT SHOWS THROUGH. In the design you can only see the part of it
   framed by the ring, so its diameter cannot be measured there -- the visible disc is the HOLE, not
   the orb. Ring and orb were drawn side by side in one source image at a matched scale, so the orb
   is placed at the RING's scale, concentric with the ring's hole. The assertion below checks the
   two facts that make that placement invisible: the orb must be wider than the hole (or a gap opens
   at the rim) and narrower than the ring's outer edge (or it spills out past the ring).

   That is also why the base texture punches the ring's hole back out after compositing: the pins'
   stalks are long enough to cross the middle, and everything inside the hole belongs to the orb.

2. THE PINS ARE ANCHORED ON THEIR BALLS, NOT THEIR BOXES. Each pin ships as a ball on a very long
   stalk -- pin_c is 315x1095 -- and almost all of that stalk is hidden under the ring band. Its
   bounding box therefore says nothing about where it goes. The ball is a disc of known radius in
   both images, so that is what gets matched. Which pin belongs in which corner is likewise not
   assumed: the stalk points at the ring's centre, so the direction from ball to stalk picks the
   corner, and all 24 assignments are scored so a mismatch is an error rather than a guess.

3. THE ALIEN IS CUT FROM THE REFERENCE, NOT FROM ITS SVG. alien.svg is a single flat #ADFA2C path:
   no outline, no shading, and head and antennae fused into one shape. The reference has all three.
   It can be cut at 1:1 here because the lockup is nearly canvas-sized already -- the head lands at
   ~56px on a 328px canvas and the reference draws it at ~54px -- so there is no upscale to pay for.
   Edges come off the grey page by matting (alpha from the distance to the page colour, then
   un-premultiplied), which is what keeps a light fringe off the outline on a dark board.

Run:  python3 scripts/build-portal-art.py
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art-src" / "portal"
OUT = ROOT / "static" / "assets" / "components" / "symbols" / "magnetic" / "premium"
VERIFY = SRC / "verify_portal.png"
PREVIEW = SRC / "preview_portal_layers.png"

CANVAS_W, CANVAS_H = 328, 264

# The reference's frame: a blue stroke on a near-white page.
STROKE = np.array([56, 136, 224])
PAGE = np.array([240, 240, 240])
FRAME_INSET = 4

# Matting against the page: fully opaque once a pixel is this far from the page colour.
MATTE_SPAN = 70.0
# How far past the alien's green body to cut, in reference pixels, so the head keeps its outline.
HEAD_OUTLINE = 2.5
# How far to grow the alien's green body to catch its outline before splitting off the antennae.
ALIEN_GROW = 3


def die(msg: str):
    sys.exit(f"build-portal-art: {msg}")


def load(name):
    im = Image.open(SRC / name).convert("RGBA")
    a = np.asarray(im).astype(int)
    return im, a[:, :, :3], a[:, :, 3] > 128


def keys(rgb):
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    return {
        # The ring's periwinkle plate. G is what separates it from every purple in the symbol:
        # the orb and the pin stalks are the same blue but far greener-poor.
        "ringblue": (r > 35) & (r < 175) & (g > 85) & (g < 205) & (b > 175),
        "purple": (b > 175) & (g < 58) & (r > 25) & (r < 215),
        "pink": (r > 195) & (g > 40) & (g < 200) & (b > 195),
        "green": (g > 170) & (r > 110) & (r < 225) & (b < 140),
    }


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


def mask_of(pts, shape):
    m = np.zeros(shape, bool)
    m[pts[:, 0], pts[:, 1]] = True
    return m


def denoise(mask, min_area, what):
    """Drop specks. At reference scale the antialiasing between two parts leaves stray pixels that
    are the right colour and nowhere near the thing being measured -- three of them at the top of
    the ring stretch its bounding box by 30px."""
    c = components(mask, min_area)
    if not c:
        die(f"{what} is empty")
    out = np.zeros_like(mask, bool)
    for pts in c:
        out |= mask_of(pts, mask.shape)
    return out


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


def box_of(mask, what):
    ys = np.where(mask.any(1))[0]
    xs = np.where(mask.any(0))[0]
    if not len(ys):
        die(f"{what} is empty")
    return (int(xs[0]), int(ys[0]), int(xs[-1] + 1), int(ys[-1] + 1))


def widest_disc(mask, what):
    """Centre and radius of a disc, from its WIDEST ROW. For a circle that row IS the diameter, and
    unlike a least-squares fit it needs no well-conditioned arc to be exact."""
    rows = [(np.where(mask[y])[0], y) for y in range(mask.shape[0]) if mask[y].any()]
    if not rows:
        die(f"{what} is empty")
    xs, y = max(rows, key=lambda t: t[0].max() - t[0].min())
    return ((xs.min() + xs.max() + 1) / 2, y + 0.5, (xs.max() + 1 - xs.min()) / 2)


def inscribed_disc(mask, what):
    """The largest disc that fits inside a mask: its centre, and its radius.

    Used for the alien's head, where neither row measure works. Its widest ROW is the one through
    the two antenna knobs -- two blobs 14px across, 54px apart, which read as one 54px disc floating
    above the head. Its longest RUN finds the head but puts the centre on the widest row, and the
    head's widest row is two pixels off its centre, which is enough for its lower arc to survive the
    cut as a third antenna. The largest inscribed disc is exact on both counts, and the antennae
    cannot win it: a knob is 7px across where the head is 23."""
    ys, xs = np.where(mask)
    if not len(ys):
        die(f"{what} is empty")
    edge = ~mask & grow(mask, 1)
    ey, ex = np.where(edge)
    best = (0.0, 0.0, 0.0)
    for y, x in zip(ys, xs):
        d = np.hypot(ex - x, ey - y).min()
        if d > best[0]:
            best = (d, x + 0.5, y + 0.5)
    return (best[1], best[2], best[0])


def interior_hole(alpha, what):
    """The transparent region enclosed by a ring, flood-filled from its centre."""
    h, w = alpha.shape
    start = (h // 2, w // 2)
    if alpha[start]:
        die(f"{what}: the middle is not transparent, so this is not a ring")
    seen = np.zeros_like(alpha, bool)
    seen[start] = True
    stack = [start]
    while stack:
        y, x = stack.pop()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not alpha[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                stack.append((ny, nx))
    if seen[0].any() or seen[-1].any() or seen[:, 0].any() or seen[:, -1].any():
        die(f"{what}: the flood escaped to the edge -- the ring is not closed")
    return seen


def matte(rgb, keep):
    """Alpha and colour for a part cut off the reference's page.

    `keep` is where the part definitely IS -- its own mask, pulled in from its edge. There the pixel
    is opaque and untouched. Everywhere else alpha comes from the distance to the page colour and
    the page is divided back out, so an antialiased edge does not carry a light fringe onto a dark
    board.

    The page must not get a vote inside the part, which is the trap: the alien's eye is WHITE, 15
    units from the page colour, so a matte applied everywhere makes the eye 80% transparent and the
    alien looks like it has a hole in its face."""
    a = np.where(keep, 1.0, np.clip(np.abs(rgb - PAGE).max(2) / MATTE_SPAN, 0, 1))
    safe = np.maximum(a, 1e-3)[:, :, None]
    col = np.where(keep[:, :, None], rgb, np.clip((rgb - (1 - safe) * PAGE) / safe, 0, 255))
    return a, col


def rgba(col, alpha):
    out = np.zeros(col.shape[:2] + (4,), np.uint8)
    out[:, :, :3] = col.astype(np.uint8)
    out[:, :, 3] = np.clip(alpha * 255, 0, 255).astype(np.uint8)
    return Image.fromarray(out)


def main():
    # --- the reference, cropped to the design's own page ------------------------------------------
    ref_full = Image.open(SRC / "design_ref.png").convert("RGB")
    st = np.abs(np.asarray(ref_full).astype(int) - STROKE).sum(2) < 78
    fb = box_of(denoise(st, 200, "the reference's frame stroke"), "frame stroke")
    ref_im = ref_full.crop((fb[0] + FRAME_INSET, fb[1] + FRAME_INSET,
                            fb[2] - FRAME_INSET, fb[3] - FRAME_INSET))
    ref = np.asarray(ref_im).astype(int)
    RW, RH = ref_im.size
    RK = keys(ref)

    # --- 1. the ring, anchored on its plate's outer extent -----------------------------------------
    # Its LEFT, RIGHT and BOTTOM extremes, never its top: the alien's head sits over 12 o'clock and
    # takes ~50px off the ring's height in the reference while leaving its width untouched.
    ring_im, ring_rgb, ring_a = load("ring.png")
    ring_plate = denoise(keys(ring_rgb)["ringblue"] & ring_a, 80, "the ring's plate")
    ref_plate = denoise(RK["ringblue"], 40, "the ring's plate in the reference")
    pb, rb = box_of(ring_plate, "ring plate"), box_of(ref_plate, "ref plate")
    ring_scale = (rb[2] - rb[0]) / (pb[2] - pb[0])
    ring_x = rb[0] - pb[0] * ring_scale
    ring_y = rb[3] - pb[3] * ring_scale
    ring_box = (ring_x, ring_y,
                ring_x + ring_im.width * ring_scale, ring_y + ring_im.height * ring_scale)
    ring_cx = (rb[0] + rb[2]) / 2
    ring_r = (rb[2] - rb[0]) / 2
    ring_cy = rb[3] - ring_r
    print(f"ring scale {ring_scale:.5f} at ({ring_x:.1f}, {ring_y:.1f})  "
          f"centre ({ring_cx:.1f}, {ring_cy:.1f}) r {ring_r:.1f}")

    # --- 2. the orb, matched to the swirl the reference shows through the hole ----------------------
    # No measurement will do here: every edge of the orb is behind the ring band, so its visible disc
    # is the HOLE's diameter no matter how big the orb is. What IS visible is the swirl, and the
    # swirl only lines up at one scale -- too big and the arms sweep wide and blunt, too small and
    # they crowd the middle. So the fit is a search: place the orb, compare it with the reference
    # pixel by pixel inside the aperture, and keep the best.
    #
    # Placing it at the ring's own scale, on the reasoning that ring and orb were drawn side by side
    # in one source image, gives an orb ~25% too wide. They were not drawn to be assembled 1:1.
    hole = interior_hole(ring_a, "the ring")
    hb = box_of(hole, "the ring's hole")
    hole_r = (hb[2] - hb[0]) / 2 * ring_scale
    orb_im, orb_rgb, orb_a = load("swirl.png")
    ocx, ocy, orb_r_src = widest_disc(denoise(keys(orb_rgb)["purple"] & orb_a, 400, "the orb"),
                                      "the orb")
    hole_cx = ring_x + (hb[0] + hb[2]) / 2 * ring_scale
    hole_cy = ring_y + (hb[1] + hb[3]) / 2 * ring_scale

    hole_im = Image.fromarray((hole * 255).astype(np.uint8), "L").resize(
        (max(1, round(ring_im.width * ring_scale)), max(1, round(ring_im.height * ring_scale))),
        Image.LANCZOS)
    aperture = Image.new("L", (RW, RH), 0)
    aperture.paste(hole_im, (round(ring_x), round(ring_y)))
    # Only the aperture's own antialiased boundary is dropped. Pulling further in would stop the
    # comparison from seeing the orb's rim, and then any orb at least as wide as the hole scores the
    # same -- the search settles on the smallest one that covers the region it is allowed to look at.
    inside = shrink(np.asarray(aperture) > 200, 2)
    if inside.sum() < 500:
        die("the ring's aperture is too small to match the orb through")

    def orb_error(scale, cx, cy):
        w = max(1, round(orb_im.width * scale))
        h = max(1, round(orb_im.height * scale))
        layer = Image.new("RGB", (RW, RH), tuple(PAGE))
        layer.paste(orb_im.resize((w, h), Image.LANCZOS),
                    (round(cx - ocx * scale), round(cy - ocy * scale)),
                    orb_im.resize((w, h), Image.LANCZOS))
        return float(np.abs(np.asarray(layer).astype(int) - ref)[inside].mean())

    best = min(((orb_error(s, hole_cx, hole_cy), s) for s in np.arange(0.24, 0.52, 0.01)))
    orb_scale, orb_cx, orb_cy = best[1], hole_cx, hole_cy
    for step, span in ((0.002, 0.012), (0.0005, 0.003)):
        cand = [(orb_error(s, orb_cx + dx, orb_cy + dy), s, orb_cx + dx, orb_cy + dy)
                for s in np.arange(orb_scale - span, orb_scale + span + 1e-9, step)
                for dx in (-1.5, 0, 1.5) for dy in (-1.5, 0, 1.5)]
        _, orb_scale, orb_cx, orb_cy = min(cand)
    orb_r = orb_r_src * orb_scale
    if not hole_r * 0.95 < orb_r < ring_r:
        die(f"the best orb match is {orb_r:.1f}px in radius, which does not sit between the ring's "
            f"hole ({hole_r:.1f}) and its outer edge ({ring_r:.1f}) -- at that size the orb either "
            f"leaves a gap at the rim or spills out past the ring")
    orb_box = (orb_cx - ocx * orb_scale, orb_cy - ocy * orb_scale,
               orb_cx + (orb_im.width - ocx) * orb_scale,
               orb_cy + (orb_im.height - ocy) * orb_scale)
    print(f"orb scale {orb_scale:.4f} (ring's is {ring_scale:.4f})  r {orb_r:.1f} between hole "
          f"{hole_r:.1f} and rim {ring_r:.1f}, centred ({orb_cx:.1f}, {orb_cy:.1f})")

    # --- 3. the four pins, anchored on their balls -------------------------------------------------
    # The reference's pink is the four balls, the ring's own two side bumps, and the orb's pink
    # arms. Only the balls sit clear of the ring, so anything overlapping the ring's disc is not one.
    ref_pink = RK["pink"]
    balls = []
    for pts in components(ref_pink, 60):
        m = mask_of(pts, ref_pink.shape)
        cx, cy, r = widest_disc(m, "a pink blob")
        if np.hypot(cx - ring_cx, cy - ring_cy) < ring_r:
            continue
        balls.append((cx, cy, r))
    if len(balls) != 4:
        die(f"found {len(balls)} pink balls clear of the ring, expected 4")

    pins = {}
    for tag in "abcd":
        im, rgb, a = load(f"pin_{tag}.png")
        ball = denoise(keys(rgb)["pink"] & a, 200, f"pin_{tag}'s ball")
        cx, cy, r = widest_disc(ball, f"pin_{tag}'s ball")
        stalk = a & ~mask_of(components(ball)[0], a.shape)
        ys, xs = np.where(stalk)
        if not len(ys):
            die(f"pin_{tag} is a ball with no stalk")
        # Unit vector from the ball towards the stalk. The stalk points at the ring's centre, so
        # this is the reverse of the direction the pin sits in.
        v = np.array([xs.mean() - cx, ys.mean() - cy])
        pins[tag] = dict(im=im, alpha=a, cx=cx, cy=cy, r=r, dir=v / np.linalg.norm(v))

    # Score every assignment rather than trusting one greedy pass -- 24 of them, and a wrong corner
    # is the kind of mistake that still looks like a portal.
    from itertools import permutations
    def score(order):
        s = 0.0
        for tag, (bx, by, _) in zip(order, balls):
            want = np.array([ring_cx - bx, ring_cy - by])
            want /= np.linalg.norm(want)
            s += float(pins[tag]["dir"] @ want)
        return s
    best = max(permutations("abcd"), key=score)
    if score(best) < 3.4:
        die(f"no assignment of the four pins to the four corners agrees on direction "
            f"(best {score(best):.2f} of 4.0) -- the stalks are not pointing where they should")

    pin_boxes = {}
    for tag, (bx, by, br) in zip(best, balls):
        p = pins[tag]
        s = br / p["r"]
        crop = box_of(p["alpha"], f"pin_{tag}")
        x0 = bx - (p["cx"] - crop[0]) * s
        y0 = by - (p["cy"] - crop[1]) * s
        pin_boxes[tag] = (x0, y0, x0 + (crop[2] - crop[0]) * s, y0 + (crop[3] - crop[1]) * s)
        p["crop"] = crop
        corner = ("top" if by < ring_cy else "bottom") + ("-left" if bx < ring_cx else "-right")
        print(f"pin_{tag} -> {corner:12s} scale {s:.4f}  ball r {br:.1f}")

    # --- 4. the alien, cut out of the reference ----------------------------------------------------
    # The alien and the ring's eight arcs are the same green. They are told apart by height, not by
    # subtracting the ring: the alien reaches higher than anything else in the lockup, and it is one
    # connected blob -- head, both stalks, both knobs -- because the stalks meet the head's crown.
    greens = [pts for pts in components(RK["green"], 200)]
    if not greens:
        die("no green large enough to be the alien")
    alien_green = mask_of(min(greens, key=lambda p: p[:, 0].min()), (RH, RW))
    ab = box_of(alien_green, "the alien")
    if ab[1] >= ring_cy - ring_r:
        die(f"the topmost green starts at y={ab[1]}, below the ring's crown "
            f"({ring_cy - ring_r:.0f}) -- that is a ring arc, not the alien")
    # Fill the eye before measuring. It is a hole punched clean through the head's green, so the
    # head's own rows read as two crescents 10px wide and the head measures a third of its size.
    solid = ~mask_of(components(~alien_green)[0], (RH, RW))
    hx, hy, hr = inscribed_disc(solid, "the alien's head")
    yy, xx = np.mgrid[0:RH, 0:RW]
    dist = np.hypot(xx + 0.5 - hx, yy + 0.5 - hy)
    outline = grow(alien_green, ALIEN_GROW)

    # Where to cut the head off its antennae. Not a fixed radius: the head is drawn a little wider
    # than the largest disc that fits inside it, so cutting at the inscribed radius leaves a crescent
    # of the head's own lower arc standing outside the cut, which then comes back joined to an
    # antenna as a 53px-tall "antenna". Instead, open the cut outward until the alien splits into
    # exactly two pieces and both of them sit above the head's centre -- that radius IS the neck.
    cut_r = None
    for r in np.arange(hr, hr + 10, 0.25):
        pieces = components(outline & (dist > r), 40)
        if len(pieces) == 2 and all(p[:, 0].max() < hy for p in pieces):
            cut_r = float(r)
            break
    if cut_r is None:
        die("no cut radius splits the alien into exactly two antennae above its head")
    ant_parts = []
    for pts in components(outline & (dist > cut_r), 40):
        m = mask_of(pts, (RH, RW))
        a, col = matte(ref, shrink(m, 2))
        ant_parts.append((box_of(m, "an antenna"), np.where(m, a, 0.0), col))
    ant_parts.sort(key=lambda t: t[0][0])

    # The head keeps everything inside the neck bar the growth ring, so it ends on its own outline.
    head_r = cut_r - ALIEN_GROW + HEAD_OUTLINE
    head_a, head_col = matte(ref, dist < head_r - 2)
    # A soft edge, not a binary one: at this size a hard circular cut is visibly stepped.
    head_alpha = np.minimum(np.clip(head_r + 0.5 - dist, 0, 1), head_a)
    head_box = (hx - head_r, hy - head_r, hx + head_r, hy + head_r)
    print(f"alien head centre ({hx:.1f}, {hy:.1f}) r {hr:.1f}, neck {cut_r:.2f}, cut at {head_r:.1f}")
    for i, (b, *_) in enumerate(ant_parts):
        print(f"antenna {'LR'[i]} box {b}")

    # --- 5. everything is in reference coordinates; fit it to the canvas ---------------------------
    boxes = {
        "ring": ring_box,
        "orb": orb_box,
        "head": head_box,
        "antL": tuple(float(v) for v in ant_parts[0][0]),
        "antR": tuple(float(v) for v in ant_parts[1][0]),
        **{f"pin{t}": b for t, b in pin_boxes.items()},
    }
    # The ring's BOX is its whole file including transparent margin; what has to fit on the canvas
    # is the ink, so the ring contributes its plate's extent plus its own outline instead.
    ink = dict(boxes)
    ink["ring"] = (ring_x + (box_of(ring_a, "ring alpha")[0]) * ring_scale,
                   ring_y + (box_of(ring_a, "ring alpha")[1]) * ring_scale,
                   ring_x + (box_of(ring_a, "ring alpha")[2]) * ring_scale,
                   ring_y + (box_of(ring_a, "ring alpha")[3]) * ring_scale)
    content = (min(b[0] for b in ink.values()), min(b[1] for b in ink.values()),
               max(b[2] for b in ink.values()), max(b[3] for b in ink.values()))
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
    base = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    for tag in "abcd":
        p = pins[tag]
        base.alpha_composite(p["im"].crop(p["crop"]).resize(size_of(C[f"pin{tag}"]), Image.LANCZOS),
                             at(C[f"pin{tag}"]))
    base.alpha_composite(ring_im.resize(size_of(C["ring"]), Image.LANCZOS), at(C["ring"]))
    # Punch the ring's hole back out. The stalks are long enough to cross it, and everything inside
    # it belongs to the orb, which is drawn BEHIND this texture.
    hole_im = Image.fromarray((hole * 255).astype(np.uint8), "L").resize(
        size_of(C["ring"]), Image.LANCZOS)
    punch = Image.new("L", (CANVAS_W, CANVAS_H), 0)
    punch.paste(hole_im, at(C["ring"]))
    ba = np.asarray(base).copy()
    ba[:, :, 3] = np.minimum(ba[:, :, 3], 255 - np.asarray(punch))
    base = Image.fromarray(ba)
    base.save(OUT / "portal.webp", lossless=True, method=6)
    base.resize((CANVAS_W // 2, CANVAS_H // 2), Image.LANCZOS).save(
        OUT / "portal_mobile.webp", lossless=True, method=6
    )

    orb_im.resize(size_of(C["orb"]), Image.LANCZOS).save(
        OUT / "portal_core.webp", lossless=True, method=6)
    rgba(head_col, head_alpha).crop(tuple(round(v) for v in head_box)).resize(
        size_of(C["head"]), Image.LANCZOS).save(OUT / "portal_head.webp", lossless=True, method=6)
    for i, (b, a, col) in enumerate(ant_parts):
        rgba(col, a).crop(b).resize(size_of(C["antL" if i == 0 else "antR"]),
                                    Image.LANCZOS).save(
            OUT / f"portal_antenna_{'lr'[i]}.webp", lossless=True, method=6)

    # --- 7. the placements the component needs -----------------------------------------------------
    def frac(b):
        cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        return (f"{{ dx: {(cx - CANVAS_W / 2) / CANVAS_W:.4f}, dy: {(cy - CANVAS_H / 2) / CANVAS_H:.4f}, "
                f"w: {(b[2] - b[0]) / CANVAS_W:.4f}, h: {(b[3] - b[1]) / CANVAS_H:.4f} }}")

    print(f"\nfit {fit:.4f}  content {tuple(round(v, 2) for v in content)}\n")
    for key, const in (("orb", "CORE"), ("head", "HEAD"),
                       ("antL", "ANTENNA_L"), ("antR", "ANTENNA_R")):
        print(f"const {const} = {frac(C[key])};")
    # Where each antenna meets the head, as a fraction of its own box: the point it rotates about.
    for i, (b, *_) in enumerate(ant_parts):
        m = np.zeros((RH, RW), bool)
        m[b[1]:b[3], b[0]:b[2]] = True
        seam = m & (np.abs(dist - cut_r) < 2.5) & outline
        ys, xs = np.where(seam)
        if not len(ys):
            die(f"antenna {'LR'[i]} never touches the head -- it cannot pivot on it")
        px = (xs.mean() + 0.5 - b[0]) / (b[2] - b[0])
        py = (ys.mean() + 0.5 - b[1]) / (b[3] - b[1])
        print(f"const PIVOT_{'LR'[i]} = {{ x: {px:.4f}, y: {py:.4f} }};")

    # --- 8. verify: the assembly next to the design, every run -------------------------------------
    full = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    full.alpha_composite(Image.open(OUT / "portal_core.webp").convert("RGBA"), at(C["orb"]))
    full.alpha_composite(base)
    for i in range(2):
        full.alpha_composite(
            Image.open(OUT / f"portal_antenna_{'lr'[i]}.webp").convert("RGBA"),
            at(C["antL" if i == 0 else "antR"]))
    full.alpha_composite(Image.open(OUT / "portal_head.webp").convert("RGBA"), at(C["head"]))

    ref_fit = ref_im.copy()
    ref_fit.thumbnail((CANVAS_W, CANVAS_H), Image.LANCZOS)
    sheet = Image.new("RGBA", (CANVAS_W * 2, CANVAS_H), (150, 150, 165, 255))
    sheet.paste(ref_fit, ((CANVAS_W - ref_fit.width) // 2, (CANVAS_H - ref_fit.height) // 2))
    sheet.alpha_composite(full, (CANVAS_W, 0))
    sheet.resize((CANVAS_W * 4, CANVAS_H * 2), Image.NEAREST).convert("RGB").save(VERIFY)

    strip = Image.new("RGBA", (CANVAS_W * 4, CANVAS_H), (40, 40, 55, 255))
    strip.alpha_composite(base, (0, 0))
    for i, (key, path) in enumerate((("orb", OUT / "portal_core.webp"),
                                     ("head", OUT / "portal_head.webp"),
                                     ("antL", OUT / "portal_antenna_l.webp"))):
        layer = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
        layer.alpha_composite(Image.open(path).convert("RGBA"), at(C[key]))
        strip.alpha_composite(layer, (CANVAS_W * (i + 1), 0))
    strip.convert("RGB").save(PREVIEW)
    print(f"\nverify -> {VERIFY.relative_to(ROOT)}   layers -> {PREVIEW.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
