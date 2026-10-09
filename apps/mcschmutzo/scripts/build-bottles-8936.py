#!/usr/bin/env python3
"""
The ketchup (L1) and BBQ (L4) bottles redrawn from Figma 8936:2677 (ketchup) and 8936:2592 (BBQ):

  symbols/L1.webp, symbols/L4.webp                 the flat bottle (paytable, tutorial, sprite states)
  symbols/parts/bottle/L{1,4}_{body,cap}_v2.webp   the same bottle split body / cap for the reel rig
                                                   (SYMBOL_PARTS bottle(): the cap rocks on the neck)

Sources in art-src/bottles-8936/ (each design is a body layer + a cap layer):
  *_body.svg / ketchup_cap.svg   the design's vectorized layers; *_x8.png are them rendered at 8x with a
                                 transparent background (headless Chrome — Figma's own export is opaque)
  bbq_cap_src.png                the BBQ cap is a raster image fill drawn at exposure -0.12; BBQ_CAP_K is
                                 the brightness factor that matched Figma's render of it (mean error ~4/255)

Layout is the design's (Figma units, LAYOUT below), fitted like the old bottles in the 360x360 symbol
canvas: top at y=30, bottom at y=330, centred on x=180.

    python3 scripts/build-bottles-8936.py
"""
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'art-src/bottles-8936')
SYM = os.path.join(HERE, '..', 'static/assets/mcschmutzo/symbols')
S = 8  # the _x8 renders: px per Figma unit
BBQ_CAP_K = 0.82
CANVAS = 360
TOP, BOTTOM, CX = 30, 330, 180
# group size, body offset, cap offset, cap size (Figma units, relative to the group)
LAYOUT = {
    'L1': dict(body='ketchup_body_x8.png', cap='ketchup_cap_x8.png', body_xy=(0, 11.3806), cap_xy=(25.6062, 0), cap_size=39.8319),
    'L4': dict(body='bbq_body_x8.png', cap=None, body_xy=(0, 13.2706), cap_xy=(24.9998, 0), cap_size=41.7083),
}


def bbq_cap():
    a = np.array(Image.open(os.path.join(SRC, 'bbq_cap_src.png')).convert('RGBA')).astype(float)
    a[..., :3] *= BBQ_CAP_K
    size = round(LAYOUT['L4']['cap_size'] * S)
    return Image.fromarray(a.clip(0, 255).astype(np.uint8)).resize((size, size), Image.LANCZOS)


def save(im, path):
    im.save(path, quality=92, method=6)


def build(name, cfg):
    body = Image.open(os.path.join(SRC, cfg['body'])).convert('RGBA')
    cap = Image.open(os.path.join(SRC, cfg['cap'])).convert('RGBA') if cfg['cap'] else bbq_cap()
    w = max(body.width, round(cfg['cap_xy'][0] * S) + cap.width)
    h = max(round(cfg['body_xy'][1] * S) + body.height, cap.height)
    layers = {}
    for part, im, xy in (('body', body, cfg['body_xy']), ('cap', cap, cfg['cap_xy'])):
        L = Image.new('RGBA', (w, h))
        L.alpha_composite(im, (round(xy[0] * S), round(xy[1] * S)))
        layers[part] = L
    full = Image.new('RGBA', (w, h))
    full.alpha_composite(layers['body'])
    full.alpha_composite(layers['cap'])
    x0, y0, x1, y1 = full.getbbox()
    k = (BOTTOM - TOP) / (y1 - y0)
    out_w = round((x1 - x0) * k)
    left = round(CX - out_w / 2)

    def place(im):
        c = Image.new('RGBA', (CANVAS, CANVAS))
        c.alpha_composite(im.crop((x0, y0, x1, y1)).resize((out_w, BOTTOM - TOP), Image.LANCZOS), (left, TOP))
        return c

    save(place(full), os.path.join(SYM, f'{name}.webp'))
    for part in ('body', 'cap'):
        save(place(layers[part]), os.path.join(SYM, 'parts/bottle', f'{name}_{part}_v2.webp'))
    print(name, 'bottle box', (left, TOP, left + out_w, BOTTOM))


if __name__ == '__main__':
    for name, cfg in LAYOUT.items():
        build(name, cfg)
