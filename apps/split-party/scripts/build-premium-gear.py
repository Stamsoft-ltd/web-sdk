"""The premium blobs' gear (Figma 11300:28009, the board's "SYmbols" cells): the parts
the design adds on top of the plain blob art, cut as separate layers so they can move.

  WATERMELON  green, spiky crest     (Group 176: a vectorized crest over the body)
  CHERRIES    red, two curved horns  (Group 179: one horn, mirrored, behind the body)
  STRAWBERRY  pink, a flower         (Group 175: over the body)

Since the 2026-11-04 vector redraw (Figma 11440:*) the crest and the flower are the new vectors
(art-src/symbols-v3/crest.svg, flower.svg, rendered into art-src/premium/), placed as Group 371
and Group 369 draw them on the new bodies, measured on the framed masters
(build-symbol-masters.py). GRAPES draws its antennae into the body art now: no gear.
The horns are unchanged (the new Group 373 is the old Group 179 scaled 1.158).

Sources in art-src/premium/ (horn.png: Figma's raw image fill; the old crest/flower/antenna are
in premium/v2/). Placements are converted into the blob's 100-unit art box (the body image's
square): each part is a rect centred at (cx, cy), rotated by `rot` degrees after an optional
horizontal mirror (`flip`), exactly as the design's transforms.

  -> public/symbols/gear/v2/<part>.webp  cropped to the opaque pixels, 8 px per art unit (or the master's)
  -> src/lib/gear.json                 per symbol: the parts, back to front, with the crop rect
                                       and the pivot (where the part meets the body) relative
                                       to the part's centre, in art units, before rotation
    python3 apps/split-party/scripts/build-premium-gear.py
"""

import json
import io
from pathlib import Path

import cairosvg
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'art-src' / 'premium'
OUT = ROOT / 'public' / 'symbols' / 'gear'
PX = 8  # pixels per art unit, capped at the master's own (the bodies are 4.48; the splash's big
#        blobs and the win squash show gear at ~5 device px per unit)

# Figma geometry, in each symbol group's own px.
# Group 371: body 64.85 wide at (0, 11.855); crest 33x28.23, centred on it, at the group's top.
# Group 369: body 67.896 wide at (0, 8.022); flower 36.075x24.549 at (16.0, 0).
G371 = {'body': (64.8497, 11.8555), 'part': (32.4249 - 16.5, 0.0, 33.0, 28.2296)}
G369 = {'body': (67.8959, 8.0219), 'part': (16.0, 0.0, 36.0755, 24.5488)}
# Group 179 (75.211): horn boxes 37.88x36.13 aspect, left 39.13% / right 10.5% (and mirrored),
# top 4.36px; the horn inside is hypot()-sized and turned 30deg (CSS container units).
G179 = 75.21112823486328


def horn_rect():
    w = 100 - 39.13 - 10.5
    h = w * 36.12664067051264 / 37.88218855890307
    cw, ch = w, h
    iw = (0.674108 * cw) ** 2 + (0.408109 * ch) ** 2
    ih = (0.325892 * cw) ** 2 + (0.591891 * ch) ** 2
    return w, h, iw**0.5, ih**0.5, 4.36 / G179 * 100


hw, hh, hiw, hih, htop = horn_rect()


def render_svgs():
    """The new crest/flower vectors at 16 px per Figma px (art-src/premium/<part>.png)."""
    for name in ('crest', 'flower'):
        svg = (ROOT / 'art-src' / 'symbols-v3' / f'{name}.svg').read_bytes()
        Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg, scale=16))).save(SRC / f'{name}.png')


def on_body(sym, group):
    """(cx, cy, w, h) of a group's part, in art units, from the framed body's opaque box."""
    im = Image.open(ROOT / 'art-src' / 'symbols-framed' / f'{sym}.png')
    x0, y0, x1, _ = im.getchannel('A').point(lambda a: 255 if a > 128 else 0).getbbox()
    u = 100 / im.width
    bw, btop = group['body']
    k = (x1 - x0) * u / bw  # art units per Figma px
    px, py, pw, ph = group['part']
    return x0 * u + (px + pw / 2) * k, y0 * u + (py - btop + ph / 2) * k, pw * k, ph * k


render_svgs()


# name: (source, pivot as fractions of the source image: where the part meets the body)
PARTS = {
    'crest': ('crest.png', (0.5, 0.92)),
    'flower': ('flower.png', (0.47, 0.8)),
    'horn': ('horn.png', (0.25, 0.78)),
}
# symbol: [(part, front, cx, cy, w, h, rot, flip)], back to front within each side.
SYMBOLS = {
    'WATERMELON': [
        ('crest', True, *on_body('WATERMELON', G371), 0, False),
    ],
    'STRAWBERRY': [
        ('flower', True, *on_body('STRAWBERRY', G369), 0, False),
    ],
    'CHERRIES': [
        ('horn', False, 39.13 + hw / 2, htop + hh / 2, hiw, hih, -30, False),
        ('horn', False, 10.14 + hw / 2, htop + hh / 2, hiw, hih, 30, True),
    ],
}

(OUT / 'v2').mkdir(parents=True, exist_ok=True)
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
                'src': f'./symbols/gear/v2/{name}.webp',
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
    path = OUT / 'v2' / f'{name}.webp'
    cut.save(path, quality=90, method=6)
    print(path.name, cut.size, path.stat().st_size // 1024, 'KB')

(ROOT / 'src' / 'lib' / 'gear.json').write_text(json.dumps(data, indent='\t') + '\n')
print('gear.json', {k: len(v) for k, v in data.items()})
