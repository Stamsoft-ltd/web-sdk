"""Game-info art at 1.5x its old size, from the same masters (matched by PSNR: 37-45 dB).

art-src/splash/2x/logo.png      the splash logo's Real-ESRGAN 3x (upscale-art.py)
  -> public/info/hd/logo.webp          855x428 (was 570; shown 304 css px at 1920x1080)
art-src/symbols/STRAWBERRY.png  -> public/info/hd/peeker-pink.webp  840 (was 560; shown 319)
art-src/symbols/KIWI.png        -> public/info/hd/peeker-teal.webp  768 (was 512)
hd/: new folder rather than new contents, browsers keep the old art under the old names.
    python3 apps/split-party/scripts/build-info-art.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'info' / 'hd'
JOBS = {
    'logo': (ROOT / 'art-src' / 'splash' / '2x' / 'logo.png', 855),
    'peeker-pink': (ROOT / 'art-src' / 'symbols' / 'STRAWBERRY.png', 840),
    'peeker-teal': (ROOT / 'art-src' / 'symbols' / 'KIWI.png', 768),
}

OUT.mkdir(parents=True, exist_ok=True)
for name, (src, w) in JOBS.items():
    im = Image.open(src).convert('RGBA')
    im = im.resize((w, round(w * im.height / im.width)), Image.LANCZOS)
    im.save(OUT / f'{name}.webp', quality=90, alpha_quality=100, method=6)
    print(name, im.size, (OUT / f'{name}.webp').stat().st_size // 1024, 'KB')
