#!/usr/bin/env python3
"""Cut the board frame into the three layers <BoardFrame> draws, and generate its geometry table.

The art (source/frame.png) is one drawing: a purple bevel, a bright magenta line inside it, and a
dark purple field in the middle. Nothing in it is a bulb — the rail it replaces carried 60 painted
bulbs and a table of their centres, and this one carries a continuous neon line instead, so the
whole chase-and-halo machinery it fed is gone with it.

Three files come out, because the reels are drawn BETWEEN two of them:

    frame-grid.webp   the middle, with the dividers  below the reels, clipped to the grid
    frame-rail.webp   the drawing minus its middle   ABOVE the reels
    frame-glow.webp   the emissive part of the rail  ABOVE the reels, additive

The rail can be opaque above the reels because it is, by construction, everything OUTSIDE the
opening — and the opening is exactly the gameplay rect. That is the one thing to preserve if this is
ever re-cut: the previous art's rail overlapped the first and last cells, which is why that pipeline
had to warp the texture sideways and key the top layer down to emissive pixels only. Neither is
needed here, and neither should be reintroduced without a reason.

Nothing exports the whole drawing, because nothing draws it: between the clipped grid and the rail
above it every pixel is already covered, and a third copy of the field is a megabyte of texture to
show the same purple twice. The seam that arrangement could leave is at the drawn corners, where the
rail cuts much further in than a rounded clip would reach — GRID_RADIUS closes it by clipping at the
deepest of those cuts, so the grid always runs past the opening and the rail hides the overshoot.

The dividers are NOT in the art. They are drawn here, at exact fifths of the opening, so that a
runtime that stretches the opening onto the gameplay rect lands them on the cell boundaries.
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

APP = Path(__file__).resolve().parents[2]
BASE = Path(__file__).resolve().parent
SOURCE = BASE / "source" / "frame.png"
OUT_DIR = APP / "static" / "assets" / "theme-park" / "v2" / "board"
OUT_TS = APP / "src" / "game" / "boardArt.ts"
VERIFY = BASE / "verify_board_frame.png"

# The runtime never draws the frame wider than about a thousand units, so this is already generous.
# It also keeps every number in the generated table the same magnitude as the ones it replaces.
EXPORT_WIDTH = 1462
# Lossy. The art is one enormous smooth gradient, which is the worst case for lossless webp — the
# set came out at 1.4MB that way and at a tenth of it here, with nothing visible between the two.
QUALITY = 92

# The magenta line is the only strongly RED thing in the art: the bevel outside it and the field
# inside it are both blue-purple and top out at R=68 and R=59 respectively.
PINK = lambda a: (a[..., 3] > 128) & (a[..., 0] >= 120)

# How the emissive layer is keyed off brightness. Fully lit at the magenta line, tapering out
# through the bright outer lip of the bevel, nothing at all in the dark field.
GLOW_FLOOR = 110
GLOW_REACH = 80

# The grid, drawn into the field. Sampled off the design mock: the dividers there sit about a fifth
# of the way from the field colour to white, and are a touch under half a percent of the board wide.
DIVIDER_COLOUR = (122, 79, 168)
DIVIDER_ALPHA = 0.42
DIVIDER_WIDTH = 0.0042
COLUMNS = 5
ROWS = 5


def opening(pink: np.ndarray) -> np.ndarray:
    """The field inside the magenta line, flood-filled so the drawn corners are followed exactly."""
    height, width = pink.shape
    inside = np.zeros((height, width), bool)
    stack = [(height // 2, width // 2)]
    inside[height // 2, width // 2] = True
    while stack:
        y, x = stack.pop()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < height and 0 <= nx < width and not inside[ny, nx] and not pink[ny, nx]:
                inside[ny, nx] = True
                stack.append((ny, nx))
    return inside


def bbox(mask: np.ndarray) -> tuple[int, int, int, int]:
    ys, xs = np.nonzero(mask)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def corner_cut(inside: np.ndarray, box: tuple[int, int, int, int]) -> int:
    """How deep the drawn corners bite into the opening's rectangle, at their deepest.

    A rounded clip of exactly this radius is the largest one that still stays under the rail all the
    way round the corner: at the very edge it removes this much, which is what the drawing removes
    too, and everywhere after that the circle pulls in faster than the drawn corner does.
    """
    left, top, right, bottom = box
    deepest = 0
    for row in (top, bottom - 1):
        columns = np.nonzero(inside[row])[0]
        deepest = max(deepest, int(columns.min()) - left, right - 1 - int(columns.max()))
    for column in (left, right - 1):
        rows = np.nonzero(inside[:, column])[0]
        deepest = max(deepest, int(rows.min()) - top, bottom - 1 - int(rows.max()))
    return deepest


def draw_dividers(field: Image.Image) -> Image.Image:
    """Fifths of the field, drawn over it. Never at its edges — the rail is the edge."""
    width, height = field.size
    lines = Image.new("RGBA", field.size, (0, 0, 0, 0))
    pen = ImageDraw.Draw(lines)
    thickness = max(1.0, width * DIVIDER_WIDTH)
    fill = (*DIVIDER_COLOUR, round(255 * DIVIDER_ALPHA))
    for index in range(1, COLUMNS):
        x = width * index / COLUMNS
        pen.rectangle((x - thickness / 2, 0, x + thickness / 2, height), fill=fill)
    for index in range(1, ROWS):
        y = height * index / ROWS
        pen.rectangle((0, y - thickness / 2, width, y + thickness / 2), fill=fill)
    return Image.alpha_composite(field, lines)


def main() -> None:
    master = Image.open(SOURCE).convert("RGBA")
    pixels = np.asarray(master).astype(int)

    # Trim the transparent margin first: it is not symmetric, and every fraction below is measured
    # against the drawing, not against whatever canvas it was exported on.
    left, top, right, bottom = bbox(pixels[..., 3] > 8)
    art = master.crop((left, top, right, bottom))
    pixels = np.asarray(art).astype(int)

    inside = opening(PINK(pixels))
    grid_box = bbox(inside)
    scale = EXPORT_WIDTH / art.width
    export_size = (EXPORT_WIDTH, round(art.height * scale))

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # 1. The field, with the grid drawn into it. Opaque: the runtime clips it, and an alpha channel
    #    here would only cost memory.
    field = draw_dividers(art.crop(grid_box))
    grid_size = (
        round((grid_box[2] - grid_box[0]) * scale),
        round((grid_box[3] - grid_box[1]) * scale),
    )
    field = field.resize(grid_size, Image.Resampling.LANCZOS).convert("RGB")
    field.save(OUT_DIR / "frame-grid.webp", format="WEBP", quality=QUALITY, method=6)

    # 2. The drawing minus its field. Everything left is outside the gameplay rect, which is what
    #    lets it go above the reels opaque and still not trim one.
    rail_pixels = np.asarray(art).copy()
    rail_pixels[inside] = 0
    rail = Image.fromarray(rail_pixels).resize(export_size, Image.Resampling.LANCZOS)
    rail.save(OUT_DIR / "frame-rail.webp", format="WEBP", quality=QUALITY, method=6)

    # 3. The lit part of the rail, on its own, for the additive pulse.
    strongest = rail_pixels[..., :3].max(axis=2).astype(float)
    keyed = np.clip((strongest - GLOW_FLOOR) / GLOW_REACH, 0, 1)
    glow_pixels = rail_pixels.copy()
    glow_pixels[..., 3] = (rail_pixels[..., 3] * keyed).astype(np.uint8)
    glow = Image.fromarray(glow_pixels).resize(export_size, Image.Resampling.LANCZOS)
    glow.save(OUT_DIR / "frame-glow.webp", format="WEBP", quality=QUALITY, method=6)

    # The table. ART_GRID is the opening, in the exported art's own pixels.
    art_grid = (
        grid_box[0] * scale,
        grid_box[1] * scale,
        grid_box[2] * scale,
        grid_box[3] * scale,
    )
    grid_radius = corner_cut(inside, grid_box) / (grid_box[2] - grid_box[0])
    OUT_TS.write_text(
        f"""// GENERATED by scripts/board/build_board_frame.py. Do not hand-edit.
