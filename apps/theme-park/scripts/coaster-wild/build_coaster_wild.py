#!/usr/bin/env python3
"""Cut the Coaster Wild's two pieces of art, and MEASURE the splat that is drawn under them.

    python3 scripts/coaster-wild/build_coaster_wild.py

It writes:

  static/assets/theme-park/v2/symbols/wild-word.webp
  static/assets/theme-park/v2/symbols/multiplier-pad.webp
  scripts/coaster-wild/verify_coaster_wild.png

and prints the shape numbers <SlimeSplat> is written against, plus the pad's own field.

WHY THE SPLAT IS NOT AN ASSET

The persistent Coaster Wild sits on the board for a whole feature — a dozen of them, for a dozen
spins — so it is the one thing in this game that a player stares at while nothing else is moving.
As a PNG it can only be transformed: scaled, turned, faded. None of those is what slime does. What
slime does is CHURN, and a churning outline is a shape that has to be recomputed, not a picture that
has to be moved. So the splat is drawn per frame by <SlimeSplat> and only the lettering ships as art.

That leaves the design's splat (`source/splat-reference.png`) as a specification rather than a
source, and this measures it so the drawing is a rebuild of the artist's shape rather than someone's
idea of a blob. What it reports, and what the component is built from:

* **Its two greens** — the flat body and the brighter rim, sampled from the core and from a band
  just inside the alpha edge rather than picked off a screenshot.
* **How lumpy it is** — the outline's radius against its own mean, which is what sets how far the
  lobes reach in and out.
* **How many lumps** — from the Fourier transform of that radius against angle. The reference's
  energy sits at harmonic 2 (its overall squat ellipse) and then in a band around 13-18, which is
  what "about sixteen lobes" means as a measurement instead of as a count by eye.
* **Its droplets** — the satellites flung off the main body, as radii and distances in units of the
  main blob's mean radius, so they scale with it.

THE MULTIPLIER'S PAD

The multiplier used to be set straight on the slime, which is the one place on this sign with no
contrast to spare: gold-on-green lettering over a shape that is itself moving. `source/multiplier-
pad.png` is the purple plaque it now sits on. What is measured off it is its FIELD — the flat inside
of the plaque, as fractions of its own trimmed box — because the neon rim is thick and uneven, and
centring the text in the art's box rather than in the field would set it low.
"""

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent / "source"
SYMBOL_DIR = ROOT / "static/assets/theme-park/v2/symbols"
VERIFY = Path(__file__).resolve().parent / "verify_coaster_wild.png"

#: How many ways round the outline is sampled when its radius is measured.
SPOKES = 720
#: Anything smaller than this share of the main blob is a droplet rather than a second blob.
DROPLET_MAX = 0.05
#: How far off the plaque's body colour a pixel may be, per channel, and still be its flat field.
FIELD_TOLERANCE = 22
#: The widest the plaque ships at. The master is over a thousand across and it is drawn at about
#: fifty board units, so shipping the master would spend two and a half megabytes of texture on a
#: badge. Flat neon on a flat body downscales without losing anything at this size.
PAD_MAX_WIDTH = 384


def runs(mask):
    """Every 4-connected region of `mask`, largest first, as arrays of (y, x)."""
    height, width = mask.shape
    seen = np.zeros((height, width), bool)
    found = []
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
        found.append(np.array(points))
    found.sort(key=len, reverse=True)
    return found


def measure():
    """The reference splat's colours, lumpiness and droplets."""
    pixels = np.asarray(Image.open(SOURCE / "splat-reference.png").convert("RGBA")).astype(int)
    blobs = runs(pixels[..., 3] > 128)
    body = blobs[0]

    shape = pixels.shape[:2]
    mask = np.zeros(shape, bool)
    mask[body[:, 0], body[:, 1]] = True
    stamp = Image.fromarray((mask * 255).astype(np.uint8), "L")

    # The rim is the band the outline occupies; the core is well inside it, past any of it.
    inner = np.asarray(stamp.filter(ImageFilter.MinFilter(9))) > 128
    core = np.asarray(stamp.filter(ImageFilter.MinFilter(31))) > 128
    rim = np.median(pixels[..., :3][mask & ~inner], axis=0)
    fill = np.median(pixels[..., :3][core], axis=0)

    centre_y, centre_x = body[:, 0].mean(), body[:, 1].mean()
    ys, xs = np.nonzero(mask)
    spoke = ((np.arctan2(ys - centre_y, xs - centre_x) + np.pi) / (2 * np.pi) * SPOKES).astype(int)
    spoke %= SPOKES
    # The OUTER edge along each spoke: a splat is star-shaped about its middle, so the furthest
    # pixel at an angle is the outline at that angle.
    radius = np.zeros(SPOKES)
    np.maximum.at(radius, spoke, np.hypot(ys - centre_y, xs - centre_x))
    known = radius > 0
    radius = np.interp(np.arange(SPOKES), np.arange(SPOKES)[known], radius[known])

    spectrum = np.abs(np.fft.rfft(radius - radius.mean()))
    order = np.argsort(spectrum)[::-1][:8]

    droplets = []
    for blob in blobs[1:]:
        if len(blob) > len(body) * DROPLET_MAX:
            continue
        distance = np.hypot(blob[:, 0].mean() - centre_y, blob[:, 1].mean() - centre_x)
        droplets.append((np.sqrt(len(blob) / np.pi) / radius.mean(), distance / radius.mean()))

    return {
        "rim": tuple(int(v) for v in rim),
        "fill": tuple(int(v) for v in fill),
        "mean": radius.mean(),
        "reach": (radius.min() / radius.mean(), radius.max() / radius.mean()),
        "aspect": (xs.max() - xs.min() + 1) / (ys.max() - ys.min() + 1),
        "harmonics": [(int(k), float(spectrum[k] / spectrum[order[0]])) for k in order],
        "droplets": droplets,
    }


