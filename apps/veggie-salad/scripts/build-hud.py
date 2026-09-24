#!/usr/bin/env python3
"""The bottom bar's furniture, from design 9456:158078 (the HUD strip, "Group 123").

The design draws every control as pixel art: each small button is a 49-unit frame of stepped
vectors (dark fill, orange keyline, notched corners), BONUS is a 126x54 stepped orange plate with a
highlight, and the spin button is a stepped orange coin under a separate glowing arrow. The icons
inside are uploaded rasters. The page had been approximating all of it in CSS — square boxes, a
flat rectangle, a smooth disc — which is what "this is not fixed" (user, 2026-09-24) pointed at.

Sources in scripts/art/hud-9456-158078/: the three SVG exports (each carries the page's #F5F5F5
backdrop rect, and the button/spin exports embed their icon; both are stripped here so the frame
and the icon stay separate layers) and the icon rasters (the design's transparent originals).

Writes, into static/assets/veggie-salad/pixel/hud/:

    frame.webp  frame-pressed.webp  bonus.webp  spin-coin.webp  spin-arrow.webp
    icon-menu.webp  icon-minus.webp  icon-plus.webp  icon-auto.webp
    icon-turbo.webp  icon-turbo-on.webp  icon-turbo-max.webp

Run from anywhere:

    python3 apps/veggie-salad/scripts/build-hud.py
"""
from __future__ import annotations

import io
import re
from pathlib import Path

import cairosvg
import numpy as np
from PIL import Image

APP = Path(__file__).resolve().parents[1]
ART = APP / 'scripts/art/hud-9456-158078'
OUT = APP / 'static/assets/veggie-salad/pixel/hud'
SCALE = 4
# The design's gold for an engaged control (the BONUS plate's face).
GOLD = (247, 150, 12)


def vector(name: str) -> Image.Image:
    svg = (ART / name).read_text()
    # The export's page backdrop, and any rect filled from an embedded image (the icon).
    svg = re.sub(r'<rect width="[\d.]+" height="[\d.]+" fill="#F5F5F5"/>', '', svg, count=1)
    svg = re.sub(r'<rect [^>]*fill="url\(#pattern[^"]*\)"[^>]*/>', '', svg)
    png = cairosvg.svg2png(bytestring=svg.encode(), scale=SCALE)
    return Image.open(io.BytesIO(png)).convert('RGBA')


def icon(name: str, height: int) -> Image.Image:
    im = Image.open(ART / name).convert('RGBA')
    im = im.crop(im.getbbox())
    return im.resize((round(im.width * height / im.height), height), Image.LANCZOS)


def tinted(im: Image.Image, colour) -> Image.Image:
    a = np.array(im)
    a[..., :3] = colour
    return Image.fromarray(a)


def save(name: str, im: Image.Image) -> None:
    im.save(OUT / f'{name}.webp', lossless=True, quality=100, method=6)
    print(f'{name:18} {im.size}')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    frame = vector('button-9456-156724.svg')
    save('frame', frame)
    # Pressed: the design has no pressed frame, so the fill warms toward the keyline's orange.
    a = np.array(frame).astype(int)
    fill = (np.abs(a[..., :3] - [56, 31, 2]).max(axis=2) < 12) & (a[..., 3] > 200)
    a[fill, :3] = [104, 60, 6]
    save('frame-pressed', Image.fromarray(a.astype('uint8')))
    save('bonus', vector('bonus-9456-156634.svg'))
    save('spin-coin', vector('spin-9456-155006.svg'))
    save('spin-arrow', icon('icon-spin-arrow.png', 88 * SCALE))

    save('icon-menu', icon('icon-menu.png', 16 * SCALE))
    save('icon-auto', icon('icon-auto.png', 12 * SCALE))
    bolt = icon('icon-turbo.png', 26 * SCALE)
    save('icon-turbo', bolt)
    save('icon-turbo-on', tinted(bolt, GOLD))
    pair = Image.new('RGBA', (round(bolt.width * 1.7), bolt.height))
    pair.alpha_composite(tinted(bolt, GOLD), (0, 0))
    pair.alpha_composite(tinted(bolt, GOLD), (pair.width - bolt.width, 0))
    save('icon-turbo-max', pair)
    minus = icon('icon-minus.png', 4 * SCALE)
    save('icon-minus', minus)
    side = minus.width
    plus = Image.new('RGBA', (side, side))
    plus.alpha_composite(minus, (0, (side - minus.height) // 2))
    plus.alpha_composite(minus.rotate(90, expand=True), ((side - minus.height) // 2, 0))
    save('icon-plus', plus)


if __name__ == '__main__':
    main()
