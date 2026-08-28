#!/usr/bin/env python3
"""Cut the balloon symbol into the six balloons it is made of, and measure where each one hangs.

The design draws this symbol as a bunch (Figma 7080:21576) and also ships the four balloons it is
built from — orange 7080:21571, pink 7080:21572, blue 7080:21573, green 7080:21574 — which is what
lets the bunch be alive: the balloons can bob on their strings while the board idles, and strain and
fly when the symbol wins. Six instances of four drawings: the blue and the orange each appear twice,
at different sizes and angles.

WHERE THEY GO IS FOUND, NOT READ. The children's Figma boxes are in the group's own untransformed
space and the group carries a transform, so the boxes disagree with the frame by different factors
on each axis (0.768 across, 0.826 down) — reading them would put every balloon in the wrong place.
So `--fit` searches each balloon's position, size and angle against the assembled design instead,
and the constants below are what it found. Three things make that search work:

* **It matches on COLOUR, not on pixels.** The bunch is the four drawings shrunk about eleven times,
  so every edge in it is resampled and no exact-pixel score survives. But each balloon is a
  different, saturated hue, and a hue survives anything.
* **It scores by INTERSECTION OVER UNION.** Score a balloon by how much of ITSELF lands on its
  colour and the winner is the smallest one that fits anywhere inside the blob; score it by how much
  of the BLOB it covers and the winner is the biggest one that swallows it. Both were tried, both
  collapsed onto an end of the search range. IoU is the one that has to agree on both.
* **It goes front to back, carrying a `covered` mask.** Four of the six are partly behind something,
  and a part is only scored where nothing sits over it.

The search is a cross-correlation done by FFT — every position at once, per size and angle. Written
as nested loops it did not finish; this way the whole fit takes under a minute.

EACH BALLOON HANGS FROM THE END OF ITS OWN STRING. That is the pivot the table stores, and the
reason the numbers below are converted out of the fit's centre-rotation into it: a balloon that
turns about its middle slides sideways, where one that turns about the end of its string bobs.

    python3 scripts/balloons/build_balloons.py            # build from the constants
    python3 scripts/balloons/build_balloons.py --fit      # re-derive them and print them

Writes symbols/h3-balloons-marquee.png (the rest pose, which is what the board's spin trail ghosts),
the four balloons as webp, src/game/balloonParts.ts, and verify_balloons.png to eyeball.
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent / "source"
SYMBOL_DIR = ROOT / "static/assets/theme-park/v2/symbols"
TABLE = ROOT / "src/game/balloonParts.ts"
VERIFY = Path(__file__).resolve().parent / "verify_balloons.png"

FRAME = (448, 360)

#: The four drawings, by the colour each one is.
MASTERS = {"orange": "21571", "pink": "21572", "blue": "21573", "green": "21574"}

#: Each balloon's body colour, for the fit. Sampled off the assembled design, not guessed.
PALETTE = {"orange": (240, 100, 8), "pink": (222, 24, 122),
           "blue": (0, 120, 216), "green": (26, 168, 74)}
#: How far off that colour a pixel may be, summed over the three channels, and still count.
NEAR = 110

#: The bunch, BACK TO FRONT, as `--fit` found it: colour, top-left, drawn size, degrees
#: counter-clockwise. The order is the design's own stacking, which is what the fit walked.
PLACEMENTS = [
    ("blue", 75, 42, 94, 172, 30),
    ("blue", 69, 103, 110, 202, 30),
    ("green", 218, 32, 101, 185, -19),
    ("orange", 163, 12, 113, 208, -1),
    ("orange", 178, 101, 113, 208, -30),
    ("pink", 158, 71, 130, 238, 0),
]

#: Headroom over the largest size any balloon is drawn at, so a balloon that swells as it flies is
#: not resampled up from its own pixels.
OVERSIZE = 1.5


def load(colour):
    """A balloon drawing, trimmed to its ink.

    These come from `download_assets`' `rawImages` rather than its `export`: the export arrives with
    the frame's paper baked in and fully opaque, and the raws include the artist's own transparent
    master at four times the size.
    """
    path = SOURCE / f"balloon-{MASTERS[colour]}.png"
    image = Image.open(path).convert("RGBA")
    ys, xs = np.nonzero(np.asarray(image)[..., 3] > 8)
    return image.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


def body(rgba, colour):
    """True where an image is this balloon's body colour."""
    red, green, blue = (rgba[..., i].astype(int) for i in range(3))
    want = PALETTE[colour]
    near = (abs(red - want[0]) + abs(green - want[1]) + abs(blue - want[2])) < NEAR
    if rgba.shape[2] == 4:
        near &= rgba[..., 3] > 128
    return near


