"""Mama blob beside the board cut into a rig: Mama-2 (Figma 11386:76456) since 2026-10-30, the
first Mama (11321:47840) before; ARTS holds each one's source and hand-drawn outlines.

art-src/base/<ART src> is the node's source fill. MamaView.ts moves her face:
  public/base/hd/mama/body.webp     the art with eyes, brows and mouth painted over in skin
  public/base/hd/mama/eye-{L,R}     each eye's white (the iris painted out in the white)
  public/base/hd/mama/iris-{L,R}    each iris with its highlights (glances inside the white)
  public/base/hd/mama/lash-{L,R}    the upper lid line + lashes (drops and flips to blink)
  public/base/hd/mama/brow-{L,R}    the brows
  public/base/hd/mama/mouth         the open smile (its tongue cut out)
  public/base/hd/mama/nose          the nose, cut whole from the art and drawn over the mouth (if any)
  public/base/hd/mama/tongue        the tongue, moving inside the mouth
  public/base/hd/mama/paw-{L,R}     her paws (lift to her eyes, clap, pat her belly)
  public/base/hd/mama/still         the cleaned art whole (the DOM fallback)
  src/lib/mama.json                 placements in the node's 230x252 box (stage px), the eye
                                    hulls, and the sampled skin/mouth colours

Features are found by colour on the source: the maroon strokes (irises are full discs, lash
lines thin arcs; brows sit above the whites, the mouth is the big one below), the whites are
the two big near-white shapes. Holes are filled by diffusing the surrounding skin inward.
    python3 apps/split-party/scripts/build-mama.py
"""

import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'base' / 'hd' / 'mama'
OUT_JSON = ROOT / 'src' / 'lib' / 'mama.json'
# Texture px per source px: the full master (1265 px tall). At 0.6 she was ~760 px against ~740
# needed at 1920@2 and ~990 at 2560@2, so she went soft on large screens (user 2026-10-30).
S = 1.0


def components(mask, min_size=200):
	h, w = mask.shape
	seen = np.zeros_like(mask, bool)
	out = []
	for y, x in zip(*np.nonzero(mask)):
		if seen[y, x]:
			continue
		q, pts = deque([(y, x)]), []
		seen[y, x] = True
		while q:
			cy, cx = q.popleft()
			pts.append((cy, cx))
			for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
				if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
					seen[ny, nx] = True
					q.append((ny, nx))
		if len(pts) >= min_size:
			m = np.zeros_like(mask)
			p = np.array(pts)
			m[p[:, 0], p[:, 1]] = True
			out.append(m)
	return sorted(out, key=lambda m: -m.sum())


def dilate(mask, r):
	out = mask.copy()
	for dy in range(-r, r + 1):
		for dx in range(-r, r + 1):
			if dy * dy + dx * dx <= r * r:
				out |= np.roll(np.roll(mask, dy, 0), dx, 1)
	return out


def fill_holes(mask):
	"""The mask plus everything it encloses (flood the outside from the border)."""
	m = Image.fromarray(np.pad(mask, 1).astype(np.uint8) * 255).copy()
	ImageDraw.floodfill(m, (0, 0), 128)
	return (np.asarray(m) != 128)[1:-1, 1:-1]


def hull(points):
	"""Convex hull (monotone chain) of (x, y) points."""
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


def poly_mask(points, shape):
	m = Image.new('L', (shape[1], shape[0]), 0)
	ImageDraw.Draw(m).polygon([tuple(p) for p in points], fill=255)
	return np.asarray(m) > 0


