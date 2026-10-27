"""Mystery-bonus egg (Figma 11174:5039) cut for MysteryEgg.svelte's break-open.

art-src/mystery/egg.png  the Figma image fill, untouched (the splash's egg.webp is the same art
                         at 200px, too small for the centre-stage egg)
  -> public/mystery/hd/egg.webp         the whole egg, trimmed
  -> public/mystery/egg-top.webp     above the crack, with a cream shell rim on the cut
  -> public/mystery/egg-bottom.webp  below it
  -> public/mystery/egg-crack.webp   the crack itself, clipped to the egg, drawn over the whole
                                     egg before it breaks: an irregular fracture from an impact
                                     point in the middle (thick there, tapering to the sides),
                                     a dark core over a lit lower lip and a soft shadow, and
                                     hairline branches, densest round the impact. MysteryEgg
                                     reveals it from the middle out, so what is drawn near the
                                     centre is what the first knock shows.
  -> public/mystery/egg-leak.webp    the crack's inner slit only (white, thinner than the core):
                                     MysteryEgg's mask for the light seeping through, so the
                                     light sits inside the dark edges instead of washing them out
All four share one canvas, so they stack exactly. (hd/: new folder rather than new contents,
browsers keep the old art under the old names.)
    python3 apps/split-party/scripts/build-mystery-egg.py
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'mystery' / 'hd'
W = 976  # px, the master's egg: drawn 270 stage px = 864 device px at 1920x1080 DPR 2
K = W / 540  # the line widths below were tuned at 540
CRACK_Y = 0.47  # of the egg's height
RIM = '#fff4d6'
CORE = (42, 14, 62)  # the crack's dark core
LIP = (255, 246, 220)  # the broken shell's lit lower edge
import os
SEED = int(os.environ.get('CRACK_SEED', 101))  # the fracture is random but fixed: change it for another crack

OUT.mkdir(parents=True, exist_ok=True)
egg = Image.open(ROOT / 'art-src' / 'mystery' / 'egg.png').convert('RGBA')
egg = egg.crop(egg.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox())
egg = egg.resize((W, round(W * egg.height / egg.width)), Image.LANCZOS)
w, h = egg.size
rng = np.random.default_rng(SEED)
# The fracture: from the impact point (the middle) out to each side in uneven jagged steps,
# a little past both edges so the halves close. Each step turns against the last (a shell
# breaks in short facets) and the line drifts no more than ±6% of the height off CRACK_Y.
CX, CY = w * 0.5, h * CRACK_Y


def run(direction):
    pts, x, y, up = [], CX, CY, rng.random() < 0.5
    while -12 * K < x < w + 12 * K:
        x += direction * w * rng.uniform(0.025, 0.09)
        y += h * rng.uniform(0.004, 0.05) * (-1 if up else 1)
        y = min(max(y, CY - h * 0.06), CY + h * 0.06)
        up = not up if rng.random() < 0.58 else up
        pts.append((x, y))
    return pts


zig = run(-1)[::-1] + [(CX, CY)] + run(1)


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


def taper(x):
    # Line width factor: 1 at the impact, 0.6 at the egg's sides.
    return 0.6 + 0.4 * max(0.0, 1 - abs(x - CX) / (w * 0.5)) ** 1.4


def stroke(d, pts, width, fill, dy=0.0, end=0.35):
    # A polyline whose width follows taper() (times `end`→1 along a branch), joints rounded.
    n = len(pts) - 1
    for i in range(n):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        f = (1 - (1 - end) * i / max(1, n)) * taper((x0 + x1) / 2) * width
        d.line([(x0, y0 + dy), (x1, y1 + dy)], fill=fill, width=max(1, round(f)))
        r = f / 2
        d.ellipse([x1 - r, y1 + dy - r, x1 + r, y1 + dy + r], fill=fill)


def branch(x, y, angle, length, forks):
    # A hairline: 2-4 jagged steps along `angle`, sometimes forking once.
    pts, out = [(x, y)], []
    steps = rng.integers(2, 5)
    for _ in range(steps):
        angle += rng.uniform(-0.6, 0.6)
        x += np.cos(angle) * length / steps
        y += np.sin(angle) * length / steps
        pts.append((x, y))
    out.append(pts)
    if forks and rng.random() < 0.6:
        k = rng.integers(1, len(pts) - 1) if len(pts) > 2 else 1
        out += branch(*pts[k], angle + rng.choice([-1, 1]) * rng.uniform(0.5, 0.9), length * 0.5, False)
    return out


# Hairlines: four off the impact (two up, two down, as a knock from inside stars a shell),
# then a few forks along the line, likelier and longer near the middle.
hairs = []
for a in (-np.pi / 2 + rng.uniform(-0.8, -0.25), -np.pi / 2 + rng.uniform(0.25, 0.8), np.pi / 2 + rng.uniform(-0.8, -0.25), np.pi / 2 + rng.uniform(0.25, 0.8)):
    hairs += branch(CX, CY, a, w * rng.uniform(0.06, 0.095), True)
for x, y in zig[1:-1]:
    near = 1 - abs(x - CX) / (w * 0.5)
    if 0 < x < w and abs(x - CX) > w * 0.04 and rng.random() < 0.1 + 0.3 * near:
        a = rng.choice([-1, 1]) * rng.uniform(0.9, 2.2)
        hairs += branch(x, y, a, w * rng.uniform(0.03, 0.045 + 0.03 * near), True)

shade = Image.new('L', (w, h), 0)  # soft dent shadow round the fracture
slit = Image.new('L', (w, h), 0)
lip = Image.new('L', (w, h), 0)
core = Image.new('L', (w, h), 0)
ds, dl, dc, dt = ImageDraw.Draw(shade), ImageDraw.Draw(lip), ImageDraw.Draw(core), ImageDraw.Draw(slit)
stroke(ds, zig, 26 * K, 255)
stroke(dl, zig, 13 * K, 255, dy=3 * K)
stroke(dc, zig, 11 * K, 255)
stroke(dt, zig, 3.6 * K, 255)
# The impact chip: an irregular bit of shell knocked in, filled with the core colour.
chip = [
    (CX + np.cos(t) * r * w, CY + np.sin(t) * r * w * 0.8)
    for t, r in zip(np.linspace(0, 2 * np.pi, 9)[:-1] + rng.uniform(-0.2, 0.2, 8), rng.uniform(0.016, 0.03, 8))
]
dl.polygon([(x, y + 2.5 * K) for x, y in chip], fill=255)
dc.polygon(chip, fill=255)
dt.polygon([(CX + (x - CX) * 0.5, CY + (y - CY) * 0.5) for x, y in chip], fill=255)
ds.ellipse([CX - w * 0.06, CY - w * 0.05, CX + w * 0.06, CY + w * 0.05], fill=255)
for pts in hairs:
    stroke(ds, pts, 14 * K, 255, end=0.3)
    stroke(dl, pts, 7 * K, 255, dy=2 * K, end=0.3)
    stroke(dc, pts, 6 * K, 255, end=0.3)
    stroke(dt, pts, 1.8 * K, 255, end=0.3)
alpha = egg.getchannel('A')
shade = ImageChops.multiply(shade.filter(ImageFilter.GaussianBlur(5 * K)).point(lambda v: v * 0.32), alpha)
lip = ImageChops.multiply(lip.filter(ImageFilter.GaussianBlur(0.6 * K)).point(lambda v: v * 0.85), alpha)
core = ImageChops.multiply(core.filter(ImageFilter.GaussianBlur(0.5 * K)).point(lambda v: v * 0.94), alpha)
crack = Image.new('RGBA', (w, h), (0, 0, 0, 0))
for colour, a in ((CORE, shade), (LIP, lip), (CORE, core)):
    layer = Image.new('RGBA', (w, h), colour)
    layer.putalpha(a)
    crack.alpha_composite(layer)
crack.save(OUT / 'egg-crack.webp', quality=92, method=6)
leak = Image.new('RGBA', (w, h), (255, 255, 255, 0))
leak.putalpha(ImageChops.multiply(slit.filter(ImageFilter.GaussianBlur(0.5 * K)), alpha))
leak.save(OUT / 'egg-leak.webp', quality=92, method=6)
for n in ('egg', 'egg-top', 'egg-bottom', 'egg-crack', 'egg-leak'):
    print(n, (w, h), (OUT / f'{n}.webp').stat().st_size // 1024, 'KB')
