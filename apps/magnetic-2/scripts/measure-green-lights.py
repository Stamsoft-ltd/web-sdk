#!/usr/bin/env python3
"""Find the round green indicator lamps baked into a symbol plate and emit their placements.

The lamps are drawn INTO the plate, so nothing can make them blink at runtime unless the runtime
knows where they are. This locates them by blob detection and writes src/game/greenLights.ts, the
same generate-don't-hand-edit arrangement as backgroundLights.ts -- re-run it after any art swap
rather than nudging the numbers, because every coordinate is a fraction of the symbol box and a
new plate moves all of them at once.

Selection is deliberately narrow: a lamp is a green blob that is COMPACT (mostly fills its own
bounding box) and roughly ROUND. That is what separates a lamp from the other green things on
these plates -- the word SCATTER is green too, and so are the compass chevrons and the alien, but
letters and chevrons are sparse in their boxes and the wrong aspect. Widening the filter to "any
green" makes the scatter's lettering blink, which is not what anyone asked for.

Run:  python3 scripts/measure-green-lights.py
"""

from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SYMBOLS = ROOT / "static" / "assets" / "components" / "symbols" / "magnetic"
OUT = ROOT / "src" / "game" / "greenLights.ts"

# Plates to scan, keyed by the name the runtime uses.
PLATES = {
    "compass": SYMBOLS / "premium" / "compass.webp",
    "scatter": SYMBOLS / "special" / "scatter.webp",
}

# A lamp is compact and round; letters and chevrons are neither.
MIN_FILL = 0.65
AR_RANGE = (0.72, 1.38)
AREA_RANGE = (24, 900)

# An ARC is the other kind of green light in this set: the compass bezel lights by four curved
# strips rather than by bulbs, so the round test above finds nothing on it. An arc is a green blob
# that is LONG and THIN -- it fills little of its own bounding box, because a curve sweeping across
# a box leaves most of the box empty.
ARC_MAX_FILL = 0.55
ARC_MIN_AREA = 120
# Points emitted along each arc. They are ordered around the plate's centre and share a `group`, so
# the runtime can light a whole arc as one thing while still drawing it as a curve rather than as a
# glowing rectangle -- an arc's bounding box is nothing like its shape.
ARC_SAMPLES = 9


def green_mask(a: np.ndarray) -> np.ndarray:
    r, g, b, al = a[:, :, 0], a[:, :, 1], a[:, :, 2], a[:, :, 3]
    return (al > 200) & (g > 110) & (g - r > 28) & (g - b > 38)


def blobs(mask: np.ndarray):
    h, w = mask.shape
    seen = np.zeros_like(mask)
    for y0 in range(h):
        for x0 in range(w):
            if not mask[y0, x0] or seen[y0, x0]:
                continue
            seen[y0, x0] = True
            q = deque([(y0, x0)])
            pts = []
            while q:
                y, x = q.popleft()
                pts.append((y, x))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        q.append((ny, nx))
            yield pts


def arc_points(pts, cw: int, ch: int, group: int):
    """Sample an arc into evenly spaced points, ordered around the plate centre.

    Thickness comes from area / length rather than from the bounding box: a curve's box says
    almost nothing about how thick the stroke is.
    """
    import math

    ordered = sorted(pts, key=lambda q: math.atan2(q[0] - ch / 2, q[1] - cw / 2))
    xs = [q[1] for q in ordered]
    ys = [q[0] for q in ordered]
    span = max(
        1.0,
        math.hypot(xs[-1] - xs[0], ys[-1] - ys[0]) * math.pi / 2,  # chord -> rough arc length
    )
    thickness = max(1.0, len(pts) / span)
    out = []
    for i in range(ARC_SAMPLES):
        j = round(i * (len(ordered) - 1) / max(1, ARC_SAMPLES - 1))
        out.append({
            "dx": xs[j] / cw - 0.5,
            "dy": ys[j] / ch - 0.5,
            "r": thickness / 2 / cw,
            "group": group,
        })
    return out


def lamps_in(path: Path):
    im = Image.open(path).convert("RGBA")
    a = np.array(im).astype(int)
    cw, ch = im.size
    found = []
    group = 0
    arcs = []
    for pts in blobs(green_mask(a)):
        ys = [p[0] for p in pts]
        xs = [p[1] for p in pts]
        w = max(xs) - min(xs) + 1
        h = max(ys) - min(ys) + 1
        area = len(pts)
        fill = area / (w * h)
        if area >= ARC_MIN_AREA and fill <= ARC_MAX_FILL:
            arcs.extend(arc_points(pts, cw, ch, group))
            group += 1
            continue
        if not (AREA_RANGE[0] <= area <= AREA_RANGE[1]):
            continue
        if fill < MIN_FILL:
            continue
        if not (AR_RANGE[0] <= w / h <= AR_RANGE[1]):
            continue
        # Offsets from the box CENTRE, matching every other placement in these components.
        found.append(
            {
                "dx": (min(xs) + w / 2) / cw - 0.5,
                "dy": (min(ys) + h / 2) / ch - 0.5,
                # One radius, as a fraction of the box WIDTH -- the components draw circles.
                "r": (w + h) / 4 / cw,
                # Each bulb is its own group: they blink independently.
                "group": group,
            }
        )
        group += 1
    # Left-to-right, then top-to-bottom, so the emitted order is stable across runs.
    found.sort(key=lambda l: (round(l["dy"], 3), l["dx"]))
    return found + arcs, im.size


def main() -> None:
    blocks = []
    for name, path in PLATES.items():
        if not path.exists():
            print(f"  skip {name}: {path.relative_to(ROOT)} missing")
            continue
        lamps, size = lamps_in(path)
        print(f"  {name:8s} {size}  {len(lamps)} lamp(s)")
        groups = len({l["group"] for l in lamps})
        print(f"      {groups} group(s), {len(lamps)} point(s)")
        entries = ",\n".join(
            f"\t\t{{ dx: {l['dx']:+.4f}, dy: {l['dy']:+.4f}, r: {l['r']:.4f}, "
            f"group: {l['group']} }}"
            for l in lamps
        )
        blocks.append(f"\t{name}: [\n{entries}\n\t],")

    body = "\n".join(blocks)
    OUT.write_text(
        "// GENERATED by scripts/measure-green-lights.py -- do not hand-edit.\n"
        "//\n"
        "// The green indicator lamps are painted INTO each symbol plate, so the runtime cannot\n"
        "// make them blink without being told where they are. Offsets are from the symbol box\n"
        "// CENTRE and radii are fractions of its WIDTH, so they multiply straight by the box the\n"
        "// component is drawn at. Re-run the script after any art swap.\n"
        "// `group` ties points that must light TOGETHER: a bulb is one point in its own group,\n"
        "// an arc is a chain of points sharing one. Phase the blink by group, not by index, or an\n"
        "// arc ripples instead of lighting.\n"
        "export type GreenLight = { dx: number; dy: number; r: number; group: number };\n\n"
        "export const GREEN_LIGHTS: Record<string, GreenLight[]> = {\n"
        f"{body}\n"
        "};\n"
    )
    print(f"\nwrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
