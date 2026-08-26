#!/usr/bin/env python3
"""Build the MEGA COASTER scatter out of its layers, so its sign can rock and its words can zoom.

The design ships this one as four loose drawings — a pavilion (Figma 7063:18563), the empty red bulb
marquee that hangs on its face (7063:18562), and the two words MEGA (7057:7960) and COASTER
(7057:7958) — plus the flat symbol they replace (7057:7953).

    python3 scripts/coaster-sign/build_coaster_sign.py

It writes:

  static/assets/theme-park/v2/modes/mega-coaster-{desktop,mobile,mobile-landscape}-still.png
  static/assets/theme-park/v2/modes/mega-coaster-{desktop,mobile,mobile-landscape}-house.png
  static/assets/theme-park/v2/symbols/mega-coaster-{sign,word-mega,word-coaster}.png
  src/game/coasterSignParts.ts
  scripts/coaster-sign/verify_coaster_sign.png

WHY IT IS BUILT THIS WAY

THIS IS A COMPOSITION, NOT A FIT, and that is the one thing to understand before changing anything
here. The other symbols in this game were cut apart FROM the picture the artist assembled, so each
piece could be slid over that picture until it matched pixel for pixel and the placement was found
rather than chosen. These four are a REDRAW: the pavilion has banners on its doors that the flat
symbol never had, and its towers are a different height. There is nothing to match against, so every
placement here is constructed — and the flat symbol is used for the one thing it can still be
trusted for, which is PROPORTION.

So the sign is not placed at coordinates. It is placed where the flat symbol puts its own sign
relative to its own building — same fraction across, same fraction down, same fraction of the
building's width — which survives the redraw because it is a statement about composition rather than
about pixels.

THE WORDS ARE LAID INTO THE FIELD THE SIGN ACTUALLY HAS. The navy panel inside the bulb ring is
found by colour and measured, and the two words are set into that box: one scale for the pair, so
they keep the size relationship they were drawn with, and stacked on the field's own centre line.
Sizing them off the sign's outer box instead would push both words onto the bulbs, because the ring
is thick and it is thicker at the top than at the sides.

Always eyeball verify_coaster_sign.png: it puts the rebuild beside the flat symbol it replaces, then
the poses either end of both animations.
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent / "source"
MODES_DIR = ROOT / "static/assets/theme-park/v2/modes"
SYMBOL_DIR = ROOT / "static/assets/theme-park/v2/symbols"
TABLE = ROOT / "src/game/coasterSignParts.ts"
VERIFY = Path(__file__).resolve().parent / "verify_coaster_sign.png"

FRAME = (448, 360)
MODE_VARIANTS = [("desktop", 448), ("mobile", 184), ("mobile-landscape", 216)]

# How tall the building is drawn in the frame, taken from the art it replaces: the flat symbol's ink
# ran 305 of the frame's 360 rows, and how much of the board this symbol takes up is a decision that
# was already made.
TARGET_INK_H = 305

# Figma exports are always opaque, and this file's paper is #f5f5f5.
PAPER = np.array([245, 245, 245])
PAPER_TOLERANCE = 10
#: How far in from the paper the key is FEATHERED, in pixels.
#:
#: The flood alone gives a hard, binary alpha, and the export is anti-aliased: the one-to-two pixel
#: blend between the ink and the paper is not paper enough to be flooded, so it shipped OPAQUE and
#: nearly white. On the navy sign that read as a ragged pale rim tracing every letter of MEGA
#: COASTER, which is exactly what it was — the paper, still there, cut out around the type.
FEATHER = 2

# How wide the WIDER of the two words is set, as a fraction of the navy field it sits in. The rest is
# breathing room; at 1.0 the type would touch the bulbs.
WORD_FILL = 0.84
# The gap between the two words, as a fraction of the field's height.
WORD_GAP = 0.06


def keyed(path):
    """The export with its paper knocked out, anti-aliasing and letter counters included.

    This used to flood the paper in from the border, so that a white-hot bulb centre could not be
    keyed away with it. The bulbs on this sign are amber — across all four layers the drawings hold
    under a hundred pixels of near-white ink between them, all of it anti-aliasing against the paper
    itself — and the flood could not reach the paper CLOSED INSIDE a letter, so the counters of every
    O, A, G and R in MEGA COASTER shipped as opaque white blobs. Key the colour everywhere instead;
    a redraw that puts real white in one of these layers has to go back to a flood.

    The feather is the other half. The export is anti-aliased, so the one-to-two pixel blend between
    ink and paper is not paper enough to be keyed and shipped OPAQUE and nearly white — a ragged
    pale rim tracing every letter, which is what it was: the paper, cut out around the type.
    Coverage there is read against the ink just inside the rim rather than against a fixed range,
    because the two are only as far apart as that ink is from #f5f5f5, and the paper is then lifted
    back out of the colour so the rim is the ink at low alpha rather than the ink mixed with paper.
    """
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(int)
    paper = np.abs(rgb - PAPER).max(axis=2) <= PAPER_TOLERANCE

    distance = np.abs(rgb - PAPER).max(axis=2).astype(float)
    alpha = np.where(paper, 0.0, 1.0)
    rim = spread(paper, FEATHER) & ~paper
    # The largest distance anywhere near the pixel: on a rim pixel that is the INK it is a blend
    # of, which is the scale its own distance is a fraction of. Sampling only pixels far enough in
    # to be pure ink reads better on paper and collapses in practice — the strokes here are thinner
    # than the exclusion is wide, so the reference came back 0 and every rim pixel snapped opaque.
    reference = window_max(distance, FEATHER + 2)
    alpha[rim] = np.clip(distance / np.maximum(reference, 1.0), 0.0, 1.0)[rim]

    out = rgb.astype(float)
    share = alpha[..., None]
    lifted = (rgb - (1 - share) * PAPER) / np.maximum(share, 0.02)
    out[rim] = np.where(share > 0.02, lifted, rgb)[rim]
    return np.dstack([np.clip(out, 0, 255), alpha * 255]).astype(int)


def spread(mask, radius):
    """`mask` grown by `radius` pixels."""
    for _ in range(radius):
        grown = mask.copy()
        grown[1:, :] |= mask[:-1, :]
        grown[:-1, :] |= mask[1:, :]
        grown[:, 1:] |= mask[:, :-1]
        grown[:, :-1] |= mask[:, 1:]
        mask = grown
    return mask


def window_max(values, radius):
    """The largest value within `radius` pixels of each pixel."""
    for _ in range(radius):
        grown = values.copy()
        np.maximum(grown[1:, :], values[:-1, :], out=grown[1:, :])
        np.maximum(grown[:-1, :], values[1:, :], out=grown[:-1, :])
        np.maximum(grown[:, 1:], values[:, :-1], out=grown[:, 1:])
        np.maximum(grown[:, :-1], values[:, 1:], out=grown[:, :-1])
        values = grown
    return values


def ink_box(layer):
    # Past the feather, so the box is where the drawing IS and not where its anti-aliasing peters
    # out — every placement in this script is measured from these edges.
    ys, xs = np.nonzero(layer[..., 3] > 96)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def biggest(mask):
    """The largest 4-connected region of `mask`, as (x0, y0, x1, y1). Iterative — these are big."""
    h, w = mask.shape
    seen = np.zeros((h, w), bool)
    best = None
    for sy, sx in zip(*np.nonzero(mask)):
        if seen[sy, sx]:
            continue
        stack = [(sy, sx)]
        seen[sy, sx] = True
        x0 = x1 = sx
        y0 = y1 = sy
        area = 0
        while stack:
            y, x = stack.pop()
            area += 1
            x0, x1, y0, y1 = min(x0, x), max(x1, x), min(y0, y), max(y1, y)
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        if best is None or area > best[0]:
            best = (area, x0, y0, x1 + 1, y1 + 1)
    if best is None:
        raise SystemExit("nothing matched")
    return best[1:]


def red_sign(layer):
    """The marquee's red ring: where the sign sits in a drawing that also contains a building."""
    rgb = layer[..., :3]
    on = (layer[..., 3] > 96) & (rgb[..., 0] > 140) & (rgb[..., 1] < 95) & (rgb[..., 2] < 95)
    return biggest(on)


