#!/usr/bin/env python3
"""Win-card MP4s -> alpha-keyed pixi spritesheets.

The sources are 1440x1440 (wild: 960x960) yuv420p H.264 with the card composited on
BLACK - no alpha channel. The card silhouette is static across frames, so:

  1. every frame is extracted at the target 512x512,
  2. a max-composite over the selected frames gives the brightness footprint, and a
     border flood-fill + centre flood-fill give the card's bounding box in video space,
  3. the OPACITY comes from the static design export (static/assets/.../wins/<tier>.webp):
     its alpha channel is the design's own silhouette - dark card interiors opaque,
     enclosed background pockets open - which no luma/morphology heuristic could decide
     (epic's under-plate band is opaque near-black by design; mythic's spike fringe is
     open). The static alpha is bbox-warped onto the video framing (IoU >= 0.96 across
     tiers after alignment),
  4. per frame: alpha = warped static alpha, or luma max(R,G,B) where the static is
     open - then un-premultiplied from black so glows composite correctly in-game.

Output: static/assets/sprites/winCards/<tier>_card.webp + .json (pixi hash format,
one animation per sheet, frames in playback order).
"""

import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

SRC_DIR = Path("/Users/stanislavmilev/Downloads/Theme park/win cards")
STATIC_DIR = Path(
    "/Users/stanislavmilev/Development/stake/forestSlot/apps/theme-park/static/assets/theme-park/v2/wins"
)
OUT_DIR = Path(
    "/Users/stanislavmilev/Development/stake/forestSlot/apps/theme-park/static/assets/sprites/winCards"
)
TIERS = ["sweet", "wild", "epic", "mythic", "legendary"]

FRAME = 512
COUNT = 36
COLS = 6
DARK_THRESHOLD = 20
WEBP_QUALITY = 85


def flood(passable: np.ndarray, seeds: np.ndarray) -> np.ndarray:
    """4-connected reachability of `seeds` through `passable` (bool arrays)."""
    out = seeds & passable
    prev = -1
    while True:
        total = int(out.sum())
        if total == prev:
            return out
        prev = total
        grown = out.copy()
        grown[1:, :] |= out[:-1, :]
        grown[:-1, :] |= out[1:, :]
        grown[:, 1:] |= out[:, :-1]
        grown[:, :-1] |= out[:, 1:]
        out = grown & passable




def process_tier(tier: str) -> dict:
    src = SRC_DIR / f"{tier}_win.mp4"
    with tempfile.TemporaryDirectory() as td:
        subprocess.run(
            [
                "ffmpeg", "-v", "error", "-i", str(src),
                "-vf", f"scale={FRAME}:{FRAME}:flags=lanczos",
                f"{td}/f_%03d.png",
            ],
            check=True,
        )
        files = sorted(Path(td).glob("f_*.png"))
        n = len(files)
        picks = sorted(set(int(round(i)) for i in np.linspace(0, n - 1, COUNT)))
        frames = [np.asarray(Image.open(files[i]).convert("RGB"), dtype=np.uint8) for i in picks]

    duration = n / 24.0  # all sources are 24 fps

    # Card silhouette from a SINGLE mid frame, not the max-composite: composited glow flicker
    # brightens the margin around the card over 36 frames, bridging the flood mask outward and
    # inflating the bbox enough to misalign the static-alpha warp (epic dropped to IoU 0.91).
    mid = frames[len(frames) // 2].max(axis=2)
    dark = mid < DARK_THRESHOLD
    border = np.zeros_like(dark)
    border[0, :] = border[-1, :] = border[:, 0] = border[:, -1] = True
    outside = flood(dark, border)
    centre = np.zeros_like(dark)
    centre[FRAME // 2, FRAME // 2] = True
    card = flood(~outside, centre)
    if not card[FRAME // 2, FRAME // 2]:
        raise RuntimeError(f"{tier}: centre pixel not inside card")

    # Opacity ground truth: the static design export's alpha, bbox-warped onto the video
    # framing. See the module docstring for why heuristics cannot decide pocket-vs-interior.
    def bbox(mask: np.ndarray) -> tuple[int, int, int, int]:
        ys, xs = np.where(mask)
        return int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())

    static_alpha = np.asarray(
        Image.open(STATIC_DIR / f"{tier}.webp").convert("RGBA"), dtype=np.uint8
    )[..., 3]
    sx0, sx1, sy0, sy1 = bbox(static_alpha > 128)
    vx0, vx1, vy0, vy1 = bbox(card)
    warped_img = Image.new("L", (FRAME, FRAME), 0)
    warped_img.paste(
        Image.fromarray(static_alpha[sy0 : sy1 + 1, sx0 : sx1 + 1], "L").resize(
            (vx1 - vx0 + 1, vy1 - vy0 + 1), Image.LANCZOS
        ),
        (vx0, vy0),
    )
    card_alpha = np.asarray(warped_img, dtype=np.uint8)
    wm = card_alpha > 128
    iou = (wm & card).sum() / (wm | card).sum()
    if iou < 0.93:
        raise RuntimeError(f"{tier}: static/video silhouette mismatch, IoU {iou:.3f}")
    print(f"{tier}: static-alpha warp IoU {iou:.4f}")

    rows = (len(frames) + COLS - 1) // COLS
    sheet = Image.new("RGBA", (COLS * FRAME, rows * FRAME), (0, 0, 0, 0))
    frames_json: dict = {}
    names: list[str] = []

    for idx, rgb in enumerate(frames):
        mc = rgb.max(axis=2)
        glow_alpha = np.where(card_alpha >= 200, 0, mc).astype(np.uint8)
        alpha = np.maximum(card_alpha, glow_alpha)

        # Un-premultiply from black everywhere the pixel is not fully opaque.
        out = rgb.astype(np.float32)
        a = alpha.astype(np.float32)
        semi = (alpha > 0) & (alpha < 255)
        scale = np.where(semi, 255.0 / np.maximum(a, 1.0), 1.0)
        out = np.clip(out * scale[..., None], 0, 255)

        rgba = np.dstack([out.astype(np.uint8), alpha])
        x = (idx % COLS) * FRAME
        y = (idx // COLS) * FRAME
        sheet.paste(Image.fromarray(rgba, "RGBA"), (x, y))

        name = f"{tier}_card_{idx:02d}.png"
        names.append(name)
        frames_json[name] = {
            "frame": {"x": x, "y": y, "w": FRAME, "h": FRAME},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": FRAME, "h": FRAME},
            "sourceSize": {"w": FRAME, "h": FRAME},
        }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    image_name = f"{tier}_card.webp"
    sheet.save(OUT_DIR / image_name, quality=WEBP_QUALITY, method=6)

    meta = {
        "app": "custom",
        "version": "1.0",
        "image": image_name,
        "format": "RGBA8888",
        "size": {"w": sheet.width, "h": sheet.height},
        "scale": "1",
    }
    doc = {"frames": frames_json, "animations": {f"{tier}Card": names}, "meta": meta}
    (OUT_DIR / f"{tier}_card.json").write_text(json.dumps(doc))

    fps = len(frames) / duration
    size_kb = (OUT_DIR / image_name).stat().st_size // 1024
    print(f"{tier}: {n} src frames -> {len(frames)} @ {fps:.1f} fps, "
          f"sheet {sheet.width}x{sheet.height}, {size_kb} KB")
    return {"tier": tier, "fps": fps}


if __name__ == "__main__":
    results = [process_tier(t) for t in (sys.argv[1:] or TIERS)]
    for r in results:
        print(f"{r['tier']}Card animationSpeed (60fps ticker): {r['fps'] / 60:.3f}")
