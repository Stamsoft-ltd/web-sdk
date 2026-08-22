"""Build the TALL congratulations marquee: a circus sign with a purple field inside a gold rail of
painted bulbs, a striped tent top and a little flag. Everything that used to be built into the panel
art (the medallion ring, the gold P, the amount well) is gone: the well is drawn by the component,
and the bonus's own scatter badge takes the medallion's place.

The bonus-COMPLETE screen used to be a second, wide marquee cut here. It is now the shared marquee
PAD — see `scripts/pad/` — which the big-win cards sit on too, so it is generated there instead and
this script owns only the tall one.

    python3 scripts/congrats/build_congrats.py

THE ART IS TALLER THAN THE PANEL, AND THIS SHORTENS IT WITHOUT SQUASHING IT. The drawing is
1608x2412 (0.667) where the panel is drawn at 0.873, and the obvious fix — resize to the panel's
aspect — is exactly what the drawing this replaced was doing, and exactly what made it look wrong:
a 16% horizontal pull turns every bulb into an oval. So instead:

* A BAND IS CUT OUT OF THE MIDDLE OF THE RAIL. Between y=600 and y=2100 the rail runs dead straight
  (27..1580 on every row, verified), so a horizontal join there is invisible. The cut runs from the
  gap after one bulb to the gap after another six down, which removes six whole bulbs and leaves the
  spacing across the join reading as one ordinary pitch. Every bulb that survives is still round.
* THE FIELD IS NOT CUT, IT IS SQUASHED. The purple sunburst radiates from a point, so taking a band
  out of it leaves the rays above the join at a different angle from the rays below — a smear where
  the centre should be, which is visible. Instead the ORIGINAL field is resized into the shortened
  field's box: a squashed radial burst is still a radial burst, just with slightly narrower rays,
  and it converges to a point like it should.

The field is found by flooding purple from the middle, so the gold rail is what stops it, and the
mask is eroded before the swap so the rail's inner edge is never painted over.

Writes the webp marquee and the generated aspect + bulb table `src/game/congratsPanelParts.ts`.
"""

import collections
import os
import pathlib

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

BASE = pathlib.Path(__file__).resolve().parent
APP = pathlib.Path(__file__).resolve().parents[2]
OUT_DIR = APP / 'static/assets/theme-park/v2/popup/congrats'
OUT_TS = APP / 'src/game/congratsPanelParts.ts'

#: The band to take out of the rail, in source pixels. Both edges sit in a GAP between bulbs, six
#: bulbs apart, inside the straight run — see the module docstring. Run with `--measure` to list
#: every candidate and what aspect each leaves; do not nudge these by eye.
SEAM = (620, 1129)

#: Where the sign has to LAND, measured off the marquee this replaced: the canvas aspect, and the
#: box the drawing occupies inside it, as fractions of the canvas.
#:
#: Every number in <CongratsPanel>'s `tall` layout is a fraction of the marquee sprite's box, so the
#: headline, the blurb, the badge and the well all sit where they do because the rail sat where it
#: did. Matching the old geometry here is what lets the art be replaced without re-deriving a dozen
#: Figma-measured constants — and it is why the residual 1.2% of vertical give (the shortened
#: drawing comes out at 0.8701 against the old 0.8593) is taken as a stretch rather than argued
#: away. That is a pixel on a bulb, where fitting the WHOLE drawing to the panel's aspect — which is
#: what the art this replaces was doing — was 16%, and is why its bulbs were ovals.
CANVAS_ASPECT = 0.87298
INK_BOX = (0.04980, 0.03581, 0.95020, 0.95055)

#: Rendered width to ship the marquee at. It is drawn a little over 500 of the design's 1200 frame,
#: i.e. ~850px on a 1920 stage; 1024 covers that with headroom and no more.
WIDTH = 1024


def load(name):
    """The artist's marquee drawing, kept as lossless webp.

    Committed alongside the script rather than left in a working directory: a pipeline that cannot
    be re-run is a pipeline nobody re-runs.
    """
    return Image.open(BASE / 'source' / f'marquee-{name}.webp').convert('RGBA')


