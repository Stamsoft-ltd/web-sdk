#!/usr/bin/env python3
"""The splash's crop of vegetables, and the eye frames that make them glance and blink.

Design 9200:145271 plants seven vegetables either side of the board row — radish, potato, garlic and
pepper on the left, cabbage, eggplant and tomato on the right. They are a newer set than the board's
symbols, drawn for this screen, so they are installed from the design rather than reusing the symbol
sprites. Sources sit in scripts/art/splash-crop-9200-145271/, named after their Figma instances:
four were uploaded rasters (the 1254px originals, cropped to their content), garlic and pepper are
vectorised and rendered here, and the cabbage has no single source image — it is its instance's 4x
export with the page colour flood-filled out from the edges.

For each vegetable this writes, into static/assets/veggie-salad/pixel/splash/crop/:

    <name>.webp          the sprite, cropped to its content, longest side near SIZE px at a whole
                         number of px per art pixel — the largest any of them shows is ~225
                         device px, a portrait leaner at DPR 3
    <name>-look-l.webp   both eyes slid one art pixel left
    <name>-look-r.webp   both eyes slid one art pixel right
    <name>-blink.webp    eyes replaced by a shut arc (the shape scatter.webp draws for the king)

The sources are pixel drawings upscaled onto an IRREGULAR grid (the tomato's blocks are 47-50px
wide), and resizing them by a non-whole ratio blended every block edge — the set measured as soft
as the painted symbols it replaced. So each source is first taken back to its native pixels: grid
lines are fitted to the colour edges (spacing free within ±20% of the pitch, so the drift is
followed), each cell takes the median of its central half, and the native sprite is scaled up by a
whole number with no resampling. BLOCKS is each drawing's own pixel count on its longest side,
read off the fit (the count whose rebuilt blocks reproduce the source best, halves excluded).

Eyes are found, not hand-listed: the two solid, glinted black blobs level with each other. Every
vegetable's eye is two art pixels wide, so "one art pixel" is taken from the eye itself. Run from
anywhere:

    python3 apps/veggie-salad/scripts/build-splash-crop.py
"""
from __future__ import annotations

import io
from collections import deque
from functools import cache
from pathlib import Path

import cairosvg
import numpy as np
from PIL import Image

APP = Path(__file__).resolve().parents[1]
ART = APP / 'scripts/art/splash-crop-9200-145271'
OUT = APP / 'static/assets/veggie-salad/pixel/splash/crop'
SIZE = 192
SOURCES = {
    'radish': 'radish-9200-147838.png',
    'potato': 'potato-9200-147886.png',
    'garlic': 'garlic-9200-147730.svg',
    'pepper': 'pepper-9200-147936.svg',
    'cabbage': 'cabbage-9200-147840.png',
    'eggplant': 'eggplant-9200-147826.png',
    'tomato': 'tomato-9200-147798.png',
}
BLOCKS = {
    'radish': 27,
    'potato': 26,
    'garlic': 26,
    'pepper': 22,
    'cabbage': 21,
    'eggplant': 25,
    'tomato': 20,
}


def grid_lines(a: np.ndarray, axis: int, pitch: float) -> list[int]:
    """Cell edges along one axis: 0 and the length, and between them the lines (gaps within ±20%
    of the pitch) that sit on the most colour edges, each line paying the mean so none is free."""
    step = np.abs(np.diff(a.astype(int), axis=axis)).max(axis=2) > 24
    edge = step.sum(axis=1 - axis).astype(float)
    n = len(edge) + 1
    gain = np.concatenate([[0.0], edge - edge.mean()])
    lo, hi = max(1, int(0.8 * pitch)), int(np.ceil(1.2 * pitch))
    best = np.full(n + 1, -np.inf)
    prev = np.zeros(n + 1, int)
    best[0] = 0
    for i in range(1, n + 1):
        for gap in range(lo, min(hi, i) + 1):
            value = best[i - gap] + (gain[i] if i < n else 0)
            if value > best[i]:
                best[i], prev[i] = value, i - gap
    lines = [n]
    while lines[-1] > 0:
        lines.append(prev[lines[-1]])
    return lines[::-1]