//
// How the board frame sits over the reel grid.
//
// ART is the exported drawing. ART_GRID is the opening inside its neon line, and that opening IS
// the gameplay rect: <BoardFrame> scales the drawing so the two coincide, which is why the reels
// land inside the frame instead of under it, and why the dividers baked at fifths of the opening
// land on the cell boundaries.
//
// The opening is not centred in the drawing — the rail is thicker at the bottom — so GRID_OFFSET_*
// carries the difference. Drop it and the whole board sits a few pixels high.

export const ART = {{ width: {export_size[0]}, height: {export_size[1]} }};
export const ART_GRID = {{
\tleft: {art_grid[0]:.1f},
\ttop: {art_grid[1]:.1f},
\tright: {art_grid[2]:.1f},
\tbottom: {art_grid[3]:.1f},
}};

export const FRAME_OVER_GRID_X = ART.width / (ART_GRID.right - ART_GRID.left);
export const FRAME_OVER_GRID_Y = ART.height / (ART_GRID.bottom - ART_GRID.top);

export const GRID_OFFSET_X = 0.5 - (ART_GRID.left + ART_GRID.right) / 2 / ART.width;
export const GRID_OFFSET_Y = 0.5 - (ART_GRID.top + ART_GRID.bottom) / 2 / ART.height;