def field_mask(img):
    """The purple interior, flooded from the centre outward so the gold rail is what stops it.

    A colour test alone would also take the rail's dark purple outline and the drop shadow, which
    are the same purple and are on the WRONG side of the rail. Reachability is what separates them.
    """
    a = np.asarray(img).astype(int)
    h, w, _ = a.shape
    red, green, blue, alpha = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    purple = (alpha > 128) & (blue > red + 20) & (blue > green + 40)

    seen = np.zeros((h, w), bool)
    start = (h // 2, w // 2)
    if not purple[start]:
        raise SystemExit('the middle of the marquee is not purple — has the art changed?')
    queue = collections.deque([start])
    seen[start] = True
    while queue:
        y, x = queue.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and purple[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                queue.append((ny, nx))
    return seen


def _bbox(mask):
    ys, xs = np.nonzero(mask)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def shortened(img):
    """The drawing with a band taken out of its rail and its sunburst squashed to suit."""
    top = img.crop((0, 0, img.width, SEAM[0]))
    bottom = img.crop((0, SEAM[1], img.width, img.height))
    cut = Image.new('RGBA', (img.width, top.height + bottom.height), (0, 0, 0, 0))
    cut.paste(top, (0, 0))
    cut.paste(bottom, (0, top.height))

    # Put the WHOLE original field back inside the shortened one, so the burst still converges to a
    # point instead of carrying the join.
    was, now = _bbox(field_mask(img)), field_mask(cut)
    box = _bbox(now)
    squashed = Image.new('RGBA', cut.size, (0, 0, 0, 0))
    squashed.paste(img.crop(was).resize((box[2] - box[0], box[3] - box[1]), Image.LANCZOS),
                   (box[0], box[1]))

    # Eroded, so the rail's anti-aliased inner edge stays the rail's and does not get a seam of its
    # own where the two images disagree by a pixel.
    inside = now
    for _ in range(3):
        inside = (inside & np.roll(inside, 1, 0) & np.roll(inside, -1, 0)
                  & np.roll(inside, 1, 1) & np.roll(inside, -1, 1))
    joined = np.asarray(cut).copy()
    joined[inside] = np.asarray(squashed)[inside]
    return Image.fromarray(joined, 'RGBA')


def to_panel(img):
    """The shortened drawing, placed on the canvas the panel's layout expects. See INK_BOX."""
    ink = np.asarray(img)[..., 3] > 8
    ys, xs = np.nonzero(ink)
    drawing = img.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))

    height = round(WIDTH / CANVAS_ASPECT)
    x0, y0, x1, y1 = INK_BOX
    box = (round(x0 * WIDTH), round(y0 * height), round(x1 * WIDTH), round(y1 * height))
    canvas = Image.new('RGBA', (WIDTH, height), (0, 0, 0, 0))
    canvas.paste(drawing.resize((box[2] - box[0], box[3] - box[1]), Image.LANCZOS), box[:2])
    return canvas


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
        if all((px - kx) ** 2 + (py - ky) ** 2 >= gap * gap for kx, ky, _ in kept):
            kept.append((px, py, (ew + eh) / 2))
    return (
        [(x / img.width, y / img.height) for x, y, _ in kept],
        float(np.mean([d for _, _, d in kept])) / img.width,
    )


