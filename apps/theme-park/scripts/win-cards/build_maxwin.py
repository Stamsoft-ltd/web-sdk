"""Cut the MAX WIN card (Figma 6090:4147) into the pieces the game flies in from off screen.

The design is one glued-together lockup: a bulb-framed purple plate carrying the MAX WIN wordmark
and the amount lozenge, with a duck bust over it, a coaster loop and a ferris wheel behind it,
balloons, tents and stars hung off both shoulders, and the THEME PARK logo across the foot. Nothing
about it moves in Figma — the brief was to take it apart and have the parts arrive.

Inputs are the transparent Figma raws (see README). Outputs are the webps under
`static/assets/theme-park/v2/wins/maxwin/` and `src/game/maxWinCard.ts`.

Three things worth knowing before touching this:

* Five of the eleven pieces are whole images whose Figma node box IS their drawn rect — every one of
  those boxes has exactly its source image's aspect ratio, which is how we know. Their placement is
  read straight off `get_metadata` and needs no searching.
* The other six are CROPS out of three two-up sheets (tents, stars, balloons), so their node boxes
  are clip windows and say nothing about where the art lands. Those placements were fitted against
  the 1200x670 design render and are baked into DESIGN below; the fitting harness lives in the
  scratchpad, not here, because it only ever has to run once per design.
* THEME PARK is NOT cut from this design. It is the splash logo, already shipped, and re-cutting it
  would put a second copy of a 90 kB file in the bundle for no visible difference.
"""

import json
import os
import pathlib

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

BASE = pathlib.Path(__file__).resolve().parent
APP = pathlib.Path(__file__).resolve().parents[2]
OUT = APP / 'static/assets/theme-park/v2/wins/maxwin'
RAW = pathlib.Path(
    os.environ.get(
        'MAXWIN_RAW',
        '/private/tmp/claude-501/-Users-stanislavmilev-Development-stake-forestSlot-apps/'
        'ea92fc9d-b824-40df-b335-34de90db0321/scratchpad/maxraw',
    )
)

# The THEME PARK logo, reused rather than re-cut. Its rect still has to be in the layout table, so
# the card can place it; only its pixels come from somewhere else.
LOGO_SRC = APP / 'static/assets/theme-park/v2/splash/logo.webp'

# === Design geometry — every piece's TRIMMED ink on the 1200x670 design frame ===
#
# The plate is the unit, exactly as on the marquee card: its width is one "card width" and its
# centre is the origin, so one number in the game sizes the whole assembly.
DESIGN = {
    'coaster': (203.7, 40.9, 400.4, 274.5),
    'wheel': (591.5, 2.3, 277.9, 325.7),
    'balloonL': (222.0, 194.0, 172.0, 253.0),
    'balloonR': (753.0, 202.0, 166.0, 247.0),
    'tentL': (220.5, 371.0, 163.0, 224.0),
    'tentR': (758.0, 379.0, 161.0, 223.0),
    'plate': (296.2, 215.3, 531.3, 352.0),
    'duck': (440.1, 55.5, 263.3, 183.1),
    'word': (364.4, 214.5, 389.5, 234.6),
    'starL': (310.0, 380.0, 91.0, 89.0),
    'starR': (734.0, 386.0, 96.0, 96.0),
    'logo': (283.0, 541.0, 508.0, 103.0),
}

# The clear inner field of the lozenge painted into the plate art — where the amount is typed. Read
# off the design render rather than off the Figma text node, which is only as big as the sample
# number "1,234.00" happened to be.
AMOUNT_BOX = (355.0, 468.0, 425.0, 69.0)

