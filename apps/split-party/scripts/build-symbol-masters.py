"""The 2026-10-28 symbol redraw (Figma 11318:41751 "Base game"): frame each new body image
into the 100-unit art box, at the spot the design draws it, as a 1254px square master.

The new bodies are non-square images (≈1349x1166) that Figma places differently per cell
(cover crops, a scaled-up crop for LEMON), so the low symbols are placed by MEASURING the
design: each "Low symbols" cell exported at 4x, the body's opaque box found against the cell
fill #4b3981, converted to art units. Art units are Group 176's box (WATERMELON, 75.211 px at
(7.065, -1.635) in the cell row), the frame every master already used. Measured: left/right
edge and top (the cell clips the feet, so the height comes from the image's own aspect).

The premium bodies sit inside their symbol groups (gear.json's frames), from the design's CSS:
  CHERRIES   Group 179: left 1.45%, right 2.9%, top 9px of 75.211
  STRAWBERRY Group 175: left/right -4.35%, top 4px of 71.067 (its own frame, as before)
  GRAPES     Group 238: 67x65 cover at (12.71, 5.03); the art box is BODY_227 (8.92, 0.88, 75.211)
WATERMELON and all gear are unchanged (pixel-identical to the old sources).

art-src/symbols-v2/<S>.png   Figma raw fills (transparent), gitignored
  -> art-src/symbols-framed/<S>.png  1254x1254 framed masters (build-body-shapes.py reads these and
                                     writes art-src/symbols/, which build-symbols.py reads)
The previous masters are in art-src/symbols-v1/.
    python3 apps/split-party/scripts/build-symbol-masters.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'art-src' / 'symbols-v2'
# Framed designer bodies; build-body-shapes.py shapes the low symbols into art-src/symbols.
OUT = ROOT / 'art-src' / 'symbols-framed'
N = 1254
DETECT = 224

# Low symbols: opaque box measured in the 4x cell renders, art units (left, right, top).
MEASURED = {
	'BLUEBERRY': (3.9, 95.2, 12.5),
	'KIWI': (2.6, 96.8, 13.1),
	'LEMON': (14.5, 86.2, 10.1),
	'PLUM': (7.5, 91.5, 10.1),
	'APPLE': (4.5, 94.5, 11.8),
	'ORANGE': (6.9, 92.2, 11.1),
}


def image_rect(w: int, h: int, sym: str) -> tuple[float, float, float, float]:
	"""Where the whole source image goes, in art units: (x, y, width, height)."""
	if sym == 'CHERRIES':
		g = 75.21112823486328
		x, rw = 1.45, 100 - 1.45 - 2.9
		return x, 9 / g * 100, rw, rw * h / w
	if sym == 'STRAWBERRY':
		g = 71.06707763671875
		rw = 100 + 2 * 4.35
		return -4.35, 4 / g * 100, rw, rw * h / w
	if sym == 'GRAPES':
		bx, by, bs = 8.92, 0.88, 75.21112823486328
		k = max(67 / w, 65 / h)  # object-cover into 67x65
		dw, dh = w * k, h * k
		return (12.71 - (dw - 67) / 2 - bx) / bs * 100, (5.03 - (dh - 65) / 2 - by) / bs * 100, dw / bs * 100, dh / bs * 100
	raise KeyError(sym)


def measured_rect(im: Image.Image, sym: str) -> tuple[float, float, float, float]:
	left, right, top = MEASURED[sym]
	x0, y0, x1, _ = im.getchannel('A').point(lambda a: 255 if a > 128 else 0).getbbox()
	k = (right - left) / (x1 - x0)  # art units per source px
	return left - x0 * k, top - y0 * k, im.width * k, im.height * k


def main():
	(OUT / 'detect').mkdir(parents=True, exist_ok=True)
	for path in sorted(SRC.glob('*.png')):
		sym = path.stem
		im = Image.open(path).convert('RGBA')
		x, y, w, h = measured_rect(im, sym) if sym in MEASURED else image_rect(im.width, im.height, sym)
		px = N / 100
		# Resample premultiplied so the transparent edge doesn't fringe.
		part = im.convert('RGBa').resize((round(w * px), round(h * px)), Image.LANCZOS).convert('RGBA')
		master = Image.new('RGBA', (N, N))
		ox, oy = round(x * px), round(y * px)
		# alpha_composite takes no negative offset: crop what hangs off the top/left instead.
		part = part.crop((max(0, -ox), max(0, -oy), part.width, part.height))
		master.alpha_composite(part, (max(0, ox), max(0, oy)))
		bbox = master.getchannel('A').point(lambda a: 255 if a > 128 else 0).getbbox()
		master.save(OUT / f'{sym}.png')
		master.resize((DETECT, DETECT), Image.LANCZOS).save(OUT / 'detect' / f'{sym}.webp', 'WEBP', quality=95, method=6)
		print(sym, 'rect %.1f %.1f %.1f %.1f' % (x, y, w, h), 'opaque units', tuple(round(v / px, 1) for v in bbox))


if __name__ == '__main__':
	main()
