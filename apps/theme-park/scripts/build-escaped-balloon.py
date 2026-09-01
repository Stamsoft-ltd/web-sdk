#!/usr/bin/env python3
"""Cut the single balloon that drifts up through the plaza sky out of the h3 symbol art.

    python3 scripts/build-escaped-balloon.py

The front balloon of `symbols/h3-balloons-marquee.webp` is the only one in that bunch nothing overlaps,
so it is the one shape in the project that can be lifted whole — body, knot and its curly ribbon.

The ribbon comes WITH it rather than being drawn at runtime. A drawn one can lag behind the balloon's
sway, which a baked one cannot, and that is worth having; it is not worth what it costs here. Nothing
strokable matches this art — the ribbon in it is a corkscrew with a black outline, a bright core and a
knot it grows out of — so a stroked line reads as a different drawing hanging off the balloon, and any
gap at the knot reads as a tail that came unattached. <EscapedBalloon> pivots the whole sprite near
the balloon's top instead, which swings the ribbon under it the way its lift actually would.

## What changed with the art

This used to cut the rendered h3 symbol and then blur it, because the backdrop it flew over was
deliberately out of focus. Both of those are gone: the symbol set was redrawn flat (2026-08-18) and
the plaza was redrawn sharp, so the balloon ships crisp, at full saturation, with the black outline
and the gold rim the rest of the set has.

## How the cut works

The balloons are drawn as closed black outlines, so the front one can be FLOOD-FILLED out of the
bunch: fill its interior, then push that fill outward by the thickness of its frame. The frame is
three strokes — a thin black line, a gold rim, and a black line outside that — and offsetting the
silhouette takes all three at once and in one piece, where adding "every black pixel near the fill"
picks up whatever of the balloons BEHIND happens to run alongside and leaves the cut with whiskers.

The knot is a second closed shape, and its fill is boxed in. Its outline has a gap where the ribbon
joins it, and an unbounded fill escapes through that gap into the sliver between this balloon and
the ones behind it — which is itself closed, so the leak is silent and comes out as a halo.

## And why the hue rotation is masked

Every balloon in the set has the SAME gold rim and gold dots — only the body colour changes. Rotating
the whole sprite's hue would take the gold with it and land the orange variant with a green rim, so
the rotation is applied to the body's own pink only.
"""

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "static/assets/theme-park/v2/symbols/h3-balloons-marquee.webp"
OUTPUT_DIR = ROOT / "static/assets/theme-park/v2/balloon"
VERIFY = Path(__file__).resolve().parent / "verify-escaped-balloon.png"

#: A point well inside the front balloon's body, and one inside its knot.
BODY_SEED = (222, 155)
KNOT_SEED = (221, 232)
#: The knot's fill is boxed to this rect — see the note above about the gap its outline has.
KNOT_BOX = (208, 218, 238, 245)

#: The ribbon is taken by COLOUR, not by fill: it pinches to a single pixel where it turns, and a
#: flood run down it stops at the pinch. Nothing else in this box is pink — the ribbons on either
#: side belong to the blue and the green balloon — so the colour test has it to itself.
RIBBON_BOX = (200, 238, 245, 335)
RIBBON = lambda a: (
    (a[..., 3] > 200) & (a[..., 0] > 170) & (a[..., 1] < 110) & (a[..., 2] > 80) & (a[..., 2] < 190)
)
#: Its outline is thinner than the balloon's frame, and offsetting a two-pixel curl by the balloon's
#: 8 would fill the curl in solid.
RIBBON_FRAME = 3

#: What counts as the drawn outline. The art's line is a true black; nothing else on the balloon is.
BLACK = lambda a: (a[..., 3] > 100) & (a[..., 0] < 80) & (a[..., 1] < 80) & (a[..., 2] < 80)
#: The frame's thickness in source pixels — black line, gold rim, black line, measured across the
#: balloon's equator. One more than this and the cut starts taking slivers off the balloons behind.
FRAME = 8

