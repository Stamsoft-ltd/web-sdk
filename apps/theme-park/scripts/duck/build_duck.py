#!/usr/bin/env python3
"""Cut the duck symbol into the pieces its animation moves, and measure where each one sits.

The duck arrived from Figma as loose drawings rather than as a picture: a body (7063:17957) with
EMPTY WHITE EYE SOCKETS, two irises to drop into them (7063:17959 big, 7063:17960 small), and two
wings (7057:8004 pointing left, 7057:8002 pointing right). Cut up like that it can be alive — the
eyes can glance about while the symbol just sits there, and the wing can beat when it wins.

Two things about the art decide the whole build, and both were measured, not assumed:

  1. The body ALREADY CARRIES ITS RIGHT WING, drawn raised and fanned out to the viewer's right, and
     carries NOTHING on its left: that flank is bare from the shoulder down. So only ONE of the two
     loose wing drawings is a part, and it is `wing-a` (7057:8004), AS DRAWN.

     The two drawings are a matched PAIR, not one wing and its mirror. `wing-b` fans up and to the
     right and is the wing already baked into the body; `wing-a` is smaller, fans down and to the
     left, and attaches at its upper right — which is a wing tucked at the near flank, and is
     exactly what the artist's reference duck has there.

     Two earlier builds got this wrong in opposite directions. The first fitted `wing-a` by area
     alone and put it at the rear, where it was hidden. The second read its downward fan as a TAIL,
     threw it out, and shipped `wing-b` mirrored instead — which gives the bird two raised wings and
     is what the duck went out with. The fit below settles it: `wing-a`, unmirrored, lands on the
     wing in the reference at 0.96 IoU, and no placement of `wing-b` comes close.

     The far wing being PAINTED ON is what shipped the duck with one wing beating and one wing
     riding along, and rolling the whole body to fake the second beat never read as a flap. So this
     build now CUTS the painted wing off the body and repairs the torso underneath — see
     `split_far_wing`. `wing-b` is still not the part: it is the same drawing, but re-fitting it
     costs a scale and an angle that the body's own pixels already know exactly.

  2. The sockets are eye WHITES, not holes. A border flood cannot reach them (they are enclosed by
     the head), which is what keeps them white — and white is what they are supposed to be.

Placement comes from the artist's assembled duck rather than from node boxes, because the parts'
Figma boxes are relative to their own frames and are all (0, 0). The body's silhouette lands on that
composition at 99.2%, so the fit is not a guess: it is the same drawing, found where it was drawn.
The wing is fitted to what is LEFT OVER once the body is laid on that composition, since the body
covers all but a sliver of it — see WING_SCALE for why that residue is the only honest target.

Iris travel is measured by CONTAINMENT, not by subtracting bounding boxes. A socket is an almond and
an iris is round, so the box difference would let the pupil poke out through a corner. Here every
candidate offset is tested for the iris ink staying inside the socket's white, and what survives is
the range the component is allowed to use.

    python3 scripts/duck/build_duck.py

Writes symbols/h2-duck-marquee.png (the rest pose, which is also what the board's spin trail
ghosts), the five loose pieces as webp, src/game/duckParts.ts, and verify_duck.png to eyeball.
"""

from collections import deque
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.pixi_place import sprite_place  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent / "source"
SYMBOL_DIR = ROOT / "static/assets/theme-park/v2/symbols"
TABLE = ROOT / "src/game/duckParts.ts"
VERIFY = Path(__file__).resolve().parent / "verify_duck.png"

FRAME = (448, 360)

# Figma's export paper. Always opaque, always this grey.
PAPER = np.array([245, 245, 245])
PAPER_TOL = 10

# Where the artist's own assembled duck puts each piece, found by fitting the loose drawings into it
# (see the module docstring). Body: scale, then top-left in the frame.
BODY_SCALE = 0.98
BODY_AT = (132, 42)

