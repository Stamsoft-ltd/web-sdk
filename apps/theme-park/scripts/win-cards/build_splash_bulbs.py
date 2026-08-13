"""Locate the marquee bulbs on the splash screen's three feature frames.

Same problem and same answer as the win cards: the bulbs are painted into `splash/background.webp`,
so lighting them means finding their centres offline and letting the page draw a glow on each.

The splash art is much busier than a win card — the roller coaster, the ferris wheel, the lamp posts
and the carousel are all strung with lights at the same brightness as the frame bulbs — so the
search is restricted to the band the three frames occupy, then split into the frames by x. The
frames' interiors are flat dark panels, so nothing inside them competes.

Writes the table into src/components/splashBulbs.ts.
"""

import os
import pathlib

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

BASE = os.path.dirname(os.path.abspath(__file__))
APP = pathlib.Path(__file__).resolve().parents[2]
SRC = APP / 'static/assets/theme-park/v2/splash/background.webp'
CARD = APP / 'static/assets/theme-park/v2/splash/card-frame.webp'
OUT = APP / 'src/components/splashBulbs.ts'

# The band the three frames live in, as fractions of the background image. Everything above is the
# coaster and the sky, everything below is the paving, and both are full of unrelated lights.
BAND = (0.18, 0.425, 0.815, 0.855)
# x cuts between the three frames, as fractions of the image.
SPLITS = (0.40, 0.61)


def peaks(img, percentile, min_gap, window=9):
    a = np.array(img.convert('RGBA')).astype(float)
    lum = a[..., :3].mean(2) * (a[..., 3] / 255.0)
    cut = np.percentile(lum[lum > 0], percentile)
    top = np.array(
        Image.fromarray(lum.astype(np.uint8), 'L').filter(ImageFilter.MaxFilter(window))
    ).astype(float)
    ys, xs = np.where((lum >= top - 0.5) & (lum >= cut))
    order = np.argsort(-lum[ys, xs])
    gap = min_gap * max(img.size)
    kept = []
    for i in order:
        x, y = float(xs[i]), float(ys[i])
        if all((x - kx) ** 2 + (y - ky) ** 2 >= gap * gap for kx, ky in kept):
            kept.append((x, y))
    return [(x / img.width, y / img.height) for x, y in kept]


# Only the BIG bulbs get lit. The rails also carry small filler studs between them, the coaster
# behind carries a string of little lamps, and glowing either reads as noise rather than as a
# marquee. A big bulb is a compact bright DISC: bright right across a 12px core and much brighter
# than the rail just outside it. Both numbers are measured against the 1672px-wide source art.
CORE_R = 6
RING_IN, RING_OUT = 9, 13
MIN_CORE = 132
MIN_CONTRAST = 20
# Largest a bulb's bright core may span before it is something else — the rails' bulbs measure
# 12-20px across in the 1672px art.
MAX_SPAN = 26


def _offsets(r0, r1):
    return [
        (dx, dy)
        for dx in range(-r1, r1 + 1)
        for dy in range(-r1, r1 + 1)
        if r0 * r0 <= dx * dx + dy * dy <= r1 * r1
    ]


def _sample(lum, x, y, r0, r1):
    """Mean luminance over an annulus, CLAMPED to the image rather than skipped at the edges.

    Rejecting near-edge points instead cost the portrait card its whole bottom rail: those bulbs sit
    5px from the bottom of a 374px art, inside the annulus radius, so every one of them was thrown
    away and the lights ran round three sides and stopped.
    """
    h, w = lum.shape
    vals = [
        lum[min(h - 1, max(0, y + dy)), min(w - 1, max(0, x + dx))] for dx, dy in _offsets(r0, r1)
    ]
    return float(np.mean(vals))


def _extent(lum, x, y, limit):
    """Width and height of the bright region through (x, y), in pixels."""
    h, w = lum.shape
    threshold = lum[y, x] * 0.72

    def run(dx, dy):
        n = 0
        cx, cy = x, y
        while n < limit * 2:
            cx += dx
            cy += dy
            if not (0 <= cx < w and 0 <= cy < h) or lum[cy, cx] < threshold:
                break
            n += 1
        return n

    return run(-1, 0) + run(1, 0) + 1, run(0, -1) + run(0, 1) + 1


def is_big_bulb(lum, x, y, core_r=None, ring_in=None, ring_out=None, span=None):
    core = _sample(lum, x, y, 0, core_r or CORE_R)
    ring = _sample(lum, x, y, ring_in or RING_IN, ring_out or RING_OUT)
    if core < MIN_CORE or core - ring < MIN_CONTRAST:
        return False
    # A bulb is a compact ROUND blob. Without this the rail's own bright top lip qualifies: it is a
    # long bright ridge, so a point on it is a local maximum, its core is bright, and the annulus
    # catches the darker rail face and the sky, which is enough contrast to pass. Two such points
    # survived on the middle frame — and because they only showed when the chase reached them, they
    # read as two lights blinking on bare metal above the bulbs.
    limit = span or MAX_SPAN
    ew, eh = _extent(lum, x, y, limit)
    return ew <= limit and eh <= limit and 0.5 <= ew / eh <= 2.0


