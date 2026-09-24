#!/usr/bin/env python3
"""The quick menu's icons, from design 9227:176057 (SOUND / MUSIC / INFO).

The design draws each row's icon as pixel art — a stepped speaker, a stepped note and a stepped
"i" — inside the same 49-unit stepped tile the bottom bar's small buttons use (hud/frame.webp), so
the tiles are not rebuilt here. The page had smooth vector glyphs in plain square boxes, which read
as a different game's UI dropped over this one.

The design draws only the ON state. Muted sound and music keep the design's icon and get a slash
cut through it on the icon's own pixel grid (2.2 design units a step): a clear band along the
diagonal with a stepped line down its middle — the usual mute mark, drawn the way the icon is
drawn.

Sources in scripts/art/menu-9227-176057/ (the design's own vector exports). Writes, into
static/assets/veggie-salad/pixel/ui/:

    menu-sound.webp  menu-sound-off.webp  menu-music.webp  menu-music-off.webp  menu-info.webp

Run from anywhere:

    python3 apps/veggie-salad/scripts/build-menu.py
"""
from __future__ import annotations

import io
from pathlib import Path

import cairosvg
import numpy as np
from PIL import Image

APP = Path(__file__).resolve().parents[1]
ART = APP / 'scripts/art/menu-9227-176057'
OUT = APP / 'static/assets/veggie-salad/pixel/ui'
SCALE = 4
STEP = round(2.2 * SCALE)
INK = (242, 203, 140, 255)


def render(name: str) -> Image.Image:
    png = cairosvg.svg2png(url=str(ART / f'{name}.svg'), scale=SCALE)
    return Image.open(io.BytesIO(png)).convert('RGBA')


def slashed(im: Image.Image) -> Image.Image:
    """Top-left to bottom-right on the STEP grid: a cleared band four cells wide, then the line,
    two cells wide, down its middle — one cell wide it only touched at the corners."""
    a = np.array(im)
    h, w = a.shape[:2]
    cy, cx = np.mgrid[0:h, 0:w] // STEP
    rows, cols = -(-h // STEP), -(-w // STEP)
    # Cells right of the diagonal (which moves `cols / rows` cells right per row).
    off = cx - np.round(cy * cols / rows).astype(int)
    a[(off >= -1) & (off <= 2)] = 0
    a[(off >= 0) & (off <= 1)] = INK
    return Image.fromarray(a)


def save(name: str, im: Image.Image) -> None:
    im.save(OUT / f'{name}.webp', lossless=True, quality=100, method=6)
    print(f'{name:16} {im.size}')


def main():
    for name in ('sound', 'music'):
        icon = render(f'icon-{name}')
        save(f'menu-{name}', icon)
        save(f'menu-{name}-off', slashed(icon))
    save('menu-info', render('icon-info'))


if __name__ == '__main__':
    main()
