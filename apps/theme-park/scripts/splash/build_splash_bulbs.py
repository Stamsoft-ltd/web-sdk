#!/usr/bin/env python3
"""Cut the splash park's lamps out into layers that can be blinked.

    python3 scripts/splash/build_splash_bulbs.py

It writes:

  static/assets/theme-park/v2/splash/bulbs-1.webp   (and -2, -3)
  scripts/splash/verify_splash_bulbs.png

WHY LAYERS AND NOT COORDINATES

The park's lamps are painted into `background.webp`. Everywhere else in this game a light is a
measured coordinate that the runtime draws a glow at (`symbolBulbs.ts`, `megaWildBulbs.ts`) — but
those all sit on pixi sprites whose size and position the runtime already knows. The splash is HTML,
and its background is an `object-fit: cover` <img>: the box the browser gives that element is NOT
the box the picture is painted in, so an absolutely-positioned dot on top of it lands wherever the
crop happens to put it. There is no CSS unit for "where the image actually is".

An IMAGE, though, lands exactly where another image of the same aspect lands. So the glows are baked
into layers of their own — same 1680x936 frame, same `object-fit: cover` — and the runtime animates
nothing but each layer's opacity. Three layers, with consecutive lamps along a row dealt into
different ones, so what runs along the eave is a chase and not one big flash. That is also how a real
marquee is wired: alternate bulbs on alternate circuits.

FINDING THEM

A lamp is a small, round, HOT patch of warm colour, and the sky at dusk gives it very little
competition — nothing else in this picture is that bright and that orange at once. What comes back
is the two carousel eaves and their under-rails, the street lamp, the wheel's hub and the lit windows
of the castle gate. The wheel's gondolas are red pods with no glass and are correctly left out.

The radius comes from the patch's AREA rather than its bounding box: several of these are clipped by
the rail they hang from, and a box grows to fit the clip where an area does not.
"""

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SPLASH = ROOT / "static/assets/theme-park/v2/splash"
BACKGROUND = SPLASH / "background.webp"
VERIFY = Path(__file__).resolve().parent / "verify_splash_bulbs.png"

LAYERS = 3

# What counts as a lit lamp. Bright, warm, and never bluer than it is green — which is what keeps the
# lavender highlights on the coaster track and the pale stripes of the tents out of it.
MIN_RED, MIN_GREEN = 225, 180
# A lamp is a disc. These drop the streaks of specular highlight along the carousel's gold trim.
MIN_AREA = 5
MIN_ASPECT, MAX_ASPECT = 0.55, 1.8
MIN_FILL = 0.5

# The smallest lamps here are barely two pixels across, and a glow that size is invisible once the
# splash is scaled down. This is the floor the bloom is measured from, not the lamp's own size.
MIN_RADIUS = 1.6
# How far the bloom reaches, in lamp radii, and how hard it is at the centre. The layer is composited
# with `screen`, so this is added light: it can only ever brighten what is under it.
BLOOM = 3.2
PEAK = 0.8
# The falloff. Squarer than linear, so the lamp keeps a defined core instead of turning into a smudge.
FALLOFF = 1.8

# Lamps within this many pixels of each other vertically are one ROW, and a row is dealt out left to
# right. Without it the deal follows raw y and neighbours on the same eave land on the same circuit.
ROW_HEIGHT = 14


def blobs(mask):
    height, width = mask.shape
    seen = np.zeros_like(mask)
    found = []
    for start_y in range(height):
        for start_x in range(width):
            if not mask[start_y, start_x] or seen[start_y, start_x]:
                continue
            queue = deque([(start_y, start_x)])
            seen[start_y, start_x] = True
            pixels = []
            while queue:
                y, x = queue.popleft()
                pixels.append((y, x))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = y + dy, x + dx
                        if (
                            0 <= ny < height
                            and 0 <= nx < width
                            and mask[ny, nx]
                            and not seen[ny, nx]
                        ):
                            seen[ny, nx] = True
                            queue.append((ny, nx))
            found.append(np.array(pixels))
    return found


