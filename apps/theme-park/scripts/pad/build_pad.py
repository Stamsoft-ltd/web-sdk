"""Cut the marquee PAD — the circus sign the big-win cards and the bonus-complete screen sit on.

    python3 scripts/pad/build_pad.py

One piece of art, two screens. It ships twice, at the size each screen needs:

| screen                        | asset                                        | component        |
| ----------------------------- | -------------------------------------------- | ---------------- |
| tiered big win                | `v2/wins/marquee/plate.webp`                  | `<WinCard>`      |
| bonus complete ("congrats 2") | `v2/popup/congrats/marquee-wide.webp`         | `<CongratsPanel>`|

Both used to carry a rendered, pre-lit sign whose bulbs were already blown out in the art, and whose
silhouette was lumpy and out of symmetry. This replaces it with the flat drawing: solid fields, a
flat orange rail, and bulbs that are plain cream discs. Nothing in the art is lit — the lighting is
`<WinCardLights>` drawing a core and a halo on every disc, which is why the discs are found here.

## What comes out

`src/game/padMarquee.ts`, generated. Everything in it is in **pad-width units with the origin at the
pad's centre**, both axes — the one convention `<WinCardLights>` wants, and the one that lets the two
screens size the sign with a single number each.

* `PAD_ASPECT` — width / height, so neither screen has to stretch it.
* `PAD_BULBS` — every cream disc's centre.
* `PAD_BULB` — the disc's diameter and the colour to light it with.
* `PAD_FIELD` — the purple field inside the rail, which is where copy has to land.
* `PAD_PLATE` — the win card's plate rect, in that card's own space (see below).

## Two things worth knowing

* **The plate rect is pinned by the FIELD, not by the art's box.** `<WinCard>` measures every other
  piece — the wordmark, the stars, the amount — in fractions of the card's width from the plate's
  centre (`winCardMarquee.ts`, generated from Figma). The pad is a different shape from the sign
  those numbers were measured against, so lining up the two boxes would drop the wordmark off the
  field. `FIELD_CENTRE_Y` is where the design's field centre sits in card space; the plate is placed
  so the pad's field centre lands there, and every Figma-measured piece stays where it was.
* **The field is measured down the CENTRE COLUMN**, not by bounding box. The sign's silhouette is a
  cloud — the bottom lobes reach much lower than the middle does, and one of them lower than the
  other — so a bbox says the field is far taller than the part of it copy can actually use.
"""

import pathlib

import numpy as np
from PIL import Image, ImageDraw
from collections import deque

BASE = pathlib.Path(__file__).resolve().parent
APP = pathlib.Path(__file__).resolve().parents[2]
SOURCE = BASE / 'source' / 'pad.webp'
OUT_TS = APP / 'src/game/padMarquee.ts'

#: Where each screen ships it, and how wide. The win card fills the board with it, so it carries the
#: most detail; the bonus-complete marquee is drawn a little over 500 of the design's 1200 frame,
#: i.e. ~850px on a 1920 stage, which 1024 covers with headroom and no more.
OUTPUTS = [
    (APP / 'static/assets/theme-park/v2/wins/marquee/plate.webp', 1400),
    (APP / 'static/assets/theme-park/v2/popup/congrats/marquee-wide.webp', 1024),
]

#: The win card's plate width, in card widths. Unchanged from the sign this replaces: it is what
#: makes the card the same size on screen, and `ASSEMBLY_W` in <Win> is set against it.
PLATE_W = 0.97985
#: And where the design puts the middle of the plate's field, in card space — derived from the Figma
#: card (`winCardMarquee.ts`): plate y -0.02179, h 0.58532, field spanning 0.2936-0.8473 of the art.
#: Every other piece of the card is measured off this, so it is what the pad is pinned to.
FIELD_CENTRE_Y = 0.01945

# ── The art's own colours ───────────────────────────────────────────────────────────────────────
#
# Flat art, so these are exact rather than thresholds around a gradient. The one that needs care is
# the field against the outline: both are purple and they differ mainly in RED (field 44-54, outline
# 24), which is why the test is on that channel rather than on brightness.
FIELD = lambda a: (a[..., 3] > 200) & (a[..., 0] >= 36) & (a[..., 0] < 90) & (a[..., 2] > 110)
BULB = lambda a: (a[..., 3] > 128) & (a[..., 0] > 225) & (a[..., 1] > 215) & (a[..., 2] > 170)

#: A cream disc is ~1350px at this size. The tent's white stripes pass the colour test too and are
#: ~10000px, so area alone would nearly do it; roundness is kept as the check that actually says
#: "disc", so a future edit to the tent cannot quietly add four bulbs to the rail.
BULB_AREA = (400, 4000)
BULB_RATIO = (0.6, 1.6)
BULB_FILL = 0.6  # area / bbox area; a disc is pi/4 = 0.785, a stripe wedge is far less


