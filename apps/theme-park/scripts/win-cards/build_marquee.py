"""Cut the marquee win card (Figma 7013:9117) into the pieces the game animates apart.

The redesign replaces the old panel/ring/badge/coins card with a circus marquee: a bulb-lit tent
plate, a tier wordmark that drops onto it, two gold stars that fly in from the sides, and a fan of
confetti behind it. Nothing here is composited — every piece ships loose so <WinCard> can give each
its own entrance.

Inputs are the transparent Figma raws (see README). Outputs are the webps under
`static/assets/theme-park/v2/wins/marquee/` and `src/game/winCardMarquee.ts`.

The PLATE itself is no longer cut here. The card now sits on the shared marquee pad, which the
bonus-complete screen sits on too, so it is cut by `scripts/pad/build_pad.py` and its rect and bulb
table live in `game/padMarquee.ts`. The plate's box on the design canvas is still measured here,
because it is the unit every other piece is a fraction of.

Two things this script is careful about, both learned the hard way on the old pipeline:

* Every piece is placed by its TRIMMED ink, not by its Figma node box. The exports carry different
  amounts of transparent margin, so two pieces with the same node box do not have the same visual
  size, and a wordmark placed by its box lands a few percent off.
* The confetti is cut into its 15 loose pieces by connected components. It ships as one flat image
  in Figma, and one image can only fade in; fifteen can burst out from behind the plate.
"""

import json
import os
import pathlib
from collections import deque

import numpy as np
from PIL import Image

BASE = pathlib.Path(__file__).resolve().parent
APP = pathlib.Path(__file__).resolve().parents[2]
OUT = APP / 'static/assets/theme-park/v2/wins/marquee'
RAW = pathlib.Path(
    os.environ.get(
        'MARQUEE_RAW',
        '/private/tmp/claude-501/-Users-stanislavmilev-Development-stake-forestSlot-apps/'
        'ea92fc9d-b824-40df-b335-34de90db0321/scratchpad/raw',
    )
)

TIERS = ['sweet', 'wild', 'epic', 'mythic', 'legendary']

# === Design geometry, from the composed screen (Figma 7013:9117, a 1200x675 canvas) ===
#
# The card is placed by its PLATE: the plate's width is one "card width" and everything else is a
# fraction of it, with the origin at the plate's centre. That makes the whole assembly scale off a
# single number in the game, and it is the plate — not the confetti fan, which overhangs it — that
# has to line up with the reels.
COMPOSITE = (220, 8, 760, 479)  # the plate+confetti artwork's box on the canvas
PLATE_IN_COMPOSITE = (0.0700, 0.0068, 0.8600, 0.9661)  # x, y, w, h — measured, see README
CONFETTI_IN_COMPOSITE = (0.0, 0.0, 1.0, 0.9842)
WORDMARK_BOX = (338, 117, 534, 334)  # the SWEET wordmark; every tier is fitted into its ink
STAR_BOXES = ((339, 307, 66, 56), (792, 307, 66, 56))
# ...but ONLY THE x OF THOSE BOXES SURVIVES INTO THE GAME. The y is measured elsewhere — see
# `PAD_STAR_SEAT` in scripts/pad/build_pad.py, which is what <WinCard> actually places a star by.
#
# The reason is that the plate this card is drawn on is no longer the plate these boxes were
# measured against. The game builds the card on the shared marquee PAD, pinned to the design by its
# FIELD CENTRE — which lines the two signs up down the centre column and nowhere else. Out at the
# shoulders the pad's pocket is a different shape, and the design's y (0.1382 of a card width below
# the plate's centre, level with the lower of the two words) seats the star hard against the
# pocket's bottom rail with a lobe's worth of empty purple above it. Rejected on sight, 2026-08-24.
#
# The x is kept because it is not a fact about the plate at all: it is how far out a star has to be
# to clear the wordmark, and the wordmark is unchanged.
#
# An earlier pass had the y at `PAD_FIELD_CENTRE` (0.06109) instead, which was too high AND wrong
# twice over — it was never converted through PAD_PLATE, so it was not the field's centre in CARD
# space either (that would be 0.01945), and the field's centre is measured down the centre column,
# which is not where a star sits.
AMOUNT_BOX = (401, 430.43, 399, 120.14)

# Export widths.
TEXT_W = 1100
STAR_W = 220
CONFETTI_SCALE = 1.0  # confetti pieces keep their native resolution


def load(name):
    return Image.open(RAW / name).convert('RGBA')


