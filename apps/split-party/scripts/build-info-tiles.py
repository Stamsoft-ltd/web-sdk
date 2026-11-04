"""Overview page tile icons (the user's art, 2026-11-04), shown at 44x44 in GameInfo's .tiles.

art-src/info/v2/tile-<grid|cluster|trophy|rtp>.png
  -> public/info/v2/tile-<name>.webp  cropped to the art, centred on a transparent square at
                                      its own size (never upscaled), so the 44px box keeps
                                      its shape
    python3 apps/split-party/scripts/build-info-tiles.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'art-src' / 'info' / 'v2'
OUT = ROOT / 'public' / 'info' / 'v2'

OUT.mkdir(parents=True, exist_ok=True)
for name in ('grid', 'cluster', 'trophy', 'rtp'):
	im = Image.open(SRC / f'tile-{name}.png').convert('RGBA')
	im = im.crop(im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox())
	n = max(im.size)
	sq = Image.new('RGBA', (n, n))
	sq.alpha_composite(im, ((n - im.width) // 2, (n - im.height) // 2))
	sq.save(OUT / f'tile-{name}.webp', quality=92, alpha_quality=100, method=6)
	print(name, im.size, '->', sq.size)