# Which raw each piece comes from. A sheet holds two pieces side by side; `side` picks the column.
SOURCES = {
    'plate': ('plate.png', None),
    'word': ('word.png', None),
    'duck': ('duck.png', None),
    'coaster': ('coaster.png', None),
    'wheel': ('wheel.png', None),
    'tentL': ('sheet-tents.png', 0),
    'tentR': ('sheet-tents.png', 1),
    'starL': ('sheet-stars.png', 0),
    'starR': ('sheet-stars.png', 1),
    'balloonL': ('sheet-balloons.png', 0),
    'balloonR': ('sheet-balloons.png', 1),
}

#: Device pixels across the whole card at the largest size the game draws it. Every piece is
#: exported at its share of that, and never upscaled past its own source.
CARD_PX = 1400

# Bulbs painted into the art, lit from code so the card can chase and flash them. Only the plate
# frame and the wordmark: the tents, stars and rides carry bulbs too, but they are small enough on
# screen that a glow on each reads as noise rather than as light.
BULB_PERCENTILE = 98.0
BULB_GAP = 0.016
#: Pale cut for the wordmark only — see `peaks`. The plate's frame needs none: its bulbs are the
#: only bright thing on it, and its gold is dark enough not to reach the percentile.
WORD_MIN_BLUE = 150


def trim(img):
    """Ink bbox and the trimmed image. Alpha 8, not 0: these exports carry a haze of near-zero
    alpha well outside the art and trimming on >0 keeps almost the whole canvas."""
    a = img.getchannel('A').point(lambda v: 255 if v > 8 else 0)
    box = a.getbbox()
    return img.crop(box)


def column_runs(img, min_width=20):
    """Columns of the image that hold ink, as (x0, x1) runs — how a two-up sheet is split."""
    ink = np.asarray(img.getchannel('A')) > 16
    cols = ink.any(0)
    runs = []
    start = None
    for x, filled in enumerate(cols):
        if filled and start is None:
            start = x
        elif not filled and start is not None:
            runs.append((start, x))
            start = None
    if start is not None:
        runs.append((start, len(cols)))
    return [r for r in runs if r[1] - r[0] >= min_width]


def load(name):
    source, side = SOURCES[name]
    img = Image.open(RAW / source).convert('RGBA')
    if side is None:
        return trim(img)
    runs = column_runs(img)
    if len(runs) != 2:
        raise SystemExit(f'{source}: expected 2 pieces side by side, found {len(runs)}')
    x0, x1 = runs[side]
    return trim(img.crop((x0, 0, x1, img.height)))


def peaks(img, percentile, min_gap, window=9, min_blue=0):
    """Brightness peaks at least `min_gap` (fraction of the long edge) apart — the painted bulbs.

    `min_blue` throws away everything that is not PALE. A lit bulb is close to white; the gold rim
    running along the top of every letter is as bright but far more saturated, and on brightness
    alone the wordmark comes back with a bulb every few pixels along each stroke.
    """
    a = np.array(img).astype(float)
    lum = a[..., :3].mean(2) * (a[..., 3] / 255.0)
    if min_blue:
        lum = np.where(a[..., 2] >= min_blue, lum, 0)
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


def save(img, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, 'WEBP', quality=92, method=6)
    return path


def rect_ts(r):
    return f"{{ x: {r['x']}, y: {r['y']}, w: {r['w']}, h: {r['h']} }}"


