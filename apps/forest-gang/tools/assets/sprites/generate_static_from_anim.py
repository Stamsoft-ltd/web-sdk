#!/usr/bin/env python3
"""Rebuild the static animal tiles in components/symbols from the LIVE animation art.

The tiles under components/symbols are fallbacks: Board / BonusSymbolPanel / GameLogoFrame /
ExpandedSymbolPresenter all draw the *IdleAnim sheet and only fall back to the static when the
sheet is missing from loadedAssets; ExpandedSymbolOverlay does the same with the *Money sheet.
The shipped statics were the OLD pre-redesign art with a per-animal coloured frame baked in
(squirrel red, fox purple, wolf blue, ...), so a fallback painted that frame on top of the shared
brown `animal_border.webp` the reels draw underneath — two mismatched frames.

Frame 0 of each sheet IS the animation's rest pose, so it is the correct still. The busts stay
FRAMELESS and transparent: Board draws animalBorder underneath (Board.svelte:504) and the static
on top (:564), so a baked frame would double up.

Geometry: the static Sprite is drawn at symbol{W,H} * idleFit, which lands inside the frame's
inner panel (PANEL_W_FRAC/PANEL_H_FRAC of the border), so a bust filling FILL of a cell-aspect
canvas clears the wooden rails on every side. Canvas dimensions are taken from the file being
replaced — the Sprite sets width/height explicitly, so the canvas aspect (not its resolution) is
what keeps the art undistorted.

Usage: python3 generate_static_from_anim.py [--dry-run]
"""

import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3] / "static" / "assets"
SPRITES = ROOT / "sprites"
SYMBOLS = ROOT / "components" / "symbols"

ANIMALS = ["fox", "wolf", "bear", "rabbit", "squirrel"]

# Fraction of the canvas height the bust fills. The static's draw box is ~98% of the frame's inner
# panel height, so a full-height bust would grate against the top/bottom rails — leave a margin.
FILL = 0.94
# The idle path drops the bust so the face sits in the panel centre (Board's IDLE_BUST.yOff). The
# static is not zoomed to the face, so it only needs a light nudge to sit off the bottom rail.
Y_BIAS = -0.02
QUALITY = 82  # matches the repo-wide lossy re-encode (58598f1)


def sheet_frame0(folder: str) -> Image.Image:
    """First frame of a sprite sheet — the pose the animation rests on."""
    d = SPRITES / folder
    meta_path = next(d.glob("*.json"))
    data = json.loads(meta_path.read_text())
    anims = data.get("animations") or {}
    # animations[] is ordered; fall back to the frames dict for sheets that declare no animation
    name = list(anims.values())[0][0] if anims else next(iter(data["frames"]))
    box = data["frames"][name]["frame"]
    # meta.image can carry a ?v= cache-buster that is not part of the filename on disk
    src = Image.open(d / data["meta"]["image"].split("?")[0]).convert("RGBA")
    return src.crop((box["x"], box["y"], box["x"] + box["w"], box["y"] + box["h"]))


def fit_into(bust: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Centre the bust on a transparent canvas of `size`, scaled to FILL of its height."""
    w, h = size
    # Fit by height (the busts are tall), but never let a wide one (bear, wolf) run past the side
    # rails — fall back to a width fit when it would.
    scale = min((h * FILL) / bust.height, (w * FILL) / bust.width)
    bust = bust.resize((max(1, round(bust.width * scale)), max(1, round(bust.height * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.alpha_composite(bust, ((w - bust.width) // 2, round((h - bust.height) / 2 + h * Y_BIAS)))
    return canvas


def main() -> None:
    dry = "--dry-run" in sys.argv
    jobs = []
    for a in ANIMALS:
        # <animal>.webp and landscape/<animal>.webp — the base-state reel fallback (idle sheet)
        jobs.append((SYMBOLS / f"{a}.webp", f"{a}IdleAnim", True))
        jobs.append((SYMBOLS / "landscape" / f"{a}.webp", f"{a}IdleAnim", True))
        # landscape/<animal>_win.webp — the win-state fallback (win sheet)
        jobs.append((SYMBOLS / "landscape" / f"{a}_win.webp", f"{a}WinNew", True))
        # <animal>_expand.webp — the expanded column (money sheet). Already the right aspect and
        # NOT a cutout: the money frame is the whole column, so it is written at native size
        # rather than fitted, which also drops it from ~150KB to a few KB.
        jobs.append((SYMBOLS / f"{a}_expand.webp", f"{a}Money", False))

    for dst, folder, fit in jobs:
        if not dst.exists():
            print(f"  skip (no such file) {dst.relative_to(ROOT)}")
            continue
        before = dst.stat().st_size
        old_size = Image.open(dst).size
        bust = sheet_frame0(folder)
        out = fit_into(bust, old_size) if fit else bust
        if dry:
            print(f"  {dst.relative_to(ROOT)}  {old_size} <- {folder} frame0 {bust.size}")
            continue
        out.save(dst, "WEBP", quality=QUALITY, method=6)
        after = dst.stat().st_size
        print(f"  {str(dst.relative_to(ROOT)):46s} {before/1024:7.1f}K -> {after/1024:6.1f}K  ({folder})")


if __name__ == "__main__":
    main()
