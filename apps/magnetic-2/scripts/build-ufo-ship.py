#!/usr/bin/env python3
"""Prepare the alien ship as ONE piece and measure where its lights are.

The MOTHERSHIP design (Figma 9148:31504) draws the ship as a single side-view saucer — glass dome,
antenna ball on a stem, magenta rim lamps, the emitter oval on its underside — with its own neon
halo. It replaced the loose hull + antenna pair that build-ufo-art.py assembled, so the antenna is
no longer a separate sprite: it is painted into the ship and only its BEACON glow is drawn.

    art-src/ufo/ship.png   the designer's saucer, transparent   -> ui/ufo_ship.webp

Everything Background.svelte and game/ufoLamps.ts need is MEASURED here, in fractions of the
trimmed sprite box: the emitter the drawn beam hangs off, the rim lamps the chase runs round, the
antenna ball the beacon sits on, and how wide the opaque saucer is against the box (the halo pads
the box, so the ship is sized off the SAUCER, not the box).

Run:  python3 scripts/build-ufo-ship.py
"""

from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art-src" / "ufo" / "ship.png"
OUT = ROOT / "static" / "assets" / "components" / "ui" / "ufo_ship.webp"
PREVIEW = ROOT / "art-src" / "ufo" / "preview_ship.png"

MAX_W = 640
RGBA_WEBP = dict(quality=90, method=6, alpha_quality=95)


def die(msg: str) -> None:
    sys.exit(f"build-ufo-ship: {msg}")


def trim(im: Image.Image) -> Image.Image:
    bb = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if bb is None:
        die("the source came out empty")
    return im.crop(bb)


def components(mask: np.ndarray, min_px: int) -> list[dict]:
    """Connected blobs of a boolean mask, as bounding boxes; plain BFS, no scipy."""
    h, w = mask.shape
    seen = np.zeros_like(mask, bool)
    out = []
    ys, xs = np.nonzero(mask)
    for y0, x0 in zip(ys, xs):
        if seen[y0, x0]:
            continue
        q = deque([(y0, x0)])
        seen[y0, x0] = True
        pts = []
        while q:
            y, x = q.popleft()
            pts.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((ny, nx))
        if len(pts) < min_px:
            continue
        py = np.array([p[0] for p in pts])
        px = np.array([p[1] for p in pts])
        out.append(
            {
                "x0": int(px.min()),
                "x1": int(px.max()) + 1,
                "y0": int(py.min()),
                "y1": int(py.max()) + 1,
                "area": len(pts),
            }
        )
    return out


def frac_box(c: dict, w: int, h: int) -> dict:
    """A blob as ufoLamps.ts wants it: centre offset from the box centre, size, all box fractions."""
    return {
        "x": round(((c["x0"] + c["x1"]) / 2 - w / 2) / w, 4),
        "y": round(((c["y0"] + c["y1"]) / 2 - h / 2) / h, 4),
        "w": round((c["x1"] - c["x0"]) / w, 4),
        "h": round((c["y1"] - c["y0"]) / h, 4),
    }


