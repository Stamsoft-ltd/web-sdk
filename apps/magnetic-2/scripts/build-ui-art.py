#!/usr/bin/env python3
"""Prepare the UI plates: convert the designer-supplied ones, recolour the leftovers.

CONVERT — designer PNGs in art-src/ui/. They arrive with transparent margins, and trimming matters:
every consumer sizes the sprite from its own box, so a plate that ships with margin renders smaller
than it measures and its text lands off-centre.

    win_plaque.png -> ui/win_plaque.webp   the small-win amount plate

RECOLOUR — art the MOTHERSHIP redesign did not replace, still painted for the old blue-tech palette.
A hue ROTATION, not a tint: these plates are near-monochrome blue over neutral metal, and rotating
hue leaves anything unsaturated where it is, so the housing stays grey while the glass and trim
swing violet. IN PLACE, so re-run against pristine art (apps/magnetic ships the originals) rather
than against this script's own output, or the rotation compounds.

    frames/info_box.webp   RESPIN / TOTAL WIN / FREE SPINS plate

Run:  python3 scripts/build-ui-art.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art-src" / "ui"
OUT = ROOT / "static" / "assets" / "components" / "ui"

WEBP = dict(quality=90, method=6, alpha_quality=95)
TARGETS = ["win_plaque"]

# The old art clusters near hue 211-218; the HUD accent (#A88EFF) is 256.
RECOLOUR = {Path("static/assets/components/frames/info_box.webp"): 40.0}


def rotate_hue(im: Image.Image, degrees: float) -> Image.Image:
    """Rotate hue in HSV, leaving saturation, value and alpha untouched."""
    a = np.asarray(im.convert("RGBA")).astype(np.float32)
    rgb = a[:, :, :3] / 255.0
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(axis=2), rgb.min(axis=2)
    d = mx - mn
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0.0)
    v = mx

    h = np.zeros_like(mx)
    lit = d > 1e-6
    m = lit & (mx == r)
    h[m] = ((g - b)[m] / d[m]) % 6
    m = lit & (mx == g)
    h[m] = ((b - r)[m] / d[m]) + 2
    m = lit & (mx == b)
    h[m] = ((r - g)[m] / d[m]) + 4
    h = (h / 6.0 + degrees / 360.0) % 1.0

    i = np.floor(h * 6).astype(int) % 6
    f = h * 6 - np.floor(h * 6)
    p, q, t = v * (1 - s), v * (1 - f * s), v * (1 - (1 - f) * s)
    out = np.empty_like(rgb)
    for k, (rr, gg, bb) in enumerate(
        [(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]
    ):
        sel = i == k
        out[..., 0][sel], out[..., 1][sel], out[..., 2][sel] = rr[sel], gg[sel], bb[sel]

    res = a.copy()
    res[:, :, :3] = np.clip(out, 0, 1) * 255
    return Image.fromarray(res.round().astype(np.uint8), "RGBA")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name in TARGETS:
        src = SRC / f"{name}.png"
        if not src.exists():
            sys.exit(f"build-ui-art: missing art-src/ui/{name}.png")
        im = Image.open(src).convert("RGBA")
        bb = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
        if bb is None:
            sys.exit(f"build-ui-art: {name}.png is fully transparent")
        art = im.crop(bb)
        art.save(OUT / f"{name}.webp", **WEBP)
        print(
            f"  {name}.webp {art.size} aspect {art.width / art.height:.4f}"
            f" {(OUT / f'{name}.webp').stat().st_size // 1024}KB"
        )

    for rel, degrees in RECOLOUR.items():
        path = ROOT / rel
        if not path.exists():
            sys.exit(f"build-ui-art: missing {rel}")
        rotate_hue(Image.open(path), degrees).save(path, **WEBP)
        print(f"  {rel.name} hue {degrees:+.0f}deg {path.stat().st_size // 1024}KB")


if __name__ == "__main__":
    main()