def cells(a: np.ndarray, xs: list[int], ys: list[int]) -> np.ndarray:
    """One colour per grid cell: the median of the cell's central half, alpha cut to 0/255."""
    out = np.zeros((len(ys) - 1, len(xs) - 1, 4), np.uint8)
    for j, (y0, y1) in enumerate(zip(ys, ys[1:])):
        for i, (x0, x1) in enumerate(zip(xs, xs[1:])):
            qy, qx = max(1, (y1 - y0) // 4), max(1, (x1 - x0) // 4)
            cell = a[y0 + qy:y1 - qy, x0 + qx:x1 - qx].reshape(-1, 4)
            colour = np.median(cell, axis=0)
            out[j, i] = (*colour[:3], 255) if colour[3] > 127 else (0, 0, 0, 0)
    return out


def resample_box(a, out, xs, ys, pitch, box):
    """Sample a feature's cells again on its OWN box in the source (the source box split evenly
    into whole pitches), plus a one-cell ring sampled just outside it. The fitted lines can sit
    half a block off across a small feature, and an eye then loses its glint or turns into a wink.
    Returns the (rows, cols) of cells the feature now covers."""
    x0, y0, x1, y1 = box
    centre = lambda lines, k: (lines[k] + lines[k + 1]) / 2

    def span(lines, lo, hi):
        # The blocks round the faces run up to a third larger than the pitch, so a feature counts
        # only its whole pitches, best centred on it.
        count = max(1, int((hi + 1 - lo) / pitch + 0.35))
        first = min(range(len(lines) - count),
                    key=lambda k: abs(centre(lines, k) - (lo + (hi + 1 - lo) / (2 * count))))
        return list(range(first, first + count))

    cols, rows = span(xs, x0, x1), span(ys, y0, y1)
    for j in range(max(0, rows[0] - 1), min(out.shape[0], rows[-1] + 2)):
        for i in range(max(0, cols[0] - 1), min(out.shape[1], cols[-1] + 2)):
            if j in rows and i in cols:
                sx = x0 + (cols.index(i) + 0.5) * (x1 + 1 - x0) / len(cols)
                sy = y0 + (rows.index(j) + 0.5) * (y1 + 1 - y0) / len(rows)
            else:
                sx, sy = centre(xs, i), centre(ys, j)
                if x0 <= sx <= x1 and y0 <= sy <= y1:
                    sx = x0 - pitch / 2 if i < cols[0] else x1 + pitch / 2 if i > cols[-1] else sx
                    sy = y0 - pitch / 2 if j < rows[0] else y1 + pitch / 2 if j > rows[-1] else sy
            colour = a[min(a.shape[0] - 1, max(0, round(sy))), min(a.shape[1] - 1, max(0, round(sx)))]
            out[j, i] = (*colour[:3], 255) if colour[3] > 127 else (0, 0, 0, 0)
    return rows, cols


@cache
def native(name: str) -> Image.Image:
    """The drawing at one pixel per art pixel."""
    path = ART / SOURCES[name]
    if path.suffix == '.svg':
        im = Image.open(io.BytesIO(cairosvg.svg2png(url=str(path), scale=10))).convert('RGBA')
    else:
        im = Image.open(path).convert('RGBA')
    a = np.array(im.crop(im.getbbox()))
    pitch = max(a.shape[:2]) / BLOCKS[name]
    xs, ys = grid_lines(a, 1, pitch), grid_lines(a, 0, pitch)
    out = cells(a, xs, ys)
    # The fitted lines can sit half a block off at the eyes, and a 2x2 eye then loses its glint or
    # turns into a wink. So each eye's cells are sampled again on the eye's own box in the source.
    for box in find_eyes(Image.fromarray(a)):
        resample_box(a, out, xs, ys, pitch, box)
    im = Image.fromarray(out)
    return im.crop(im.getbbox())


def load(name: str, unit: int) -> Image.Image:
    """The native drawing, every art pixel `unit` pixels square."""
    im = native(name)
    return im.resize((im.width * unit, im.height * unit), Image.NEAREST)


def is_dark(p):
    return p[3] > 200 and max(p[:3]) < 70


def is_bright(p):
    return p[3] > 200 and min(p[:3]) >= 200


def components(px, w, h, pred):
    seen = set()
    for y in range(h):
        for x in range(w):
            if (x, y) in seen or not pred(px[x, y]):
                continue
            q = deque([(x, y)])
            seen.add((x, y))
            pts = []
            while q:
                cx, cy = q.popleft()
                pts.append((cx, cy))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen and pred(px[nx, ny]):
                        seen.add((nx, ny))
                        q.append((nx, ny))
            yield pts


def bbox(pts):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


def has_glint(px, box):
    """The glint is a bright spot INSIDE the eye's box — the blob wraps round it."""
    x0, y0, x1, y1 = box
    return any(is_bright(px[x, y]) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1))


