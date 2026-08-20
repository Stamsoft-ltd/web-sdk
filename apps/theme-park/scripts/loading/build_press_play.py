"""Cuts the Press Play loading mark out of its Figma vectors.

Design: Figma Aw2jKodPiSHlDLcYjaNjbo node 7003:4499 — a twelve-state component set where the
rounded logo plate fills red left-to-right as loading runs, and the "Press Play" wordmark joins it
at 100%.

We do NOT ship the twelve states. The fill is a straight horizontal wipe, so two copies of the same
mark — one grey, one red — with a rectangle mask between them reproduces every state the design
draws AND every state between them, for two small files instead of twelve. See LoadingScreen.svelte.

Input is the SVG export of the FINAL state (`full.svg`), which carries all three pieces:
the grey plate, the red plate and the white glyph, plus the wordmark alongside.

    MARK_RAW=path/to/full.svg python3 build_press_play.py
"""

from __future__ import annotations

import io
import os
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import cairosvg
from PIL import Image

NS = '{http://www.w3.org/2000/svg}'
HERE = Path(__file__).resolve().parent
APP = HERE.parent.parent
OUT = APP / 'static/assets/theme-park/v2/loading'
RAW = Path(os.environ.get('MARK_RAW', HERE / 'full.svg'))

# The mark is authored at 86x86 and the whole lockup at 356x86. Rasterised at 4x, which is well
# past the size either is ever drawn at (the mark tops out around 180 CSS px on a desktop loader)
# and still only a couple of kB — these are flat vector shapes, so webp lossless barely grows.
SCALE = 4
MARK_SIZE = 86
GREY = '#E3E3E3'
RED = '#D1300B'


def load() -> ET.Element:
    if not RAW.exists():
        sys.exit(f'missing {RAW} — export node 7003:4576 as SVG first')
    return ET.parse(RAW).getroot()


def find_group(root: ET.Element, group_id: str) -> ET.Element:
    for node in root.iter(f'{NS}g'):
        if node.attrib.get('id') == group_id:
            return node
    sys.exit(f'group {group_id!r} not found in {RAW}')


def paths_of(node: ET.Element) -> list[ET.Element]:
    return list(node.iter(f'{NS}path'))


def svg_document(view_box: str, width: float, height: float, paths: list[str]) -> str:
    body = '\n'.join(paths)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view_box}" '
        f'width="{width}" height="{height}">{body}</svg>'
    )


def path_markup(node: ET.Element, fill: str | None = None) -> str:
    d = node.attrib['d']
    colour = fill or node.attrib.get('fill', 'black')
    return f'<path d="{d}" fill="{colour}"/>'


def render(svg: str, width: int, height: int) -> Image.Image:
    png = cairosvg.svg2png(
        bytestring=svg.encode(), output_width=width, output_height=height, background_color=None
    )
    return Image.open(io.BytesIO(png)).convert('RGBA')


def trim(image: Image.Image) -> tuple[Image.Image, tuple[int, int, int, int]]:
    box = image.getbbox()
    return image.crop(box), box


def save(image: Image.Image, name: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / name
    image.save(target, 'WEBP', lossless=True, quality=100)
    print(f'  {name:24} {image.width:4}x{image.height:<4} {target.stat().st_size / 1024:6.1f} kB')


def main() -> None:
    root = load()

    frame = find_group(root, 'Frame 427321459')
    plate_grey, plate_red, *glyph = paths_of(frame)
    if plate_grey.attrib.get('fill') != GREY or plate_red.attrib.get('fill') != RED:
        sys.exit('unexpected plate order — re-check the export against the design')

    glyph_markup = [path_markup(node) for node in glyph]
    box = f'0 0 {MARK_SIZE} {MARK_SIZE}'
    size = MARK_SIZE * SCALE

    print('press play mark:')
    for name, plate in (('mark-empty.webp', plate_grey), ('mark-full.webp', plate_red)):
        document = svg_document(box, size, size, [path_markup(plate), *glyph_markup])
        save(render(document, size, size), name)

    # The wordmark keeps its own bounding box rather than the lockup's, so the loader can place it
    # by its own width instead of carrying the mark's empty space around with it.
    word = find_group(root, 'Group_3')
    word_markup = [path_markup(node) for node in paths_of(word)]
    lockup_w = 356
    document = svg_document(f'0 0 {lockup_w} {MARK_SIZE}', lockup_w * SCALE, size, word_markup)
    trimmed, bbox = trim(render(document, lockup_w * SCALE, size))
    print('wordmark:')
    save(trimmed, 'wordmark.webp')

    # Where the wordmark sits in the lockup, as fractions of the MARK's width — the loader scales
    # everything off the mark, which is the piece whose size the design actually fixes.
    left, top, right, bottom = (value / SCALE for value in bbox)
    print('\n// lockup geometry, in mark widths (paste into LoadingScreen.svelte)')
    print(f'const WORDMARK_X = {left / MARK_SIZE:.5f};   // left edge, from the mark\'s left edge')
    print(f'const WORDMARK_Y = {top / MARK_SIZE:.5f};')
    print(f'const WORDMARK_W = {(right - left) / MARK_SIZE:.5f};')
    print(f'const WORDMARK_H = {(bottom - top) / MARK_SIZE:.5f};')


if __name__ == '__main__':
    main()
