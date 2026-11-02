"""Mama-2 rigged from the designer's separated vector layers (Figma, 2026-10-30):

  art-src/base/mama-2-layers/body.svg     11399:8003 "without": her body with no face or arms,
                                          drawn in the node's 265x278 box (her whole outline, so
                                          nothing behind a paw has to be painted in)
  art-src/base/mama-2-layers/eye-{L,R}    11399:8103 / 8109: white, iris (+ glint), lid line
  art-src/base/mama-2-layers/brow-{L,R}   11399:8116 / 8117
  art-src/base/mama-2-layers/mouth        11399:8099: the open smile and its tongue
  art-src/base/mama-2-layers/arm-L        11399:8090: the arm hugging her belly
  art-src/base/mama-2-layers/paw-R        11399:8085: her right arm and fist

The face and arm groups sit loose on the Figma canvas; PLACE is where each lands on the body, in
the node's px. They were found by matching each layer to the flat Mama-2 fill (11386:76456,
art-src/base/mama-2.png): the body itself matches that fill at 0,0.

Writes the same rig as build-mama.py (MamaView.ts reads it unchanged): public/base/hd/mama/*.webp
and src/lib/mama.json. The eye layers are split by fill colour: the white, the iris with its
glint, and the lid line with its lashes.
    python3 apps/split-party/scripts/build-mama-layers.py
"""

import io
import json
import re
from pathlib import Path

import cairosvg
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'art-src' / 'base' / 'mama-2-layers'
OUT = ROOT / 'public' / 'base' / 'hd' / 'mama'
OUT_JSON = ROOT / 'src' / 'lib' / 'mama.json'
# Texture px per node px: the flat fill's 1223 px over the node's 265.
K = 1223 / 265
# The rig's units: her visible bounds fitted to this height (MamaView's constants are in them).
BOX_H = 252
PLACE = {
	'eye-L': (105.09, 99.24),
	'eye-R': (171.18, 89.92),
	'brow-L': (116.14, 83.64),
	'brow-R': (170.53, 75.41),
	'mouth': (147.13, 127.84),
	'arm-L': (61.1, 153.19),
	'paw-R': (187.43, 163.59),
}
# The eye layers' fills: the white, the iris and its glint, the lid line and its shadow. A white
# drawn after the iris is its glint (the right eye's), so it moves with it.
EYE_WHITE = {'#FDFDFD'}
EYE_IRIS = {'#460D23', '#450E23', '#B6577F'}
EYE_LASH = {'#630F2C', '#370918'}
MOUTH_DARK = '#630F2C'
MOUTH_TONGUE = '#F52D8D'


def render(svg):
	png = cairosvg.svg2png(bytestring=svg.encode(), scale=K)
	return np.asarray(Image.open(io.BytesIO(png)).convert('RGBA'))


SHAPE = r'<(path|circle|ellipse|rect)\b[^>]*/>'


def fill(m):
	f = re.search(r'fill="(#[0-9A-Fa-f]{6})"', m.group(0))
	return f.group(1).upper() if f else None


def only(svg, fills):
	"""The layer with just the shapes filled in `fills`."""
	return re.sub(SHAPE, lambda m: m.group(0) if fill(m) in fills else '', svg)


def eye_parts(svg):
	"""An eye layer split into its white, its iris (with any white drawn over it) and its lid."""
	seen_iris = False

	def part(m):
		nonlocal seen_iris
		f = fill(m)
		seen_iris |= f in EYE_IRIS
		return 'lash' if f in EYE_LASH else 'iris' if f in EYE_IRIS or (f in EYE_WHITE and seen_iris) else 'white'

	kinds = [part(m) for m in re.finditer(SHAPE, svg)]
	out = {}
	for kind in ('white', 'iris', 'lash'):
		it = iter(kinds)
		out[kind] = re.sub(SHAPE, lambda m: m.group(0) if next(it) == kind else '', svg)
	return out


def dilate(mask, r):
	out = mask.copy()
	for dy in range(-r, r + 1):
		for dx in range(-r, r + 1):
			if dy * dy + dx * dx <= r * r:
				out |= np.roll(np.roll(mask, dy, 0), dx, 1)
	return out


def hull(points):
	pts = sorted(set(map(tuple, points)))
	cross = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
	lo, hi = [], []
	for p in pts:
		while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0:
			lo.pop()
		lo.append(p)
	for p in reversed(pts):
		while len(hi) >= 2 and cross(hi[-2], hi[-1], p) <= 0:
			hi.pop()
		hi.append(p)
	return lo[:-1] + hi[:-1]


