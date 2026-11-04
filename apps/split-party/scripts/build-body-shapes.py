"""Give the low symbols their own body shapes (2026-10-29 review: "most blobs still have almost
the same body shape and differ mainly by colour, face and accessories ... a blob should be
recognisable even without its colour"). Filled black, eight of the ten designer bodies were the
same three-bump dome; the four premiums already part by their gear (crest, horns, antennae,
flower) and STRAWBERRY/PLUM by their hexagon/square, so the five low symbols get an outline each:

  BLUEBERRY  a sad droop: narrow head, spreading into a puddle at its foot
  ORANGE     a round ball
  LEMON      a lemon: a wide oval with a nub at each end, tipped a little
  KIWI       a tall bean, leaning
  APPLE      a sleepy mochi: wide and low, flat on top

The warp is polar about the body's centre and moves only the rim: inside half the new radius
the art is untouched (face, freckles, scratches stay exactly as drawn). Each ray is mapped in
two parts: the new outline band (RIM px, the designer's deeper-shade outline is ~2 units) takes
the old outline's own band, crown bumps included, and inside it the body eases out to the old
outline smoothed under the bumps. The bumps' insides (their lumps and glints) drop out, and the
outline runs on unbroken (user: the squashed bumps read as a lumpy crust, "still not perfect").

art-src/symbols-framed/<S>.png  build-symbol-masters.py's framed designer bodies (untouched)
  -> art-src/symbols/<S>.png         the masters build-symbols.py reads (shaped or copied)
  -> art-src/symbols/detect/<S>.webp 224px copies (build-face-layers.py finds the features here)
Then: build-symbols -> build-eyes -> build-face-layers -> build-mini-blobs -> build-info-art.
Delete a symbol from SHAPES to get the designer's body back.
    python3 apps/split-party/scripts/build-body-shapes.py [--sheet out.png]
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'art-src' / 'symbols-framed'
OUT = ROOT / 'art-src' / 'symbols'
DETECT = 224
N = 1440  # rays
RIM = 30  # px of 1254: the outline band carried over from the drawn outline
SINK = 55  # px of 1254: how deep the crown bumps sink into the dome


def ellipse(cx, cy, rx, ry, n=2.0, rot=0.0, nubs=0.0):
    """A superellipse (n=2 an ellipse, higher squarer) as an outline function of the angle;
    nubs adds a lemon's pointed ends along its long axis."""
    def f(x, y):
        c, s = np.cos(rot), np.sin(rot)
        u = ((x - cx) * c + (y - cy) * s) / rx
        v = (-(x - cx) * s + (y - cy) * c) / ry
        r = (np.abs(u) ** n + np.abs(v) ** n) ** (1 / n)
        if nubs:
            ang = np.arctan2(v, u)
            r = r - nubs * np.abs(np.cos(ang)) ** 18
        return r <= 1
    return f


def droop(cx, top, bottom, head, foot):
    """A narrow rounded head widening into a broad foot (half-widths in px)."""
    def f(x, y):
        t = np.clip((y - top) / (bottom - top), 0, 1)
        s = t * t * (3 - 2 * t)
        half = head + (foot - head) * s ** 1.4
        cap = np.where(t < 0.28, np.sqrt(np.clip(1 - ((0.28 - t) / 0.28) ** 2, 0, 1)), 1)
        # A soft rounded foot: the last 12% pulls in.
        heel = np.where(t > 0.88, np.sqrt(np.clip(1 - ((t - 0.88) / 0.12) ** 2, 0, 1)) * 0.25 + 0.75, 1)
        return (np.abs(x - cx) <= half * cap * heel) & (y >= top) & (y <= bottom)
    return f


