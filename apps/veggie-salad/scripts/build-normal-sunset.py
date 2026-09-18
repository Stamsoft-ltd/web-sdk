#!/usr/bin/env python3
"""NORMAL bonus sunset garden (Figma frame 9198:104316) and its owl (node 9355:54123).

The design's NORMAL garden is a sunset: a red-to-gold sky (CSS gradient), the base garden's
hill silhouette recoloured for dusk, one lit cloud, the base fence and flowers, and an owl
perched on the cluster panel. This writes the vector pieces as pixel-clean webps:

    background/bonus-normal/sunset/treeline.webp   the recoloured hills, full width
    background/bonus-normal/sunset/cloud.webp      the lit cloud
    background/bonus-normal/sunset/owl/body.webp   owl with the eye sockets inpainted
    background/bonus-normal/sunset/owl/eyes.webp   both eyes (ring, iris, pupil, glint)

The owl's eyes are a separate layer so the CSS can blink and glance them; the sockets under
them are filled with the face's flat cream (the SUPER wolf, build-super-wolf.py, does the same
split with a nearest-fur fill, which the owl's brown disc edge would smear). The glint is the face's own cream, so the eye mask is "dark
or gold, plus whatever those enclose". Run from anywhere:

    python3 apps/veggie-salad/scripts/build-normal-sunset.py
"""
from __future__ import annotations

from collections import deque
from io import BytesIO
from pathlib import Path

import cairosvg
from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
ART = HERE / 'art'
OUT = HERE.parents[0] / 'static/assets/veggie-salad/pixel/background/bonus-normal/sunset'

OWL_SCALE = 6  # 157px design → 942px masks
OWL_CROP = (100, 60, 860, 910)
OWL_OUT = (380, 425)
# (x0, y0, x1, y1) around each eye at 6x; the left box stops short of the beak
EYE_BOXES = [(383, 290, 513, 445), (582, 326, 714, 474)]


def near(c, ref, tol=22):
    return c[3] > 0 and all(abs(c[i] - ref[i]) < tol for i in range(3))


def is_eye_paint(c):
    return near(c, (40, 14, 4)) or near(c, (254, 211, 123)) or near(c, (254, 197, 96))


def render(name, w, h):
    return Image.open(BytesIO(cairosvg.svg2png(url=str(ART / name), output_width=w, output_height=h))).convert('RGBA')


def eye_mask(im):
    px = im.load()
    mask = Image.new('L', im.size, 0)
    mp = mask.load()
    for x0, y0, x1, y1 in EYE_BOXES:
        for y in range(y0, y1):
            for x in range(x0, x1):
                if is_eye_paint(px[x, y]):
                    mp[x, y] = 255
        seen = set()
        queue = deque(
            [(x, y) for x in range(x0, x1) for y in (y0, y1 - 1) if mp[x, y] == 0]
            + [(x, y) for y in range(y0, y1) for x in (x0, x1 - 1) if mp[x, y] == 0]
        )
        while queue:
            x, y = queue.popleft()
            if (x, y) in seen or not (x0 <= x < x1 and y0 <= y < y1) or mp[x, y]:
                continue
            seen.add((x, y))
            queue.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
        for y in range(y0, y1):
            for x in range(x0, x1):
                if mp[x, y] == 0 and (x, y) not in seen:
                    mp[x, y] = 255
    return mask


def inpaint(im, mask, colour=(251, 239, 225, 255)):
    """The face around both eyes is one flat cream, so the socket is filled with it outright —
    a nearest-pixel fill smears the brown disc edge and the gold iris across the socket."""
    out = im.copy()
    out.paste(Image.new('RGBA', im.size, colour), (0, 0), mask)
    return out


def cut(im, mask):
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out


def save(im, rel):
    path = OUT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, lossless=True, quality=100, method=6)


def main():
    # Hills: the design places the 1200px-wide vector across the full frame width.
    tree = render('sunset-treeline-9198-104321.svg', 2400, 568)
    save(tree.crop((0, tree.getbbox()[1], 2400, tree.getbbox()[3])), 'treeline.webp')
    cloud = render('sunset-cloud-9198-104682.svg', 828, 276)
    save(cloud.crop(cloud.getbbox()), 'cloud.webp')

    owl = render('owl-9355-54123.svg', 157 * OWL_SCALE, 157 * OWL_SCALE)
    eyes = eye_mask(owl)
    # The fill is widened a few pixels so the ring's anti-aliased edge does not survive under
    # the eye layer as a ghost outline when the eyes glance aside.
    save(inpaint(owl, eyes.filter(ImageFilter.MaxFilter(9))).crop(OWL_CROP).resize(OWL_OUT, Image.LANCZOS), 'owl/body.webp')
    save(cut(owl, eyes).crop(OWL_CROP).resize(OWL_OUT, Image.LANCZOS), 'owl/eyes.webp')


if __name__ == '__main__':
    main()
