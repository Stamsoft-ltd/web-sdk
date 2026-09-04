#!/usr/bin/env python3
"""Mystery Bonus reveal + "you won" congratulations art — MOTHERSHIP design.

Two screens are built from these pieces:

  REVEAL (9185:18451) — the orb machine holds a "?" while the draw resolves.
      orb.png    9183:1717   553x575  the machine (dome, base, lamps)
      q.png      9183:1714   223x223  the "?" alone, so it can turn inside the dome

  CONGRATULATIONS (9185:18982 gravity / 9185:19244 core / 9185:19506 zero) — one layout, three
  badges. The pad and the aliens are shared; only the badge emblem changes.
      pad.png            9185:2099   1160x515  the plate the copy sits on
      blob.png           9185:13954  118x111   the slime stuck to the value box's top-right corner
      badge_*.png        9185:19159 / 19421 / 19683   the emblem inside the lime ring
      slime_a/b.png      9185:19160 / 19161  the two slime blobs stuck to the ring
      alien_a/b.png      9185:9455 / 9185:9454   the two peeking aliens

Sources are Figma /images renders (2x for the large plates, 3x for the small pieces), which honour
the node's own transparency — the MCP's download_assets export is always opaque, see
art-src/REBUILD-QUEUE.md.

Nothing is trimmed: every piece is placed from the design's own frame coordinates, so the exported
box IS the placement. Trimming would silently shift each one by its own margin.

Run:  python3 scripts/build-mystery-screens.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art-src" / "mystery"
OUT = ROOT / "static" / "assets" / "components" / "ui"

WEBP = dict(quality=90, method=6, alpha_quality=95)

# source stem -> shipped name. The `my_` prefix keeps the whole feature together in the folder.
TARGETS = {
    "orb": "my_orb",
    "q": "my_q",
    "pad": "my_pad",
    "blob": "my_blob",
    "badge_gravity": "my_badge_gravity",
    "badge_core": "my_badge_core",
    "badge_zero": "my_badge_zero",
    "slime_a": "my_slime_a",
    "slime_b": "my_slime_b",
    "alien_a": "my_alien_a",
    "alien_b": "my_alien_b",
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for stem, name in TARGETS.items():
        src = SRC / f"{stem}.png"
        img = Image.open(src).convert("RGBA")
        dst = OUT / f"{name}.webp"
        img.save(dst, "WEBP", **WEBP)
        size = dst.stat().st_size
        total += size
        print(f"{src.name:20s} {img.width}x{img.height}  ->  {dst.name:22s} {size:>8}B")
    print(f"{'':20s} {'':>9}      {'total':22s} {total:>8}B")


if __name__ == "__main__":
    main()
