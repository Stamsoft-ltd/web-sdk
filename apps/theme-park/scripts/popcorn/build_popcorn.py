#!/usr/bin/env python3
"""Take the popcorn apart so its kernels can pop.

The redesigned popcorn (Figma 7052:7937) is a striped bucket with a heap of popcorn in it and half a
dozen loose kernels flying around the outside. The design ships those loose kernels as their own
drawings — three of them, big (7052:7945), medium (7052:7943) and small (7052:7941) — and ships the
bucket without them (7063:17848), which is exactly the split the win presentation needs: the bucket
stands still and the kernels are thrown by code, so they pop out of the heap and fall past the
symbol instead of hanging in the air where the artist parked them.

    python3 scripts/popcorn/build_popcorn.py

It writes:

  static/assets/theme-park/v2/symbols/h4-popcorn-marquee.png
  static/assets/theme-park/v2/symbols/popcorn-kernel-{a,b,c}.webp
  src/game/popcornParts.ts
  scripts/popcorn/verify_popcorn.png

WHY IT IS BUILT THIS WAY

Every symbol in this game is drawn in a 448x360 frame and these design nodes sit in a 112x90 one, so
a x4 export lands on our frame at the size the artist drew it. The exports are opaque on #f5f5f5
paper, which is flooded out from the BORDER rather than keyed by colour everywhere, so the white
highlights on the kernels stay part of the drawing. Same as scripts/wild and scripts/duck-sign — read
either for the long version.

The bucket is not LOCATED by correlation the way the duck's wings were, because it cannot be: the
lone bucket and the bucket inside the composition are two different drawings of the same thing (the
heap is rounder in one and taller in the other), so there is no pixel run to match. What they do
share is a size — 224x296 against 227x300, under two percent apart, which is what says the two
exports are at the same scale and neither needs resampling. So the lone bucket is placed by CENTRING
its ink on the ink of the composition's bucket, which is the composition's largest connected run: the
loose kernels are separate islands and drop out of it for free.

The mouth the kernels are thrown from is measured the same way — a horizontal cut across the heap,
`MOUTH_DEPTH` of the way down the bucket, whose ink span gives both where the crown is and how wide
it is. Nothing about it is typed in.
"""

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent / "source"
SYMBOL_DIR = ROOT / "static/assets/theme-park/v2/symbols"
TABLE = ROOT / "src/game/popcornParts.ts"
VERIFY = Path(__file__).resolve().parent / "verify_popcorn.png"

FRAME = (448, 360)
# Where the design puts the composition inside its 112x90 frame, times four. Its own node box, and
# the only thing the composition is used for besides the verify sheet: it is what says where on the
# frame the bucket belongs.
COMPOSITION_AT = (64, 16)

PAPER = np.array([245, 245, 245])
PAPER_TOLERANCE = 10

# How far down the bucket to cut when measuring the crown of the heap, as a share of the bucket's
# height. Chosen off the heap's own profile: the drawing is 8px wide at its very top and does not
# reach the width of the tub until 35% down, so a cut any higher would throw every kernel out of a
# single point and any lower would throw them out of the tub's sides.
MOUTH_DEPTH = 0.15

# stem -> the design node it came from, for the generated comment. Order is the order they are
# emitted in, which is what makes the burst read as mixed sizes rather than as three separate runs.
KERNELS = [("a", "7052:7943"), ("b", "7052:7945"), ("c", "7052:7941")]


