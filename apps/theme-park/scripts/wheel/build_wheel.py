#!/usr/bin/env python3
"""Take the ferris wheel apart so it can turn.

The redesigned wheel (Figma 7052:7879) is drawn as a rig, not as a picture: a rim with spokes
(7052:7902), five gondolas in four colours (7052:7911 blue, 7052:7913 purple, 7052:7915 green,
7052:7917 orange — the blue one is used twice), a hub (7052:7895) and a pair of legs (7052:7904).
That is exactly the split a turning wheel needs, so this script ships the pieces and the geometry
rather than one flat PNG: on a win the rim spins about its axle and the gondolas ride round it while
staying upright, which is what a ferris wheel does and what a single sprite cannot do.

    python3 scripts/wheel/build_wheel.py

It writes:

  static/assets/theme-park/v2/symbols/h5-ferris-marquee.png   (the whole rig, assembled, at rest)
  static/assets/theme-park/v2/symbols/wheel-{rim,hub,legs}.webp
  static/assets/theme-park/v2/symbols/wheel-car-{blue,purple,green,orange}.webp
  src/game/wheelParts.ts
  scripts/wheel/verify_wheel.png

WHY IT IS BUILT THIS WAY

The assembled design is a 112x90 frame, which is the frame every symbol in this game is drawn in, so
a x4 export IS our 448x360 symbol and every placement inside it is already in symbol coordinates —
no locating, no re-centring. The exports are opaque on #f5f5f5 paper, flooded out from the border so
the white highlights inside the gondolas survive; see scripts/wild or scripts/duck-sign for the long
version of that.

Placements come from the assembled frame's own node boxes, but they are not TRUSTED: each part is
slid around its stated position and scored on how much of it matches the assembled export exactly,
and the script refuses to write anything that does not land. Figma node coordinates are only the
pre-transform origin, and a group that has been nudged reports where it used to be.

The gondolas are then converted to polar coordinates about the axle. Their radii are NOT equalised,
even though the artist's five differ by a third — each keeps its own, so at rest the rig is the
design's own drawing pixel for pixel, and under rotation each gondola simply rides its own circle.
Forcing them onto a common radius would make the still wrong to fix a wobble that never happens.

The baked assembly is written too. Nothing draws it as the symbol — <FerrisWheel> assembles the live
one from the parts — but the board's spin trail needs one sprite to ghost, and the wheel does not
turn mid-spin, so at that moment the two are the same picture.
"""

import math
from collections import deque
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.figma_paper import keyed  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent / "source"
SYMBOL_DIR = ROOT / "static/assets/theme-park/v2/symbols"
TABLE = ROOT / "src/game/wheelParts.ts"
VERIFY = Path(__file__).resolve().parent / "verify_wheel.png"

FRAME = (448, 360)
# How far either way to slide a part when checking its stated position, and how much of it has to
# match exactly before the placement is believed. The bar is high because these parts ARE the pixels
# of the assembled export — anything below it means the wrong node was downloaded.
SEARCH = 10
CONFIDENCE = 0.9
# Summed over the three channels, how far apart two pixels can be and still count as the same colour.
# Generous rather than exact because the two renders are not bit-identical: a part composited over
# the wheel picks up a unit or two against the same part composited over paper, which at a strict
# threshold reads as a fifth of the legs being in the wrong place.
SAME = 24

# The parts whose middle is background rather than drawing — see `lib/figma_paper`. Only the rim:
# it is a ring
# with spokes, and the twelve sectors between them are meant to show the board through.
HOLLOW = {"rim"}

# (file stem, the node it came from, its node box in the assembled 112x90 frame). In back-to-front
# order, which is the order Figma stacks them: the rim, then the gondolas, then the legs across the
# front, and the hub capping the middle.
PARTS = [
    ("rim", "7052:7902", (23, 5)),
    ("car-blue", "7052:7911", (22, 51)),
    ("car-purple", "7052:7913", (48.5, 6)),
    ("car-green", "7052:7915", (78, 25.5)),
    ("car-blue", "7052:7911", (76, 52)),
    ("car-orange", "7052:7917", (20, 27.5)),
    ("legs", "7052:7904", (30, 41)),
    ("hub", "7052:7895", (50, 32)),
]


