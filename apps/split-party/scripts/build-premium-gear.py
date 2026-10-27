"""The four premium blobs' gear (Figma 11300:28009, the board's "SYmbols" cells): the parts
the design adds on top of the plain blob art, cut as separate layers so they can move.

  WATERMELON  green, spiky crest     (Group 176: a vectorized crest over the body)
  CHERRIES    red, two curved horns  (Group 179: one horn, mirrored, behind the body)
  GRAPES      purple, two antennae   (Group 227: one antenna, mirrored, behind the body)
  STRAWBERRY  pink, a flower         (Group 175: over the body)

The bodies are unchanged: Figma's body images match public/symbols/*.webp.

Sources in art-src/premium/ (Figma's raw image fills; crest.png is the 30-path vector crest
rendered at 16x in headless Chrome). Placements are Figma's, converted into the blob's 100-unit
art box (the body image's square): each part is a rect centred at (cx, cy), rotated by `rot`
degrees after an optional horizontal mirror (`flip`), exactly as the design's transforms.

  -> public/symbols/gear/hd/<part>.webp  cropped to the opaque pixels, 8 px per art unit (or the master's)
  -> src/lib/gear.json                 per symbol: the parts, back to front, with the crop rect
                                       and the pivot (where the part meets the body) relative
                                       to the part's centre, in art units, before rotation
    python3 apps/split-party/scripts/build-premium-gear.py
"""

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'art-src' / 'premium'
OUT = ROOT / 'public' / 'symbols' / 'gear'
PX = 8  # pixels per art unit, capped at the master's own (the bodies are 4.48; the splash's big
#        blobs and the win squash show gear at ~5 device px per unit)

# Figma geometry, in each symbol group's own px (body box = group box unless noted).
# Group 176 (75.211): crest box left 27.6%, right 30.5%, top 4px, 25px tall.
G176 = 75.21112823486328
# Group 175 (71.067): flower left 20.29%, right 21.74%, top 1.09px, aspect 1536/1024.
G175 = 71.06707763671875
# Group 179 (75.211): horn boxes 37.88x36.13 aspect, left 39.13% / right 10.5% (and mirrored),
# top 4.36px; the horn inside is hypot()-sized and turned 30deg (CSS container units).
G179 = 75.21112823486328
# Group 227: antenna boxes 50.738x38.456 at x 0 and 42.64, the 45.943x30.629 antenna inside
# turned -10.45deg (the second: scale-y -1 then rotate -169.55 = mirrored, turned +10.45);
# the body at (8.92, 0.88), 75.211 square.
BODY_227 = (8.92, 0.88, 75.21112823486328)


def horn_rect():
    w = 100 - 39.13 - 10.5
    h = w * 36.12664067051264 / 37.88218855890307
    cw, ch = w, h
    iw = (0.674108 * cw) ** 2 + (0.408109 * ch) ** 2
    ih = (0.325892 * cw) ** 2 + (0.591891 * ch) ** 2
    return w, h, iw**0.5, ih**0.5, 4.36 / G179 * 100


hw, hh, hiw, hih, htop = horn_rect()
bx, by, bs = BODY_227


def antenna_centre(left):
    return ((left + 50.738 / 2 - bx) / bs * 100, (38.456 / 2 - by) / bs * 100)


# name: (source, pivot as fractions of the source image: where the part meets the body)
PARTS = {
    'crest': ('crest.png', (0.5, 0.92)),
    'flower': ('flower.png', (0.47, 0.8)),
    'horn': ('horn.png', (0.25, 0.78)),
    'antenna': ('antenna.png', (0.56, 0.8)),
}
# symbol: [(part, front, cx, cy, w, h, rot, flip)], back to front within each side.
SYMBOLS = {
    'WATERMELON': [
        ('crest', True, 27.6 + (100 - 27.6 - 30.5) / 2, (4 + 12.5) / G176 * 100, 100 - 27.6 - 30.5, 25 / G176 * 100, 0, False),
    ],
    'STRAWBERRY': [
        (
            'flower',
            True,
            20.29 + (100 - 20.29 - 21.74) / 2,
            1.09 / G175 * 100 + (100 - 20.29 - 21.74) * 1024 / 1536 / 2,
            100 - 20.29 - 21.74,
            (100 - 20.29 - 21.74) * 1024 / 1536,
            0,
            False,
        ),
    ],
    'CHERRIES': [
        ('horn', False, 39.13 + hw / 2, htop + hh / 2, hiw, hih, -30, False),
        ('horn', False, 10.14 + hw / 2, htop + hh / 2, hiw, hih, 30, True),
    ],
    'GRAPES': [
        ('antenna', False, *antenna_centre(0), 45.943 / bs * 100, 30.629 / bs * 100, -10.45, False),
        ('antenna', False, *antenna_centre(42.64), 45.943 / bs * 100, 30.629 / bs * 100, 10.45, True),
    ],
}

(OUT / 'hd').mkdir(parents=True, exist_ok=True)
crops = {}
for name, (src, _) in PARTS.items():
    im = Image.open(SRC / src).convert('RGBA')
    box = im.getchannel('A').point(lambda a: 255 if a > 4 else 0).getbbox()
    crops[name] = (im, box)

data = {}
sized = {}
for sym, parts in SYMBOLS.items():
    out = []
    for name, front, cx, cy, w, h, rot, flip in parts:
        im, (x0, y0, x1, y1) = crops[name]
        W, H = im.size
        # The crop inside the part's rect, relative to its centre.
        sx, sy = -w / 2 + x0 / W * w, -h / 2 + y0 / H * h
        sw, sh = (x1 - x0) / W * w, (y1 - y0) / H * h
        px, py = PARTS[name][1]
        sized[name] = max(sized.get(name, (0, 0)), (sw, sh))
        out.append(
            {
                'src': f'./symbols/gear/hd/{name}.webp',
                'part': name,
                'front': front,
                'cx': round(cx, 3),
                'cy': round(cy, 3),
                'rot': rot,
                'flip': flip,
                'x': round(sx, 3),
                'y': round(sy, 3),
                'w': round(sw, 3),
                'h': round(sh, 3),
                'px': round(-w / 2 + px * w, 3),
                'py': round(-h / 2 + py * h, 3),
            }
        )
    data[sym] = out

for name, (sw, sh) in sized.items():
    im, box = crops[name]
    k = min(PX, (box[2] - box[0]) / sw)
    cut = im.crop(box).resize((round(sw * k), round(sh * k)), Image.LANCZOS)
    path = OUT / 'hd' / f'{name}.webp'
    cut.save(path, quality=90, method=6)
    print(path.name, cut.size, path.stat().st_size // 1024, 'KB')

(ROOT / 'src' / 'lib' / 'gear.json').write_text(json.dumps(data, indent='\t') + '\n')
print('gear.json', {k: len(v) for k, v in data.items()})
