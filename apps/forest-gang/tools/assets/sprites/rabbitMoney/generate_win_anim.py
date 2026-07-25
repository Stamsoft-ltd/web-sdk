#!/usr/bin/env python3
"""Build a board win-state animation spritesheet from a Magnific win-state video.

The win videos are landscape clips matching the win-card composition. Each frame is
center-cropped to the card's aspect and masked with the card's rounded-corner alpha —
NO border ring is drawn (the static cards' colored borders are intentionally absent).
Frames are sampled evenly across the clip (source lengths vary, 55–79 frames).
Playback is ping-ponged at runtime (clips don't loop).

Usage:
  python3 generate_win_anim.py <video.mp4> <card_tile.png> <out_dir> <name>
"""
import json
import os
import subprocess
import sys
import tempfile

from PIL import Image

VIDEO, TILE, OUT, NAME = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
N = 40
FW, FH, COLS = 320, 272, 8

os.makedirs(OUT, exist_ok=True)
tile = Image.open(TILE).convert('RGBA')
TW, TH = tile.size
alpha = tile.split()[-1]

with tempfile.TemporaryDirectory() as tmp:
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', VIDEO, '-vsync', '0',
                    '-start_number', '0', f'{tmp}/f_%03d.png'], check=True)
    total = len(os.listdir(tmp))
    SW, SH = Image.open(f'{tmp}/f_000.png').size
    # center crop to the card aspect
    if SW / SH > TW / TH:
        CW, CH = round(SH * TW / TH), SH
    else:
        CW, CH = SW, round(SW * TH / TW)
    x0, y0 = (SW - CW) // 2, (SH - CH) // 2

    rows = (N + COLS - 1) // COLS
    sheet = Image.new('RGBA', (COLS * FW, rows * FH))
    frames, order = {}, []
    for i in range(N):
        src_i = round(i * (total - 1) / (N - 1))
        v = Image.open(f'{tmp}/f_{src_i:03d}.png').convert('RGBA')
        comp = v.crop((x0, y0, x0 + CW, y0 + CH)).resize((TW, TH), Image.LANCZOS)
        comp.putalpha(alpha)  # rounded corners from the card art, no border
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

sheet.save(f'{OUT}/{NAME}.webp', quality=85, method=6)
json.dump({'frames': frames, 'animations': {NAME: order},
           'meta': {'app': 'custom', 'version': '1.0', 'image': f'{NAME}.webp',
                    'format': 'RGBA8888', 'size': {'w': COLS * FW, 'h': rows * FH},
                    'scale': '2'}},
          open(f'{OUT}/{NAME}.json', 'w'), indent=1)
print(NAME, f'{total} src frames, crop {CW}x{CH}, sheet', sheet.size,
      os.path.getsize(f'{OUT}/{NAME}.webp') // 1024, 'KB')
