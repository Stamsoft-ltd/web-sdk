"""The scatter symbol (math name BASKET) is the spotted egg: the same Figma art as the
Mystery egg and the splash/buy-card egg (art-src/mystery/egg.png, 1254px), cut as a board
symbol so Blob.svelte draws it like the fruit.

  -> public/symbols/BASKET.webp  224x224, the egg fitted to the fruit symbols' content box
     (they fill about y 29-203 of their 224 canvas), centred, feet on the same baseline.
  -> public/splash/egg.webp     600x600, the splash / buy-card / info egg: the egg at y 42-576,
     centred (the old 200px export's placement at 3x, which the buy cards showed at 0.58x).
    python3 apps/split-party/scripts/build-scatter-egg.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SIZE = 224
TOP, BOTTOM = 22, 206  # the egg stands a touch taller than the fruit, as the special symbol

egg = Image.open(ROOT / 'art-src' / 'mystery' / 'egg.png').convert('RGBA')
egg = egg.crop(egg.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox())


def cut(size, top, bottom, path):
    h = bottom - top
    w = round(h * egg.width / egg.height)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.alpha_composite(egg.resize((w, h), Image.LANCZOS), ((size - w) // 2, top))
    out.save(path, quality=90, method=6)
    print(path.name, out.size, (w, h), path.stat().st_size // 1024, 'KB')


cut(SIZE, TOP, BOTTOM, ROOT / 'public' / 'symbols' / 'BASKET.webp')
cut(600, 42, 576, ROOT / 'public' / 'splash' / 'egg.webp')
