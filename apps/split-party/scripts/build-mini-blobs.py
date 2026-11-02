"""Small blobs for split tiles (2-6 per tile): their own face set, not the full symbol shrunk.

A split tile used to draw the whole 448px symbol at 0.44-0.55 scale, and from 3 blobs up it
dropped the face entirely (BoardView `units <= 2`). At ~50 css px the painted eyes are a few
pixels wide and the GPU minifies the 448 texture without mipmaps. The minis keep the same
painted bodies but get chibi proportions and art cut for their size:

- eyes 1.32x round their own centres (the live eyes draw them, so only eyes.json changes),
  capped so the pair keeps a gap; brows 1.22x lifted with the eye tops; mouth 1.25x lowered;
- a darker outline ring and a soft contact shadow baked into the base, so overlapping
  siblings separate;
- every texture pre-downsampled with LANCZOS to MINI px. 448 since 2026-10-30: a division
  draws the newborns at their parent's full size (and swells them), where 224 art was blown up
  past its texture and read blurred; the board's textures are mipmapped, so small tiles stay
  clean.

reads  the bases + parts named in src/lib/face-layers.json, src/lib/eyes.json
writes public/symbols/v3/mini/*   src/lib/mini-eyes.json  src/lib/mini-face.json
    python3 apps/split-party/scripts/build-mini-blobs.py [--preview out.png]
"""

import json
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
HD = ROOT / 'public' / 'symbols' / 'v3'
OUT = ROOT / 'public' / 'symbols' / 'v3' / 'mini'
LIB = ROOT / 'src' / 'lib'
MINI = 448
PX = MINI / 100  # texture px per art unit
EYE_K = 1.32
EYE_GAP = 2.5  # min units between the two whites
BROW_K = 1.22
MOUTH_K = 1.25
OUTLINE = 1.6  # units
SHADOW = 0.32


def scale_pts(hull: str, cx: float, cy: float, k: float) -> str:
	out = []
	for p in hull.split(' '):
		x, y = map(float, p.split(','))
		out.append(f'{cx + (x - cx) * k:.1f},{cy + (y - cy) * k:.1f}')
	return ' '.join(out)


def mini_eyes(eyes: list[dict]) -> tuple[list[dict], float, float]:
	"""Eyes grown round their centres; returns (eyes, top growth, bottom growth) in units."""
	k = EYE_K
	if len(eyes) == 2:
		a, b = sorted(eyes, key=lambda e: e['left'])
		gap = b['left'] - a['right']
		wa, wb = a['right'] - a['left'], b['right'] - b['left']
		# gap after scaling = gap - (k-1)(wa+wb)/2 >= EYE_GAP
		k = min(k, 1 + max(0.0, gap - EYE_GAP) * 2 / (wa + wb))
	out, up, down = [], 0.0, 0.0
	for e in eyes:
		cx, cy = (e['left'] + e['right']) / 2, (e['top'] + e['bottom']) / 2
		n = dict(e)
		n['hull'] = scale_pts(e['hull'], cx, cy, k)
		for key, c in (('left', cx), ('right', cx), ('px', cx)):
			n[key] = round(c + (e[key] - c) * k, 2)
		for key in ('top', 'bottom', 'py'):
			n[key] = round(cy + (e[key] - cy) * k, 2)
		n['pr'] = round(e['pr'] * k, 2)
		up = max(up, e['top'] - n['top'])
		down = max(down, n['bottom'] - e['bottom'])
		out.append(n)
	return out, up, down


def part_png(src: str) -> Image.Image:
	return Image.open(ROOT / 'public' / src.removeprefix('./')).convert('RGBA')


def save(im: Image.Image, name: str) -> str:
	path = OUT / name
	im.save(path, quality=92, alpha_quality=100, method=6)
	return f'./symbols/v3/mini/{name}'


def mini_part(sym: str, kind: str, p: dict, k: float, dy: float) -> dict:
	"""A face layer grown round its centre, moved dy units, re-cut at the mini scale."""
	w, h = p['w'] * k, p['h'] * k
	x, y = p['cx'] - (p['cx'] - p['x']) * k, p['cy'] - (p['cy'] - p['y']) * k + dy
	im = part_png(p['src'])
	im = im.resize((max(1, round(w * PX * 1.25)), max(1, round(h * PX * 1.25))), Image.LANCZOS)
	src = save(im, f'{sym}-{kind}.webp')
	r = lambda v: round(v, 2)
	return {'src': src, 'x': r(x), 'y': r(y), 'w': r(w), 'h': r(h), 'cx': r(p['cx']), 'cy': r(p['cy'] + dy)}


