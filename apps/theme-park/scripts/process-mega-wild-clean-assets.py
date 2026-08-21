#!/usr/bin/env python3
"""Prepare the clean Mega Wild track and five aligned cart views for Spine."""

from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter, ImageOps


APP = Path(__file__).resolve().parents[1]
SOURCE = (
    APP
    / "source-assets-unused"
    / "assets"
    / "theme-park"
    / "mega-wild-clean"
)
TRACK_SOURCE = SOURCE / "track-source.png"
CART_SOURCE = SOURCE / "cart-views-source.png"
TRACK_OUTPUT = SOURCE / "track-clean.png"
CART_NAMES = ("steep", "high-mid", "mid", "low-mid", "flat")
# Crop at the outer gold rail edges. The generated source also contains a second row of protruding
# side bulbs; those are intentionally excluded so the lift hill matches the single-bolt reference.
TRACK_CROP_X = (242, 750)
TRACK_SIZE = (256, 824)
TRACK_TOP_WIDTH = 76
TRACK_BOTTOM_WIDTH = 238
TRACK_RENDER_SCALE = 4
CART_CANVAS_SIZE = (320, 478)
CART_SOURCE_CELL_WIDTH = 384
CART_CONTENT_BOTTOM = 411


def remove_connected_white(image: Image.Image) -> Image.Image:
    """Remove only white connected to the canvas edge, preserving enclosed eye highlights."""
    rgb = image.convert("RGB")
    width, height = rgb.size
    pixels = rgb.load()
    outside = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def is_background(x: int, y: int) -> bool:
        red, green, blue = pixels[x, y]
        # The generated white sweep contains pale warm/cool antialias pixels around the outline.
        # Flooding a broader near-neutral range removes that halo while enclosed white eyes and
        # highlights remain protected by the cart's dark keyline.
        return min(red, green, blue) >= 190 and max(red, green, blue) - min(red, green, blue) <= 70

    def add(x: int, y: int) -> None:
        index = y * width + x
        if outside[index] or not is_background(x, y):
            return
        outside[index] = 1
        queue.append((x, y))

    for x in range(width):
        add(x, 0)
        add(x, height - 1)
    for y in range(height):
        add(0, y)
        add(width - 1, y)

    while queue:
        x, y = queue.popleft()
        if x:
            add(x - 1, y)
        if x + 1 < width:
            add(x + 1, y)
        if y:
            add(x, y - 1)
        if y + 1 < height:
            add(x, y + 1)

    rgba = rgb.convert("RGBA")
    alpha = Image.new("L", rgb.size, 255)
    alpha_pixels = alpha.load()
    for y in range(height):
        row = y * width
        for x in range(width):
            if outside[row + x]:
                alpha_pixels[x, y] = 0
    rgba.putalpha(alpha)
    return rgba


def keep_largest_component(image: Image.Image) -> Image.Image:
    """Drop isolated generation specks/vertical seams while keeping the complete cart silhouette."""
    rgba = image.convert("RGBA")
    width, height = rgba.size
    alpha = rgba.getchannel("A")
    alpha_pixels = alpha.load()
    visited = bytearray(width * height)
    components: list[list[tuple[int, int]]] = []

    for start_y in range(height):
        for start_x in range(width):
            start_index = start_y * width + start_x
            if visited[start_index] or alpha_pixels[start_x, start_y] == 0:
                continue
            visited[start_index] = 1
            queue: deque[tuple[int, int]] = deque([(start_x, start_y)])
            component: list[tuple[int, int]] = []
            while queue:
                x, y = queue.popleft()
                component.append((x, y))
                for next_x, next_y in (
                    (x - 1, y),
                    (x + 1, y),
                    (x, y - 1),
                    (x, y + 1),
                    (x - 1, y - 1),
                    (x + 1, y - 1),
                    (x - 1, y + 1),
                    (x + 1, y + 1),
                ):
                    if not (0 <= next_x < width and 0 <= next_y < height):
                        continue
                    index = next_y * width + next_x
                    if visited[index] or alpha_pixels[next_x, next_y] == 0:
                        continue
                    visited[index] = 1
                    queue.append((next_x, next_y))
            components.append(component)

    if not components:
        return rgba
    keep = set(max(components, key=len))
    for y in range(height):
        for x in range(width):
            if alpha_pixels[x, y] and (x, y) not in keep:
                alpha_pixels[x, y] = 0
    rgba.putalpha(alpha)
    return rgba


