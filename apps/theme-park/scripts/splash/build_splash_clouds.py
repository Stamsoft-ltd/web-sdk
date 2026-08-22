#!/usr/bin/env python3
"""Put the splash park's clouds back on their own layer, so they can drift.

    python3 scripts/splash/build_splash_clouds.py

It writes:

  static/assets/theme-park/v2/splash/cloud-{a,b,c,d}.webp
  src/game/splashClouds.ts
  scripts/splash/verify_splash_clouds.png

THEY DRAW OVER THE PICTURE, SO THEY HAVE TO EARN THEIR PLACE

Four loose clouds is the easy half — they are already separate drawings under source/. The hard half
is where to put them, because they are drawn straight over `background.webp` with nothing hiding
them.

There WAS a version of this that cut the sky out as a mask and drifted the clouds inside it, so the
coaster and the wheel occluded them. It was wrong, and instructively so: the coaster is a lattice of
rails and ties, and a per-column skyline scan stops at a different height in every column depending
on whether that column happens to fall in a gap. What a soft cloud looks like through that is a
picket fence — a barcode of thin vertical slivers hanging under the rail. Structures with holes in
them do not make good mattes.

So there is no matte. A cloud is simply placed where the sky is CLEAN — open gradient, no rails, no
treeline, for the whole of its travel — and then it can be drawn on top of everything without ever
landing on something it would have to be cut around.

THE SKYLINE IS SCANNED, NOT DRAWN

Down each column until the picture stops being sky. "Sky" is judged against the brightness of the
sky IN THAT ROW — a row's 78th percentile — rather than one threshold for the frame, because this
sky runs from near-black purple at the top to hot orange at the horizon and no single number
survives that. A cloud is brighter than the gradient it sits on, so the scan runs straight through
the painted ones instead of stopping at them; the silhouettes are all darker, so they stop it.

WHERE THE FOUR GO

Not from the design: the frame these were cut from has been renumbered and its composed version is
gone. They are placed instead, by search — but each is confined to its OWN COLUMN of the frame, so
the four span the whole width instead of bunching in the middle. Left to themselves they bunched:
the open middle scores best on every other test, so all four piled into it and both flanks sat
empty. Within its column a cloud goes where the most of it is visible and the least of it sits on
the busy edge of the skyline.

Clean is a HARD test now, and it is the one that does the work. When there was a matte, a cloud
running onto the coaster was free — it just got cut — so the test could be a preference. Drawn on
top, the same overlap is a cloud sitting in front of a rail, so nothing is placed unless nearly all
of it is on open gradient at both ends of both of its drifts.

A REGION, NOT A POSITION

The page puts the clouds somewhere different every time it loads, so what this emits per cloud is not
a point but the largest RECTANGLE of starting positions in which every point passes all of the tests
above. The page then picks anywhere inside it. That is the only honest way to randomise this: hand
the page a range and it can draw from it freely, hand it a point and a jitter and every draw is a
fresh gamble on whether the cloud has wandered onto a coaster rail.

Largest by area, found the usual way — for each row of the legal map, the biggest rectangle in the
histogram of how far the legal run extends upwards. The rectangles come out wide and shallow, which
suits the picture: this sky has far more room sideways than it has vertically.

AND NOT BEHIND THE FURNITURE

The first run put one of the four squarely behind the THEME PARK lockup, where it drifted for two
minutes without a pixel of it ever being visible. The splash draws a logo and a studio mark over
this sky, so those boxes are a HARD limit on where a cloud may go, not a preference — a preference
just moved it somewhere else fully hidden, since the sky it has to fit in is small and most of it is
behind the lockup. They are measured off SplashIntro.svelte in stage fractions, which transfer
directly: the stage is 1200x670 and the art is 1680x936, so `cover` neither crops nor letterboxes it
in any meaningful way. The feature cards are not listed — they sit below y=0.43, which is under the
skyline and out of reach of anything placed here.
"""