# The left wing: scale, rotation, and the top-left it would sit at unrotated.
#
# FITTED, not placed. The body hides most of this wing, so the thing to fit it to is the sliver that
# shows: the reference duck's silhouette MINUS the body's, which comes out as one clean 35x65 blob
# off the near flank. Sliding `wing-a` over that at every scale and angle and scoring the overlap of
# what would still be visible gives 0.96 IoU, and the wing it finds is the one the artist drew —
# essentially unturned, which is the tell that these two drawings are a pair rather than a mirror.
#
# The angle is why an earlier build could not make `wing-b` work here without help. That drawing
# fans the wrong way, so it had to be swung 35 degrees to pass for this one, and every later number
# was bent to accommodate the swing. Nothing is bent now.
WING_SCALE = 0.945
WING_ANGLE = -2  # degrees, counter-clockwise, as PIL rotates
WING_AT = (110, 191)

# How much of an iris may sit outside the eye white at the end of a glance. Measured, not chosen:
# at 0 the small eye cannot move at all (0x1 px), at 0.10 the pair roam 3x5 and 7x8, and past about
# 0.2 the pupil starts to clear the eyelid and read as a dot on the cheek.
SPILL = 0.10

# Which iris belongs in which socket. The two sockets are different sizes because the head is turned,
# so the pairing is forced: the big iris only fits the big socket.
EYES = [("left", "iris-small"), ("right", "iris-big")]

# ---------------------------------------------------------------------------------------------
# Taking the far wing off the body. All of these are in the TRIMMED, UNSCALED body's own pixels
# (226x309), which is the space the drawing was measured in; BODY_SCALE is applied afterwards.
#
# The cut is TRACED rather than found, and it has to be, because the artist did not draw a line to
# find: the wing's fan is outlined all the way round, but its root blends straight into the belly
# with no keyline at all — a flood fill of the torso runs into the wing and back out again.
#
# The trace does not have to find the wing's real edge, though, because FAR_WING_FEATHER fades that
# side of it out rather than cutting it. What it does have to do is contain the wing: anything of it
# left outside the polygon hangs in the sky once the torso underneath is rebuilt.
# It also has to clear the wing's ROOT on the inside, by more than the fade below is wide. The root
# feather is outlined like the rest of the fan, and a trace that runs down the middle of it takes the
# outline off and hands the fade a drawn edge to dissolve — the wing came back with its base blurred
# away the first time this was traced tight.
FAR_WING_CUT = [
    (212, 130), (226, 130), (226, 252), (196, 254), (182, 242), (170, 226), (159, 207), (151, 188),
    (156, 172), (163, 169), (166, 166), (170, 163), (176, 160), (189, 157), (195, 151), (200, 145),
    (204, 142), (208, 138),
]

# The body is erased over a WIDER region than the wing is taken from, by this many pixels inward,
# from this row down. A feather curl left a pixel inside the trace reads as a scar on the belly.
# Widening only the erase — not the cut — keeps the wing sprite the wing's size; stopping the
# widening above the belly keeps it off the head, whose edge is a few pixels further in up there.
FAR_WING_ERASE, FAR_WING_ERASE_FROM = 6, 182

# How far the wing's ROOT fades out, in pixels.
#
# The far wing is drawn IN FRONT of the body, because that is where the artist drew it: over the
# belly, with only its fan clear of the torso. Behind, the way the near wing goes, the rebuilt flank
# swallows everything but the feather tips and the bird ends up with a stub.
#
# In front, though, the traced edge at the root is a real edge, and it sweeps across the belly every
# beat. So it is faded instead of cut: a few pixels of ramp, over a join between two nearly identical
# yellows, and there is no edge there to catch at any angle. At rest the ramp lands back on the belly
# it was lifted from and cannot be seen at all.
FAR_WING_FEATHER = 6