def trim(img):
    """Ink bbox and the trimmed image. Alpha 8 rather than 0: these exports have a haze of
    near-zero alpha well outside the art, and trimming on >0 keeps almost the whole canvas."""
    a = img.getchannel('A').point(lambda v: 255 if v > 8 else 0)
    box = a.getbbox()
    return box, img.crop(box)


def place(box_in_canvas, full_size, trim_box, card_w, card_cx, card_cy):
    """Map a piece's trimmed ink to card space.

    `box_in_canvas` is where the piece's FULL image sits on the design canvas; `trim_box` is the ink
    inside that image. Returns the ink's centre and size as fractions of the card width, with the
    origin at the card's centre.
    """
    bx, by, bw, bh = box_in_canvas
    sx, sy = bw / full_size[0], bh / full_size[1]
    x0, y0, x1, y1 = trim_box
    cx = bx + (x0 + x1) / 2 * sx
    cy = by + (y0 + y1) / 2 * sy
    return {
        'x': round((cx - card_cx) / card_w, 5),
        'y': round((cy - card_cy) / card_w, 5),
        'w': round((x1 - x0) * sx / card_w, 5),
        'h': round((y1 - y0) * sy / card_w, 5),
    }


def resized(img, width):
    return img.resize((width, max(1, round(img.height * width / img.width))), Image.LANCZOS)


def save(img, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, 'WEBP', quality=92, method=6)
    return path


def components(mask):
    """Connected components of a boolean mask, largest first, as (area, x0, y0, x1, y1)."""
    H, W = mask.shape
    seen = np.zeros_like(mask)
    out = []
    for y in range(H):
        for x in range(W):
            if not mask[y, x] or seen[y, x]:
                continue
            q = deque([(y, x)])
            seen[y, x] = True
            minx = maxx = x
            miny = maxy = y
            area = 0
            while q:
                cy, cx = q.popleft()
                area += 1
                minx, maxx = min(minx, cx), max(maxx, cx)
                miny, maxy = min(miny, cy), max(maxy, cy)
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            q.append((ny, nx))
            out.append((area, minx, miny, maxx + 1, maxy + 1))
    out.sort(reverse=True)
    return out


def rect_ts(r):
    return f"{{ x: {r['x']}, y: {r['y']}, w: {r['w']}, h: {r['h']} }}"


def emit_ts(layout):
    lines = [
        '// GENERATED by scripts/win-cards/build_marquee.py — see the README there. Do not hand-edit.',
        '//',
        '// Where every piece of the marquee win card sits (Figma 7013:9117).',
        '//',
        '// All coordinates are fractions of the CARD WIDTH — the width of the plate — with the origin',
        '// at the plate\'s centre. One number sizes the whole assembly, and it is the plate rather than',
        '// the confetti fan that lines up with the reels, which is why the plate is the unit.',
        '//',
        '// The plate itself is not here: the card sits on the shared marquee pad, generated by',
        '// scripts/pad/build_pad.py into game/padMarquee.ts.',
        '',
        'export type PartRect = { x: number; y: number; w: number; h: number };',
        '',
        '/** One loose scrap of the confetti fan. `area` is its pixel count, which is how heavy it falls. */',
        'export type ConfettiPiece = PartRect & { area: number };',
        '',
        'export type MarqueeTier = keyof typeof MARQUEE_TEXT;',
        '',
        '/** The tier wordmark, every tier fitted to the same cap height on the same centre. */',
        'export const MARQUEE_TEXT = {',
    ]
    for tier in TIERS:
        lines.append(f'\t{tier}: {rect_ts(layout["text"][tier])},')
    lines += [
        '} as const satisfies Record<string, PartRect>;',
        '',
        '/**',
        ' * The right-hand star. The left one is its mirror — see <WinCard>.',
        ' *',
        ' * ONLY x, w AND h ARE USED. The height comes from `PAD_STAR_SEAT` instead: this y was',
        ' * measured against a plate the game no longer draws, and on the pad it seats the star',
        " * against the pocket's bottom rail. See the note by STAR_BOXES in build_marquee.py.",
        ' */',
        f'export const MARQUEE_STAR: PartRect = {rect_ts(layout["star"])};',
        '',
        '/** The amount plate hanging below the card. Drawn, not an image: it is a rounded rect. */',
        f'export const MARQUEE_AMOUNT: PartRect = {rect_ts(layout["amount"])};',
        '',
        '/**',
        ' * The confetti scraps, biggest first. Only their art and `area` are used now: the card no',
        " * longer draws the design's static fan — <WinConfettiRain> falls them down the screen.",
        ' */',
        'export const MARQUEE_CONFETTI: ConfettiPiece[] = [',
    ]
    for piece in layout['confetti']:
        lines.append(
            f'\t{{ x: {piece["x"]}, y: {piece["y"]}, w: {piece["w"]}, '
            f'h: {piece["h"]}, area: {piece["area"]} }},'
        )
    lines += ['];', '']
    (APP / 'src/game/winCardMarquee.ts').write_text('\n'.join(lines))