def ink_box(part):
    """The part's drawn extent, ignoring the transparent margin its export carries."""
    ys, xs = np.nonzero(part[..., 3] > 0)
    return xs.min(), ys.min(), xs.max(), ys.max()


def eroded(mask, rounds=2):
    """`mask` with its boundary shaved off.

    Scoring skips the edge of a part on purpose. A part exported on its own has its outline
    anti-aliased against the paper, and the same outline in the assembly is anti-aliased against
    whatever it was drawn over, so the two disagree by a lot along every edge and by nothing at all
    anywhere else — the legs are thin enough that this alone drops them from 100% to 84%.
    """
    for _ in range(rounds):
        keep = mask.copy()
        keep[1:, :] &= mask[:-1, :]
        keep[:-1, :] &= mask[1:, :]
        keep[:, 1:] &= mask[:, :-1]
        keep[:, :-1] &= mask[:, 1:]
        mask = keep
    return mask


def settle(composition, covered, part, guess):
    """Slide `part` around `guess` and return where most of it matches exactly, and how much did.

    Scored on the FRACTION of the part's own ink that matches, not on the mean difference — most of
    a part can be the same flat colour as its neighbour and a mean would not notice a shift.

    `covered` is the ink of everything that sits IN FRONT of this part, which is why the caller works
    front to back: the legs cross the rim and the hub caps the spokes, so a part is not required to
    match where something else is drawn over it. Without that the rim scores 68% while sitting
    exactly where it belongs, and no honest threshold can tell that apart from a part that missed.
    """
    ph, pw, _ = part.shape
    ink = eroded(part[..., 3] > 0)
    best = None
    for dy in range(-SEARCH, SEARCH + 1):
        for dx in range(-SEARCH, SEARCH + 1):
            x, y = guess[0] + dx, guess[1] + dy
            if x < 0 or y < 0 or x + pw > composition.shape[1] or y + ph > composition.shape[0]:
                continue
            visible = ink & ~covered[y : y + ph, x : x + pw]
            if not visible.any():
                continue
            window = composition[y : y + ph, x : x + pw, :3]
            difference = np.abs(window - part[..., :3]).sum(axis=2)
            share = (difference[visible] < SAME).mean()
            if best is None or share > best[0]:
                best = (share, x, y)
    return best


def bulbs_on(part):
    """The gold bulbs drawn on `part`, as (x, y, radius) in its own pixels, in chase order.

    The wheel is the one symbol in this game whose bulbs are NOT found by
    `scripts/build-symbol-bulbs.py`. That script works on whole flat symbols and the wheel stopped
    being one when it was taken apart; it also found 97 "bulbs" on the old drawing, most of them
    highlights on the gondolas. There are six here and they are all on the legs, which is why this
    looks at one part rather than at the assembly.

    A bulb is a small, round, solid patch of gold. The gondolas' windows are white, the hub cap is
    gold but far too big, and the rim carries no gold at all, so on the legs alone the colour test
    is very nearly enough on its own — the roundness and size tests are here to keep it that way if
    the art is redrawn.
    """
    opaque = part[..., 3] > 160
    r, g, b = part[..., 0], part[..., 1], part[..., 2]
    gold = opaque & (r > 200) & (g > 130) & (b < 130)

    h, w = gold.shape
    seen = np.zeros_like(gold)
    found = []
    for sy, sx in zip(*np.nonzero(gold)):
        if seen[sy, sx]:
            continue
        seen[sy, sx] = True
        queue, points = deque([(sy, sx)]), []
        while queue:
            y, x = queue.popleft()
            points.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and gold[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        queue.append((ny, nx))
        ys = [p[0] for p in points]
        xs = [p[1] for p in points]
        bw, bh = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
        radius = (bw + bh) / 4
        # Round (its box is roughly square), solid (it fills most of that box, unlike a ring or a
        # highlight) and small (a bulb, not the hub cap).
        if min(bw, bh) / max(bw, bh) < 0.7 or len(points) / (bw * bh) < 0.6:
            continue
        if not 2 <= radius <= 12:
            continue
        found.append(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, radius))

    # Down the left leg and back up the right one, so <SymbolBulbs> chases them as one loop around
    # the pair rather than jumping between the legs at every step.
    middle = sum(x for x, _, _ in found) / len(found)
    left = sorted((p for p in found if p[0] < middle), key=lambda p: p[1])
    right = sorted((p for p in found if p[0] >= middle), key=lambda p: -p[1])
    return left + right


