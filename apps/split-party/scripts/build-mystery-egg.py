"""Mystery-bonus egg (Figma 11174:5039) cut for MysteryEgg.svelte's break-open.

art-src/mystery/egg.png  the Figma image fill, untouched (the splash's egg.webp is the same art
                         at 200px, too small for the centre-stage egg)
  -> public/mystery/egg.webp         the whole egg, trimmed
  -> public/mystery/egg-top.webp     above the zigzag crack, with a cream shell rim on the cut
  -> public/mystery/egg-bottom.webp  below it
  -> public/mystery/egg-crack.webp   the crack line itself (with two side branches), clipped
                                     to the egg, drawn over the whole egg before it breaks
All four share one canvas, so they stack exactly.
    python3 apps/split-party/scripts/build-mystery-egg.py
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'mystery'
W = 640  # px; drawn at up to ~290 css px (1920 wide), so 2x+ (the master's egg is 976 wide)
K = W / 540  # the line widths below were tuned at 540
TEETH = 9
CRACK_Y = 0.47  # of the egg's height
AMP = 0.045  # tooth height, of the egg's height
RIM = '#fff4d6'
LINE = '#5b2a86'

OUT.mkdir(parents=True, exist_ok=True)
egg = Image.open(ROOT / 'art-src' / 'mystery' / 'egg.png').convert('RGBA')
egg = egg.crop(egg.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox())
egg = egg.resize((W, round(W * egg.height / egg.width)), Image.LANCZOS)
w, h = egg.size
# The zigzag, a little past both edges so the halves close.
zig = [(-10 * K, h * CRACK_Y)] + [
    (w * i / TEETH, h * (CRACK_Y + (AMP if i % 2 else -AMP))) for i in range(TEETH + 1)
] + [(w + 10 * K, h * CRACK_Y)]


def half(top):
    mask = Image.new('L', (w, h), 0)
    m = 10 * K
    edge = [(-m, -m), (w + m, -m)] if top else [(-m, h + m), (w + m, h + m)]
    ImageDraw.Draw(mask).polygon(zig + edge[::-1] if top else zig + edge[::-1], fill=255)
    part = egg.copy()
    part.putalpha(ImageChops.multiply(egg.getchannel('A'), mask))
    # Cream shell rim along the cut, kept inside the part.
    rim = Image.new('L', (w, h), 0)
    ImageDraw.Draw(rim).line(zig, fill=255, width=round(14 * K), joint='curve')
    rim = ImageChops.multiply(rim, part.getchannel('A'))
    part.paste(Image.new('RGBA', (w, h), RIM), (0, 0), rim)
    return part


egg.save(OUT / 'egg.webp', quality=90, method=6)
half(True).save(OUT / 'egg-top.webp', quality=90, method=6)
half(False).save(OUT / 'egg-bottom.webp', quality=90, method=6)
crack = Image.new('L', (w, h), 0)
d = ImageDraw.Draw(crack)
d.line(zig, fill=255, width=round(7 * K), joint='curve')
# Two short branches off the zigzag's teeth.
for i, (dx, dy) in ((3, (-0.04, -0.09)), (6, (0.05, 0.08))):
    x, y = zig[i + 1]
    d.line([(x, y), (x + w * dx, y + h * dy), (x + w * dx * 1.6, y + h * dy * 1.3)], fill=255, width=round(5 * K), joint='curve')
crack = ImageChops.multiply(crack.filter(ImageFilter.GaussianBlur(0.8 * K)), egg.getchannel('A'))
line = Image.new('RGBA', (w, h), LINE)
line.putalpha(crack)
line.save(OUT / 'egg-crack.webp', quality=90, method=6)
for n in ('egg', 'egg-top', 'egg-bottom', 'egg-crack'):
    print(n, (w, h), (OUT / f'{n}.webp').stat().st_size // 1024, 'KB')
