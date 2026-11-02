"""Jelly digits for the win amounts: public/digits/*.webp + src/lib/digits.json.

User, 2026-10-27: the amounts should use the glossy yellow jelly numbers they pasted
(art-src/digits/sheet-0-5.png, a Figma canvas screenshot with its pixel grid on), "here are just
to 5 but you can create similar". So:
  0-5             cut from that sheet (the canvas grid divided back out),
  6-9 . , $ x     drawn here in the same layers, on Lilita One's outlines rounded off:
                  red-orange outline, orange rim, gold bevel, face gradient, the extrusion under it
                  and a white gloss crescent top-left (colours measured off the sheet's 0).
Every glyph is saved at the same scale: CAP px from the top of a digit to the bottom of its face.
Run from the app dir: python3 scripts/build-digits.py  (--compare also draws 0-5, for tuning)
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SHEET = ROOT / 'art-src' / 'digits' / 'sheet-0-5.png'
FONT = ROOT / 'public' / 'fonts' / 'lilita-one.ttf'
OUT = ROOT / 'public' / 'digits' / 'v2'  # v2: the 200px set (new folder busts the cache)
OUT_JSON = ROOT / 'src' / 'lib' / 'digits.json'

# The sheet: grid lines darken 245 -> 232; the digits sit 80..320 px, 0-5 left to right.
GRID_K = 232 / 245
BG = 245
# Output: glyph height (top of a digit to the bottom of its extrusion) in px.
# 200 since 2026-11-02 (the plaque draws them up to 84 stage px, ~170-225 device px; 120 was
# upscaled). The sheet's digits are ~232 tall, so 0-5 are still downscaled.
OUT_H = 200

# Measured on the sheet's 0 (px at sheet scale, digit ~232 tall).
C_OUTLINE = (226, 92, 42)
C_RIM = (230, 138, 48)
C_BEVEL = (238, 178, 60)
C_TOP = (249, 234, 108)
C_BOTTOM = (242, 188, 67)
C_EXTRUDE = (231, 102, 45)
C_EXTRUDE_EDGE = (222, 84, 40)
C_GLOSS = (252, 250, 236)
SS = 2  # supersampling for the drawn glyphs
WIDEN = 1.12
ROUND = 9  # corner rounding (blur px at 1x)


def cut_sheet():
	"""The sheet's six digits as RGBA arrays, grid removed, background keyed out."""
	im = np.asarray(Image.open(SHEET).convert('RGB')).astype(float)
	lum = im.mean(2)
	rows = np.nonzero(lum[:, :20].mean(1) < 240)[0]
	cols = np.nonzero(lum[:40].mean(0) < 240)[0]
	line = np.zeros(lum.shape, bool)
	line[rows] = True
	line[:, cols] = True
	im[line] /= GRID_K
	im = np.clip(im, 0, 255)
	sat = im.max(2) - im.min(2)
	ink = sat > 30
	# Background = near-neutral light pixels joined to the sheet's border or big enough to be a
	# counter (0's and 4's holes); the white gloss inside a digit is small and stays.
	bgish = (sat < 14) & (im.mean(2) > 232)
	from collections import deque
	h, w = bgish.shape
	lab = np.zeros((h, w), int)
	n = 0
	sizes = {}
	for y0, x0 in zip(*np.nonzero(bgish)):
		if lab[y0, x0]:
			continue
		n += 1
		q = deque([(y0, x0)])
		lab[y0, x0] = n
		cnt = 0
		while q:
			y, x = q.popleft()
			cnt += 1
			for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
				if 0 <= ny < h and 0 <= nx < w and bgish[ny, nx] and not lab[ny, nx]:
					lab[ny, nx] = n
					q.append((ny, nx))
		sizes[n] = cnt
	big = np.array([False] + [sizes[i] >= 400 for i in range(1, n + 1)], bool)
	bg = big[lab]
	# Edge alpha: how far a pixel is from the background towards the outline colour (blue
	# channel carries it: 245 bg vs ~42 outline), only on the ring next to the background.
	near = np.asarray(Image.fromarray(bg.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(5))) > 0
	alpha = np.ones((h, w))
	ring = near & ~bg
	alpha[ring] = np.clip((BG - im[..., 2][ring]) / (BG - 60), 0, 1)
	alpha[bg] = 0
	rgb = im.copy()
	a3 = np.maximum(alpha, 1e-3)[..., None]
	rgb = np.where(ring[..., None], np.clip((im - (1 - a3) * BG) / a3, 0, 255), rgb)
	rgba = np.dstack([rgb, alpha * 255]).astype(np.uint8)
	cols = np.nonzero(ink.any(0))[0]
	runs, s, p = [], cols[0], cols[0]
	for c in cols[1:]:
		if c > p + 3:
			runs.append((s, p))
			s = c
		p = c
	runs.append((s, p))
	assert len(runs) == 6, runs
	rws = np.nonzero(ink.any(1))[0]
	top, bottom = rws.min(), rws.max() + 1
	return [rgba[top - 2:bottom + 2, x0 - 2:x1 + 3] for x0, x1 in runs], bottom - top + 4