def spokes_on(part, samples=1440):
    """The angles of the spokes drawn on `part`, in radians, going clockwise from three o'clock.

    A gondola is bolted to a spoke, so where the spokes are is not a detail of the rim's picture —
    it is the only set of angles a car is allowed to sit at, and it has to come out of the drawing
    rather than out of a guess about how many spokes a wheel ought to have.

    Read off a ring part-way out from the axle, where a spoke is the only thing that can be drawn:
    inside that radius sits the hub and its inner ring, outside it the red rim, and between the two
    there is nothing but spokes and gaps. Walking that circle gives one run of ink per spoke, and
    each run's midpoint is the spoke's angle. Sampled at four times a degree because the answer is
    the MIDDLE of a run, and a run read half a degree short at each end still has the same middle.
    """
    ink = part[..., 3] > 128
    h, w = ink.shape
    # The rim's own ink, not its export box: the margins Figma bounded the node with are an accident
    # and centring on them would read the ring off-axis and split every spoke in two.
    x0, y0, x1, y1 = ink_box(part)
    cx, cy = (x0 + x1 + 1) / 2, (y0 + y1 + 1) / 2
    radius = min(x1 - x0, y1 - y0) * 0.35

    on = []
    for step in range(samples):
        theta = 2 * math.pi * step / samples
        x, y = int(round(cx + radius * math.cos(theta))), int(round(cy + radius * math.sin(theta)))
        on.append(0 <= x < w and 0 <= y < h and ink[y, x])

    # Rotate the reading so it starts in a gap, which is what lets a run be a plain slice: a spoke
    # sitting exactly at three o'clock would otherwise be split across the ends of the list and
    # counted twice, at two angles, neither of them its own.
    start = next((i for i, lit in enumerate(on) if not lit), None)
    if start is None:
        raise SystemExit("the rim is solid all the way round — no spokes to read")
    on = on[start:] + on[:start]

    angles, run = [], []
    for i, lit in enumerate(on + [False]):
        if lit:
            run.append(i)
        elif run:
            middle = (run[0] + run[-1]) / 2 + start
            angles.append(2 * math.pi * middle / samples)
            run = []
    return sorted(a % (2 * math.pi) for a in angles)


def rgba(array):
    return Image.fromarray(array.astype(np.uint8), "RGBA")


def num(value):
    """Four decimal places, trailing zeros trimmed — what Prettier would leave behind."""
    return f"{value:.4f}".rstrip("0").rstrip(".") or "0"