def navy_field(layer):
    """The dark panel inside the ring — the only part of the sign type may be written on."""
    rgb = layer[..., :3]
    on = (layer[..., 3] > 96) & (rgb[..., 2] > rgb[..., 0] + 20) & (rgb.max(axis=2) < 150)
    return biggest(on)


def rgba(array):
    return Image.fromarray(array.astype(np.uint8), "RGBA")


def resized(image, size):
    """LANCZOS, in PREMULTIPLIED alpha.

    PIL resamples the four channels independently, so a plain resize averages the COLOUR of fully
    transparent pixels into their opaque neighbours. Every transparent pixel in these layers is
    keyed paper — #f5f5f5 — and that is where the pale rim tracing MEGA COASTER really came from:
    not the key, but every resize after it mixing the paper back in around the type.
    """
    array = np.asarray(image.convert("RGBA")).astype(float)
    share = array[..., 3:4] / 255.0
    premultiplied = Image.fromarray(
        np.dstack([array[..., :3] * share, array[..., 3]]).astype(np.uint8), "RGBA"
    )
    out = np.asarray(premultiplied.resize(size, Image.LANCZOS)).astype(float)
    colour = np.clip(out[..., :3] / np.maximum(out[..., 3:4] / 255.0, 1e-6), 0, 255)
    return Image.fromarray(np.dstack([colour, out[..., 3]]).astype(np.uint8), "RGBA")


