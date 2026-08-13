"""Cut the redesigned congratulations panel (Figma 6909:9366) into its animatable parts.

The old congrats screens drew one flat neon square. The redesign is an ornate marquee frame whose
pieces are separate images — the panel (with its amount well built in), the medallion ring, and the
gold P that sits inside it — so the game can animate each one: the headline drops in from above, the
P punches in from nothing, the bulbs light.

Two things this deliberately does NOT do, both learned on the win cards:

  * it does not trim. Every raw here has the same aspect as its Figma node box, which means the box
    IS the image and fractions map straight across; trimming would shift every position by the
    margin and buy nothing.
  * it does not take the node `export`, which comes back with the frame's white fill baked in. The
    files in source/ are the `rawImages` entries, largest one with actual transparency.

Writes the webp parts and the generated layout + bulb table `src/game/congratsPanelParts.ts`.
"""

import math
import os
import pathlib

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

BASE = pathlib.Path(__file__).resolve().parent
APP = pathlib.Path(__file__).resolve().parents[2]
OUT_DIR = APP / 'static/assets/theme-park/v2/popup/congrats'
OUT_TS = APP / 'src/game/congratsPanelParts.ts'

# Node boxes as Figma reports them, in the 6909:9366 frame's coordinates. The panel's box is the
# space every fraction in the generated table is expressed in.
PANEL_BOX = (318, 16, 566, 567)
RING_BOX = (494, 179, 212, 318)
P_BOX = (559, 265, 89, 133)

# Rendered width to ship each part at. The panel is only ever drawn a few hundred points across, so
# the 1254px source is far more than it can show; these are sized for a 2x display and no more.
WIDTHS = {'panel': 1024, 'ring': 448, 'p': 224}


def load(name):
    """The Figma raw for a part, kept as lossless webp.

    Committed alongside the script rather than left in a working directory: the URLs Figma hands out
    expire after a week, and a pipeline that cannot be re-run is a pipeline nobody re-runs.
    """
    return Image.open(BASE / 'source' / f'{name}.webp').convert('RGBA')


def write_part(name, img):
    width = WIDTHS[name]
    resized = img.resize((width, round(width * img.height / img.width)), Image.LANCZOS)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / f'{name}.webp'
    resized.save(path, 'WEBP', quality=90, method=6)
    return path, resized.size


# ── Bulb finding ────────────────────────────────────────────────────────────────────────────────
#
# Same shape of problem as the win cards and the splash: the bulbs are PAINTED into the art, so
# lighting them means finding their centres here and letting <WinCardLights> draw a glow on each.
#
# A bulb is a compact ROUND bright blob. The compactness test is the one that matters — without it
# the gold ornaments' specular highlights qualify, because a highlight running along a curl is a
# local maximum whose surroundings are darker. That is exactly the ridge that put two stray lights
# on the splash's middle sign.


def peaks(img, percentile, window=9):
    """Every local maximum above the percentile, brightest first. NOT thinned by distance.

    Thinning here — the way the splash pipeline does it — loses real bulbs on this art: the ring's
    rails carry pinprick specular sparkles that are pure white, so they outrank the bulbs they sit
    beside and swallow them. Candidates are thinned only after the bulb test has run, so a speck
    can never suppress a bulb.
    """
    a = np.array(img).astype(float)
    lum = a[..., :3].mean(2) * (a[..., 3] / 255.0)
    cut = np.percentile(lum[lum > 0], percentile)
    top = np.array(
        Image.fromarray(lum.astype(np.uint8), 'L').filter(ImageFilter.MaxFilter(window))
    ).astype(float)
    ys, xs = np.where((lum >= top - 0.5) & (lum >= cut))
    order = np.argsort(-lum[ys, xs])
    return [(float(xs[i]), float(ys[i])) for i in order]


def _offsets(r0, r1):
    return [
        (dx, dy)
        for dx in range(-r1, r1 + 1)
        for dy in range(-r1, r1 + 1)
        if r0 * r0 <= dx * dx + dy * dy <= r1 * r1
    ]


def _sample(lum, x, y, r0, r1):
    """Mean luminance over an annulus, clamped to the image rather than skipped at the edges."""
    h, w = lum.shape
    vals = [
        lum[min(h - 1, max(0, y + dy)), min(w - 1, max(0, x + dx))] for dx, dy in _offsets(r0, r1)
    ]
    return float(np.mean(vals))


def _extent(lum, x, y, limit):
    """Width and height of the bright region through (x, y), in pixels."""
    h, w = lum.shape
    threshold = lum[y, x] * 0.7

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


