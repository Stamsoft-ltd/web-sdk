"""Turn the balloons' cut-out highlight into a highlight.

Every balloon in this set — the four masters the H3 symbol is built from, and the five that drift up
through the plaza sky — is drawn with a big oval on its shoulder in #f5f5f5. That is FIGMA'S PAPER
COLOUR, not a colour the artist mixed: the highlight is a hole punched through the balloon, and on
the white page it was drawn against it read as gloss. On our night sky it reads as exactly what it
is, a hole, and a reviewer called it "strange white inside" (2026-08-28).

It also FLICKERS, and for a reason worth writing down. The balloon is drawn at about 62px wide from
a 150px sprite while it sways, breathes and recedes, so every frame resamples it at a slightly
different subpixel phase. A hard-edged near-white shape against saturated paint is the worst thing
you can hand that: the edge crawls, and the eye reads the crawl on the highest-contrast feature in
the picture as a flicker. Nothing else on the balloon does it, because nothing else on the balloon
is white.

So this does two things, and only these two — the SHAPE and SIZE of the highlight are the artist's
drawing and are left exactly as they are:

* **It stops being a hole.** The oval is repainted as `GLOSS` of white over the balloon's own body
  colour, sampled from the paint just outside it, so a pink balloon gets a pink-white gloss and an
  orange one an orange-white. That is what a highlight on a coloured surface actually looks like,
  and at a little over half strength it has roughly half the contrast to alias with.
* **It stops being hard.** The edge is feathered by `FEATHER` of the oval's own span — a SHARE, not
  a pixel count, so it survives the eleven-fold downscale from master to symbol unchanged and means
  the same thing whether it is applied to a 1051px master or a 150px sprite.

`soften` is idempotent by construction: it finds its work by looking for paper-coloured pixels, and
after one pass there are none, so a second run is a no-op and says so.
"""

from collections import deque

import numpy as np
from PIL import Image, ImageFilter

#: Figma's page colour, which is what the highlight was punched through to.
PAPER = 245
#: How far off it a pixel may be, per channel, and still be that hole rather than paint.
PAPER_TOLERANCE = 12

#: How white the repainted gloss is, against the body colour underneath it.
GLOSS = 0.55
#: How far the edge is feathered, as a share of the highlight's own longest span.
FEATHER = 0.035
#: How far out to look for the body colour the gloss is mixed against, as a share of the highlight's
#: span. A share for the same reason the feather is one — this runs on a 1051px master and on a
#: 150px sprite — and this wide because the highlight is drawn with an outline of its own, and the
#: whole of that line has to be stepped over to reach the paint.
RING = 0.17
#: Darker than this on every channel and it is the drawing's line, not paint. The art's outline is a
#: true black; nothing else on a balloon comes near it.
LINE = 90


def _largest_run(mask):
    """The biggest 4-connected region of `mask`, as a mask of its own."""
    height, width = mask.shape
    seen = np.zeros((height, width), bool)
    best = None
    for start_y, start_x in zip(*np.nonzero(mask)):
        if seen[start_y, start_x]:
            continue
        queue = deque([(start_y, start_x)])
        seen[start_y, start_x] = True
        points = [(start_y, start_x)]
        while queue:
            y, x = queue.popleft()
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < height and 0 <= nx < width and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    points.append((ny, nx))
                    queue.append((ny, nx))
        if best is None or len(points) > len(best):
            best = points
    run = np.zeros((height, width), bool)
    for y, x in best:
        run[y, x] = True
    return run


def soften(image):
    """One balloon with its highlight repainted, or `None` if it has not got one.

    `None` rather than an unchanged copy, so a caller can tell "already done" from "done again" and
    print it — which is the whole of this function's idempotency story.
    """
    pixels = np.asarray(image.convert("RGBA")).astype(int)
    hole = (pixels[..., 3] > 250) & (np.abs(pixels[..., :3] - PAPER).max(axis=2) <= PAPER_TOLERANCE)
    if not hole.any():
        return None

    # The largest run, not every paper pixel: a stray one on the outline's rim is resampling, and
    # repainting it would only smear the line.
    mask = _largest_run(hole)
    ys, xs = np.nonzero(mask)
    span = max(xs.max() - xs.min(), ys.max() - ys.min()) + 1

    stamp = Image.fromarray((mask * 255).astype(np.uint8), "L")
    coverage = np.asarray(stamp.filter(ImageFilter.GaussianBlur(max(1.0, FEATHER * span))))
    coverage = coverage.astype(float) / 255.0

    # The paint around the hole. Taken from an annulus rather than from the pixels touching it,
    # because the highlight carries its own black outline: sampled at a couple of pixels the "body
    # colour" comes back as rgb(9, 7, 5) and the gloss is mixed against ink. The ring reaches past
    # that line, and the line and any paper still inside it are dropped from the sample, so what is
    # left is paint — the median then ignores the gold dots, which are a minority of any ring.
    reach = max(3, int(round(RING * span)) | 1)
    ring = (np.asarray(stamp.filter(ImageFilter.MaxFilter(reach))) > 128) & ~mask
    ring &= pixels[..., 3] > 250
    ring &= pixels[..., :3].max(axis=2) > LINE
    ring &= np.abs(pixels[..., :3] - PAPER).max(axis=2) > PAPER_TOLERANCE
    if not ring.any():
        raise ValueError("no paint around the highlight to mix the gloss against")
    body = np.median(pixels[..., :3][ring], axis=0)
    gloss = body * (1 - GLOSS) + 255 * GLOSS

    out = pixels.astype(float)
    for channel in range(3):
        # Fill the hole with body colour FIRST, then lay the feathered gloss over the lot — so the
        # feather fades into paint rather than into the paper it is replacing.
        filled = np.where(mask, body[channel], out[..., channel])
        out[..., channel] = filled * (1 - coverage) + gloss[channel] * coverage
    # The highlight is drawn with a black outline of its own, like everything else in this set, and
    # the feather reaches over it. Put the line back: every shape on these balloons is outlined, and
    # the one with its line washed out is the one that stops looking drawn.
    line = pixels[..., :3].max(axis=2) <= LINE
    out[line] = pixels[line]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA"), int(mask.sum()), body
