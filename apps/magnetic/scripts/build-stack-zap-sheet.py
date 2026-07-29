#!/usr/bin/env python3
"""Build the stacked-cell lightning flipbook from the 10 supplied radial-burst PNGs.

Source art is 10 INDEPENDENT bursts (not a rendered animation), so there is no motion to
preserve between frames — cycling them is what produces the crackle. They are packed into one
5x2 webp sheet plus a Pixi-format JSON atlas, matching the existing scatterWinAnim asset.

Run from apps/magnetic:  python3 scripts/build-stack-zap-sheet.py <src-dir>
"""
import json
import sys
from pathlib import Path

from PIL import Image

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else Path.home() / 'Downloads' / 'lightnin')
OUT = Path(__file__).resolve().parent.parent / 'static' / 'assets' / 'sprites' / 'stackZap'
OUT.mkdir(parents=True, exist_ok=True)

# Sort by the trailing "(n)" index so the sheet order is stable and reproducible, not filesystem
# order — one source file is "(10)" and would otherwise sort between "(1)" and "(2)".
def idx(p: Path) -> int:
    stem = p.stem
    if '(' in stem and ')' in stem:
        try:
            return int(stem[stem.rindex('(') + 1:stem.rindex(')')])
        except ValueError:
            pass
    return 0

files = sorted(SRC.glob('*.png'), key=idx)
assert files, f'no PNGs in {SRC}'

# Source frames are 264px (one is 266 wide) — normalise so every atlas cell is identical, and
# downscale to 192. Sheet weight is dominated by FRAME SIZE, not encoder quality (at 264px the
# sheet is ~320KB at q82 and still ~280KB at q62), because the alpha channel carries the cost.
# 192 halves it. The art is a soft radial glow drawn BEHIND a symbol that partially occludes it,
# so the lost resolution is not visible; re-raise this if it is ever used full-screen.
CELL = 192
COLS = 5
rows = (len(files) + COLS - 1) // COLS
sheet = Image.new('RGBA', (COLS * CELL, rows * CELL), (0, 0, 0, 0))

frames, names = {}, []
for i, f in enumerate(files):
    im = Image.open(f).convert('RGBA')
    if im.size != (CELL, CELL):
        im = im.resize((CELL, CELL), Image.LANCZOS)
    x, y = (i % COLS) * CELL, (i // COLS) * CELL
    sheet.paste(im, (x, y))          # paste, not alpha_composite: frames must not blend together
    name = f'stack_zap_{i + 1}.png'
    names.append(name)
    frames[name] = {
        'frame': {'x': x, 'y': y, 'w': CELL, 'h': CELL},
        'rotated': False,
        'trimmed': False,
        'spriteSourceSize': {'x': 0, 'y': 0, 'w': CELL, 'h': CELL},
        'sourceSize': {'w': CELL, 'h': CELL},
    }

img_name = 'stack_zap.webp'
sheet.save(OUT / img_name, 'WEBP', quality=80, method=6)
json.dump(
    {
        'frames': frames,
        'animations': {'stackZap': names},
        'meta': {
            'app': 'custom',
            'version': '1.0',
            'image': img_name,
            'format': 'RGBA8888',
            'size': {'w': sheet.width, 'h': sheet.height},
            'scale': '1',
        },
    },
    open(OUT / 'stack_zap.json', 'w'),
    indent='\t',
)
kb = (OUT / img_name).stat().st_size / 1024
print(f'{len(files)} frames -> {sheet.width}x{sheet.height}  {img_name} {kb:.0f}KB')