from pathlib import Path
from random import Random

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent / "source"
SPLASH = ROOT / "static/assets/theme-park/v2/splash"
BACKGROUND = SPLASH / "background.webp"
TABLE = ROOT / "src/game/splashClouds.ts"
VERIFY = Path(__file__).resolve().parent / "verify_splash_clouds.png"

# How much darker than its row's sky a pixel may be and still count as sky.
SKY_TOLERANCE = 26
SKY_PERCENTILE = 78

# Each cloud: the column of the frame it is placed in, the band of heights it is placed within, and
# how it moves. `drift` is how far it travels sideways, as a fraction of the frame width, over
# `seconds` there-and-back; `rise` is how far it sinks, as a fraction of the frame HEIGHT, over
# `rise_seconds`. Short, but not as slow as it first was: at two minutes a crossing nothing on this
# screen appeared to move at all, and the splash is looked at for seconds, not minutes.
#
# The two periods per cloud are deliberately awkward against each other and against every other
# cloud's, and that is what makes this look like weather. A cloud drifting on one period retraces the
# same line for ever; give the vertical its own, and the path never closes, so no two passes are
# alike and the four never fall into step. The rises are small — a cloud that visibly climbs is a
# balloon.
#
# `width` is how wide it is drawn, as a fraction of the frame: the four
# exports are at four different scales, so their own sizes say nothing about how big they belong.
#
# The columns are what spread them out, and they run 0.15 to 0.67 rather than edge to edge because
# that is the whole of this frame that HAS clean sky in it. The left flank is a coaster and the right
# is a ferris wheel, and once a cloud has to sit on open gradient rather than hide behind a matte,
# neither flank has a gap big enough to stand a cloud in: measured, the largest of the four has legal
# room only between 0.42 and 0.61, and even the smallest runs out at 0.74. The smallest is the one
# sent furthest left for that reason — and even it can only go in a strip along the very top edge,
# because the tree canopy in the top-left corner reaches the frame edge and leaves no sky under it.
#
# The BANDS are all near the top, and there is no choice about it. The logo lockup fills the middle
# of the frame from y=0.17 down to y=0.46 and is drawn OVER these, so a cloud in any of the three
# middle columns has to clear 0.17 to be seen at all — and the tallest of them is 0.14 of the frame
# on its own. What is left is the strip along the top, which is at least what a band of high cloud
# actually looks like.
#
# A column bounds the cloud's CENTRE at the middle of its
# drift, not its left edge: bounding the edge would mean the widest cloud needed the widest column,
# which is backwards, since it is the widest one that has the least room to be fussy about.
CLOUDS = [
    {"stem": "cloud-b", "column": (0.15, 0.24), "band": (0.00, 0.02), "width": 0.13,
     "drift": 0.055, "seconds": 55, "rise": 0.017, "rise_seconds": 37},
    {"stem": "cloud-c", "column": (0.36, 0.44), "band": (0.02, 0.07), "width": 0.20,
     "drift": 0.060, "seconds": 47, "rise": 0.020, "rise_seconds": 31},
    {"stem": "cloud-d", "column": (0.46, 0.58), "band": (0.00, 0.03), "width": 0.30,
     "drift": 0.070, "seconds": 61, "rise": 0.014, "rise_seconds": 43},
    {"stem": "cloud-a", "column": (0.60, 0.66), "band": (0.02, 0.07), "width": 0.24,
     "drift": 0.050, "seconds": 73, "rise": 0.026, "rise_seconds": 29},
]

