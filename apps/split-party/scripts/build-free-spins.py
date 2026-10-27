"""Free-spins intro art (Figma 11233:12259) for FreeSpinsIntro.svelte.

art-src/freespins/*.png  the Figma image fills, untouched
  badge.png        the neon sci-fi badge underneath (11233:12264)
  cloud.png        the glossy purple cloud plaque on top (11233:12266)
  pink-bubble.png  the glossy pink jelly bubble (11233:12262 / 11233:12263)
  (the purple bubble, 11020:33211 and copies, is public/win/hd/bubble.webp: the same image)
  2x/<name>.png    Real-ESRGAN 2x of badge and cloud (upscale-art.py), used in place of the
                   master when present
  -> public/freespins/hd/*.webp, same canvases (only scaled), so the design's boxes hold.
    (hd/: new folder rather than new contents, browsers keep the old art under the old names)
    python3 apps/split-party/scripts/build-free-spins.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'art-src' / 'freespins'
OUT = ROOT / 'public' / 'freespins' / 'hd'
# Max width per file: its largest design width x 3.2 (stage scale 1.6 at 1920x1080, DPR 2);
# the badge (1324 -> 4237) is capped by its 2x master.
WIDTH = {'badge': 3548, 'cloud': 3217, 'pink-bubble': 1254}
OUT.mkdir(parents=True, exist_ok=True)
for src in sorted(SRC.glob('*.png')):
    name = src.stem
    w = WIDTH[name]
    hd = SRC / '2x' / src.name
    im = Image.open(hd if hd.exists() else src).convert('RGBA')
    if im.width > w:
        im = im.resize((w, round(w * im.height / im.width)), Image.LANCZOS)
    im.save(OUT / f'{name}.webp', quality=90, method=6)
    print(name, im.size, (OUT / f'{name}.webp').stat().st_size // 1024, 'KB')
