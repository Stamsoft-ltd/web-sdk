#!/usr/bin/env python3
"""Buy-menu card icons — MOTHERSHIP design 9164:11722 ("Bonus menu", SECTION 9078:18631 POPUPS).

Three of the five cards picture a REEL SYMBOL the game already ships (Extra Chance = the circuit
chip, Feature Spins = the WILD), but the two bought bonuses and the Mystery buy are drawn as their
own small icons that exist nowhere else in the game:

    gravity.png   9185:1798   120x69   Gravity Breach   — the ringed planet
    core.png      9185:1936    93x69   Core Overload    — the molecule
    mystery.png   9163:34168   64x68   Mystery Bonus    — the "?" dome

art-src/bonusmenu/zero.png (9183:1790, the magnet) is the design's fourth icon and is kept beside
them, but NOT built: Zero Point Protocol has no bet mode, so it gets no card in the buy menu (the
user removed it 2026-09-04) — rules page 5 shows it with its 5-scatter badge instead. Add "zero"
back to TARGETS when the math publishes the mode.

Sources are Figma /images renders at 4x, which honour the node's own transparency (the MCP's
download_assets export is always opaque — see art-src/REBUILD-QUEUE.md).

NOT trimmed, deliberately: each icon is drawn inside a box the design sized against the card, and
the art sits off-centre in some of them (the planet's ring runs wider than its body). The card CSS
gives every icon the SAME height — 69/345 of the card width — and lets the width follow, so the
boxes must survive the conversion or each icon would need a hand-tuned offset to sit right again.

Run:  python3 scripts/build-bonus-menu-icons.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art-src" / "bonusmenu"
OUT = ROOT / "static" / "assets" / "components" / "ui"

WEBP = dict(quality=90, method=6, alpha_quality=95)
TARGETS = ["gravity", "core", "mystery"]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name in TARGETS:
        src = SRC / f"{name}.png"
        img = Image.open(src).convert("RGBA")
        dst = OUT / f"bb_ic_{name}.webp"
        img.save(dst, "WEBP", **WEBP)
        print(f"{src.name:14s} {img.width}x{img.height}  ->  {dst.name}  {dst.stat().st_size}B")


if __name__ == "__main__":
    main()
