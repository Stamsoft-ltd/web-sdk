"""Recompose the marquee card from the built parts and the generated layout.

The point is to catch placement error before it is on screen: a part that is 2% out looks fine on
its own and obviously wrong once the card is assembled. Writes verify_marquee.png.

The plate is the shared PAD, and its rect and bulbs come from the module `scripts/pad/build_pad.py`
generates rather than from marquee.json — the pad is a different shape from the sign the rest of the
card was measured against, and this is where that shows up if it has been placed wrong.

The bulbs are drawn LIT, one frame of the chase, because on this art they are unlit cream discs and
a sheet that leaves them unlit is not a picture of what ships.
"""

import json
import math
import pathlib
import re

from PIL import Image, ImageDraw, ImageFilter

BASE = pathlib.Path(__file__).resolve().parent
APP = pathlib.Path(__file__).resolve().parents[2]
OUT = APP / 'static/assets/theme-park/v2/wins/marquee'
PAD_TS = APP / 'src/game/padMarquee.ts'

CANVAS = (1200, 675)
CARD_W = 653.6
CARD_C = (600.0, 242.6)
TIER = 'sweet'

#: <WinCard>'s own figures, so the sheet shows what the component will draw.
AMOUNT_GAP = 0.0165
CYCLES = 3
LIGHT_SPREAD = 3.4  # <WinCardLights>'s halo, in bulb diameters
PHASE = 0.32  # which frame of the chase to draw

source = PAD_TS.read_text()


def pad_number(name):
    return float(re.search(rf'{name} = ([\d.]+)', source).group(1))


plate = {
    key: float(re.search(rf"PAD_PLATE = \{{[^}}]*\b{key}: (-?[\d.]+)", source).group(1))
    for key in ('x', 'y', 'w', 'h')
}
bulb_size = float(re.search(r'PAD_BULB = \{ size: ([\d.]+)', source).group(1))
bulb_colour = int(re.search(r'colour: 0x([0-9a-f]{6})', source).group(1), 16)
pad_bulbs = [
    tuple(float(v) for v in pair.split(','))
    for pair in re.search(r"PAD_BULBS: \[number, number\]\[\] = points\(\s*'([^']+)'", source)
    .group(1)
    .split(' ')
]

layout = json.load(open(BASE / 'marquee.json'))
canvas = Image.new('RGBA', CANVAS, (26, 8, 44, 255))


def paste(img, rect):
    w = max(1, round(rect['w'] * CARD_W))
    h = max(1, round(rect['h'] * CARD_W))
    x = round(CARD_C[0] + rect['x'] * CARD_W - w / 2)
    y = round(CARD_C[1] + rect['y'] * CARD_W - h / 2)
    canvas.alpha_composite(img.resize((w, h), Image.LANCZOS), (x, y))


for i, piece in enumerate(layout['confetti']):
    paste(Image.open(OUT / f'confetti/p{i:02d}.webp').convert('RGBA'), piece)
paste(Image.open(OUT / 'plate.webp').convert('RGBA'), plate)

# === THE LIGHTING ===
# One frame of the chase, additively, the way <WinCardLights> draws it: a core inside the disc and a
# halo spilling out of it, both at the level that bulb's phase is at.
lights = Image.new('RGBA', CANVAS, (0, 0, 0, 0))
draw_lights = ImageDraw.Draw(lights)
tint = ((bulb_colour >> 16) & 255, (bulb_colour >> 8) & 255, bulb_colour & 255)
for index, (bx, by) in enumerate(pad_bulbs):
    px = CARD_C[0] + (plate['x'] + bx * plate['w']) * CARD_W
    py = CARD_C[1] + (plate['y'] + by * plate['w']) * CARD_W
    angle = (math.atan2(by, bx) / (2 * math.pi) + 1) % 1
    wave = 0.5 + 0.5 * math.cos(2 * math.pi * (angle * CYCLES - PHASE * CYCLES))
    level = 0.2 + 0.8 * wave**3
    for scale, weight in ((LIGHT_SPREAD, 0.55), (0.92, 1.0)):
        r = bulb_size * scale * plate['w'] * CARD_W / 2
        alpha = round(255 * level * weight)
        draw_lights.ellipse(
            [px - r, py - r, px + r, py + r], fill=(*tint, alpha)
        )
lights = lights.filter(ImageFilter.GaussianBlur(3))
canvas = Image.alpha_composite(canvas, lights)

star = Image.open(OUT / 'star.webp').convert('RGBA')
for side in (-1, 1):
    paste(star, {**layout['star'], 'x': side * layout['star']['x']})

paste(Image.open(OUT / f'text-{TIER}.webp').convert('RGBA'), layout['text'][TIER])

# The amount plate, drawn the way the game draws it: hung a fixed gap under the pad's foot.
a = layout['amount']
w, h = round(a['w'] * CARD_W), round(a['h'] * CARD_W)
centre_y = plate['y'] + plate['h'] / 2 + AMOUNT_GAP + a['h'] / 2
x = round(CARD_C[0] + a['x'] * CARD_W - w / 2)
y = round(CARD_C[1] + centre_y * CARD_W - h / 2)
d = ImageDraw.Draw(canvas)
d.rounded_rectangle([x, y, x + w, y + h], radius=16, fill=(4, 0, 14, 245), outline=(170, 52, 244), width=2)
d.text((x + w / 2 - 60, y + h / 2 - 8), '$1,234.00', fill=(255, 255, 255))

canvas.convert('RGB').save(BASE / 'verify_marquee.png')
print(f'wrote verify_marquee.png  ({len(pad_bulbs)} bulbs, #{bulb_colour:06x})')