def fill_holes(mask):
	m = Image.fromarray(np.pad(mask, 1).astype(np.uint8) * 255)
	ImageDraw.floodfill(m, (0, 0), 128)
	return (np.asarray(m) != 128)[1:-1, 1:-1]


def erode_count(mask, n):
	"""Per pixel, how many 3x3 erosions it survives (capped at n): a cheap inside distance."""
	d = np.zeros(mask.shape)
	m = Image.fromarray(mask.astype(np.uint8) * 255)
	for i in range(n):
		arr = np.asarray(m) > 127
		if not arr.any():
			break
		d[arr] = i + 1
		m = m.filter(ImageFilter.MinFilter(3))
	return d


def dil(mask, r):
	return np.asarray(Image.fromarray(mask.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(2 * r + 1))) > 127


def ero(mask, r):
	return np.asarray(Image.fromarray(mask.astype(np.uint8) * 255).filter(ImageFilter.MinFilter(2 * r + 1))) > 127


def shift(mask, dx, dy):
	out = np.zeros_like(mask)
	h, w = mask.shape
	out[max(0, dy):h + min(0, dy), max(0, dx):w + min(0, dx)] = mask[max(0, -dy):h - max(0, dy), max(0, -dx):w - max(0, dx)]
	return out


def soft(mask, r):
	return np.asarray(Image.fromarray(mask.astype(np.uint8) * 255).filter(ImageFilter.GaussianBlur(r))) / 255.0