# Where the sky is not clean gradient — the fringe of trees along the horizon, the coaster's rails,
# anything the artist drew INTO the sky. Found as the parts of it that a heavy blur changes, then
# spread by this many pixels so a cloud keeps its distance rather than tucking up against a rail.
# The background itself is the cloudless render, so this no longer has painted clouds to avoid; it
# still matters, because a drifting cloud crossing a coaster rail at rest reads as a smudge.
#
# The margin is small on purpose. It was 12 while this was a preference the search minimised, where
# generous cost nothing. It is a hard test now, and at 12 the treeline and the coaster between them
# swallowed the whole left flank: every candidate failed and the run had nowhere to put a cloud.
PAINTED_BLUR = 18
PAINTED_DETAIL = 10
PAINTED_MARGIN = 4
# Nor behind what the splash draws on top of this sky. Left, top, right, bottom, as fractions of the
# frame. The logo: centred at (0.5004, 0.3142), 0.5408 wide, and 193 of 670 design px tall. The
# Press Play mark: 112.5 x 36.4 design px centred at (0.5002, 0.1436).
FURNITURE = [
    (0.230, 0.170, 0.771, 0.458),
    (0.453, 0.116, 0.547, 0.171),
]
# How much of a cloud has to be on clean sky — open gradient, no rails and no treeline — at every
# corner of the box its two drifts sweep out. Not 100%: these are soft-edged drawings whose outermost
# pixels are all but transparent, and demanding every one of them be clear leaves nowhere to stand.
CLEAN = 0.985
# And how much of it the lockup may cover. A hard limit rather than something to minimise, because
# what is emitted is a region every point of which must be worth drawing, not a single best point.
HIDDEN = 0.35
# How finely the region is searched, in pixels. The rectangle is reported in whole steps, so this is
# also how coarse the page's random draw is — 4px on a 1680px frame is far below noticing.
STEP = 4


def num(value):
    return f"{value:.4f}".rstrip("0").rstrip(".") or "0"


def sky_of(image):
    """A mask of everything above the skyline."""
    width, height = image.size
    frame = np.asarray(image).astype(float)
    luminance = frame @ np.array([0.299, 0.587, 0.114])
    row_sky = np.percentile(luminance, SKY_PERCENTILE, axis=1)
    sky_like = (row_sky[:, None] - luminance) < SKY_TOLERANCE
    mask = np.zeros_like(sky_like)
    for x in range(width):
        column = sky_like[:, x]
        mask[: (np.argmax(~column) if (~column).any() else height), x] = True
    return mask


def painted_clouds(image, sky):
    """The clouds already in the picture, so nothing is placed on one."""
    blurred = np.asarray(image.filter(ImageFilter.GaussianBlur(PAINTED_BLUR))).astype(float)
    detail = np.abs(np.asarray(image).astype(float) - blurred).max(axis=2)
    busy = Image.fromarray(((detail > PAINTED_DETAIL) & sky).astype(np.uint8) * 255)
    return np.asarray(busy.filter(ImageFilter.MaxFilter(PAINTED_MARGIN * 2 + 1))) > 127


def largest_rectangle(legal):
    """The biggest all-True axis-aligned rectangle, as (row, col, height, width).

    One pass per row, keeping for each column how far the True run reaches upward, and taking the
    largest rectangle in that histogram. The stack holds the columns whose bar is still rising, so
    each column is pushed and popped once and the whole thing is linear in the map.
    """
    best = None
    heights = np.zeros(legal.shape[1], int)
    for row in range(legal.shape[0]):
        heights = np.where(legal[row], heights + 1, 0)
        stack = []
        for col in range(legal.shape[1] + 1):
            bar = heights[col] if col < legal.shape[1] else 0
            start = col
            while stack and stack[-1][1] >= bar:
                start, tall = stack.pop()
                span = col - start
                if tall and (best is None or tall * span > best[2] * best[3]):
                    best = (row - tall + 1, start, tall, span)
            stack.append((start, bar))
    return best


