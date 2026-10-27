"""Cut each symbol's painted brows and mouth into their own layers so Blob.svelte can move them.

public/symbols/hd/<S>.webp (untouched; build-symbols.py)
  -> public/symbols/hd/face/<S>-base.webp    the art with brows + mouth painted over in body colour
  -> public/symbols/hd/face/<S>-brow-N.webp  each brow, cropped
  -> public/symbols/hd/face/<S>-mouth.webp   the mouth (with tongue), cropped
  -> src/lib/face-layers.json             crops in the symbol's 100x100 unit box

Features are the dark strokes on the face outside the eyes (eyes.json from build-eyes.py):
brows sit above the eye tops, the mouth is the biggest dark shape below them. The holes are
filled by diffusing the surrounding body pixels inward, which keeps the body's shading.

The features are found on the old 224px art (art-src/symbols/detect/, the same masters scaled
down), where every threshold here was tuned: at 448 the faint anti-aliased strokes pass them
too (APPLE's eyelids read as brows), and even a fresh 224px resample flips a few. The masks
found there are scaled up and the layers cut from the full-size art, so the parts are the old
set's.
    python3 apps/split-party/scripts/build-face-layers.py
"""

import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SYMBOLS = ROOT / 'public' / 'symbols' / 'hd'
OUT_DIR = SYMBOLS / 'face'
EYES = json.loads((ROOT / 'src' / 'lib' / 'eyes.json').read_text())
OUT_JSON = ROOT / 'src' / 'lib' / 'face-layers.json'
# The scatter egg has no painted face.
SKIP = {'BASKET'}
DETECT_DIR = ROOT / 'art-src' / 'symbols' / 'detect'


def label(mask):
    h, w = mask.shape
    lab = np.zeros((h, w), int)
    n = 0
    for y, x in zip(*np.nonzero(mask)):
        if lab[y, x]:
            continue
        n += 1
        lab[y, x] = n
        q = deque([(y, x)])
        while q:
            cy, cx = q.popleft()
            for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = n
                    q.append((ny, nx))
    return lab, n


def dilate(mask, r):
    out = mask.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dy * dy + dx * dx <= r * r:
                out |= np.roll(np.roll(mask, dy, 0), dx, 1)
    return out


def hull_mask(points, shape):
    m = Image.new('L', (shape[1], shape[0]), 0)
    ImageDraw.Draw(m).polygon(points, fill=255)
    return np.asarray(m) > 0


def inpaint(rgb, hole, passes=6):
    """Fill `hole` by repeatedly averaging known 4-neighbours inward."""
    rgb = rgb.astype(float).copy()
    known = ~hole
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
    # Soften the diffusion streaks a little inside the hole only.
    for _ in range(passes):
        blur = sum(np.roll(np.roll(rgb, dy, 0), dx, 1) for dy in (-1, 0, 1) for dx in (-1, 0, 1)) / 9
        rgb[hole] = blur[hole]
    return rgb


def up(mask, shape):
    """A detection-size mask at the art's size: smooth edges, cut at half."""
    m = Image.fromarray((mask * 255).astype(np.uint8)).resize((shape[1], shape[0]), Image.BILINEAR)
    return np.asarray(m) >= 128


def layer(a, mask, k, name):
    ys, xs = np.nonzero(mask)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    crop = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    region = mask[y0:y1, x0:x1]
    crop[region] = a[y0:y1, x0:x1][region]
    Image.fromarray(crop).save(OUT_DIR / name, 'WEBP', quality=92, method=6)
    return {
        'src': f'./symbols/hd/face/{name}',
        'x': round(x0 * k, 2),
        'y': round(y0 * k, 2),
        'w': round((x1 - x0) * k, 2),
        'h': round((y1 - y0) * k, 2),
        'cx': round(xs.mean() * k, 2),
        'cy': round(ys.mean() * k, 2),
    }


def cheeks(a, lum, body_lum, eye_bot, k):
    """The painted blush spots: the biggest lighter-than-body patch low on each side of the face."""
    h, w = lum.shape
    band = np.zeros((h, w), bool)
    band[int(eye_bot) : int(eye_bot + h * 0.24)] = True
    light = band & (a[..., 3] > 250) & (lum > body_lum * 1.05)
    lab, n = label(light)
    out = []
    for side in (lambda x: x < w * 0.36, lambda x: x > w * 0.64):
        best = None
        for i in range(1, n + 1):
            ys, xs = np.nonzero(lab == i)
            if len(xs) < 40 or not side(xs.mean()):
                continue
            if best is None or len(xs) > len(best[1]):
                best = (ys, xs)
        if best:
            ys, xs = best
            out.append({'cx': float(round(xs.mean() * k, 1)), 'cy': float(round(ys.mean() * k, 1)),
                        'rx': float(round((xs.max() - xs.min() + 1) / 2 * k, 1)), 'ry': float(round((ys.max() - ys.min() + 1) / 2 * k, 1))})
    if len(out) == 2:
        # One side often catches only part of its spot under a highlight: size both from the
        # fuller one, at its height.
        big = max(out, key=lambda c: c['rx'] * c['ry'])
        for c in out:
            c.update(rx=big['rx'], ry=big['ry'], cy=big['cy'])
    return out