#: A little air around the cut so the outline's own antialiasing is not clipped by the frame. Small,
#: because nothing is blurred any more.
PAD = 4

#: Native width of each exported variant. The balloon draws at roughly 3% of canvas width — ~48px on
#: a full-HD stage — so this is already twice what it needs on the sharpest screen.
EXPORT_WIDTH = 150

# ── The body colour ─────────────────────────────────────────────────────────────────────────────
#
# Target hues in degrees. The source body measures 332 (magenta) and the rotation works in offsets
# off that. Picked against the plaza: it already has pink, orange, yellow, green and blue balloons in
# its own painted bunches, and an escapee should look like it came from one of them.
SOURCE_HUE = 332
VARIANTS = {
    "pink": 332,
    "orange": 28,
    "yellow": 48,
    "green": 112,
    "blue": 205,
}
#: Which pixels are the BODY, in HSV degrees / 0-255. Hue near the source's magenta and saturated
#: enough to be paint rather than the outline's edge — which leaves the gold rim, the gold dots, the
#: white highlight and the black line exactly where they are.
BODY_HUE_REACH = 34
BODY_MIN_SATURATION = 90
BODY_MIN_VALUE = 60


def flood(free, seed, box=None):
    """Every pixel reachable from `seed` without crossing a clear pixel of `free`, inside `box`."""
    h, w = free.shape
    x0, y0, x1, y1 = box or (0, 0, w, h)
    seen = np.zeros_like(free)
    seen[seed[1], seed[0]] = True
    queue = deque([(seed[1], seed[0])])
    while queue:
        y, x = queue.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if x0 <= nx < x1 and y0 <= ny < y1 and free[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                queue.append((ny, nx))
    return seen


def offset(mask, radius):
    """`mask` pushed outward by `radius`, as a disc dilation."""
    grown = np.zeros_like(mask)
    h, w = mask.shape
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            if dx * dx + dy * dy > radius * radius:
                continue
            ys = slice(max(0, dy), h + min(0, dy))
            xs = slice(max(0, dx), w + min(0, dx))
            ty = slice(max(0, -dy), h + min(0, -dy))
            tx = slice(max(0, -dx), w + min(0, -dx))
            grown[ty, tx] |= mask[ys, xs]
    return grown


def cut():
    """The front balloon, its frame included and nothing of its neighbours, plus its body mask."""
    source = Image.open(SOURCE).convert("RGBA")
    a = np.asarray(source).astype(int)
    free = ~BLACK(a)

    body = flood(free, BODY_SEED)
    ribbon = np.zeros_like(body)
    x0, y0, x1, y1 = RIBBON_BOX
    ribbon[y0:y1, x0:x1] = RIBBON(a)[y0:y1, x0:x1]

    interior = body | flood(free, KNOT_SEED, KNOT_BOX) | ribbon
    mask = offset(body, FRAME) | offset(interior, RIBBON_FRAME)

    alpha = np.minimum(np.asarray(source.getchannel("A")), mask.astype(np.uint8) * 255)
    balloon = source.copy()
    balloon.putalpha(Image.fromarray(alpha))

    ys, xs = np.nonzero(mask)
    box = (
        max(0, xs.min() - PAD),
        max(0, ys.min() - PAD),
        min(source.width, xs.max() + 1 + PAD),
        min(source.height, ys.max() + 1 + PAD),
    )
    crop = lambda m: m[box[1] : box[3], box[0] : box[2]]
    #: The BODY's own silhouette — the balloon without its knot, framed — which is what the runtime
    #: sizes against, so re-cropping here cannot silently resize it on screen.
    return balloon.crop(box), crop(interior), crop(offset(body, FRAME))


def body_mask(image, interior):
    """The body's own paint: what the hue rotation is allowed to touch."""
    hsv = np.asarray(image.convert("RGB").convert("HSV")).astype(int)
    hue = hsv[..., 0] * 360 / 255
    distance = np.minimum(np.abs(hue - SOURCE_HUE), 360 - np.abs(hue - SOURCE_HUE))
    return (
        interior
        & (distance < BODY_HUE_REACH)
        & (hsv[..., 1] > BODY_MIN_SATURATION)
        & (hsv[..., 2] > BODY_MIN_VALUE)
    )


def rotate_hue(image, mask, degrees):
    """`degrees` around the hue wheel, applied only where `mask` is set."""
    if degrees == 0:
        return image, np.asarray(image.convert("RGB"))
    alpha = image.getchannel("A")
    hsv = np.asarray(image.convert("RGB").convert("HSV")).astype(np.int16)
    rotated = hsv.copy()
    rotated[..., 0] = (rotated[..., 0] + round(degrees * 255 / 360)) % 256
    hsv[mask] = rotated[mask]
    shifted = Image.fromarray(hsv.astype(np.uint8), "HSV").convert("RGB")
    rgb = np.asarray(shifted)
    shifted = shifted.convert("RGBA")
    shifted.putalpha(alpha)
    return shifted, rgb


def build():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    balloon, interior, silhouette = cut()
    body = body_mask(balloon, interior)
    height = round(balloon.height * EXPORT_WIDTH / balloon.width)

    for name, hue in VARIANTS.items():
        variant, _ = rotate_hue(balloon, body, (hue - SOURCE_HUE) % 360)
        variant = variant.resize((EXPORT_WIDTH, height), Image.Resampling.LANCZOS)
        # New filename, not a ?v= on the old one: the rendered sprites shipped under `{name}.webp`
        # and a cached one survives the swap and flies the old blurred blob over the new plaza.
        destination = OUTPUT_DIR / f"{name}-flat.webp"
        variant.save(destination, "WEBP", quality=94, method=6)
        print(f"{destination.relative_to(ROOT)}  {variant.width}x{variant.height}")

    # The runtime measures everything against the BODY — the balloon alone, without its knot and its
    # ribbon — so that re-cropping or re-framing here cannot silently resize it on screen.
    body_rows = np.nonzero(silhouette.any(1))[0]
    body_width = silhouette.sum(1).max()
    body_centre = (body_rows.min() + body_rows.max() + 1) / 2

    print("\nEscapedBalloon.svelte:")
    print(f"  SPRITE_ASPECT = {EXPORT_WIDTH} / {height};")
    print(f"  BODY_ASPECT = {body_width} / {body_rows.max() - body_rows.min() + 1};")
    print(f"  BODY_SHARE = {body_width / balloon.width:.4f};")
    print(f"  BODY_CENTRE = {body_centre / balloon.height:.4f};")
    print(f"  LIFT_SHARE = {(body_rows.min() + 1) / balloon.height:.4f};")

    # === THE SHEET ===
    # Every variant on the plaza's own sky blue at the size it actually flies, beside one drawn large.
    # A cut that clipped the outline or a hue rotation that took the gold with it are both obvious
    # here and invisible in the files.
    swatch = 200
    sheet = Image.new("RGBA", (swatch * len(VARIANTS), swatch + 120), (74, 168, 238, 255))
    draw = ImageDraw.Draw(sheet)
    for index, name in enumerate(VARIANTS):
        art = Image.open(OUTPUT_DIR / f"{name}-flat.webp").convert("RGBA")
        big = art.resize((swatch - 90, round((swatch - 90) * art.height / art.width)), Image.LANCZOS)
        sheet.alpha_composite(big, (index * swatch + 45, 10))
        small = art.resize((48, round(48 * art.height / art.width)), Image.LANCZOS)
        sheet.alpha_composite(small, (index * swatch + swatch // 2 - 24, swatch + 30))
        draw.text((index * swatch + 20, swatch + 8), name, fill=(255, 255, 255, 255))
    sheet.convert("RGB").save(VERIFY)
    print(f"\nwrote {VERIFY.relative_to(ROOT)}")


if __name__ == "__main__":
    build()
