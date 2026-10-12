"""Measure the eyes painted into each symbol (public/symbols/*.webp) -> src/lib/eyes.json.

Blob.svelte redraws the eyes live on top of the art: each eye is clipped to the convex hull
of its white, filled with the sampled white, and gets a pupil (sampled colour/size) that
glances around plus a lid in the body colour that blinks. Brows/half-lids stay painted.

Also measures the logo's eyes (public/splash/logo.webp -> key LOGO) for Logo.svelte.
Coordinates are in units of width/100 (symbols: a 100x100 box; logo: 100x50). Re-run after
replacing any symbol or logo art:
    python3 apps/split-party/scripts/build-eyes.py
"""

import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SYMBOLS = ROOT / 'public' / 'symbols'
OUT = ROOT / 'src' / 'lib' / 'eyes.json'


def components(mask):
    h, w = mask.shape
    seen = np.zeros_like(mask, bool)
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
        yield np.array(pts)


def convex_hull(pts):
    pts = sorted(set(pts))

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0:
            up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]


def hexc(rgb):
    return '#%02x%02x%02x' % tuple(int(round(v)) for v in rgb)


def measure(path, band=(0.25, 0.72), min_y=0.45, min_area=0.004, grow_pupil=False):
    """band: rows searched for eye whites; min_y: eye centres above this are shine
    highlights; min_area: smallest eye white as a share of the image; grow_pupil: also take
    in a painted pupil that pokes past the white (the logo) so none of it shows outside the
    live eye. Off for symbols, where it would leak into dark brows."""
    im = Image.open(path).convert('RGBA')
    n, hgt = im.width, im.height
    a = np.asarray(im).astype(int)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    spread = np.max(a[..., :3], axis=2) - np.min(a[..., :3], axis=2)
    lum = a[..., :3].mean(axis=2)
    white = (r > 215) & (g > 210) & (b > 195) & (spread < 45) & (al > 200)
    white[: int(hgt * band[0])] = False
    white[int(hgt * band[1]) :] = False
    k = 100 / n
    eyes = []
    for c in components(white):
        if len(c) < n * hgt * min_area:
            continue
        y0, x0 = c.min(0)
        y1, x1 = c.max(0)
        if (y0 + y1) / 2 < hgt * min_y:  # shine highlights on the head, not eyes
            continue
        hull = convex_hull([(int(x), int(y)) for y, x in c])
        hm = Image.new('L', (n, hgt), 0)
        ImageDraw.Draw(hm).polygon(hull, fill=255)
        inside = np.asarray(hm) > 0
        dark = inside & (lum < 90)
        dys, dxs = np.nonzero(dark)
        if grow_pupil:
            # Dark pixels within reach of the measured pupil, not the letter outline.
            pr0 = (dxs.max() - dxs.min() + 1) / 2
            yy, xx = np.mgrid[0:hgt, 0:n]
            near = (yy - dys.mean()) ** 2 + (xx - dxs.mean()) ** 2 < (pr0 * 1.45) ** 2
            extra = near & (lum < 90) & (al > 200)
            ey, ex = np.nonzero(extra)
            hull = convex_hull([(int(x), int(y)) for y, x in c] + list(zip(ex.tolist(), ey.tolist())))
        # Body colour for the lid: an annulus just outside the eye, minus brows/outlines.
        cy, cx = c[:, 0].mean(), c[:, 1].mean()
        yy, xx = np.mgrid[0:hgt, 0:n]
        ry, rx = (y1 - y0) / 2 + 1, (x1 - x0) / 2 + 1
        d = ((yy - cy) / ry) ** 2 + ((xx - cx) / rx) ** 2
        ring = (d > 1.6) & (d < 2.6) & (al > 250) & (lum > 100) & ~white
        body = np.median(a[ring][:, :3], axis=0)
        eyes.append(
            {
                'hull': ' '.join(f'{x * k:.1f},{y * k:.1f}' for x, y in hull),
                'top': round(y0 * k, 1),
                'bottom': round(y1 * k, 1),
                'left': round(x0 * k, 1),
                'right': round(x1 * k, 1),
                'white': hexc(a[c[:, 0], c[:, 1]][:, :3].mean(0)),
                'lid': hexc(body),
                'px': round(dxs.mean() * k, 2),
                'py': round(dys.mean() * k, 2),
                'pr': round((dxs.max() - dxs.min() + 1) / 2 * k, 2),
                'pupil': hexc(a[dark][:, :3].mean(0)),
            }
        )
    return sorted(eyes, key=lambda e: e['px'])


def main():
    data = {}
    for path in sorted(SYMBOLS.glob('*.webp')):
        eyes = measure(path)
        if eyes:
            data[path.stem] = eyes
        print(path.stem, len(eyes), [(e['px'], e['py'], e['pr'], e['lid']) for e in eyes])
    logo = measure(ROOT / 'public' / 'splash' / 'logo.webp', band=(0.2, 0.6), min_y=0.2, min_area=0.0015, grow_pupil=True)
    data['LOGO'] = logo
    print('LOGO', len(logo), [(e['px'], e['py'], e['pr'], e['lid'], e['white']) for e in logo])
    OUT.write_text(json.dumps(data, indent='\t') + '\n')
    print('wrote', OUT.relative_to(ROOT))


if __name__ == '__main__':
    main()