def main():
    background = Image.open(BACKGROUND).convert("RGB")
    width, height = background.size
    sky = sky_of(background)
    taken = painted_clouds(background, sky)
    print(f"sky is {sky.mean():.1%} of the frame; {taken[sky].mean():.1%} of it is drawn-in detail")
    furniture = np.zeros_like(sky)
    for left, top, right, bottom in FURNITURE:
        furniture[
            round(top * height) : round(bottom * height), round(left * width) : round(right * width)
        ] = True
    print(f"the logo and the studio mark cover {furniture[sky].mean():.1%} more of it")

    # Integral images, so a footprint's coverage is four lookups rather than a slice sum.
    furniture_sum = np.pad(furniture.cumsum(0).cumsum(1), ((1, 0), (1, 0)))
    # Clean gradient: sky, with everything the artist drew INTO it taken back out.
    clean = sky & ~taken
    clean_sum = np.pad(clean.cumsum(0).cumsum(1), ((1, 0), (1, 0)))

    def area(table, x0, y0, w, h):
        x1, y1 = x0 + w, y0 + h
        return table[y1, x1] - table[y0, x1] - table[y1, x0] + table[y0, x0]

    rows = []
    for cloud in CLOUDS:
        art = Image.open(SOURCE / f"{cloud['stem']}.png").convert("RGBA")
        art = art.crop(art.getbbox())
        draw_w = round(cloud["width"] * width)
        draw_h = round(draw_w * art.height / art.width)
        art = art.resize((draw_w, draw_h), Image.LANCZOS)
        art.save(SPLASH / f"{cloud['stem']}.webp", lossless=False, quality=90)

        travel = round(cloud["drift"] * width)
        sink = round(cloud["rise"] * height)
        top_lo, top_hi = (round(b * height) for b in cloud["band"])
        # The column is on the centre, so turn it into the range of left edges that put it there.
        offset = (draw_w + travel) / 2
        left_lo = max(0, round(cloud["column"][0] * width - offset))
        left_hi = min(width - draw_w - travel, round(cloud["column"][1] * width - offset))
        area_of = draw_w * draw_h
        tops = range(top_lo, min(top_hi, height - draw_h - sink), STEP)
        lefts = range(left_lo, left_hi + 1, STEP)
        legal = np.zeros((len(tops), len(lefts)), bool)
        for row, y in enumerate(tops):
            for col, x in enumerate(lefts):
                # Judged at every CORNER of the box the two drifts sweep out, not just where it
                # starts — a cloud that is fine at rest and sitting on a rail a minute later is a
                # cloud that goes wrong while you watch it, and with two periods running it gets to
                # all four corners.
                corners = ((x, y), (x + travel, y), (x, y + sink), (x + travel, y + sink))
                if min(area(clean_sum, cx, cy, draw_w, draw_h) for cx, cy in corners) < CLEAN * area_of:
                    continue
                if max(area(furniture_sum, cx, cy, draw_w, draw_h) for cx, cy in corners) > HIDDEN * area_of:
                    continue
                legal[row, col] = True
        box = largest_rectangle(legal)
        if box is None:
            raise SystemExit(
                f"nowhere to put {cloud['stem']} in its column with {CLEAN:.0%} of it on clean sky "
                f"— give it a different column or band, or draw it smaller"
            )
        row0, col0, rows_high, cols_wide = box
        x0, x1 = lefts[col0], lefts[col0 + cols_wide - 1]
        y0, y1 = tops[row0], tops[row0 + rows_high - 1]
        print(
            f"{cloud['stem']}: {draw_w}x{draw_h} anywhere in x {x0}-{x1}, y {y0}-{y1} "
            f"({legal.mean():.0%} of its column is legal), drifting {travel}px over "
            f"{cloud['seconds']}s and sinking {sink}px over {cloud['rise_seconds']}s"
        )
        rows.append(
            f"\t{{ key: '{cloud['stem']}', "
            f"xMin: {num(x0 / width)}, xMax: {num(x1 / width)}, "
            f"yMin: {num(y0 / height)}, yMax: {num(y1 / height)}, "
            f"width: {num(draw_w / width)}, height: {num(draw_h / height)}, "
            f"drift: {num(travel / width)}, seconds: {cloud['seconds']}, "
            f"rise: {num(sink / height)}, riseSeconds: {cloud['rise_seconds']} }},"
        )
        cloud["place"] = (x0, x1, y0, y1, draw_w, draw_h, travel, sink)

    TABLE.write_text(HEADER + "\n".join(rows) + "\n];\n")
    print(f"wrote {TABLE.relative_to(ROOT)}")

    # The verify sheet: the splash at both ends of the drift and halfway, with the clouds masked to
    # the sky. If one crosses a coaster loop rather than passing behind it, this is where it shows.
    def composed(phase, draw):
        under = background.convert("RGBA").copy()
        layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        for cloud in CLOUDS:
            x0, x1, y0, y1, draw_w, draw_h, travel, sink = cloud["place"]
            x = draw.randint(x0, x1)
            y = draw.randint(y0, y1)
            art = Image.open(SPLASH / f"{cloud['stem']}.webp").convert("RGBA")
            # No single phase shows both extremes of both periods, so the sheet runs the sink
            # BACKWARDS against the drift — that way opposite corners of the box both get drawn.
            layer.alpha_composite(art, (round(x + travel * phase), round(y + sink * (1 - phase))))
        cut = np.asarray(layer).copy()
        cut[..., 3] = (cut[..., 3] * sky).astype(np.uint8)
        under.alpha_composite(Image.fromarray(cut, "RGBA"))
        return under.convert("RGB")

    # Three INDEPENDENT draws, each at a different phase — the sheet has to show that every load is
    # different and that none of them lands on a rail, so a single placement at three phases would
    # be checking the wrong thing. Seeded, so a rerun that changes nothing produces the same sheet.
    gap = 12
    draw = Random(20260822)
    sheet = Image.new("RGB", (width, height * 3 + gap * 2), (26, 26, 34))
    for index, phase in enumerate((0.0, 0.5, 1.0)):
        sheet.paste(composed(phase, draw), (0, index * (height + gap)))
    sheet.resize((width // 2, sheet.height // 2), Image.LANCZOS).save(VERIFY)
    print(f"wrote {VERIFY.relative_to(ROOT)}")


HEADER = """/**
 * The four drifting clouds on the splash: which piece of art, where it sits, and how far and how
 * slowly it travels.
 *
 * GENERATED by `scripts/splash/build_splash_clouds.py` — edit that, not this. Every number is a
 * fraction of the 1680x936 splash frame except the two durations, each of which is one full
 * there-and-back. The horizontal and vertical periods differ, which is the whole trick: a cloud on
 * one period retraces the same line for ever, and on two it never repeats a pass.
 *
 * The bounds are on the cloud's TOP-LEFT, not its centre, because that is what CSS wants and this
 * table has exactly one consumer. They are nothing to do with the design's own cloud positions: the
 * frame those were composed in has been renumbered and is gone. See the script.
 */
export type SplashCloud = {
\tkey: string;
\t/**
\t * The region this cloud may start in — top-left corner, as fractions of the frame. Pick anywhere
\t * inside and every one of the builder's tests still holds: clear of the rails, the treeline and
\t * the lockup at both ends of both of its drifts. It is a region and not a point because the page
\t * places the clouds afresh on every load; see the script for how the rectangle is found.
\t */
\txMin: number;
\txMax: number;
\tyMin: number;
\tyMax: number;
\twidth: number;
\t/**
\t * Drawn height, as a fraction of the frame. The element sizes itself off `width` and its own
\t * aspect, so this is here for one reason: `rise` below has to be turned into a percentage of
\t * the cloud, and the page has no other way to know how tall the cloud came out.
\t */
\theight: number;
\t/** How far it drifts right of `x`, as a fraction of the frame width. */
\tdrift: number;
\tseconds: number;
\t/** How far it sinks below `y`, as a fraction of the frame height. */
\trise: number;
\t/** Deliberately not a factor of `seconds`, so the path never closes. */
\triseSeconds: number;
};

export const SPLASH_CLOUDS: SplashCloud[] = [
"""


main()
