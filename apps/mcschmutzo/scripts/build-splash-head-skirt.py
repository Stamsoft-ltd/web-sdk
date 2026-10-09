#!/usr/bin/env python3
"""
The splash chef's head with a feathered "skirt" under the jaw (build-special-head-skirt.py's fix for
the salting chef, on the splash rig):

  splash/man-head-v2.webp   man-head-v1 plus SKIRT rows of the body art (man-body-v2, which still has
                            the original jaw outline and under-chin shadow painted in) just below the
                            head's bottom edge (its dark and skin pixels only), drawn under the head and fading out over SKIRT px. It
                            turns and nods with the head, so a tilt or lift no longer slides the head's
                            jaw off the body's copy of it (a second jaw line by the collar). At rest it
                            is the old composite pixel for pixel. The head's copy of the white
                            collar beside the jaw is removed (the body draws it).

Both layers are in the 1304-wide frame at the same scale: head px (x, y) = frame (HEAD_X + x, y). The
texture grows by SKIRT rows, so SplashIntro's MAN.head y1 grows with it (printed).

    python3 scripts/build-splash-head-skirt.py
"""
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SPLASH = os.path.join(HERE, '..', 'static/assets/mcschmutzo/splash')
HEAD_X = 287
SKIRT = 22  # px the skirt reaches below the head's edge, fading out
SAME = 24  # max RGB difference for a head pixel to count as a copy of the body's
COLLAR_Y = 600  # the collar is below this row (the teeth and eye whites above it stay)
WHITE = 200  # body pixels this light (the collar) are left out of the skirt, feathered over 30


def build():
    body = np.array(Image.open(os.path.join(SPLASH, 'man-body-v2.webp')).convert('RGBA')).astype(float)
    head = np.array(Image.open(os.path.join(SPLASH, 'man-head-v1.webp')).convert('RGBA')).astype(float)
    hh, hw = head.shape[:2]
    tall = hh + SKIRT

    # the head's copy of the white collar beside the jaw comes off: it slid over the body's own collar
    # as the head tilted (a hatched double collar line). The body draws the collar there.
    under = body[:hh, HEAD_X:HEAD_X + hw]
    copy = ((head[..., 3] > 0) & (under[..., 3] > 200) & (np.abs(head[..., :3] - under[..., :3]).max(-1) < SAME)
            & (head[..., :3].mean(-1) > WHITE))
    copy[:COLLAR_Y] = False
    head[copy, 3] = 0
    print('collar copy removed:', int(copy.sum()), 'px')

    canvas = np.zeros((tall, hw, 4))
    canvas[:hh] = head
    inside = np.zeros((tall, hw), bool)
    inside[:hh] = head[..., 3] > 128
    # straight down from the head's edge (no copies spread sideways over the shoulders)
    weight = np.zeros((tall, hw))
    for k in range(1, SKIRT + 1):
        below = np.zeros_like(inside)
        below[k:] = inside[:-k]
        weight = np.where(below & ~inside & (weight == 0), 1 - (k - 1) / SKIRT, weight)

    art = body[:tall, HEAD_X:HEAD_X + hw]
    # only the neck's shadow and skin: the white collar and the red strap stay put on the body (a
    # moving copy of them showed as a ghost collar edge)
    lum = art[..., :3].mean(-1)
    neck = np.clip((WHITE - lum) / 30, 0, 1) * ~((art[..., 0] > 140) & (art[..., 1] < 70))
    skirt_a = art[..., 3:4] / 255 * (weight * neck)[..., None]
    head_a = canvas[..., 3:4] / 255
    out_a = head_a + skirt_a * (1 - head_a)
    out = np.zeros_like(canvas)
    out[..., :3] = (canvas[..., :3] * head_a + art[..., :3] * skirt_a * (1 - head_a)) / np.maximum(out_a, 1e-6)
    out[..., 3:4] = out_a * 255
    Image.fromarray(out.clip(0, 255).astype(np.uint8)).save(
        os.path.join(SPLASH, 'man-head-v2.webp'), quality=92, method=6)
    print('MAN.head: [%d, 0, %d, %d]' % (HEAD_X, HEAD_X + hw, tall))


if __name__ == '__main__':
    build()
