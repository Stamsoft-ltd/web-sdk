#!/usr/bin/env python3
"""Portrait bonus gardens (Figma frames 9262:211494 dusk, 9262:213551 night, 9262:215601 sunset).

On the 360-wide phone frame each bonus garden is a flat CSS sky and ground with one hill strip
behind the board. The strips are the same 1424x804 pixel-art master recoloured twice (an image
fill the design crops with "fill" scaling, mirrored for the night one) and, for the sunset, a
vectorised copy placed mirrored at x=905. This cuts exactly the 360-wide window each frame shows
and writes it as a transparent webp, 3x the frame:

    background/portrait/hills-dusk.webp     9262:225451 — 777 x 175.5 at (-260, 301)
    background/portrait/hills-night.webp    9262:225453 — 754 x 169.7, mirrored, spanning -45..709
    background/portrait/hills-sunset.webp   9262:225440 — 920 x 217.7, mirrored, spanning -15..905

Sources in scripts/art/portrait-gardens/ are the raw fills download_assets hands back (the
`export` is padded opaque white, so it is never used). Run from anywhere:

    python3 apps/veggie-salad/scripts/build-portrait-gardens.py
"""
from __future__ import annotations

from io import BytesIO
from pathlib import Path

import cairosvg
from PIL import Image, ImageOps

HERE = Path(__file__).resolve().parent
ART = HERE / 'art' / 'portrait-gardens'
OUT = HERE.parents[0] / 'static/assets/veggie-salad/pixel/background/portrait'
FRAME_W = 360
SCALE = 3


def fill_window(master: Image.Image, node_w: float, node_h: float, node_x: float, mirrored: bool):
    """The 360-wide slice of an image fill in "fill" mode (cover, centred) on a node."""
    s = max(node_w / master.width, node_h / master.height)
    off_y = (master.height * s - node_h) / 2
    # Frame x 0..360 in node-local coordinates, flipped back onto the unmirrored bitmap.
    x0, x1 = -node_x, FRAME_W - node_x
    if mirrored:
        x0, x1 = node_w - x1, node_w - x0
    box = (round(x0 / s), round(off_y / s), round(x1 / s), round((off_y + node_h) / s))
    win = master.crop(box)
    if mirrored:
        win = ImageOps.mirror(win)
    return win.resize((FRAME_W * SCALE, round(node_h * SCALE)), Image.NEAREST)


def save(im: Image.Image, name: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / name
    im.save(path, 'WEBP', lossless=True)
    print(f'{path.relative_to(HERE.parents[0])}  {im.size[0]}x{im.size[1]}  {path.stat().st_size}B')


def main() -> None:
    dusk = Image.open(ART / 'dusk-hills-9262-225451.png').convert('RGBA')
    save(fill_window(dusk, 777, 175.55, -260, mirrored=False), 'hills-dusk.webp')

    night = Image.open(ART / 'night-hills-9262-225453.png').convert('RGBA')
    # x=709 is the mirrored node's origin; it spans 709-754 = -45 to 709.
    save(fill_window(night, 754, 169.71, -45, mirrored=True), 'hills-night.webp')

    png = cairosvg.svg2png(url=str(ART / 'sunset-hills-9262-225440.svg'), scale=SCALE)
    sunset = ImageOps.mirror(Image.open(BytesIO(png)).convert('RGBA'))
    # Spans -15..905 mirrored: the frame's 0..360 is node-local 15..375.
    save(sunset.crop((15 * SCALE, 0, 375 * SCALE, sunset.height)), 'hills-sunset.webp')


if __name__ == '__main__':
    main()