def shapes(b):
    """Each low symbol's target outline, from its body's box b (x0, y0, x1, y1), keeping about
    the original's area and centre, so the cells and the split layouts fit as before."""
    x0, y0, x1, y1 = b
    w, h, cx, mid = x1 - x0, y1 - y0, (x0 + x1) / 2, (y0 + y1) / 2
    return {
        'ORANGE': ellipse(cx, y1 - 0.47 * h, 0.49 * w, 0.48 * h, 2.0),
        'KIWI': ellipse(cx + 0.02 * w, y1 - 0.52 * h, 0.38 * w, 0.53 * h, 2.2, rot=0.1),
        # Centred on the body's middle, not its foot: sat on the floor, the low wide ones sank
        # into the bottom of the cell (user: "not centered").
        'APPLE': ellipse(cx, mid + 0.03 * h, 0.5 * w, 0.4 * h, 3.0),
        # Level, not tipped: tipped, its body slid off the face's centre.
        'LEMON': ellipse(cx, mid + 0.02 * h, 0.5 * w, 0.41 * h, 2.0, nubs=0.12),
        'BLUEBERRY': droop(cx, y1 - 0.98 * h, y1, 0.33 * w, 0.53 * w),
    }


# Empty since the 2026-11-04 vector redraw: those bodies are drawn in their own shapes now
# (build-symbol-masters.py), so every master is copied through.
SHAPES = ()
# Bodies whose top-left gloss sat in the crown bumps (now cut) get a jelly highlight back, in
# the new body's box: centre (x, y) and radii as shares of it, alpha.
GLOSS = {}


def radii(mask, c):
    """The outline's distance from c along N rays (the last opaque pixel)."""
    h, w = mask.shape
    th = np.arange(N) * 2 * np.pi / N
    steps = np.arange(0, max(h, w), 0.5)
    xs = c[0] + np.cos(th)[:, None] * steps[None]
    ys = c[1] + np.sin(th)[:, None] * steps[None]
    ok = (xs >= 0) & (xs < w) & (ys >= 0) & (ys < h)
    hit = np.zeros(xs.shape, bool)
    hit[ok] = mask[ys[ok].astype(int), xs[ok].astype(int)]
    last = np.where(hit.any(1), hit.shape[1] - 1 - np.argmax(hit[:, ::-1], 1), 0)
    return steps[last]


def smooth(r, k):
    """Circular moving average over k rays."""
    pad = np.concatenate([r[-k:], r, r[:k]])
    return np.convolve(pad, np.ones(2 * k + 1) / (2 * k + 1), 'same')[k:-k]


def shape(img, target):
    px = np.asarray(img, np.float32)
    a = px[..., 3] > 127
    ys, xs = np.nonzero(a)
    c = (xs.mean(), ys.mean())
    h, w = a.shape
    gy, gx = np.mgrid[0:h, 0:w].astype(np.float32)
    want = target(gx, gy)
    # The old outline as drawn (Rf) and smoothed under the crown bumps (Rc), and the new one.
    rays = radii(a, c)
    Rf = smooth(rays, 3)
    # The bumps sit half sunk into the dome, their lower outlines drawn inside it, so under them
    # the cut goes SINK px below the dome line between them (a rolling minimum).
    low = np.min([np.roll(rays, k) for k in range(-60, 61, 4)], axis=0)
    bumpy = smooth(np.clip((Rf - low) / 20, 0, 1), 50)
    Rc = np.minimum(Rf, smooth(low, 30) - SINK * bumpy)
    T = smooth(radii(want, c), 6)
    dx, dy = gx - c[0], gy - c[1]
    r = np.hypot(dx, dy)
    th = np.mod(np.arctan2(dy, dx), 2 * np.pi)
    i = th / (2 * np.pi) * N
    i0 = np.floor(i).astype(int) % N
    f = i - np.floor(i)
    at = lambda v: v[i0] * (1 - f) + v[(i0 + 1) % N] * f
    Fo, Co, To = at(Rf), at(Rc), np.maximum(at(T), 1)
    # The band: depth q inside the new outline takes the same depth inside the drawn one.
    q = To - r
    rs_band = Fo - q * Fo / To
    # Inside: 0..To-RIM onto 0..Co-RIM, untouched in the middle.
    inner = np.maximum(To - RIM, 1)
    e = np.clip((r / inner - 0.5) / 0.47, 0, 1)
    wgt = e * e * (3 - 2 * e)
    rs_in = r * (1 + ((Co - RIM) / inner - 1) * wgt)
    mix = np.clip((q - RIM + 5) / 10, 0, 1)[..., None]
    pre = px.copy()
    pre[..., :3] *= pre[..., 3:4] / 255

    def sample(rs):
        # Bilinear, premultiplied so the edge doesn't fringe.
        sx = c[0] + dx / np.maximum(r, 1e-6) * rs
        sy = c[1] + dy / np.maximum(r, 1e-6) * rs
        x0 = np.clip(np.floor(sx).astype(int), 0, w - 2)
        y0 = np.clip(np.floor(sy).astype(int), 0, h - 2)
        fx = np.clip(sx - x0, 0, 1)[..., None]
        fy = np.clip(sy - y0, 0, 1)[..., None]
        v = pre[y0, x0] * (1 - fx) * (1 - fy) + pre[y0, x0 + 1] * fx * (1 - fy) + pre[y0 + 1, x0] * (1 - fx) * fy + pre[y0 + 1, x0 + 1] * fx * fy
        return v * ((sx >= 0) & (sx < w - 1) & (sy >= 0) & (sy < h - 1))[..., None]

    out = sample(rs_band) * (1 - mix) + sample(rs_in) * mix
    rgb = out[..., :3] * 255 / np.maximum(out[..., 3:4], 1e-3)
    return Image.fromarray(np.dstack([rgb, out[..., 3:4]]).clip(0, 255).round().astype(np.uint8), 'RGBA')