def main():
    composition = keyed(SOURCE / "composition.png")
    if composition.shape[:2] != (FRAME[1], FRAME[0]):
        raise SystemExit(f"the assembled export is {composition.shape[1]}x{composition.shape[0]}, not {FRAME}")

    parts = {}
    placed = []
    # Front to back, so each part is only asked to match where nothing is drawn over it.
    covered = np.zeros((FRAME[1], FRAME[0]), bool)
    for stem, node, box in reversed(PARTS):
        if stem not in parts:
            parts[stem] = keyed(SOURCE / f"{stem}.png", holes=stem in HOLLOW)
        art = parts[stem]
        guess = (round(box[0] * 4), round(box[1] * 4))
        share, x, y = settle(composition, covered, art, guess)
        drift = math.hypot(x - guess[0], y - guess[1])
        print(f"{stem:12} {art.shape[1]:3}x{art.shape[0]:3} at ({x:3},{y:3})  {share:.0%} exact, {drift:.0f}px off its node box  {node}")
        if share < CONFIDENCE:
            raise SystemExit(f"{stem} did not land on the assembly — check the sources")
        ph, pw, _ = art.shape
        covered[y : y + ph, x : x + pw] |= art[..., 3] > 0
        placed.append((stem, x, y, art))
    placed.reverse()

    # The baked still, in the design's own stacking order.
    base = Image.new("RGBA", FRAME, (0, 0, 0, 0))
    for _, x, y, art in placed:
        base.alpha_composite(rgba(art), (x, y))
    base.save(SYMBOL_DIR / "h5-ferris-marquee.png")
    print("wrote symbols/h5-ferris-marquee.png")

    # Each part ships trimmed to its ink, with its placement moved to match — the export margins are
    # an accident of how Figma bounded each node and there is no reason to pay for them twice.
    trimmed = {}
    for stem, art in parts.items():
        x0, y0, x1, y1 = ink_box(art)
        ink = rgba(art[y0 : y1 + 1, x0 : x1 + 1])
        ink.save(SYMBOL_DIR / f"wheel-{stem}.webp", quality=92, method=6, alpha_quality=100)
        trimmed[stem] = (x0, y0, ink.width, ink.height)

    def frame_box(stem, x, y):
        """A placed part as its CENTRE and size, in frame fractions."""
        ox, oy, w, h = trimmed[stem]
        return (x + ox + w / 2, y + oy + h / 2, w, h)

    # The axle is the RIM's own centre, not the hub cap's. The rim is drawn concentric with its box
    # to within half a pixel — its red ring, its spokes and its ink all centre on the same point —
    # whereas the yellow cap sits two and a half pixels off it. Turning the wheel about the cap would
    # walk the rim in a small circle once a revolution, which is exactly the wobble a real wheel does
    # not have. So the cap is treated as decoration and the rim's centre is the axle.
    rim = next(p for p in placed if p[0] == "rim")
    axle_x, axle_y, _, _ = frame_box("rim", rim[1], rim[2])
    hub = next(p for p in placed if p[0] == "hub")
    hub_x, hub_y, _, _ = frame_box("hub", hub[1], hub[2])
    print(
        f"axle at ({axle_x:.1f}, {axle_y:.1f}) — the rim's centre; the hub cap is drawn "
        f"{math.hypot(hub_x - axle_x, hub_y - axle_y):.1f}px off it"
    )

    # The gondolas HANG. Each one's centre is not on a circle about the axle — it is a fixed drop
    # BELOW a mount point that is. That is why the five measured radii looked so unequal (101 to 136
    # on a 134px rim): the car at the top of the wheel is the closest to the axle by exactly the drop,
    # the two near the bottom the furthest, and the ones at the sides in between.
    #
    # Storing what was measured was survivable while the wheel only turned during a win. It is not
    # now that it turns all the time: rotating five different radii slides every car across the
    # spokes it is supposed to be bolted to, and within a few seconds they are off the rim entirely.
    #
    # So the drop is solved for — the value that collapses the five radii onto one circle — and the
    # table stores that one mounting radius, that one drop, and each car's angle ON it.
    seats = []
    for stem, x, y, _ in placed:
        if not stem.startswith("car-"):
            continue
        cx, cy, w, h = frame_box(stem, x, y)
        seats.append((stem.removeprefix("car-"), cx, cy, w, h))

    def spread(hang):
        radii = [math.hypot(cx - axle_x, cy - hang - axle_y) for _, cx, cy, _, _ in seats]
        mean = sum(radii) / len(radii)
        return sum((r - mean) ** 2 for r in radii) / len(radii), mean, radii

    hang = min((h / 10 for h in range(601)), key=lambda h: spread(h)[0])
    variance, mount, radii = spread(hang)
    print(
        f"gondolas hang {hang:.1f}px below a mounting circle of {mount:.1f}px "
        f"— that collapses radii spanning {max(radii) - min(radii):.1f}px to {variance ** 0.5:.1f}px rms"
    )

    # ONE GONDOLA PER SPOKE, which is the one place this build overrules the drawing.
    #
    # The artist's five angles are not a fifth apart: sorted, the gaps run 123, 45, 72, 70, 50
    # degrees. That is a composition, not a mechanism — the wide gap is the bottom of the wheel, left
    # empty so no gondola sits in the legs, and the other four are crowded into what is left. It
    # reads well as the still it was drawn as, and it falls apart the moment the wheel moves: rotate
    # the empty stretch to the top and all five pile up around the legs at once.
    #
    # Spacing them evenly instead fixes the pile-up and breaks something else, because a gondola is
    # bolted to a SPOKE and the rim art draws eight of them, 45 degrees apart. Five cars cannot be
    # both evenly spaced and on spokes — five does not divide eight — so evenly spaced meant three of
    # the five hanging off the rim between spokes, which is what a wheel visibly must not do.
    #
    # Eight does divide eight. So the spokes are measured off the rim drawing and each one gets a
    # car, cycling the four colours the artist drew. That is even spacing and spoke alignment at the
    # same time, and it is the only arrangement that is both. It costs the drawn car COUNT, which was
    # only ever a property of the still — no gondola moves relative to the rim it is bolted to, which
    # is the thing that was actually wrong.
    spoke_angles = spokes_on(next(p for p in placed if p[0] == "rim")[3])
    print(f"{len(spoke_angles)} spokes on the rim, "
          f"{' '.join(f'{math.degrees(a) % 360:.0f}' for a in spoke_angles)} deg")

    # The colours in the order the artist ran them round the wheel, so the cycle starts from a
    # sequence that was actually drawn rather than from alphabetical order.
    seats.sort(key=lambda seat: math.atan2(seat[2] - hang - axle_y, seat[1] - axle_x))
    palette = []
    for colour, _, _, w, h in seats:
        if colour not in [p[0] for p in palette]:
            palette.append((colour, w, h))

    cars = []
    for i, angle in enumerate(spoke_angles):
        colour, w, h = palette[i % len(palette)]
        cars.append((colour, angle, w, h))
        print(f"  car-{colour:7} bolted to the spoke at {math.degrees(angle) % 360:5.1f} deg")

    mount_block = (
        "export const WHEEL_MOUNT: WheelMount = {\n"
        f"\tradiusX: {num(mount / FRAME[0])},\n"
        f"\tradiusY: {num(mount / FRAME[1])},\n"
        f"\thang: {num(hang / FRAME[1])},\n"
        "};\n\n"
    )
    entries = "".join(
        f"\t{{ key: 'tpWheelCar{colour.capitalize()}', "
        f"angle: {num(angle)}, width: {num(w / FRAME[0])}, height: {num(h / FRAME[1])} }},\n"
        for colour, angle, w, h in cars
    )
    statics = ""
    for stem in ("rim", "legs", "hub"):
        entry = next(p for p in placed if p[0] == stem)
        cx, cy, w, h = frame_box(stem, entry[1], entry[2])
        statics += (
            f"export const WHEEL_{stem.upper()}: WheelPiece = {{\n"
            f"\tkey: 'tpWheel{stem.capitalize()}',\n"
            f"\tx: {num(cx / FRAME[0])},\n"
            f"\ty: {num(cy / FRAME[1])},\n"
            f"\twidth: {num(w / FRAME[0])},\n"
            f"\theight: {num(h / FRAME[1])},\n"
            "};\n\n"
        )
    axle = (
        "export const WHEEL_AXLE = {\n"
        f"\tx: {num(axle_x / FRAME[0])},\n"
        f"\ty: {num(axle_y / FRAME[1])},\n"
        "};\n\n"
    )

    # The bulbs are on the legs, and the legs are the one part of this rig that does not move — so
    # they are written in frame coordinates like any other symbol's bulbs and lit by the board's own
    # <SymbolBulbs>, rather than having to be carried round with the rim.
    legs_entry = next(p for p in placed if p[0] == "legs")
    legs_x, legs_y, legs_w, legs_h = frame_box("legs", legs_entry[1], legs_entry[2])
    found = bulbs_on(legs_entry[3][
        trimmed["legs"][1] : trimmed["legs"][1] + trimmed["legs"][3],
        trimmed["legs"][0] : trimmed["legs"][0] + trimmed["legs"][2],
    ])
    if len(found) < 4:
        raise SystemExit(f"only found {len(found)} bulbs on the legs — check the art")
    print(f"{len(found)} bulbs on the legs, radius {sum(p[2] for p in found) / len(found):.1f}px")
    rows = "".join(
        f"\t{{ x: {num((legs_x - legs_w / 2 + bx) / FRAME[0])}, "
        f"y: {num((legs_y - legs_h / 2 + by) / FRAME[1])}, "
        f"r: {num(radius / FRAME[0])} }},\n"
        for bx, by, radius in found
    )
    bulbs = (
        f"/** The {len(found)} bulbs down the legs, in chase order: down one leg and up the other. */\n"
        f"export const WHEEL_BULBS: SymbolBulb[] = [\n{rows}];\n\n"
    )

    TABLE.write_text(
        HEADER
        + axle
        + statics
        + bulbs
        + mount_block
        + "export const WHEEL_CARS: WheelCar[] = [\n"
        + entries
        + "];\n"
    )
    print(f"wrote {TABLE.relative_to(ROOT)}")

    # Left: the rig re-assembled from what ships, turned a third of a turn, so a glance says the
    # gondolas ride round the axle and stay upright. Right: the design's own assembly, straight off
    # Figma and still carrying its paper — which is why the left wheel is see-through between the
    # spokes and the right one is a white disc. That difference is the point, not a fault: the
    # board's purple is meant to show through, and the gondolas' white windows survive on both.
    check = Image.new("RGBA", (FRAME[0] * 2 + 24, FRAME[1]), (26, 26, 34, 255))
    turned = Image.new("RGBA", FRAME, (0, 0, 0, 0))
    rim = Image.open(SYMBOL_DIR / "wheel-rim.webp")
    rx, ry, rw, rh = frame_box("rim", *next((p[1], p[2]) for p in placed if p[0] == "rim"))
    spun = rim.rotate(-120, resample=Image.BICUBIC, expand=True)
    turned.alpha_composite(spun, (round(rx - spun.width / 2), round(ry - spun.height / 2)))
    for colour, angle, w, h in cars:
        car = Image.open(SYMBOL_DIR / f"wheel-car-{colour}.webp")
        a = angle + math.radians(120)
        turned.alpha_composite(
            car,
            (
                round(axle_x + mount * math.cos(a) - w / 2),
                round(axle_y + mount * math.sin(a) + hang - h / 2),
            ),
        )
    for stem in ("legs", "hub"):
        entry = next(p for p in placed if p[0] == stem)
        px, py, pw, ph = frame_box(stem, entry[1], entry[2])
        turned.alpha_composite(
            Image.open(SYMBOL_DIR / f"wheel-{stem}.webp"), (round(px - pw / 2), round(py - ph / 2))
        )
    check.alpha_composite(turned, (0, 0))
    check.alpha_composite(rgba(composition), (FRAME[0] + 24, 0))
    check.save(VERIFY)
    print(f"wrote {VERIFY.relative_to(ROOT)}")


