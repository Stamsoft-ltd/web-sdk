"""Split the logo's paint splashes into their own layers so Logo.svelte can squash them.

public/splash/logo.webp (Figma 11003:27691, untouched)
  -> public/splash/logo-base.webp   the logo without the six side splashes
  -> public/splash/logo-drop-N.webp each splash, cropped
  -> src/lib/logo-layers.json       crops + anchors in the logo's 100x50 unit box

The splashes are the colour regions outside the navy outline at the far left/right; a drop's
anchor is where it touches the outline (it squashes from there), a free dot squashes about
its own centre.
    python3 apps/split-party/scripts/build-logo-layers.py
"""

import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'public' / 'splash' / 'logo.webp'
OUT_DIR = ROOT / 'public' / 'splash'
OUT_JSON = ROOT / 'src' / 'lib' / 'logo-layers.json'
SIDE = 0.24  # splashes live in the outer 24% of the width on each side


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
            out |= np.roll(np.roll(mask, dy, 0), dx, 1)
    return out


def main():
    im = Image.open(SRC).convert('RGBA')
    a = np.asarray(im).copy()
    h, w = a.shape[:2]
    lum = a[..., :3].astype(int).mean(2)
    al = a[..., 3]
    navy = (lum < 95) & (al > 60)
    lab, n = label((al > 60) & ~navy)
    k = 100 / w
    base = a.copy()
    layers = []
    for i in range(1, n + 1):
        m = lab == i
        ys, xs = np.nonzero(m)
        if len(xs) < 150 or w * SIDE < xs.mean() < w * (1 - SIDE):
            continue
        # Take the antialiased fringe with it, but never the navy outline.
        grab = dilate(m, 2) & ~navy & ~((lab > 0) & (lab != i))
        y0, y1 = ys.min() - 3, ys.max() + 4
        x0, x1 = xs.min() - 3, xs.max() + 4
        crop = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
        region = grab[y0:y1, x0:x1]
        crop[region] = a[y0:y1, x0:x1][region]
        base[grab] = 0
        touch = m & dilate(navy, 2)
        ty, tx = np.nonzero(touch)
        anchored = len(tx) > 8
        ax, ay = (tx.mean(), ty.mean()) if anchored else (xs.mean(), ys.mean())
        layers.append(
            {
                'x': round(x0 * k, 2),
                'y': round(y0 * k, 2),
                'w': round((x1 - x0) * k, 2),
                'h': round((y1 - y0) * k, 2),
                'ax': round(ax * k, 2),
                'ay': round(ay * k, 2),
                'anchored': bool(anchored),
                'crop': crop,
                'cx': xs.mean(),
            }
        )
    layers.sort(key=lambda l: l['cx'])
    out = []
    for j, l in enumerate(layers):
        name = f'logo-drop-{j}.webp'
        Image.fromarray(l.pop('crop')).save(OUT_DIR / name, 'WEBP', quality=90, method=6)
        l.pop('cx')
        out.append({'src': f'./splash/{name}', **l})
        print(name, l)
    Image.fromarray(base).save(OUT_DIR / 'logo-base.webp', 'WEBP', quality=90, method=6)
    OUT_JSON.write_text(json.dumps({'width': 100, 'height': round(h * k, 2), 'drops': out}, indent='\t') + '\n')
    print('wrote', OUT_JSON.relative_to(ROOT), len(out), 'drops')


if __name__ == '__main__':
    main()
