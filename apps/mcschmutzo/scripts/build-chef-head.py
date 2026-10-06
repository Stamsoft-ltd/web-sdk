#!/usr/bin/env python3
"""
Splits the base-game chef (mascot_base_v7) into HEAD, ARM and BODY layers so the head can tilt and
nod on its neck (AnimatedGuy `head`) and the hanging forearm can swing from the elbow (an extra):

  mascot_head_v1_c@0.882x.webp  hat, hair, face, chin, the shadow under the chin and the whole neck,
                                cropped to its box (GUY_CROPS.mascotHead)
  mascot_arm_v1_c@0.882x.webp   the relaxed forearm + hand below the rolled cuff (GUY_CROPS.mascotArm)
  mascot_body_v2_c@0.882x.webp  everything else, on the same crop as the base (GUY_CROPS.mascotBody)
  splash/man-{head,arm,body}-v1 the same three layers of the mirrored splash chef (man-base-v6)
  mascot_brows_v6_c@0.882x.webp mascot_brows_v5 with its soft edge recoloured brow-dark: v5's edge
                                carried a white fringe lifted off the eye whites, which showed as a pale
                                strip over the eyes whenever a reaction moved the brows

The cut (texture px of the base) runs through the gaps of the art: the background left of the jaw,
along the top of the bow tie and the left collar wing, round the neck's base, up the collar's inner
outline, then out under the hair through the background. Behind the head the body gets a dark
"socket" (the chin-shadow colour) near the cut, so a few px of head motion shows shadow, never a
hole. The forearm is cut along the cuff's lower outline and down its own outline; it only ever
swings INWARD (over the apron, never uncovering what it hid), and the body gets a skin-shadow strip
under the cuff so the elbow never opens a gap. Run with --preview to also write composites at the extreme head poses to the scratch dir.

    python3 scripts/build-chef-head.py [--preview DIR]
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

GUYS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'static/assets/mcschmutzo/guys')
SRC = 'mascot_base_v7_c@0.882x.webp'

# The cut, left edge → right edge (texture px). The head is everything above it.
CUT = [
    (0, 712), (196, 731), (232, 737), (282, 738),  # under the jaw, over the bow tie + left collar wing
    (288, 760), (305, 769), (318, 757),  # round the neck's base
    (336, 741), (354, 727), (392, 698), (420, 672), (444, 642), (447, 612),  # up the collar's inner outline
    (452, 598), (470, 593), (500, 600), (829, 612),  # under the hair, through the background
]
PIVOT = (305, 760)  # neck base: the head turns about this
# The forearm: the cuff's lower outline (right → left), then down the arm's own left outline to the
# frame bottom (texture px). It is everything right of / below this.
ARM = [
    (829, 1146), (805, 1146), (762, 1150), (740, 1154), (714, 1166), (690, 1178), (672, 1190), (662, 1204),
    (670, 1215), (673, 1240), (676, 1262), (686, 1280), (691, 1300), (699, 1322), (702, 1352), (697, 1382),
    (678, 1402), (660, 1432), (651, 1462), (645, 1492), (633, 1512), (632, 1540), (640, 1588), (829, 1588),
]
ARM_PIVOT = (725, 1166)  # the elbow, under the middle of the cuff
ARM_SOCKET_PX = 12
ARM_SOCKET_RGB = (196, 108, 52)
SOCKET_PX = 34  # how far behind the cut the body is filled with shadow
SOCKET_X = (180, 470)
SOCKET_RGB = (38, 20, 14)
SX, SY = 829 / 940, 1588 / 1800  # texture px per frame px (base crop: frame x 316..1256, y 0..1800)
SPLASH = os.path.join(GUYS, '..', 'splash')
SPLASH_SRC = 'man-base-v6.webp'


def split(base, head_poly, arm_poly, cuff, socket_x, socket_px, arm_socket_px):
    """→ (head, body, arm) RGBA arrays of `base`, cut along the given polygons (image px)"""
    w, h = base.size
    m = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m).polygon(head_poly, fill=255)
    hard = np.array(m) > 127
    soft = np.array(m.filter(ImageFilter.GaussianBlur(1.2))).astype(float) / 255
    rgba = np.array(base).astype(float)

    head = rgba.copy()
    head[..., 3] *= soft

    body = rgba.copy()
    # socket: inside the head, within socket_px of the cut, in the neck's span, where the art is opaque
    outside = Image.fromarray(((~hard) * 255).astype(np.uint8))
    for _ in range(socket_px // 2):
        outside = outside.filter(ImageFilter.MaxFilter(5))
    near = np.array(outside) > 127
    xs = np.arange(w)[None, :]
    socket = hard & near & (xs >= socket_x[0]) & (xs <= socket_x[1]) & (rgba[..., 3] > 200)
    body[..., 3] *= 1 - soft
    body[socket, :3] = SOCKET_RGB
    body[socket, 3] = 255

    # the forearm
    am = Image.new('L', (w, h), 0)
    ImageDraw.Draw(am).polygon(arm_poly, fill=255)
    arm_hard = np.array(am) > 127
    arm_soft = np.array(am.filter(ImageFilter.GaussianBlur(1.0))).astype(float) / 255
    arm = rgba.copy()
    arm[..., 3] *= arm_soft
    body[..., 3] *= 1 - arm_soft
    # skin-shadow strip just under the cuff: where the forearm's top drops away as it swings
    ys = np.arange(h)[:, None]
    cx, cy = zip(*sorted(cuff))
    cuff_y = np.interp(np.arange(w), cx, cy)
    strip = arm_hard & (ys < cuff_y[None, :] + arm_socket_px) & (rgba[..., 3] > 200)
    body[strip, :3] = ARM_SOCKET_RGB
    body[strip, 3] = 255
    img = lambda x: Image.fromarray(np.clip(x, 0, 255).astype(np.uint8))
    return img(head), img(body), img(arm)


def build():
    base = Image.open(os.path.join(GUYS, SRC)).convert('RGBA')
    w, h = base.size
    # top-left → top-right → the cut back from the right edge to the left edge
    head_img, body_img, arm_img = split(
        base, [(0, 0), (w, 0), *reversed(CUT)], ARM, ARM[:8], SOCKET_X, SOCKET_PX, ARM_SOCKET_PX
    )
    abox = arm_img.getbbox()
    arm_img.crop(abox).save(os.path.join(GUYS, 'mascot_arm_v1_c@0.882x.webp'), quality=92, method=6)
    box = head_img.getbbox()
    head_img = head_img.crop(box)
    head_img.save(os.path.join(GUYS, 'mascot_head_v1_c@0.882x.webp'), quality=92, method=6)
    body_img.save(os.path.join(GUYS, 'mascot_body_v2_c@0.882x.webp'), quality=92, method=6)
    # frame coordinates for GUY_CROPS (base crop: frame x 316..1256, y 0..1800 → texture 829 x 1588)
    print('head box (texture)', box)
    print('mascotHead crop: x0 %.1f y0 %.1f x1 %.1f y1 %.1f' % (316 + box[0] / SX, box[1] / SY, 316 + box[2] / SX, box[3] / SY))
    print('pivot (frame fractions): %.4f %.4f' % ((316 + PIVOT[0] / SX) / 1304, (PIVOT[1] / SY) / 1699))
    print('mascotArm crop: x0 %.1f y0 %.1f x1 %.1f y1 %.1f' % (316 + abox[0] / SX, abox[1] / SY, 316 + abox[2] / SX, abox[3] / SY))
    print('elbow (frame fractions): %.4f %.4f' % ((316 + ARM_PIVOT[0] / SX) / 1304, (ARM_PIVOT[1] / SY) / 1699))
    return head_img, box, body_img, arm_img.crop(abox), abox


def build_splash():
    """The splash chef (splash/man-base-v6: the same art, mirrored, full 1304-px frame at 1:1) cut the
    same way — the board's cut lines mapped into its space — into man-head / man-arm (cropped; their
    frame-px boxes are printed for SplashIntro's MAN table) and man-body (full canvas, like the base)."""
    base = Image.open(os.path.join(SPLASH, SPLASH_SRC)).convert('RGBA')
    w, h = base.size
    mx = lambda x: w - (316 + x / SX)  # texture x → mirrored splash x
    pt = lambda p: (mx(p[0]), p[1] / SY)
    cut = [pt(p) for p in CUT]  # now runs right → left
    head_poly = [(0, 0), (w, 0), (w, cut[0][1]), *cut, (0, cut[-1][1])]
    arm = [pt(p) for p in ARM]
    # the polygon's texture-edge points (x 829) sit at the mirrored frame's x 48: run them to the edge
    arm = [(0 if x < 49 else x, y) for x, y in arm]
    socket_x = sorted((mx(SOCKET_X[0]), mx(SOCKET_X[1])))
    head_img, body_img, arm_img = split(
        base, head_poly, arm, arm[:8], socket_x, round(SOCKET_PX / SX), round(ARM_SOCKET_PX / SX)
    )
    out = {}
    for name, im in (('head', head_img), ('arm', arm_img)):
        box = im.getbbox()
        im.crop(box).save(os.path.join(SPLASH, f'man-{name}-v1.webp'), quality=92, method=6)
        out[name] = box
        print(f'splash man-{name}-v1 box (frame px):', box)
    body_img.save(os.path.join(SPLASH, 'man-body-v1.webp'), quality=92, method=6)
    print('splash neck pivot (frame px): %.0f %.0f' % pt(PIVOT))
    print('splash elbow (frame px): %.0f %.0f' % pt(ARM_PIVOT))
    return out


