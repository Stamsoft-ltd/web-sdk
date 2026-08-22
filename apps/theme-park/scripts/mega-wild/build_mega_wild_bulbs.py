#!/usr/bin/env python3
"""Find the lit fittings on the MEGA WILD plaque, so the runtime can blink them.

    python3 scripts/mega-wild/build_mega_wild_bulbs.py

It writes:

  src/game/megaWildBulbs.ts
  scripts/mega-wild/verify_mega_wild_bulbs.png

WHAT IS BEING FOUND

The plaque (Figma 7057:7990) is a locomotive: a black boiler face carrying MEGA WILD, two gold
columns either side, a funnel on top and a bar across the bottom. Six things on it are LIGHTS —
a purple jewel on the funnel, a purple jewel on each column, an orange jewel on the bottom bar, and
the two big cream headlamps. Everything else that is gold is structure, or lettering: the M, E, G
and A are gold discs to a blob detector and are very nearly as round as a lamp.

So the lights are found by their GLASS rather than by their gold. Each is a well-filled, roughly
circular patch of one of three colours the structure never takes: saturated purple, saturated
orange, or the pale cream of a lit lamp. That alone still lets a stray fragment through — a corner
of the purple shoulder plate, pinched between the boiler oval and the left column, comes out round
and about the right size — so the last filter is the plaque's own SYMMETRY: a fitting either sits on
the centre line or it has a partner mirrored across it. The shoulder fragment has no partner (its
mirror image is cut differently by the oval) and drops out. Nothing here is typed in by hand.

HOW BIG EACH ONE IS

A fitting is glass plus the gold bezel around it, and it is the whole fitting that lights. Three of
the six have a bezel a blob detector can see on its own: the funnel jewel's and both headlamps'.
The other three do not — the column jewels' bezels merge into the gold columns and the orange gem's
into the gold bar, and a flood fill runs straight out of them into the structure.

Those three measured bezels come out at 2.02, 2.12 and 2.15 times their own glass radius. That
spread is a third of a pixel, which says the drawing uses ONE bezel proportion throughout, so the
same ratio gives the other three their size. Applied back to the three it was measured from it
reproduces their bezels to within a pixel; the script prints that check every run.

The radius is taken from the glass's AREA rather than its bounding box, because several of these
have their outline nicked by whatever they sit on and a box grows to fit the nick.
"""

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PLAQUE = ROOT / "static/assets/theme-park/v2/modes/mega-wild-desktop-marquee.png"
TABLE = ROOT / "src/game/megaWildBulbs.ts"
VERIFY = Path(__file__).resolve().parent / "verify_mega_wild_bulbs.png"

# How round and how solid a patch of glass has to be. A lamp is a disc; the structure's coloured
# parts are plates and bars, which fail one or both of these.
MIN_ASPECT, MAX_ASPECT = 0.75, 1.35
MIN_FILL = 0.68
MIN_AREA = 90

# How far off the mirror line a pair may sit and still count as a pair, as a fraction of the width —
# and how close to the centre line a single fitting has to be to stand alone. Three pixels.
MIRROR_SLACK = 0.02

# Fittings within this much of each other vertically are one ROW, and the chase reads a row left to
# right. Without it the two headlamps, which differ by a pixel, would be chased out of order.
ROW_HEIGHT = 0.05


