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


def remove_generated_checker(image: Image.Image) -> Image.Image:
    """Remove only edge-connected neutral checker pixels; preserve enclosed eye highlights."""
    rgba_source = image.convert("RGBA")
    if rgba_source.getchannel("A").getextrema()[0] < 255:
        return rgba_source
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
    return Image.fromarray(rgba, "RGBA")


def extract_components(sheet_name: str, names: tuple[str, ...], prefix: str) -> None:
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
        Image.fromarray(crop, "RGBA").save(SOURCE / f"{prefix}-{name}-v1.png", optimize=True)


def main() -> None:
    extract_components("cart-five-view-sheet-v2.png", CART_NAMES, "cart")
    extract_components("plaque-seven-view-sheet-v2.png", PLAQUE_NAMES, "plaque")
    # A true edge-on pose has no visible face direction. Reuse that authored state for the lower
    # half of the end-over-end flip rather than inventing a mismatched second edge thickness.
    Image.open(SOURCE / "plaque-top-side-v1.png").save(
        SOURCE / "plaque-bottom-side-v1.png", optimize=True
    )
    print(f"Processed hand-drawn Mega Wild sources in {SOURCE}")


if __name__ == "__main__":
    main()
