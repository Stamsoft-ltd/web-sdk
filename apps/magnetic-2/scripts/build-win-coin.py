#!/usr/bin/env python3
"""
Builds the win-fountain coin sheet from the MOTHERSHIP design's coin (Figma 9235:19944, the gold
Press Play chip with magenta lugs) — art-src/coin/raw_4.png is that node's largest transparent
source image, downloaded 2026-09-08 (asset URLs expire, hence the copy).

The fountain (WinCoins.svelte -> pixi ParticleEmitter, key "coins") animates a 12-frame sheet:
one full turn about the vertical axis, front face for the first half, the mirrored back for the
second, edge-on at frames 4 and 10 — exactly the layout of the sheet it replaces (SD2_Coin.json,
4x3 frames of 342px, scale 2), whose frame keys and animation name are kept so nothing in the
emitter config changes. The design only draws the face, so each frame is the face squashed to
|cos θ| of its width with a thin drawn rim (the art's own outline colour) so the edge-on frames
read as a coin on its side rather than a vanishing line.

Every size here is measured: the coin diameter is the previous sheet's frame-1 alpha width, so the
fountain's scale settings still produce the same coin on screen.

Writes static/assets/sprites/coin/mothership_coin.{webp,json} and art-src/coin/preview_sheet.png.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

APP = Path(__file__).resolve().parent.parent
SRC = APP / "art-src" / "coin" / "raw_4.png"
OLD = APP / "static" / "assets" / "sprites" / "coin" / "SD2_Coin.webp"
OUT_DIR = APP / "static" / "assets" / "sprites" / "coin"
OUT_NAME = "mothership_coin"

FRAME = 342
COLS, ROWS = 4, 3
FRAMES = COLS * ROWS
# Rim thickness as a fraction of the diameter. The chip is a fat cartoon token, not a wafer.
RIM = 0.09


def alpha_bbox(im: Image.Image) -> tuple[int, int, int, int]:
    box = im.getchannel("A").getbbox()
    assert box, "no alpha"
    return box


def main() -> None:
    old = Image.open(OLD).convert("RGBA")
    old_first = old.crop((0, 0, FRAME, FRAME))
    ob = alpha_bbox(old_first)
    D = ob[2] - ob[0]
    print(f"old frame 1 alpha bbox {ob} -> diameter {D}px of {FRAME}")

    face = Image.open(SRC).convert("RGBA")
    face = face.crop(alpha_bbox(face))
    fw, fh = face.size
    # Fit the design's face into the old coin's diameter (it is 1.008:1, near enough round).
    k = D / max(fw, fh)
    face = face.resize((max(1, round(fw * k)), max(1, round(fh * k))), Image.LANCZOS)
    fw, fh = face.size
    print(f"face fitted to {fw}x{fh}")

    # The rim colour: the median of the face's outermost opaque ring, which is the art's own dark
    # outline — sampled, not picked.
    a = np.asarray(face)[:, :, 3] > 200
    inner = a.copy()
    for _ in range(4):  # erode 4px
        inner = inner & np.roll(inner, 1, 0) & np.roll(inner, -1, 0) & np.roll(inner, 1, 1) & np.roll(inner, -1, 1)
    ring = a & ~inner
    rgb = np.asarray(face)[:, :, :3][ring]
    rim_rgb = tuple(int(v) for v in np.median(rgb, axis=0))
    print(f"rim colour sampled from {ring.sum()} outline px: #{rim_rgb[0]:02x}{rim_rgb[1]:02x}{rim_rgb[2]:02x}")

    # A silhouette of the face in that colour, for the rim slices.
    sil = Image.new("RGBA", face.size, rim_rgb + (0,))
    sil.putalpha(face.getchannel("A"))

    sheet = Image.new("RGBA", (FRAME * COLS, FRAME * ROWS), (0, 0, 0, 0))
    frames: dict[str, dict] = {}
    T = RIM * D
    for i in range(FRAMES):
        theta = 2 * math.pi * i / FRAMES
        c = math.cos(theta)
        s = math.sin(theta)
        w = max(2, round(fw * abs(c)))
        src = face if c >= 0 else face.transpose(Image.FLIP_LEFT_RIGHT)
        src_sil = sil if c >= 0 else sil.transpose(Image.FLIP_LEFT_RIGHT)
        squashed = src.resize((w, fh), Image.LANCZOS)
        squashed_sil = src_sil.resize((w, fh), Image.LANCZOS)
        cell = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
        cx = (FRAME - w) // 2
        cy = (FRAME - fh) // 2
        # Rim: the silhouette stacked sideways from the face to T·sinθ behind it, so the edge shows
        # on the side turning away and grows as the coin turns toward edge-on.
        dx = T * s
        steps = max(1, int(abs(dx)))
        for j in range(steps, 0, -1):
            off = round(dx * j / steps)
            cell.alpha_composite(squashed_sil, (cx + off, cy))
        cell.alpha_composite(squashed, (cx, cy))
        col, row = i % COLS, i // COLS
        x, y = col * FRAME, row * FRAME
        sheet.alpha_composite(cell, (x, y))
        frames[f"{i + 1}.png"] = {
            "frame": {"x": x, "y": y, "w": FRAME, "h": FRAME},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": FRAME, "h": FRAME},
            "sourceSize": {"w": FRAME, "h": FRAME},
        }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    webp = OUT_DIR / f"{OUT_NAME}.webp"
    sheet.save(webp, "WEBP", quality=90, method=6)
    data = {
        "frames": frames,
        "animations": {"coin": [f"{i + 1}.png" for i in range(FRAMES)]},
        "meta": {
            "app": "scripts/build-win-coin.py",
            "version": "1.0",
            "image": f"{OUT_NAME}.webp",
            "format": "RGBA8888",
            "size": {"w": FRAME * COLS, "h": FRAME * ROWS},
            "scale": "2",
        },
    }
    (OUT_DIR / f"{OUT_NAME}.json").write_text(json.dumps(data, indent="\t") + "\n")
    print(f"wrote {webp} ({webp.stat().st_size // 1024}KB) + json")

    preview = Image.new("RGBA", sheet.size, (70, 45, 120, 255))
    preview.alpha_composite(sheet)
    preview.resize((sheet.width // 2, sheet.height // 2), Image.LANCZOS).save(
        APP / "art-src" / "coin" / "preview_sheet.png"
    )


if __name__ == "__main__":
    main()