def frame_bulbs():
    img = Image.open(SRC)
    lum = np.array(img.convert('RGB')).astype(float).mean(2)
    x0, y0, x1, y1 = BAND
    pts = [
        p
        for p in peaks(img, 99.0, 0.012)
        if x0 < p[0] < x1
        and y0 < p[1] < y1
        and is_big_bulb(lum, int(p[0] * img.width), int(p[1] * img.height))
    ]
    groups = [[], [], []]
    for p in pts:
        groups[0 if p[0] < SPLITS[0] else 1 if p[0] < SPLITS[1] else 2].append(p)
    return groups, img


# The rest of the park: the coaster rails, the ferris wheel, both carousels, the ticket booth and
# the tree garlands are all strung with lights, and leaving them dead while three signs pulsed is
# what made the splash read as static. They are a different KIND of light from the frames' marquee
# bulbs — a few pixels across instead of twenty — so they get their own, much tighter numbers.
PARK_CORE_R = 2
PARK_RING_IN, PARK_RING_OUT = 4, 7
PARK_MIN_CORE = 150
PARK_MIN_CONTRAST = 22
PARK_MAX_SPAN = 12
# The frames' own box, excluded because frame_bulbs owns it, and the paving, whose wet reflections
# are bright but are not lights.
PARK_EXCLUDE = (0.16, 0.41, 0.84, 0.89)
PARK_FLOOR = 0.86


def park_bulbs():
    img = Image.open(SRC)
    lum = np.array(img.convert('RGB')).astype(float).mean(2)
    ex0, ey0, ex1, ey1 = PARK_EXCLUDE
    out = []
    for fx, fy in peaks(img, 99.3, 0.006, window=5):
        if (ex0 < fx < ex1 and ey0 < fy < ey1) or fy >= PARK_FLOOR:
            continue
        x, y = int(fx * img.width), int(fy * img.height)
        core = _sample(lum, x, y, 0, PARK_CORE_R)
        ring = _sample(lum, x, y, PARK_RING_IN, PARK_RING_OUT)
        if core < PARK_MIN_CORE or core - ring < PARK_MIN_CONTRAST:
            continue
        ew, eh = _extent(lum, x, y, PARK_MAX_SPAN)
        if ew <= PARK_MAX_SPAN and eh <= PARK_MAX_SPAN and 0.45 <= ew / eh <= 2.2:
            out.append((fx, fy))
    return out, img


def card_bulbs():
    """The portrait card's own frame. Same rule, scaled to the much smaller art (361px wide)."""
    img = Image.open(CARD)
    lum = np.array(img.convert('RGBA')).astype(float)[..., :3].mean(2)
    scale = img.width / 1672
    core_r, ring_in, ring_out = (max(2, round(v * scale * 3)) for v in (CORE_R, RING_IN, RING_OUT))
    span = max(6, round(MAX_SPAN * scale * 3))
    out = [
        (fx, fy)
        for fx, fy in peaks(img, 96.0, 0.045)
        if is_big_bulb(
            lum, int(fx * img.width), int(fy * img.height), core_r, ring_in, ring_out, span
        )
    ]
    return out, img


def emit(groups, cards, park):
    def pack(points):
        return ' '.join(f'{x:.4f},{y:.4f}' for x, y in points)

    body = [
        '''// GENERATED by scripts/win-cards/build_splash_bulbs.py. Do not hand-edit.
//
// Marquee bulb centres painted into the splash art, so <SplashLights> can light them. Coordinates
// are fractions of their own image: the three landscape frames against splash/background.webp, the
// portrait card against splash/card-frame.webp.

const points = (packed: string): [number, number][] =>
	packed.split(' ').map((pair) => {
		const [x, y] = pair.split(',');
		return [Number(x), Number(y)];
	});

/** One entry per feature frame, left to right. */
export const SPLASH_FRAME_BULBS: [number, number][][] = ['''
    ]
    for group in groups:
        body.append(f"\tpoints(\n\t\t'{pack(group)}',\n\t),")
    body.append('];\n')
    body.append(
        "/** The portrait carousel's single frame. */\nexport const SPLASH_CARD_BULBS: "
        f"[number, number][] = points(\n\t'{pack(cards)}',\n);\n"
    )
    body.append(
        '/**\n'
        ' * Every other light in the park: coaster rails, ferris wheel, both carousels, the ticket\n'
        ' * booth, the tree garlands. One flat list — these are strings of lamps, not a marquee, so\n'
        ' * they twinkle out of step with each other rather than running a chase.\n'
        ' */\n'
        f"export const SPLASH_PARK_BULBS: [number, number][] = points(\n\t'{pack(park)}',\n);\n"
    )
    OUT.write_text('\n'.join(body))


if __name__ == '__main__':
    groups, img = frame_bulbs()
    cards, cimg = card_bulbs()
    park, _ = park_bulbs()
    emit(groups, cards, park)
    print(f'frames {[len(g) for g in groups]}  card {len(cards)}  park {len(park)}  -> {OUT}')

    preview = img.convert('RGB').copy()
    draw = ImageDraw.Draw(preview)
    for colour, group in zip([(0, 255, 90), (255, 90, 220), (90, 200, 255)], groups):
        for fx, fy in group:
            x, y = fx * img.width, fy * img.height
            draw.ellipse([x - 7, y - 7, x + 7, y + 7], outline=colour, width=2)
    preview.resize((1000, round(1000 * img.height / img.width))).save(
        os.path.join(BASE, 'verify_splash_bulbs.png')
    )