def emit_ts(layout, plate_bulbs, word_bulbs):
    lines = [
        '// GENERATED by scripts/win-cards/build_maxwin.py — see the README there. Do not hand-edit.',
        '//',
        '// Where every piece of the MAX WIN card sits (Figma 6090:4147).',
        '//',
        '// Same card space as the marquee card: fractions of the PLATE width, origin at the plate',
        '// centre. The plate is the piece that has to line up with the reels, so it is the unit.',
        '',
        "import type { PartRect } from './winCardMarquee';",
        '',
        '/** Every loose piece of the lockup. <MaxWinCard> gives each its own entrance. */',
        'export const MAXWIN_PARTS = {',
    ]
    for name in DESIGN:
        lines.append(f'\t{name}: {rect_ts(layout[name])},')
    lines += [
        '} as const satisfies Record<string, PartRect>;',
        '',
        'export type MaxWinPart = keyof typeof MAXWIN_PARTS;',
        '',
        '/** The clear inside of the lozenge painted into the plate: where the amount is typed. */',
        f'export const MAXWIN_AMOUNT: PartRect = {rect_ts(layout["amount"])};',
        '',
        '/** Bulb centres painted into the plate frame, in card space, for the glow drawn over them. */',
        'export const MAXWIN_PLATE_BULBS: [number, number][] = [',
    ]
    for bx, by in plate_bulbs:
        lines.append(f'\t[{bx}, {by}],')
    lines += [
        '];',
        '',
        '/** Bulb centres inside the MAX WIN letters — the chase that runs across the wordmark. */',
        'export const MAXWIN_WORD_BULBS: [number, number][] = [',
    ]
    for bx, by in word_bulbs:
        lines.append(f'\t[{bx}, {by}],')
    lines += ['];', '']
    (APP / 'src/game/maxWinCard.ts').write_text('\n'.join(lines))


def main():
    px, py, pw, ph = DESIGN['plate']
    card_w = pw
    card_cx = px + pw / 2
    card_cy = py + ph / 2

    def to_card(box):
        x, y, w, h = box
        return {
            'x': round((x + w / 2 - card_cx) / card_w, 5),
            'y': round((y + h / 2 - card_cy) / card_w, 5),
            'w': round(w / card_w, 5),
            'h': round(h / card_w, 5),
        }

    layout = {name: to_card(box) for name, box in DESIGN.items()}
    layout['amount'] = to_card(AMOUNT_BOX)

    images = {}
    for name in SOURCES:
        img = load(name)
        images[name] = img
        width = min(img.width, max(8, round(layout[name]['w'] * CARD_PX)))
        save(
            img.resize((width, max(1, round(img.height * width / img.width))), Image.LANCZOS),
            OUT / f'{name}.webp',
        )

    def bulbs_in(name, min_blue=0):
        rect = layout[name]
        found = peaks(images[name], BULB_PERCENTILE, BULB_GAP, min_blue=min_blue)
        return found, [
            [
                round(rect['x'] + (fx - 0.5) * rect['w'], 4),
                round(rect['y'] + (fy - 0.5) * rect['h'], 4),
            ]
            for fx, fy in found
        ]

    plate_found, plate_bulbs = bulbs_in('plate')
    word_found, word_bulbs = bulbs_in('word', min_blue=WORD_MIN_BLUE)

    json.dump(
        {'layout': layout, 'plateBulbs': plate_bulbs, 'wordBulbs': word_bulbs},
        open(BASE / 'maxwin.json', 'w'),
        indent=1,
    )
    emit_ts(layout, plate_bulbs, word_bulbs)

    print(f'card width {card_w:.1f}px  centre ({card_cx:.1f}, {card_cy:.1f})')
    print(f'plate bulbs {len(plate_bulbs)}   word bulbs {len(word_bulbs)}')
    for name in SOURCES:
        img = images[name]
        print(f'  {name:10s} src {img.width}x{img.height}')
    print(f'  logo       reused from {LOGO_SRC.relative_to(APP)}')

    # --- verify sheets ---
    for name, found in (('plate', plate_found), ('word', word_found)):
        art = images[name]
        bg = Image.new('RGBA', art.size, (18, 5, 32, 255))
        bg.alpha_composite(art)
        d = ImageDraw.Draw(bg)
        r = max(art.size) * 0.009
        for fx, fy in found:
            x, y = fx * art.width, fy * art.height
            d.ellipse([x - r, y - r, x + r, y + r], outline=(0, 255, 90, 255), width=3)
        bg.convert('RGB').save(BASE / f'verify_maxwin_{name}_bulbs.png')


if __name__ == '__main__':
    main()