def inpaint(rgb, hole, passes=60, src_ok=None):
	"""Fill `hole` by repeatedly averaging known 4-neighbours inward, then soften it. Only
	`src_ok` pixels feed it (skin, not her dots: a dot beside a hole smeared into it)."""
	orig = rgb
	rgb = rgb.astype(float).copy()
	known = ~hole if src_ok is None else ~hole & src_ok
	while not known.all():
		acc = np.zeros_like(rgb)
		cnt = np.zeros(hole.shape)
		for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
			k = np.roll(np.roll(known, dy, 0), dx, 1)
			acc += np.roll(np.roll(rgb, dy, 0), dx, 1) * k[..., None]
			cnt += k
		grow = ~known & (cnt > 0)
		if not grow.any():
			break
		rgb[grow] = acc[grow] / cnt[grow][:, None]
		known |= grow
	for _ in range(passes):
		blur = sum(np.roll(np.roll(rgb, dy, 0), dx, 1) for dy in (-2, 0, 2) for dx in (-2, 0, 2)) / 9
		rgb[hole] = blur[hole]
	rgb[~hole] = orig[~hole]
	return rgb


def unblend(rgba, core, r, skin):
	"""A stroke cut with no skin round it: `core` as painted, then an r px fringe in the stroke's
	edge colour whose alpha is how far each pixel has moved from `skin` toward it. A plain
	dilated cut carries a ring of the original skin, which shows as a halo over the painted-over
	body (and moves with the part)."""
	ring = dilate(core, r) & ~core
	edge = core & dilate(~core, 2)
	d = np.median(rgba[edge][:, :3], axis=0)
	sk = np.asarray(skin, float)
	v = d - sk
	t = ((rgba[..., :3] - sk) @ v) / max(1.0, float(v @ v))
	out = rgba.copy()
	out[ring, :3] = d.astype(int)
	out[ring, 3] = (np.clip(t[ring], 0, 1) * rgba[ring, 3]).astype(int)
	return out, core | ring


# Per art: the source, the box her visible bounds are fitted to (stage px of the Figma node's art),
# and what is outlined by hand on the source (px):
#   paws   each fist up to where it meets the arm (only a bound: the paw is the area inside its own
#          dark rim), and the wrist the fist melts into its arm from; 'R' is her whole right arm
#   side   her right side behind the right arm: a cubic from above her shoulder, across the V where
#          the arm met it (that notch read as a cut: user, 2026-10-27), down behind the arm to just
#          below the fist; the arm (MamaView's mesh, pinned at its top) is in front
#   nose   centre and half-sizes, a little past its rim (None: she has none)
ARTS = {
	# The first Mama (Figma 11321:47840): the node's 1244x1265 fill.
	'mama': {
		'src': 'mama.png',
		'box': (230, 252),
		'side': ((1105, 600), (1116, 700), (1086, 900), (1042, 975)),
		'nose': (775, 536, 35, 21),
		'paws': {
			'L': {'poly': [(530, 750), (610, 742), (680, 752), (712, 785), (724, 830), (720, 880), (700, 905), (640, 915), (560, 912), (525, 880), (520, 800)],
				  'wrist': (528, 832)},
			'R': {'poly': [(900, 800), (940, 745), (1000, 720), (1060, 690), (1090, 668), (1135, 668), (1210, 700), (1210, 965), (1100, 965), (980, 950), (900, 880)],
				  'wrist': (1128, 772)},
		},
	},
	# Mama-2 (Figma 11386:76456, the design's pick since 2026-10-30, user: "this is better mama
	# blob"): the node's 1223x1286 fill, her visible 957x1083 fitted to 223x252.
	'mama-2': {
		'src': 'mama-2.png',
		'box': (223, 252),
		'side': ((1055, 660), (1066, 760), (1062, 910), (993, 1000)),
		'nose': None,
		'paws': {
			'L': {'poly': [(522, 772), (560, 752), (620, 740), (668, 752), (702, 800), (704, 860), (684, 908), (642, 948), (580, 962), (528, 952), (512, 880), (512, 800)],
				  'wrist': (516, 870)},
			'R': {'poly': [(866, 812), (895, 775), (955, 758), (1000, 752), (1024, 748), (1060, 758), (1102, 830), (1104, 950), (1060, 1000), (990, 1004), (925, 985), (875, 940), (858, 870)],
				  'wrist': (1040, 760)},
		},
	},
}
ART = ARTS['mama-2']
SRC = ROOT / 'art-src' / 'base' / ART['src']
BOX_W, BOX_H = ART['box']
PAW_RIM = 18
PAW_FADE = 40
PAW_ARM = 90
SIDE_FROM, SIDE_C1, SIDE_C2, SIDE_TO = ART['side']
SIDE_LINE = 11
NOSE = ART['nose']
PAWS = ART['paws']


