#!/usr/bin/env python3
"""
Lifts the chef's bow tie off the body so it can wobble on its knot:

  mascot_bow_v1_c@0.882x.webp   the board chef's bow, cropped to its box (GUY_CROPS.mascotBow)
  mascot_body_v3_c@0.882x.webp  mascot_body_v2 with the bow's footprint filled with the bow's own
                                shadow red, so a tilted bow shows a dark under-edge, never a second bow
  splash/man-bow-v1.webp        the same for the mirrored splash chef (man-body-v1 -> man-body-v2)
  splash/man-body-v2.webp

The footprint is the BOW polygon (frame px, traced round the outline's outer edge) grown 3 px, minus
the light shirt texels it then catches. Prints the crops + the knot pivot.

    python3 scripts/build-chef-bow.py [--preview DIR]
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GUYS = os.path.join(ROOT, 'static/assets/mcschmutzo/guys')
SPLASH = os.path.join(ROOT, 'static/assets/mcschmutzo/splash')
K = 0.882  # board texture px per frame px
BODY_X0 = 316  # GUY_CROPS.mascotBody x0 (frame px)

BOW = [
    (625, 862), (600, 848), (570, 836), (540, 833), (522, 842), (516, 860), (522, 885), (532, 903),
    (522, 915), (520, 935), (530, 955), (550, 968), (575, 970), (600, 960), (620, 945), (640, 935),
    (660, 936), (680, 948), (700, 962), (730, 972), (760, 966), (778, 945), (782, 915), (776, 905),
    (785, 880), (785, 858), (775, 840), (750, 832), (720, 835), (690, 850), (668, 866), (660, 868),
    (640, 862),
]
KNOT = (650, 905)  # frame px: the bow turns about its knot
GROW = 3
SHADOW_RGB = (74, 13, 6)


def footprint(img, poly):
    m = Image.new('L', img.size, 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    m = np.asarray(m.filter(ImageFilter.MaxFilter(2 * GROW + 1))) > 0
    a = np.asarray(img)
    light = a[..., :3].min(axis=2) > 170
    return m & ~light & (a[..., 3] > 0)


def lift(img, poly):
    a = np.asarray(img).copy()
    m = footprint(img, poly)
    bow = np.zeros_like(a)
    bow[m] = a[m]
    body = a.copy()
    body[m, :3] = SHADOW_RGB
    bow_img = Image.fromarray(bow)
    box = bow_img.getbbox()
    return bow_img.crop(box), box, Image.fromarray(body)


def build():
    body = Image.open(os.path.join(GUYS, 'mascot_body_v2_c@0.882x.webp')).convert('RGBA')
    tex = lambda p: ((p[0] - BODY_X0) * K, p[1] * K)
    bow, box, body3 = lift(body, [tex(p) for p in BOW])
    bow.save(os.path.join(GUYS, 'mascot_bow_v1_c@0.882x.webp'), quality=92, method=6)
    body3.save(os.path.join(GUYS, 'mascot_body_v3_c@0.882x.webp'), quality=92, method=6)
    print('mascotBow crop: x0 %.1f y0 %.1f x1 %.1f y1 %.1f' % (
        BODY_X0 + box[0] / K, box[1] / K, BODY_X0 + box[2] / K, box[3] / K))
    print('knot (frame fractions): %.4f %.4f' % (KNOT[0] / 1304, KNOT[1] / 1699))
    return body3, bow, box


def build_splash():
    base = Image.open(os.path.join(SPLASH, 'man-body-v1.webp')).convert('RGBA')
    w = base.width
    mir = lambda p: (w - p[0], p[1])  # same art mirrored on the full 1304 frame at 1:1
    bow, box, body2 = lift(base, [mir(p) for p in BOW])
    bow.save(os.path.join(SPLASH, 'man-bow-v1.webp'), quality=92, method=6)
    body2.save(os.path.join(SPLASH, 'man-body-v2.webp'), quality=92, method=6)
    print('splash man-bow-v1 box (frame px):', box)
    print('splash knot (frame px): %d %d' % mir(KNOT))


def preview(out_dir, body3, bow, box):
    import math

    tiles = []
    piv = ((KNOT[0] - BODY_X0) * K - box[0], KNOT[1] * K - box[1])
    for rot in (-0.08, 0, 0.08):
        c = Image.new('RGBA', body3.size, (40, 90, 160, 255))
        c.alpha_composite(body3)
        L = Image.new('RGBA', body3.size, (0, 0, 0, 0))
        pad = 40
        big = Image.new('RGBA', (bow.width + 2 * pad, bow.height + 2 * pad), (0, 0, 0, 0))
        big.paste(bow, (pad, pad))
        r = big.rotate(-math.degrees(rot), center=(piv[0] + pad, piv[1] + pad), resample=Image.BICUBIC)
        L.alpha_composite(r, (box[0] - pad, box[1] - pad))
        c.alpha_composite(L)
        tiles.append(c.crop((round((480 - BODY_X0) * K), round(800 * K), round((820 - BODY_X0) * K), round(1000 * K))))
    sheet = Image.new('RGBA', (sum(t.width for t in tiles) + 20, tiles[0].height), 'white')
    x = 0
    for t in tiles:
        sheet.paste(t, (x, 0))
        x += t.width + 10
    sheet = sheet.resize((sheet.width * 2, sheet.height * 2))
    p = os.path.join(out_dir, 'chef-bow.png')
    sheet.save(p)
    print('preview', p)


if __name__ == '__main__':
    body3, bow, box = build()
    build_splash()
    if '--preview' in sys.argv:
        preview(sys.argv[sys.argv.index('--preview') + 1], body3, bow, box)