#: Thresholds for this rail at 1024 wide, where its bulbs measure about 24px.
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
        # In WIDTH units on both axes — <WinCardLights> multiplies x and y by the one size it is
        # given — with the origin at the art's CENTRE, which is where the component mounts them and
        # the point the chase runs around.
        return ' '.join(f'{x - 0.5:.4f},{(y - 0.5) / aspect:.4f}' for x, y in points)

    body = [
        '''// GENERATED by scripts/congrats/build_congrats.py. Do not hand-edit.
//
// The tall congratulations marquee (Figma 7033:24761, bonus won) and the centres of the bulbs
// painted into its rail, so <WinCardLights> can light them.
//
// Distances are fractions of the marquee's WIDTH on BOTH axes — <WinCardLights> scales x and y by
// the single size it is given — with the origin at the art's centre.
//
// The bonus-COMPLETE screen is not here: it shares the marquee pad with the big-win cards, and that
// is generated by scripts/pad/build_pad.py into game/padMarquee.ts.

const points = (packed: string): [number, number][] =>
	packed.split(' ').map((pair) => {
		const [x, y] = pair.split(',');
		return [Number(x), Number(y)];
	});

export type MarqueeArt = {
	/** width / height of the art as the design draws it, for sizing it without stretching. */
	aspect: number;
	/** Bulb tint, averaged from the rail. */
	bulbColour: number;
	/**
	 * What the glow is sized off, in width units: the diameter of the bulb's bright core. On this
	 * art the bulbs are painted lit and fade into the rail, so the core is a good deal smaller than
	 * the disc a viewer would call the bulb.
	 */
	bulb: number;
	bulbs: [number, number][];
};
''',
    ]
    entries = []
    for name, (aspect, colour, diameter, bulbs) in marquees.items():
        entries.append(
            f'\t{name}: {{\n'
            f'\t\taspect: {aspect:.5f},\n'
            f'\t\tbulbColour: 0x{colour:06x},\n'
            f'\t\tbulb: {diameter:.5f},\n'
            f"\t\tbulbs: points(\n\t\t\t'{pack(bulbs, aspect)}',\n\t\t),\n"
            f'\t}},'
        )
    body.append(
        'export const CONGRATS_MARQUEES: Record<string, MarqueeArt> = {\n'
        + '\n'.join(entries)
        + '\n};\n'
    )
    OUT_TS.write_text('\n'.join(body))


def measure(img):
    """Print what SEAM has to be derived from: the straight run, and the bulbs down the left rail."""
    ink = np.asarray(img)[..., 3] > 8
    edges = {}
    for y in range(img.height):
        xs = np.nonzero(ink[y])[0]
        if len(xs):
            edges[y] = (int(xs.min()), int(xs.max()))
    widest = collections.Counter(edges.values()).most_common(1)[0][0]
    rows = sorted(y for y, e in edges.items() if e == widest)
    print(f'rail runs straight at x {widest[0]}..{widest[1]} for rows {rows[0]}..{rows[-1]}')

    a = np.asarray(img).astype(float)
    lum = a[..., :3].mean(2) * (a[..., 3] / 255)
    column = widest[0] + int(np.argmax(lum[:, widest[0]:widest[0] + img.width // 8].mean(axis=0)))
    line = lum[:, column - 3:column + 4].mean(axis=1)
    bulbs = []
    for y in range(2, img.height - 2):
        peak = line[y] >= line[y - 1] and line[y] >= line[y + 1]
        if line[y] > 170 and peak and line[y] > line[y - 2] and line[y] > line[y + 2]:
            if not bulbs or y - bulbs[-1] > 20:
                bulbs.append(y)
    gaps = np.diff(bulbs)
    print(f'{len(bulbs)} bulbs down x={column}, pitch {np.median(gaps):.0f} '
          f'({gaps.min()}..{gaps.max()})')
    print('SEAM candidates removing six bulbs, from gap to gap inside the straight run:')
    for i in range(len(bulbs) - 7):
        lo, hi = (bulbs[i] + bulbs[i + 1]) // 2, (bulbs[i + 6] + bulbs[i + 7]) // 2
        if lo < rows[0] or hi > rows[-1]:
            continue
        tall = img.height - (hi - lo)
        print(f'  SEAM = ({lo}, {hi})  removes {hi - lo:4d}  leaves {tall}  '
              f'aspect {img.width / tall:.4f}')


if __name__ == '__main__':
    import sys

    if '--measure' in sys.argv:
        measure(load('tall'))
        raise SystemExit

    marquees = {}
    for name in ('tall',):
        img = to_panel(shortened(load(name)))
        path = write_part(name, img)
        found, diameter = find_bulbs(img, **BULBS)
        colour = mean_colour(img, found, 7, 14)
        aspect = img.width / img.height
        marquees[name] = (aspect, colour, diameter, found)
        print(
            f'{name:5s} {img.size} aspect {aspect:.4f}  bulbs {len(found):3d} '
            f'disc {diameter:.5f}w  #{colour:06x}  {os.path.getsize(path) // 1024:4d} KB  {path.name}'
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
