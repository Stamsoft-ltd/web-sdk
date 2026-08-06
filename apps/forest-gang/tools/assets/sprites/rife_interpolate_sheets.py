#!/usr/bin/env python3
"""Raise the reel-clip frame rates by RIFE-interpolating the shipped sprite sheets in place.

The authored sheets carry 15-20 fps of unique frames (decimated from the Magnific mp4s by the
generate_*_anim.py scripts). This script multiplies the frame count with RIFE v4.6 (arbitrary
timestep) so the clips can run at 60 fps (animationSpeed 1) or 30 fps (0.5) on the 60 Hz ticker:

  win sheets    20 fps x3 -> 60 fps      money sheets  15 fps x4 -> 60 fps
  scatter/wild  20 fps x3 -> 60 fps      idle sheets   15 fps x2 -> 30 fps
                                         (idle frames are too large for x4 in a 4096px atlas)

RIFE has no alpha support, so each sheet runs twice — RGB composited on black, plus the alpha
channel as grayscale — and the results are recombined, un-premultiplying the RGB so edge pixels
don't keep the black matte. Looping sheets (idles/scatter/wild) interpolate across the wrap seam
by appending frame 0 before the run and dropping the duplicate afterwards.

Output overwrites the source .webp/.json under static/assets/sprites/ with the same file names
and frame-name pattern; only the frame count grows. Bump the ?v= cache busters in game/assets.ts
after running.

Usage:
  python3 rife_interpolate_sheets.py --rife /path/to/rife-ncnn-vulkan --model /path/to/rife-v4.6
Requires: PIL, numpy, and the rife-ncnn-vulkan binary (https://github.com/nihui/rife-ncnn-vulkan).
"""

import argparse
import json
import math
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

SPRITES = Path(__file__).resolve().parents[3] / "static" / "assets" / "sprites"
ATLAS_MAX = 4096  # safe mobile GPU texture ceiling

# (directory, json name, frame multiplier, loops)
SHEETS = [
    ("bearWinNew", "bear_win_v2.json", 3, False),
    ("foxWinNew", "fox_win_v2.json", 3, False),
    ("rabbitWinNew", "rabbit_win_v2.json", 3, False),
    ("squirrelWinNew", "squirrel_win_v2.json", 3, False),
    ("wolfWinNew", "wolf_win_v2.json", 3, False),
    ("scatterAnim", "scatter_anim.json", 3, True),
    ("wildAnim", "wild_anim_v3.json", 3, True),
    ("bearMoney", "bear_money.json", 4, False),
    ("foxMoney", "fox_money.json", 4, False),
    ("rabbitMoney", "rabbit_money.json", 4, False),
    ("squirrelMoney", "squirrel_money.json", 4, False),
    ("wolfMoney", "wolf_money.json", 4, False),
    ("bearIdleAnim", "bear_idle.json", 2, True),
    ("foxIdleAnim", "fox_idle.json", 2, True),
    ("rabbitIdleAnim", "rabbit_idle.json", 2, True),
    ("squirrelIdleAnim", "squirrel_idle.json", 2, True),
    ("wolfIdleAnim", "wolf_idle.json", 2, True),
]


def frame_keys_in_order(sheet):
    return sorted(sheet["frames"], key=lambda k: int(re.search(r"(\d+)(?=\D*$)", k).group()))


def extract(sheet, atlas):
    """Untrimmed RGBA frames at sourceSize, in playback order."""
    frames = []
    for key in frame_keys_in_order(sheet):
        f = sheet["frames"][key]
        fr = f["frame"]
        crop = atlas.crop((fr["x"], fr["y"], fr["x"] + fr["w"], fr["y"] + fr["h"]))
        src = f["sourceSize"]
        canvas = Image.new("RGBA", (src["w"], src["h"]), (0, 0, 0, 0))
        off = f.get("spriteSourceSize", {"x": 0, "y": 0})
        canvas.paste(crop, (off["x"], off["y"]))
        frames.append(canvas)
    sizes = {f.size for f in frames}
    assert len(sizes) == 1, f"non-uniform sourceSize: {sizes}"
    return frames


