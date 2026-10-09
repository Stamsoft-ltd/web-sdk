#!/usr/bin/env python3
"""
Two more moving parts for the free-games (salting) chef, cut from his head / body layers
(scripts/build-special-head.py):

  special_bow_v1_c@0.798x.webp    the bow tie, lifted off the body so it can sway on its knot
                                  (GUY_CROPS.specialBow). The body keeps its painted bow under it;
                                  SpecialMascot draws the overlay a few % larger about the knot, so the
                                  painted one never peeks out while it sways.
  special_mouth_v1_c@0.798x.webp  the grin (teeth, lips, the right corner's crease), so it can widen and
                                  lift into a bigger smile (GUY_CROPS.specialMouth). Its left corner
                                  meets the jaw's outline, so that corner is the pivot (it never moves).
  special_head_v2_c@0.798x.webp   the head with the grin painted over in flat skin, so wherever the
                                  moving mouth uncovers it there is only skin — never a doubled lip.

Coordinates are texture px of the layer they're cut from; the crops are printed in frame px
(K = 0.798 texture px per frame px; the body's crop starts at frame (511, 0), the head's at
(511, 140.4)) for GUY_CROPS in AnimatedGuy.svelte.

    python3 scripts/build-special-bow-mouth.py [--preview DIR]
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
GUYS = os.path.join(HERE, '..', 'static/assets/mcschmutzo/guys')
K = 0.798
BODY = 'special_body_v1_c@0.798x.webp'
HEAD = 'special_head_v1_c@0.798x.webp'
BODY_ORIGIN = (511, 0)
HEAD_ORIGIN = (511, 140.4)
FRAME = (1611, 1912)

# The bow's outer outline (body texture px), clockwise from the left wing's top.
BOW = [
    (190, 763), (207, 751), (245, 760), (280, 777), (290, 777), (303, 780), (327, 782), (343, 767),
    (383, 751), (410, 750), (427, 770), (423, 810), (420, 840), (410, 870), (387, 882), (357, 870),
    (327, 845), (310, 845), (287, 843), (270, 857), (230, 873), (207, 867), (197, 840), (200, 817),
    (190, 790),
]
BOW_PIVOT = (303, 813)  # the knot's middle
BOW_GROW = 3  # px the mask reaches past the outline (its black stroke + antialias)

# The grin (head texture px): under the nose, round the right corner's crease, along the chin.
MOUTH = [
    (112, 425), (150, 448), (200, 452), (262, 440), (300, 420), (340, 398), (372, 378), (398, 372),
    (412, 392), (402, 440), (377, 500), (332, 546), (270, 562), (210, 558), (160, 522), (125, 482),
    (108, 452),
]
MOUTH_PIVOT = (122, 440)  # the left corner, on the jaw line
MOUTH_FEATHER = 5


def poly_mask(size, poly, grow=0, feather=0):
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    if grow:
        m = m.filter(ImageFilter.MaxFilter(grow * 2 + 1))
    if feather:
        m = m.filter(ImageFilter.GaussianBlur(feather))
    return m


def cut(src, mask):
    a = np.array(src)
    m = np.array(mask, dtype=np.float32) / 255
    a[..., 3] = (a[..., 3] * m).astype(np.uint8)
    return Image.fromarray(a)


def frame_crop(origin, box):
    ox, oy = origin
    return (ox + box[0] / K, oy + box[1] / K, ox + box[2] / K, oy + box[3] / K)


def skin_fill(head, poly):
    """The head with the grin painted over in the face's skin: the median of the opaque, orange
    pixels in a ring just outside the polygon."""
    a = np.array(head).astype(np.int32)
    inner = np.array(poly_mask(head.size, poly)) > 0
    ring = (np.array(poly_mask(head.size, poly, grow=10)) > 0) & ~inner
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    orange = ring & (al > 250) & (r > 190) & (g > 110) & (g < 190) & (b < 120)
    skin = np.median(a[orange][:, :3], axis=0).astype(np.uint8)
    out = np.array(head)
    fill = np.array(poly_mask(head.size, poly, grow=2)) > 0
    out[fill, :3] = skin
    return Image.fromarray(out), tuple(int(v) for v in skin)


def build(preview=None):
    body = Image.open(os.path.join(GUYS, BODY)).convert('RGBA')
    head = Image.open(os.path.join(GUYS, HEAD)).convert('RGBA')

    bow = cut(body, poly_mask(body.size, BOW, grow=BOW_GROW, feather=0.6))
    # the outline is hand-traced, so the grown mask catches slivers of the shirt round it: drop the
    # shirt's warm near-white (the bow's own highlights are a saturated pink, so they stay)
    a = np.array(bow).astype(np.int32)
    shirt = (a[..., 0] > 215) & (a[..., 1] > 195) & (a[..., 2] > 180) & (a[..., 0] - a[..., 2] < 45)
    a[shirt, 3] = 0
    bow = Image.fromarray(a.astype(np.uint8))
    bbox = bow.getbbox()
    bow.crop(bbox).save(os.path.join(GUYS, 'special_bow_v1_c@0.798x.webp'), quality=92, method=6)
    fx0, fy0, fx1, fy1 = frame_crop(BODY_ORIGIN, bbox)
    print('specialBow: { x0: %.1f, y0: %.1f, x1: %.1f, y1: %.1f }' % (fx0, fy0, fx1, fy1))
    print('  knot pivot in sprite: px %.4f py %.4f' % ((BOW_PIVOT[0] - bbox[0]) / (bbox[2] - bbox[0]), (BOW_PIVOT[1] - bbox[1]) / (bbox[3] - bbox[1])))

    mouth = cut(head, poly_mask(head.size, MOUTH, feather=MOUTH_FEATHER))
    mbox = mouth.getbbox()
    mouth.crop(mbox).save(os.path.join(GUYS, 'special_mouth_v1_c@0.798x.webp'), quality=92, method=6)
    fx0, fy0, fx1, fy1 = frame_crop(HEAD_ORIGIN, mbox)
    print('specialMouth: { x0: %.1f, y0: %.1f, x1: %.1f, y1: %.1f }' % (fx0, fy0, fx1, fy1))
    print('  corner pivot in sprite: px %.4f py %.4f' % ((MOUTH_PIVOT[0] - mbox[0]) / (mbox[2] - mbox[0]), (MOUTH_PIVOT[1] - mbox[1]) / (mbox[3] - mbox[1])))

    head2, skin = skin_fill(head, MOUTH)
    head2.save(os.path.join(GUYS, 'special_head_v2_c@0.798x.webp'), quality=92, method=6)
    print('head v2 skin fill', skin)

    if preview:
        os.makedirs(preview, exist_ok=True)
        for name, im in (('bow', bow.crop(bbox)), ('mouth', mouth.crop(mbox)), ('head2', head2)):
            bg = Image.new('RGBA', im.size, (90, 140, 200, 255))
            bg.alpha_composite(im)
            bg.save(os.path.join(preview, f'special-{name}.png'))


if __name__ == '__main__':
    build(sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None)
