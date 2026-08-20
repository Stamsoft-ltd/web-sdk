"""Cut the congratulations marquees (Figma 7033:24761 and 7032:19821) out of the design's art.

The 2026-08-20 redesign replaced the ornate square panel with two circus marquees — a TALL one for
the bonus-won screen and a WIDE cloud for the bonus-complete screen — each a purple field inside a
gold rail of painted bulbs, with a striped tent top and a little flag. Everything that used to be
built into the panel art (the medallion ring, the gold P, the amount well) is gone: the well is now
drawn by the component, and the bonus's own scatter badge takes the medallion's place.

    python3 scripts/congrats/build_congrats.py

Three things are worth knowing before touching this:

* **The node box is the placement, and the tall one is STRETCHED into it.** The wide raw already has
  its node box's aspect; the tall raw is 1086x1448 (0.750) in a 524x600 box (0.873), i.e. pulled 16%
  wider. That is what the design renders, so it is what ships — the stretch is baked in HERE, by
  resizing to the box's aspect, rather than left for the component to do. Doing it offline means the
  bulb centres are found in the shipped image's own space and a round glow still lands on a bulb.
* It does not trim. Trimming would move every bulb by the margin and buy nothing.
* It does not take the node `export`, which comes back with the frame's fill baked in and fully
  opaque. `source/` holds the `rawImages` entries — the largest one with actual transparency.

Writes the webp marquees and the generated aspect + bulb table `src/game/congratsPanelParts.ts`.
"""

import os
import pathlib

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

BASE = pathlib.Path(__file__).resolve().parent
APP = pathlib.Path(__file__).resolve().parents[2]
OUT_DIR = APP / 'static/assets/theme-park/v2/popup/congrats'
OUT_TS = APP / 'src/game/congratsPanelParts.ts'

#: Node boxes as Figma reports them. Only the aspect is used — the box is what the art is drawn at,
#: and every fraction the component places is of the panel's own box.
BOXES = {
    'tall': (524, 600),  # 7033:24760 in frame 7033:24761
    'wide': (532, 377),  # 7032:20069 in frame 7032:19821
}

#: Rendered width to ship each marquee at. Both are drawn a little over 500 of the design's 1200
#: frame, i.e. ~850px on a 1920 stage; 1024 covers that with headroom and no more.
WIDTH = 1024


def load(name):
    """The Figma raw for a marquee, kept as lossless webp.

    Committed alongside the script rather than left in a working directory: the URLs Figma hands out
    expire after a week, and a pipeline that cannot be re-run is a pipeline nobody re-runs.
    """
    return Image.open(BASE / 'source' / f'marquee-{name}.webp').convert('RGBA')


def to_box(img, name):
    """The raw at the aspect its node box gives it, shipped-size. See the stretch note above."""
    bw, bh = BOXES[name]
    return img.resize((WIDTH, round(WIDTH * bh / bw)), Image.LANCZOS)


def write_part(name, img):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / f'marquee-{name}.webp'
    img.save(path, 'WEBP', quality=90, method=6)
    return path


# ── Bulb finding ────────────────────────────────────────────────────────────────────────────────
#
# Same shape of problem as the win cards and the old panel: the bulbs are PAINTED into the art, so
# lighting them means finding their centres here and letting <WinCardLights> draw a glow on each.
#
# A bulb is a compact ROUND bright blob. The compactness test is the one that matters — without it
# the gold rail's specular highlights qualify, because a highlight running along a curl is a local
# maximum whose surroundings are darker.