def drawn(master, height, degrees):
    """A balloon at a size and angle, as the fit and the rest pose both draw it."""
    width = max(1, round(master.width * height / master.height))
    image = master.resize((width, height), Image.LANCZOS)
    if degrees:
        image = image.rotate(degrees, resample=Image.BICUBIC, expand=True)
    return image, width


# ── Fitting ─────────────────────────────────────────────────────────────────────────────────────

def correlate(field, kernel, shape):
    """sum(kernel & field) at every top-left offset, by FFT — every position in one go."""
    ph, pw = kernel.shape
    ch, cw = shape
    spectrum = np.fft.rfft2(field.astype(np.float32), s=shape)
    reversed_kernel = np.fft.rfft2(kernel[::-1, ::-1].astype(np.float32), s=shape)
    return np.fft.irfft2(spectrum * reversed_kernel, s=shape)[ph - 1:ch, pw - 1:cw]


def fit_one(master, colour, target, covered, heights, angles):
    """The best (score, x, y, width, height, degrees) for one balloon. See the docstring on IoU."""
    shape = FRAME[::-1]
    wanted = target[colour] & ~covered
    free = ~covered
    best = (0.0, 0, 0, 0, 0, 0)
    for degrees in angles:
        for height in heights:
            image, width = drawn(master, height, degrees)
            mask = body(np.asarray(image), colour)
            ph, pw = mask.shape
            if ph > shape[0] or pw > shape[1] or mask.sum() < 100:
                continue
            both = correlate(wanted, mask, shape)
            mine = correlate(free, mask, shape)
            theirs = correlate(wanted, np.ones((ph, pw), bool), shape)
            union = np.maximum(mine + theirs - both, 1)
            # Ignore offsets where almost all of the balloon is behind something already placed:
            # a sliver agreeing with a sliver is not evidence.
            score = np.where(mine > mask.sum() * 0.3, both / union, 0.0)
            y, x = np.unravel_index(np.argmax(score), score.shape)
            if score[y, x] > best[0]:
                best = (float(score[y, x]), int(x), int(y), width, height, degrees)
    return best


def fit():
    """Re-derive PLACEMENTS from the assembled design and print them ready to paste."""
    composition = np.asarray(Image.open(SOURCE / "composition.png").convert("RGBA")).astype(int)
    target = {colour: body(composition, colour) for colour in PALETTE}
    masters = {colour: load(colour) for colour in PALETTE}

    covered = np.zeros(FRAME[::-1], bool)
    found = []
    for colour, *_ in reversed(PLACEMENTS):          # front first, so `covered` grows behind us
        master = masters[colour]
        _, x, y, w, h, deg = fit_one(master, colour, target, covered,
                                     range(120, 320, 6), range(-45, 46, 5))
        score, x, y, w, h, deg = fit_one(master, colour, target, covered,
                                         range(max(60, h - 6), h + 7), range(deg - 4, deg + 5))
        print(f"{colour:7s} {score * 100:5.1f}%  at ({x},{y})  {w}x{h}  {deg:+d} deg", flush=True)
        found.append((colour, x, y, w, h, deg))
        image, _ = drawn(master, h, deg)
        mask = body(np.asarray(image), colour)
        ph, pw = mask.shape
        covered |= np.pad(mask, ((y, FRAME[1] - y - ph), (x, FRAME[0] - x - pw)))

    print("\nPLACEMENTS = [")
    for colour, x, y, w, h, deg in reversed(found):
        print(f'    ("{colour}", {x}, {y}, {w}, {h}, {deg}),')
    print("]")


# ── Building ────────────────────────────────────────────────────────────────────────────────────

def centring(masters):
    """How far to slide the whole bunch so its ink sits in the middle of the frame.

    The board maps a symbol's WHOLE 448x360 canvas onto the cell, so where the ink sits in the
    canvas is where it sits in the cell — there is no per-symbol nudge to correct it with. The
    design's own composition hangs this bunch high (13px of air over it, 51 under), which put it
    38px — a tenth of the cell — above every other symbol on the board, and it read as a mistake
    next to them. Measured, not typed in, so it follows PLACEMENTS if the bunch is ever refitted.
    """
    frame = Image.new("RGBA", FRAME, (0, 0, 0, 0))
    for colour, x, y, _width, height, degrees in PLACEMENTS:
        image, _ = drawn(masters[colour], height, degrees)
        frame.alpha_composite(image, (x, y))
    left, top, right, bottom = frame.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    return (FRAME[0] - right - left) // 2, (FRAME[1] - bottom - top) // 2


