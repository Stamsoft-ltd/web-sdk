#!/usr/bin/env python3
"""Extract the authored hand-drawn Mega Wild sheets into transparent rig sources."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


APP = Path(__file__).resolve().parents[1]
SOURCE = APP / "source-assets-unused" / "assets" / "theme-park" / "mega-wild-handdrawn"

CART_NAMES = ("steep", "high-mid", "mid", "low-mid", "flat")
PLAQUE_NAMES = (
    "front",
    "top-35",
    "top-60",
    "top-side",
    "bottom-60",
    "bottom-35",
    "front-end",
)


def clear_transparent_rgb(image: Image.Image) -> Image.Image:
    """Use transparent black outside sprites so later Lanczos scaling cannot create white halos."""
    rgba = np.asarray(image.convert("RGBA")).copy()
    rgba[rgba[:, :, 3] == 0, :3] = 0
    return Image.fromarray(rgba, "RGBA")


def remove_white_edge_matte(image: Image.Image, band_pixels: int = 4) -> Image.Image:
    """Recover soft black-outline alpha from the generator's baked pale checker edge."""
    rgba = np.asarray(image.convert("RGBA")).copy()
    visible = rgba[:, :, 3] > 0
    near_transparent = ~visible
    for _ in range(band_pixels):
        expanded = near_transparent.copy()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                source = near_transparent[
                    max(0, -dy) : near_transparent.shape[0] - max(0, dy),
                    max(0, -dx) : near_transparent.shape[1] - max(0, dx),
                ]
                target = expanded[
                    max(0, dy) : expanded.shape[0] - max(0, -dy),
                    max(0, dx) : expanded.shape[1] - max(0, -dx),
                ]
                target |= source
        near_transparent = expanded

    rgb = rgba[:, :, :3].astype(np.float32)
    low = rgb.min(axis=2)
    high = rgb.max(axis=2)
    luminance = rgb.mean(axis=2)
    neutral_edge = visible & near_transparent & ((high - low) < 30)
    recovered_alpha = np.clip((1 - luminance / 248) * 255, 0, 255).astype(np.uint8)
    rgba[neutral_edge, 3] = np.minimum(rgba[neutral_edge, 3], recovered_alpha[neutral_edge])
    rgba[neutral_edge, :3] = 0
    rgba[rgba[:, :, 3] == 0, :3] = 0
    return Image.fromarray(rgba, "RGBA")


def remove_generated_checker(image: Image.Image) -> Image.Image:
    """Remove only edge-connected neutral checker pixels; preserve enclosed eye highlights."""
    rgba_source = image.convert("RGBA")
    if rgba_source.getchannel("A").getextrema()[0] < 255:
        return clear_transparent_rgb(rgba_source)
    rgb = np.asarray(image.convert("RGB"))
    lo = rgb.min(axis=2)
    hi = rgb.max(axis=2)
    neutral = (lo >= 170) & ((hi - lo) <= 34)

    # Candidate background is black. Flood only the black area connected to the sheet edge; white
    # eye highlights and bulbs become enclosed holes and are restored as authored foreground.
    connectivity = Image.fromarray(np.where(neutral, 0, 255).astype(np.uint8), "L")
    draw = ImageDraw.Draw(connectivity)
    for x in range(connectivity.width):
        if connectivity.getpixel((x, 0)) == 0:
            ImageDraw.floodfill(connectivity, (x, 0), 128)
        if connectivity.getpixel((x, connectivity.height - 1)) == 0:
            ImageDraw.floodfill(connectivity, (x, connectivity.height - 1), 128)
    for y in range(connectivity.height):
        if connectivity.getpixel((0, y)) == 0:
            ImageDraw.floodfill(connectivity, (0, y), 128)
        if connectivity.getpixel((connectivity.width - 1, y)) == 0:
            ImageDraw.floodfill(connectivity, (connectivity.width - 1, y), 128)
    connected = np.asarray(connectivity)
    alpha = np.where(connected == 128, 0, 255).astype(np.uint8)
    rgba = np.dstack((rgb, alpha))
    return clear_transparent_rgb(Image.fromarray(rgba, "RGBA"))


def extract_components(
    sheet_name: str,
    names: tuple[str, ...],
    prefix: str,
    version: str = "v1",
    clean_edge_matte: bool = False,
) -> None:
    sheet = remove_generated_checker(Image.open(SOURCE / sheet_name))
    alpha = np.asarray(sheet.getchannel("A"))
    occupied = np.count_nonzero(alpha, axis=0) >= 8
    intervals: list[tuple[int, int]] = []
    start: int | None = None
    for x, present in enumerate(occupied):
        if present and start is None:
            start = x
        elif not present and start is not None:
            intervals.append((start, x))
            start = None
    if start is not None:
        intervals.append((start, sheet.width))

    # Anti-aliased flecks can split one sprite by a few empty columns. Merge near neighbours.
    merged: list[tuple[int, int]] = []
    for left, right in intervals:
        if merged and left - merged[-1][1] <= 8:
            merged[-1] = (merged[-1][0], right)
        elif right - left >= 8:
            merged.append((left, right))
    if len(merged) != len(names):
        raise RuntimeError(
            f"{sheet_name}: expected {len(names)} sprites, found {len(merged)}: {merged}"
        )

    rgba = np.asarray(sheet).copy()
    for (x, right), name in zip(merged, names, strict=True):
        component_alpha = alpha[:, x:right]
        ys = np.flatnonzero(np.any(component_alpha > 0, axis=1))
        if len(ys) == 0:
            raise RuntimeError(f"{sheet_name}: empty component {name}")
        y = int(ys[0])
        bottom_y = int(ys[-1] + 1)
        pad = 12
        left = max(0, x - pad)
        top = max(0, y - pad)
        right = min(sheet.width, right + pad)
        bottom = min(sheet.height, bottom_y + pad)
        crop = rgba[top:bottom, left:right].copy()
        sprite = clear_transparent_rgb(Image.fromarray(crop, "RGBA"))
        if clean_edge_matte:
            sprite = remove_white_edge_matte(sprite)
        sprite.save(SOURCE / f"{prefix}-{name}-{version}.png", optimize=True)


def main() -> None:
    extract_components("cart-five-view-sheet-v2.png", CART_NAMES, "cart")
    extract_components(
        "plaque-seven-view-sheet-redrawn-v3.png",
        PLAQUE_NAMES,
        "plaque",
        "redrawn-v3",
        True,
    )
    # A true edge-on pose has no visible face direction. Reuse that authored state for the lower
    # half of the end-over-end flip rather than inventing a mismatched second edge thickness.
    Image.open(SOURCE / "plaque-top-side-redrawn-v3.png").save(
        SOURCE / "plaque-bottom-side-redrawn-v3.png", optimize=True
    )
    print(f"Processed hand-drawn Mega Wild sources in {SOURCE}")


if __name__ == "__main__":
    main()
