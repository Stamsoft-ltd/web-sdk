#!/usr/bin/env python3
"""Rebuild the static animal tiles in components/symbols from the LIVE animation art.

The tiles under components/symbols are fallbacks: Board / BonusSymbolPanel / GameLogoFrame /
ExpandedSymbolPresenter all draw the *IdleAnim sheet and only fall back to the static when the
sheet is missing from loadedAssets; ExpandedSymbolOverlay does the same with the *Money sheet.
The shipped statics were the OLD pre-redesign art with a per-animal coloured frame baked in
(squirrel red, fox purple, wolf blue, ...), so a fallback painted that frame on top of the shared
brown `animal_border.webp` the reels draw underneath — two mismatched frames.

Which frame substitutes for a clip depends on how the clip plays. The idle and money sheets start
from their rest pose, so frame 0 is the seamless still for them. The WIN sheets are the opposite:
the clip starts neutral, builds to the celebration and HOLDS on its final frame (loop=false), so
frame 0 of a win sheet looks exactly like the idle bust — the correct win still is the LAST frame,
the pose players see persist. The busts stay FRAMELESS and transparent: Board draws animalBorder
underneath (Board.svelte:504) and the static on top (:564), so a baked frame would double up.

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


def sheet_frame(folder: str, index: int = 0) -> Image.Image:
    """A frame of a sprite sheet by position — 0 is the rest pose, -1 the held final pose."""
    d = SPRITES / folder
    meta_path = next(d.glob("*.json"))
    data = json.loads(meta_path.read_text())
    anims = data.get("animations") or {}
    # animations[] is ordered; fall back to the frames dict for sheets that declare no animation
    names = list(anims.values())[0] if anims else list(data["frames"])
    box = data["frames"][names[index]]["frame"]
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
        jobs.append((SYMBOLS / f"{a}.webp", f"{a}IdleAnim", True, 0, None))
        jobs.append((SYMBOLS / "landscape" / f"{a}.webp", f"{a}IdleAnim", True, 0, None))
        # <animal>_win.webp — the win-state fallback: the win clip's HELD final frame (frame 0 is
        # the neutral wind-up and reads as the plain idle bust). Landscape always had its own win
        # tiles; desktop/portrait used to reuse the base tile, so a winning animal whose sheets had
        # not loaded showed its idle pose. Sized off the animal's base tile (same cell aspect).
        jobs.append((SYMBOLS / f"{a}_win.webp", f"{a}WinNew", True, -1, SYMBOLS / f"{a}.webp"))
        jobs.append((SYMBOLS / "landscape" / f"{a}_win.webp", f"{a}WinNew", True, -1, None))
        # <animal>_expand.webp — the expanded column (money sheet). Frame 0 on purpose: the overlay
        # shows this only until the clip streams in, and the clip starts at frame 0, so the rest
        # pose hands off seamlessly. Already the right aspect and NOT a cutout: the money frame is
        # the whole column, so it is written at native size rather than fitted, which also drops it
        # from ~150KB to a few KB.
        jobs.append((SYMBOLS / f"{a}_expand.webp", f"{a}Money", False, 0, None))

    for dst, folder, fit, index, size_from in jobs:
        # A tile that does not exist yet borrows its canvas from `size_from` (same cell aspect).
        ref = dst if dst.exists() else size_from
        if ref is None or not ref.exists():
            print(f"  skip (no canvas reference) {dst.relative_to(ROOT)}")
            continue
        before = dst.stat().st_size if dst.exists() else 0
        canvas = Image.open(ref).size
        bust = sheet_frame(folder, index)
        out = fit_into(bust, canvas) if fit else bust
        if dry:
            print(f"  {dst.relative_to(ROOT)}  {canvas} <- {folder}[{index}] {bust.size}")
            continue
        out.save(dst, "WEBP", quality=QUALITY, method=6)
        after = dst.stat().st_size
        was = f"{before/1024:7.1f}K" if before else "    new"
        print(f"  {str(dst.relative_to(ROOT)):46s} {was} -> {after/1024:6.1f}K  ({folder}[{index}])")


if __name__ == "__main__":
    main()