def draw(ch, cap):
	"""One glyph in the sheet's style; `cap` = the sheet's digit face height (px, at 1x)."""
	k = SS
	face_h = cap * 0.86 * k  # face; the rest of the height is extrusion
	font = ImageFont.truetype(str(FONT), int(face_h * 1.45))
	ref = font.getbbox('0')
	scale = face_h / (ref[3] - ref[1])
	font = ImageFont.truetype(str(FONT), int(face_h * 1.45 * scale))
	ref = font.getbbox('0')
	pad = int(40 * k)
	bb = font.getbbox(ch)
	W = bb[2] - bb[0] + 2 * pad
	H = int(ref[3] - ref[1] + 2 * pad + cap * 0.2 * k)
	img = Image.new('L', (W, H), 0)
	ImageDraw.Draw(img).text((pad - bb[0], pad - ref[1]), ch, font=font, fill=255)
	# The sheet's digits are rounder and wider than Lilita's: corners rounded off, a little wider.
	img = img.resize((int(W * WIDEN), H), Image.LANCZOS)
	W = img.width
	S0 = np.asarray(img) > 127
	S = np.asarray(img.filter(ImageFilter.GaussianBlur(ROUND * k))) > 128
	# Rounding that hard would close the counters (6, 8, 9): they keep their own, softer rounding.
	holes = fill_holes(S0) & ~S0
	S &= ~(soft(holes, ROUND * k / 2) > 0.35)
	S = soft(S, 2 * k) > 0.5
	u = lambda px: max(1, int(round(px * k * cap / 232)))
	d = erode_count(S, u(16))
	g = soft(S, 6 * k)
	gy, gx = np.gradient(g)
	norm = np.hypot(gx, gy) + 1e-6
	nx, ny = -gx / norm, -gy / norm  # outward normal
	# Thin on top, thick underneath, like the sheet's.
	ext = dil(S, u(2)) | shift(S, 0, u(5)) | shift(S, u(1), u(10))
	outline = dil(ext, u(1))
	rgb = np.zeros((H, W, 3))
	alpha = np.zeros((H, W))
	rgb[outline] = C_OUTLINE
	alpha[outline] = 1
	inner_ext = ero(ext, u(2)) & ~S
	rgb[inner_ext] = C_EXTRUDE
	edge_e = inner_ext & ~ero(ext, u(5))
	rgb[edge_e] = C_EXTRUDE_EDGE
	ys = np.nonzero(S.any(1))[0]
	yrel = np.clip((np.arange(H) - ys.min()) / max(1, ys.max() - ys.min()), 0, 1)[:, None]
	face = np.array(C_TOP) * (1 - yrel[..., None]) + np.array(C_BOTTOM) * yrel[..., None]
	face = np.broadcast_to(face, (H, W, 3)).copy()
	# Bevel and rim, stronger where the edge faces down (the jelly's thick underside).
	down = np.clip(ny, 0, 1)
	tb = np.clip(1 - (d - 1) / u(10), 0, 1) * (0.45 + 0.55 * down)
	face = face * (1 - tb[..., None]) + np.array(C_BEVEL) * tb[..., None]
	tr = np.clip(1 - (d - 1) / u(4), 0, 1) * (0.25 + 0.75 * down)
	face = face * (1 - tr[..., None]) + np.array(C_RIM) * tr[..., None]
	rgb[S] = face[S]
	alpha[S] = 1
	# Gloss: a crescent along the top-left inside the edge, and a small one bottom-right.
	core = ero(S, u(8))
	cres = core & ~shift(core, u(4), u(6))
	cres &= (nx < 0.55) & (ny < 0.35)
	gl = soft(cres, 0.9 * k) * 0.95
	spot = core & ~shift(core, -u(4), -u(6))
	spot &= (ny > 0.4) & (nx > 0.2)
	gl = np.maximum(gl, soft(spot, 1.2 * k) * 0.8)
	gl *= S
	rgb = rgb * (1 - gl[..., None]) + np.array(C_GLOSS) * gl[..., None]
	# Antialiased edge: downsample the supersampled art.
	a_img = Image.fromarray((alpha * 255).astype(np.uint8))
	pre = (rgb * alpha[..., None]).astype(np.uint8)
	rgba = Image.fromarray(np.dstack([pre, (alpha * 255).astype(np.uint8)]), 'RGBA')
	rgba = rgba.resize((W // k, H // k), Image.LANCZOS)
	arr = np.asarray(rgba).astype(float)
	a = arr[..., 3:4] / 255
	arr[..., :3] = np.clip(arr[..., :3] / np.maximum(a, 1e-3), 0, 255)
	arr = arr.astype(np.uint8)
	ys, xs = np.nonzero(arr[..., 3] > 8)
	top = int(np.nonzero(ero(S, 0).any(1))[0].min() // k)
	return arr[top - 2:ys.max() + 3, xs.min() - 2:xs.max() + 3]


def main():
	OUT.mkdir(parents=True, exist_ok=True)
	sheet, cap_h = cut_sheet()
	cap = cap_h - 4
	glyphs = {str(i): g for i, g in enumerate(sheet)}
	drawn = list('6789') + ['.', ',', '$', 'x']
	if '--compare' in sys.argv:
		drawn = list('0123456789')
	made = {ch: draw(ch, cap) for ch in drawn}
	if '--compare' in sys.argv:
		row = lambda gs: np.concatenate([np.pad(g, ((0, cap_h + 40 - g.shape[0]), (6, 6), (0, 0))) for g in gs], 1)
		a = row(sheet)
		b = row([made[c] for c in '0123456789'])
		wmax = max(a.shape[1], b.shape[1])
		a = np.pad(a, ((0, 0), (0, wmax - a.shape[1]), (0, 0)))
		b = np.pad(b, ((0, 0), (0, wmax - b.shape[1]), (0, 0)))
		im = Image.fromarray(np.concatenate([a, b], 0))
		bg = Image.new('RGBA', im.size, (60, 30, 120, 255))
		bg.alpha_composite(im)
		bg.save(sys.argv[-1])
		return
	# Drawn to the real digits' height: a drawn 0 against the sheet's.
	fit = sheet[0].shape[0] / draw('0', cap).shape[0]
	for ch, g in made.items():
		im = Image.fromarray(g)
		made[ch] = np.asarray(im.resize((round(im.width * fit), round(im.height * fit)), Image.LANCZOS))
	glyphs.update(made)
	names = {'.': 'dot', ',': 'comma', '$': 'dollar', 'x': 'times'}
	k = OUT_H / cap_h
	meta = {'h': OUT_H, 'glyphs': {}}
	for ch, g in glyphs.items():
		im = Image.fromarray(g)
		im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
		name = names.get(ch, ch)
		im.save(OUT / f'{name}.webp', 'WEBP', quality=90, alpha_quality=100, method=6)
		meta['glyphs'][ch] = {'src': f'./digits/v2/{name}.webp', 'w': im.width, 'h': im.height}
		print(ch, im.size)
	OUT_JSON.write_text(json.dumps(meta, indent='\t') + '\n')


main()