def main():
	OUT.mkdir(parents=True, exist_ok=True)
	art = np.asarray(Image.open(SRC).convert('RGBA')).astype(int)
	a = art[..., 3].copy()
	# The source is ~253 alpha all over with stray red specks round it: opaque body, no specks.
	a[a < 8] = 0
	a[a >= 245] = 255
	body = components(a > 128, 1000)[0]
	a[~dilate(body, 4)] = 0
	art[..., 3] = a
	r, g, b = art[..., 0], art[..., 1], art[..., 2]
	ys, xs = np.nonzero(a > 128)
	X0, Y0, X1, Y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
	kx, ky = BOX_W / (X1 - X0), BOX_H / (Y1 - Y0)
	ux = lambda x: round(float((x - X0) * kx), 2)
	uy = lambda y: round(float((y - Y0) * ky), 2)

	solid = a > 200
	dark = solid & (r < 150) & (g < 80) & (b < 100)
	white = solid & (r > 230) & (g > 222) & (b > 222)
	whites = sorted(components(white, 3000)[:2], key=lambda m: np.nonzero(m)[1].mean())
	# Mama-2's right brow is ~1400 px.
	darks = components(dark, 1000)
	assert len(whites) == 2, 'expected two eye whites'

	def box(m):
		yy, xx = np.nonzero(m)
		return xx.min(), yy.min(), xx.max() + 1, yy.max() + 1

	def fill_ratio(m):
		x0, y0, x1, y1 = box(m)
		return m.sum() / ((x1 - x0) * (y1 - y0))

	used = set()
	eyes = []
	for side, wm in zip('LR', whites):
		wx0, wy0, wx1, wy1 = box(wm)
		near = [i for i, m in enumerate(darks) if i not in used and (lambda c: wx0 - 40 < c[0] < wx1 + 40 and wy0 - 60 < c[1] < wy1)(
			(np.nonzero(m)[1].mean(), np.nonzero(m)[0].mean()))]
		iris_i = max((i for i in near if fill_ratio(darks[i]) > 0.5), key=lambda i: darks[i].sum())
		lash_i = max((i for i in near if i != iris_i and fill_ratio(darks[i]) <= 0.5), key=lambda i: darks[i].sum())
		used |= {iris_i, lash_i}
		eyes.append((side, wm, darks[iris_i], darks[lash_i]))
	ey_top = min(box(wm)[1] for _, wm, _, _ in eyes)
	ey_bot = max(box(wm)[3] for _, wm, _, _ in eyes)
	rest = [m for i, m in enumerate(darks) if i not in used]
	brows = sorted([m for m in rest if np.nonzero(m)[0].mean() < ey_top + 20][:2], key=lambda m: np.nonzero(m)[1].mean())
	mouth = max((m for m in rest if np.nonzero(m)[0].mean() > ey_bot - 40), key=lambda m: m.sum())
	assert len(brows) == 2, 'expected two brows'

	shape = a.shape
	hole = np.zeros(shape, bool)
	parts = {}

	def save(name, rgba, mask):
		m = mask & (rgba[..., 3] > 0)
		x0, y0, x1, y1 = box(m)
		crop = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
		region = m[y0:y1, x0:x1]
		crop[region] = rgba[y0:y1, x0:x1][region]
		im = Image.fromarray(crop)
		im = im.resize((max(1, round(im.width * S)), max(1, round(im.height * S))), Image.LANCZOS)
		im.save(OUT / f'{name}.webp', 'WEBP', quality=92, alpha_quality=100, method=6)
		parts[name] = {'src': f'./base/hd/mama/{name}.webp', 'x': ux(x0), 'y': uy(y0), 'w': ux(x1) - ux(x0), 'h': uy(y1) - uy(y0)}

	def ring_median(mask, inner, outer):
		ring = dilate(mask, outer) & ~dilate(mask, inner) & solid & ~dark & ~white
		return [int(v) for v in np.median(art[ring][:, :3], axis=0)]

	eye_json = []
	for side, wm, iris, lash in eyes:
		disc = dilate(fill_holes(iris), 4)
		lash_m = dilate(lash, 2) & ~disc
		hpts = hull(np.argwhere(wm | fill_holes(iris))[:, ::-1])
		inside = poly_mask(hpts, shape)
		eye_m = dilate(inside, 2) & ~lash
		white_rgb = [int(v) for v in np.median(art[wm][:, :3], axis=0)]
		eye_rgba = art.copy()
		eye_rgba[disc & ~lash_m, :3] = white_rgb
		eye_rgba[disc & ~lash_m, 3] = 255
		save(f'eye-{side}', eye_rgba, eye_m)
		save(f'iris-{side}', art, disc & ~lash_m)
		# Painted over well past the parts: the lower lid line and the lashes' anti-aliasing.
		all_m = dilate(poly_mask(hull(np.argwhere(inside | lash_m)[:, ::-1]), shape), 7)
		lid = ring_median(all_m, 6, 16)
		save(f'lash-{side}', *unblend(art, lash, 4, lid))
		hole |= all_m
		iy, ix = np.nonzero(iris)
		eye_json.append({
			'side': side,
			'hull': ' '.join(f'{ux(x)},{uy(y)}' for x, y in hpts),
			'cx': ux(ix.mean()), 'cy': uy(iy.mean()),
			'top': uy(box(inside)[1]), 'bottom': uy(box(inside)[3]),
			'left': ux(box(inside)[0]), 'right': ux(box(inside)[2]),
			'lid': '#%02x%02x%02x' % tuple(lid),
			'white': '#%02x%02x%02x' % tuple(white_rgb),
		})
	for side, m in zip('LR', brows):
		save(f'brow-{side}', *unblend(art, m, 4, ring_median(m, 6, 14)))
		hole |= dilate(m, 5)
	# The nose, straight from the art and drawn over everything round it (the mouth's repaint and
	# a laughing mouth both reached it: user, "nose is wrong ... see design").
	if NOSE:
		nose_img = Image.new('L', (shape[1], shape[0]), 0)
		ImageDraw.Draw(nose_img).ellipse([NOSE[0] - NOSE[2], NOSE[1] - NOSE[3], NOSE[0] + NOSE[2], NOSE[1] + NOSE[3]], fill=255)
		nose_a = np.asarray(nose_img.filter(ImageFilter.GaussianBlur(2))) / 255
		nose_art = art.copy()
		nose_art[..., 3] = (nose_art[..., 3] * nose_a).astype(int)
		save('nose', nose_art, nose_a > 0.01)
		# ...and painted out of the body, or the two noses part as she leans (user: "2 noses?").
		hole |= dilate(nose_a > 0.01, 3)
	# The mouth's shape: the dark inside and what it holds. Mama-2's tongue rests on her lower lip,
	# outside the dark, so a tongue-red shape touching it counts as the mouth too.
	lip = [m for m in components(solid & (r > 180) & (g < 100) & (b < 135) & ~mouth, 200) if (m & dilate(mouth, 3)).any()]
	mouth_shape = fill_holes(mouth | np.logical_or.reduce(lip)) if lip else fill_holes(mouth)
	mm = dilate(mouth_shape, 3)
	mouth_dark = [int(v) for v in np.median(art[mouth][:, :3], axis=0)]
	inner = mouth_shape & ~mouth & solid
	tongue = [int(v) for v in np.median(art[inner & (r > 180) & (g < 140)][:, :3], axis=0)]
	# The tongue is its own part, so it can move inside the mouth (MamaView masks it to the mouth);
	# the mouth behind it is the dark inside.
	tm = components(inner & (r > 180) & (g < 140), 200)[0]
	tm_cut = dilate(tm, 2) & mouth_shape
	save('tongue', art, tm_cut)
	mouth_art = art.copy()
	mouth_art[dilate(tm, 3) & mouth_shape & ~mouth, :3] = mouth_dark
	save('mouth', *unblend(mouth_art, mouth_shape, 4, ring_median(mm, 6, 16)))
	hole |= dilate(poly_mask(hull(np.argwhere(mm)[:, ::-1]), shape), 6)

	# Her right side is hidden behind the right paw (the paw overlaps her outline). Lifted, the paw
	# would show a gap, and a hull or the old bulge both read as a cut (user, 2026-10-27): the side
	# is redrawn as a smooth curve behind the paw, with its outline, and the paw is a whole object
	# in front of it.
	(sx0, sy0), (sx1, sy1) = SIDE_FROM, SIDE_TO
	ts = np.linspace(0, 1, 400)
	bez = [((1 - t) ** 3 * np.array(SIDE_FROM) + 3 * (1 - t) ** 2 * t * np.array(SIDE_C1) + 3 * (1 - t) * t * t * np.array(SIDE_C2) + t ** 3 * np.array(SIDE_TO)) for t in ts]
	side_x = np.interp(np.arange(shape[0]), [q[1] for q in bez], [q[0] for q in bez])
	rows = (np.arange(shape[0]) >= sy0) & (np.arange(shape[0]) <= sy1)
	xs_grid = np.arange(shape[1])[None, :]
	past = rows[:, None] & (xs_grid > side_x[:, None])
	side_a = np.clip(side_x[:, None] + 0.5 - xs_grid, 0, 1)
	side_line = rows[:, None] & (xs_grid > side_x[:, None] - SIDE_LINE) & ~past

	paws = {}
	line = solid & (g < 70)
	yy, xx = np.mgrid[:shape[0], :shape[1]]

	def fade_from(cut, width):
		"""1 past `width` px from `cut`, ramping to 0 on it."""
		f = np.ones(shape)
		reach = cut.copy()
		for step in range(1, width // 2 + 1):
			ring = dilate(reach, 2) & ~reach
			f[ring] = step * 2 / width
			reach |= ring
		f[cut] = 0
		return f

	for side, p in PAWS.items():
		bound = poly_mask(p['poly'], shape)
		poly = bound & (a > 0)
		# The polygon is only a bound: the paw is the fist inside its own dark rim, so no patch
		# of belly (or a dot) rides along with it (user, 2026-10-27: "hands are still like cut").
		fist = components(poly & ~line, 2000)[0]
		pm = fill_holes(fist | (dilate(fist, PAW_RIM) & line)) & poly
		# Where the fist runs on into her arm the polygon cuts it straight across: that end fades
		# out over PAW_FADE px, so the paw melts into the arm left on the body (only at the arm).
		# The right paw has no arm end: it's whole, over her redrawn side.
		cut = pm & dilate(~bound, 1) & fist
		cut &= (xx - p['wrist'][0]) ** 2 + (yy - p['wrist'][1]) ** 2 < PAW_ARM ** 2
		if side == 'R':
			cut &= False
		fade = fade_from(cut, PAW_FADE)
		paw = art.copy()
		paw[..., 3] = (paw[..., 3] * fade).astype(int)
		save(f'paw-{side}', paw, pm & (fade > 0))
		# Under the paw the body is repainted, outlines round it too (pink only); the faded arm
		# end keeps the original art, so at rest she is unchanged and moved the arm just stretches.
		core = pm & (fade >= 1) & ~dilate(cut, PAW_FADE // 2)
		hole |= dilate(core, 2) | (dilate(core, 14) & solid & (r < 235) & (r > 150) & (b > 60) & ~dilate(cut, PAW_FADE))
		if side == 'R':
			# The whole arm, its faded neck too: the old neck outline would show as a line when lifted.
			hole |= dilate(pm, 4) & solid & (r > 150) & (b > 60)
		py, px = np.nonzero(pm)
		paws[side] = {'cx': ux(px.mean()), 'cy': uy(py.mean()), 'wrist': [ux(p['wrist'][0]), uy(p['wrist'][1])]}
	paw_all = poly_mask(PAWS['L']['poly'], shape) | poly_mask(PAWS['R']['poly'], shape)
	lum = art[..., :3].mean(2)
	# The arm's colours: the paws' body pink, their dark-pink outline and their gloss.
	arm_skin = np.median(art[paw_all & solid & (lum > 120) & (lum < 200) & (r > 200)][:, :3], axis=0)
	arm_line = np.median(art[paw_all & solid & (r > 140) & (g < 60) & (b > 60)][:, :3], axis=0)
	arm_gloss = np.median(art[paw_all & solid & (lum > 215)][:, :3], axis=0)
	hexc = lambda c: '#%02x%02x%02x' % tuple(int(v) for v in c)

	base = art.copy()
	# Behind the right paw: everything inside the new side that was paw or old outline is refilled.
	# (and the notch at her shoulder, inside the new side, is filled out to it).
	notch = rows[:, None] & ~past & (a < 250) & (xs_grid > side_x[:, None] - 80)
	hole = (hole & solid) | notch | (rows[:, None] & (xs_grid > side_x[:, None] - SIDE_LINE - 30) & ~past & dilate(poly_mask(PAWS['R']['poly'], shape), 30) & (((r > 200) & (b > 100)) | line | (a < 250)))
	# Above the arm, the old outline running in to the shoulder's V: only its line is repainted, so
	# a dot beside it stays whole.
	hole |= rows[:, None] & ~past & (xs_grid > side_x[:, None] - 70) & line & (yy < min(q[1] for q in PAWS['R']['poly']) + 20)
	# Transparent pixels are black: as inpaint sources they'd smudge her edge dark.
	src = art[..., :3].copy()
	src[a == 0] = arm_line.astype(int)
	base[..., :3] = inpaint(src, hole, src_ok=(a == 0) | ((r > 200) & (b > 100)))
	base[notch, 3] = 255
	base[..., 3] = np.where(rows[:, None], (base[..., 3] * np.where(past, side_a, 1)).astype(int), base[..., 3])
	base[side_line & (base[..., 3] > 0), :3] = arm_line.astype(int)
	save('body', base, base[..., 3] > 0)
	# The whole art, for the DOM fallback (PixiMama.svelte); not part of the rig.
	save('still', art, a > 0)
	del parts['still']
	skin = ring_median(mm, 8, 20)
	data = {
		'w': BOX_W,
		'h': BOX_H,
		'parts': parts,
		'eyes': eye_json,
		'mouth': {'cx': ux(np.nonzero(mm)[1].mean()), 'cy': uy(np.nonzero(mm)[0].mean()),
				  'dark': '#%02x%02x%02x' % tuple(mouth_dark), 'tongue': '#%02x%02x%02x' % tuple(tongue)},
		'skin': '#%02x%02x%02x' % tuple(skin),
		'paws': paws,
		'arm': {'skin': hexc(arm_skin), 'line': hexc(arm_line), 'gloss': hexc(arm_gloss)},
	}
	OUT_JSON.write_text(json.dumps(data, indent='\t') + '\n')
	print('mama:', ', '.join(parts), '->', OUT.relative_to(ROOT))


main()
