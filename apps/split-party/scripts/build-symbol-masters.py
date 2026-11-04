"""The 2026-11-04 symbol redraw (Figma 11440:31841..32164, ten vector blobs): render each body
SVG and frame it into the 100-unit art box as a 1254px square master.

The vectors carry their own body shapes (KIWI round, BLUEBERRY a drop, APPLE a mochi ...), so
build-body-shapes.py no longer warps anything. They are drawn on a loose canvas page, not in
board cells, so each is fitted to the box its predecessor held (BOX, measured on the
2026-10-29 masters, art-src/symbols-v2-shaped/):

  premiums (gear on top): width, left and top matched, so the horns keep their place (checked
            on CHERRIES: the new body's opaque box has the old one's aspect to 3 digits, and its
            horns scale by the same 1.158). WATERMELON's new body is lower (its crest stands
            taller on it), so it keeps the old bottom instead; build-premium-gear.py places the
            new crest and flower on the framed bodies.
  GRAPES    its antennae are drawn into the art now (user: "use the new art"), so the body's
            width (measured BODY_ROW down, under the antennae) and the bottom are matched.
  low       area matched, centred on the old box, capped to the cell's art box (CAP).

art-src/symbols-v3/<S>.svg     Figma vectors (crest.svg, flower.svg: gear, build-premium-gear.py)
  -> art-src/symbols-framed/<S>.png  1254x1254 masters (build-body-shapes.py copies them into
                                     art-src/symbols/, which build-symbols.py reads)
The previous masters are in art-src/symbols-v2-framed/ and art-src/symbols-v2-shaped/.
    python3 apps/split-party/scripts/build-symbol-masters.py
"""

import io
from pathlib import Path

import cairosvg
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'art-src' / 'symbols-v3'
OUT = ROOT / 'art-src' / 'symbols-framed'
N = 1254
DETECT = 224
SYMBOLS = ('APPLE', 'BLUEBERRY', 'CHERRIES', 'GRAPES', 'KIWI', 'LEMON', 'ORANGE', 'PLUM', 'STRAWBERRY', 'WATERMELON')
PREMIUM = {'CHERRIES', 'STRAWBERRY', 'WATERMELON'}
# The old masters' opaque boxes, art units (x0, y0, x1, y1).
BOX = {
	'APPLE': (4.5, 22.0, 94.4, 84.5),
	'BLUEBERRY': (2.2, 14.0, 97.0, 91.5),
	'CHERRIES': (12.4, 19.5, 86.0, 87.3),
	'GRAPES': (9.6, 13.7, 89.8, 85.2),
	'KIWI': (15.6, 9.3, 87.6, 90.4),
	'LEMON': (10.3, 18.9, 90.4, 84.4),
	'ORANGE': (7.8, 15.2, 91.4, 90.8),
	'PLUM': (7.6, 10.1, 91.5, 92.7),
	'STRAWBERRY': (6.7, 13.3, 92.8, 91.1),
	'WATERMELON': (10.6, 13.2, 88.9, 87.6),
}
CAP = (94.0, 82.0)  # widest / tallest a low body may get, art units
BODY_ROW = 0.8  # GRAPES: the row (share of its height) where the body's width is measured
PROBE = 8  # px per svg px for the measuring render


def render(svg: bytes, scale: float) -> Image.Image:
	return Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg, scale=scale))).convert('RGBA')


def opaque(im: Image.Image) -> tuple[int, int, int, int]:
	return im.getchannel('A').point(lambda a: 255 if a > 128 else 0).getbbox()


def place(sym: str, im: Image.Image) -> tuple[float, float, float]:
	"""(units per probe px, left, top) of the probe render inside the art box."""
	x0, y0, x1, y1 = opaque(im)
	bx0, by0, bx1, by1 = BOX[sym]
	if sym in PREMIUM:
		k = (bx1 - bx0) / (x1 - x0)
		if sym == 'WATERMELON':
			return k, bx0 - x0 * k, by1 - y1 * k
		return k, bx0 - x0 * k, by0 - y0 * k
	if sym == 'GRAPES':
		row = np.nonzero(np.asarray(im)[round(y0 + (y1 - y0) * BODY_ROW), :, 3] > 128)[0]
		k = (bx1 - bx0) / (row.max() - row.min())
		return k, (bx0 + bx1) / 2 - (row.min() + row.max()) / 2 * k, by1 - y1 * k
	w, h = x1 - x0, y1 - y0
	k = ((bx1 - bx0) * (by1 - by0) / (w * h)) ** 0.5
	k = min(k, CAP[0] / w, CAP[1] / h)
	return k, (bx0 + bx1) / 2 - (x0 + x1) / 2 * k, (by0 + by1) / 2 - (y0 + y1) / 2 * k


def main():
	(OUT / 'detect').mkdir(parents=True, exist_ok=True)
	for sym in SYMBOLS:
		svg = (SRC / f'{sym}.svg').read_bytes()
		k, left, top = place(sym, render(svg, PROBE))
		px = N / 100
		# Render straight at the master's scale: the vector stays sharp, no resample.
		part = render(svg, PROBE * k * px)
		ox, oy = round(left * px), round(top * px)
		master = Image.new('RGBA', (N, N))
		part = part.crop((max(0, -ox), max(0, -oy), part.width, part.height))
		master.alpha_composite(part, (max(0, ox), max(0, oy)))
		master.save(OUT / f'{sym}.png')
		master.resize((DETECT, DETECT), Image.LANCZOS).save(OUT / 'detect' / f'{sym}.webp', 'WEBP', quality=95, method=6)
		print(sym, 'opaque units', tuple(round(v / px, 1) for v in opaque(master)))


if __name__ == '__main__':
	main()
