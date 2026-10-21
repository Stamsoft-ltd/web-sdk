"""Splash card frame and the Mystery orb, from their Figma image fills.

art-src/splash/panel.png  the splash card frame (Figma 11174:5027, also 5028/5029), untouched;
                          the whole canvas is kept, so its transparent margin stays in the box
  -> public/splash/panel.webp  819x1230, 3x the 273x410 card
art-src/ui/mystery.png    the Mystery Bonus orb (Figma 11028:33318), untouched
  -> public/ui/mystery.webp    cropped to its alpha box, 378x400 (2x its old 189x200)
The domes and islands on the splash are left alone: their soft edge is the design's layer blur
baked into the art, so a bigger copy would only be a bigger blur.
    python3 apps/split-party/scripts/build-splash-art.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'art-src'
OUT = ROOT / 'public'

panel = Image.open(SRC / 'splash' / 'panel.png').convert('RGBA')
panel.resize((819, 1230), Image.LANCZOS).save(OUT / 'splash' / 'panel.webp', quality=90, method=6)
orb = Image.open(SRC / 'ui' / 'mystery.png').convert('RGBA')
orb = orb.crop(orb.getchannel('A').getbbox())
orb.resize((378, 400), Image.LANCZOS).save(OUT / 'ui' / 'mystery.webp', quality=90, method=6)
for f in ('splash/panel.webp', 'ui/mystery.webp'):
    print(f, Image.open(OUT / f).size, (OUT / f).stat().st_size // 1024, 'KB')
