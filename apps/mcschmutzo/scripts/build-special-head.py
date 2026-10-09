#!/usr/bin/env python3
"""
Splits the free-games (salting) chef, special_base_v12h, into a HEAD and a BODY so his head can turn
and nod on its neck (AnimatedGuy `head`), the way build-chef-head.py does for the board chef:

  special_head_v1_c@0.798x.webp  hat, hair, face, chin and the neck's shadow, cropped to its box
                                 (GUY_CROPS.specialHead)
  special_body_v1_c@0.798x.webp  everything else, on the base's crop (GUY_CROPS.specialBase)
  special_hat_v1_c@0.798x.webp   the paper hat, lifted off the head so it can hop on a win
                                 (GUY_CROPS.specialHat); the head gets a crown of hair drawn under it

The cut (texture px of the base) runs from the background left of the jaw, under the chin along the
top of the bow tie and the left collar wing, up the right collar's inner outline, then out under the
hair through the background. The body gets the dark neck-shadow "socket" just under the cut, so the
head's motion shows shadow, never a hole.

    python3 scripts/build-special-head.py [--preview DIR]
"""
import importlib.util
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('chef_head', os.path.join(HERE, 'build-chef-head.py'))
chef_head = importlib.util.module_from_spec(spec)
spec.loader.exec_module(chef_head)

GUYS = chef_head.GUYS
SRC = 'special_base_v12h_c@0.798x.webp'
CUT = [
    (0, 655), (120, 676), (165, 706), (200, 724),  # background left of the jaw, round the jaw's base
    (240, 732), (285, 737), (330, 736), (358, 730),  # just under the chin's outline (the collar stays)
    (388, 716), (410, 696), (428, 670), (440, 645), (446, 606),  # just inside the collar's inner outline
    (480, 597), (530, 598), (620, 590), (878, 560),  # under the hair, through the background
]
PIVOT = (395, 720)  # neck base
SOCKET_X = (150, 460)
SOCKET_PX = 22
OVERLAP = 4  # px of original art the body keeps under the head's edge
K = 0.798  # texture px per frame px; the base crop starts at frame x 511
# The hat: its outline (with the black stroke) plus the tan inside showing under the right brim.
HAT = [
    (232, 60), (278, 48), (352, -2), (405, 28), (470, 68), (500, 108), (560, 148), (620, 197), (606, 250),
    (608, 336), (600, 358), (578, 366), (546, 316), (528, 309), (460, 265), (380, 232), (300, 209), (262, 200),
    (238, 188), (208, 151), (220, 108),
]
# The top of the skull under the hat: hair below this line, background above.
CROWN = [(200, 160), (260, 132), (340, 114), (420, 126), (500, 160), (570, 204), (625, 242)]
HAIR_RGB = (43, 29, 14)
HAT_PIVOT = (420, 250)  # brim's middle: the hat hops and tips about this


def build():
    base = Image.open(os.path.join(GUYS, SRC)).convert('RGBA')
    w, h = base.size
    # no forearm to split here: pass an empty arm polygon far off the art
    off = [(w + 10, h + 10), (w + 11, h + 10), (w + 11, h + 11)]
    head, body = split_head(base, [(0, 0), (w, 0), *reversed(CUT)])
    head, hat = split_hat(head)
    hbox = hat.getbbox()
    hat.crop(hbox).save(os.path.join(GUYS, 'special_hat_v1_c@0.798x.webp'), quality=92, method=6)
    print('specialHat crop: x0 %.1f y0 %.1f x1 %.1f y1 %.1f' % (511 + hbox[0] / K, hbox[1] / K, 511 + hbox[2] / K, hbox[3] / K))
    print('hat pivot (frame fractions): %.4f %.4f' % ((511 + HAT_PIVOT[0] / K) / 1611, (HAT_PIVOT[1] / K) / 1912))
    box = head.getbbox()
    head.crop(box).save(os.path.join(GUYS, 'special_head_v1_c@0.798x.webp'), quality=92, method=6)
    body.save(os.path.join(GUYS, 'special_body_v1_c@0.798x.webp'), quality=92, method=6)
    print('specialHead crop: x0 %.1f y0 %.1f x1 %.1f y1 %.1f' % (511 + box[0] / K, box[1] / K, 511 + box[2] / K, box[3] / K))
    print('neck pivot (frame fractions): %.4f %.4f' % ((511 + PIVOT[0] / K) / 1611, (PIVOT[1] / K) / 1912))
    return head.crop(box), box, body


def split_head(base, poly):
    """→ (head, body). Unlike build-chef-head's split, the body keeps OVERLAP px of the original art
    under the head's edge, so the seam is fully opaque at rest (both layers fading across the same
    soft edge left a see-through line), then the dark neck socket behind that."""
    import numpy as np
    from PIL import ImageDraw, ImageFilter

    w, h = base.size
    m = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    soft = np.array(m.filter(ImageFilter.GaussianBlur(1.2))).astype(float) / 255
    inner = m.filter(ImageFilter.MinFilter(2 * OVERLAP + 1))
    inner_soft = np.array(inner.filter(ImageFilter.GaussianBlur(1.2))).astype(float) / 255
    rgba = np.array(base).astype(float)
    head = rgba.copy()
    head[..., 3] *= soft
    body = rgba.copy()
    body[..., 3] *= 1 - inner_soft
    # socket: inside the inner region, within SOCKET_PX of its edge, in the neck's span, where opaque
    outside = Image.fromarray(((np.array(inner) < 128) * 255).astype(np.uint8))
    for _ in range(SOCKET_PX // 2):
        outside = outside.filter(ImageFilter.MaxFilter(5))
    near = np.array(outside) > 127
    xs = np.arange(w)[None, :]
    socket = (np.array(inner) > 127) & near & (xs >= SOCKET_X[0]) & (xs <= SOCKET_X[1]) & (rgba[..., 3] > 200)
    body[socket, :3] = chef_head.SOCKET_RGB
    body[socket, 3] = 255
    img = lambda x: Image.fromarray(np.clip(x, 0, 255).astype(np.uint8))
    return img(head), img(body)


def split_hat(head):
    """→ (head with a hair crown under where the hat was, the hat alone)"""
    import numpy as np
    from PIL import ImageDraw, ImageFilter

    w, h = head.size
    m = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m).polygon(HAT, fill=255)
    m = m.filter(ImageFilter.MaxFilter(9))  # take the outline's full stroke with it
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
        d.line([(x0 + 8, y0 + 14), ((x0 + x1) / 2, (y0 + y1) / 2 + 26)], fill=(74, 50, 26, 255), width=4)
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


def preview(out_dir, head, box, body):
    tiles = []
    for deg, nod in [(-6, 0), (0, 0), (6, 0), (0, 10), (-4, -8), (5, 6)]:
        c = Image.new('RGBA', body.size, (90, 140, 200, 255))
        c.alpha_composite(body)
        layer = Image.new('RGBA', body.size, (0, 0, 0, 0))
        layer.paste(head, box[:2])
        c.alpha_composite(layer.rotate(deg, resample=Image.BICUBIC, center=PIVOT, translate=(0, nod)))
        tiles.append(c.crop((0, 0, w := body.width, 950)).resize((w // 2, 475)))
    sheet = Image.new('RGBA', (tiles[0].width * 3, tiles[0].height * 2), 'white')
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % 3) * t.width, (i // 3) * t.height))
    p = os.path.join(out_dir, 'special-head-poses.png')
    sheet.save(p)
    print('preview', p)


if __name__ == '__main__':
    built = build()
    if '--preview' in sys.argv:
        preview(sys.argv[sys.argv.index('--preview') + 1], *built)
