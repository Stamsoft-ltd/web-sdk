"""Recompose the marquee card from the built parts and the generated layout.

The point is to catch placement error before it is on screen: a part that is 2% out looks fine on
its own and obviously wrong once the card is assembled. Writes verify_marquee.png — the design
canvas rebuilt from the shipped webps, with the reference render below it for comparison.
"""

import json
import pathlib

from PIL import Image, ImageDraw

BASE = pathlib.Path(__file__).resolve().parent
APP = pathlib.Path(__file__).resolve().parents[2]
OUT = APP / 'static/assets/theme-park/v2/wins/marquee'

CANVAS = (1200, 675)
CARD_W = 653.6
CARD_C = (600.0, 242.6)
TIER = 'sweet'

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
paste(Image.open(OUT / 'plate.webp').convert('RGBA'), layout['plate'])

star = Image.open(OUT / 'star.webp').convert('RGBA')
for side in (-1, 1):
    paste(star, {**layout['star'], 'x': side * layout['star']['x']})

paste(Image.open(OUT / f'text-{TIER}.webp').convert('RGBA'), layout['text'][TIER])

# amount plate, drawn the way the game draws it
a = layout['amount']
w, h = round(a['w'] * CARD_W), round(a['h'] * CARD_W)
x = round(CARD_C[0] + a['x'] * CARD_W - w / 2)
y = round(CARD_C[1] + a['y'] * CARD_W - h / 2)
d = ImageDraw.Draw(canvas)
d.rounded_rectangle([x, y, x + w, y + h], radius=16, fill=(4, 0, 14, 245), outline=(170, 52, 244), width=2)
d.text((x + w / 2 - 60, y + h / 2 - 8), '$1,234.00', fill=(255, 255, 255))

# bulbs, ringed, so a stale detection shows up here too
r = CARD_W * 0.008
for bx, by in layout['plateBulbs']:
    px, py = CARD_C[0] + bx * CARD_W, CARD_C[1] + by * CARD_W
    d.ellipse([px - r, py - r, px + r, py + r], outline=(0, 255, 90, 160))

canvas.convert('RGB').save(BASE / 'verify_marquee.png')
print('wrote verify_marquee.png')
