#!/usr/bin/env python3
"""Gives Mama's flat body texture some volume (user 2026-11-02: "add some more depth to mama
blob"): a soft pillow light from the upper left that rolls off into shade toward the lower
right, and a darker belly underside. Baked into the texture so it rides the body mesh's squash,
hop and dance; the face, paws and arm are their own layers and stay as drawn.

Takes the flat body build-mama-layers.py writes (public/base/hd/mama/body.webp) and moves it to
art-src/mama/body-flat.webp (the game no longer loads it, and everything in public/ is
preloaded), writes body-lit.webp in its place (a new name busts the cache) and points
src/lib/mama.json's body at it. Run it again after build-mama-layers.py, which rewrites
mama.json with the flat body.

    python3 apps/split-party/scripts/build-mama-depth.py
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / 'public' / 'base' / 'hd' / 'mama'
JSON = ROOT / 'src' / 'lib' / 'mama.json'
FLAT = ROOT / 'art-src' / 'mama' / 'body-flat.webp'

# Light from the upper left (x right, y down), as the art's own spot highlights fall.
LIGHT = np.array([-0.55, -0.83])
# How far in from the outline the rounding reaches, in texture px (the body is 960 wide).
BEVEL = 70
LIT = 0.16  # brightening on the lit rim
SHADE = 0.24  # darkening on the shaded rim
BELLY = 0.12  # extra darkening toward the feet


def blur(a, r):
	return np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r)), np.float32) / 255


if (DIR / 'body.webp').exists():
	FLAT.parent.mkdir(parents=True, exist_ok=True)
	(DIR / 'body.webp').replace(FLAT)
src = Image.open(FLAT).convert('RGBA')
rgba = np.asarray(src, np.float32) / 255
h, w = rgba.shape[:2]
inside = (rgba[..., 3] > 0.5).astype(np.float32)

# A rounded height field: the blurred silhouette rises from its edge toward its middle; its slope
# is the surface's tilt, so the light falls on the facing side of every bulge (the buns too).
height = blur(inside, BEVEL * 0.6)
gy, gx = np.gradient(height)
mag = np.hypot(gx, gy) + 1e-6
nx, ny = -gx / mag, -gy / mag  # outward normal, in the image plane
facing = nx * LIGHT[0] + ny * LIGHT[1]  # 1 toward the light, -1 away
# Only near the outline: the slope dies off inside the bevel.
rim = np.clip(mag / mag[inside > 0].max() * 3.0, 0, 1)
rim = blur(rim, 6)
light = np.where(facing > 0, LIT * facing, SHADE * facing) * rim

# The underside: darker toward her feet, from 55% of her height down.
ys = np.linspace(0, 1, h)[:, None]
light -= BELLY * np.clip((ys - 0.55) / 0.45, 0, 1) ** 1.5

rgb = rgba[..., :3]
out = np.where(light[..., None] > 0, rgb + (1 - rgb) * light[..., None], rgb * (1 + light[..., None]))
res = np.dstack([np.clip(out, 0, 1), rgba[..., 3:]])
Image.fromarray((res * 255 + 0.5).astype(np.uint8)).save(DIR / 'body-lit.webp', 'WEBP', quality=92, alpha_quality=100, method=6)

data = json.loads(JSON.read_text())
data['parts']['body']['src'] = './base/hd/mama/body-lit.webp'
JSON.write_text(json.dumps(data, indent='\t') + '\n')
print('body-lit.webp', f'{w}x{h}', (DIR / 'body-lit.webp').stat().st_size // 1024, 'KB')
