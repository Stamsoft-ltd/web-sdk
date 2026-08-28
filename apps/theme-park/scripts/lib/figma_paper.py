"""Cut a Figma export off the paper it was drawn on, edges and all.

Figma exports are always OPAQUE: a drawing arrives sitting on this file's #f5f5f5 paper. Every build
script here knocks that paper out by flooding in from the border rather than by keying near-white
everywhere, because an enclosed white is usually the drawing — a specular highlight, a white letter
outline, the counter of an O.

The flood alone is not enough, and that is what this module exists for. A flood gives a pixel two
answers, paper or drawing, and the pixels it STOPS at have a third one: they are the drawing's own
antialiasing, a mix of the outline colour and the paper, and a hard key ships them fully opaque and
pale. On a purple board a black-outlined symbol then reads as though it were cut out with a white
edge left on, and it reads jagged as well, since a hard key throws the antialiasing away.

So the rim is solved instead of assumed. A rim pixel is a blend `observed = a*colour + (1-a)*paper`,
and the colour behind it is known — it is the nearest pixel the flood could not reach. That yields
the coverage `a` the renderer used, measured on whichever channels sit far enough from the paper to
measure anything, and the drawing's true colour follows by division.

    from lib.figma_paper import keyed
    rgba = keyed(path)                 # int array, H x W x 4
    rgba = keyed(path, holes=True)     # also clear the paper the flood cannot reach

`holes` is for a drawing that encloses background rather than white ink — the coaster emblem is a
knot with twenty loops in it, and left opaque they ship as white patches hanging inside the symbol.
It is off by default because for most drawings an enclosed white IS the drawing.
"""

from collections import deque

import numpy as np
from PIL import Image

# This file's paper, and how far a pixel may stray from it and still count as paper.
PAPER = np.array([245, 245, 245])
PAPER_TOLERANCE = 10
# How far the drawing's antialiasing reaches past where the flood stops, and how faint a rim pixel
# may be before it is dropped rather than divided out — below this, recovering a colour is dividing
# noise by noise.
FRINGE = 2
ALPHA_FLOOR = 0.08
# A channel can only measure coverage if the drawing's colour is this far from the paper's on it. On
# the others — white ink on white paper — the division says nothing.
CONTRAST = 40


def paper_mask(rgb):
    return np.abs(rgb - PAPER).max(axis=2) <= PAPER_TOLERANCE


def flood_from_border(paper):
    """The paper a flood started at the border can reach: background, as opposed to enclosed white."""
    height, width = paper.shape
    seen = np.zeros((height, width), bool)
    queue = deque()
    for y, x in [(y, x) for y in range(height) for x in (0, width - 1)] + [
        (y, x) for x in range(width) for y in (0, height - 1)
    ]:
        if paper[y, x] and not seen[y, x]:
            seen[y, x] = True
            queue.append((y, x))
    while queue:
        y, x = queue.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < height and 0 <= nx < width and paper[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                queue.append((ny, nx))
    return seen


def grow(mask, steps):
    """`mask` spread by `steps` pixels, four-connected."""
    out = mask.copy()
    for _ in range(steps):
        spread = out.copy()
        spread[1:, :] |= out[:-1, :]
        spread[:-1, :] |= out[1:, :]
        spread[:, 1:] |= out[:, :-1]
        spread[:, :-1] |= out[:, 1:]
        out = spread
    return out


def nearest_colour(rgb, core, reach):
    """Every pixel within `reach` of `core`, given the colour of the nearest core pixel to it.

    Breadth-first outward from the core, so a rim pixel takes the colour of the drawing it belongs to
    rather than of whatever else happens to be `reach` away.
    """
    colour = np.where(core[..., None], rgb, 0).astype(float)
    have = core.copy()
    for _ in range(reach):
        for axis, step in ((0, 1), (0, -1), (1, 1), (1, -1)):
            source = np.roll(have, step, axis=axis)
            source_colour = np.roll(colour, step, axis=axis)
            if axis == 0:
                (source[0] if step == 1 else source[-1]).fill(False)
            else:
                (source[:, 0] if step == 1 else source[:, -1]).fill(False)
            take = source & ~have
            colour[take] = source_colour[take]
            have |= take
    return colour


def unmatte(rgb, clear):
    """`rgb` as RGBA, with `clear` knocked out and the paper divided back out of the rim around it.

    Only the rim is touched: a white pixel deeper in the drawing is never adjacent to the paper and
    keeps its opacity.
    """
    alpha = np.where(clear, 0.0, 1.0)
    rim = grow(clear, FRINGE) & ~clear
    if rim.any():
        colour = nearest_colour(rgb, ~clear & ~rim, FRINGE + 1)
        gap = PAPER[None, None, :] - colour
        measurable = np.abs(gap) > CONTRAST
        coverage = np.divide(
            PAPER[None, None, :] - rgb,
            np.where(measurable, gap, 1),
            out=np.zeros(rgb.shape, float),
            where=measurable,
        )
        counted = measurable.sum(axis=2)
        # Where no channel can measure it, the drawing is as pale as the paper just there; leave it
        # opaque rather than guess it away.
        solved = np.where(counted > 0, coverage.sum(axis=2) / np.maximum(counted, 1), 1.0)
        alpha[rim] = np.clip(solved, 0.0, 1.0)[rim]
        recovered = np.divide(
            rgb - PAPER[None, None, :] * (1 - alpha[..., None]),
            np.maximum(alpha[..., None], ALPHA_FLOOR),
            out=rgb.astype(float),
            where=alpha[..., None] > 0,
        )
        rgb = np.where(rim[..., None], np.clip(recovered, 0, 255), rgb)
        alpha[rim & (alpha < ALPHA_FLOOR)] = 0.0
    return np.dstack([rgb, np.round(alpha * 255)]).astype(int)


def keyed(path, holes=False):
    """One Figma export, off its paper: an int RGBA array shaped H x W x 4."""
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(int)
    paper = paper_mask(rgb)
    return unmatte(rgb, paper if holes else flood_from_border(paper))
