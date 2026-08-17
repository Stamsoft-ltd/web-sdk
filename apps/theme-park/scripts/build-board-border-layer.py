#!/usr/bin/env python3
"""Split board art into exact grid, dark underlay, and transparent light-only overlay."""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw


APP = Path(__file__).resolve().parents[1]
ASSETS = APP / "static" / "assets" / "theme-park" / "v2"
SOURCE = ASSETS / "board-lines.webp"
BASE = ASSETS / "board-lines-borderless.webp"
LIGHTS_OUTPUT = ASSETS / "board-border-expanded.png"
BACKDROP_OUTPUT = ASSETS / "board-border-backdrop.png"
GRID_OUTPUT = ASSETS / "board-grid-backboard.webp"
GRID_BOUNDS = (16, 42, 1436, 942)
# Mean centres of the 15 authored bulbs on each side rail. The texture canvas is not centred on
# them: its left/right rail span is narrower and shifted left of the equal-cell grid. Reproject only
# the border texture so both rails land on the extrapolated outer grid edges while all four internal
# divider anchors remain fixed.
LIGHT_PATH_LEFT = 33.8404
LIGHT_PATH_RIGHT = 1411.7267
DIVIDERS_X = (300, 584, 868, 1152)
TARGET_GRID_LEFT = 16
TARGET_GRID_RIGHT = 1436
BORDER_INNER_INSET_X = 24


def warp_border_x(border: Image.Image) -> Image.Image:
    """Piecewise X warp: equal edge cells, fixed internal dividers, no runtime layout distortion."""
    width, height = border.size
    left_scale = (DIVIDERS_X[0] - TARGET_GRID_LEFT) / (DIVIDERS_X[0] - LIGHT_PATH_LEFT)
    right_scale = (TARGET_GRID_RIGHT - DIVIDERS_X[-1]) / (
        LIGHT_PATH_RIGHT - DIVIDERS_X[-1]
    )
    source_edges = (
        LIGHT_PATH_LEFT - TARGET_GRID_LEFT / left_scale,
        LIGHT_PATH_LEFT,
        *DIVIDERS_X,
        LIGHT_PATH_RIGHT,
        LIGHT_PATH_RIGHT + (width - TARGET_GRID_RIGHT) / right_scale,
    )
    target_edges = (0, TARGET_GRID_LEFT, *DIVIDERS_X, TARGET_GRID_RIGHT, width)

    warped = Image.new("RGBA", border.size)
    for target_left, target_right, source_left, source_right in zip(
        target_edges, target_edges[1:], source_edges, source_edges[1:]
    ):
        segment = border.transform(
            (target_right - target_left, height),
            Image.Transform.EXTENT,
            (source_left, 0, source_right, height),
            Image.Resampling.BICUBIC,
        )
        warped.alpha_composite(segment, (target_left, 0))
    return warped


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    base = Image.open(BASE).convert("RGBA")
    if source.size != base.size:
        raise ValueError("board source/base dimensions differ")

    # Preserve the authored dark-purple rail, bulbs and glow exactly. Only the board interior is
    # removed. This restores the original visual thickness without coupling the border to layout or
    # changing the equal-cell grid crop below it.
    width, height = source.size
    edge_band = Image.new("L", source.size, 0)
    edge_draw = ImageDraw.Draw(edge_band)
    edge_draw.rounded_rectangle((15, 15, width - 15, height - 15), radius=48, fill=255)
    edge_draw.rounded_rectangle(
        (
            round(LIGHT_PATH_LEFT + BORDER_INNER_INSET_X),
            58,
            round(LIGHT_PATH_RIGHT - BORDER_INNER_INSET_X),
            height - 58,
        ),
        radius=18,
        fill=0,
    )
    original_alpha = source.getchannel("A")

    # Opaque authored rail belongs below the reels. It supplies the purple frame/shadow without
    # being able to cover the first/last reel or the top/bottom of a full-reel feature symbol.
    backdrop_source = source.copy()
    backdrop_source.putalpha(ImageChops.multiply(original_alpha, edge_band))
    # Composite into a fresh transparent image so zero-alpha pixels carry zero RGB. Otherwise atlas
    # filtering can pull hidden grid colours into the inner cut and create one-pixel edge artifacts.
    backdrop = Image.new("RGBA", source.size)
    backdrop.alpha_composite(backdrop_source)
    backdrop = warp_border_x(backdrop)
    backdrop.save(BACKDROP_OUTPUT, optimize=True)

    # Only emissive pixels may render above gameplay. Removing dark rail pixels fixes the apparent
    # grid offset: the top overlay can no longer hide any part of a reel while bulbs still glow over
    # full-reel feature art.
    red, green, blue, _ = source.split()
    strongest = ImageChops.lighter(ImageChops.lighter(red, green), blue)
    bright_alpha = strongest.point(
        lambda value: 0 if value < 105 else min(255, round((value - 105) * 1.7))
    )
    light_alpha = ImageChops.multiply(
        ImageChops.multiply(original_alpha, edge_band), bright_alpha
    )
    lights_source = source.copy()
    lights_source.putalpha(light_alpha)
    lights = Image.new("RGBA", source.size)
    lights.alpha_composite(lights_source)
    lights = warp_border_x(lights)
    lights.save(LIGHTS_OUTPUT, optimize=True)

    # Runtime backboard stops at the actual grid bounds. The separated light rail provides the only
    # outer padding, avoiding the old full-canvas dark gutter above/below and beside the reels.
    grid = base.crop(GRID_BOUNDS).convert("RGB")
    grid.save(GRID_OUTPUT, format="WEBP", lossless=True, method=6)
    print(f"Built {BACKDROP_OUTPUT} ({width}x{height})")
    print(f"Built {LIGHTS_OUTPUT} ({width}x{height})")
    print(f"Built {GRID_OUTPUT} ({grid.width}x{grid.height})")


if __name__ == "__main__":
    main()
