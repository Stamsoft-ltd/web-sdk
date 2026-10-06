#!/usr/bin/env python3
"""The McSchmutzo logo (Figma McShmutzo 8870:33545, "Glossy Mc Schmutzo Cartoon Logo") → the wordmark
the game shows everywhere (portrait header, desktop/landscape board logo, loader, splash, sauce wipe).

Source: the node's transparent raw image (art-src/logo-8870-33545/logo_8870-33545.png, 2172×724;
download_assets' `export` is opaque white, so never that). Trimmed to its alpha box so
LOGO_WORD.aspect (game/logoSplash.ts) is the art's own aspect.

    python3 scripts/build-logo.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'art-src/logo-8870-33545/logo_8870-33545.png'
OUT = ROOT / 'static/assets/mcschmutzo'

im = Image.open(SRC).convert('RGBA')
box = im.split()[3].point(lambda a: 255 if a > 8 else 0).getbbox()
word = im.crop(box)
word.save(OUT / 'logo-word-v2.webp', 'WEBP', quality=92, method=6)
half = word.resize((word.width // 2, word.height // 2), Image.LANCZOS)
half.save(OUT / 'logo-word-v2@0.5x.webp', 'WEBP', quality=92, method=6)
print('box', box, 'size', word.size, 'aspect', round(word.width / word.height, 4))
