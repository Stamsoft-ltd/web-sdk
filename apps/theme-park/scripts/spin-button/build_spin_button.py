#!/usr/bin/env python3
"""Split the spin button into a rotatable background and its static glyphs.

The shipped button used to be three flat composites (spin-default / spin-active / spin-stop), each
baking the bulb ring, the inner disc and the glyph into one bitmap. Nothing inside them could move
independently, so the marquee ring could not spin.

Figma node 6957:7124 publishes the button as the two layers it was actually built from — the ring
plus disc, and the arrow — which is what this script turns into game assets. The stop square has no
such layer, so it is cut out of the old spin-stop.png composite instead.

Every output is a SQUARE canvas centred on its own artwork, which is the whole point: `rotate()`
turns about the element's centre, so any offset between the artwork's centre and the canvas's centre
shows up as a wobble. Cropping the wobble out here keeps the CSS to a single `rotate()` with no
transform-origin fudging.

The CSS placement numbers are derived from the OLD composites and printed at the end, so the new
two-layer stack lands pixel-for-pixel where the flat one did. Run after changing any source art and
copy the printed block into HudHtml.svelte.

    python3 scripts/spin-button/build_spin_button.py
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent / 'source'
OUT = ROOT / 'static/assets/theme-park/v2/controls'
# The old flat exports, kept here rather than under static/ so they are a build input and not 550KB
# of shipped dead weight. Still the reference for WHERE everything sits, even though only the stop
# square is now cut from them.
LEGACY = SOURCE / 'legacy-spin-default.png'
LEGACY_STOP = SOURCE / 'legacy-spin-stop.png'

# Rendered sizes. The button is ~105 CSS px at the largest desktop layout, so these carry roughly 3x
# for hi-dpi without paying for the 1254px Figma masters.
BG_PX = 384
ARROW_PX = 288
STOP_PX = 160


def solid_bounds(img: Image.Image, threshold: int = 200) -> tuple[int, int, int, int]:
    """Bounds of the OPAQUE artwork, ignoring the soft outer glow.

    A plain getbbox() follows the glow halo out to wherever it fades to zero, which on the active
    art is ~30% wider than the ring itself — useless for centring on the ring.
    """
    alpha = img.split()[3].point(lambda v: 255 if v > threshold else 0)
    box = alpha.getbbox()
    assert box, 'image is fully transparent'
    return box


def square_crop(img: Image.Image, centre: tuple[float, float], side: float) -> Image.Image:
    """Crop a square of `side` centred on `centre`, padding with transparency where it overhangs."""
    cx, cy = centre
    half = side / 2
    box = (round(cx - half), round(cy - half), round(cx + half), round(cy + half))
    return img.crop(box)


def bright_glyph_bounds(img: Image.Image, centre: tuple[float, float], radius: float):
    """Find the white glyph inside the disc.

    Restricted to the inner disc because the bulbs around the rim are white too and would otherwise
    swallow the glyph in the bounding box.
    """
    px = img.load()
    cx, cy = centre
    xs, ys = [], []
    for y in range(img.size[1]):
        for x in range(img.size[0]):
            if math.hypot(x - cx, y - cy) > radius:
                continue
            r, g, b, a = px[x, y]
            if a > 200 and r > 220 and g > 190 and b > 220:
                xs.append(x)
                ys.append(y)
    assert xs, 'no glyph found inside the disc'
    return min(xs), min(ys), max(xs), max(ys)


def save(img: Image.Image, name: str, size: int) -> None:
    out = img.resize((size, size), Image.LANCZOS)
    path = OUT / name
    out.save(path, 'WEBP', quality=92, method=6)
    print(f'  {name:24} {size}x{size}  {path.stat().st_size / 1024:6.1f} KB')


def main() -> None:
    # ── Reference geometry, measured off the composite the button ships with today ───────────────
    legacy = Image.open(LEGACY).convert('RGBA')
    lx0, ly0, lx1, ly1 = solid_bounds(legacy)
    ring_cx, ring_cy = (lx0 + lx1) / 2, (ly0 + ly1) / 2
    ring_dia = max(lx1 - lx0, ly1 - ly0)
    # The composite is placed by height, so everything below is a fraction of the BUTTON's height.
    # 111.02% is .spin-btn__img--default's --art-h; 475 is the composite's frame height.
    px_per_h = 1.1102 / legacy.size[1]
    ring_dia_h = ring_dia * px_per_h
    # Frame centre + the CSS nudge, then out to the ring's own centre.
    art_centre_dy_h = 0.00998 * 1.1102
    ring_dy_h = art_centre_dy_h + (ring_cy - legacy.size[1] / 2) * px_per_h

    arrow_box = bright_glyph_bounds(legacy, (ring_cx, ring_cy), 0.62 * ring_dia / 2)
    arrow_h_ratio = (arrow_box[3] - arrow_box[1] + 1) / ring_dia
    arrow_dx_ratio = ((arrow_box[0] + arrow_box[2]) / 2 - ring_cx) / ring_dia
    arrow_dy_ratio = ((arrow_box[1] + arrow_box[3]) / 2 - ring_cy) / ring_dia

    print('reference (spin-default.png):')
    print(f'  ring centre {ring_cx},{ring_cy}  dia {ring_dia}px -> {ring_dia_h:.5f} H')

    # ── Background: ring + bulbs + inner disc, no glyph ─────────────────────────────────────────
    bg = Image.open(SOURCE / 'figma-spin-bg.png').convert('RGBA')
    bx0, by0, bx1, by1 = solid_bounds(bg)
    bg_side = max(bx1 - bx0, by1 - by0)
    bg_content = bg_side  # the crop is exactly the artwork, so content fills the canvas
    bg_square = square_crop(bg, ((bx0 + bx1) / 2, (by0 + by1) / 2), bg_side)
    fill = bg_content / bg_square.size[1]
    bg_art_h = ring_dia_h / fill
    print('outputs:')
    save(bg_square, 'spin-bg.webp', BG_PX)

    # ── Arrow glyph ─────────────────────────────────────────────────────────────────────────────
    arrow = Image.open(SOURCE / 'figma-spin-arrow.png').convert('RGBA')
    ax0, ay0, ax1, ay1 = solid_bounds(arrow)
    arrow_side = max(ax1 - ax0, ay1 - ay0)
    arrow_square = square_crop(arrow, ((ax0 + ax1) / 2, (ay0 + ay1) / 2), arrow_side)
    # Height only — the arrow is wider than tall in some exports, and height is what the CSS drives.
    arrow_fill = (ay1 - ay0) / arrow_square.size[1]
    arrow_art_h = arrow_h_ratio * ring_dia_h / arrow_fill
    save(arrow_square, 'spin-arrow.webp', ARROW_PX)

    # ── Stop square, cut from the old composite ─────────────────────────────────────────────────
    stop = Image.open(LEGACY_STOP).convert('RGBA')
    sx0, sy0, sx1, sy1 = solid_bounds(stop)
    stop_ring_c = ((sx0 + sx1) / 2, (sy0 + sy1) / 2)
    stop_ring_dia = max(sx1 - sx0, sy1 - sy0)
    gx0, gy0, gx1, gy1 = bright_glyph_bounds(stop, stop_ring_c, 0.62 * stop_ring_dia / 2)
    stop_side = max(gx1 - gx0, gy1 - gy0) + 1
    stop_square = square_crop(stop, ((gx0 + gx1) / 2, (gy0 + gy1) / 2), stop_side)
    stop_h_ratio = (gy1 - gy0 + 1) / stop_ring_dia
    stop_dx_ratio = ((gx0 + gx1) / 2 - stop_ring_c[0]) / stop_ring_dia
    stop_dy_ratio = ((gy0 + gy1) / 2 - stop_ring_c[1]) / stop_ring_dia
    stop_art_h = stop_h_ratio * ring_dia_h
    save(stop_square, 'spin-stop-glyph.webp', STOP_PX)

    # ── CSS ─────────────────────────────────────────────────────────────────────────────────────
    def block(name: str, art_h: float, dx_ratio: float, dy_ratio: float) -> str:
        # --art-dx/--art-dy are translate() percentages, so they resolve against the IMAGE's own
        # box, not the button's — hence the divide by art_h.
        dy = (ring_dy_h + dy_ratio * ring_dia_h) / art_h * 100
        dx = (dx_ratio * ring_dia_h) / art_h * 100
        return (
            f'\t.spin-btn__img--{name} {{\n'
            f'\t\t--art-h: {art_h * 100:.3f}%;\n'
            f'\t\t--art-dx: {dx:.3f}%;\n'
            f'\t\t--art-dy: {dy:.3f}%;\n'
            f'\t}}'
        )

    print('\nCSS — paste into HudHtml.svelte:\n')
    print(block('bg', bg_art_h, 0, 0))
    print(block('arrow', arrow_art_h, arrow_dx_ratio, arrow_dy_ratio))
    print(block('stopglyph', stop_art_h, stop_dx_ratio, stop_dy_ratio))


if __name__ == '__main__':
    main()