def assemble(masters):
    """The bunch at rest, and where each balloon's string ends — the point it bobs about."""
    frame = Image.new("RGBA", FRAME, (0, 0, 0, 0))
    knots = []
    # Applied to the placements themselves, not to the finished picture: the knots are derived from
    # them and the table below is derived from the knots, so the live balloons stay registered with
    # the flat drawing the spin trail ghosts.
    shift_x, shift_y = centring(masters)
    for colour, px, py, width, height, degrees in PLACEMENTS:
        x, y = px + shift_x, py + shift_y
        image, _ = drawn(masters[colour], height, degrees)
        frame.alpha_composite(image, (x, y))

        # The string's end, in the UNROTATED balloon: bottom centre. Carried through the same
        # rotation the fit applied, about the drawn art's own middle, so the pivot lands on the
        # string in the assembled picture rather than near it.
        radians = np.radians(degrees)
        ox, oy = 0.0, height / 2
        rx = ox * np.cos(radians) + oy * np.sin(radians)
        ry = -ox * np.sin(radians) + oy * np.cos(radians)
        knots.append((x + image.width / 2 + rx, y + image.height / 2 + ry))
    return frame, knots


def main():
    masters = {colour: load(colour) for colour in PALETTE}
    frame, knots = assemble(masters)
    frame.save(SYMBOL_DIR / "h3-balloons-marquee.png")

    # One file per drawing, at the biggest it is ever drawn plus headroom.
    biggest = {}
    for colour, _x, _y, width, height, _deg in PLACEMENTS:
        if height > biggest.get(colour, (0, 0))[1]:
            biggest[colour] = (width, height)
    for colour, (width, height) in biggest.items():
        size = (round(width * OVERSIZE), round(height * OVERSIZE))
        masters[colour].resize(size, Image.LANCZOS).save(
            SYMBOL_DIR / f"balloon-{colour}.webp", quality=92, method=6, alpha_quality=100)
        print(f"{colour:7s} shipped {size[0]}x{size[1]}, drawn at most {width}x{height}")

    fw, fh = FRAME
    lines = [
        "// GENERATED by scripts/balloons/build_balloons.py — edit that, not this.",
        "//",
        "// The balloon symbol as the six balloons it is made of, so the bunch can bob while the",
        "// board idles and fly when it wins. Every number is a fraction of the 448x360 symbol",
        "// frame, which is what makes one table serve every size the board draws a symbol at.",
        "//",
        "// Listed BACK TO FRONT, the design's own stacking.",
        "",
        "export type Balloon = {",
        "\tkey: string;",
        "\t/**",
        "\t * The end of its string, as a fraction of the frame — NOT the middle of the balloon.",
        "\t * This is what it hangs from and what it turns about; a balloon pivoted on its middle",
        "\t * slides sideways instead of bobbing. Draw it anchored (0.5, 1) on this point.",
        "\t */",
        "\tx: number;",
        "\ty: number;",
        "\twidth: number;",
        "\theight: number;",
        "\t/** Radians it hangs at when nothing is happening — the angle the design drew it at. */",
        "\trest: number;",
        "};",
        "",
        "export const BALLOONS: Balloon[] = [",
    ]
    for (colour, _x, _y, width, height, degrees), (kx, ky) in zip(PLACEMENTS, knots):
        key = "tpBalloon" + colour.capitalize()
        lines.append(
            f"\t{{ key: '{key}', x: {kx / fw:.4f}, y: {ky / fh:.4f}, "
            f"width: {width / fw:.4f}, height: {height / fh:.4f}, "
            f"rest: {-np.radians(degrees):.4f} }},")
    lines += ["];", ""]
    TABLE.write_text("\n".join(lines))
    print(f"wrote {TABLE.relative_to(ROOT)}")

    # Eyeball it: the design, the rest pose built from the pieces, and the pivots marked. If a knot
    # is off its string, every bob will swing from the wrong place.
    reference = Image.open(SOURCE / "composition.png").convert("RGBA")
    sheet = Image.new("RGBA", (fw * 3 + 24, fh), (26, 26, 34, 255))
    sheet.alpha_composite(reference, (0, 0))
    sheet.alpha_composite(frame, (fw + 12, 0))
    marked = frame.copy()
    from PIL import ImageDraw
    pen = ImageDraw.Draw(marked)
    for kx, ky in knots:
        pen.ellipse([kx - 6, ky - 6, kx + 6, ky + 6], outline=(0, 255, 120), width=3)
    sheet.alpha_composite(marked, (fw * 2 + 24, 0))
    sheet.save(VERIFY)
    print(f"wrote {VERIFY.relative_to(ROOT)}")


if __name__ == "__main__":
    if "--fit" in sys.argv:
        fit()
    else:
        main()
