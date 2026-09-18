#!/usr/bin/env python3
"""Eye frames for the splash crop.

The splash veggies are the board's own symbol sprites (static/assets/veggie-salad/pixel/<name>.webp),
each authored with two black-rimmed eyes carrying a white glint. This derives three frames per
sprite, in the sprite's own pixel grid, and writes them next to the other splash art:

    splash/<name>-look-l.webp   both eyes shifted one art pixel left
    splash/<name>-look-r.webp   both eyes shifted one art pixel right
    splash/<name>-blink.webp    eyes replaced by a shut ∩ arc in the set's own style
                                (the shape scatter.webp draws for the king's closed eyes)

Eyes are found, not hand-listed: the two solid, glinted black blobs that sit level with each other.
Five sprites are 69px art; carrot.webp and cauliflower.webp are 276px renders of the same art with
soft edges, so for those one art pixel is four image pixels and the eye box carries its anti-aliased
rim along with it. Run from anywhere:

    python3 apps/veggie-salad/scripts/build-splash-eyes.py
"""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'static/assets/veggie-salad/pixel'
OUT = ROOT / 'splash'
NAMES = ['broccoli', 'cauliflower', 'eggplant', 'tomato', 'carrot', 'corn', 'radish']


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


def has_glint(px, blob, box, unit):
    """A bright pixel inside the blob's box within one art pixel of the blob is the eye's glint."""
    blob_set = set(blob)
    x0, y0, x1, y1 = box
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if (x, y) in blob_set or not is_bright(px[x, y]):
                continue
            if any(
                (x + dx, y + dy) in blob_set
                for dx in range(-unit, unit + 1)
                for dy in range(-unit, unit + 1)
            ):
                return True
    return False


def find_eyes(im):
    """The two eyes: solid, glinted, similar-sized blobs level with each other. Returns their boxes."""
    px = im.load()
    w, h = im.size
    unit = 1 if w < 100 else 4
    candidates = []
    for blob in components(px, w, h, is_dark):
        if not 12 * unit * unit <= len(blob) <= 0.03 * w * h:
            continue
        box = bbox(blob)
        bw, bh = box[2] - box[0] + 1, box[3] - box[1] + 1
        # Eyes are near-solid ovals; the outlines of leaves and roots are hollow or long.
        if bw > 3 * bh or bh > 3 * bw or len(blob) < 0.45 * bw * bh:
            continue
        if not has_glint(px, blob, box, unit):
            continue
        candidates.append((len(blob), box))
    best = None
    for i, (area_a, box_a) in enumerate(candidates):
        for area_b, box_b in candidates[i + 1:]:
            size = abs(area_a - area_b) / max(area_a, area_b)
            level = abs((box_a[1] + box_a[3]) - (box_b[1] + box_b[3])) / (2 * h)
            score = size + 3 * level
            if best is None or score < best[0]:
                best = (score, box_a, box_b)
    assert best is not None, f'no eye pair among {len(candidates)} candidates'
    return sorted(best[1:]), unit


def body_colour(px, w, h, boxes, pad):
    """Most common non-dark colour on the rings just outside BOTH eye boxes: the body under them.
    Counted across the pair because one ring can be mostly detail — the corn's left eye sits on a
    kernel line, and on its own ring the line outvoted the kernel yellow."""
    counts = {}
    for x0, y0, x1, y1 in boxes:
        for y in range(y0 - pad - 1, y1 + pad + 2):
            for x in range(x0 - pad - 1, x1 + pad + 2):
                inside = x0 - pad <= x <= x1 + pad and y0 - pad <= y <= y1 + pad
                if inside or not (0 <= x < w and 0 <= y < h):
                    continue
                p = px[x, y]
                if p[3] > 200 and not is_dark(p):
                    counts[p] = counts.get(p, 0) + 1
    return max(counts, key=counts.get)


def shifted(im, eyes, dx, pad):
    """Slide each eye box sideways by dx, backfilling the strip it leaves with the body colour."""
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
    """Clear each eye and draw the king's shut eye over it: a flat run two rows deep whose two ends
    step one art pixel down (scatter.webp rows 44-46), at the eye's own width."""
    out = im.copy()
    dst = out.load()
    black = (0, 0, 0, 255)
    for box, fill in eyes:
        x0, y0, x1, y1 = box
        for y in range(y0 - pad, y1 + pad + 1):
            for x in range(x0 - pad, x1 + pad + 1):
                dst[x, y] = fill
        cy = (y0 + y1) // 2
        for x in range(x0, x1 + 1):
            end = x < x0 + 2 * unit or x > x1 - 2 * unit
            for k in range(unit):
                dst[x, cy + k + (unit if end else 0)] = black
    return out


def main():
    OUT.mkdir(exist_ok=True)
    for name in NAMES:
        im = Image.open(ROOT / f'{name}.webp').convert('RGBA')
        px = im.load()
        w, h = im.size
        boxes, unit = find_eyes(im)
        pad = 0 if unit == 1 else 2
        fill = body_colour(px, w, h, boxes, pad)
        eyes = [(box, fill) for box in boxes]
        frames = {
            'look-l': shifted(im, eyes, -unit, pad),
            'look-r': shifted(im, eyes, unit, pad),
            'blink': blinked(im, eyes, unit, pad),
        }
        for key, frame in frames.items():
            frame.save(OUT / f'{name}-{key}.webp', lossless=True, quality=100, method=6)
        print(f'{name:12} {w}x{h} unit={unit} eyes={boxes} body={fill[:3]}')


if __name__ == '__main__':
    main()