# The rebuilt torso.
#
# ITS OUTLINE IS THE BIRD'S OWN LEFT FLANK, MIRRORED. That flank is bare from the shoulder down, so
# it is a complete, unoccluded drawing of the curve the wing hides, and the mirror is checked rather
# than assumed: `torso_axis` fits the axis on the rows BELOW the wing, where both flanks show, and
# it lands within a pixel or two down that whole stretch.
#
# Only the outline, though. The bird is lit from the upper left, so mirroring the left flank's
# COLOUR would carry its rim light across onto the shadow side and hang a bright crescent where the
# wing used to be. The colour is diffused in from the belly the cut leaves behind instead, with a
# falloff toward the new edge, and then the keyline is drawn on.
#
# Above the chest line the mirror stops meaning anything — over there the left silhouette is the
# BEAK — so the torso is capped by a quarter-ellipse shoulder that runs from the neck down to where
# the flank takes over: x, y of the neck end, then the half-axes out to the flank.
TORSO_SHOULDER = (156, 168, 40, 24)
# How the rebuilt flank darkens toward its edge: over this many pixels, down to this much of the
# diffused colour. Both are eyeballed against the belly's own shadow rim on the row below the wing.
TORSO_RIM, TORSO_RIM_SHADE = 9.0, 0.55
# The duck's keyline and the pale halo the Figma export leaves outside it, both sampled off the
# body's own left edge. Drawn along the rebuilt outline, since nothing in the art supplies one.
TORSO_KEYLINE, TORSO_HALO = (3, 3, 3, 255), (86, 85, 83, 255)

# The far wing's shoulder: the point it beats about, in the same body pixels. Chosen at the root
# rather than fitted — the root is a blend, so there is no overlap to take a centroid of — and what
# fixes it is the sweep rather than the rest pose: hung from here the wing folds down behind the
# belly and fans back up over the shoulder, and hung much further out it swings off the bird.
FAR_SHOULDER = (170, 186)
# What the far wing's throw is, as a fraction of the near wing's. It is FAR_FLAP / FLAP in
# <DuckSymbol>, and it is here only so the verify sheet swings both wings the way the game will.
# Under about half, and the far wing disappears behind the belly for half of every beat.
FAR_SHARE = 0.425


