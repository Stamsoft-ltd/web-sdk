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
cache can serve the soft one.

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
    'logo.webp',
    'wins/v2/sweet-sweet.webp',
    'wins/v2/sweet-win.webp',
    'wins/v2/epic-title.webp',
    'wins/v2/mythic-title.webp',
    'wins/v2/legendary-title.webp',
    'wins/v2/wild-wordart.webp',
    'wins/v2/max-wordart.webp',
    'overlays/v2/bonus-end-plaque.webp',
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


if __name__ == '__main__':
    main()
