"""Free-spins intro art (Figma 11233:12259) for FreeSpinsIntro.svelte.

art-src/freespins/*.png  the Figma image fills, untouched
  badge.png        the neon sci-fi badge underneath (11233:12264)
  cloud.png        the glossy purple cloud plaque on top (11233:12266)
  pink-bubble.png  the glossy pink jelly bubble (11233:12262 / 11233:12263)
  (the purple bubble, 11020:33211 and copies, is public/win/bubble.webp: the same image)
  -> public/freespins/*.webp, same canvases (only scaled), so the design's boxes hold.
    python3 apps/split-party/scripts/build-free-spins.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'art-src' / 'freespins'
OUT = ROOT / 'public' / 'freespins'
# Max width per file, about 2x its use on the 1200px stage (the sources cap all three).
WIDTH = {'badge': 1774, 'cloud': 1774, 'pink-bubble': 1254}
OUT.mkdir(parents=True, exist_ok=True)
for src in sorted(SRC.glob('*.png')):
    name = src.stem
    w = WIDTH[name]
    im = Image.open(src).convert('RGBA')
    if im.width > w:
        im = im.resize((w, round(w * im.height / im.width)), Image.LANCZOS)
    im.save(OUT / f'{name}.webp', quality=90, method=6)
    print(name, im.size, (OUT / f'{name}.webp').stat().st_size // 1024, 'KB')