/**
 * The corner to clip the grid at, as a fraction of its width — how deep the drawn corners bite into
 * the opening at their deepest. It is deliberately the LARGEST radius that still stays under the
 * rail: clip any rounder and the park shows through the board's corners, and any squarer is hidden
 * by the rail above anyway. Not BOARD_CORNER_RADIUS, which is the shape features are masked to.
 */
export const GRID_RADIUS = {grid_radius:.5f};
"""
    )

    # The sheet, assembled the way the game assembles it: the clipped field down first, the rail on
    # top, over a ground colour that is in the art nowhere. Green rules the opening and the fifths.
    #
    # Two things are only ever visible here. A divider off its fifth, and — at the corners — a wedge
    # of that ground colour, which is the park showing through the board.
    ground = (0, 200, 0)
    sheet = Image.new("RGB", (export_size[0], export_size[1]), ground)
    clip = Image.new("L", grid_size, 0)
    ImageDraw.Draw(clip).rounded_rectangle(
        (0, 0, grid_size[0] - 1, grid_size[1] - 1), radius=round(grid_radius * grid_size[0]), fill=255
    )
    sheet.paste(field, (round(art_grid[0]), round(art_grid[1])), clip)
    sheet.paste(rail.convert("RGB"), (0, 0), rail)

    pen = ImageDraw.Draw(sheet)
    pen.rectangle([art_grid[0], art_grid[1], art_grid[2] - 1, art_grid[3] - 1], outline=(0, 255, 0))
    for index in range(1, COLUMNS):
        x = art_grid[0] + (art_grid[2] - art_grid[0]) * index / COLUMNS
        pen.line([(x, art_grid[1]), (x, art_grid[3])], fill=(0, 255, 0))
    for index in range(1, ROWS):
        y = art_grid[1] + (art_grid[3] - art_grid[1]) * index / ROWS
        pen.line([(art_grid[0], y), (art_grid[2], y)], fill=(0, 255, 0))
    sheet.save(VERIFY)

    leaked = (np.asarray(sheet).reshape(-1, 3) == np.array(ground)).all(axis=1).sum()

    print(f"art {export_size[0]}x{export_size[1]}  from {master.width}x{master.height}")
    print(
        "grid "
        f"{art_grid[0]:.1f},{art_grid[1]:.1f} .. {art_grid[2]:.1f},{art_grid[3]:.1f}"
        f"  ({grid_size[0]}x{grid_size[1]} exported)"
    )
    print(f"opening aspect {(art_grid[2] - art_grid[0]) / (art_grid[3] - art_grid[1]):.4f}")
    print(f"grid radius {grid_radius:.5f} of grid width -> {leaked} px of board left uncovered")


if __name__ == "__main__":
    main()