def run_rife(rife, model, frames, count, work):
    """Interpolate a channel (list of RGB images) to `count` frames."""
    src, dst = work / "in", work / "out"
    for d in (src, dst):
        shutil.rmtree(d, ignore_errors=True)
        d.mkdir(parents=True)
    for i, fr in enumerate(frames):
        fr.save(src / f"{i:08d}.png")
    subprocess.run(
        [str(rife), "-i", str(src), "-o", str(dst), "-n", str(count), "-m", str(model)],
        check=True,
        capture_output=True,
    )
    out = sorted(dst.glob("*.png"))
    assert len(out) == count, f"rife wrote {len(out)}, wanted {count}"
    return [Image.open(p).copy() for p in out]


def unpremultiply(rgb_img, alpha_img):
    rgb = np.asarray(rgb_img.convert("RGB"), dtype=np.float32)
    a = np.asarray(alpha_img.convert("L"), dtype=np.float32)
    out = np.clip(rgb * 255.0 / np.maximum(a, 1.0)[..., None], 0, 255).astype(np.uint8)
    frame = Image.fromarray(out)
    frame.putalpha(Image.fromarray(a.astype(np.uint8)))
    return frame


def next_frame_name(first_key, index):
    m = re.match(r"^(.*?)(\d+)(\D*)$", first_key)
    prefix, digits, suffix = m.groups()
    start = int(digits)
    pad = len(digits) if digits.startswith("0") else 0
    return f"{prefix}{start + index:0{pad}d}{suffix}"


def process(rife, model, workdir, dirname, jsonname, mult, loops):
    folder = SPRITES / dirname
    sheet = json.loads((folder / jsonname).read_text())
    image_name = sheet["meta"]["image"].split("?")[0]
    atlas = Image.open(folder / image_name).convert("RGBA")
    frames = extract(sheet, atlas)
    n = len(frames)
    w, h = frames[0].size

    # Loops interpolate across the wrap seam: append frame 0, ask for one extra, drop it.
    target = n * mult
    inputs = frames + [frames[0]] if loops else frames
    count = target + 1 if loops else target

    work = workdir / dirname
    rgb_in = [Image.new("RGB", f.size) for f in inputs]
    for canvas, f in zip(rgb_in, inputs):
        canvas.paste(f, mask=f.split()[3])
    rgb_out = run_rife(rife, model, rgb_in, count, work / "rgb")
    alpha_out = run_rife(rife, model, [f.split()[3].convert("RGB") for f in inputs], count, work / "alpha")
    combined = [unpremultiply(r, a) for r, a in zip(rgb_out, alpha_out)][:target]

    cols = min(target, ATLAS_MAX // w)
    rows = math.ceil(target / cols)
    assert rows * h <= ATLAS_MAX, f"{dirname}: {target}f of {w}x{h} won't fit {ATLAS_MAX}px"
    packed = Image.new("RGBA", (cols * w, rows * h), (0, 0, 0, 0))
    for i, fr in enumerate(combined):
        packed.paste(fr, ((i % cols) * w, (i // cols) * h))
    packed.save(folder / image_name, quality=90)

    first_key = frame_keys_in_order(sheet)[0]
    sheet["frames"] = {
        next_frame_name(first_key, i): {
            "frame": {"x": (i % cols) * w, "y": (i // cols) * h, "w": w, "h": h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
            "sourceSize": {"w": w, "h": h},
        }
        for i in range(target)
    }
    sheet["meta"]["size"] = {"w": packed.width, "h": packed.height}
    (folder / jsonname).write_text(json.dumps(sheet, indent="\t") + "\n")
    print(f"{dirname}: {n} -> {target} frames, atlas {packed.width}x{packed.height}", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rife", required=True, help="path to rife-ncnn-vulkan binary")
    ap.add_argument("--model", required=True, help="path to rife-v4.6 model dir (arbitrary -n needs v4)")
    ap.add_argument("--workdir", help="scratch dir (kept for inspection); default: temp dir")
    ap.add_argument("--only", help="process a single sheet directory")
    args = ap.parse_args()

    workdir = Path(args.workdir) if args.workdir else Path(tempfile.mkdtemp(prefix="rife-sheets-"))
    workdir.mkdir(parents=True, exist_ok=True)
    for dirname, jsonname, mult, loops in SHEETS:
        if args.only and dirname != args.only:
            continue
        process(Path(args.rife), Path(args.model), workdir, dirname, jsonname, mult, loops)


if __name__ == "__main__":
    sys.exit(main())
