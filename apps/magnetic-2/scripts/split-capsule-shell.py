"""Split the baked capsule flipbook into a STATIC shell + an additive LIGHTNING-only sheet.

shell  = per-pixel median across frames (metal/glass survives, moving lightning is rejected)
motion = per-pixel stddev across frames, normalised and feathered -> a mask of what ACTUALLY moves
glow_i = clamp(frame_i - shell, 0) * motion

Masking by motion is what keeps the metal perfectly still: static pixels have ~zero stddev, so
whatever residue the subtraction leaves on the metal edges is multiplied away.
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageFilter

SRC = '/Users/stanislavmilev/Development/stake/forestSlot/apps/magnetic/static/assets/sprites/capsuleTube'
OUT = os.path.dirname(os.path.abspath(__file__)) + '/capsout'
os.makedirs(OUT, exist_ok=True)
name = sys.argv[1]

meta = json.load(open(f'{SRC}/{name}.json'))
sheet = Image.open(f'{SRC}/{name}.webp').convert('RGBA')
frames = meta['frames']
order = sorted(frames, key=lambda k: int(''.join(c for c in k if c.isdigit())))
arrs = []
for k in order:
    f = frames[k]['frame']
    arrs.append(np.asarray(
        sheet.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h'])), dtype=np.float32))
stack = np.stack(arrs)                      # (N, H, W, 4)
N, H, W, _ = stack.shape
print(f'{name}: {N} frames of {W}x{H}')

shell = np.median(stack, axis=0)
Image.fromarray(shell.astype(np.uint8), 'RGBA').save(f'{OUT}/{name}_shell.png')

# Motion mask from luminance stddev
lum = stack[..., :3] @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
sd = lum.std(axis=0)
print(f'stddev: max {sd.max():.1f} mean {sd.mean():.1f}')
m = np.clip((sd - 3.0) / 18.0, 0, 1) ** 0.8           # floor kills static-metal noise
mask = np.asarray(Image.fromarray((m * 255).astype(np.uint8), 'L')
                  .filter(ImageFilter.GaussianBlur(2.2)), dtype=np.float32) / 255.0
print(f'mask coverage: {(mask > 0.15).mean() * 100:.1f}% of pixels move')

# Gate by the capsule SILHOUETTE as well. RGB in fully-transparent pixels of the source frames is
# undefined garbage, so `frame - shell` produces real values out there; drawn additively that lit up
# the background around the tube. Raising alpha to a power tightens the edge so no halo survives.
sil = (shell[..., 3] / 255.0) ** 2.0
mask = mask * sil
print(f'after silhouette gate: {(mask > 0.15).mean() * 100:.1f}% of pixels move')

glows = []
for i in range(N):
    d = np.clip(stack[i, ..., :3] - shell[..., :3], 0, 255) * mask[..., None]
    a = np.where(d.max(axis=2) > 2, 255, 0)
    g = np.dstack([d, a]).astype(np.uint8)
    glows.append(g)

# ── Seamless FORWARD loop by cross-dissolve ──
# Ping-ponging the sequence hid the seam but played the second half in reverse, and lightning
# growth is directional enough that it read as a rewind. Instead, dissolve the tail K frames into
# the head K frames and drop the tail. The result is M = N-K frames that always advance forward,
# and the wrap (M-1 -> 0) lands on what were originally consecutive frames M-1 -> M.
# K=5 measured best across 3..10: lowest wrap discontinuity (0.74x a normal step) AND one of the
# longest surviving cycles. The ratio is noisy in K because it depends which frames happen to align.
K = 5
M = N - K
rgb = np.stack([g[..., :3].astype(np.float32) for g in glows])
mixed = []
for i in range(M):
    if i < K:
        w = i / (K - 1)                       # 0 -> 1 across the overlap
        f = rgb[i] * w + rgb[M + i] * (1.0 - w)
    else:
        f = rgb[i]
    a = np.where(f.max(axis=2) > 2, 255, 0)
    mixed.append(np.dstack([f, a]).astype(np.uint8))
print(f'cross-dissolve: {N} frames -> {M} (overlap {K})')

cols = 6
rows = (M + cols - 1) // cols
out = np.zeros((rows * H, cols * W, 4), dtype=np.uint8)
for i, g in enumerate(mixed):
    r, c = divmod(i, cols)
    out[r * H:(r + 1) * H, c * W:(c + 1) * W] = g
Image.fromarray(out, 'RGBA').save(f'{OUT}/{name}_glow.png')
print('wrote shell + glow sheet', (cols * W, rows * H), 'frames', M)

# Seam check: the wrap step must not stand out against a typical step.
lum2 = np.stack([g[..., :3].max(axis=2).astype(np.float32) for g in mixed])
steps = [np.abs(lum2[i] - lum2[(i + 1) % M]).mean() for i in range(M)]
print(f'loop steps: mean {np.mean(steps[:-1]):.2f}  WRAP {steps[-1]:.2f}  '
      f'-> wrap is {steps[-1] / np.mean(steps[:-1]):.2f}x a normal step')

# How much does the METAL still move after masking? Sample a static corner region.
resid = (np.clip(stack[..., :3] - shell[None, ..., :3], 0, 255) * mask[None, ..., None])
metal = resid[:, :int(H * 0.18), :, :]      # top cap: pure metal, no lightning
print(f'top-cap residual after mask: max {metal.max():.1f} mean {metal.mean():.3f}')