def peaks(img, percentile, window=9):
    """Every local maximum above the percentile, brightest first. NOT thinned by distance.

    Candidates are thinned only after the bulb test has run, so a stray speck sitting beside a bulb
    can never suppress it.
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


def _core_rgb(rgba, x, y, r):
    h, w = rgba.shape[:2]
    return np.mean(
        [rgba[min(h - 1, max(0, y + dy)), min(w - 1, max(0, x + dx)), :3] for dx, dy in _offsets(0, r)],
        0,
    )


def find_bulbs(img, *, percentile, min_gap, core_r, ring_in, ring_out, min_core, min_contrast,
               max_span, min_span=0, min_core_green=0.0, window=9):
    """Bulb centres as fractions of the image."""
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
        red, green, _blue = _core_rgb(rgba, x, y, core_r)
        if green < min_core_green * max(red, 1.0):
            continue
        ew, eh = _extent(lum, x, y, max_span)
        if not (min_span <= min(ew, eh) and max(ew, eh) <= max_span and 0.5 <= ew / eh <= 2.0):
            continue
        if all((px - kx) ** 2 + (py - ky) ** 2 >= gap * gap for kx, ky in kept):
            kept.append((px, py))
    return [(x / img.width, y / img.height) for x, y in kept]


#: One set of thresholds for both marquees: same artist, same rail, both shipped 1024 wide, so the
#: bulbs measure about the same on each (~24px).
#:
#: `min_core_green` is this art's own discriminator. The only things that survive the roundness test
#: without being bulbs are the white wedges of the striped tent, which are a round-ish bright blob at
#: this scale; but they sit in the tent's red shade, so their core is pink (G/R 0.68) while a lit
#: bulb's core is blown out towards white (G/R 0.82 and up on every real one).
BULBS = dict(
    percentile=98.0,
    min_gap=0.018,
    core_r=6,
    ring_in=12,
    ring_out=18,
    min_core=150,
    min_contrast=22,
    max_span=34,
    min_span=8,
    min_core_green=0.78,
    window=11,
)


def mean_colour(img, points, r0, r1):
    """The bulbs' own colour, as an annulus just OUTSIDE the blown-out core.

    Sampling the core gives white on every bulb, and an additive glow tinted white washes the hue
    out of exactly the thing it is meant to be lighting. The ring of pixels around the core is where
    the bulb's colour lives. Normalised to full brightness, since this tints an additive sprite.
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


def emit(marquees):
    def pack(points, aspect):
        # In WIDTH units, both axes: <WinCardLights> multiplies x and y by the one size it is given.
        return ' '.join(f'{x:.4f},{y / aspect:.4f}' for x, y in points)

    body = [
        '''// GENERATED by scripts/congrats/build_congrats.py. Do not hand-edit.
//
// The two congratulations marquees (Figma 7033:24761 bonus won, 7032:19821 bonus complete) and the
// centres of the bulbs painted into their rails, so <WinCardLights> can light them.
//
// Distances are fractions of the marquee's WIDTH on BOTH axes — <WinCardLights> scales x and y by
// the single size it is given — so `centre.y` is half the aspect-corrected height, not 0.5.

const points = (packed: string): [number, number][] =>
	packed.split(' ').map((pair) => {
		const [x, y] = pair.split(',');
		return [Number(x), Number(y)];
	});

export type MarqueeArt = {
	/** width / height of the art as the design draws it, for sizing it without stretching. */
	aspect: number;
	/** The art's own centre, in width units — pass as <WinCardLights>'s origin. */
	centre: { x: number; y: number };
	/** Bulb tint, averaged from the rail. */
	bulbColour: number;
	bulbs: [number, number][];
};
''',
    ]
    entries = []
    for name, (aspect, colour, bulbs) in marquees.items():
        entries.append(
            f'\t{name}: {{\n'
            f'\t\taspect: {aspect:.5f},\n'
            f'\t\tcentre: {{ x: 0.5, y: {0.5 / aspect:.5f} }},\n'
            f'\t\tbulbColour: 0x{colour:06x},\n'
            f"\t\tbulbs: points(\n\t\t\t'{pack(bulbs, aspect)}',\n\t\t),\n"
            f'\t}},'
        )
    body.append(
        'export const CONGRATS_MARQUEES: Record<string, MarqueeArt> = {\n'
        + '\n'.join(entries)
        + '\n};\n'
    )
    OUT_TS.write_text('\n'.join(body))


if __name__ == '__main__':
    marquees = {}
    for name in ('tall', 'wide'):
        img = to_box(load(name), name)
        path = write_part(name, img)
        found = find_bulbs(img, **BULBS)
        colour = mean_colour(img, found, 7, 14)
        aspect = img.width / img.height
        marquees[name] = (aspect, colour, found)
        print(
            f'{name:5s} {img.size} aspect {aspect:.4f}  bulbs {len(found):3d} '
            f'#{colour:06x}  {os.path.getsize(path) // 1024:4d} KB  {path.name}'
        )

        preview = Image.new('RGBA', img.size, (12, 12, 12, 255))
        preview.alpha_composite(img)
        preview = preview.convert('RGB')
        draw = ImageDraw.Draw(preview)
        for fx, fy in found:
            x, y = fx * img.width, fy * img.height
            draw.ellipse([x - 13, y - 13, x + 13, y + 13], outline=(0, 255, 120), width=3)
        preview.resize((760, round(760 * img.height / img.width))).save(
            BASE / f'verify_{name}_bulbs.png'
        )

    emit(marquees)
    print(f'-> {OUT_TS}')