def main():
    image = Image.open(BACKGROUND).convert("RGB")
    width, height = image.size
    frame = np.asarray(image).astype(int)
    r, g, b = frame[..., 0], frame[..., 1], frame[..., 2]
    # `g < r + 8` keeps it warm; `b < g` keeps it out of the sky.
    mask = (r > MIN_RED) & (g > MIN_GREEN) & (g < r + 8) & (b < g)

    lamps = []
    for pixels in blobs(mask):
        ys, xs = pixels[:, 0], pixels[:, 1]
        box_w, box_h = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
        fill = len(pixels) / (np.pi * ((box_w + box_h) / 4) ** 2)
        if len(pixels) < MIN_AREA or not (MIN_ASPECT < box_w / box_h < MAX_ASPECT):
            continue
        if fill < MIN_FILL:
            continue
        lamps.append(
            {
                "cx": xs.mean(),
                "cy": ys.mean(),
                "radius": max(MIN_RADIUS, np.sqrt(len(pixels) / np.pi)),
                "colour": np.median(frame[ys, xs], axis=0),
            }
        )
    if not lamps:
        raise SystemExit("found no lamps — has the background been re-exported?")

    # Row by row, left to right, then dealt round-robin onto the circuits.
    lamps.sort(key=lambda lamp: (round(lamp["cy"] / ROW_HEIGHT), lamp["cx"]))
    for index, lamp in enumerate(lamps):
        lamp["layer"] = index % LAYERS

    yy, xx = np.mgrid[0:height, 0:width]
    counts = [0] * LAYERS
    for layer in range(LAYERS):
        glow = np.zeros((height, width, 4))
        for lamp in lamps:
            if lamp["layer"] != layer:
                continue
            counts[layer] += 1
            reach = lamp["radius"] * BLOOM
            distance = np.hypot(xx - lamp["cx"], yy - lamp["cy"])
            near = distance < reach
            alpha = PEAK * (1 - distance[near] / reach) ** FALLOFF
            # Straight alpha, one lamp at a time: they do not overlap, and taking the max rather than
            # adding means a lamp that does brush its neighbour stays a lamp rather than a hot spot.
            glow[..., 3][near] = np.maximum(glow[..., 3][near], alpha)
            for channel in range(3):
                # Toward white at the core, so the middle of a lamp burns out the way a lamp does.
                tint = lamp["colour"][channel] + (255 - lamp["colour"][channel]) * (
                    1 - distance[near] / reach
                )
                plane = glow[..., channel]
                plane[near] = np.where(alpha >= glow[..., 3][near] - 1e-9, tint, plane[near])
        out = Image.fromarray(
            np.clip(np.dstack([glow[..., :3], glow[..., 3] * 255]), 0, 255).astype(np.uint8), "RGBA"
        )
        out.save(SPLASH / f"bulbs-{layer + 1}.webp", lossless=False, quality=88)

    print(f"{len(lamps)} lamps across {LAYERS} circuits: " + ", ".join(map(str, counts)))
    for layer in range(LAYERS):
        size = (SPLASH / f"bulbs-{layer + 1}.webp").stat().st_size
        print(f"  bulbs-{layer + 1}.webp  {size / 1024:.1f}KB")

    # The verify sheet: the splash with every circuit screened over it at full, and beside it the
    # same picture with only circuit 1 lit — which is what a single beat of the chase looks like.
    def screened(chosen):
        under = np.asarray(image).astype(float)
        for layer in chosen:
            over = np.asarray(Image.open(SPLASH / f"bulbs-{layer + 1}.webp").convert("RGBA")).astype(float)
            lit = over[..., :3] * (over[..., 3:4] / 255)
            under = 255 - (255 - under) * (255 - lit) / 255
        return Image.fromarray(under.astype(np.uint8), "RGB")

    gap = 16
    check = Image.new("RGB", (width, height * 2 + gap), (26, 26, 34))
    check.paste(screened(range(LAYERS)), (0, 0))
    check.paste(screened([0]), (0, height + gap))
    check.resize((width // 2, (height * 2 + gap) // 2), Image.LANCZOS).save(VERIFY)
    print(f"wrote {VERIFY.relative_to(ROOT)}")


main()