def wordmark():
    """The gold WILD, trimmed to its ink.

    webp rather than png: it is a flat bevelled lettering with no gradient wide enough for lossy-at-
    92 to band, and it is on screen for the whole feature on every Wild on the board.
    """
    image = Image.open(SOURCE / "word-wild.png").convert("RGBA")
    ys, xs = np.nonzero(np.asarray(image)[..., 3] > 8)
    ink = image.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    out = SYMBOL_DIR / "wild-word.webp"
    ink.save(out, quality=92, method=6, alpha_quality=100)
    print(f"wrote {out.relative_to(ROOT)}  {ink.width}x{ink.height} of ink from {image.size}")
    return ink


def pad():
    """The multiplier's plaque, trimmed to its ink, and where its flat field sits inside that.

    webp for the same reason the wordmark is: flat neon on a flat body, on screen for the whole
    feature on every Wild on the board.
    """
    image = Image.open(SOURCE / "multiplier-pad.png").convert("RGBA")
    pixels = np.asarray(image).astype(int)
    ys, xs = np.nonzero(pixels[..., 3] > 8)
    left, top = xs.min(), ys.min()
    width, height = xs.max() - left + 1, ys.max() - top + 1
    ink = image.crop((int(left), int(top), int(xs.max()) + 1, int(ys.max()) + 1))
    if ink.width > PAD_MAX_WIDTH:
        ink = ink.resize(
            (PAD_MAX_WIDTH, round(PAD_MAX_WIDTH * ink.height / ink.width)), Image.LANCZOS
        )
    out = SYMBOL_DIR / "multiplier-pad.webp"
    ink.save(out, quality=92, method=6, alpha_quality=100)

    middle = pixels[top + height // 4 : top + 3 * height // 4, left + width // 4 : left + 3 * width // 4, :3]
    body = np.median(middle.reshape(-1, 3), axis=0)
    flat = (np.abs(pixels[..., :3] - body).max(axis=2) <= FIELD_TOLERANCE) & (pixels[..., 3] > 200)
    fys, fxs = np.nonzero(flat)
    field = (
        (fxs.min() - left) / width,
        (fxs.max() - left) / width,
        (fys.min() - top) / height,
        (fys.max() - top) / height,
    )
    print(f"wrote {out.relative_to(ROOT)}  {ink.width}x{ink.height} of ink from {image.size}")
    print(f"pad body #{int(body[0]):02x}{int(body[1]):02x}{int(body[2]):02x}, aspect {width / height:.3f}")
    print("pad field x {:.3f}..{:.3f}  y {:.3f}..{:.3f} of its box".format(*field))
    return ink



# === THE DRAWN SPLAT, MIRRORED FROM <SlimeSplat> ==============================================
# Not a second implementation for its own sake: the sign's layout is decided here, and it can only
# be decided against the shape that actually ships. Every constant below is the one the component
# holds, and the sheet this draws is the only place the three pieces are ever seen together.
SPLAT_POINTS = 128
SPLAT_LOBES = 16
SPLAT_BODY = 0.88
SPLAT_THROW = 0.93
SPLAT_LOBE = 0.22
THROW_VARY, LOBE_VARY, BEARING_VARY = 0.16, 0.35, 0.42
THROW_HZ, LOBE_HZ, BEARING_HZ = 0.11, 0.17, 0.074
THROW_PHASE, LOBE_PHASE, BEARING_PHASE = 2.39996, 1.7305, 4.1231
SPLAT_MAX_REACH = 1.40
SPLAT_ASPECT = 1.309
FILL = (0x44, 0x8F, 0x27, 255)
RIM = (0x6F, 0xB5, 0x1A, 255)

#: The layout the component uses, as fractions of the splat's box height. Both pieces are kept
#: inside the BODY disc — the lobes come and go, so anything resting on one would be over the board
#: whenever that lobe wandered off.
WORD_WIDTH, WORD_CENTRE = 0.64, -0.15
PAD_WIDTH, PAD_CENTRE = 0.40, 0.17

#: The contact sheet: the design's splat, then the drawn one carrying the sign, minutes apart.
PREVIEW = 320
PREVIEW_PAD = 14
PAD = PREVIEW_PAD
PREVIEW_TIMES = (0.0, 37.0, 91.0)


def outline(seconds, points=SPLAT_POINTS):
    """One frame of <SlimeSplat>'s outline, as a radius per spoke in body-radius units."""
    radii = np.full(points, SPLAT_BODY)
    step = 2 * np.pi / points
    for lobe in range(SPLAT_LOBES):
        distance = SPLAT_THROW * (
            1 + THROW_VARY * np.sin(2 * np.pi * THROW_HZ * seconds + lobe * THROW_PHASE)
        )
        size = SPLAT_LOBE * (
            1 + LOBE_VARY * np.sin(2 * np.pi * LOBE_HZ * seconds + lobe * LOBE_PHASE)
        )
        bearing = lobe / SPLAT_LOBES * 2 * np.pi + BEARING_VARY * (2 * np.pi / SPLAT_LOBES) * np.sin(
            2 * np.pi * BEARING_HZ * seconds + lobe * BEARING_PHASE
        )
        away = np.arange(points) * step - bearing
        under = size * size - (distance * np.sin(away)) ** 2
        reach = np.where(under > 0, distance * np.cos(away) + np.sqrt(np.clip(under, 0, None)), 0)
        radii = np.maximum(radii, reach)
    return radii


def assembled(word, plate, seconds, size=PREVIEW):
    """The whole sign at one moment: splat, wordmark, plaque — at the component's own proportions."""
    box_h = size * 0.94
    box_w = box_h * SPLAT_ASPECT
    if box_w > size:
        box_w, box_h = size, size / SPLAT_ASPECT
    tile = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(tile)
    radii = outline(seconds)
    step = 2 * np.pi / len(radii)
    centre = size / 2
    draw.polygon(
        [
            (
                centre + radius * np.cos(index * step) * box_w / 2 / SPLAT_MAX_REACH,
                centre + radius * np.sin(index * step) * box_h / 2 / SPLAT_MAX_REACH,
            )
            for index, radius in enumerate(radii)
        ],
        fill=FILL,
        outline=RIM,
        width=max(1, round(box_h * 0.029 / SPLAT_MAX_REACH)),
    )
    for piece, share, at in ((word, WORD_WIDTH, WORD_CENTRE), (plate, PAD_WIDTH, PAD_CENTRE)):
        width = round(box_h * share)
        placed = piece.resize((width, round(width * piece.height / piece.width)), Image.LANCZOS)
        tile.alpha_composite(
            placed,
            (round(centre - placed.width / 2), round(centre + box_h * at - placed.height / 2)),
        )
    return tile


def main():
    ink = wordmark()
    pad_ink = pad()
    found = measure()
    print(f"rim   #{found['rim'][0]:02x}{found['rim'][1]:02x}{found['rim'][2]:02x}")
    print(f"fill  #{found['fill'][0]:02x}{found['fill'][1]:02x}{found['fill'][2]:02x}")
    print(f"mean radius {found['mean']:.1f}px, aspect {found['aspect']:.3f}")
    print(f"reach {found['reach'][0]:.3f} to {found['reach'][1]:.3f} of the mean")
    print("harmonics " + ", ".join(f"{k}:{v:.2f}" for k, v in found["harmonics"]))
    print(
        "droplets "
        + ", ".join(f"r{r:.3f}@{d:.2f}" for r, d in sorted(found["droplets"], reverse=True))
    )

    contact = Image.new("RGBA", (PREVIEW * 4 + PAD * 5, PREVIEW + PAD * 2), (26, 26, 34, 255))
    reference = Image.open(SOURCE / "splat-reference.png").convert("RGBA")
    shown = reference.copy()
    shown.thumbnail((PREVIEW, PREVIEW), Image.LANCZOS)
    contact.alpha_composite(shown, (PAD, PAD + (PREVIEW - shown.height) // 2))
    for column, seconds in enumerate(PREVIEW_TIMES):
        contact.alpha_composite(
            assembled(ink, pad_ink, seconds), (PAD + (PREVIEW + PAD) * (column + 1), PAD)
        )
    contact.save(VERIFY)
    print(f"wrote {VERIFY.relative_to(ROOT)}  — the drawn splat carrying both, three moments apart")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
