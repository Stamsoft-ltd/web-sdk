#!/usr/bin/env python3
"""The splash king, cut into the parts that move.

Design 9200:148144 draws the scatter king on the splash's middle board as a vector (its `potato`
frame, kept at scripts/art/splash-crop-9200-145271/king-9200-148144.svg). The splash used to hop
the flat 89px sprite as one image; "use all parts to make him more alive, when jumping the
pelerina to move, maybe the crown to move a bit, the feet to move" (user, 2026-09-24).

The vector is not built from parts, though: it is 143 paths split by COLOUR — one black path is
the whole outline, one yellow path is most of the gold on him. So the parts are cut from the
render, not from the paths. Every pixel is labelled with the topmost path that paints it, each
path that belongs to one part is mapped to it below (by its box, read off a 6x render with a grid
over it), and the pixels of the shared paths go to whichever part they are nearest. A moving part
would then show a hole where it used to sit, so each layer is also painted in underneath the parts
in front of it, with its own nearest colour, a few art pixels deep — enough for the motion the
splash gives it and no more.

Writes, into static/assets/veggie-salad/pixel/splash/king/, one canvas-sized webp per layer so the
page can stack them at inset 0 (back to front):

    sprout  body (eyes shut, the design's)  body-open  crown  feet-l  feet-r  cape-l  cape-r

The canvas frames the king as scatter.webp frames him, so the splash's sizes carry over.
body-open is congrats-king's open-eyes pass over the same render. Run from anywhere:

    python3 apps/veggie-salad/scripts/build-splash-king.py
"""
from __future__ import annotations

import importlib.util
import io
import re
from collections import deque
from pathlib import Path

import cairosvg
import numpy as np
from PIL import Image

APP = Path(__file__).resolve().parents[1]
SVG = APP / 'scripts/art/splash-crop-9200-145271/king-9200-148144.svg'
OUT = APP / 'static/assets/veggie-salad/pixel/splash/king'
SCALE = 4
# How far (render px) a layer is painted in under the layers in front of it: 3 art pixels.
UNDERPAINT = 3 * 2 * SCALE
LAYERS = ['sprout', 'body', 'crown', 'feet-l', 'feet-r', 'cape-l', 'cape-r']
# Path index → part, for every path that belongs to one part. Anything unlisted (the outline, the
# gold under everything, the inner outline round the cape) is shared, and split by nearness.
PARTS = {
    'sprout': [107, 123, 138, 140, 124, 133, 137],
    'crown': [57, 115, 119, 125, 129, 134, 69, 118, 122, 128, 132, 136, 116, 117, 120, 121, 126,
              127, 130, 131, 135, 58, 60, 62, 63, 64, 65, 66, 67, 71, 73, 68, 70, 72, 59, 61],
    'cape-l': [88, 89, 91, 99, 92, 102, 104, 105, 106, 93, 94, 95, 96, 97, 98, 100, 101, 103, 90,
               139, 36],
    'cape-r': [74, 80, 75, 3, 5, 7, 8, 9, 79, 4, 6, 77, 78, 82, 83, 84, 85, 86, 87, 81, 76],
    'feet-l': [108, 109, 110],
    'feet-r': [111, 112, 113, 114],
    'body': [1, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
             31, 32, 33, 34, 35, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53,
             54, 55, 56, 141, 142],
}


def congrats_module():
    spec = importlib.util.spec_from_file_location('congrats', APP / 'scripts/build-congrats-king.py')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def render(svg: str) -> np.ndarray:
    return np.array(Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(), scale=SCALE)))
                    .convert('RGBA')).astype(int)


def nearest(labels: np.ndarray, todo: np.ndarray) -> np.ndarray:
    """Multi-source BFS: every `todo` pixel takes the label of the nearest labelled (>=0) pixel."""
    h, w = labels.shape
    out = labels.copy()
    q = deque(zip(*np.nonzero(out >= 0)))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and todo[ny, nx] and out[ny, nx] < 0:
                out[ny, nx] = out[y, x]
                q.append((ny, nx))
    return out


