#!/usr/bin/env python3
"""
The board chef's collar edge, lifted off his body so it can be drawn OVER his head layer:

  mascot_collar_v2_c@0.882x.webp   the shirt collar's edge + outline where the head layer
                                   (scripts/build-chef-head.py) overlaps the body and repeats the
                                   body's own pixels there. Drawn over the head (GUY_CROPS.mascotCollar),
                                   the head's copy of that edge tucks under it instead of sliding off
                                   the body's as the head tilts — which showed as a second chin line.

v2 adds the collar's outline next to that edge, taken from the rest-pose composite (body + head): the
body has no outline there of its own, so v1 drew the collar's edge over the head's copy of the line and
the line was gone along the right of the neck.

The neck's thick dark shadow and the hair are left out (they are big dark areas, not the thin
outline), so the moving head still draws them. Both layers are crops of the same 0.882-scale frame
starting at frame (316, 0), so their texture px line up one to one; the crop is printed in frame px.

    python3 scripts/build-chef-collar.py
"""
import os

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
GUYS = os.path.join(HERE, '..', 'static/assets/mcschmutzo/guys')
K = 0.882
ORIGIN = (316, 0)  # frame px of both crops' top-left
SAME = 48  # max RGB difference for a head pixel to count as a copy of the body's
DARK = 90  # luminance below which a pixel is outline / shadow


def dilate(m, k):
    return np.array(Image.fromarray(m.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(k))) > 0


def build():
    body = np.array(Image.open(os.path.join(GUYS, 'mascot_body_v3_c@0.882x.webp')).convert('RGBA')).astype(int)
    head = np.array(Image.open(os.path.join(GUYS, 'mascot_head_v1_c@0.882x.webp')).convert('RGBA')).astype(int)
    h, w = head.shape[:2]
    b = body[:h, :w]

    copy = (head[..., 3] > 0) & (b[..., 3] > 200) & (np.abs(head[..., :3] - b[..., :3]).max(-1) < SAME)
    dark = Image.fromarray(((b[..., :3].mean(-1) < DARK) & (b[..., 3] > 200)).astype(np.uint8) * 255)
    # thick dark areas (the neck's shadow, the hair) survive an erosion; thin outlines don't
    thick = np.array(dark.filter(ImageFilter.MinFilter(7)).filter(ImageFilter.MaxFilter(9))) > 0
    collar = copy & ~thick
    # one px more of the body's own pixels round it, so its antialiased edge isn't cut
    grown = np.array(Image.fromarray(collar.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(3))) > 0
    collar = grown & (b[..., 3] > 0) & ~thick

    # the collar's outline beside it (thin dark pixels of the rest pose within 4 px), plus its fringe
    rest = Image.new('RGBA', (body.shape[1], body.shape[0]), (0, 0, 0, 0))
    rest.alpha_composite(Image.fromarray(body.astype(np.uint8)))
    head_full = Image.new('RGBA', rest.size, (0, 0, 0, 0))
    head_full.paste(Image.fromarray(head.astype(np.uint8)), (0, 0))
    rest.alpha_composite(head_full)
    c = np.array(rest).astype(int)
    lum = c[..., :3].mean(-1)
    rdark = Image.fromarray(((lum < DARK) & (c[..., 3] > 200)).astype(np.uint8) * 255)
    rthick = np.array(rdark.filter(ImageFilter.MinFilter(7)).filter(ImageFilter.MaxFilter(9))) > 0
    mask = np.zeros(lum.shape, bool)
    mask[:h, :w] = collar
    line = dilate(mask, 9) & (lum < 120) & (c[..., 3] > 200) & ~rthick
    mask |= line
    mask |= dilate(mask, 3) & (lum < 200) & ~rthick

    out = np.zeros_like(c)
    out[mask] = c[mask]
    im = Image.fromarray(out.astype(np.uint8))
    box = im.getbbox()
    im.crop(box).save(os.path.join(GUYS, 'mascot_collar_v2_c@0.882x.webp'), quality=92, method=6)
    ox, oy = ORIGIN
    print('mascotCollar: { x0: %.1f, y0: %.1f, x1: %.1f, y1: %.1f }' % (
        ox + box[0] / K, oy + box[1] / K, ox + box[2] / K, oy + box[3] / K))


if __name__ == '__main__':
    build()
