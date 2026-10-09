#!/usr/bin/env python3
"""
The phone-LANDSCAPE chef — Figma McShmutzo 8295:22703 (base: 8888:2018, the ketchup) and 8302:23371
(free games: 8888:2673, the salt shaker, the pot in front of him), with the pointing arm swapped for
the straight hanging arm of 8779:1769 (One-Armed Retro Diner Worker, art-src/landscape-8295/onearm/,
background rect stripped). That drawing is the same body: registered on the head outline it lands on
the nodes' body group at scale 0.519, offset (-10, -15) Figma units (x 136.17/137.73 in free games).

Both nodes are vector groups (transparent), so art-src/landscape-8295/chef-{base,free}/index.html
rebuilds each node from its own Figma layers and headless Chrome renders it at 4x on a transparent
page (render-arm-nohand = the straight-arm body, render-onlyhand = the prop hand, @4x.png: the node sits at 30,30 css px, 1 css px =
1 Figma unit). The design shows the node MIRRORED (its name tag reads backwards unmirrored), so every
layer is flipped here.

The bow tie is lifted off the body onto its own layer so it can wobble on its knot (as the board
chef's, build-chef-bow.py): BOW is its outline traced in (mirrored) base-node units, grown GROW texels
minus the light shirt texels it then catches; the body keeps its own bow under it, so a tilt only
ever uncovers the same red (a shadow-red footprint showed a jagged patch beside the strap). The free-games node is the same drawing at
136.17/137.73 the size, so its outline is BOW scaled by that.

Writes static/assets/mcschmutzo/guys/land_chef_{base,free}_{body_v4,hand_v2,bow_v1}.webp at SCALE x
the Figma units and prints each layer's box (+ the knot) in node units, for LandscapeChef.svelte.

    python3 scripts/build-landscape-chef.py
"""
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'art-src', 'landscape-8295')
OUT = os.path.join(HERE, '..', 'static', 'assets', 'mcschmutzo', 'guys')
R = 4  # render px per Figma unit
AT = 30  # node offset in the render page (css px)
SCALE = 3  # texture px per Figma unit (a 390 px tall phone shows the node ~255 css px tall)
NODE_W = {'base': 181.0514, 'free': 179.0}
NODE_K = {'base': 1.0, 'free': 136.172 / 137.732}
BOW = [
    (71.1, 120.6), (72.8, 116.7), (77.8, 116.1), (83.3, 118.3), (88.3, 120.6), (92.2, 119.4),
    (96.7, 118.3), (102.2, 116.1), (106.7, 116.7), (108.2, 119.4), (108.6, 127.2), (108.2, 132.8),
    (105.6, 135.0), (100.0, 134.1), (95.6, 131.7), (92.2, 132.8), (87.8, 131.1), (82.2, 134.1),
    (76.7, 135.0), (72.8, 132.2), (71.1, 127.2),
]
KNOT = (92.2, 125.6)
GROW = 2  # (the right lobe touches the apron strap: no more, or the bow takes a strap sliver along)


def lift_bow(body, x0, k):
    """Split the bow off `body` (texture whose left edge is node x x0). Returns (bow crop, its box
    in texels, body with the footprint shadowed)."""
    m = Image.new('L', body.size, 0)
    ImageDraw.Draw(m).polygon([((x * k - x0) * SCALE, y * k * SCALE) for x, y in BOW], fill=255)
    m = np.asarray(m.filter(ImageFilter.MaxFilter(2 * GROW + 1))) > 0
    a = np.asarray(body).copy()
    m &= ~(a[..., :3].min(axis=2) > 170) & (a[..., 3] > 0)
    bow = np.zeros_like(a)
    bow[m] = a[m]
    # (the body keeps its own bow under the lifted one: the tie only sways a few degrees, so what a
    # tilt uncovers is the same red bow, never the jagged-edged shadow patch that used to fill it)
    bow_img = Image.fromarray(bow)
    box = bow_img.getbbox()
    return bow_img.crop(box), box, Image.fromarray(a)

for phase in ('base', 'free'):
    boxes = {}
    for part, name in (('body', 'arm-nohand'), ('hand', 'onlyhand')):
        im = Image.open(os.path.join(SRC, f'chef-{phase}', f'render-{name}@4x.png')).convert('RGBA')
        box = im.getchannel('A').point(lambda a: 255 if a > 2 else 0).getbbox()
        crop = ImageOps.mirror(im.crop(box))
        # node units, mirrored about the node's own width
        x0 = NODE_W[phase] - (box[2] / R - AT)
        y0 = box[1] / R - AT
        w = (box[2] - box[0]) / R
        h = (box[3] - box[1]) / R
        tex = crop.resize((round(w * SCALE), round(h * SCALE)), Image.LANCZOS)
        boxes[part] = (x0, y0, tex)
    k = NODE_K[phase]
    bx0, by0, body = boxes['body']
    bow, bbox, body = lift_bow(body.convert('RGBA'), bx0, k)
    hx0, hy0, hand = boxes['hand']
    for part, img, x, y, v in (
        ('body', body, bx0, by0, 4),
        ('hand', hand, hx0, hy0, 2),
        ('bow', bow, bx0 + bbox[0] / SCALE, by0 + bbox[1] / SCALE, 1),
    ):
        img.save(os.path.join(OUT, f'land_chef_{phase}_{part}_v{v}.webp'), quality=92, method=6)
        print(f"{phase} {part}: {{ x: {x:.2f}, y: {y:.2f}, w: {img.width / SCALE:.2f}, h: {img.height / SCALE:.2f} }}")
    print(f'{phase} knot: {KNOT[0] * k:.2f} {KNOT[1] * k:.2f}')