def scaled(image, factor):
    return resized(image, (max(1, round(image.width * factor)), max(1, round(image.height * factor))))


def num(value):
    return f"{value:.4f}".rstrip("0").rstrip(".") or "0"


def main():
    flat = keyed(SOURCE / "assembled4x.png")
    house = keyed(SOURCE / "layer-a.png")
    sign = keyed(SOURCE / "layer-b.png")
    word_coaster = keyed(SOURCE / "layer-c.png")
    word_mega = keyed(SOURCE / "layer-d.png")

    # What the flat symbol says about where a sign goes on this building, in its own proportions.
    fx0, fy0, fx1, fy1 = ink_box(flat)
    sx0, sy0, sx1, sy1 = red_sign(flat)
    across = ((sx0 + sx1) / 2 - fx0) / (fx1 - fx0)
    down = ((sy0 + sy1) / 2 - fy0) / (fy1 - fy0)
    span = (sx1 - sx0) / (fx1 - fx0)
    print(f"flat symbol: building {fx1 - fx0}x{fy1 - fy0}, sign {sx1 - sx0}x{sy1 - sy0}")
    print(f"  its sign sits {across:.3f} across and {down:.3f} down, spanning {span:.3f} of the width")

    # The building, at the size the board draws this symbol.
    hx0, hy0, hx1, hy1 = ink_box(house)
    house_scale = TARGET_INK_H / (hy1 - hy0)
    house_art = scaled(rgba(house), house_scale)
    house_w = (hx1 - hx0) * house_scale
    if house_w > FRAME[0]:
        raise SystemExit(f"the building would be {house_w:.0f} wide in a {FRAME[0]} frame")
    house_at = (round(FRAME[0] / 2 - (hx0 + hx1) / 2 * house_scale),
                round(FRAME[1] / 2 - (hy0 + hy1) / 2 * house_scale))
    house_ink0 = (hx0 * house_scale + house_at[0], hy0 * house_scale + house_at[1])
    print(f"building {house_art.width}x{house_art.height} at {house_at}, ink {house_w:.0f} wide")

    # The sign, sized and placed by the flat symbol's proportions rather than by any coordinate.
    gx0, gy0, gx1, gy1 = ink_box(sign)
    sign_scale = span * house_w / (gx1 - gx0)
    sign_art = scaled(rgba(sign), sign_scale)
    sign_centre = (house_ink0[0] + across * house_w, house_ink0[1] + down * TARGET_INK_H)
    sign_at = (round(sign_centre[0] - (gx0 + gx1) / 2 * sign_scale),
               round(sign_centre[1] - (gy0 + gy1) / 2 * sign_scale))
    print(f"sign {sign_art.width}x{sign_art.height} at {sign_at}, centred on {sign_centre}")

    # The field inside it, in frame pixels, and the two words laid into that.
    nx0, ny0, nx1, ny1 = navy_field(sign)
    field = (nx0 * sign_scale + sign_at[0], ny0 * sign_scale + sign_at[1],
             nx1 * sign_scale + sign_at[0], ny1 * sign_scale + sign_at[1])
    field_w, field_h = field[2] - field[0], field[3] - field[1]
    print(f"field {field_w:.0f}x{field_h:.0f} at ({field[0]:.0f}, {field[1]:.0f})")

    # ONE scale for the pair, so they keep the size relationship they were drawn with.
    widths = [ink_box(word)[2] - ink_box(word)[0] for word in (word_mega, word_coaster)]
    word_scale = WORD_FILL * field_w / max(widths)
    words = {}
    stack_h = 0
    for name, layer in (("mega", word_mega), ("coaster", word_coaster)):
        wx0, wy0, wx1, wy1 = ink_box(layer)
        art = scaled(rgba(layer), word_scale)
        words[name] = (art, (wx0 + wx1) / 2 * word_scale, (wy0 + wy1) / 2 * word_scale,
                       (wy1 - wy0) * word_scale)
        stack_h += (wy1 - wy0) * word_scale
    gap = WORD_GAP * field_h
    top = field[1] + (field_h - stack_h - gap) / 2
    placed = {}
    for name in ("mega", "coaster"):
        art, ink_cx, ink_cy, ink_h = words[name]
        centre = (field[0] + field_w / 2, top + ink_h / 2)
        placed[name] = (art, (round(centre[0] - ink_cx), round(centre[1] - ink_cy)), centre)
        top += ink_h + gap
        print(f"  {name} {art.width}x{art.height}, ink centre ({centre[0]:.0f}, {centre[1]:.0f})")

    # The house on its own, for <MegaCoaster> to hang the live sign on...
    house_only = Image.new("RGBA", FRAME, (0, 0, 0, 0))
    house_only.alpha_composite(house_art, house_at)
    # ...and everything, for the spin trail and for a dimmed symbol. Assembled sprites fade wrong:
    # pixi fades a container by fading each CHILD, so overlaps brighten.
    still = house_only.copy()
    still.alpha_composite(sign_art, sign_at)
    for name in ("mega", "coaster"):
        art, at, _ = placed[name]
        still.alpha_composite(art, at)

    for suffix, width in MODE_VARIANTS:
        height = round(width * FRAME[1] / FRAME[0])
        resized(house_only, (width, height)).save(MODES_DIR / f"mega-coaster-{suffix}-house.png")
        resized(still, (width, height)).save(MODES_DIR / f"mega-coaster-{suffix}-still.png")

    sign_art.save(SYMBOL_DIR / "mega-coaster-sign.png")
    rows = []
    sign_ink = ((gx0 + gx1) / 2 * sign_scale + sign_at[0], (gy0 + gy1) / 2 * sign_scale + sign_at[1])
    rows.append(entry("sign", sign_art, sign_at, sign_ink))
    for name in ("mega", "coaster"):
        art, at, centre = placed[name]
        art.save(SYMBOL_DIR / f"mega-coaster-word-{name}.png")
        rows.append(entry(name, art, at, centre))
    TABLE.write_text(HEADER + "\n".join(rows) + "\n};\n")
    print(f"wrote {TABLE.relative_to(ROOT)}")

    # The verify sheet: the flat symbol it replaces, the rebuild, and both animations at full throw.
    poses = [("rest", 0, 1), ("sign -", -2.5, 1), ("sign +", 2.5, 1), ("win big", 0, 1.16),
             ("win small", 0, 0.9)]
    sheet = Image.new("RGBA", (FRAME[0] * (len(poses) + 1) + 24 * len(poses), FRAME[1]),
                      (26, 26, 34, 255))
    reference = scaled(rgba(flat), TARGET_INK_H / (fy1 - fy0))
    sheet.alpha_composite(reference, (round(FRAME[0] / 2 - reference.width / 2),
                                      round(FRAME[1] / 2 - reference.height / 2)))
    for index, (_, turn, pop) in enumerate(poses):
        # The sign and its words turn TOGETHER — they are one board — so the group is composited
        # flat and then rotated about the sign's own centre.
        group = Image.new("RGBA", FRAME, (0, 0, 0, 0))
        group.alpha_composite(sign_art, sign_at)
        for name in ("mega", "coaster"):
            art, at, centre = placed[name]
            grown = scaled(art, pop) if pop != 1 else art
            group.alpha_composite(grown, (round(centre[0] - grown.width / 2),
                                          round(centre[1] - grown.height / 2)))
        if turn:
            group = group.rotate(turn, resample=Image.BICUBIC, center=sign_ink)
        pane = house_only.copy()
        pane.alpha_composite(group)
        sheet.alpha_composite(pane, ((FRAME[0] + 24) * (index + 1), 0))
    sheet.save(VERIFY)
    print(f"wrote {VERIFY.relative_to(ROOT)}")