def classes(rgb, ink):
    """The three colours of glass on this plaque, and the gold that bezels them."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return {
        "purple": ink & (r > 140) & (b > 140) & (g < 120) & (abs(r - b) < 70),
        "orange": ink & (r > 200) & (g > 70) & (g < 170) & (b < 90),
        # Cream, not gold: the lit lamps keep some blue where the structural gold has almost none.
        "cream": ink & (r > 235) & (g > 200) & (b > 85) & (b < 200),
    }, ink & (r > 220) & (g > 150) & (g < 215) & (b < 85)


def blobs(mask, floor):
    """Every connected run of `mask` with at least `floor` pixels, 8-connected."""
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
            if len(pixels) >= floor:
                found.append(np.array(pixels))
    return found


def measure(pixels):
    ys, xs = pixels[:, 0], pixels[:, 1]
    width, height = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
    return {
        "n": len(pixels),
        "cx": xs.mean(),
        "cy": ys.mean(),
        "aspect": width / height,
        "fill": len(pixels) / (np.pi * ((width + height) / 4) ** 2),
        "box": (xs.min(), ys.min(), xs.max(), ys.max()),
        "radius": np.sqrt(len(pixels) / np.pi),
        "pixels": pixels,
    }


def num(value):
    return f"{value:.4f}".rstrip("0").rstrip(".") or "0"


def main():
    image = Image.open(PLAQUE).convert("RGBA")
    frame = np.asarray(image).astype(int)
    height, width = frame.shape[:2]
    glass_masks, gold_mask = classes(frame[..., :3], frame[..., 3] > 128)

    lamps = []
    for glass, mask in glass_masks.items():
        for pixels in blobs(mask, MIN_AREA):
            lamp = measure(pixels)
            if (
                MIN_ASPECT < lamp["aspect"] < MAX_ASPECT
                and lamp["fill"] > MIN_FILL
                and lamp["n"] >= MIN_AREA
            ):
                lamp["glass"] = glass
                lamps.append(lamp)

    # Symmetry. Everything real on this plaque is either on the centre line or half of a pair.
    kept = []
    for lamp in lamps:
        own = lamp["cx"] / width
        if abs(own - 0.5) <= MIRROR_SLACK:
            kept.append(lamp)
            continue
        if any(
            other is not lamp and abs((1 - other["cx"] / width) - own) <= MIRROR_SLACK
            for other in lamps
        ):
            kept.append(lamp)
        else:
            print(f"  dropped: unpaired {lamp['glass']} at ({own:.4f}, {lamp['cy'] / height:.4f})")

    # The bezel proportion, from the fittings whose bezel a flood fill can reach on its own.
    bezels = [measure(pixels) for pixels in blobs(gold_mask, 60)]
    ratios = []
    for lamp in kept:
        around = [
            bezel
            for bezel in bezels
            if bezel["box"][0] <= lamp["cx"] <= bezel["box"][2]
            and bezel["box"][1] <= lamp["cy"] <= bezel["box"][3]
            and bezel["n"] > lamp["n"]
            and MIN_ASPECT < bezel["aspect"] < MAX_ASPECT
        ]
        if not around:
            continue
        bezel = min(around, key=lambda bezel: bezel["n"])
        x0, y0, x1, y1 = bezel["box"]
        lamp["measured"] = (x1 - x0 + y1 - y0 + 2) / 4
        ratios.append(lamp["measured"] / lamp["radius"])
    if len(ratios) < 2:
        raise SystemExit(f"only {len(ratios)} bezels found — cannot establish the proportion")
    ratio = float(np.mean(ratios))
    print(f"bezel is {ratio:.3f}x its glass, from {len(ratios)} measured: " + ", ".join(f"{r:.2f}" for r in ratios))
    for lamp in kept:
        lamp["fitting"] = lamp["radius"] * ratio
        if "measured" in lamp:
            print(
                f"  check {lamp['glass']:6s}: derived {lamp['fitting']:.1f}px "
                f"vs measured {lamp['measured']:.1f}px"
            )

    # Top to bottom, then left to right within a row: the order the chase runs in.
    kept.sort(key=lambda lamp: (round(lamp["cy"] / height / ROW_HEIGHT), lamp["cx"]))

    rows = []
    for lamp in kept:
        ys, xs = lamp["pixels"][:, 0], lamp["pixels"][:, 1]
        colour = np.median(frame[ys, xs, :3], axis=0).astype(int)
        rows.append(
            f"\t{{ x: {num(lamp['cx'] / width)}, y: {num(lamp['cy'] / height)}, "
            f"r: {num(lamp['fitting'] / width)}, "
            f"colour: 0x{colour[0]:02x}{colour[1]:02x}{colour[2]:02x} }},"
        )
        print(
            f"{lamp['glass']:6s} at ({lamp['cx'] / width:.4f}, {lamp['cy'] / height:.4f}) "
            f"r={lamp['fitting'] / width:.4f} #{colour[0]:02x}{colour[1]:02x}{colour[2]:02x}"
        )
    TABLE.write_text(HEADER + "\n".join(rows) + "\n];\n")
    print(f"wrote {TABLE.relative_to(ROOT)}")

    # The verify sheet: the plaque, and beside it the plaque with every fitting ringed at the size
    # the runtime will light it. A ring that misses its lamp is visible; a number is not.
    check = Image.new("RGBA", (width * 2 + 24, height), (26, 26, 34, 255))
    check.alpha_composite(image, (0, 0))
    marked = np.asarray(image).copy()
    yy, xx = np.mgrid[0:height, 0:width]
    for lamp in kept:
        distance = np.hypot(xx - lamp["cx"], yy - lamp["cy"])
        ring = np.abs(distance - lamp["fitting"]) < 1.2
        marked[ring] = (80, 255, 120, 255)
    check.alpha_composite(Image.fromarray(marked.astype(np.uint8), "RGBA"), (width + 24, 0))
    check.save(VERIFY)
    print(f"wrote {VERIFY.relative_to(ROOT)}")


HEADER = """import type { SymbolBulb } from './symbolBulbs';

/**
 * The six lit fittings on the MEGA WILD plaque: a jewel on the funnel, one on each column, one on
 * the bottom bar, and the two headlamps.
 *
 * GENERATED by `scripts/mega-wild/build_mega_wild_bulbs.py` — edit that, not this. Found by their
 * GLASS, sized by the bezel proportion the drawing uses throughout, and filtered by the plaque's own
 * symmetry; see the script for why each of those is the honest measurement. Re-run it whenever the
 * plaque is re-exported.
 *
 * Ordered top-to-bottom then left-to-right, which is the order the chase runs in. `colour` is the
 * measured colour of each one's glass, so the purple jewels do not light amber.
 *
 * This is not in `symbolBulbs.ts` with the rest because there is no MEGA WILD board symbol to key it
 * off: the plaque is a full-reel overlay that 'W' happens to render as. <Board> picks it by sprite.
 */
export const MEGA_WILD_BULBS: SymbolBulb[] = [
"""


main()