def keyed(path):
    """Load a Figma export and drop its paper, reaching in from the border only.

    Flooding from the border is what saves the eye sockets: they are white, but they are enclosed by
    the head, so the flood never gets to them. A blanket white key would delete the duck's eyes.
    """
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(int)
    h, w, _ = rgb.shape
    paper = np.abs(rgb - PAPER).max(axis=2) <= PAPER_TOL

    seen = np.zeros((h, w), bool)
    queue = deque()
    border = [(y, x) for y in range(h) for x in (0, w - 1)]
    border += [(y, x) for x in range(w) for y in (0, h - 1)]
    for y, x in border:
        if paper[y, x] and not seen[y, x]:
            seen[y, x] = True
            queue.append((y, x))
    while queue:
        y, x = queue.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and paper[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                queue.append((ny, nx))

    alpha = np.where(seen, 0, 255)
    return Image.fromarray(np.dstack([rgb, alpha]).astype(np.uint8), "RGBA")


def trimmed_box(part):
    """The box the drawing actually occupies, without the export's transparent margin."""
    ink = np.asarray(part)[..., 3] > 0
    ys, xs = np.nonzero(ink)
    return (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)


def trimmed(part):
    """The drawing without the export's transparent margin, which is not part of the art."""
    return part.crop(trimmed_box(part))


def scaled(part, factor):
    return part.resize((round(part.width * factor), round(part.height * factor)), Image.LANCZOS)


def runs(mask):
    """Every 4-connected True region, largest first, as (area, x0, y0, x1, y1)."""
    h, w = mask.shape
    seen = np.zeros((h, w), bool)
    found = []
    for sy, sx in zip(*np.nonzero(mask)):
        if seen[sy, sx]:
            continue
        stack = [(sy, sx)]
        seen[sy, sx] = True
        cells = []
        while stack:
            y, x = stack.pop()
            cells.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        ys = [c[0] for c in cells]
        xs = [c[1] for c in cells]
        found.append((len(cells), min(xs), min(ys), max(xs), max(ys)))
    found.sort(reverse=True)
    return found



def grown(mask, radius):
    """`mask` spread by `radius` pixels, 4-connected."""
    out = mask.copy()
    for _ in range(radius):
        step = out.copy()
        step[1:] |= out[:-1]
        step[:-1] |= out[1:]
        step[:, 1:] |= out[:, :-1]
        step[:, :-1] |= out[:, 1:]
        out = step
    return out


def polygon(points, shape):
    mask = Image.new("L", (shape[1], shape[0]), 0)
    ImageDraw.Draw(mask).polygon([(float(x), float(y)) for x, y in points], fill=255)
    return np.asarray(mask) > 0


def rim_depth(mask):
    """How many pixels each pixel of `mask` is from falling off it — 99 where it is not."""
    depth = np.full(mask.shape, 99.0)
    left = mask.copy()
    for step in range(60):
        if not left.any():
            break
        padded = np.pad(left, 1)
        edge = left & ~(padded[:-2, 1:-1] & padded[2:, 1:-1] & padded[1:-1, :-2] & padded[1:-1, 2:])
        depth[edge] = step
        left = left & ~edge
    return depth


def steps_from(seed, region, limit):
    """How many 4-connected steps inside `region` each pixel is from `seed`, capped at `limit`."""
    reached = seed & region
    steps = np.where(reached, 0.0, float(limit))
    for step in range(1, limit + 1):
        found = grown(reached, 1) & region & ~reached
        steps[found] = step
        reached = reached | found
    return steps


def torso_axis(ink):
    """Twice the x the torso is symmetric about, fitted where BOTH flanks are on show.

    Only the rows below the wing qualify, which is the point: they are the one stretch of this
    drawing where the answer can be checked rather than asserted, and the fit comes out flat across
    all of them. An integer so that mirroring is an index flip and invents no pixels.
    """
    rows = range(236, 266)
    best = None
    for candidate in range(190, 230):
        miss = np.mean([
            abs((candidate - np.nonzero(ink[y])[0].min()) - np.nonzero(ink[y])[0].max())
            for y in rows
        ])
        if best is None or miss < best[0]:
            best = (miss, candidate)
    return best[1], best[0]


def split_far_wing(body):
    """The body with its painted wing taken off and the torso closed up, and the wing itself.

    Returns `(core, wing)` on the body's own canvas, so every number measured against the body still
    means what it meant. See FAR_WING_CUT and TORSO_SHOULDER for what each step is standing on.
    """
    art = np.asarray(body).astype(np.float64)
    ink = art[..., 3] > 128
    shape = ink.shape

    axis2, miss = torso_axis(ink)
    print(f"torso mirrors about x={axis2 / 2:.1f} — the flank below the wing lands {miss:.1f} px out")

    cut = polygon(FAR_WING_CUT, shape)
    below = np.arange(shape[0])[:, None] >= FAR_WING_ERASE_FROM
    erase = grown(cut, 3) | (polygon([(x - FAR_WING_ERASE, y) for x, y in FAR_WING_CUT], shape) & below)

    columns = axis2 - np.arange(shape[1])
    inside = (columns >= 0) & (columns < shape[1])
    mirrored = np.zeros_like(art)
    mirrored[:, inside] = art[:, columns[inside]]

    sx, sy, sa, sb = TORSO_SHOULDER
    arc = [(sx + sa * np.sin(t), sy + sb - sb * np.cos(t)) for t in np.linspace(0, np.pi / 2, 24)]
    cap = polygon(
        [(sx - 90, sy)] + arc + [(sx + sa + 60, sy + sb), (sx + sa + 60, shape[0]), (sx - 90, shape[0])],
        shape,
    )

    rebuilt = (mirrored[..., 3] > 128) & erase & cap
    kept = ink & ~erase
    torso = rebuilt | kept

    # Colour, diffused in from the belly that is left. The outer edge is deliberately NOT a boundary
    # condition: pinning it to the keyline pulls the whole repair dark and the flank comes out as a
    # smear. It is a free edge here, and the falloff below is what puts the shadow back.
    colour = np.where(kept[..., None], art, 0.0)
    colour[rebuilt] = art[kept].mean(axis=0)
    weight = torso.astype(np.float64)
    for _ in range(4000):
        total = np.zeros_like(colour)
        count = np.zeros(shape)
        total[1:] += colour[:-1] * weight[:-1][..., None]
        count[1:] += weight[:-1]
        total[:-1] += colour[1:] * weight[1:][..., None]
        count[:-1] += weight[1:]
        total[:, 1:] += colour[:, :-1] * weight[:, :-1][..., None]
        count[:, 1:] += weight[:, :-1]
        total[:, :-1] += colour[:, 1:] * weight[:, 1:][..., None]
        count[:, :-1] += weight[:, 1:]
        colour[rebuilt] = (total / np.maximum(count, 1)[..., None])[rebuilt]

    depth = rim_depth(torso)
    shade = TORSO_RIM_SHADE + (1 - TORSO_RIM_SHADE) * np.clip(depth / TORSO_RIM, 0, 1)
    colour[rebuilt] = (colour * shade[..., None])[rebuilt]

    keyline = torso & grown(~torso, 2) & grown(erase, 1)
    halo = ~torso & grown(torso, 1) & grown(erase, 2)
    colour[keyline] = TORSO_KEYLINE
    colour[halo] = TORSO_HALO
    colour[..., 3] = np.where(torso | halo, 255.0, 0.0)

    wing = np.zeros_like(art)
    wing[cut] = art[cut]
    # Fade the root rather than ending it. The root is every cut pixel that had more body beyond it;
    # the fan's own outline had nothing beyond it and is left alone.
    root = cut & grown(ink & ~cut, 1)
    wing[..., 3] *= np.clip(steps_from(root, cut, FAR_WING_FEATHER) / FAR_WING_FEATHER, 0, 1)

    print(f"far wing {int(cut.sum())} px cut, {int(root.sum())} px of it faded at the root; "
          f"torso rebuilt over {int(rebuilt.sum())} px")
    return (Image.fromarray(np.clip(colour, 0, 255).astype(np.uint8), "RGBA"),
            Image.fromarray(np.clip(wing, 0, 255).astype(np.uint8), "RGBA"))


def draw_duck(canvas, wing, far, far_at, body, eyes, ax, ay, shoulder, beat=0.0, glance=(0, 0)):
    """One duck, drawn exactly as <DuckSymbol> draws it.

    Near wing behind, then the body, then the far wing OVER it, then the irises — which is the order
    the artist drew them in. The far wing lies across the belly and only its fan is clear of the
    torso, so putting it behind leaves a stub.

    `beat` is the NEAR wing's swing in radians. The far one takes FAR_SHARE of it and takes it the
    other way round, because that wing is raised and the near one hangs: turning them both the same
    way drops one while the other lifts, and the bird rows instead of flying.
    """
    sprite_place(canvas, wing, cx=shoulder[0], cy=shoulder[1],
                 width=wing.width, height=wing.height, anchor=(ax, ay),
                 rotation=-np.radians(WING_ANGLE) + beat)
    sprite_place(canvas, body, cx=BODY_AT[0] + body.width / 2, cy=BODY_AT[1] + body.height / 2)
    sprite_place(canvas, far, cx=far_at["x"], cy=far_at["y"], width=far.width, height=far.height,
                 anchor=(far_at["ax"], far_at["ay"]), rotation=-FAR_SHARE * beat)
    for eye in eyes:
        sprite_place(canvas, eye["iris"],
                     cx=eye["x"] + glance[0] * eye["reach_x"],
                     cy=eye["y"] + glance[1] * eye["reach_y"])


def sockets(body):
    """The two eye whites, left one first.

    They are the largest white regions in the drawing by a wide margin — the next biggest is a
    highlight a fifth their size — so taking the top two is safe, and their order left to right is
    the order the eyes appear.
    """
    rgb = np.asarray(body)[..., :3].astype(int)
    ink = np.asarray(body)[..., 3] > 128
    white = ink & (rgb.min(axis=2) > 225)
    two = runs(white)[:2]
    return sorted(two, key=lambda r: r[1])


def travel(socket_mask, iris_ink, centre):
    """How far the iris may roam and still read as an eye, in pixels each way.

    A pupil is allowed to run under the eyelid — that is how a cartoon draws a glance, and demanding
    the iris stay wholly inside the white freezes the smaller eye solid (it has two pixels of slack
    across, and the socket is an almond, so the corners eat both). What is NOT allowed is the pupil
    leaving the eye far enough to read as a stray dot on the cheek, so the test is a budget: at most
    `SPILL` of the iris may sit outside the white.

    Grown outward from a standstill so the answer is one connected range rather than the largest
    offset that happens to work; an eye that could jump to a far corner but not to the near one would
    look broken.
    """
    ih, iw = iris_ink.shape
    cx, cy = centre
    budget = SPILL * iris_ink.sum()

    def fits(dx, dy):
        x0 = int(round(cx + dx - iw / 2))
        y0 = int(round(cy + dy - ih / 2))
        if x0 < 0 or y0 < 0 or y0 + ih > socket_mask.shape[0] or x0 + iw > socket_mask.shape[1]:
            return False
        return (iris_ink & ~socket_mask[y0:y0 + ih, x0:x0 + iw]).sum() <= budget

    reach_x = 0
    while fits(reach_x + 1, 0) and fits(-reach_x - 1, 0) and reach_x < 40:
        reach_x += 1
    reach_y = 0
    while fits(0, reach_y + 1) and fits(0, -reach_y - 1) and reach_y < 40:
        reach_y += 1
    return reach_x, reach_y


def main():
    parts = {stem: trimmed(keyed(SOURCE / f"{stem}.png")) for stem in
             ("body", "wing-a", "iris-big", "iris-small")}

    core, far_art = split_far_wing(parts["body"])
    # The core keeps the body's canvas rather than being re-trimmed, so BODY_AT and every eye
    # socket measured against the original drawing still land where they landed.
    body = scaled(core, BODY_SCALE)
    far_box = trimmed_box(far_art)
    far = scaled(far_art.crop(far_box), BODY_SCALE)
    far_at = {
        "x": BODY_AT[0] + FAR_SHOULDER[0] * BODY_SCALE,
        "y": BODY_AT[1] + FAR_SHOULDER[1] * BODY_SCALE,
        "ax": (FAR_SHOULDER[0] - far_box[0]) / (far_box[2] - far_box[0]),
        "ay": (FAR_SHOULDER[1] - far_box[1]) / (far_box[3] - far_box[1]),
    }
    print(f"far wing {far.width}x{far.height}, shoulder at "
          f"({far_at['ax']:.4f}, {far_at['ay']:.4f}) of it")

    wing = scaled(parts["wing-a"], WING_SCALE)
    turned = wing.rotate(WING_ANGLE, resample=Image.BICUBIC, expand=True)
    wing_at = (WING_AT[0] - (turned.width - wing.width) // 2,
               WING_AT[1] - (turned.height - wing.height) // 2)

    print(f"body {body.width}x{body.height} at {BODY_AT}")
    print(f"wing {wing.width}x{wing.height} at {WING_AT}, hung at {WING_ANGLE} degrees")

    # The shoulder: where the wing tucks under the body. Rotating about anything else swings the
    # whole wing out of the duck instead of beating it.
    body_ink = np.zeros(FRAME[::-1], bool)
    body_ink[BODY_AT[1]:BODY_AT[1] + body.height,
             BODY_AT[0]:BODY_AT[0] + body.width] = np.asarray(body)[..., 3] > 128
    wing_ink = np.zeros(FRAME[::-1], bool)
    wing_ink[wing_at[1]:wing_at[1] + turned.height,
             wing_at[0]:wing_at[0] + turned.width] = np.asarray(turned)[..., 3] > 128
    tucked = body_ink & wing_ink
    ys, xs = np.nonzero(tucked)
    shoulder = (xs.mean(), ys.mean())
    print(f"shoulder at ({shoulder[0]:.1f}, {shoulder[1]:.1f}) — {tucked.sum()} px of overlap")

    # The shoulder as a fraction of the UNROTATED wing, which is what a sprite anchor wants: undo
    # the placement and then the rotation, about the rotated art's own centre.
    #
    # UNDO, note — the INVERSE of the turn, not the turn again. In y-down image coordinates PIL's
    # rotation carries a point by [cos, sin; -sin, cos], so coming back the other way is
    # [cos, -sin; sin, cos]. This line used to pass `-angle` into the first of those, which is the
    # forward map spelled a second way: the anchor came out turned by 2x35 degrees instead of by 0,
    # and the wing hung off a point 70 degrees around the drawing from its shoulder. That is the
    # whole "duck with one wing" bug. Nothing else about the fit was ever wrong.
    angle = np.radians(WING_ANGLE)
    ox = shoulder[0] - (wing_at[0] + turned.width / 2)
    oy = shoulder[1] - (wing_at[1] + turned.height / 2)
    ax = (ox * np.cos(angle) - oy * np.sin(angle)) / wing.width + 0.5
    ay = (ox * np.sin(angle) + oy * np.cos(angle)) / wing.height + 0.5
    print(f"wing anchor ({ax:.4f}, {ay:.4f})")

    # Eyes. Sockets are measured on the SCALED body so the numbers are already in frame pixels.
    rgb = np.asarray(body)[..., :3].astype(int)
    ink = np.asarray(body)[..., 3] > 128
    white = ink & (rgb.min(axis=2) > 225)
    eyes = []
    for (side, iris_stem), (area, x0, y0, x1, y1) in zip(EYES, sockets(body)):
        iris = scaled(parts[iris_stem], BODY_SCALE)
        iris_ink = np.asarray(iris)[..., 3] > 128
        centre = ((x0 + x1 + 1) / 2, (y0 + y1 + 1) / 2)
        reach_x, reach_y = travel(white, iris_ink, centre)
        print(f"{side} socket {x1 - x0 + 1}x{y1 - y0 + 1} at {centre}, "
              f"{iris_stem} {iris.width}x{iris.height}, roams {reach_x}x{reach_y} px")
        eyes.append(dict(side=side, iris=iris,
                         x=BODY_AT[0] + centre[0], y=BODY_AT[1] + centre[1],
                         reach_x=reach_x, reach_y=reach_y))

    # The rest pose, which is both the still the spin trail ghosts and the picture the live symbol
    # settles back to. Wing behind, then body, then the irises in their sockets.
    #
    # Drawn from the EXPORTED numbers through sprite_place, not from the local variables the fit was
    # worked out in. The two should agree, and building the still this way is what proves they do:
    # if the table is wrong the still is wrong in the same way, visibly, here, instead of the game
    # being the only place the mistake shows.
    frame = Image.new("RGBA", FRAME, (0, 0, 0, 0))
    draw_duck(frame, wing, far, far_at, body, eyes, ax, ay, shoulder)
    frame.save(SYMBOL_DIR / "h2-duck-marquee.png")

    # The loose pieces, saved UNROTATED and UNPLACED — the component does both, every frame.
    #
    # A new NAME each time a drawing changes identity, and the rename is the point. Two previous
    # wings have shipped under two previous names; a browser holding either went on serving it, so
    # the duck kept whichever wing it had while the still beside it showed the new one. Same URL,
    # same cache entry, and a ?v= query does not survive the way this game's assets are fetched.
    # `duck-torso` is the wingless body under that rule: `duck-body.webp` still had a wing on it.
    body.save(SYMBOL_DIR / "duck-torso.webp", quality=92, method=6, alpha_quality=100)
    wing.save(SYMBOL_DIR / "duck-wing-flank.webp", quality=92, method=6, alpha_quality=100)
    far.save(SYMBOL_DIR / "duck-wing-shoulder.webp", quality=92, method=6, alpha_quality=100)
    for eye in eyes:
        eye["iris"].save(SYMBOL_DIR / f"duck-iris-{eye['side']}.webp",
                         quality=92, method=6, alpha_quality=100)

    fw, fh = FRAME
    lines = [
        "// GENERATED by scripts/duck/build_duck.py — edit that, not this.",
        "//",
        "// The duck symbol in pieces, so it can blink about and beat its wings. Every number is a",
        "// fraction of the 448x360 symbol frame, which is what makes one table serve every size the",
        "// board draws a symbol at.",
        "//",
        "// DUCK_BODY is the bird with NEITHER wing on it. The far one was painted into the drawing",
        "// and had to be cut off it, torso and all — see the script.",
        "",
        "export type DuckPiece = {",
        "\t/** Centre, as a fraction of the symbol frame. */",
        "\tx: number;",
        "\ty: number;",
        "\twidth: number;",
        "\theight: number;",
        "};",
        "",
        "export type DuckWing = DuckPiece & {",
        "\t/**",
        "\t * The shoulder, as a fraction of the wing's own art: where it tucks under the body, and so",
        "\t * the point it beats about. `x`/`y` above are this point in the frame, not the art's centre.",
        "\t */",
        "\tanchorX: number;",
        "\tanchorY: number;",
        "\t/** Radians it hangs at when nothing is happening — the angle the artist drew it at. */",
        "\trest: number;",
        "};",
        "",
        "export type DuckEye = DuckPiece & {",
        "\tkey: string;",
        "\t/**",
        "\t * How far the iris may slide from the middle of its socket. Measured against the socket's",
        "\t * own shape rather than its box, allowing the pupil to run under the eyelid the way a",
        "\t * cartoon draws a glance — so these are the full range, safe to use to the end.",
        "\t */",
        "\troamX: number;",
        "\troamY: number;",
        "};",
        "",
        f"export const DUCK_BODY: DuckPiece = {{ x: {(BODY_AT[0] + body.width / 2) / fw:.4f}, "
        f"y: {(BODY_AT[1] + body.height / 2) / fh:.4f}, "
        f"width: {body.width / fw:.4f}, height: {body.height / fh:.4f} }};",
        "",
        "/** The near wing, tucked at the flank nearest the viewer. */",
        f"export const DUCK_WING: DuckWing = {{ x: {shoulder[0] / fw:.4f}, y: {shoulder[1] / fh:.4f}, "
        f"width: {wing.width / fw:.4f}, height: {wing.height / fh:.4f}, "
        f"anchorX: {ax:.4f}, anchorY: {ay:.4f}, rest: {-np.radians(WING_ANGLE):.4f} }};",
        "",
        "/**",
        " * The far wing, raised and fanned over the far shoulder. Cut out of the body drawing, so it",
        " * is stored exactly as the artist left it and hangs at no angle of its own.",
        " */",
        f"export const DUCK_WING_FAR: DuckWing = {{ x: {far_at['x'] / fw:.4f}, "
        f"y: {far_at['y'] / fh:.4f}, "
        f"width: {far.width / fw:.4f}, height: {far.height / fh:.4f}, "
        f"anchorX: {far_at['ax']:.4f}, anchorY: {far_at['ay']:.4f}, rest: 0 }};",
        "",
        "export const DUCK_EYES: DuckEye[] = [",
    ]
    for eye in eyes:
        key = "tpDuckIris" + eye["side"].capitalize()
        lines.append(
            f"\t{{ key: '{key}', x: {eye['x'] / fw:.4f}, y: {eye['y'] / fh:.4f}, "
            f"width: {eye['iris'].width / fw:.4f}, height: {eye['iris'].height / fh:.4f}, "
            f"roamX: {eye['reach_x'] / fw:.4f}, roamY: {eye['reach_y'] / fh:.4f} }},")
    lines += ["];", ""]
    TABLE.write_text("\n".join(lines))
    print(f"wrote {TABLE.relative_to(ROOT)}")

    # Eyeball it: the rest pose, then the eyes driven to the corners of their measured range, then
    # the wings at the top and bottom of a beat. If the pupils spill, a wing detaches, or the rebuilt
    # flank shows a seam where the far wing has swung off it, it is here.
    poses = [(0, 0, 0.0), (-1, -1, 0.5), (1, 1, -0.5), (1, -1, 0.9)]
    # A head crop under each pose, at double size: a glance is a handful of pixels, and at symbol
    # size the difference between a lively eye and a frozen one is invisible without it.
    head = (BODY_AT[0] + 20, BODY_AT[1] + 30, BODY_AT[0] + 160, BODY_AT[1] + 130)
    crop_w, crop_h = (head[2] - head[0]) * 2, (head[3] - head[1]) * 2
    sheet = Image.new("RGBA", (fw * len(poses), fh + crop_h), (26, 26, 34, 255))
    for i, (dx, dy, beat) in enumerate(poses):
        pose = Image.new("RGBA", FRAME, (0, 0, 0, 0))
        draw_duck(pose, wing, far, far_at, body, eyes, ax, ay, shoulder, beat=beat, glance=(dx, dy))
        sheet.alpha_composite(pose, (fw * i, 0))
        sheet.alpha_composite(pose.crop(head).resize((crop_w, crop_h), Image.NEAREST), (fw * i, fh))
    sheet.save(VERIFY)
    print(f"wrote {VERIFY.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
