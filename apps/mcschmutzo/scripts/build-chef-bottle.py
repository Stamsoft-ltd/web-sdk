#!/usr/bin/env python3
"""
Mends the board chef's bottle arm (mascot_bottle_v5 -> mascot_bottle_v6) so it can move without
tearing at the shoulder.

The bottle layer carries the whole raised arm: hand, bottle AND the sleeve up to the shoulder. v5's
sleeve stopped on a hard, almost vertical cut that hid only 0-10 px under the apron strap, and between
the sleeve's top, the chin and the bow tie it left a see-through gap (the wall showed through the
chef even at rest). Any shake of the arm slid that cut edge out beside the strap buckle.

v6 fills the shoulder gap with the sleeve's shirt cream up to the thin shoulder line that was already
drawn there, and runs the sleeve ~60 px further in, all of it under the body (strap / bow / shirt),
so nothing new shows at rest. Background.svelte pivots the arm at the sleeve-strap seam (SEAM below,
frame px), where the extra overlap more than covers what the arm moves.

The splash chef's bottle (splash/man-bottle-v3 -> v4, mirrored art) gets the same mend.

    python3 scripts/build-chef-bottle.py [--preview DIR]
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GUYS = os.path.join(ROOT, 'static/assets/mcschmutzo/guys')
SPLASH = os.path.join(ROOT, 'static/assets/mcschmutzo/splash')
K = 0.882  # texture px per frame px
BOTTLE_AT = (80, 639)  # GUY_CROPS.mascotBottle x0/y0 (frame px)
BODY_AT = (316, 0)  # GUY_CROPS.mascotBody / mascotHead x0/y0

# The fill box (frame px). Inside it a column fills only BELOW the shoulder line (the first drawn
# texel from the top) - or, right of where that line meets the chin, below the body's own edge.
REGION = [(440, 800), (575, 800), (575, 1172), (440, 1172)]  # bottom = where the sleeve ends
DEEP = 60  # frame px the sleeve may run in under the body
SEAM = (490, 1050)  # the arm's pivot (frame px) -> Background.svelte BOTTLE_PIVX/Y


def to_tex(fx, fy, at):
    return ((fx - at[0]) * K, (fy - at[1]) * K)


def load(name):
    return np.asarray(Image.open(os.path.join(GUYS, name)).convert('RGBA')).copy()


def body_alpha_on_bottle(shape):
    """Body + head opacity sampled on the bottle layer's texture grid (at rest)."""
    h, w = shape[:2]
    out = np.zeros((h, w), np.uint8)
    for name in ('mascot_body_v2_c@0.882x.webp', 'mascot_head_v1_c@0.882x.webp'):
        a = load(name)[..., 3]
        # bottle texel (x, y) <-> body texel (x + dx, y + dy)
        dx = round((BOTTLE_AT[0] - BODY_AT[0]) * K)
        dy = round((BOTTLE_AT[1] - BODY_AT[1]) * K)
        ys, xs = np.mgrid[0:h, 0:w]
        bx, by = xs + dx, ys + dy
        ok = (bx >= 0) & (by >= 0) & (bx < a.shape[1]) & (by < a.shape[0])
        out[ok] = np.maximum(out[ok], a[by[ok], bx[ok]])
    return out


def mend(src, covered, tex):
    """Fill the shoulder gap + run the sleeve in under the body. `tex` maps frame px -> texel."""
    h, w = src.shape[:2]
    region = Image.new('L', (w, h), 0)
    ImageDraw.Draw(region).polygon([tex(x, y) for x, y in REGION], fill=255)
    region = np.asarray(region) > 0
    opaque = src[..., 3] > 0
    # each column's top: the shoulder line (first drawn texel), else the chin/body edge
    top = np.full(w, h)
    for x in range(w):
        col = np.nonzero(region[:, x] & (src[:, x, 3] > 60))[0]
        if col.size:
            top[x] = col[0]
        else:
            cov = np.nonzero(region[:, x] & covered[:, x])[0]
            if cov.size:
                top[x] = cov[0]
    region &= np.arange(h)[:, None] > top[None, :]
    # how far each row's sleeve reaches, to cap the run-in under the body
    deep = DEEP * (tex(1, 0)[0] - tex(0, 0)[0])
    cap = np.zeros((h, w), bool)
    for y in range(h):
        xs = np.nonzero(opaque[y] & region[y])[0]
        if xs.size:
            cap[y, : int(xs.max() + deep) + 1] = True
    gap_rows = (np.arange(h) < tex(0, 930)[1])[:, None]  # the see-through gap at the shoulder
    fill = region & ~opaque & (covered | gap_rows) & (cap | gap_rows)
    # the sleeve's cream: opaque light texels just inside the old edge
    near = region & opaque & (src[..., :3].min(axis=2) > 225)
    cream = np.median(src[near][:, :3], axis=0).astype(np.uint8)
    out = src.copy()
    # keep the soft (antialiased) edge texels opaque where they now continue into the fill
    out[(src[..., 3] > 0) & (src[..., 3] < 255) & region & (covered | gap_rows), 3] = 255
    out[fill, :3] = cream
    out[fill, 3] = 255
    print('cream', cream.tolist(), 'filled texels', int(fill.sum()))
    return out