def mini_base(sym: str, src: str) -> Image.Image:
	"""The faceless body at MINI px with an outline ring and a contact shadow."""
	body = part_png(src).resize((MINI, MINI), Image.LANCZOS)
	a = body.getchannel('A')
	ring = a.filter(ImageFilter.MaxFilter(2 * round(OUTLINE * PX / 2) + 1))
	# Ring colour: the body's own edge tone, darkened.
	edge = ImageChops.subtract(a, a.filter(ImageFilter.MinFilter(9)))
	px = [body.getpixel((x, y)) for y in range(0, MINI, 2) for x in range(0, MINI, 2) if edge.getpixel((x, y)) > 128]
	r, g, b = (sum(p[i] for p in px) / max(1, len(px)) for i in range(3))
	dark = (round(r * 0.55), round(g * 0.55), round(b * 0.6), 255)
	out = Image.new('RGBA', (MINI, MINI))
	# Contact shadow: a flat ellipse under the feet.
	sh = Image.new('L', (MINI, MINI))
	bbox = a.point(lambda v: 255 if v > 200 else 0).getbbox()
	if bbox:
		x0, y0, x1, y1 = bbox
		ImageDraw.Draw(sh).ellipse((x0 + 6, y1 - 7, x1 - 6, y1 + 5), fill=round(255 * SHADOW))
		sh = sh.filter(ImageFilter.GaussianBlur(3))
	out.paste(Image.new('RGBA', (MINI, MINI), (20, 6, 40, 255)), mask=sh)
	ring_im = Image.new('RGBA', (MINI, MINI), dark)
	ring_im.putalpha(ring.filter(ImageFilter.GaussianBlur(0.6)))
	out.alpha_composite(ring_im)
	out.alpha_composite(body)
	return out


def main():
	OUT.mkdir(parents=True, exist_ok=True)
	eyes = json.loads((LIB / 'eyes.json').read_text())
	faces = json.loads((LIB / 'face-layers.json').read_text())
	m_eyes, m_faces = {}, {}
	for sym, face in faces.items():
		e, up, down = mini_eyes(eyes.get(sym, []))
		if e:
			m_eyes[sym] = e
		base = save(mini_base(sym, face['base']), f'{sym}-base.webp')
		f = {'base': base, 'brows': [], 'mouth': None, 'cheeks': face.get('cheeks', []), 'closed': []}
		for j, b in enumerate(face['brows']):
			f['brows'].append(mini_part(sym, f'brow-{j}', b, BROW_K, -up - 0.6))
		if face.get('mouth'):
			f['mouth'] = mini_part(sym, 'mouth', face['mouth'], MOUTH_K, down * 0.55)
		for j, c in enumerate(face.get('closed', [])):
			f['closed'].append(mini_part(sym, f'closed-{j}', c, EYE_K, 0))
		m_faces[sym] = f
	(LIB / 'mini-eyes.json').write_text(json.dumps(m_eyes, indent='\t') + '\n')
	(LIB / 'mini-face.json').write_text(json.dumps(m_faces, indent='\t') + '\n')
	print(len(m_faces), 'minis ->', OUT.relative_to(ROOT))
	if len(sys.argv) > 2 and sys.argv[1] == '--preview':
		preview(m_faces, m_eyes, faces, eyes, Path(sys.argv[2]))


def draw_face(canvas: Image.Image, face: dict, eyes: list[dict], size: int, ox: int, oy: int):
	k = size / 100
	body = part_png(face['base']).resize((size, size), Image.LANCZOS)
	canvas.alpha_composite(body, (ox, oy))
	d = ImageDraw.Draw(canvas)
	for e in eyes:
		pts = [tuple(map(float, p.split(','))) for p in e['hull'].split(' ')]
		d.polygon([(ox + x * k, oy + y * k) for x, y in pts], fill=e['white'])
		r = e['pr'] * k
		d.ellipse((ox + e['px'] * k - r, oy + e['py'] * k - r, ox + e['px'] * k + r, oy + e['py'] * k + r), fill=e['pupil'])
	for p in face['brows'] + ([face['mouth']] if face['mouth'] else []) + face.get('closed', []):
		im = part_png(p['src']).resize((max(1, round(p['w'] * k)), max(1, round(p['h'] * k))), Image.LANCZOS)
		canvas.alpha_composite(im, (ox + round(p['x'] * k), oy + round(p['y'] * k)))


def preview(m_faces, m_eyes, faces, eyes, path: Path):
	"""Old (shrunk full symbol) vs mini, at the 6-up size a 1920@2 screen shows (~100 px)."""
	S = 100
	syms = list(m_faces)
	sheet = Image.new('RGBA', (len(syms) * S * 3 // 2 + 20, S * 3), (91, 60, 176, 255))
	for i, sym in enumerate(syms):
		x = 10 + i * S * 3 // 2
		old = Image.open(HD / f'{sym}.webp').convert('RGBA').resize((S, S), Image.BILINEAR)
		sheet.alpha_composite(old, (x, 10))
		draw_face(sheet, m_faces[sym], m_eyes.get(sym, []), S, x, S + 40)
	sheet.save(path)


main()