def find_eyes(im):
    """The two eyes: solid, glinted, similar-sized blobs level with each other."""
    px = im.load()
    w, h = im.size
    candidates = []
    for blob in components(px, w, h, is_dark):
        if not 0.002 * w * h <= len(blob) <= 0.03 * w * h:
            continue
        box = bbox(blob)
        bw, bh = box[2] - box[0] + 1, box[3] - box[1] + 1
        # Eyes are near-solid blocks; outlines of leaves and bodies are hollow or long.
        if bw > 2 * bh or bh > 2 * bw or len(blob) < 0.45 * bw * bh:
            continue
        if not has_glint(px, box):
            continue
        candidates.append((len(blob), box))
    best = None
    for i, (area_a, box_a) in enumerate(candidates):
        for area_b, box_b in candidates[i + 1:]:
            size = abs(area_a - area_b) / max(area_a, area_b)
            level = abs((box_a[1] + box_a[3]) - (box_b[1] + box_b[3])) / (2 * h)
            apart = abs((box_a[0] + box_a[2]) - (box_b[0] + box_b[2])) / (2 * w)
            if apart > 0.5:
                continue
            score = size + 3 * level
            if best is None or score < best[0]:
                best = (score, box_a, box_b)
    assert best is not None, f'no eye pair among {len(candidates)} candidates'
    return sorted(best[1:])


def body_colour(px, w, h, boxes, pad):
    """Most common non-dark colour on the rings just outside both eye boxes: the face under them."""
    counts = {}
    for x0, y0, x1, y1 in boxes:
        for y in range(y0 - pad - 2, y1 + pad + 3):
            for x in range(x0 - pad - 2, x1 + pad + 3):
                inside = x0 - pad <= x <= x1 + pad and y0 - pad <= y <= y1 + pad
                if inside or not (0 <= x < w and 0 <= y < h):
                    continue
                p = px[x, y]
                if p[3] > 200 and not is_dark(p):
                    # Vote in coarse buckets so the resample's soft edge does not split the vote,
                    # then fill with the mean of the winning bucket's real pixels — the bucket's own
                    # corner colour showed as a faint square round each eye.
                    q = tuple(c // 12 for c in p[:3])
                    counts.setdefault(q, []).append(p[:3])
    pixels = max(counts.values(), key=len)
    return tuple(round(sum(c[i] for c in pixels) / len(pixels)) for i in range(3)) + (255,)


def shifted(im, eyes, dx, pad):
    """Slide each eye box sideways by dx, backfilling the strip it leaves with the face colour."""
    out = im.copy()
    src = im.load()
    dst = out.load()
    for box, fill in eyes:
        x0, y0, x1, y1 = box[0] - pad, box[1] - pad, box[2] + pad, box[3] + pad
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                dst[x, y] = fill
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if 0 <= x + dx < out.width:
                    dst[x + dx, y] = src[x, y]
    return out


def blinked(im, eyes, unit, pad):
    """Clear each eye and draw the king's shut eye over it: a flat run one art pixel deep whose
    two ends step one art pixel down and out (scatter.webp rows 44-46), at the eye's own width."""
    out = im.copy()
    dst = out.load()
    black = (0, 0, 0, 255)
    for box, fill in eyes:
        x0, y0, x1, y1 = box
        for y in range(y0 - pad, y1 + pad + 1):
            for x in range(x0 - pad, x1 + pad + 1):
                dst[x, y] = fill
        # On the art grid: the run spans the eye, and each end is one more art pixel out, one down.
        cy = y0 + (((y1 + 1 - y0) // unit - 1) // 2) * unit
        for x in range(x0 - unit, x1 + unit + 1):
            end = x < x0 or x > x1
            for k in range(unit):
                dst[x, cy + k + (unit if end else 0)] = black
    return out


def frames(name: str, unit: int | None = None) -> tuple[dict, str]:
    """The sprite and its eye frames, keyed by filename suffix, plus a line describing the eyes.
    Each art pixel is `unit` pixels (default: the whole number that brings the longest side
    nearest SIZE). build-board-crop.py cuts the board's copies through here at its own unit."""
    unit = unit or max(1, round(SIZE / BLOCKS[name]))
    im = load(name, unit)
    px = im.load()
    w, h = im.size
    boxes = find_eyes(im)
    # The art is on a clean grid now, so the eye box is exact: no margin to paint over.
    pad = 0
    fill = body_colour(px, w, h, boxes, pad)
    eyes = [(box, fill) for box in boxes]
    out = {
        '': im,
        '-look-l': shifted(im, eyes, -unit, pad),
        '-look-r': shifted(im, eyes, unit, pad),
        '-blink': blinked(im, eyes, unit, pad),
    }
    return out, f'{name:9} {w}x{h} unit={unit} eyes={boxes} face={fill[:3]}'


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name in SOURCES:
        out, info = frames(name)
        for key, frame in out.items():
            frame.save(OUT / f'{name}{key}.webp', lossless=True, quality=100, method=6)
        print(info)

if __name__ == '__main__':
    main()