def build(path):
    s = path.stem
    full = np.asarray(Image.open(path).convert('RGBA')).copy()
    a = np.asarray(Image.open(DETECT_DIR / f'{s}.webp').convert('RGBA')).copy()
    h, w = a.shape[:2]
    k = 100 / w
    kf = 100 / full.shape[1]
    lum = a[..., :3].astype(int).mean(2)
    eyes = EYES.get(s, [])
    eye_m = np.zeros((h, w), bool)
    for e in eyes:
        pts = [tuple(float(v) / k for v in p.split(',')) for p in e['hull'].split()]
        eye_m |= hull_mask(pts, (h, w))
    eye_m = dilate(eye_m, 1)  # wider eats the inner ends of brows that touch the eyes
    face = np.zeros((h, w), bool)
    face[int(h * 0.3) : int(h * 0.82), int(w * 0.18) : int(w * 0.82)] = True
    skin = face & (a[..., 3] > 250) & ~eye_m
    body_lum = np.median(lum[skin])
    body = np.median(a[skin][:, :3], axis=0)
    off = np.abs(a[..., :3].astype(int) - body).sum(2)  # colour distance from the body
    # Brows can be a darker shade of the body (LEMON), so the cut is gentler than black.
    dark = face & (a[..., 3] > 200) & (lum < body_lum * 0.8) & (off > 70) & ~eye_m
    lab, n = label(dark)
    eye_top = min((e['top'] for e in eyes), default=40) / k
    eye_bot = max((e['bottom'] for e in eyes), default=62) / k
    brows, mouth, closed = [], None, []
    for i in range(1, n + 1):
        m = lab == i
        if m.sum() < 25:
            continue
        if not eyes:
            # Painted-shut eyes (GRAPES' ^^ arcs): dark strokes in the eye band, either side.
            # The arcs are near-black; the lighter strokes above them are brows.
            ys, xs = np.nonzero(m)
            if h * 0.36 < ys.mean() < h * 0.6 and abs(xs.mean() - w / 2) > w * 0.08:
                (closed if lum[ys, xs].mean() < body_lum * 0.4 else brows).append(m)
                continue
        cy, cx = np.nonzero(m)[0].mean(), np.nonzero(m)[1].mean() * k
        over_eye = any(e['left'] - 4 < cx < e['right'] + 4 for e in eyes)  # not side shading
        if cy < eye_top + (eye_bot - eye_top) * 0.25 and over_eye:
            brows.append(m)
        elif cy > eye_bot - 2 and (mouth is None or m.sum() > mouth.sum()):
            mouth = m
    out = {'base': f'./symbols/hd/face/{s}-base.webp', 'brows': [], 'mouth': None, 'cheeks': cheeks(a, lum, body_lum, eye_bot, k)}
    hole = np.zeros(full.shape[:2], bool)
    brows.sort(key=lambda m: np.nonzero(m)[1].mean())
    for j, m in enumerate(brows):
        g = up(dilate(m, 3) & ~eye_m, full.shape)
        out['brows'].append(layer(full, g, kf, f'{s}-brow-{j}.webp'))
        hole |= g
    closed.sort(key=lambda m: np.nonzero(m)[1].mean())
    out['closed'] = []
    for j, m in enumerate(closed[:2]):
        g = up(dilate(m, 3), full.shape)
        out['closed'].append(layer(full, g, kf, f'{s}-closed-{j}.webp'))
        hole |= g
    if mouth is not None:
        ys, xs = np.nonzero(mouth)
        hm = hull_mask(list(zip(xs.tolist(), ys.tolist())), (h, w)) | mouth
        # The tongue/teeth aren't dark: take any off-body colour touching the mouth too.
        hm |= dilate(hm, 6) & (off > 60) & (a[..., 3] > 200)
        g = up(dilate(hm, 3) & ~eye_m, full.shape)
        out['mouth'] = layer(full, g, kf, f'{s}-mouth.webp')
        hole |= g
    base = full.copy()
    # A 3x3 pass spreads ~1px: (size ratio)^2 times the passes for the same softening.
    base[..., :3] = inpaint(full[..., :3], hole, round(6 * (full.shape[1] / a.shape[1]) ** 2)).round().clip(0, 255).astype(np.uint8)
    Image.fromarray(base).save(OUT_DIR / f'{s}-base.webp', 'WEBP', quality=92, method=6)
    print(s, len(out['brows']), 'brows', len(out['closed']), 'closed eyes', 'mouth' if out['mouth'] else 'no mouth', 'cheeks', out['cheeks'])
    return out


def main():
    OUT_DIR.mkdir(exist_ok=True)
    data = {p.stem: build(p) for p in sorted(SYMBOLS.glob('*.webp')) if p.stem not in SKIP}
    OUT_JSON.write_text(json.dumps(data, indent='\t') + '\n')
    print('wrote', OUT_JSON.relative_to(ROOT))


if __name__ == '__main__':
    main()