def main():
    layout = {}

    # === THE UNIT — the plate's box on the design canvas ===
    # The plate art is cut by scripts/pad/build_pad.py; what is needed here is only where the design
    # puts it, because every other piece is a fraction of its width from its centre.
    cx0, cy0, cw, ch = COMPOSITE
    px, py, pw, ph = PLATE_IN_COMPOSITE
    plate_canvas = (cx0 + px * cw, cy0 + py * ch, pw * cw, ph * ch)
    card_w = plate_canvas[2]
    card_cx = plate_canvas[0] + plate_canvas[2] / 2
    card_cy = plate_canvas[1] + plate_canvas[3] / 2

    # === CONFETTI — one image in Figma, fifteen sprites in the game ===
    conf_raw = load('confetti_4.png')
    conf_box, conf_img = trim(conf_raw)
    fx, fy, fw, fh = CONFETTI_IN_COMPOSITE
    conf_canvas = (cx0 + fx * cw, cy0 + fy * ch, fw * cw, fh * ch)
    alpha = np.asarray(conf_raw.getchannel('A'))
    pieces = []
    for index, (area, x0, y0, x1, y1) in enumerate(components(alpha > 24)):
        piece = conf_raw.crop((x0, y0, x1, y1))
        rect = place(conf_canvas, conf_raw.size, (x0, y0, x1, y1), card_w, card_cx, card_cy)
        rect['area'] = area
        pieces.append(rect)
        save(resized(piece, max(8, round(piece.width * CONFETTI_SCALE))), OUT / f'confetti/p{index:02d}.webp')
    layout['confetti'] = pieces

    # === STARS ===
    star_raw = load('star_4.png')
    star_box, star_img = trim(star_raw)
    stars = [place(b, star_raw.size, star_box, card_w, card_cx, card_cy) for b in STAR_BOXES]
    # The design's two stars are 4 px out of symmetry; a card that is symmetric everywhere else
    # reads that as a mistake, so they are mirrored about the card's centre line.
    span = (abs(stars[0]['x']) + abs(stars[1]['x'])) / 2
    layout['star'] = {
        'x': round(span, 5),
        'y': round((stars[0]['y'] + stars[1]['y']) / 2, 5),
        'w': stars[0]['w'],
        'h': stars[0]['h'],
    }
    save(resized(star_img, STAR_W), OUT / 'star.webp')

    # === WORDMARKS — every tier fitted into the SWEET wordmark's ink ===
    sweet_raw = load('sweet_4.png')
    sweet_box, _ = trim(sweet_raw)
    target = place(WORDMARK_BOX, sweet_raw.size, sweet_box, card_w, card_cx, card_cy)
    layout['text'] = {}
    for tier in TIERS:
        raw = load(f'{tier}_4.png')
        box, img = trim(raw)
        aspect = (box[2] - box[0]) / (box[3] - box[1])
        # Contained, not stretched: LEGENDARY is a much wider word than WILD, and scaling each to
        # the same box would have the tiers' letters at wildly different sizes.
        width = min(target['w'], target['h'] * aspect)
        layout['text'][tier] = {
            'x': target['x'],
            'y': target['y'],
            'w': round(width, 5),
            'h': round(width / aspect, 5),
        }
        save(resized(img, TEXT_W), OUT / f'text-{tier}.webp')

    # === AMOUNT PLATE ===
    ax, ay, aw, ah = AMOUNT_BOX
    layout['amount'] = {
        'x': round((ax + aw / 2 - card_cx) / card_w, 5),
        'y': round((ay + ah / 2 - card_cy) / card_w, 5),
        'w': round(aw / card_w, 5),
        'h': round(ah / card_w, 5),
    }

    json.dump(layout, open(BASE / 'marquee.json', 'w'), indent=1)
    emit_ts(layout)
    print(f'card width {card_w:.1f}px  centre ({card_cx:.1f}, {card_cy:.1f})')
    print(f'confetti pieces: {len(pieces)}')
    for tier in TIERS:
        t = layout['text'][tier]
        print(f'  text {tier:10s} w={t["w"]:.3f} h={t["h"]:.3f}')


if __name__ == '__main__':
    main()
