"""Rebuild the splash clouds sharp and clean enough to survive the splash's upscale.

art-src/splash/cloud.webp, cloud-far.webp (Figma exports, untouched)
  -> public/splash/cloud-2x.webp, cloud-far-2x.webp (new names: browsers kept the old art)

The exports are 658x250 / 304x131 with a ~20px baked blur on the edge, and their edge pixels
are near-black (black-matte), so on the sky they read as a grey, smeared halo. The splash
draws a near cloud up to 430 frame px, i.e. ~1450 device px on a 1080p DPR-2 screen, so
they're also upscaled ~2.3x. Here the colour is bled outward from the cloud's opaque body
(no dark fringe), everything is upscaled SCALE x, and the alpha edge is re-cut at the
blur's 50% contour with a short ramp: near clouds crisp, far ones a touch softer for depth.
    python3 apps/split-party/scripts/build-splash-clouds.py
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'art-src' / 'splash'
OUT = ROOT / 'public' / 'splash'
SCALE = 2.5
# Alpha gain at the 50% contour; the source ramp is ~40px after upscaling.
CLOUDS = {'cloud': 18.0, 'cloud-far': 7.0}


def blur(a, r):
    """Separable gaussian (PIL can't blur float images)."""
    x = np.arange(-3 * r, 3 * r + 1)
    k = np.exp(-(x**2) / (2 * r * r))
    k /= k.sum()
    a = np.pad(a, 3 * r)  # zero pad: 'same' breaks once the kernel outgrows the image
    a = np.apply_along_axis(lambda v: np.convolve(v, k, 'valid'), 0, a)
    return np.apply_along_axis(lambda v: np.convolve(v, k, 'valid'), 1, a)


def bleed(rgb, core):
    """Fill every non-core pixel with the colour of the nearest opaque cloud body."""
    out = rgb * core[..., None]
    filled = core > 0
    for r in (2, 4, 8, 16, 32):
        den = blur(core, r)
        take = ~filled & (den > 1e-3)
        for c in range(3):
            num = blur(rgb[..., c] * core, r)
            out[..., c][take] = num[take] / den[take]
        filled |= take
    return out


def up(a, size):
    return np.asarray(Image.fromarray(a.astype(np.float32), 'F').resize(size, Image.LANCZOS))


for name, gain in CLOUDS.items():
    src = np.asarray(Image.open(SRC / f'{name}.webp').convert('RGBA')).astype(np.float32)
    rgb, alpha = src[..., :3], src[..., 3] / 255
    rgb = bleed(rgb, (alpha >= 0.95).astype(np.float32))
    h, w = alpha.shape
    size = (round(w * SCALE), round(h * SCALE))
    rgb_up = np.stack([up(rgb[..., c], size) for c in range(3)], -1)
    a_up = np.clip((up(alpha, size) - 0.5) * gain + 0.5, 0, 1)
    out = np.dstack([np.clip(rgb_up, 0, 255), a_up * 255]).round().astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(OUT / f'{name}-2x.webp', quality=90, alpha_quality=100, method=6)
    print(name, size)