def keyed(path):
    """The export with its paper flooded out from the border."""
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(int)
    h, w, _ = rgb.shape
    paper = np.abs(rgb - PAPER).max(axis=2) <= PAPER_TOLERANCE
    seen = np.zeros((h, w), bool)
    queue = deque()
    for y, x in [(y, x) for y in range(h) for x in (0, w - 1)] + [
        (y, x) for x in range(w) for y in (0, h - 1)
    ]:
        if paper[y, x] and not seen[y, x]:
            seen[y, x] = True
            queue.append((y, x))
    while queue:
        y, x = queue.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and paper[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                queue.append((ny, nx))
    return np.dstack([rgb, np.where(seen, 0, 255)]).astype(int)


def largest_run(mask):
    """The biggest connected region of `mask`, as its (x0, y0, x1, y1) box.

    8-connected, so the anti-aliased seam where the tub meets its own outline does not split the
    bucket into two halves and hand back only the larger one.
    """
    h, w = mask.shape
    seen = np.zeros((h, w), bool)
    best = None
    for sy, sx in zip(*np.nonzero(mask)):
        if seen[sy, sx]:
            continue
        queue = deque([(sy, sx)])
        seen[sy, sx] = True
        points = []
        while queue:
            y, x = queue.popleft()
            points.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    queue.append((ny, nx))
        if best is None or len(points) > len(best):
            best = points
    points = np.array(best)
    return points[:, 1].min(), points[:, 0].min(), points[:, 1].max(), points[:, 0].max()


def ink_box(part):
    """The part's drawn extent, ignoring the transparent margin its export carries."""
    ys, xs = np.nonzero(part[..., 3] > 0)
    return xs.min(), ys.min(), xs.max(), ys.max()


def rgba(array):
    return Image.fromarray(array.astype(np.uint8), "RGBA")


def num(value):
    """Four decimal places, trailing zeros trimmed — what Prettier would leave behind."""
    return f"{value:.4f}".rstrip("0").rstrip(".") or "0"


def main():
    composition = keyed(SOURCE / "composition.png")
    bucket = keyed(SOURCE / "bucket.png")

    # Where the composition puts its bucket, in frame coordinates.
    cx0, cy0, cx1, cy1 = largest_run(composition[..., 3] > 0)
    target = (
        COMPOSITION_AT[0] + (cx0 + cx1 + 1) / 2,
        COMPOSITION_AT[1] + (cy0 + cy1 + 1) / 2,
    )
    bx0, by0, bx1, by1 = ink_box(bucket)
    bucket_w, bucket_h = bx1 - bx0 + 1, by1 - by0 + 1
    print(
        f"bucket: {bucket_w}x{bucket_h} of ink against the composition's "
        f"{cx1 - cx0 + 1}x{cy1 - cy0 + 1} — {100 * abs(bucket_h / (cy1 - cy0 + 1) - 1):.1f}% apart"
    )
    # Placed by its INK, not by its export box, because the two drawings carry different margins.
    at = (round(target[0] - bx0 - bucket_w / 2), round(target[1] - by0 - bucket_h / 2))
    base = Image.new("RGBA", FRAME, (0, 0, 0, 0))
    base.alpha_composite(rgba(bucket), at)
    base.save(SYMBOL_DIR / "h4-popcorn-marquee.png")
    print(f"placed at {at}, wrote symbols/h4-popcorn-marquee.png")

    # The crown of the heap, in frame coordinates: where the kernels are thrown from and how wide a
    # band they come out of.
    row = round(by0 + MOUTH_DEPTH * bucket_h)
    crown = np.nonzero(bucket[row, :, 3] > 0)[0]
    mouth = (at[0] + (crown.min() + crown.max() + 1) / 2, at[1] + row)
    spread = (crown.max() - crown.min() + 1) / 2
    print(f"mouth: ({mouth[0]:.0f}, {mouth[1]:.0f}) in the frame, {2 * spread:.0f} wide")

    sizes = []
    for stem, node in KERNELS:
        kernel = keyed(SOURCE / f"kernel-{stem}.png")
        kx0, ky0, kx1, ky1 = ink_box(kernel)
        ink = rgba(kernel[ky0 : ky1 + 1, kx0 : kx1 + 1])
        # webp: these are three tiny sprites drawn dozens at a time, and at 92 they are a fifth of
        # the PNG with nothing visible lost at the size they are drawn.
        ink.save(SYMBOL_DIR / f"popcorn-kernel-{stem}.webp", quality=92, method=6, alpha_quality=100)
        sizes.append((stem, node, ink.width, ink.height))
        print(f"kernel {stem}: {ink.width}x{ink.height} of ink ({node})")

    entries = "".join(
        f"\t// {node}\n"
        f"\t{{ key: 'tpPopcornKernel{stem.upper()}', width: {num(w / FRAME[0])}, "
        f"height: {num(h / FRAME[1])} }},\n"
        for stem, node, w, h in sizes
    )
    TABLE.write_text(
        HEADER
        + "export const POPCORN_MOUTH: PopcornMouth = {\n"
        f"\tx: {num(mouth[0] / FRAME[0])},\n"
        f"\ty: {num(mouth[1] / FRAME[1])},\n"
        f"\tspread: {num(spread / FRAME[0])},\n"
        "};\n\n"
        "export const POPCORN_KERNELS: PopcornKernel[] = [\n" + entries + "];\n"
    )
    print(f"wrote {TABLE.relative_to(ROOT)}")

    # Left: what ships, with one of each kernel dropped on the mouth so the throw point is visible.
    # Right: the design's own composition, for the shape of the thing.
    check = Image.new("RGBA", (FRAME[0] * 2 + 24, FRAME[1]), (26, 26, 34, 255))
    rebuilt = base.copy()
    for index, (stem, _, w, h) in enumerate(sizes):
        kernel = Image.open(SYMBOL_DIR / f"popcorn-kernel-{stem}.webp")
        offset = (index - 1) * spread * 0.8
        rebuilt.alpha_composite(kernel, (round(mouth[0] + offset - w / 2), round(mouth[1] - h / 2)))
    check.alpha_composite(rebuilt, (0, 0))
    check.alpha_composite(rgba(composition), (FRAME[0] + 24 + COMPOSITION_AT[0], COMPOSITION_AT[1]))
    check.save(VERIFY)
    print(f"wrote {VERIFY.relative_to(ROOT)}")


HEADER = """/**
 * The popcorn symbol's loose kernels, and where they are thrown from.
 *
 * GENERATED by `scripts/popcorn/build_popcorn.py` — edit that, not this. The symbol ships as a
 * bucket with nothing flying around it plus these three kernel drawings, so that a win can pop them
 * out of the heap and let them fall; see <PopcornBurst>.
 *
 * Every number is a fraction of the symbol FRAME, origin top-left, so they survive any change to how
 * big the symbol is drawn. `x`/`y` are the centre of the crown of the heap and `spread` is its
 * half-width, which is the band kernels are launched across.
 */
export type PopcornMouth = { x: number; y: number; spread: number };
export type PopcornKernel = { key: string; width: number; height: number };

"""


main()