def entry(name, art, at, centre):
    return (
        f"\t{name}: {{\n"
        f"\t\tx: {num(centre[0] / FRAME[0])},\n"
        f"\t\ty: {num(centre[1] / FRAME[1])},\n"
        f"\t\twidth: {num(art.width / FRAME[0])},\n"
        f"\t\theight: {num(art.height / FRAME[1])},\n"
        f"\t\tanchorX: {num((centre[0] - at[0]) / art.width)},\n"
        f"\t\tanchorY: {num((centre[1] - at[1]) / art.height)},\n"
        f"\t}},"
    )


HEADER = """// GENERATED by scripts/coaster-sign/build_coaster_sign.py — edit that, not this.
//
// The MEGA COASTER scatter's moving parts: the marquee bolted to the pavilion's face, and the two
// words written on it. The pavilion itself never moves and ships as one house.
//
// Every number is a fraction of the 448x360 symbol frame, which is what makes one table serve every
// size the board draws a symbol at. See <MegaCoaster>.

export type CoasterSignPiece = {
\t/** The middle of the DRAWING in the frame: what the part turns and scales about. */
\tx: number;
\ty: number;
\twidth: number;
\theight: number;
\t/**
\t * That same point as a fraction of the part's own art, for the sprite's anchor. The exports
\t * carry a margin, and a different one each, so this is not 0.5.
\t */
\tanchorX: number;
\tanchorY: number;
};

export const COASTER_SIGN_PARTS: Record<'sign' | 'mega' | 'coaster', CoasterSignPiece> = {
"""


main()
