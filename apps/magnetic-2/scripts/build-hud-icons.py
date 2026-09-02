#!/usr/bin/env python3
"""Recolour the bottom-bar glyphs that are still painted for the old blue HUD.

The MOTHERSHIP bar (Figma 9032:23173) draws every glyph white on a violet control. Most of the icon
set is already flat white SVG and needs nothing; these three are raster art in the old palette:

    spin_arrow.webp   blue glyph on transparency -> white   (the glyph inside the spin disc)
    ic_thunder.webp   white bolt on a NAVY TILE   -> white glyph on transparency (turbo, "off"
                      state; its own double/outline siblings are already transparent)
    coins.webp        blue stack                  -> violet (the BET coin stack)

Done in the file rather than with a CSS filter because `brightness(0) invert(1)` would flatten the
coin stack's internal shading into one white blob (it stops reading as coins) and would turn the
bolt's opaque tile into a white block. Each icon gets the treatment its own art needs -- see the
three modes below. This script is IDEMPOTENT-UNSAFE by nature: it rewrites the files in place, so
re-run it against pristine art (apps/magnetic ships the originals) rather than against its output.

Run:  python3 scripts/build-hud-icons.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
UI = ROOT / "static" / "assets" / "components" / "ui"
NAVBAR = ROOT / "static" / "assets" / "components" / "navbar"
PREVIEW = ROOT / "art-src" / "room" / "preview_hud_icons.png"

# The bar's accent, and the pale tint the design gives the coin stack.
COIN_LIGHT = (214, 216, 255)
COIN_DARK = (122, 124, 214)


def die(msg: str) -> None:
    sys.exit(f"build-hud-icons: {msg}")


def to_white(path: Path) -> Image.Image:
    """Force every visible pixel white, keeping the alpha silhouette."""
    im = Image.open(path).convert("RGBA")
    a = np.array(im)
    if a[:, :, 3].min() == 255:
        die(f"{path.name} is fully opaque -- use the 'glyph' mode, not 'white'")
    a[:, :, :3] = 255
    return Image.fromarray(a, "RGBA")


def to_glyph(path: Path, lo: float = 90.0, hi: float = 200.0) -> Image.Image:
    """Lift a light glyph off an opaque dark tile, as a white shape on transparency.

    ic_thunder ships as a white bolt baked onto a navy square -- unlike its own double/outline
    siblings, which are already transparent. On the new violet bar that square reads as a misplaced
    dark chip, and simply whitening every pixel (the 'white' mode) turns the tile into a white block.
    Luminance is the key here: the bolt is the only bright thing in the file.
    """
    im = Image.open(path).convert("RGBA")
    a = np.array(im).astype(np.float32)
    lum = (a[:, :, :3] * np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)).sum(axis=2)
    t = np.clip((lum - lo) / (hi - lo), 0, 1)
    alpha = t * t * (3 - 2 * t) * (a[:, :, 3] / 255.0)  # smoothstep, respecting any existing alpha
    out = np.full_like(a, 255)
    out[:, :, 3] = alpha * 255
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")


def to_ramp(path: Path, dark: tuple[int, int, int], light: tuple[int, int, int]) -> Image.Image:
    """Re-map the glyph onto a two-stop colour ramp by its own luminance.

    Keeps the shading (which is what separates one coin from the next) while moving the whole icon
    into the new palette.
    """
    im = Image.open(path).convert("RGBA")
    a = np.array(im).astype(np.float32)
    rgb, alpha = a[:, :, :3], a[:, :, 3]
    lum = (rgb * np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)).sum(axis=2)
    vis = alpha > 20
    if not vis.any():
        die(f"{path.name} is fully transparent")
    lo, hi = lum[vis].min(), lum[vis].max()
    t = np.zeros_like(lum) if hi - lo < 1e-3 else np.clip((lum - lo) / (hi - lo), 0, 1)
    out = np.empty_like(a)
    for c in range(3):
        out[:, :, c] = dark[c] + (light[c] - dark[c]) * t
    out[:, :, 3] = alpha
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")


def main() -> None:
    jobs = [
        (UI / "spin_arrow.webp", "white"),
        (UI / "ic_thunder.webp", "glyph"),
        (NAVBAR / "coins.webp", "coins"),
    ]
    tiles = []
    for path, mode in jobs:
        if not path.exists():
            die(f"missing {path.relative_to(ROOT)}")
        before = Image.open(path).convert("RGBA")
        if mode == "white":
            after = to_white(path)
        elif mode == "glyph":
            after = to_glyph(path)
        else:
            after = to_ramp(path, COIN_DARK, COIN_LIGHT)
        after.save(path, lossless=True, method=6)
        print(f"  {path.name:20s} {after.size} {path.stat().st_size // 1024}KB  ({mode})")
        tiles += [before, after]

    # Preview on the bar's own fill, which is the only background these are ever seen against.
    h = 96
    scaled = [t.resize((max(1, round(t.width * h / t.height)), h), Image.LANCZOS) for t in tiles]
    w = sum(t.width for t in scaled) + 16 * (len(scaled) + 1)
    sheet = Image.new("RGBA", (w, h + 32), (0x3A, 0x39, 0x81, 255))
    x = 16
    for t in scaled:
        sheet.alpha_composite(t, (x, 16))
        x += t.width + 16
    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(PREVIEW)
    print("\npreview (before/after pairs on the bar fill):", PREVIEW.relative_to(ROOT))


if __name__ == "__main__":
    main()
