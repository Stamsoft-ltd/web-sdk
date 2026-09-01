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

    from lib.figma_paper import keyed, resized, turned
    rgba = keyed(path)                  # int array, H x W x 4
    rgba = keyed(path, holes=True)      # also clear the paper the flood cannot reach
    art = resized(image, (w, h))        # and RESAMPLE it without pulling the paper back in
    art = turned(image, degrees)        # the same, for a rotation

`holes` is for a drawing that encloses background rather than white ink — the coaster emblem is a
knot with twenty loops in it, and left opaque they ship as white patches hanging inside the symbol.
It is off by default because for most drawings an enclosed white IS the drawing.

`resized` and `turned` are the other half of the job, and the half it is easy to miss. Knocking the
paper out sets a pixel's ALPHA to zero; it does not change the colour underneath, which is still the
paper. Pillow resamples RGBA in STRAIGHT alpha — it mixes those colours as if they counted — so the
moment a keyed layer is scaled to fit a frame or turned to its rest pose, the paper this module
removed is stirred back into every edge and ships as the pale fringe all over again, one resample
later. That is what put a white line along the ROLLER WILDS coaster loops (reviewer, 2026-08-28).

Resampling PREMULTIPLIED is the fix: a transparent pixel then carries no colour to contribute, so an
edge can only be a mix of the drawing with itself. Use these two for EVERY filtered resample of art
that has been through `keyed` — a nearest-neighbour resample is exempt, since it never mixes two
pixels, and so is a resample of a fully opaque image, which has no transparent colour to pull in.
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
# How far the drawing's colour is carried out into the cleared region. Further than a bilinear tap
# or the first couple of mip levels can reach, which is all anything that filters this can see.
REACH = 12
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
    rather than of whatever else happens to be `reach` away. Returns the colours and the mask of
    which pixels were actually reached.
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
    return colour, have


def unmatte(rgb, clear):
    """`rgb` as RGBA, with `clear` knocked out and the paper divided back out of the rim around it.

    Only the rim is touched: a white pixel deeper in the drawing is never adjacent to the paper and
    keeps its opacity.
    """
    alpha = np.where(clear, 0.0, 1.0)
    rim = grow(clear, FRINGE) & ~clear
    if rim.any():
        colour, _ = nearest_colour(rgb, ~clear & ~rim, FRINGE + 1)
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


def bled(rgba):
    """`rgba` with the drawing's own colour carried out into the transparent region around it.

    THE PAPER IS STILL THERE AFTER THE KEY. Knocking it out sets a pixel's ALPHA to zero and leaves
    its COLOUR exactly as it was — #f5f5f5 — and a colour under a zero alpha is not invisible to
    anything that FILTERS. Pillow mixes it into every edge it resamples, and so does the GPU: pixi
    draws these at whatever size the board is, so a bilinear sample straddling the outline reads one
    texel of ink and one of paper and returns the average. That is a pale rim around the symbol, in
    the browser, out of a file that looks perfectly clean in an image viewer — `wheel-rim.webp`
    shipped with an average of 168 under its zero alpha (reviewer, 2026-08-28).

    So the cleared region is filled with the nearest ink instead: `REACH` pixels of it, which is
    further than any sampler reaches, and the rest left alone because nothing can see it. Alpha is
    untouched — this changes what an edge blends TOWARDS, never what is drawn.
    """
    rgb, alpha = rgba[..., :3], rgba[..., 3]
    ink = alpha > 0
    if not ink.any() or ink.all():
        return rgba
    colour, reached = nearest_colour(rgb, ink, REACH)
    filled = np.where((reached & ~ink)[..., None], colour, rgb)
    return np.dstack([filled, alpha]).astype(int)


def premultiplied(image):
    """`image` with each channel scaled by its own alpha, ready to be resampled."""
    array = np.asarray(image.convert("RGBA")).astype(float)
    alpha = array[..., 3:] / 255.0
    return Image.fromarray(
        np.clip(np.dstack([array[..., :3] * alpha, array[..., 3]]), 0, 255).astype(np.uint8), "RGBA"
    )


def straight(image):
    """`premultiplied` undone: the colour a pixel would have at full opacity, or nothing at all.

    Exact where it matters — a pixel the filter left fully transparent keeps no colour, so there is
    never a division of nothing by nothing.
    """
    array = np.asarray(image.convert("RGBA")).astype(float)
    alpha = array[..., 3:] / 255.0
    colour = np.divide(array[..., :3], alpha, out=np.zeros_like(array[..., :3]), where=alpha > 0)
    return Image.fromarray(
        np.clip(np.dstack([colour, array[..., 3]]), 0, 255).astype(np.uint8), "RGBA"
    )


def resized(image, size, resample=Image.LANCZOS):
    """`image` at `size`, resampled premultiplied — see the note on the paper coming back above."""
    return straight(premultiplied(image).resize(size, resample))


def turned(image, degrees, resample=Image.BICUBIC, expand=True, centre=None):
    """`image` turned by `degrees`, resampled premultiplied. Same reason as `resized`."""
    return straight(
        premultiplied(image).rotate(degrees, resample=resample, expand=expand, center=centre)
    )


def keyed(path, holes=False):
    """One Figma export, off its paper: an int RGBA array shaped H x W x 4.

    Bled, so that neither this repo's resampling nor the browser's can find the paper again.
    """
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(int)
    paper = paper_mask(rgb)
    return bled(unmatte(rgb, paper if holes else flood_from_border(paper)))
