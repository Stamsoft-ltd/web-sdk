#!/usr/bin/env python3
"""Snap the soft pixel-art word marks back onto their own pixel grid.

The logo and the win word art are pixel art that reached the game through a smoothing upscale:
every block is there, but its edges are a one-to-two pixel ramp, so they read as blurred next to
the board's crisp symbols (softness 0.14-0.27 against the board's 0.01-0.06, same metric as
build-splash-crop.py; "low quality / inconsistent style" is the review finding this answers).

Same repair as the symbols: find the art's pixel pitch from the rhythm of its colour edges, fit
the grid lines (build-splash-crop.grid_lines — the drawings' grids are slightly uneven), and give
every cell one colour, the most common one in its central half. Unlike the symbols the result keeps the
source's size and cell positions exactly, so nothing that places these sprites has to change.

The soft originals sit in scripts/art/crisp-sources/ (not static/, whose every image the loader
fetches); each writes <name>-px.webp at the original's place under static/, a new name so no
cache can serve the soft one. Art the grid fit would damage is palette-snapped instead (SNAP_*,
see there); layered rigs write a sibling <dir>-px/ with the same file names.

Run from anywhere:

    python3 apps/veggie-salad/scripts/build-crisp-art.py
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

import numpy as np
from PIL import Image

APP = Path(__file__).resolve().parents[1]
PIXEL = APP / 'static/assets/veggie-salad/pixel'
# The soft originals live outside static/ — the loader preloads every image under it.
SOURCES = APP / 'scripts/art/crisp-sources'
TARGETS = [
    # logo.webp retired 2026-09-25: the wordmark is build-logo.py's, from design 9471:47883.
    'wins/v2/sweet-sweet.webp',
    'wins/v2/sweet-win.webp',
    'wins/v2/epic-title.webp',
    'wins/v2/mythic-title.webp',
    'wins/v2/legendary-title.webp',
    'wins/v2/wild-wordart.webp',
    'wins/v2/max-wordart.webp',
    'overlays/v2/bonus-end-plaque.webp',
    # Mock review 2026-09-24 ("soft art"): the bonus box, the info meadow and the haystack.
    'mystery-box.webp',
    'background.webp',
    'background/haystack.webp',
    # Review 2026-09-25 (2, 2, 1.67): the bonus outro's total plaque, the softest win art left
    # that the grid fit repairs cleanly.
    'wins/v2/legendary-amount.webp',
]
# Art whose soft part is only the anti-aliased ramp at colour edges, where a re-grid moves
# features (it redrew the wolf's mouth, the butterfly's face and an owl glint, even at the true
# pitch). These keep every pixel where it is: each takes the nearest of the art's own flat
# colours and alpha is cut at 50% (`snap`). A rig is snapped as one — one palette off its stacked
# layers — so a part cannot come out a shade off the body it sits on; it writes to <dir>-px/.
# Tried and left: coin.webp (near-crisp already; snapping speckled it), the congrats basket (its
# small colours — blush, glints — fall out of the palette), fence/base-bench (speckled), moon and
# coin-stack (their "soft" steps are the art's own shades).
SNAP_RIGS = {
    'background/bonus-super/wolf': ['body', 'ear-l', 'ear-r', 'eyes'],
    'background/bonus-normal/butterfly': [
        'body', 'wing-l', 'wing-r', 'antenna-l', 'antenna-r',
        'face-blink', 'face-look-l', 'face-look-r', 'face-mouth',
    ],
    'background/bonus-normal/sunset/owl': ['body', 'eyes'],
}
SNAP_FILES = [
    'wins/v2/sweet-star.webp',
    'background/bonus-normal/tree.webp',
    'background/bonus-normal/oak.webp',
    'background/bonus-super/oak.webp',
]


def crop_module():
    spec = importlib.util.spec_from_file_location('crop', APP / 'scripts/build-splash-crop.py')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def softness(a: np.ndarray) -> float:
    """Share of neighbouring opaque pixel pairs that differ by a soft step (3-40)."""
    a = a.astype(int)
    opaque = a[..., 3] > 200
    d = np.abs(np.diff(a[..., :3], axis=1)).max(axis=2)
    d = d[opaque[:, 1:] & opaque[:, :-1]]
    return float(((d >= 3) & (d <= 40)).mean())


def pitch(a: np.ndarray, axis: int) -> float:
    """The period of the colour-edge profile along one axis: the smallest autocorrelation peak
    within 80% of the strongest (the strongest can be a multiple of the pitch)."""
    step = np.abs(np.diff(a.astype(int), axis=axis)).max(axis=2) > 24
    edge = step.sum(axis=1 - axis).astype(float)
    edge -= edge.mean()
    lags = np.arange(2, 25)
    r = np.array([np.dot(edge[:-lag], edge[lag:]) / (len(edge) - lag) for lag in lags])
    peaks = [i for i in range(1, len(r) - 1) if r[i] >= r[i - 1] and r[i] >= r[i + 1]]
    top = max(r[i] for i in peaks)
    i = next(i for i in peaks if r[i] >= 0.8 * top)
    # Parabolic refinement between the neighbouring lags.
    den = r[i - 1] - 2 * r[i] + r[i + 1]
    return float(lags[i] + (0.5 * (r[i - 1] - r[i + 1]) / den if den else 0))


def dominant(cell: np.ndarray) -> np.ndarray:
    """The cell's most common colour, grouped at 4 bits a channel and returned as the mean of that
    group — an actual colour of the art. A per-channel median of a cell that straddles an outline
    mixes cream, red and black into a colour the drawing never had (dark blocks in WILD WIN)."""
    px = cell.reshape(-1, 4).astype(int)
    if (px[:, 3] > 127).mean() < 0.5:
        return np.zeros(4, np.uint8)
    px = px[px[:, 3] > 127]
    keys = (px[:, 0] >> 4) << 8 | (px[:, 1] >> 4) << 4 | (px[:, 2] >> 4)
    values, counts = np.unique(keys, return_counts=True)
    group = px[keys == values[counts.argmax()]]
    return np.array([*group[:, :3].mean(axis=0).round(), 255], np.uint8)


def palette(a: np.ndarray, share: float = 0.004) -> np.ndarray:
    """The art's flat colours: 4-bit-a-channel groups covering at least `share` of its opaque
    pixels, each the mean of its group — colours the drawing actually has."""
    px = a.reshape(-1, 4).astype(int)
    px = px[px[:, 3] > 200]
    keys = (px[:, 0] >> 4) << 8 | (px[:, 1] >> 4) << 4 | (px[:, 2] >> 4)
    values, counts = np.unique(keys, return_counts=True)
    return np.array([px[keys == k, :3].mean(axis=0) for k in values[counts >= share * len(px)]])


def snap(a: np.ndarray, colours: np.ndarray) -> np.ndarray:
    """Every pixel at least half opaque takes its nearest palette colour at full alpha; the rest
    go clear. Nothing moves."""
    out = np.zeros_like(a)
    on = a[..., 3] >= 128
    rgb = a[on, :3].astype(float)
    nearest = ((rgb[:, None, :] - colours[None, :, :]) ** 2).sum(axis=-1).argmin(axis=1)
    out[on, :3] = colours[nearest].round().astype(np.uint8)
    out[on, 3] = 255
    return out


def crisp(crop, a: np.ndarray) -> tuple[np.ndarray, float, float]:
    # The art's blocks are square; where the two axes disagree the finer pitch wins — splitting a
    # real block costs nothing (both halves take its colour), merging two loses a detail (the
    # logo's flowers went blotchy at 5.1 x 6.8).
    p = min(pitch(a, 1), pitch(a, 0))
    xs = crop.grid_lines(a, 1, p)
    ys = crop.grid_lines(a, 0, p)
    out = np.zeros_like(a)
    for y0, y1 in zip(ys, ys[1:]):
        qy = max(1, (y1 - y0) // 4)
        for x0, x1 in zip(xs, xs[1:]):
            qx = max(1, (x1 - x0) // 4)
            out[y0:y1, x0:x1] = dominant(a[y0 + qy:y1 - qy, x0 + qx:x1 - qx])
    return out, p, p


def main():
    crop = crop_module()
    for rel in TARGETS:
        src = SOURCES / rel
        a = np.array(Image.open(src).convert('RGBA'))
        out, px, py = crisp(crop, a)
        dst = (PIXEL / rel).with_name(src.stem + '-px.webp')
        Image.fromarray(out).save(dst, lossless=True, quality=100, method=6)
        print(f'{rel:36} pitch {px:4.1f}x{py:4.1f}  softness {softness(a):.3f} -> '
              f'{softness(out):.3f}  {src.stat().st_size // 1024}K -> {dst.stat().st_size // 1024}K')
    for rel in SNAP_FILES:
        src = SOURCES / rel
        a = np.array(Image.open(src).convert('RGBA'))
        out = snap(a, palette(a))
        dst = (PIXEL / rel).with_name(src.stem + '-px.webp')
        Image.fromarray(out).save(dst, lossless=True, quality=100, method=6)
        print(f'{rel:36} snap  softness {softness(a):.3f} -> {softness(out):.3f}')
    for rel, parts in SNAP_RIGS.items():
        layers = {n: Image.open(SOURCES / rel / f'{n}.webp').convert('RGBA') for n in parts}
        stack = Image.new('RGBA', next(iter(layers.values())).size)
        for layer in layers.values():
            stack.alpha_composite(layer)
        colours = palette(np.array(stack))
        out_dir = PIXEL / f'{rel}-px'
        out_dir.mkdir(parents=True, exist_ok=True)
        for n, layer in layers.items():
            Image.fromarray(snap(np.array(layer), colours)).save(
                out_dir / f'{n}.webp', lossless=True, quality=100, method=6)
        print(f'{rel:36} rig of {len(parts)}, {len(colours)} colours -> {out_dir.name}/')


if __name__ == '__main__':
    main()
