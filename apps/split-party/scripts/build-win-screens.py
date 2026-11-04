"""The purple jelly bubble (Figma 11008:29321 and its copies) for BonusCard's flyers.

The big-win screens themselves (WinScreen.svelte) are the design's vectors since 2026-11-03,
public/win/v3/*.svg (Figma "Types of wins" 4013:920); their old raster art (plate, cloud, jelly,
title2-*, win2-*) is no longer built.

art-src/win/bubble.png  the Figma image fill, untouched
  -> public/win/hd/bubble.webp
    python3 apps/split-party/scripts/build-win-screens.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'art-src' / 'win'
OUT = ROOT / 'public' / 'win' / 'hd'
# Max width: its largest design width x 3.2 (stage scale 1.6 at 1920x1080, DPR 2).
WIDTH = {'bubble': 700}
OUT.mkdir(parents=True, exist_ok=True)
for name, w in WIDTH.items():
    src = SRC / f'{name}.png'
    hd = SRC / '2x' / src.name
    im = Image.open(hd if hd.exists() else src).convert('RGBA')
    if im.width > w:
        im = im.resize((w, round(w * im.height / im.width)), Image.LANCZOS)
    im.save(OUT / f'{name}.webp', quality=90, method=6)
    print(name, im.size, (OUT / f'{name}.webp').stat().st_size // 1024, 'KB')