def gloss(img, spec):
    """A soft white highlight, tipped like the designer's, clipped to the body."""
    from PIL import ImageFilter
    gx, gy, rx, ry, alpha = spec
    a = np.asarray(img)[..., 3]
    ys, xs = np.nonzero(a > 127)
    x0, y0, w, h = xs.min(), ys.min(), xs.max() - xs.min(), ys.max() - ys.min()
    layer = Image.new('L', img.size, 0)
    cx, cy = x0 + gx * w, y0 + gy * h
    ImageDraw.Draw(layer).ellipse((cx - rx * w, cy - ry * h, cx + rx * w, cy + ry * h), fill=255)
    layer = layer.rotate(28, center=(cx, cy), resample=Image.BICUBIC).filter(ImageFilter.GaussianBlur(w * 0.018))
    k = np.asarray(layer, np.float32) / 255 * alpha * (a / 255)
    px = np.asarray(img, np.float32)
    px[..., :3] = px[..., :3] * (1 - k[..., None]) + 255 * k[..., None]
    return Image.fromarray(px.round().astype(np.uint8), 'RGBA')


def main():
    (OUT / 'detect').mkdir(parents=True, exist_ok=True)
    done = {}
    for path in sorted(SRC.glob('*.png')):
        img = Image.open(path).convert('RGBA')
        if path.stem in SHAPES:
            a = np.asarray(img)[..., 3] > 127
            ys, xs = np.nonzero(a)
            img = shape(img, shapes((xs.min(), ys.min(), xs.max(), ys.max()))[path.stem])
            if path.stem in GLOSS:
                img = gloss(img, GLOSS[path.stem])
        img.save(OUT / f'{path.stem}.png')
        img.resize((DETECT, DETECT), Image.LANCZOS).save(OUT / 'detect' / f'{path.stem}.webp', 'WEBP', quality=95, method=6)
        done[path.stem] = img
        print(path.stem, 'shaped' if path.stem in SHAPES else 'copied')
    if '--sheet' in sys.argv:
        S = 180
        names = sorted(done)
        sheet = Image.new('RGB', (S * len(names), S * 3), (255, 255, 255))
        for i, n in enumerate(names):
            before = Image.open(SRC / f'{n}.png').convert('RGBA').resize((S, S), Image.LANCZOS)
            after = done[n].resize((S, S), Image.LANCZOS)
            for row, im in ((0, before), (1, after)):
                bg = Image.new('RGBA', (S, S), (255, 255, 255, 255))
                bg.alpha_composite(im)
                sheet.paste(bg.convert('RGB'), (i * S, row * S))
            sil = Image.fromarray(np.where(np.asarray(after)[..., 3] > 128, 0, 255).astype(np.uint8)).convert('RGB')
            sheet.paste(sil, (i * S, 2 * S))
        sheet.save(sys.argv[sys.argv.index('--sheet') + 1])


main()
