#!/usr/bin/env python3
"""Trace the win-card plate's silhouette for the slime to catch on.

The slime used to be placed round a RECTANGLE (WIN_CARD_PLATE_SLAB) with hand-tuned corner
walks, and the plate is nothing like a rectangle: it is a boat — a wide slab whose lower half is
cut back by two long diagonals to a narrow foot with a medallion on it, with notch tabs on the
upper corners. Splats placed off the rectangle sat inside the face or hung under the diagonals
with nothing behind them ("they should be by the border, not some random places", 2026-09-21).

This walks the sprite's alpha with rays from its centroid — the outline is star-shaped from
there — and simplifies the trace to a polygon (Douglas-Peucker), printed as fractions of the
sprite box so game/winCardTiers.ts can hold it and game/winSlime.ts can sample its perimeter.

    python3 scripts/measure-win-plate-outline.py

Nothing here is eyeballed; re-run it if winCardPlate.webp changes.
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PLATE = ROOT / "static/assets/components/win_boards/winCardPlate.webp"
ALPHA = 128
RAYS = 720
# Simplification tolerance in sprite pixels: the outline's own strokes are ~6px, so 4px keeps
# every real corner and drops the anti-aliasing stair-steps.
TOLERANCE = 4.0


def trace(im: Image.Image) -> list[tuple[float, float]]:
    w, h = im.size
    a = im.split()[-1].load()
    # Centroid of the opaque pixels, the ray origin.
    sx = sy = n = 0
    for y in range(h):
        for x in range(w):
            if a[x, y] >= ALPHA:
                sx += x
                sy += y
                n += 1
    cx, cy = sx / n, sy / n
    pts = []
    reach = math.hypot(w, h)
    for i in range(RAYS):
        th = (i / RAYS) * math.tau
        dx, dy = math.cos(th), math.sin(th)
        # The farthest opaque pixel along the ray: walk out to the edge and remember the last hit.
        last = None
        r = 0.0
        while r < reach:
            x, y = cx + dx * r, cy + dy * r
            if not (0 <= x < w and 0 <= y < h):
                break
            if a[int(x), int(y)] >= ALPHA:
                last = (x, y)
            r += 0.5
        if last:
            pts.append(last)
    return pts


def simplify(pts: list[tuple[float, float]], tol: float) -> list[tuple[float, float]]:
    """Douglas-Peucker on a closed ring: split at the two farthest-apart points, simplify each arc."""

    def dp(seg: list[tuple[float, float]]) -> list[tuple[float, float]]:
        if len(seg) < 3:
            return seg
        (ax, ay), (bx, by) = seg[0], seg[-1]
        L = math.hypot(bx - ax, by - ay) or 1e-9
        far, fi = 0.0, 0
        for i in range(1, len(seg) - 1):
            px, py = seg[i]
            d = abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / L
            if d > far:
                far, fi = d, i
        if far <= tol:
            return [seg[0], seg[-1]]
        left = dp(seg[: fi + 1])
        right = dp(seg[fi:])
        return left[:-1] + right

    i0 = 0
    i1 = max(range(len(pts)), key=lambda i: math.dist(pts[0], pts[i]))
    a = dp(pts[i0 : i1 + 1])
    b = dp(pts[i1:] + pts[:1])
    return a[:-1] + b[:-1]


def main() -> None:
    im = Image.open(PLATE).convert("RGBA")
    w, h = im.size
    ring = simplify(trace(im), TOLERANCE)
    print(f"// {PLATE.name} {w}x{h}: {len(ring)} vertices, clockwise in screen coords (y down)")
    print("export const WIN_CARD_PLATE_OUTLINE = [")
    for x, y in ring:
        print(f"\t{{ x: {x / w:.4f}, y: {y / h:.4f} }},")
    print("];")


if __name__ == "__main__":
    main()