HEADER = """/**
 * The ferris wheel, in pieces, and the geometry that puts it back together.
 *
 * GENERATED by `scripts/wheel/build_wheel.py` — edit that, not this. The symbol ships as a rim, a
 * hub, a pair of legs and its gondolas rather than one drawing, so that a win can spin the rim and
 * ride the gondolas round it; see <FerrisWheel>.
 *
 * Every number is a fraction of the symbol FRAME, origin top-left, so they survive any change to how
 * big the symbol is drawn. `x`/`y` are a piece's CENTRE.
 *
 * `WHEEL_AXLE` is the rim's own centre, which is what the wheel turns about. It is NOT the hub cap:
 * the cap is drawn a couple of pixels off centre, and turning the rim about it would walk the whole
 * wheel round in a small circle once a revolution.
 *
 * A GONDOLA HANGS; IT DOES NOT ORBIT. They all share `WHEEL_MOUNT` — one mounting radius, given
 * twice so the circle stretches with the symbol instead of going oval when the board squeezes it,
 * and one `hang`, the fixed drop from the mount to the car's centre. Each car carries only its
 * `angle`: where its mount sits round the wheel, in radians, clockwise from three o'clock.
 *
 * That split is what makes the wheel turnable. Measured straight off the design the cars sit at
 * radii from 101 to 136 on a 134-pixel rim, which looks like sloppy drawing and is not: the car at
 * the top is nearer the axle than the ones at the bottom by exactly twice the drop. Turning those
 * measured radii slides every car off the spoke it is bolted to.
 *
 * `WHEEL_CARS` has one entry per SPOKE, which is why there are more of them than the design draws.
 * The artist's five are unevenly spaced, around a bottom deliberately left empty, and that is a
 * property of a still: turned, they pile up in the legs, and spacing five of them evenly instead
 * leaves most of them hanging between spokes. Eight spokes take eight cars, cycling the four
 * colours drawn, and that is the only arrangement that is even and bolted down at once.
 *
 * `WHEEL_BULBS` is the exception to all of the above being about a wheel that turns: those six sit
 * on the LEGS, which stand still, so they are plain frame coordinates and the board lights them
 * with the same <SymbolBulbs> it points at every other marquee sign.
 */
import type { SymbolBulb } from './symbolBulbs';

export type WheelPiece = { key: string; x: number; y: number; width: number; height: number };
export type WheelMount = { radiusX: number; radiusY: number; hang: number };
export type WheelCar = { key: string; angle: number; width: number; height: number };

"""


main()
