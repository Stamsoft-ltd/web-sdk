#!/usr/bin/env python3
"""The three premium symbols, from designs 9476:54863 (tomato), 9476:53635 (pepper) and
9476:55568 (cabbage, the BROCCOLI slot).

The top three payers get their own drawings: the same vegetable in sunglasses, on a darker olive
pad (#45510C) with a faint gold keyline, and a soft #FEBF23 glow round the art (each export's
drop-shadow filter: no offset, 7-unit blur, drawn only outside the shape). The pad is page CSS;
the glow is baked in here, behind the art.

The exports are vector traces of pixel art on the same uneven ~2.5-unit grid as the rest of the
set. The native-grid pipeline the others go through (build-splash-crop.py) wrecked the one thing
these drawings are about: the shades carry detail finer than any fitted grid, and the tomato's
glints swelled into white eyes while the cabbage's heart lenses lost their shape. So these are
rendered at 10x and taken down to the board's shared pixel size (UNIT per art pixel, as
build-board-crop.py) by nearest neighbour: hard edges and the design's exact shapes, at the cost
of pixels a canvas pixel wider or narrower here and there — invisible at cell size.

Sunglasses have no eyes to blink or glance, but the board's liveness and win faces expect the
frames beside every sprite. Here they are glints: -look-l / -look-r slide the lenses' glints one
art pixel, and -blink is a stepped shine streak across each lens.

Writes, into static/assets/veggie-salad/pixel/board/:

    <name>-shades.webp  <name>-shades-look-l.webp  <name>-shades-look-r.webp  <name>-shades-blink.webp
    <name>-shades-lift.webp  <name>-shades-wide.webp  <name>-shades-shut.webp

Run from anywhere:

    python3 apps/veggie-salad/scripts/build-board-premium.py
"""
from __future__ import annotations

import importlib.util
import io
from pathlib import Path

import cairosvg
import numpy as np
from PIL import Image, ImageFilter

APP = Path(__file__).resolve().parents[1]
ART = APP / 'scripts/art/premium-9476'
OUT = APP / 'static/assets/veggie-salad/pixel/board'
# As build-board-crop.py: the 89 x 3 canvas, every art pixel UNIT canvas px.
CANVAS = 267
UNIT = 9
PAD_H = 69.27
SOURCES = {
    'tomato': 'tomato-9476-54865.svg',
    'pepper': 'pepper-9476-53636.svg',
    'cabbage': 'cabbage-9476-55569.svg',
}
# Art pixels on the longest side, read off the grid fit (as BLOCKS in build-splash-crop.py).
BLOCKS = {'tomato': 23, 'pepper': 21, 'cabbage': 21}
GLOW = (254, 191, 35)
GLOW_BLUR = 7.0
SHINE = (255, 255, 255, 255)


def crop_module():
    spec = importlib.util.spec_from_file_location('crop', APP / 'scripts/build-splash-crop.py')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def source(name: str) -> np.ndarray:
    """The export without its glow filter, at 10x."""
    svg = (ART / SOURCES[name]).read_text().replace(' filter="url(#filter0_d_0_4)"', '')
    im = Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(), scale=10))).convert('RGBA')
    return np.array(im.crop(im.getbbox()))


def shades(crop, a: np.ndarray) -> np.ndarray:
    """The shades as a mask: the largest dark blob that does not touch the sprite's edge (the
    outline does), with the holes inside it (the glints) filled."""
    im = Image.fromarray(a)
    h, w = a.shape[:2]
    best = None
    for blob in crop.components(im.load(), w, h, crop.is_dark):
        x0, y0, x1, y1 = crop.bbox(blob)
        if x0 == 0 or y0 == 0 or x1 == w - 1 or y1 == h - 1:
            continue
        if best is None or len(blob) > len(best):
            best = blob
    mask = np.zeros((h, w), bool)
    ys, xs = zip(*[(y, x) for x, y in best])
    mask[ys, xs] = True
    # Glints are bright islands wholly inside the shades' outline.
    x0, y0, x1, y1 = crop.bbox(best)
    bright = (a[..., :3].min(axis=2) >= 200) & (a[..., 3] > 200)
    box = np.zeros_like(mask)
    box[y0:y1 + 1, x0:x1 + 1] = True
    return mask, bright & box


