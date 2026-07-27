#!/usr/bin/env python3
"""Build an expanded-symbol animation spritesheet from a Magnific video.

Center-crops each video frame to the expand tile's inner-rect aspect, composites it
inside the tile's baked border (keeping the rounded corners), and packs a pixi
spritesheet JSON + webp. The clip does not loop — playback is ping-ponged at runtime.

Usage (out_dir is taken verbatim — this script lives under tools/, the sheets live under
static/, so always pass an explicit static/ path). Run from apps/forest-gang:
  python3 tools/assets/sprites/rabbitMoney/generate_expand_anim.py <video.mp4> <tile.png> \
    <out_dir> <name>
  e.g. python3 tools/assets/sprites/rabbitMoney/generate_expand_anim.py bear.mp4 \
         bear_expand.png static/assets/sprites/bearMoney bear_money
"""
import json
import os
import subprocess
import sys
import tempfile

from PIL import Image

VIDEO, TILE, OUT, NAME = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
INSET = 22            # tile border ring thickness to keep on top
N, STEP = 40, 3       # 40 frames = every 3rd of ~120
FW, FH, COLS = 232, 750, 8

os.makedirs(OUT, exist_ok=True)
tile = Image.open(TILE).convert('RGBA')
TW, TH = tile.size
alpha = tile.split()[-1]
inner = (TW - 2 * INSET, TH - 2 * INSET)
ring_mask = alpha.copy()
ring_mask.paste(Image.new('L', inner, 0), (INSET, INSET))

with tempfile.TemporaryDirectory() as tmp:
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', VIDEO, '-vsync', '0',
                    '-start_number', '0', f'{tmp}/f_%03d.png'], check=True)
    probe = Image.open(f'{tmp}/f_000.png')
    SW, SH = probe.size
    CROP_W = round(SH * inner[0] / inner[1])
    x0 = (SW - CROP_W) // 2

    rows = (N + COLS - 1) // COLS
    sheet = Image.new('RGBA', (COLS * FW, rows * FH))
    frames, order = {}, []
    for i in range(N):
        v = Image.open(f'{tmp}/f_{i * STEP:03d}.png').convert('RGBA')
        content = v.crop((x0, 0, x0 + CROP_W, SH)).resize(inner, Image.LANCZOS)
        comp = tile.copy()
        comp.paste(content, (INSET, INSET))
        comp.paste(tile, (0, 0), ring_mask)
        comp.putalpha(alpha)
        f = comp.resize((FW, FH), Image.LANCZOS)
        x, y = (i % COLS) * FW, (i // COLS) * FH
        sheet.paste(f, (x, y))
        fname = f'{NAME}_{i + 1}.png'
        order.append(fname)
        frames[fname] = {
            'frame': {'x': x, 'y': y, 'w': FW, 'h': FH},
            'rotated': False, 'trimmed': False,
            'spriteSourceSize': {'x': 0, 'y': 0, 'w': FW, 'h': FH},
            'sourceSize': {'w': FW, 'h': FH},
        }

sheet.save(f'{OUT}/{NAME}.webp', quality=88, method=6)
json.dump({'frames': frames, 'animations': {NAME: order},
           'meta': {'app': 'custom', 'version': '1.0', 'image': f'{NAME}.webp',
                    'format': 'RGBA8888', 'size': {'w': COLS * FW, 'h': rows * FH},
                    'scale': '2'}},
          open(f'{OUT}/{NAME}.json', 'w'), indent=1)
print(NAME, 'crop', CROP_W, 'sheet', sheet.size,
      os.path.getsize(f'{OUT}/{NAME}.webp') // 1024, 'KB')