def components(mask):
    """Connected components of a boolean mask as (area, x0, y0, x1, y1, cx, cy), largest first.

    Walks only the set pixels — the mask is a few discs on a big canvas, and scanning the canvas
    row by row is a hundred times the work.
    """
    ys, xs = np.nonzero(mask)
    todo = set(zip(ys.tolist(), xs.tolist()))
    out = []
    while todo:
        queue = deque([todo.pop()])
        blob = []
        while queue:
            cy, cx = queue.popleft()
            blob.append((cy, cx))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    point = (cy + dy, cx + dx)
                    if point in todo:
                        todo.discard(point)
                        queue.append(point)
        by = [p[0] for p in blob]
        bx = [p[1] for p in blob]
        out.append(
            (len(blob), min(bx), min(by), max(bx) + 1, max(by) + 1, sum(bx) / len(blob), sum(by) / len(blob))
        )
    out.sort(reverse=True)
    return out


def find_bulbs(rgba):
    """Disc centres in pixels, plus the mean disc diameter."""
    kept = []
    for area, x0, y0, x1, y1, cx, cy in components(BULB(rgba)):
        w, h = x1 - x0, y1 - y0
        if not BULB_AREA[0] < area < BULB_AREA[1]:
            continue
        if not BULB_RATIO[0] <= w / h <= BULB_RATIO[1]:
            continue
        if area / (w * h) < BULB_FILL:
            continue
        kept.append((cx, cy, (w + h) / 2))
    # Left to right, top to bottom. Nothing reads them in order, but a stable order keeps the diff
    # of a regenerated table down to the numbers that actually moved.
    kept.sort(key=lambda b: (round(b[1], -1), b[0]))
    return [(x, y) for x, y, _ in kept], float(np.mean([d for _, _, d in kept]))


def bulb_colour(rgba, bulbs, radius):
    """The colour to light a disc with: its own cream, warmed by the rail it is set into.

    The discs are flat #f0f0d8 — a glow tinted with that alone is white light, and white light on a
    warm sign reads as a blown-out screenshot rather than as bulbs. Mixing in the rail underneath
    pulls it back to the amber the sign is actually made of. Normalised to full brightness, since
    this tints an additive sprite.
    """
    h, w = rgba.shape[:2]
    cores, rails = [], []
    for x, y in bulbs:
        x, y = int(x), int(y)
        core = [(dx, dy) for dx in range(-3, 4) for dy in range(-3, 4)]
        # Clear of the disc's own edge — the rail this samples is what warms the light, and an
        # annulus that still straddles the cream just gives the cream back.
        ring = [
            (dx, dy)
            for dx in range(-int(radius * 1.8), int(radius * 1.8) + 1)
            for dy in range(-int(radius * 1.8), int(radius * 1.8) + 1)
            if (radius * 1.25) ** 2 <= dx * dx + dy * dy <= (radius * 1.8) ** 2
        ]
        for offsets, sink in ((core, cores), (ring, rails)):
            sink.append(
                np.mean(
                    [rgba[min(h - 1, max(0, y + dy)), min(w - 1, max(0, x + dx)), :3] for dx, dy in offsets],
                    0,
                )
            )
    rgb = (np.mean(cores, 0) + np.mean(rails, 0)) / 2
    rgb = rgb / rgb.max() * 255
    return (round(rgb[0]) << 16) | (round(rgb[1]) << 8) | round(rgb[2])


