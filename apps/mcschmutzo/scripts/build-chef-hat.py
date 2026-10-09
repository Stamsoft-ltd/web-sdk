#!/usr/bin/env python3
"""
Lifts the base-game chef's paper hat off his head layer (mascot_head_v1, build-chef-head.py) so it
can be tossed on a LEGENDARY win, the way the free-games chef's hat is (build-special-head.py):

  mascot_head_v2_c@0.882x.webp  the head with a crown of hair drawn where the hat sat (same crop as v1)
  mascot_hat_v1_c@0.882x.webp   the hat alone, cropped to its box (GUY_CROPS.mascotHat)

Coordinates are texture px of mascot_head_v1 (its crop starts at frame 316, 0; 0.882 px per frame px).

    python3 scripts/build-chef-hat.py [--preview DIR]
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

GUYS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'static/assets/mcschmutzo/guys')
SRC = 'mascot_head_v1_c@0.882x.webp'
SX = SY = 829 / 940  # texture px per frame px (build-chef-head.py)

# The hat: its outline (with the black stroke) plus the tan inside showing under the right brim.
HAT = [
    (214, 150), (204, 128), (205, 100), (214, 56), (262, 38), (292, 22), (322, -8), (350, -8), (402, 18), (450, 48),
    (505, 90), (562, 138), (612, 188), (604, 226), (590, 262), (566, 290), (552, 312), (548, 342),
    (536, 346), (516, 302), (458, 276), (380, 244), (300, 214), (254, 196), (232, 176),
]
# The top of the skull under the hat: hair below this line, background above. A low dome just over
# the brim line, so the bare head doesn't read as a helmet.
CROWN = [(200, 158), (250, 140), (320, 142), (400, 162), (470, 192), (530, 226), (580, 258), (606, 290)]
HAIR_RGB = (48, 30, 14)  # sampled off the hair beside the hat
HAT_PIVOT = (400, 240)  # brim's middle: the hat hops and tips about this


def split_hat(head):
    """→ (head with a hair crown under where the hat was, the hat alone)"""
    w, h = head.size
    m = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m).polygon(HAT, fill=255)
    m = m.filter(ImageFilter.MaxFilter(7))  # take the outline's full stroke with it
    soft = np.array(m.filter(ImageFilter.GaussianBlur(1.0))).astype(float) / 255
    rgba = np.array(head).astype(float)
    hat = rgba.copy()
    hat[..., 3] *= soft
    rest = rgba.copy()
    rest[..., 3] *= 1 - soft
    # the crown: hair under the CROWN line inside the hat's footprint, outlined like the art
    crown = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(crown)
    d.polygon([*CROWN, (CROWN[-1][0], h), (CROWN[0][0], h)], fill=(*HAIR_RGB, 255))
    d.line(CROWN, fill=(10, 6, 3, 255), width=5, joint='curve')
    # strands of a lighter brown so the crown isn't a flat blob
    for i in range(len(CROWN) - 1):
        (x0, y0), (x1, y1) = CROWN[i], CROWN[i + 1]
        d.line([(x0 + 8, y0 + 14), ((x0 + x1) / 2, (y0 + y1) / 2 + 26)], fill=(78, 52, 26, 255), width=4)
    cr = np.array(crown).astype(float)
    cr[..., 3] *= np.array(m.filter(ImageFilter.MaxFilter(5))).astype(float) / 255
    # composite: the crown under what's left of the head
    a1 = rest[..., 3:4] / 255
    a2 = cr[..., 3:4] / 255
    out_a = a1 + a2 * (1 - a1)
    out_rgb = np.where(out_a > 0, (rest[..., :3] * a1 + cr[..., :3] * a2 * (1 - a1)) / np.maximum(out_a, 1e-6), 0)
    out = np.concatenate([out_rgb, out_a * 255], axis=-1)
    img = lambda x: Image.fromarray(np.clip(x, 0, 255).astype(np.uint8))
    return img(out), img(hat)


def build():
    head = Image.open(os.path.join(GUYS, SRC)).convert('RGBA')
    bare, hat = split_hat(head)
    bare.save(os.path.join(GUYS, 'mascot_head_v2_c@0.882x.webp'), quality=92, method=6)
    hbox = hat.getbbox()
    hat.crop(hbox).save(os.path.join(GUYS, 'mascot_hat_v1_c@0.882x.webp'), quality=92, method=6)
    print('mascotHat crop: x0 %.1f y0 %.1f x1 %.1f y1 %.1f' % (316 + hbox[0] / SX, hbox[1] / SY, 316 + hbox[2] / SX, hbox[3] / SY))
    print('hat pivot (frame fractions): %.4f %.4f' % ((316 + HAT_PIVOT[0] / SX) / 1304, (HAT_PIVOT[1] / SY) / 1699))
    return head, bare, hat


def preview(out_dir, head, bare, hat):
    bg = (200, 230, 255, 255)
    tiles = []
    for layer, lift, rot in [(head, 0, 0), (bare, None, 0), (bare, -90, -60), (bare, -140, 180)]:
        t = Image.new('RGBA', (head.width, head.height + 160), bg)
        t.alpha_composite(layer, (0, 160))
        if lift is not None:
            px, py = HAT_PIVOT
            r = hat.rotate(rot, center=(px, py), resample=Image.BICUBIC)
            t.alpha_composite(r, (0, 160 + lift))
        tiles.append(t.crop((0, 0, t.width, 160 + 560)))
    sheet = Image.new('RGBA', (sum(t.width for t in tiles), tiles[0].height), bg)
    x = 0
    for t in tiles:
        sheet.alpha_composite(t, (x, 0))
        x += t.width
    sheet.save(os.path.join(out_dir, 'chef-hat-split.png'))


if __name__ == '__main__':
    parts = build()
    if '--preview' in sys.argv:
        preview(sys.argv[sys.argv.index('--preview') + 1], *parts)
