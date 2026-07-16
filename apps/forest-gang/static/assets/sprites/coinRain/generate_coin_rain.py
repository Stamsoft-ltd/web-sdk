#!/usr/bin/env python3
"""Build the win-screen coin-rain overlay sheets from the Magnific coin video.

The clip is gold P-coins on a white studio background. Each frame gets the white keyed
out via edge-connected flood fill (vectorized binary propagation), so white highlights
INSIDE coins survive. 40 frames at native 864x496 don't fit one <=4096px texture, so
they're packed into TWO sheets (coin_rain_a/b, 20 frames each) that the component
concatenates at runtime.

Usage: python3 generate_coin_rain.py <video.mp4> <out_dir>
"""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

VIDEO, OUT = sys.argv[1], sys.argv[2]
N, STEP = 40, 3
COLS, ROWS = 4, 5  # per sheet -> 20 frames each

os.makedirs(OUT, exist_ok=True)

def key_white(img):
    a = np.array(img.convert('RGBA'))
    h, w, _ = a.shape
    near_white = a[:, :, :3].min(axis=2) > 215
    # flood fill from borders (binary propagation with numpy rolls)
    mask = np.zeros((h, w), bool)
    mask[0, :] = near_white[0, :]; mask[-1, :] = near_white[-1, :]
    mask[:, 0] = near_white[:, 0]; mask[:, -1] = near_white[:, -1]
    while True:
        grown = mask.copy()
        grown[1:, :] |= mask[:-1, :]; grown[:-1, :] |= mask[1:, :]
        grown[:, 1:] |= mask[:, :-1]; grown[:, :-1] |= mask[:, 1:]
        grown &= near_white
        if (grown == mask).all():
            break
        mask = grown
    a[:, :, 3] = np.where(mask, 0, a[:, :, 3])
    # soften halo: kept pixels bordering the removed bg fade by their brightness
    edge = ~mask & (
        np.roll(mask, 1, 0) | np.roll(mask, -1, 0) | np.roll(mask, 1, 1) | np.roll(mask, -1, 1)
    )
    bright = a[:, :, :3].min(axis=2).astype(int)
    fade = np.clip(255 - (bright - 140) * 2, 60, 255).astype(np.uint8)
    a[:, :, 3] = np.where(edge, np.minimum(a[:, :, 3], fade), a[:, :, 3])
    return Image.fromarray(a)

with tempfile.TemporaryDirectory() as tmp:
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', VIDEO, '-vsync', '0',
                    '-start_number', '0', f'{tmp}/f_%03d.png'], check=True)
    FW, FH = Image.open(f'{tmp}/f_000.png').size
    for sheet_i, letter in enumerate('ab'):
        sheet = Image.new('RGBA', (COLS * FW, ROWS * FH))
        frames, order = {}, []
        for j in range(COLS * ROWS):
            i = sheet_i * COLS * ROWS + j
            img = key_white(Image.open(f'{tmp}/f_{i * STEP:03d}.png'))
            x, y = (j % COLS) * FW, (j // COLS) * FH
            sheet.paste(img, (x, y))
            name = f'coin_rain_{i + 1}.png'
            order.append(name)
            frames[name] = {
                'frame': {'x': x, 'y': y, 'w': FW, 'h': FH},
                'rotated': False, 'trimmed': False,
                'spriteSourceSize': {'x': 0, 'y': 0, 'w': FW, 'h': FH},
                'sourceSize': {'w': FW, 'h': FH},
            }
        sheet.save(f'{OUT}/coin_rain_{letter}.webp', quality=85, method=6)
        json.dump({'frames': frames, 'animations': {f'coinRain_{letter}': order},
                   'meta': {'app': 'custom', 'version': '1.0',
                            'image': f'coin_rain_{letter}.webp', 'format': 'RGBA8888',
                            'size': {'w': COLS * FW, 'h': ROWS * FH}, 'scale': '1'}},
                  open(f'{OUT}/coin_rain_{letter}.json', 'w'), indent=1)
        print(f'coin_rain_{letter}', sheet.size,
              os.path.getsize(f'{OUT}/coin_rain_{letter}.webp') // 1024, 'KB')
