#!/usr/bin/env python3
"""The free-spins CONGRATS card (Figma McShmutzo 8808:12044, card group 8808:13038) → web art.

Sources are the nodes' transparent raw images in art-src/fs-congrats-8808/ (download_assets'
`export` is opaque white, never that):
  board_4.png  8808:13043  the red scalloped plaque (1535×1024)
  s39_1.png    one 1536×1024 splat SHEET shared by 8808:13039 / 13040 / 13041 / 13042 — each node
               shows a crop of it (the img's %-size/offset in get_design_context); cut here
  star_1.png   8808:13082  the yellow star
  pot_3.png    8808:13050  the soup pot in each spin-counter disc

    python3 scripts/build-fs-congrats.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'art-src/fs-congrats-8808'
OUT = ROOT / 'static/assets/mcschmutzo/fs-congrats'
OUT.mkdir(exist_ok=True)


def save(im: Image.Image, name: str, max_w: int | None = None):
    if max_w and im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    im.save(OUT / f'{name}.webp', 'WEBP', quality=90, method=6)
    print(name, im.size)


def trim(im: Image.Image) -> Image.Image:
    return im.crop(im.split()[3].point(lambda a: 255 if a > 8 else 0).getbbox())


# sheet crops = (−left/width, −top/height, 1/width, 1/height) of the node's img box, × sheet size
def sheet_crop(sheet: Image.Image, w_pct, h_pct, l_pct, t_pct):
    W, H = sheet.size
    x0, y0 = -l_pct / w_pct * W, -t_pct / h_pct * H
    return sheet.crop((round(x0), round(y0), round(x0 + W / w_pct), round(y0 + H / h_pct)))


board = Image.open(SRC / 'board_4.png').convert('RGBA')
save(board, 'board-v1', 1280)

sheet = Image.open(SRC / 's39_1.png').convert('RGBA')
# (node, name, w%, h%, left%, top%) — from get_design_context of 8808:13038
for node, name, w, h, l, t in [
    ('13042', 'ketchup-big', 3.5229, 3.8209, -0.0297, -2.7401),
    ('13041', 'mustard-big', 4.5444, 4.3025, -1.3377, -3.2005),
    ('13039', 'ketchup-drops', 8.9825, 6.0592, -4.7824, -4.7559),
    ('13040', 'mustard-drops', 7.68, 6.481, -4.9799, -5.1566),
]:
    save(sheet_crop(sheet, w, h, l, t), f'{name}-v1')

save(trim(Image.open(SRC / 'star_1.png').convert('RGBA')), 'star-v1', 200)
save(Image.open(SRC / 'pot_3.png').convert('RGBA'), 'pot-v1', 180)