def underpaint(layer: np.ndarray, under: np.ndarray, palette: list) -> np.ndarray:
    """Grow `layer` into the `under` pixels (covered by layers in front) up to UNDERPAINT px,
    each new pixel taking the colour of the layer pixel it grew from. It grows from the design's own
    fill colours only: grown from the outline it smeared black wedges under the cape, and from the
    render's soft edges (opaque, but orange mixed with black) muddy stripes."""
    h, w = under.shape
    out = layer.copy()
    dist = np.full((h, w), -1)
    dist[out[..., 3] > 0] = UNDERPAINT
    seed = np.zeros((h, w), bool)
    for colour in palette:
        seed |= np.abs(out[..., :3] - colour).max(axis=2) <= 10
    dist[seed & (out[..., 3] == 255)] = 0
    q = deque(zip(*np.nonzero(dist == 0)))
    while q:
        y, x = q.popleft()
        if dist[y, x] >= UNDERPAINT:
            continue
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and under[ny, nx] and dist[ny, nx] < 0:
                dist[ny, nx] = dist[y, x] + 1
                out[ny, nx] = out[y, x]
                out[ny, nx, 3] = 255
                q.append((ny, nx))
    return out


def main():
    svg = SVG.read_text()
    head, tail = svg.split('<g', 1)[0], '</svg>'
    paths = re.findall(r'<path [^>]*/>', svg)
    palette = [np.array([int(c[i:i + 2], 16) for i in (0, 2, 4)])
               for c in set(re.findall(r'fill="#([0-9A-Fa-f]{6})"', svg)) if c.upper() != '3F3C43']
    shut = render(svg)
    opened, _, _ = congrats_module().open_eyes(shut)
    h, w = shut.shape[:2]
    alpha = shut[..., 3] > 0

    # Topmost path per pixel, then path → part.
    top = np.full((h, w), -1)
    for i, path in enumerate(paths):
        top[render(head + path + tail)[..., 3] > 127] = i
    part_of = {i: LAYERS.index(part) for part, ids in PARTS.items() for i in ids}
    labels = np.vectorize(lambda i: part_of.get(i, -1))(top)
    labels[~alpha] = -1
    labels = nearest(labels, alpha)

    # Frame as scatter.webp frames him: its content box is (6, 2)-(83, 85) of 89.
    ys, xs = np.nonzero(alpha)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    side = round((x1 - x0) * 89 / 77)
    ox, oy = round(6 / 89 * side) - x0, round(2 / 89 * side) - y0

    OUT.mkdir(parents=True, exist_ok=True)
    outputs = [(part, part, shut) for part in LAYERS] + [('body-open', 'body', opened)]
    for name, part, source in outputs:
        k = LAYERS.index(part)
        layer = np.where((labels == k)[..., None], source, 0)
        front = np.isin(labels, list(range(k + 1, len(LAYERS))))
        layer = underpaint(layer, front, palette)
        canvas = np.zeros((side, side, 4), int)
        canvas[y0 + oy:y1 + oy, x0 + ox:x1 + ox] = layer[y0:y1, x0:x1]
        Image.fromarray(canvas.astype('uint8')).save(OUT / f'{name}.webp', lossless=True,
                                                     quality=100, method=6)
    # At rest the stack must BE the design: every pixel is in exactly one layer, and underpaint
    # only ever lands under a layer in front of it.
    stack = Image.new('RGBA', (side, side))
    for part in LAYERS:
        stack.alpha_composite(Image.open(OUT / f'{part}.webp'))
    framed = np.zeros((side, side, 4), int)
    framed[y0 + oy:y1 + oy, x0 + ox:x1 + ox] = shut[y0:y1, x0:x1]
    diff = np.abs(np.array(stack).astype(int) - framed).max(axis=2)
    print(f'rest stack vs design: {(diff > 8).sum()} px differ by >8')
    # Where each part pivots, in % of the canvas, for the page's transform-origins.
    for k, part in enumerate(LAYERS):
        pys, pxs = np.nonzero(labels == k)
        print(f'{part:7} box x{(pxs.min() + ox) / side:.3f}-{(pxs.max() + ox) / side:.3f} '
              f'y{(pys.min() + oy) / side:.3f}-{(pys.max() + oy) / side:.3f}')
    print(f'canvas {side}px')


if __name__ == '__main__':
    main()