def component_bounds(image: Image.Image, minimum_pixels: int = 20_000) -> list[tuple[int, int, int, int]]:
    """Find the five isolated authored cart silhouettes without cutting across cell boundaries."""
    alpha = image.getchannel("A")
    width, height = alpha.size
    alpha_pixels = alpha.load()
    visited = bytearray(width * height)
    bounds: list[tuple[int, int, int, int]] = []

    for start_y in range(height):
        for start_x in range(width):
            start_index = start_y * width + start_x
            if visited[start_index] or alpha_pixels[start_x, start_y] == 0:
                continue
            visited[start_index] = 1
            queue: deque[tuple[int, int]] = deque([(start_x, start_y)])
            pixel_count = 0
            left = right = start_x
            top = bottom = start_y
            while queue:
                x, y = queue.popleft()
                pixel_count += 1
                left = min(left, x)
                right = max(right, x)
                top = min(top, y)
                bottom = max(bottom, y)
                for next_x, next_y in (
                    (x - 1, y),
                    (x + 1, y),
                    (x, y - 1),
                    (x, y + 1),
                    (x - 1, y - 1),
                    (x + 1, y - 1),
                    (x - 1, y + 1),
                    (x + 1, y + 1),
                ):
                    if not (0 <= next_x < width and 0 <= next_y < height):
                        continue
                    index = next_y * width + next_x
                    if visited[index] or alpha_pixels[next_x, next_y] == 0:
                        continue
                    visited[index] = 1
                    queue.append((next_x, next_y))
            if pixel_count >= minimum_pixels:
                bounds.append((left, top, right + 1, bottom + 1))

    return sorted(bounds, key=lambda box: box[0])


def strip_white_fringe(image: Image.Image, passes: int = 10) -> Image.Image:
    """Peel the generated white keyline from the outside without touching enclosed eye whites."""
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    for _ in range(passes):
        remove: list[tuple[int, int]] = []
        for y in range(1, height - 1):
            for x in range(1, width - 1):
                red, green, blue, alpha = pixels[x, y]
                if not alpha or min(red, green, blue) < 150 or max(red, green, blue) - min(red, green, blue) > 90:
                    continue
                if any(
                    pixels[next_x, next_y][3] == 0
                    for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
                ):
                    remove.append((x, y))
        for x, y in remove:
            pixels[x, y] = (*pixels[x, y][:3], 0)
    return rgba


def build_track() -> None:
    source = Image.open(TRACK_SOURCE).convert("RGB")
    left, right = TRACK_CROP_X
    track = source.crop((left, 0, right, source.height))
    render_width = TRACK_SIZE[0] * TRACK_RENDER_SCALE
    render_height = TRACK_SIZE[1] * TRACK_RENDER_SCALE
    track = track.resize((track.width, render_height), Image.Resampling.LANCZOS)

    # Perspective lift hill: narrow at the distant crest, wide at the foreground. Render large and
    # downsample once so both diagonal gold rails stay clean instead of developing stair-step edges.
    canvas = Image.new("RGB", (render_width, render_height))
    canvas_pixels = canvas.load()
    for y in range(render_height):
        progress = y / max(1, render_height - 1)
        background = (
            round(34 - 10 * progress),
            round(7 - 3 * progress),
            round(68 - 18 * progress),
        )
        for x in range(render_width):
            canvas_pixels[x, y] = background

        row_width = round(
            (TRACK_TOP_WIDTH + (TRACK_BOTTOM_WIDTH - TRACK_TOP_WIDTH) * progress)
            * TRACK_RENDER_SCALE
        )
        row = track.crop((0, y, track.width, y + 1)).resize(
            (row_width, 1), Image.Resampling.LANCZOS
        )
        canvas.paste(row, ((render_width - row_width) // 2, y))

    canvas.resize(TRACK_SIZE, Image.Resampling.LANCZOS).save(TRACK_OUTPUT, optimize=True)


def build_carts() -> None:
    source = Image.open(CART_SOURCE).convert("RGB")
    keyed = remove_connected_white(source)
    bounds = component_bounds(keyed)
    if len(bounds) != len(CART_NAMES):
        raise ValueError(f"expected five isolated cart views, found {len(bounds)}")

    scale = CART_CANVAS_SIZE[0] / CART_SOURCE_CELL_WIDTH
    for name, bounds_box in zip(CART_NAMES, bounds):
        cell = strip_white_fringe(keep_largest_component(keyed.crop(bounds_box)))
        cell = cell.resize(
            (round(cell.width * scale), round(cell.height * scale)),
            Image.Resampling.LANCZOS,
        )
        canvas = Image.new("RGBA", CART_CANVAS_SIZE)
        canvas.alpha_composite(
            cell,
            (
                (CART_CANVAS_SIZE[0] - cell.width) // 2,
                CART_CONTENT_BOTTOM - cell.height,
            ),
        )
        # One-pixel alpha inset removes the final white-matte edge left by source-sheet resampling.
        canvas.putalpha(canvas.getchannel("A").filter(ImageFilter.MinFilter(3)))
        canvas.save(SOURCE / f"cart-{name}.png", optimize=True)


def main() -> None:
    build_track()
    build_carts()
    print(f"Prepared clean Mega Wild sources in {SOURCE}")


if __name__ == "__main__":
    main()
