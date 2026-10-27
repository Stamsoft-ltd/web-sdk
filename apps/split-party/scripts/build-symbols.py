"""The ten fruit symbols at 2x: Figma's 1254px image fills (the board's "Low symbols" /
"SYmbols" cells in 11317:40778) scaled to 448px, the 100-unit art box at 4.48px per unit.

The old 224px set was these same masters scaled down (37-45 dB against them), so the framing
is unchanged and eyes.json / gear.json (in units) still fit. 224px was under the screen's
pixels on a retina desktop (a 75px cell at 1.6x stage scale x DPR 2 = 240px, more mid-hop).

art-src/symbols/<S>.png  (gitignored; Figma raw fills, 1254x1254)
  -> public/symbols/hd/<S>.webp   448x448
Then build-scatter-egg.py (BASKET) and build-face-layers.py (the face cut) read hd/.
New folder rather than new contents: browsers keep the old art under the old names.
    python3 apps/split-party/scripts/build-symbols.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'art-src' / 'symbols'
OUT = ROOT / 'public' / 'symbols' / 'hd'
SIZE = 448

OUT.mkdir(parents=True, exist_ok=True)
for path in sorted(SRC.glob('*.png')):
    im = Image.open(path).convert('RGBA').resize((SIZE, SIZE), Image.LANCZOS)
    out = OUT / f'{path.stem}.webp'
    im.save(out, quality=92, alpha_quality=100, method=6)
    print(out.name, im.size, out.stat().st_size // 1024, 'KB')
