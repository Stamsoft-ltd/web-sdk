"""Mystery-bonus egg (Figma 11174:5039) cut for MysteryEgg.svelte's break-open.

art-src/mystery/egg.png  the Figma image fill, untouched (the splash's egg.webp is the same art
                         at 200px, too small for the centre-stage egg)
  -> public/mystery/v3/egg.webp         the whole egg, trimmed
  -> public/mystery/v3/egg-top.webp     above the crack, its cut edge the shell's thickness
  -> public/mystery/v3/egg-bottom.webp  below it
  -> public/mystery/v3/egg-crack.webp   the crack itself, clipped to the egg, drawn over the whole
                                        egg before it breaks. Cartoon, like the scatter tile's
                                        hatched egg (user, 2026-10-27): one bold zigzag of sharp
                                        teeth right round the egg, widest at the knock, no
                                        hairlines. MysteryEgg reveals it from the middle out,
                                        knock by knock, light glowing in its slit.
  -> public/mystery/v3/egg-leak.webp    the crack's inner slit only (white, thinner than the core):
                                     MysteryEgg's mask for the light seeping through, so the
                                     light sits inside the dark edges instead of washing them out
All share one canvas, so they stack exactly. (v3/: a new folder rather than new contents under
hd/ or v2/, as browsers keep the old art under the old names.)
    python3 apps/split-party/scripts/build-mystery-egg.py
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'mystery' / 'v3'
W = 976  # px, the master's egg: drawn 270 stage px = 864 device px at 1920x1080 DPR 2
K = W / 540  # the line widths below were tuned at 540
CRACK_Y = 0.47  # of the egg's height
CORE = (46, 14, 72)  # the crack's dark gap and outline
CREAM = (255, 242, 196)  # the shell's broken edge, lit
AMBER = (240, 168, 64)  # the same edge in shade, towards the egg's paint
import os
SEED = int(os.environ.get('CRACK_SEED', 101))  # the fracture is random but fixed: change it for another crack

OUT.mkdir(parents=True, exist_ok=True)
egg = Image.open(ROOT / 'art-src' / 'mystery' / 'egg.png').convert('RGBA')
egg = egg.crop(egg.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox())
egg = egg.resize((W, round(W * egg.height / egg.width)), Image.LANCZOS)
w, h = egg.size
rng = np.random.default_rng(SEED)
# The break: sharp teeth alternating up and down from the middle out to each side, a little past
# both edges so the halves close. Uneven on purpose (a regular zigzag read as sewn-on trim):
# each tooth 4-11% of the width wide and 2.5-8% of the height tall.
CX, CY = w * 0.5, h * CRACK_Y


def run(direction):
    pts, x, up = [], CX, rng.random() < 0.5
    while -12 * K < x < w + 12 * K:
        x += direction * w * rng.uniform(0.04, 0.11)
        pts.append((x, CY + h * rng.uniform(0.025, 0.08) * (-1 if up else 1) * 0.5))
        up = not up
    return pts


zig = run(-1)[::-1] + [(CX, CY + h * 0.025)] + run(1)


def half(top):
    mask = Image.new('L', (w, h), 0)
    m = 10 * K
    edge = [(-m, -m), (w + m, -m)] if top else [(-m, h + m), (w + m, h + m)]
    ImageDraw.Draw(mask).polygon(zig + edge[::-1] if top else zig + edge[::-1], fill=255)
    part = egg.copy()
    part.putalpha(ImageChops.multiply(egg.getchannel('A'), mask))
    # The cut edge is the shell's thickness: amber, cream over it, a dark outline on the break
    # itself (each a line along the cut, kept inside the part, so half its width shows).
    for colour, width in ((AMBER, 30), (CREAM, 22), (CORE, 7)):
        band = Image.new('L', (w, h), 0)
        ImageDraw.Draw(band).line(zig, fill=255, width=round(width * K), joint='curve')
        band = ImageChops.multiply(band, part.getchannel('A'))
        part.paste(Image.new('RGBA', (w, h), colour + (255,)), (0, 0), band)
    return part


egg.save(OUT / 'egg.webp', quality=90, method=6)
half(True).save(OUT / 'egg-top.webp', quality=90, method=6)
half(False).save(OUT / 'egg-bottom.webp', quality=90, method=6)


def taper(x):
    # Line width factor: 1 at the impact, 0.45 at the egg's sides (a break opens widest where
    # it was knocked).
    return 0.45 + 0.55 * max(0.0, 1 - abs(x - CX) / (w * 0.5)) ** 1.2


def stroke(d, pts, width, fill, dy=0.0, end=0.35):
    # A polyline whose width follows taper() (times `end`→1 along a branch), joints rounded.
    n = len(pts) - 1
    for i in range(n):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        f = (1 - (1 - end) * i / max(1, n)) * taper((x0 + x1) / 2) * width
        d.line([(x0, y0 + dy), (x1, y1 + dy)], fill=fill, width=max(1, round(f)))
        r = f / 2
        d.ellipse([x1 - r, y1 + dy - r, x1 + r, y1 + dy + r], fill=fill)


# Over the whole egg: a soft shadow round the break and the dark gap itself. No shell edge here:
# a cream lip under the gap, with the light in it, read as striped tape; the edge shows on the
# broken halves instead.
shade = Image.new('L', (w, h), 0)
core = Image.new('L', (w, h), 0)
slit = Image.new('L', (w, h), 0)
stroke(ImageDraw.Draw(shade), zig, 34 * K, 255, end=1)
stroke(ImageDraw.Draw(core), zig, 16 * K, 255, end=1)
stroke(ImageDraw.Draw(slit), zig, 2.6 * K, 255, end=1)
alpha = egg.getchannel('A')
shade = ImageChops.multiply(shade.filter(ImageFilter.GaussianBlur(6 * K)).point(lambda v: v * 0.3), alpha)
core = ImageChops.multiply(core.filter(ImageFilter.GaussianBlur(0.5 * K)), alpha)
crack = Image.new('RGBA', (w, h), (0, 0, 0, 0))
for colour, a in ((CORE, shade), (CORE, core)):
    layer = Image.new('RGBA', (w, h), colour)
    layer.putalpha(a)
    crack.alpha_composite(layer)
crack.save(OUT / 'egg-crack.webp', quality=92, method=6)
leak = Image.new('RGBA', (w, h), (255, 255, 255, 0))
leak.putalpha(ImageChops.multiply(slit.filter(ImageFilter.GaussianBlur(0.5 * K)), alpha))
leak.save(OUT / 'egg-leak.webp', quality=92, method=6)
for n in ('egg', 'egg-top', 'egg-bottom', 'egg-crack', 'egg-leak'):
    print(n, (w, h), (OUT / f'{n}.webp').stat().st_size // 1024, 'KB')