def preview(out_dir, head_img, box, body_img, arm_img, abox):
    """composites at the extreme poses, zoomed on the neck + the whole figure"""
    tiles = []
    for deg, nod in [(-4, 0), (0, 0), (4, 0), (0, -8), (0, 8), (-3, 6)]:
        canvas = Image.new('RGBA', body_img.size, (90, 140, 200, 255))
        canvas.alpha_composite(body_img)
        a = Image.new('RGBA', body_img.size, (0, 0, 0, 0))
        a.paste(arm_img, abox[:2])
        arm_deg = -abs(deg) * 0.5  # inward only (PIL: − = clockwise); 2° at the ±4° tiles
        canvas.alpha_composite(a.rotate(arm_deg, resample=Image.BICUBIC, center=ARM_PIVOT))
        layer = Image.new('RGBA', body_img.size, (0, 0, 0, 0))
        layer.paste(head_img, box[:2])
        # rotate about the pivot (PIL: + = counter-clockwise), then nod
        layer = layer.rotate(deg, resample=Image.BICUBIC, center=PIVOT, translate=(0, nod))
        canvas.alpha_composite(layer)
        full = canvas.resize((canvas.width // 3, canvas.height // 3))
        neck = Image.new('RGBA', (440, 600), (255, 255, 255, 255))
        neck.paste(canvas.crop((120, 520, 560, 820)), (0, 0))
        neck.paste(canvas.crop((560, 1100, 829, 1400)).resize((269, 300)), (0, 300))
        t = Image.new('RGBA', (full.width + neck.width, max(full.height, neck.height)), (255, 255, 255, 255))
        t.paste(full, (0, 0))
        t.paste(neck, (full.width, 0))
        ImageDraw.Draw(t).text((4, 4), f'{deg} deg nod {nod}', fill=(0, 0, 0, 255))
        tiles.append(t)
    W = tiles[0].width
    sheet = Image.new('RGBA', (W * 2, tiles[0].height * 3), (255, 255, 255, 255))
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % 2) * W, (i // 2) * t.height))
    p = os.path.join(out_dir, 'chef-head-poses.png')
    sheet.save(p)
    print('preview', p)


def clean_brows():
    src = np.array(Image.open(os.path.join(GUYS, 'mascot_brows_v5_c@0.882x.webp')).convert('RGBA')).astype(float)
    edge = src[..., 3] < 250
    src[edge, :3] = (20, 12, 6)
    Image.fromarray(src.astype(np.uint8)).save(os.path.join(GUYS, 'mascot_brows_v6_c@0.882x.webp'), quality=92, method=6)
    print('brows: recoloured', int(edge.sum()), 'edge px')


if __name__ == '__main__':
    clean_brows()
    built = build()
    build_splash()
    if '--preview' in sys.argv:
        preview(sys.argv[sys.argv.index('--preview') + 1], *built)