def find_bulbs(img, *, percentile, min_gap, core_r, ring_in, ring_out, min_core, min_contrast,
               max_span, min_span=0, blue_floor=0.0, window=9):
    """Bulb centres as fractions of the image.

    `blue_floor` is the panel's discriminator: its bulbs are white-lilac (blue as strong as red)
    while everything else bright on that art — the gold scrollwork, the amber studs between the
    bulbs, the sparks on the background field — is warm, with blue far below red.

    `min_span` is the medallion's: its rails carry rows of tiny studs between the real bulbs, and
    every glow is drawn at one radius, so lighting a 12px stud like a 55px bulb turns the rail into
    a smear. Only the big ones are lit.
    """
    rgba = np.array(img).astype(float)
    lum = rgba[..., :3].mean(2) * (rgba[..., 3] / 255.0)
    gap = min_gap * max(img.size)
    kept = []
    for px, py in peaks(img, percentile, window=window):
        x, y = int(px), int(py)
        core = _sample(lum, x, y, 0, core_r)
        halo = _sample(lum, x, y, ring_in, ring_out)
        if core < min_core or core - halo < min_contrast:
            continue
        red, blue = rgba[y, x, 0], rgba[y, x, 2]
        if blue < blue_floor * max(red, 1.0):
            continue
        ew, eh = _extent(lum, x, y, max_span)
        if not (min_span <= min(ew, eh) and max(ew, eh) <= max_span and 0.5 <= ew / eh <= 2.0):
            continue
        if all((px - kx) ** 2 + (py - ky) ** 2 >= gap * gap for kx, ky in kept):
            kept.append((px, py))
    return [(x / img.width, y / img.height) for x, y in kept]


def panel_bulbs(img):
    """The frame rails and the amount well. 1254px source; the bulbs measure ~18px across."""
    return find_bulbs(
        img,
        percentile=98.5,
        min_gap=0.012,
        core_r=5,
        ring_in=10,
        ring_out=15,
        min_core=150,
        min_contrast=25,
        max_span=30,
        blue_floor=0.82,
    )


# The medallion's bulb circle: its centre (the art's bbox centre — the four stars stick out
# symmetrically) and the radius band the bulbs sit in, as fractions of the image WIDTH. Outside the
# band lie the stars and the outer rail's studs, both of which pass every brightness and shape test
# but are not marquee bulbs.
RING_CENTRE = (0.5, 0.4658)
RING_BULB_BAND = (0.33, 0.395)


def ring_bulbs(img):
    """The medallion's 16 amber bulbs. Warm, so no blue floor — shape and radius do the work."""
    found = find_bulbs(
        img,
        percentile=98.0,
        min_gap=0.035,
        core_r=6,
        ring_in=13,
        ring_out=19,
        min_core=140,
        min_contrast=22,
        max_span=52,
        min_span=22,
        window=13,
    )
    cx, cy = RING_CENTRE
    lo, hi = RING_BULB_BAND
    aspect = img.height / img.width
    return [
        (fx, fy)
        for fx, fy in found
        if lo <= math.hypot(fx - cx, (fy - cy) * aspect) <= hi
    ]


def mean_colour(img, points, r0, r1):
    """The bulbs' own colour, as an annulus just OUTSIDE the blown-out core.

    Sampling the core gives white on every bulb on both arts, and an additive glow tinted white
    washes the hue out of exactly the thing it is meant to be lighting. The ring of pixels around
    the core is where the bulb's colour actually lives — magenta on the frame, amber on the
    medallion. Normalised to full brightness, since this tints an additive sprite.
    """
    a = np.array(img).astype(float)
    offsets = _offsets(r0, r1)
    picks = []
    for fx, fy in points:
        x, y = int(fx * img.width), int(fy * img.height)
        picks.append(
            np.mean(
                [
                    a[min(img.height - 1, max(0, y + dy)), min(img.width - 1, max(0, x + dx)), :3]
                    for dx, dy in offsets
                ],
                0,
            )
        )
    rgb = np.mean(picks, 0)
    rgb = rgb / rgb.max() * 255
    return (round(rgb[0]) << 16) | (round(rgb[1]) << 8) | round(rgb[2])


def to_panel_space(points, box):
    """Fractions of a part's own image -> fractions of the PANEL box, which is the component's unit."""
    bx, by, bw, bh = box
    px, py, pw, ph = PANEL_BOX
    return [((bx + fx * bw - px) / pw, (by + fy * bh - py) / ph) for fx, fy in points]