def build():
    src = load('mascot_bottle_v5_c@0.882x.webp')
    covered = body_alpha_on_bottle(src.shape) > 200
    out = mend(src, covered, lambda fx, fy: to_tex(fx, fy, BOTTLE_AT))
    img = Image.fromarray(out)
    img.save(os.path.join(GUYS, 'mascot_bottle_v6_c@0.882x.webp'), quality=92, method=6)
    print('pivot (frame fractions): BOTTLE_PIVX %.4f BOTTLE_PIVY %.4f' % (SEAM[0] / 1304, SEAM[1] / 1699))
    return img


def build_splash():
    """The splash chef: the same art mirrored, full 1304 frame at 1:1 (man-bottle-v3 over man-body /
    man-head). Mended in the board's orientation and mirrored back."""
    sp = lambda n: np.asarray(Image.open(os.path.join(SPLASH, n)).convert('RGBA'))
    src = sp('man-bottle-v3.webp')[:, ::-1].copy()
    h, w = src.shape[:2]
    covered = np.zeros((h, w), bool)
    body = sp('man-body-v1.webp')[:h, ::-1, 3]
    covered |= body[:h] > 200
    head = sp('man-head-v1.webp')[..., 3]
    hh = np.zeros((h, w), np.uint8)
    hh[: head.shape[0], 287 : 287 + head.shape[1]] = head  # SplashIntro MAN.head box
    covered |= hh[:, ::-1] > 200
    out = mend(src, covered, lambda fx, fy: (fx, fy))[:, ::-1]
    Image.fromarray(np.ascontiguousarray(out)).save(os.path.join(SPLASH, 'man-bottle-v4.webp'), quality=92, method=6)
    print('splash pivot (frame px): %d %d' % (1304 - SEAM[0], SEAM[1]))


def preview(out_dir, bottle):
    import math

    size = (round(1304 * K), round(1800 * K))

    def layer(img, at):
        L = Image.new('RGBA', size, (0, 0, 0, 0))
        L.paste(img, (round(at[0] * K), round(at[1] * K)))
        return L

    body = layer(Image.open(os.path.join(GUYS, 'mascot_body_v2_c@0.882x.webp')).convert('RGBA'), BODY_AT)
    head = layer(Image.open(os.path.join(GUYS, 'mascot_head_v1_c@0.882x.webp')).convert('RGBA'), BODY_AT)
    arm = layer(bottle, BOTTLE_AT)
    piv = (SEAM[0] * K, SEAM[1] * K)
    tiles = []
    for rot in (-0.2, -0.1, 0, 0.1, 0.2):
        c = Image.new('RGBA', size, (40, 90, 160, 255))
        c.alpha_composite(arm.rotate(-math.degrees(rot), center=piv, resample=Image.BICUBIC))
        c.alpha_composite(body)
        c.alpha_composite(head)
        tiles.append(c.crop(tuple(round(v * K) for v in (60, 560, 640, 1360))))
    sheet = Image.new('RGBA', (sum(t.width for t in tiles) + 10 * len(tiles), tiles[0].height), 'white')
    x = 0
    for t in tiles:
        sheet.paste(t, (x, 0))
        x += t.width + 10
    p = os.path.join(out_dir, 'chef-bottle-v6.png')
    sheet.save(p)
    print('preview', p)


if __name__ == '__main__':
    img = build()
    build_splash()
    if '--preview' in sys.argv:
        preview(sys.argv[sys.argv.index('--preview') + 1], img)
