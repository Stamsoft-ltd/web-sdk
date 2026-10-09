#!/usr/bin/env python3
"""
The free-games (salting) chef's spiky back hair — the tuft behind his ear — lifted off his head so it
can sway on its root:

  special_hair_v1_c@0.798x.webp   the tuft (head texture px x >= CUT_X, rows HAIR_Y), cut from head v2
                                  (scripts/build-special-bow-mouth.py). SpecialMascot draws it as a head
                                  extra (it turns and nods with the head), swaying about ROOT.
  special_head_v3_c@0.798x.webp   head v2 with the tuft's outer part (x >= KEEP_X) removed, so where the
                                  swaying tuft uncovers it there is only background — never a doubled
                                  spike. The strip CUT_X..KEEP_X stays in both (dark hair over dark
                                  hair), and so do the rows where the tuft fades in (FADE_TOP, FADE_BOTTOM),
                                  so neither its inner cut nor its top edge shows as it sways.

The crop is printed in frame px (K = 0.798 texture px per frame px; the head's crop starts at frame
(511, 140.4)) for GUY_CROPS in AnimatedGuy.svelte, with the root pivot in sprite fractions.

    python3 scripts/build-special-hair.py
"""
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
GUYS = os.path.join(HERE, '..', 'static/assets/mcschmutzo/guys')
K = 0.798
HEAD_ORIGIN = (511, 140.4)
CUT_X = 530  # the tuft layer starts here (inside the hair mass, right of the ear)
KEEP_X = 548  # the head keeps its hair up to here
HAIR_Y = (215, 495)  # rows of the tuft (below the hat's brim, above the neck)
FADE_TOP = (230, 270)  # the hair continues above the tuft: the two cross-fade over these rows
FADE_BOTTOM = 20  # rows the tuft fades out over at its bottom
ROOT = (548, 360)  # the tuft sways about this point (head texture px)


def build():
    head = np.array(Image.open(os.path.join(GUYS, 'special_head_v2_c@0.798x.webp')).convert('RGBA'))
    y0, y1 = HAIR_Y

    rows = np.arange(head.shape[0], dtype=np.float32)
    weight = np.clip((rows - FADE_TOP[0]) / (FADE_TOP[1] - FADE_TOP[0]), 0, 1)
    weight *= np.clip((y1 - rows) / FADE_BOTTOM, 0, 1)
    weight[: y0] = 0
    weight[y1:] = 0
    w = weight[:, None]

    hair = np.zeros_like(head)
    hair[:, CUT_X:, :3] = head[:, CUT_X:, :3]
    hair[:, CUT_X:, 3] = (head[:, CUT_X:, 3] * w).astype(np.uint8)
    im = Image.fromarray(hair)
    box = im.getbbox()
    im.crop(box).save(os.path.join(GUYS, 'special_hair_v1_c@0.798x.webp'), quality=92, method=6)

    head3 = head.copy()
    # (only where the tuft is fully opaque: two half-faded layers never add up to an opaque one)
    head3[weight >= 1, KEEP_X:, 3] = 0
    Image.fromarray(head3).save(os.path.join(GUYS, 'special_head_v3_c@0.798x.webp'), quality=92, method=6)

    ox, oy = HEAD_ORIGIN
    print('specialHair: { x0: %.1f, y0: %.1f, x1: %.1f, y1: %.1f }' % (
        ox + box[0] / K, oy + box[1] / K, ox + box[2] / K, oy + box[3] / K))
    print('  root pivot in sprite: px %.4f py %.4f' % (
        (ROOT[0] - box[0]) / (box[2] - box[0]), (ROOT[1] - box[1]) / (box[3] - box[1])))


if __name__ == '__main__':
    build()