def frames(crop, name: str) -> dict:
    a = source(name)
    pitch = round(max(a.shape[:2]) / BLOCKS[name])
    lens, glint = shades(crop, a)
    dark = np.median(a[lens][:, :3], axis=0).astype(np.uint8)
    out = {'': a}
    for key, dx in (('-look-l', -pitch), ('-look-r', pitch)):
        f = a.copy()
        f[glint, :3] = dark
        moved = np.roll(glint, dx, axis=1) & (lens | glint)
        f[moved] = SHINE
        out[key] = f
    # One stepped streak per lens, lower-left to upper-right, two art pixels wide: the lenses are
    # the shades' halves either side of the box's middle.
    ys, xs = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    lx = np.nonzero(lens.any(axis=0))[0]
    mid = (lx[0] + lx[-1]) // 2
    f = a.copy()
    for half in (lens & (xs < mid), lens & (xs >= mid)):
        hy, hx = np.nonzero(half)
        x0, y0 = hx.min(), hy.min()
        steps = ((xs - x0) // pitch) + ((ys - y0) // pitch)
        at = round(((hx.max() - x0) + (hy.max() - y0)) / pitch * 0.4)
        f[half & ((steps == at) | (steps == at + 1))] = SHINE
    out['-blink'] = f
    out.update(expressions(crop, a, pitch, lens, glint))
    return out


def mouth_box(crop, a: np.ndarray, pitch: int, lens: np.ndarray):
    """The mouth: the largest dark-edged blob in a window under the shades' middle that stays
    clear of the window's sides and floor (so the outline never qualifies). Its box holds the
    keyline and the tongue."""
    ly = np.nonzero(lens.any(axis=1))[0]
    lx = np.nonzero(lens.any(axis=0))[0]
    mid = (lx[0] + lx[-1]) // 2
    y0, y1 = ly[-1] - pitch, min(a.shape[0], ly[-1] + 5 * pitch)
    x0, x1 = mid - 3 * pitch, mid + 3 * pitch
    win = a[y0:y1, x0:x1].copy()
    win[lens[y0:y1, x0:x1]] = 0
    h, w = win.shape[:2]
    blobs = [
        b for b in crop.components(Image.fromarray(win).load(), w, h,
                                   crop.is_dark)
        if (bb := crop.bbox(b))[0] > 0 and bb[2] < w - 1 and bb[3] < h - 1
    ]
    # The mouth can be drawn in pieces (the tomato's lower lip is its own blob): take every blob
    # centred within two art pixels of the middle.
    parts = [b for b in blobs if abs((crop.bbox(b)[0] + crop.bbox(b)[2]) / 2 - w / 2) < 2 * pitch]
    boxes = [crop.bbox(b) for b in parts or [max(blobs, key=len)]]
    return (x0 + min(b[0] for b in boxes), y0 + min(b[1] for b in boxes),
            x0 + max(b[2] for b in boxes) + 1, y0 + max(b[3] for b in boxes) + 1)


def face_colour(a: np.ndarray, box, pitch: int):
    """The skin: the commonest colour in a ring one to two art pixels outside the mouth's box,
    leaving out ink and the cheeks' pink."""
    x0, y0, x1, y1 = box
    ring = a[max(0, y0 - 2 * pitch):y1 + 2 * pitch, max(0, x0 - 2 * pitch):x1 + 2 * pitch].copy()
    ring[pitch:-pitch, pitch:-pitch, 3] = 0
    ring = ring.reshape(-1, 4)
    rgb = ring[:, :3].astype(int)
    keep = (ring[:, 3] > 250) & (rgb.max(axis=1) >= 70)
    keep &= ~((rgb[:, 0] > 230) & (rgb[:, 1] > 120) & (rgb[:, 2] > 100))
    colours, counts = np.unique(ring[keep], axis=0, return_counts=True)
    return colours[counts.argmax()]


def grow(mask: np.ndarray, px: int) -> np.ndarray:
    """The mask spread px source pixels each way."""
    im = Image.fromarray(mask.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(2 * px + 1))
    return np.array(im) > 0


def expressions(crop, a, pitch, lens, glint) -> dict:
    """Extra idle faces for the premiums ("stay too static … move the glasses or the mouth",
    user 2026-09-24): -lift raises the shades one art pixel, -wide opens the mouth one art pixel
    taller, -shut closes it to a flat line."""
    box = mouth_box(crop, a, pitch, lens)
    skin = face_colour(a, box, pitch)
    out = {}

    # Shades up one art pixel; what they uncover at the bottom is skin.
    f = a.copy()
    # Only the glints the lenses enclose (the tomato's cheek highlight sits inside the shades'
    # box), plus the shadow the art draws round the lenses (the tomato's is a darker red band the
    # dark test misses): anything within half an art pixel of them, inside their columns and clear
    # of the mouth, that is neither skin nor cheek pink nor highlight.
    lx = np.nonzero(lens.any(axis=0))[0]
    cols = np.zeros_like(lens)
    cols[:, lx[0]:lx[-1] + 1] = True
    mx0, my0, mx1, my1 = box
    clear = np.ones_like(lens)
    clear[my0 - pitch // 2:my1 + pitch // 2, mx0 - pitch // 2:mx1 + pitch // 2] = False
    rgb = a[..., :3].astype(int)
    off_skin = np.abs(rgb - skin[:3].astype(int)).sum(axis=2) > 60
    pink = (rgb[..., 0] > 230) & (rgb[..., 1] > 120) & (rgb[..., 2] > 100)
    light = rgb.min(axis=2) > 200
    rim = grow(lens, pitch // 2) & cols & clear & off_skin & ~pink & ~light & (a[..., 3] > 0)
    # Clear the shades and their shadow, but move only the shades themselves: moving the grown
    # region carried whatever sat under the lenses (the tomato's mouth line) up with them.
    core = grow(lens | (glint & grow(lens, pitch // 2)), 2)
    f[grow(core | rim, 3)] = skin
    lifted = np.roll(core, -pitch, axis=0)
    f[lifted] = np.roll(a, -pitch, axis=0)[lifted]
    out['-lift'] = f

    x0, y0, x1, y1 = box
    region = Image.fromarray(a[y0:y1, x0:x1])
    # Wider: the same mouth stretched one art pixel down.
    f = a.copy()
    tall = np.array(region.resize((x1 - x0, y1 - y0 + pitch), Image.NEAREST))
    f[y0:y1 + pitch, x0:x1] = np.where(tall[..., 3:] > 0, tall, f[y0:y1 + pitch, x0:x1])
    out['-wide'] = f

    # Shut: skin over the box and one flat art-pixel line on the box's own grid (its edges are
    # the mouth's keyline, so they sit on the art grid). A raised-ends smile at this size read as
    # a cat's nose.
    f = a.copy()
    f[y0 - 4:y1 + 4, x0 - 4:x1 + 4] = skin  # and the keyline's antialiased edge
    dark = a[y0:y1, x0:x1][a[y0:y1, x0:x1, :3].max(axis=2) < 70]
    ink = np.median(dark, axis=0).astype(np.uint8)
    base = y0 + (max(2, round((y1 - y0) / pitch)) // 2) * pitch
    f[base:base + pitch, x0 + pitch // 2:x1 - pitch // 2] = ink
    out['-shut'] = f
    return out


def main():
    crop = crop_module()
    OUT.mkdir(parents=True, exist_ok=True)
    k = CANVAS / PAD_H
    for name in SOURCES:
        for key, f in frames(crop, name).items():
            im = Image.fromarray(f)
            scale = BLOCKS[name] * UNIT / max(im.size)
            art = im.resize((round(im.width * scale), round(im.height * scale)), Image.NEAREST)
            snap = UNIT // 3
            x = round((CANVAS - art.width) / 2 / snap) * snap
            y = round((CANVAS - art.height) / 2 / snap) * snap
            canvas = Image.new('RGBA', (CANVAS, CANVAS))
            canvas.paste(art, (x, y))
            # The glow: the art's own silhouette, blurred, tinted, behind it.
            halo = canvas.getchannel('A').filter(ImageFilter.GaussianBlur(GLOW_BLUR * k / 2))
            glow = Image.new('RGBA', canvas.size, GLOW + (0,))
            glow.putalpha(halo)
            Image.alpha_composite(glow, canvas).save(
                OUT / f'{name}-shades{key}.webp', lossless=True, quality=100, method=6)
        print(f'{name:8} art {art.size} on {CANVAS}')


if __name__ == '__main__':
    main()