def field_span(rgba):
    """The purple field down the pad's centre column, and its widest row, as image fractions."""
    mask = FIELD(rgba)
    h, w = mask.shape
    column = mask[:, w // 2 - 2 : w // 2 + 3].any(1)
    rows = np.nonzero(column)[0]
    widest = mask[np.argmax(mask.sum(1))]
    cols = np.nonzero(widest)[0]
    return {
        'top': rows.min() / h,
        'bottom': rows.max() / h,
        'left': cols.min() / w,
        'right': cols.max() / w,
    }


def emit(aspect, bulbs, diameter, colour, field, plate):
    def point(x, y):
        return f'{x:.5f},{y:.5f}'

    packed = ' '.join(point(x, y) for x, y in bulbs)
    text = f'''// GENERATED by scripts/pad/build_pad.py — see the README there. Do not hand-edit.
//
// The marquee PAD: the circus sign under the big-win cards and the bonus-complete screen.
//
// Everything here is in PAD-WIDTH units on BOTH axes with the origin at the pad's centre, which is
// the convention <WinCardLights> wants and what lets each screen size the sign with one number.

const points = (packed: string): [number, number][] =>
	packed.split(' ').map((pair) => {{
		const [x, y] = pair.split(',');
		return [Number(x), Number(y)];
	}});

/** Width / height of the art, so neither screen has to stretch it. */
export const PAD_ASPECT = {aspect:.5f};

/**
 * The purple field inside the rail — where copy has to land. Measured down the CENTRE COLUMN, not
 * by bounding box: the silhouette is a cloud whose bottom lobes drop well below the middle, and a
 * bbox would promise height that nothing can be written in.
 */
export const PAD_FIELD = {{
	top: {field['top']:.5f},
	bottom: {field['bottom']:.5f},
	left: {field['left']:.5f},
	right: {field['right']:.5f},
}};

/** Half the field's usable height, and its middle — the two figures every screen places copy from. */
export const PAD_FIELD_CENTRE = {field['centre']:.5f};
export const PAD_FIELD_HEIGHT = {field['height']:.5f};

/**
 * The bulb as the art draws it: an unlit cream disc. `size` is its diameter, so a glow can be sized
 * off the thing it is lighting rather than off a number that has to be re-tuned whenever the sign
 * is re-exported at a different width.
 */
export const PAD_BULB = {{ size: {diameter:.5f}, colour: 0x{colour:06x} }};

/** Every disc's centre. Nothing in the art is lit — <WinCardLights> is the lighting. */
export const PAD_BULBS: [number, number][] = points(
	'{packed}',
);

/**
 * The pad as <WinCard>'s plate, in that card's space: fractions of the CARD width from the plate's
 * centre. Pinned so the pad's field centre lands where the Figma card put it, which is what keeps
 * the wordmark, the stars and the amount — all measured against that card — where they were.
 */
export const PAD_PLATE = {{ x: 0, y: {plate['y']:.5f}, w: {plate['w']:.5f}, h: {plate['h']:.5f} }};
'''
    OUT_TS.write_text(text)


def main():
    art = Image.open(SOURCE).convert('RGBA')
    rgba = np.asarray(art).astype(int)
    width, height = art.size
    aspect = width / height

    bulbs_px, diameter = find_bulbs(rgba)
    colour = bulb_colour(rgba, bulbs_px, diameter / 2)
    #: Pad-width units from the pad's centre, on both axes.
    bulbs = [((x - width / 2) / width, (y - height / 2) / width) for x, y in bulbs_px]

    span = field_span(rgba)
    field = {
        'top': (span['top'] - 0.5) / aspect,
        'bottom': (span['bottom'] - 0.5) / aspect,
        'left': span['left'] - 0.5,
        'right': span['right'] - 0.5,
    }
    field['centre'] = (field['top'] + field['bottom']) / 2
    field['height'] = field['bottom'] - field['top']

    plate_h = PLATE_W / aspect
    plate = {
        'w': PLATE_W,
        'h': plate_h,
        # The pad's field centre, in card units below the plate's centre, put at the design's.
        'y': FIELD_CENTRE_Y - field['centre'] * PLATE_W,
    }

    for path, out_width in OUTPUTS:
        path.parent.mkdir(parents=True, exist_ok=True)
        art.resize((out_width, round(out_width / aspect)), Image.LANCZOS).save(
            path, 'WEBP', quality=92, method=6
        )
        print(f'{out_width:5d}px  {path.stat().st_size // 1024:4d} KB  {path.relative_to(APP)}')

    emit(aspect, bulbs, diameter / width, colour, field, plate)
    print(f'aspect {aspect:.4f}  bulbs {len(bulbs)}  disc {diameter / width:.5f}w  #{colour:06x}')
    print(f"field  y {field['top']:+.4f} .. {field['bottom']:+.4f}  (centre {field['centre']:+.4f})")
    print(f"plate  y {plate['y']:+.5f}  h {plate['h']:.5f}")
    print(f'-> {OUT_TS.relative_to(APP)}')

    preview = Image.new('RGBA', art.size, (18, 5, 32, 255))
    preview.alpha_composite(art)
    draw = ImageDraw.Draw(preview)
    for x, y in bulbs_px:
        r = diameter * 0.62
        draw.ellipse([x - r, y - r, x + r, y + r], outline=(0, 255, 120, 255), width=5)
    for edge in ('top', 'bottom'):
        y = span[edge] * height
        draw.line([0, y, width, y], fill=(255, 80, 200, 255), width=4)
    preview.convert('RGB').resize((1200, round(1200 / aspect))).save(BASE / 'verify_pad.png')


if __name__ == '__main__':
    main()