def rect(box):
    """A node box as centre + size, in panel fractions."""
    bx, by, bw, bh = box
    px, py, pw, ph = PANEL_BOX
    return {
        'x': (bx + bw / 2 - px) / pw,
        'y': (by + bh / 2 - py) / ph,
        'w': bw / pw,
        'h': bh / ph,
    }


def emit(parts, bulbs, colours):
    def pack(points):
        return ' '.join(f'{x:.4f},{y:.4f}' for x, y in points)

    def as_rect(name, r):
        return (
            f'\t{name}: {{ x: {r["x"]:.5f}, y: {r["y"]:.5f}, '
            f'w: {r["w"]:.5f}, h: {r["h"]:.5f} }},'
        )

    src = [
        '''// GENERATED by scripts/congrats/build_congrats.py. Do not hand-edit.
//
// Layout for the redesigned congratulations panel (Figma 6909:9366), and the centres of the marquee
// bulbs painted into its art so <WinCardLights> can light them.
//
// Every number is a fraction of the PANEL's box, so <CongratsPanel> needs one size and everything
// else follows — the ring's bulbs included, which is why they are stored in panel space rather than
// in the ring's own.

const points = (packed: string): [number, number][] =>
	packed.split(' ').map((pair) => {
		const [x, y] = pair.split(',');
		return [Number(x), Number(y)];
	});

export type PartRect = { x: number; y: number; w: number; h: number };

/** The panel art's own aspect, for sizing it without stretching. */''',
        f'export const CONGRATS_PANEL_ASPECT = {PANEL_BOX[2] / PANEL_BOX[3]:.5f};\n',
        'export const CONGRATS_PARTS = {',
        as_rect('ring', parts['ring']),
        as_rect('p', parts['p']),
        '\t/**',
        "\t * Centre of the medallion's bulb circle, which is NOT its box centre — the ring art hangs",
        '\t * a taller star off the bottom than the top. Mount the ring container here and offset the',
        '\t * sprite, so the chase runs about the circle the bulbs actually sit on.',
        '\t */',
        f'\tringCentre: {{ x: {parts["ringCentre"][0]:.5f}, y: {parts["ringCentre"][1]:.5f} }},',
        '};\n',
        '/** Bulb tint, averaged from the art: lilac on the frame, amber on the medallion. */',
        f'export const CONGRATS_PANEL_BULB_COLOUR = 0x{colours["panel"]:06x};',
        f'export const CONGRATS_RING_BULB_COLOUR = 0x{colours["ring"]:06x};\n',
        '/** Frame rails and the amount well. */',
        f"export const CONGRATS_PANEL_BULBS: [number, number][] = points(\n\t'{pack(bulbs['panel'])}',\n);\n",
        '/** The medallion ring, in panel space — mount inside the ring container with its centre as origin. */',
        f"export const CONGRATS_RING_BULBS: [number, number][] = points(\n\t'{pack(bulbs['ring'])}',\n);",
    ]
    OUT_TS.write_text('\n'.join(src) + '\n')


if __name__ == '__main__':
    images = {name: load(name) for name in ('panel', 'ring', 'p')}
    for name, img in images.items():
        path, size = write_part(name, img)
        print(f'{name:6s} {img.size} -> {size} {os.path.getsize(path) // 1024} KB  {path.name}')

    found = {'panel': panel_bulbs(images['panel']), 'ring': ring_bulbs(images['ring'])}
    colours = {
        'panel': mean_colour(images['panel'], found['panel'], 5, 11),
        'ring': mean_colour(images['ring'], found['ring'], 10, 20),
    }
    print(f'bulbs panel {len(found["panel"])} #{colours["panel"]:06x}  '
          f'ring {len(found["ring"])} #{colours["ring"]:06x}')

    emit(
        {
            'ring': rect(RING_BOX),
            'p': rect(P_BOX),
            'ringCentre': to_panel_space([RING_CENTRE], RING_BOX)[0],
        },
        {
            'panel': found['panel'],
            'ring': to_panel_space(found['ring'], RING_BOX),
        },
        colours,
    )
    print(f'-> {OUT_TS}')

    for name, colour in (('panel', (0, 255, 120)), ('ring', (255, 90, 220))):
        img = images[name]
        preview = Image.new('RGBA', img.size, (12, 12, 12, 255))
        preview.alpha_composite(img)
        preview = preview.convert('RGB')
        draw = ImageDraw.Draw(preview)
        for fx, fy in found[name]:
            x, y = fx * img.width, fy * img.height
            draw.ellipse([x - 11, y - 11, x + 11, y + 11], outline=colour, width=3)
        preview.resize((760, round(760 * img.height / img.width))).save(
            BASE / f'verify_{name}_bulbs.png'
        )