def main() -> None:
    if not SRC.exists():
        die("missing art-src/ufo/ship.png")
    ship = trim(Image.open(SRC).convert("RGBA"))
    a = np.asarray(ship).astype(int)
    h, w = a.shape[:2]
    rgb, alpha = a[..., :3], a[..., 3]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    solid = alpha > 200

    # The saucer's own width: the widest solid row. The halo is soft, so it falls below `solid`.
    spans = solid.sum(axis=1)
    rim_row = int(np.argmax(spans))
    xs = np.nonzero(solid[rim_row])[0]
    saucer_w = int(xs.max() - xs.min() + 1)
    saucer_cx = (xs.min() + xs.max()) / 2

    # Magenta ink: the rim lamps and the antenna ball. Keyed the same way ufoLamps.ts documents.
    pink = solid & (r > 170) & (b > 190) & (g < 170)
    # The rim's magenta highlight keys too, as thin slivers along the saucer's edge (the biggest is
    # 0.0009 of the box in area); the smallest lamp is 0.0022. Only the lamps' magenta OUTLINE keys
    # — their pale pink fill is too light — so a lamp blob is a ring and fills its box loosely.
    blobs = [
        c for c in components(pink, min_px=150) if c["area"] > 0.0015 * w * h and c["y1"] - c["y0"] > h * 0.05
    ]
    if len(blobs) < 4:
        die(f"found only {len(blobs)} magenta blobs; expected the ball and the rim lamps")
    blobs.sort(key=lambda c: c["y0"])
    ball, lamps = blobs[0], blobs[1:]
    ball_w = ball["x1"] - ball["x0"]
    if not 0.05 < ball_w / saucer_w < 0.2:
        die(f"the top magenta blob is {ball_w / saucer_w:.3f} of the saucer wide — not the ball")
    # Chase order: round the ring, clockwise from the left, by angle about the saucer's centre.
    cy_all = sum((c["y0"] + c["y1"]) / 2 for c in lamps) / len(lamps)
    lamps.sort(
        key=lambda c: np.arctan2((c["y0"] + c["y1"]) / 2 - cy_all, (c["x0"] + c["x1"]) / 2 - saucer_cx)
    )

    # The emitter: the oval outlined on the underside, dead centre. Its outline is the art's navy
    # ink; inside a bottom-centre window the only other navy is the saucer's outer edge, which runs
    # the full window width — the oval is the largest blob that does NOT.
    win = np.zeros((h, w), bool)
    win[int(h * 0.68) :, int(w * 0.27) : int(w * 0.73)] = True
    navy = win & solid & (r < 80) & (g < 70) & (b < 140)
    ovals = [
        c
        for c in components(navy, min_px=200)
        if c["x1"] - c["x0"] < int(w * 0.73) - int(w * 0.27) - 6
    ]
    if not ovals:
        die("could not find the emitter oval on the underside")
    oval = max(ovals, key=lambda c: c["area"])

    if ship.width > MAX_W:
        ship_out = ship.resize((MAX_W, round(ship.height * MAX_W / ship.width)), Image.LANCZOS)
    else:
        ship_out = ship
    OUT.parent.mkdir(parents=True, exist_ok=True)
    ship_out.save(OUT, **RGBA_WEBP)

    print("written", OUT.relative_to(ROOT), ship_out.size, f"{OUT.stat().st_size // 1024}KB")
    print("\nconstants for Background.svelte:")
    print(f"  shipAspect     {w / h:.4f}   (box w/h)")
    print(f"  saucerOfBox    {saucer_w / w:.4f}   (opaque saucer width / box width)")
    e = frac_box(oval, w, h)
    print(
        f"  EMITTER        cx={0.5 + e['x']:.4f} w={e['w']:.4f} bottom={oval['y1'] / h:.4f}"
        f" cy={0.5 + e['y']:.4f}   (fractions of the box)"
    )
    bb = frac_box(ball, w, h)
    print(f"  BEACON         x={bb['x']:.4f} y={bb['y']:.4f} r={bb['w'] / 2:.4f}   (box fractions)")
    print("\nconstants for game/ufoLamps.ts (box fractions, centre-relative):")
    for c in lamps:
        f = frac_box(c, w, h)
        print(f"  {{ x: {f['x']}, y: {f['y']}, w: {f['w']}, h: {f['h']} }},")
    print(f"  UFO_EMITTER {{ x: {e['x']}, y: {e['y']}, w: {e['w']}, h: {e['h']} }}")

    # Preview with everything measured marked on it.
    from PIL import ImageDraw

    pv = ship.copy()
    d = ImageDraw.Draw(pv)
    for c in lamps:
        d.rectangle([c["x0"], c["y0"], c["x1"], c["y1"]], outline=(0, 255, 0, 255), width=3)
    d.rectangle([ball["x0"], ball["y0"], ball["x1"], ball["y1"]], outline=(255, 255, 0, 255), width=3)
    d.rectangle([oval["x0"], oval["y0"], oval["x1"], oval["y1"]], outline=(0, 255, 255, 255), width=3)
    d.line([(xs.min(), rim_row), (xs.max(), rim_row)], fill=(255, 0, 0, 255), width=3)
    pv.save(PREVIEW)
    print("\npreview:", PREVIEW.relative_to(ROOT))


if __name__ == "__main__":
    main()