def main():
	OUT.mkdir(parents=True, exist_ok=True)
	svg = {p.stem: p.read_text() for p in SRC.glob('*.svg')}
	body = render(svg['body'])
	shape = body.shape[:2]
	# Every layer placed on a canvas the body's size, in texture px.
	layers = {}

	def place(name, rgba):
		x, y = (round(v * K) for v in PLACE[name.split('/')[0]])
		c = np.zeros((*shape, 4), np.uint8)
		h, w = rgba.shape[:2]
		h, w = min(h, shape[0] - y), min(w, shape[1] - x)
		c[y:y + h, x:x + w] = rgba[:h, :w]
		layers[name] = c
		return c

	for side in 'LR':
		for kind, part_svg in eye_parts(svg[f'eye-{side}']).items():
			place(f'eye-{side}/{kind}', render(part_svg))
		place(f'brow-{side}', render(svg[f'brow-{side}']))
	place('mouth/dark', render(only(svg['mouth'], {MOUTH_DARK})))
	place('mouth/tongue', render(only(svg['mouth'], {MOUTH_TONGUE})))
	place('arm-L', render(svg['arm-L']))
	place('paw-R', render(svg['paw-R']))

	whole = Image.fromarray(body)
	for n in ['arm-L', 'paw-R', 'eye-L/white', 'eye-L/iris', 'eye-L/lash', 'eye-R/white', 'eye-R/iris', 'eye-R/lash', 'brow-L', 'brow-R', 'mouth/dark', 'mouth/tongue']:
		whole.alpha_composite(Image.fromarray(layers[n]))
	whole = np.asarray(whole)
	ys, xs = np.nonzero(whole[..., 3] > 128)
	X0, Y0, X1, Y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
	k = BOX_H / (Y1 - Y0)
	box_w = round(float((X1 - X0) * k), 2)
	ux = lambda x: round(float((x - X0) * k), 2)
	uy = lambda y: round(float((y - Y0) * k), 2)
	parts = {}

	def box(m):
		yy, xx = np.nonzero(m)
		return xx.min(), yy.min(), xx.max() + 1, yy.max() + 1

	def save(name, rgba, mask=None):
		m = (rgba[..., 3] > 0) if mask is None else mask & (rgba[..., 3] > 0)
		x0, y0, x1, y1 = box(m)
		crop = rgba[y0:y1, x0:x1].copy()
		crop[~m[y0:y1, x0:x1]] = 0
		Image.fromarray(crop).save(OUT / f'{name}.webp', 'WEBP', quality=92, alpha_quality=100, method=6)
		parts[name] = {'src': f'./base/hd/mama/{name}.webp', 'x': ux(x0), 'y': uy(y0), 'w': ux(x1) - ux(x0), 'h': uy(y1) - uy(y0)}

	def ring_median(img, mask, inner, outer):
		ring = dilate(mask, outer) & ~dilate(mask, inner) & (img[..., 3] > 250)
		return [int(v) for v in np.median(img[ring][:, :3], axis=0)]

	hexc = lambda c: '#%02x%02x%02x' % tuple(int(v) for v in c)
	eyes = []
	for side in 'LR':
		white, iris, lash = (layers[f'eye-{side}/{p}'] for p in ('white', 'iris', 'lash'))
		lash_m = lash[..., 3] > 0
		# The white's path runs out under the lashes' wings: the eye is the white the lid line
		# doesn't cover.
		eye_m = (white[..., 3] > 0) & ~(lash[..., 3] > 200)
		save(f'eye-{side}', white, eye_m)
		save(f'iris-{side}', iris)
		save(f'lash-{side}', lash)
		inside = eye_m | (iris[..., 3] > 128)
		hpts = hull(np.argwhere(inside)[:, ::-1])
		iy, ix = np.nonzero(iris[..., 3] > 128)
		x0, y0, x1, y1 = box(inside)
		eyes.append({
			'side': side,
			'hull': ' '.join(f'{ux(x)},{uy(y)}' for x, y in hpts),
			'cx': ux(ix.mean()), 'cy': uy(iy.mean()),
			'top': uy(y0), 'bottom': uy(y1), 'left': ux(x0), 'right': ux(x1),
			'lid': hexc(ring_median(body, dilate(inside | lash_m, 4), 4, 14)),
			'white': '#fdfdfd',
		})
		save(f'brow-{side}', layers[f'brow-{side}'])
	dark, tongue = layers['mouth/dark'], layers['mouth/tongue']
	save('mouth', dark)
	save('tongue', tongue)
	mm = dark[..., 3] > 128
	save('paw-L', layers['arm-L'])
	save('paw-R', layers['paw-R'])
	save('body', body)
	still = np.asarray(Image.fromarray(whole))
	save('still', still)
	del parts['still']

	paws = {}
	for side, name in (('L', 'arm-L'), ('R', 'paw-R')):
		m = layers[name][..., 3] > 128
		py, px = np.nonzero(m)
		x0, y0, x1, y1 = box(m)
		# L: the hug arm grows out of her left side; R: the arm hangs from her shoulder.
		wrist = (x0 + 0.08 * (x1 - x0), py.mean()) if side == 'L' else (x0 + 0.72 * (x1 - x0), y0 + 0.08 * (y1 - y0))
		paws[side] = {'cx': ux(px.mean()), 'cy': uy(py.mean()), 'wrist': [ux(wrist[0]), uy(wrist[1])]}
	arm = layers['paw-R']
	am = arm[..., 3] > 250
	lum = arm[..., :3].mean(2)
	data = {
		'w': box_w,
		'h': BOX_H,
		'parts': parts,
		'eyes': eyes,
		'mouth': {'cx': ux(np.nonzero(mm)[1].mean()), 'cy': uy(np.nonzero(mm)[0].mean()),
				  'dark': MOUTH_DARK.lower(), 'tongue': MOUTH_TONGUE.lower()},
		'skin': hexc(ring_median(body, dilate(mm, 3), 8, 20)),
		'paws': paws,
		'arm': {
			'skin': hexc(np.median(arm[am & (lum > 120) & (lum < 200)][:, :3], axis=0)),
			'line': hexc(np.median(arm[am & (arm[..., 1] < 70)][:, :3], axis=0)),
		},
	}
	OUT_JSON.write_text(json.dumps(data, indent='\t') + '\n')
	print('mama layers:', ', '.join(parts), f'box {box_w}x{BOX_H}', '->', OUT.relative_to(ROOT))


main()
