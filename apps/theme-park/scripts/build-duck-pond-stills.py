#!/usr/bin/env python3
"""Redraw the pond's still ducks out of the Duck Your Luck spine rig.

The pond picks, the Duck Collect reel cell and the pick counter all render the live
`duckPondTurn` rig; these webps are what they fall back to before it has loaded, and what
the bonus gates its own readiness on. They were the pre-flat 3D bath-toy renders, so the
fallback did not look like the thing it stood in for, and only eight of the rig's SIXTEEN
ring variants existed at all — `duckPondDuck9`..`16` resolved to nothing.

So the stills are no longer drawn: they are cut from the rig's own atlas, in the rig's own
setup pose (front idle + ring, exactly what `<SpineProvider>` shows on frame one). That
makes a style mismatch impossible by construction — the fallback IS the art it replaces.

The frames are saved UNTRIMMED, at the skeleton's own 384x384. The art is neither centred
in that frame nor the same size as it, so a tight crop would need the consumer to know a
crop box to place the duck where the rig puts it; keeping the frame means the fallback is
`width = height = size`, the same square the rig is scaled into, and lands pixel-for-pixel
on it. Transparent padding costs almost nothing in a webp.
"""

from pathlib import Path

from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
SPINE_DIR = ROOT / "static/assets/spines/duckTurn"
OUT_DIR = ROOT / "static/assets/theme-park/v2/duckpond"

FRAME = 384
VARIANTS = range(1, 17)
# `duck` bone offset from the skeleton, in spine units (y up). The rig sits the bird this
# far into the ring; the stills have to sit it there too or the waterline moves.
DUCK_BONE_Y = -6
POSE = "pose_0"
MINI_HEIGHT = 128


def parse_atlas(path: Path) -> dict[str, dict[str, str]]:
    regions: dict[str, dict[str, str]] = {}
    name = None
    current: dict[str, str] = {}
    for line in path.read_text().splitlines()[5:]:
        if not line.strip():
            continue
        if not line.startswith((" ", "\t")):
            if name:
                regions[name] = current
            name, current = line.strip(), {}
        elif ":" in line:
            key, value = line.split(":", 1)
            current[key.strip()] = value.strip()
    if name:
        regions[name] = current
    return regions


def pair(value: str) -> tuple[int, int]:
    a, b = value.split(",")
    return int(a), int(b)


def place(sheet: Image.Image, region: dict[str, str]) -> tuple[Image.Image, tuple[int, int]]:
    """A trimmed atlas region, plus where its top-left sits in the untrimmed frame."""
    x, y = pair(region["xy"])
    w, h = pair(region["size"])
    _, orig_h = pair(region["orig"])
    off_x, off_y = pair(region["offset"])
    return sheet.crop((x, y, x + w, y + h)), (off_x, orig_h - off_y - h)


def compose(sheet: Image.Image, regions: dict[str, dict[str, str]], variant: int) -> Image.Image:
    frame = Image.new("RGBA", (FRAME, FRAME))
    # Slot order straight off the skeleton: ring behind, bird, ring in front. Drawing the
    # ring as one piece would either sink the duck into it or float it on top.
    for key, dy in (
        (f"ring_back_{variant}", 0),
        (POSE, -DUCK_BONE_Y),
        (f"ring_front_{variant}", 0),
    ):
        art, (x, y) = place(sheet, regions[key])
        frame.alpha_composite(art, (x, y + dy))
    return frame


def main() -> None:
    sheet = Image.open(SPINE_DIR / "duck_turn.png").convert("RGBA")
    regions = parse_atlas(SPINE_DIR / "duck_turn.atlas")

    for variant in VARIANTS:
        out = OUT_DIR / f"duck_{variant}.webp"
        compose(sheet, regions, variant).save(out, "WEBP", quality=80, method=6)
        print(f"  {out.name}: {out.stat().st_size / 1024:.1f} KB")

    # The pick counter's pips: the same bird with no ring, spent picks greyed out.
    bird, _ = place(sheet, regions[POSE])
    bird = bird.crop(bird.getchannel("A").getbbox())
    bird = bird.resize(
        (round(bird.width * MINI_HEIGHT / bird.height), MINI_HEIGHT), Image.LANCZOS
    )
    bird.save(OUT_DIR / "duck_mini_yellow.webp", "WEBP", quality=80, method=6)

    # Desaturated rather than repainted, so the spent pip keeps the drawing's own shading
    # and reads as the same duck with the colour taken out of it.
    grey = ImageEnhance.Color(bird).enhance(0.0)
    grey = ImageEnhance.Brightness(grey).enhance(0.92)
    grey.putalpha(bird.getchannel("A"))
    grey.save(OUT_DIR / "duck_mini_gray.webp", "WEBP", quality=80, method=6)
    print(f"  mini {bird.width}x{bird.height}")


if __name__ == "__main__":
    main()
