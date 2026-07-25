#!/usr/bin/env python3
"""Build a looping emblem spritesheet (wild / scatter) from a black-background video.

The clips are rendered on pure black with no alpha, so background removal is an
un-premultiply: alpha = max(r,g,b), colour = rgb / alpha. Pixels below a small
luma floor are snapped to transparent to kill codec noise. Frames are trimmed to
the content bbox, resized to a target frame width, and packed 8 columns wide.

The clip does NOT loop seamlessly — ping-pong the textures at runtime (same as
the animal win anims in Board.svelte).

Usage (out_dir is taken verbatim — this script lives under tools/, the sheets live under
static/, so always pass an explicit static/ path). Run from apps/forest-gang:
  python3 tools/assets/sprites/generate_emblem_anim.py <video.mp4> <out_dir> <name> <frame_w>
  e.g. python3 tools/assets/sprites/generate_emblem_anim.py ~/Downloads/WILD.mp4 \
         static/assets/sprites/wildAnim wild_anim_v3 224
       python3 tools/assets/sprites/generate_emblem_anim.py ~/Downloads/Scatter.mp4 \
         static/assets/sprites/scatterAnim scatter_anim 336
"""
import json
import math
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

VIDEO, OUT, NAME, FW = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
N, COLS = 40, 8          # 40 frames sampled evenly across the clip
LUMA_FLOOR = 10          # max(r,g,b) below this -> fully transparent (codec noise)
PAD = 4                  # transparent px kept around the trimmed content bbox

os.makedirs(OUT, exist_ok=True)

with tempfile.TemporaryDirectory() as tmp:
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', VIDEO, '-vsync', '0',
                    '-start_number', '0', f'{tmp}/f_%03d.png'], check=True)
    total = len([f for f in os.listdir(tmp) if f.startswith('f_')])
    # Even sample of N frames across the whole clip (inclusive ends).
    picks = [round(i * (total - 1) / (N - 1)) for i in range(N)]

    # First pass: global content bbox over the sampled frames (stable trim).
    bbox = None
    for p in picks:
        im = Image.open(f'{tmp}/f_{p:03d}.png').convert('RGB')
        a = np.asarray(im).max(axis=2)
        ys, xs = np.where(a >= LUMA_FLOOR)
        b = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
        bbox = b if bbox is None else (
            min(bbox[0], b[0]), min(bbox[1], b[1]),
            max(bbox[2], b[2]), max(bbox[3], b[3]),
        )
    w, h = im.size
    bbox = (max(0, bbox[0] - PAD), max(0, bbox[1] - PAD),
            min(w, bbox[2] + PAD), min(h, bbox[3] + PAD))

    rows = (N + COLS - 1) // COLS
    fh = round(FW * (bbox[3] - bbox[1]) / (bbox[2] - bbox[0]))
    sheet = Image.new('RGBA', (COLS * FW, rows * fh))
    frames, order = {}, []
    for i, p in enumerate(picks):
        rgb = np.asarray(Image.open(f'{tmp}/f_{p:03d}.png').convert('RGB')).astype(np.float32)
        alpha = rgb.max(axis=2)
        safe = np.maximum(alpha, 1)[:, :, None]
        out = np.clip(rgb / safe * 255.0, 0, 255)          # un-premultiply
        out[alpha < LUMA_FLOOR] = 0
        alpha[alpha < LUMA_FLOOR] = 0
        rgba = np.dstack([out, alpha]).astype(np.uint8)
        f = Image.fromarray(rgba, 'RGBA').crop(bbox).resize((FW, fh), Image.LANCZOS)
        x, y = (i % COLS) * FW, (i // COLS) * fh
        sheet.paste(f, (x, y))
        fname = f'{NAME}_{i + 1}.png'
        order.append(fname)
        frames[fname] = {
            'frame': {'x': x, 'y': y, 'w': FW, 'h': fh},
            'rotated': False, 'trimmed': False,
            'spriteSourceSize': {'x': 0, 'y': 0, 'w': FW, 'h': fh},
            'sourceSize': {'w': FW, 'h': fh},
        }

sheet.save(f'{OUT}/{NAME}.webp', quality=88, method=6)
json.dump({'frames': frames, 'animations': {NAME: order},
           'meta': {'app': 'custom', 'version': '1.0', 'image': f'{NAME}.webp',
                    'format': 'RGBA8888', 'size': {'w': COLS * FW, 'h': rows * fh},
                    'scale': '1'}},
          open(f'{OUT}/{NAME}.json', 'w'), indent=1)
print(NAME, 'frames', N, 'frame', f'{FW}x{fh}', 'bbox', bbox, 'sheet', sheet.size,
      os.path.getsize(f'{OUT}/{NAME}.webp') // 1024, 'KB')
