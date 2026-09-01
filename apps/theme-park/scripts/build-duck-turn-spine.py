#!/usr/bin/env python3
"""Build the Duck Your Luck 2.5D front-to-back Spine 4.2 rig.

The duck and swim ring are separate layers. Sixteen coherent high-resolution authored anchors plus
motion-compensated fillers
swap on one always-opaque slot while the duck bobs and turns inside a ring that
keeps its depth, squash, and waterline. Outputs are deterministic and runtime-ready:

    static/assets/spines/duckTurn/duck_turn.{json,atlas,webp}
"""

from __future__ import annotations

import bisect
import colorsys
import hashlib
import json
import math
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image
from PIL import ImageFilter

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.web_image import save_web  # noqa: E402


APP_ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = APP_ROOT / "source-assets-unused/assets/theme-park/duck-turn-handdrawn"
OUTPUT_DIR = APP_ROOT / "static/assets/spines/duckTurn"

POSE_SHEET = SOURCE_DIR / "duck_pose_sheet.png"
RING_SOURCE = SOURCE_DIR / "ring.png"
RING_NO_STAR_SOURCE = SOURCE_DIR / "ring_no_star.png"
HAT_FRONT_SOURCES = [
    SOURCE_DIR / f"party_hat_front_combo_{index}.png" for index in range(4)
]
HAT_REAR_SOURCES = [
    SOURCE_DIR / f"party_hat_rear_combo_{index}.png" for index in range(4)
]
GLASSES_SOURCES = [
    SOURCE_DIR / f"sunglasses_combo_{index}.png" for index in range(4)
]
GLASSES_FRONT_SOURCES = [
    SOURCE_DIR / f"sunglasses_front_combo_{index}.png" for index in range(4)
]
GLASSES_REAR_SOURCES = [
    SOURCE_DIR / f"sunglasses_rear_combo_{index}.png" for index in range(4)
]

FRAME_SIZE = 384
ATLAS_MAX_WIDTH = 2048
ATLAS_TRIM_PADDING = 2
ATLAS_REGION_GAP = 2
KEY_POSE_COUNT = 16
SOURCE_POSE_COUNT = 16
POSE_COUNT = 64
OPENING_FRAME_SHA256 = "4e9674e992f1a54b5bf88e9fdabad0b5dc131946567cb426be47477993d1ddb5"
DUCK_ART_SCALE = 0.95
DUCK_MAX_WIDTH = 276 * DUCK_ART_SCALE
DUCK_MAX_HEIGHT = 286 * DUCK_ART_SCALE
DUCK_BASELINE = 318
RING_WIDTH = 372
RING_BASELINE = 376

TURN_SPEED_BOOST = 2.16


def turn_time(original_seconds: float) -> float:
    return round(original_seconds / TURN_SPEED_BOOST, 5)


TURN_POSE_END = turn_time(0.273)
TURN_DURATION = turn_time(0.312)
POSE_TIMES = [
    round(index * TURN_POSE_END / (POSE_COUNT - 1), 5)
    for index in range(POSE_COUNT)
]

ACCESSORY_COLOR_COUNT = len(HAT_FRONT_SOURCES)
DUCK_LOOK_COUNT = 1 + ACCESSORY_COLOR_COUNT * 2 + ACCESSORY_COLOR_COUNT**2
# Preserve the approved pre-restyle motion tracks, translated onto the new Duck's head anchor.
HAT_X_TRACK = [(0, 196), (8, 201), (16, 192.5), (24, 193), (32, 193.5), (40, 201), (48, 205), (63, 205)]
HAT_BASE_WIDTH = 68
HAT_BASE_HEIGHT = 86
HAT_BASE_ANGLE = math.degrees(math.atan2(-0.09 * HAT_BASE_WIDTH, HAT_BASE_HEIGHT))
HAT_SCALE_X = 1.1156
HAT_SCALE_Y = 1.1156
HAT_Y_OFFSET = 11
HAT_FRONT_X_OFFSET = -8
HAT_REAR_X_OFFSET = 0
HAT_REAR_SHOW_POSE = 44
GLASSES_X_TRACK = [(0, 174.5), (8, 183.5), (16, 168), (24, 149.5), (32, 145.5), (40, 145), (46, 142)]
GLASSES_Y_TRACK = [(0, 106), (8, 104), (16, 102), (24, 105), (32, 105), (40, 100), (46, 105)]
GLASSES_BASE_WIDTH = 145
GLASSES_BASE_HEIGHT = 52
GLASSES_CENTER_OFFSET_X = 31
GLASSES_SCALE_X = 1.05
GLASSES_SCALE_Y = 1.05
GLASSES_FRONT_X_OFFSET = -29
GLASSES_FRONT_Y_OFFSET = 18
GLASSES_ROTATION = -8
GLASSES_PERSPECTIVE_REDUCTION = 80
GLASSES_REAR_BASE_WIDTH = 148
GLASSES_REAR_SCALE = 0.875
GLASSES_REAR_X_OFFSET = 0
GLASSES_REAR_Y_OFFSET = 0
GLASSES_REAR_SHOW_POSE = 48

# Hue values use Pillow's 0..255 HSV range. None keeps the authored purple.
RING_VARIANTS = {
    1: {"hue": None, "star": True, "striped": False, "value": 1.0, "saturation": 0},
    2: {"hue": None, "star": False, "striped": False, "value": 1.0, "saturation": 0},
    3: {"hue": 170, "star": True, "striped": False, "value": 1.0, "saturation": 195},
    4: {"hue": 170, "star": False, "striped": False, "value": 1.0, "saturation": 195},
    5: {"hue": 132, "star": True, "striped": False, "value": 1.0, "saturation": 195},
    6: {"hue": 132, "star": False, "striped": False, "value": 1.0, "saturation": 195},
    7: {"hue": 224, "star": True, "striped": False, "value": 1.0, "saturation": 195},
    8: {"hue": 224, "star": False, "striped": False, "value": 1.0, "saturation": 195},
    9: {"hue": 0, "star": True, "striped": False, "value": 1.0, "saturation": 210},
    10: {"hue": 0, "star": False, "striped": False, "value": 1.0, "saturation": 210},
    11: {"hue": 18, "star": True, "striped": False, "value": 1.0, "saturation": 215},
    12: {"hue": 18, "star": False, "striped": False, "value": 1.0, "saturation": 215},
    13: {"hue": 85, "star": True, "striped": False, "value": 1.0, "saturation": 205},
    14: {"hue": 85, "star": False, "striped": False, "value": 1.0, "saturation": 205},
    15: {"hue": 39, "star": True, "striped": False, "value": 1.0, "saturation": 205},
    16: {"hue": 39, "star": False, "striped": False, "value": 1.0, "saturation": 205},
}
RING_VARIANT_COUNT = len(RING_VARIANTS)


def opaque_x_spans(image: Image.Image, threshold: int = 16) -> list[tuple[int, int]]:
    """Find separated sprite cells from the transparent turnaround sheet."""
    alpha = image.getchannel("A")
    pixels = alpha.load()
    columns = [
        sum(pixels[x, y] > threshold for y in range(image.height))
        for x in range(image.width)
    ]
    spans: list[tuple[int, int]] = []
    start: int | None = None
    for x, count in enumerate(columns + [0]):
        if count and start is None:
            start = x
        elif not count and start is not None:
            if x - start > 20:
                spans.append((start, x))
            start = None
    return spans


def place_on_frame(
    image: Image.Image,
    *,
    max_width: int,
    max_height: int,
    baseline: int,
) -> Image.Image:
    """Fit opaque art to one common scale, centre, and waterline."""
    rgba = image.convert("RGBA")
    bbox = rgba.getchannel("A").getbbox()
    if not bbox:
        raise ValueError("Duck source has no opaque pixels")
    crop = rgba.crop(bbox)
    scale = min(max_width / crop.width, max_height / crop.height)
    crop = crop.resize(
        (round(crop.width * scale), round(crop.height * scale)),
        Image.Resampling.LANCZOS,
    )
    frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE))
    frame.alpha_composite(crop, ((FRAME_SIZE - crop.width) // 2, baseline - crop.height))
    return frame


def motion_interpolate_poses(source_poses: list[Image.Image]) -> list[Image.Image]:
    """Expand the coherent authored anchors into sixty-four motion-compensated poses.

    RGB is premultiplied and alpha is interpolated separately. This prevents the transparent
    hands/eyes produced by straight RGBA crossfades. Exact start/rear drawings are restored after
    interpolation, so the shipped opening frame and prize landing cannot drift.
    """
    if len(source_poses) != SOURCE_POSE_COUNT:
        raise ValueError("Duck turn motion source count mismatch")

    with tempfile.TemporaryDirectory(prefix="theme-park-duck-flow-") as temp:
        root = Path(temp)
        color_input = root / "color-input"
        alpha_input = root / "alpha-input"
        color_output = root / "color-output"
        alpha_output = root / "alpha-output"
        for directory in (color_input, alpha_input, color_output, alpha_output):
            directory.mkdir()

        # Two rear duplicates give minterpolate enough future input to emit the final held sample.
        for index, pose in enumerate([*source_poses, source_poses[-1], source_poses[-1]]):
            rgba = np.asarray(pose.convert("RGBA"))
            alpha = rgba[:, :, 3:4].astype(np.float32) / 255
            premultiplied = np.round(rgba[:, :, :3] * alpha).astype(np.uint8)
            alpha_rgb = np.repeat(rgba[:, :, 3:4], 3, axis=2)
            Image.fromarray(premultiplied, "RGB").save(color_input / f"{index:03d}.png")
            Image.fromarray(alpha_rgb, "RGB").save(alpha_input / f"{index:03d}.png")

        filter_graph = (
            f"minterpolate=fps={POSE_COUNT - 1}/{SOURCE_POSE_COUNT - 1}:mi_mode=mci:mc_mode=aobmc:"
            "me_mode=bidir:vsbmc=1"
        )
        for input_dir, output_dir in (
            (color_input, color_output),
            (alpha_input, alpha_output),
        ):
            subprocess.run(
                [
                    "ffmpeg",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-y",
                    "-framerate",
                    "1",
                    "-i",
                    str(input_dir / "%03d.png"),
                    "-vf",
                    filter_graph,
                    "-frames:v",
                    str(POSE_COUNT),
                    str(output_dir / "%03d.png"),
                ],
                check=True,
            )

        poses: list[Image.Image] = []
        for index in range(1, POSE_COUNT + 1):
            color = np.asarray(
                Image.open(color_output / f"{index:03d}.png").convert("RGB")
            ).astype(np.float32)
            alpha = np.asarray(
                Image.open(alpha_output / f"{index:03d}.png").convert("RGB")
            )[:, :, 0:1].astype(np.float32)
            rgb = np.divide(
                color * 255,
                alpha,
                out=np.zeros_like(color),
                where=alpha > 3,
            )
            rgba = np.concatenate((np.clip(rgb, 0, 255), alpha), axis=2).astype(np.uint8)
            rgba[alpha[:, :, 0] <= 3] = 0
            poses.append(Image.fromarray(rgba, "RGBA"))

    # Restore every authored key at its exact runtime sample. Optical flow supplies only the
    # in-betweens; it must not ghost eyes, beak, wings, hats, or glasses at key poses.
    for source_index, source_pose in enumerate(source_poses):
        target_index = round(source_index * (POSE_COUNT - 1) / (SOURCE_POSE_COUNT - 1))
        poses[target_index] = source_pose.copy()
    poses[-2] = source_poses[-1].copy()
    poses[-1] = source_poses[-1].copy()
    return poses


def build_pose_frames() -> dict[str, Image.Image]:
    def extract(sheet_path: Path, expected: int) -> list[Image.Image]:
        sheet = Image.open(sheet_path).convert("RGBA")
        raw_spans = opaque_x_spans(sheet)
        spans: list[tuple[int, int]] = []
        # Side/rear hand-drawn poses can have a genuine clear column between the beak and body.
        # Generated source sheets use >=120px between frames, so merge only smaller internal gaps.
        for left, right in raw_spans:
            if spans and left - spans[-1][1] < 100:
                spans[-1] = (spans[-1][0], right)
            else:
                spans.append((left, right))
        if len(spans) != expected:
            raise ValueError(f"Expected {expected} Duck poses in {sheet_path}, found {len(spans)}")
        return [sheet.crop((left, 0, right, sheet.height)) for left, right in spans]

    # Sixteen coherent anchors from the approved Mega Coaster-style generation pass. Optical-flow
    # fillers provide the 64 runtime samples without mixing independent art styles or contours.
    ordered = extract(POSE_SHEET, KEY_POSE_COUNT)

    if len(ordered) != SOURCE_POSE_COUNT:
        raise ValueError("Duck turn authored pose count mismatch")

    authored: list[Image.Image] = []
    for pose_index, pose in enumerate(ordered):
        # The authored sheet already starts beak-right and takes the short route to the rear.
        placed = place_on_frame(
            pose,
            max_width=DUCK_MAX_WIDTH,
            max_height=DUCK_MAX_HEIGHT,
            baseline=DUCK_BASELINE,
        )
        # Accessory art faces the opposite short-side direction. Mirror only the Duck; the ring,
        # hats and glasses keep their authored direction and Spine transforms.
        placed = placed.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        if pose_index == 0:
            opening_hash = hashlib.sha256(placed.tobytes()).hexdigest()
            if opening_hash != OPENING_FRAME_SHA256:
                raise ValueError(
                    f"Duck turn opening frame changed: {opening_hash}"
                )
        authored.append(placed)

    poses = motion_interpolate_poses(authored)
    if hashlib.sha256(poses[0].tobytes()).hexdigest() != OPENING_FRAME_SHA256:
        raise ValueError("Duck turn interpolated opening frame changed")
    return {f"pose_{pose_index}": pose for pose_index, pose in enumerate(poses)}


def build_ring_frame(source_path: Path) -> Image.Image:
    ring = Image.open(source_path).convert("RGBA")
    bbox = ring.getchannel("A").getbbox()
    if not bbox:
        raise ValueError("Ring source has no opaque pixels")
    ring = ring.crop(bbox)
    scale = RING_WIDTH / ring.width
    ring = ring.resize(
        (RING_WIDTH, round(ring.height * scale)),
        Image.Resampling.LANCZOS,
    )
    frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE))
    frame.alpha_composite(
        ring,
        ((FRAME_SIZE - ring.width) // 2, RING_BASELINE - ring.height),
    )
    return frame


def recolour_ring(ring: Image.Image, variant: int) -> Image.Image:
    """Recolour only the purple torus, retaining dimensional light and shade."""
    config = RING_VARIANTS[variant]
    if config["hue"] is None:
        return ring.copy()

    rgba = ring.convert("RGBA")
    hsv = rgba.convert("HSV")
    source = rgba.load()
    colour = hsv.load()
    star_exclusion = np.zeros((FRAME_SIZE, FRAME_SIZE), dtype=bool)
    if config["star"]:
        pixels = np.asarray(rgba)
        yy, _ = np.indices((FRAME_SIZE, FRAME_SIZE))
        yellow_core = (
            (yy >= round(FRAME_SIZE * 0.52))
            & (pixels[:, :, 3] > 8)
            & (pixels[:, :, 0] > 150)
            & (pixels[:, :, 1] > 75)
            & (pixels[:, :, 2] < 180)
            & (pixels[:, :, 0] > pixels[:, :, 1] * 1.05)
        )
        # Black contour remains black under hue replacement. Excluding only the warm painted
        # pixels preserves the yellow badge without leaving a square of unrecoloured vinyl.
        star_exclusion = yellow_core

    for y in range(FRAME_SIZE):
        for x in range(FRAME_SIZE):
            r, g, b, a = source[x, y]
            h, s, v = colour[x, y]
            if a <= 8 or star_exclusion[y, x]:
                continue

            target_h = int(config["hue"])
            target_s = min(int(config["saturation"]), round(s * 1.15))
            target_v = min(255, round(v * float(config["value"])))

            rr, gg, bb = colorsys.hsv_to_rgb(
                target_h / 255,
                target_s / 255,
                target_v / 255,
            )
            source[x, y] = (round(rr * 255), round(gg * 255), round(bb * 255), a)

    return rgba


def alpha_runs(alpha: Image.Image, x: int, threshold: int = 16) -> list[tuple[int, int]]:
    rows = [y for y in range(alpha.height) if alpha.getpixel((x, y)) > threshold]
    if not rows:
        return []
    runs: list[tuple[int, int]] = []
    start = previous = rows[0]
    for y in rows[1:]:
        if y != previous + 1:
            runs.append((start, previous))
            start = y
        previous = y
    runs.append((start, previous))
    return runs


def split_ring_depth(ring: Image.Image) -> tuple[Image.Image, Image.Image]:
    """Split torus into rear/front arcs so the duck can sit inside it."""
    alpha = ring.getchannel("A")
    lower_edge: dict[int, int] = {}
    for x in range(FRAME_SIZE):
        runs = alpha_runs(alpha, x)
        if len(runs) >= 2:
            lower_edge[x] = runs[-1][0]
    if not lower_edge:
        raise ValueError("Could not detect the ring's inner hole")

    known_xs = sorted(lower_edge)

    def boundary_at(x: int) -> int:
        if x <= known_xs[0]:
            return lower_edge[known_xs[0]]
        if x >= known_xs[-1]:
            return lower_edge[known_xs[-1]]
        right_index = bisect.bisect_left(known_xs, x)
        left_x, right_x = known_xs[right_index - 1], known_xs[right_index]
        if left_x == right_x:
            return lower_edge[left_x]
        mix = (x - left_x) / (right_x - left_x)
        return round(lower_edge[left_x] * (1 - mix) + lower_edge[right_x] * mix)

    back = Image.new("RGBA", ring.size)
    front = Image.new("RGBA", ring.size)
    source = ring.load()
    back_pixels = back.load()
    front_pixels = front.load()
    depth_overlap = 2
    for x in range(FRAME_SIZE):
        boundary = boundary_at(x)
        for y in range(FRAME_SIZE):
            pixel = source[x, y]
            if pixel[3] == 0:
                continue
            # Both depth layers retain two identical rows around the cut. Linear filtering during
            # float squash/rotation can no longer open a transparent hairline between them.
            if y < boundary + depth_overlap:
                back_pixels[x, y] = pixel
            if y >= boundary - depth_overlap:
                front_pixels[x, y] = pixel
    return back, front


def longest_alpha_span(alpha: Image.Image, y: int, threshold: int = 20) -> tuple[int, int]:
    """Return the widest opaque run on one scanline."""
    spans: list[tuple[int, int]] = []
    start: int | None = None
    for x in range(alpha.width + 1):
        opaque = x < alpha.width and alpha.getpixel((x, y)) > threshold
        if opaque and start is None:
            start = x
        elif not opaque and start is not None:
            spans.append((start, x))
            start = None
    return max(spans, key=lambda span: span[1] - span[0], default=(0, 0))


def head_metrics(pose: Image.Image) -> tuple[float, float, float]:
    """Find a stable top-of-head anchor from the normalized Duck silhouette."""
    alpha = pose.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        raise ValueError("Duck accessory pose has no alpha")
    top = float(bbox[1])
    candidates: list[tuple[int, int, int]] = []
    for y in range(bbox[1] + 18, min(bbox[1] + 48, bbox[3])):
        left, right = longest_alpha_span(alpha, y)
        if right - left >= 24:
            candidates.append((right - left, left, right))
    if not candidates:
        return ((bbox[0] + bbox[2]) * 0.5, top, float(bbox[2] - bbox[0]))
    _, left, right = max(candidates)
    return ((left + right) * 0.5, top, float(right - left))


def sample_track(track: list[tuple[int, float]], pose_index: int) -> float:
    """Linear sample from sparse hand-checked accessory anchors."""
    if pose_index <= track[0][0]:
        return track[0][1]
    for (left_index, left_value), (right_index, right_value) in zip(track, track[1:]):
        if pose_index <= right_index:
            mix = (pose_index - left_index) / (right_index - left_index)
            return left_value * (1 - mix) + right_value * mix
    return track[-1][1]


def load_accessory_asset(path: Path) -> Image.Image:
    """Load authored accessory art. Spine bones move this one texture; no pose is raster-drawn."""
    image = Image.open(path).convert("RGBA")
    if not image.getchannel("A").getbbox():
        raise ValueError(f"Duck accessory asset has no alpha: {path}")
    return image


def build_frames() -> dict[str, Image.Image]:
    frames = build_pose_frames()
    for combo, path in enumerate(HAT_FRONT_SOURCES):
        frames[f"party_hat_front_{combo}"] = load_accessory_asset(path)
    for combo, path in enumerate(HAT_REAR_SOURCES):
        frames[f"party_hat_rear_{combo}"] = load_accessory_asset(path)
    for combo, path in enumerate(GLASSES_SOURCES):
        frames[f"sunglasses_{combo}"] = load_accessory_asset(path)
    for combo, path in enumerate(GLASSES_FRONT_SOURCES):
        frames[f"sunglasses_front_{combo}"] = load_accessory_asset(path)
    for combo, path in enumerate(GLASSES_REAR_SOURCES):
        frames[f"sunglasses_rear_{combo}"] = load_accessory_asset(path)
    for variant in range(1, RING_VARIANT_COUNT + 1):
        source = RING_SOURCE if RING_VARIANTS[variant]["star"] else RING_NO_STAR_SOURCE
        base_ring = build_ring_frame(source)
        ring = recolour_ring(base_ring, variant)
        back, front = split_ring_depth(ring)
        frames[f"ring_back_{variant}"] = back
        frames[f"ring_front_{variant}"] = front
    return frames


def build_atlas(frames: dict[str, Image.Image]) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    regions: list[dict[str, object]] = []
    for name, frame in frames.items():
        bbox = frame.getchannel("A").getbbox()
        if not bbox:
            raise ValueError(f"Duck turn atlas region is empty: {name}")
        left = max(0, bbox[0] - ATLAS_TRIM_PADDING)
        top = max(0, bbox[1] - ATLAS_TRIM_PADDING)
        right = min(frame.width, bbox[2] + ATLAS_TRIM_PADDING)
        bottom = min(frame.height, bbox[3] + ATLAS_TRIM_PADDING)
        crop = frame.crop((left, top, right, bottom))
        regions.append(
            {
                "name": name,
                "source": frame,
                "crop": crop,
                "left": left,
                "top": top,
                "bottom": bottom,
                "orig_width": frame.width,
                "orig_height": frame.height,
            }
        )

    x = y = row_height = atlas_width = 0
    for region in sorted(regions, key=lambda item: item["crop"].height, reverse=True):
        crop = region["crop"]
        if x > 0 and x + crop.width > ATLAS_MAX_WIDTH:
            y += row_height + ATLAS_REGION_GAP
            x = 0
            row_height = 0
        region["x"] = x
        region["y"] = y
        x += crop.width + ATLAS_REGION_GAP
        row_height = max(row_height, crop.height)
        atlas_width = max(atlas_width, x - ATLAS_REGION_GAP)
    atlas_height = y + row_height + 1  # final transparent pixel is the runtime prize socket
    atlas_image = Image.new("RGBA", (atlas_width, atlas_height))
    for region in regions:
        atlas_image.alpha_composite(region["crop"], (region["x"], region["y"]))

    # Prove atlas trim offsets reconstruct every full attachment exactly.
    for region in regions:
        restored = Image.new("RGBA", (region["orig_width"], region["orig_height"]))
        restored.alpha_composite(region["crop"], (region["left"], region["top"]))
        if not np.array_equal(np.asarray(restored), np.asarray(region["source"])):
            raise ValueError(f"Duck turn trimmed atlas changed region: {region['name']}")
    save_web(atlas_image, OUTPUT_DIR / "duck_turn.webp", lossless=True)

    lines = [
        "duck_turn.webp",
        f"size: {atlas_width},{atlas_height}",
        "format: RGBA8888",
        "filter: Linear,Linear",
        "repeat: none",
    ]
    for region in regions:
        name = region["name"]
        crop = region["crop"]
        offset_y = region["orig_height"] - region["bottom"]
        lines.extend(
            [
                name,
                "  rotate: false",
                f"  xy: {region['x']}, {region['y']}",
                f"  size: {crop.width}, {crop.height}",
                f"  orig: {region['orig_width']}, {region['orig_height']}",
                f"  offset: {region['left']}, {offset_y}",
                "  index: -1",
            ]
        )

    # Transparent attachment toggles the runtime SpineSlot holding localised prize text.
    lines.extend(
        [
            "prize_socket",
            "  rotate: false",
            f"  xy: 0, {atlas_height - 1}",
            "  size: 1, 1",
            "  orig: 1, 1",
            "  offset: 0, 0",
            "  index: -1",
        ]
    )
    (OUTPUT_DIR / "duck_turn.atlas").write_text("\n".join(lines) + "\n")


def eased_xy(points: list[tuple[float, float, float]]) -> list[dict[str, object]]:
    """Encode Spine 4.2 bezier keys with absolute time/value controls."""
    keys: list[dict[str, object]] = []
    for index, (time, x, y) in enumerate(points):
        key: dict[str, object] = {"time": time, "x": x, "y": y}
        if index + 1 < len(points):
            next_time, next_x, next_y = points[index + 1]
            span = next_time - time
            control_1 = round(time + span * 0.25, 5)
            control_2 = round(time + span * 0.75, 5)
            key["curve"] = [
                control_1,
                x,
                control_2,
                next_x,
                control_1,
                y,
                control_2,
                next_y,
            ]
        keys.append(key)
    return keys


def eased_rotate(points: list[tuple[float, float]]) -> list[dict[str, object]]:
    keys: list[dict[str, object]] = []
    for index, (time, value) in enumerate(points):
        key: dict[str, object] = {"time": time, "value": value}
        if index + 1 < len(points):
            next_time, next_value = points[index + 1]
            span = next_time - time
            key["curve"] = [
                round(time + span * 0.25, 5),
                value,
                round(time + span * 0.75, 5),
                next_value,
            ]
        keys.append(key)
    return keys


def attachment(name: str | None, time: float = 0) -> dict[str, object]:
    key: dict[str, object] = {"time": round(time, 5)}
    if name is not None:
        key["name"] = name
    return key


def static_slots(variant: int, pose_index: int, show_prize: bool) -> dict[str, object]:
    return {
        "ring_back": {"attachment": [attachment(f"ring_back_{variant}")]},
        "ring_front": {"attachment": [attachment(f"ring_front_{variant}")]},
        "duck_pose": {"attachment": [attachment(f"pose_{pose_index}")]},
        "prize": {"attachment": [attachment("prize_socket" if show_prize else None)]},
    }


def idle_animation(variant: int, back: bool) -> dict[str, object]:
    return {
        "slots": static_slots(variant, POSE_COUNT - 1 if back else 0, back),
        "bones": {
            "float": {
                "translate": eased_xy(
                    [(0, 0, 0), (0.55, 0, 2.8), (1.1, 0, 0), (1.65, 0, -1.8), (2.2, 0, 0)]
                )
            },
            "duck": {
                "translate": eased_xy(
                    [(0, 0, 0), (0.55, 0.8, 1.2), (1.1, 0, 0), (1.65, -0.8, -0.8), (2.2, 0, 0)]
                ),
                "rotate": eased_rotate([(0, 0), (0.55, 1.1), (1.1, 0), (1.65, -1.1), (2.2, 0)]),
            },
            "ring": {
                "scale": eased_xy(
                    [(0, 1, 1), (0.55, 1.008, 0.987), (1.1, 1, 1), (1.65, 0.994, 1.01), (2.2, 1, 1)]
                )
            },
        },
    }


def turn_animation(variant: int) -> dict[str, object]:
    slots: dict[str, object] = {
        "ring_back": {"attachment": [attachment(f"ring_back_{variant}")]},
        "ring_front": {"attachment": [attachment(f"ring_front_{variant}")]},
        # One attachment slot stays fully opaque for the complete turn. Swapping
        # drawings avoids the two-pose overlap that read as blinking/ghosting.
        "duck_pose": {
            "attachment": [
                attachment(f"pose_{pose_index}", POSE_TIMES[pose_index])
                for pose_index in range(POSE_COUNT)
            ]
        },
        "prize": {
            "attachment": [attachment(None), attachment("prize_socket", POSE_TIMES[-1])]
        },
    }

    return {
        "slots": slots,
        "bones": {
            "float": {
                "translate": eased_xy(
                    [
                        (0, 0, 0),
                        (turn_time(0.06825), 0, 7),
                        (turn_time(0.1365), 0, 36),
                        (turn_time(0.20475), 0, 7),
                        (TURN_POSE_END, 0, 0),
                        (TURN_DURATION, 0, 0),
                    ]
                )
            },
            "duck": {
                "translate": eased_xy(
                    [
                        (0, 0, 0),
                        (turn_time(0.06825), -2, 2),
                        (turn_time(0.1365), 5, 5),
                        (turn_time(0.20475), 2, 2),
                        (TURN_POSE_END, 0, 0),
                        (TURN_DURATION, 0, 0),
                    ]
                ),
                "scale": eased_xy(
                    [
                        (0, 1, 1),
                        (turn_time(0.06825), 0.975, 1.02),
                        (turn_time(0.1365), 0.95, 1.03),
                        (turn_time(0.20475), 0.975, 1.02),
                        (TURN_POSE_END, 1, 1),
                        (TURN_DURATION, 1, 1),
                    ]
                ),
                "rotate": eased_rotate(
                    [
                        (0, 0),
                        (turn_time(0.06825), -2.2),
                        (turn_time(0.1365), 1.3),
                        (turn_time(0.20475), 2.0),
                        (TURN_POSE_END, 0),
                        (TURN_DURATION, 0),
                    ]
                ),
            },
            "ring": {
                "scale": eased_xy(
                    [
                        (0, 1, 1),
                        (turn_time(0.06825), 1.025, 0.96),
                        (turn_time(0.1365), 0.98, 1.035),
                        (turn_time(0.20475), 1.02, 0.97),
                        (TURN_POSE_END, 1, 1),
                        (TURN_DURATION, 1, 1),
                    ]
                ),
                "rotate": eased_rotate(
                    [
                        (0, 0),
                        (turn_time(0.06825), 0.9),
                        (turn_time(0.1365), -0.7),
                        (turn_time(0.20475), 0.45),
                        (TURN_POSE_END, 0),
                        (TURN_DURATION, 0),
                    ]
                ),
            },
            "prize": {
                "scale": eased_xy(
                    [
                        (0, 0.01, 0.01),
                        (TURN_POSE_END, 0.01, 0.01),
                        (turn_time(0.2925), 1.18, 1.18),
                        (TURN_DURATION, 1, 1),
                    ]
                ),
                "rotate": eased_rotate(
                    [
                        (0, -7),
                        (TURN_POSE_END, -7),
                        (turn_time(0.2925), 4),
                        (TURN_DURATION, 0),
                    ]
                ),
            },
        },
    }


def duck_look(look: int) -> tuple[int | None, int | None]:
    """Return (hat color, glasses color) for 25 independently selectable looks."""
    if look == 0:
        return None, None
    if 1 <= look <= ACCESSORY_COLOR_COUNT:
        return None, look - 1
    hat_start = 1 + ACCESSORY_COLOR_COUNT
    if hat_start <= look < hat_start + ACCESSORY_COLOR_COUNT:
        return look - hat_start, None
    both = look - (1 + ACCESSORY_COLOR_COUNT * 2)
    if 0 <= both < ACCESSORY_COLOR_COUNT**2:
        return both // ACCESSORY_COLOR_COUNT, both % ACCESSORY_COLOR_COUNT
    raise ValueError(f"Unknown Duck look: {look}")


def accessory_name(kind: str, color: int | None) -> str | None:
    if color is None:
        return None
    return f"{kind}_{color}"


def hat_transform(pose: Image.Image, pose_index: int) -> tuple[float, float, float, float, float]:
    """Use the approved pre-restyle hat sizing and authored perspective track."""
    head_center, head_top, head_width = head_metrics(pose)
    progress = pose_index / (POSE_COUNT - 1)
    base_width = max(44, min(HAT_BASE_WIDTH, head_width * 0.58))
    lean = (-0.09 + progress * 0.16) * base_width
    angle = math.degrees(math.atan2(lean, HAT_BASE_HEIGHT)) - HAT_BASE_ANGLE
    center_x = (
        head_center + HAT_REAR_X_OFFSET
        if pose_index >= HAT_REAR_SHOW_POSE
        else sample_track(HAT_X_TRACK, pose_index) + HAT_FRONT_X_OFFSET
    )
    center_y = head_top + HAT_Y_OFFSET
    base_scale = base_width / HAT_BASE_WIDTH
    return (
        center_x - FRAME_SIZE * 0.5,
        FRAME_SIZE * 0.5 - center_y,
        base_scale * HAT_SCALE_X,
        base_scale * HAT_SCALE_Y,
        angle,
    )


def glasses_transform(pose_index: int) -> tuple[float, float, float, float, float]:
    """Return shared transforms for the behind-head and front-frame drawings."""
    progress = pose_index / (POSE_COUNT - 1)
    turn = min(1, progress / 0.74)
    eased_turn = turn * turn * (3 - 2 * turn)
    total_width = GLASSES_BASE_WIDTH - GLASSES_PERSPECTIVE_REDUCTION * eased_turn
    perspective = total_width / GLASSES_BASE_WIDTH
    height = max(15, GLASSES_BASE_HEIGHT * (0.76 + perspective * 0.24))
    eye_x = sample_track(GLASSES_X_TRACK, pose_index)
    eye_y = sample_track(GLASSES_Y_TRACK, pose_index) + GLASSES_FRONT_Y_OFFSET
    center_x = (
        eye_x
        + GLASSES_CENTER_OFFSET_X * perspective * GLASSES_SCALE_X
        + GLASSES_FRONT_X_OFFSET
    )
    return (
        center_x - FRAME_SIZE * 0.5,
        FRAME_SIZE * 0.5 - eye_y,
        perspective * GLASSES_SCALE_X,
        height / GLASSES_BASE_HEIGHT * GLASSES_SCALE_Y,
        GLASSES_ROTATION,
    )


def rear_glasses_transform(
    pose: Image.Image,
) -> tuple[float, float, float, float, float]:
    """Fit the authored rear temple arms to the current round head silhouette."""
    head_center, head_top, head_width = head_metrics(pose)
    scale = head_width / GLASSES_REAR_BASE_WIDTH * GLASSES_REAR_SCALE
    center_y = head_top + 73 + GLASSES_REAR_Y_OFFSET
    return (
        head_center - FRAME_SIZE * 0.5 + GLASSES_REAR_X_OFFSET,
        FRAME_SIZE * 0.5 - center_y,
        scale,
        scale,
        0,
    )


def transform_timeline(
    transforms: list[tuple[float, float, float, float, float]],
    times: list[float],
) -> dict[str, object]:
    """Animate one authored accessory texture with Spine bone transforms."""
    translate = [
        {"time": time, "x": round(x, 3), "y": round(y, 3)}
        for time, (x, y, _, _, _) in zip(times, transforms)
    ]
    scale = [
        {"time": time, "x": round(scale_x, 4), "y": round(scale_y, 4)}
        for time, (_, _, scale_x, scale_y, _) in zip(times, transforms)
    ]
    rotate = [
        {"time": time, "value": round(rotation, 3)}
        for time, (_, _, _, _, rotation) in zip(times, transforms)
    ]
    return {"translate": translate, "scale": scale, "rotate": rotate}


def held_transform(
    transform: tuple[float, float, float, float, float],
    duration: float,
) -> dict[str, object]:
    return transform_timeline([transform, transform], [0, duration])


def accessory_idle_animation(
    look: int,
    back: bool,
    poses: list[Image.Image],
) -> dict[str, object]:
    hat_color, glasses_color = duck_look(look)
    pose_index = POSE_COUNT - 1 if back else 0
    hat = accessory_name("hat_rear" if back else "hat_front", hat_color)
    glasses_back = None if back else accessory_name("glasses_back", glasses_color)
    glasses_front = None if back else accessory_name("glasses_front", glasses_color)
    glasses_rear = accessory_name("glasses_rear", glasses_color) if back else None
    return {
        "slots": {
            "hat": {"attachment": [attachment(hat), attachment(hat, 2.2)]},
            "glasses_back": {
                "attachment": [attachment(glasses_back), attachment(glasses_back, 2.2)]
            },
            "glasses_front": {
                "attachment": [attachment(glasses_front), attachment(glasses_front, 2.2)]
            },
            "glasses_rear": {
                "attachment": [attachment(glasses_rear), attachment(glasses_rear, 2.2)]
            },
        },
        "bones": {
            "hat_bone": held_transform(hat_transform(poses[pose_index], pose_index), 2.2),
            "glasses_bone": held_transform(glasses_transform(pose_index), 2.2),
            "glasses_rear_bone": held_transform(
                rear_glasses_transform(poses[pose_index]), 2.2
            ),
        },
    }


def accessory_turn_animation(look: int, poses: list[Image.Image]) -> dict[str, object]:
    hat_color, glasses_color = duck_look(look)
    hat_front = accessory_name("hat_front", hat_color)
    hat_rear = accessory_name("hat_rear", hat_color)
    glasses_back = accessory_name("glasses_back", glasses_color)
    glasses_front = accessory_name("glasses_front", glasses_color)
    glasses_rear = accessory_name("glasses_rear", glasses_color)
    hat_transforms = [hat_transform(pose, index) for index, pose in enumerate(poses)]
    glasses_transforms = [glasses_transform(index) for index in range(POSE_COUNT)]
    rear_glasses_transforms = [rear_glasses_transform(pose) for pose in poses]
    timeline_times = [*POSE_TIMES, TURN_DURATION]
    hat_transforms.append(hat_transforms[-1])
    glasses_transforms.append(glasses_transforms[-1])
    rear_glasses_transforms.append(rear_glasses_transforms[-1])
    glasses_swap_time = POSE_TIMES[GLASSES_REAR_SHOW_POSE]
    hat_swap_time = POSE_TIMES[HAT_REAR_SHOW_POSE]

    return {
        "slots": {
            "hat": {
                "attachment": [
                    attachment(hat_front),
                    attachment(hat_rear, hat_swap_time),
                    attachment(hat_rear, TURN_DURATION),
                ]
            },
            "glasses_back": {
                "attachment": [
                    attachment(glasses_back),
                    attachment(None, glasses_swap_time),
                    attachment(None, TURN_DURATION),
                ]
            },
            "glasses_front": {
                "attachment": [
                    attachment(glasses_front),
                    attachment(None, glasses_swap_time),
                    attachment(None, TURN_DURATION),
                ]
            },
            "glasses_rear": {
                "attachment": [
                    attachment(None),
                    attachment(glasses_rear, glasses_swap_time),
                    attachment(glasses_rear, TURN_DURATION),
                ]
            },
        },
        "bones": {
            "hat_bone": transform_timeline(hat_transforms, timeline_times),
            "glasses_bone": transform_timeline(glasses_transforms, timeline_times),
            "glasses_rear_bone": transform_timeline(
                rear_glasses_transforms, timeline_times
            ),
        },
    }


def build_skeleton(frames: dict[str, Image.Image]) -> None:
    attachments: dict[str, dict[str, object]] = {
        "ring_back": {},
        "ring_front": {},
        "duck_pose": {},
        "hat": {},
        "glasses_back": {},
        "glasses_front": {},
        "glasses_rear": {},
        "prize": {"prize_socket": {"width": 1, "height": 1}},
    }
    for pose_index in range(POSE_COUNT):
        attachments["duck_pose"][f"pose_{pose_index}"] = {
            "width": FRAME_SIZE,
            "height": FRAME_SIZE,
        }
    for combo in range(ACCESSORY_COLOR_COUNT):
        hat_front_asset = frames[f"party_hat_front_{combo}"]
        hat_rear_asset = frames[f"party_hat_rear_{combo}"]
        glasses_asset = frames[f"sunglasses_{combo}"]
        glasses_front_asset = frames[f"sunglasses_front_{combo}"]
        glasses_rear_asset = frames[f"sunglasses_rear_{combo}"]
        attachments["hat"][f"hat_front_{combo}"] = {
            "path": f"party_hat_front_{combo}",
            "width": hat_front_asset.width,
            "height": hat_front_asset.height,
        }
        attachments["hat"][f"hat_rear_{combo}"] = {
            "path": f"party_hat_rear_{combo}",
            "width": hat_rear_asset.width,
            "height": hat_rear_asset.height,
        }
        attachments["glasses_back"][f"glasses_back_{combo}"] = {
            "path": f"sunglasses_{combo}",
            "width": glasses_asset.width,
            "height": glasses_asset.height,
        }
        attachments["glasses_front"][f"glasses_front_{combo}"] = {
            "path": f"sunglasses_front_{combo}",
            "width": glasses_front_asset.width,
            "height": glasses_front_asset.height,
        }
        attachments["glasses_rear"][f"glasses_rear_{combo}"] = {
            "path": f"sunglasses_rear_{combo}",
            "width": glasses_rear_asset.width,
            "height": glasses_rear_asset.height,
        }
    for variant in range(1, RING_VARIANT_COUNT + 1):
        attachments["ring_back"][f"ring_back_{variant}"] = {
            "width": FRAME_SIZE,
            "height": FRAME_SIZE,
        }
        attachments["ring_front"][f"ring_front_{variant}"] = {
            "width": FRAME_SIZE,
            "height": FRAME_SIZE,
        }

    animations: dict[str, object] = {}
    for variant in range(1, RING_VARIANT_COUNT + 1):
        animations[f"idle_{variant}"] = idle_animation(variant, back=False)
        animations[f"turn_{variant}"] = turn_animation(variant)
        # Alias restarts an already-turning duck on the same frame when a normal
        # sequential reveal is promoted to a synchronized skip batch.
        animations[f"turn_batch_{variant}"] = turn_animation(variant)
        animations[f"back_idle_{variant}"] = idle_animation(variant, back=True)
    poses = [frames[f"pose_{pose_index}"] for pose_index in range(POSE_COUNT)]
    for look in range(DUCK_LOOK_COUNT):
        animations[f"look_idle_{look}"] = accessory_idle_animation(look, back=False, poses=poses)
        animations[f"look_turn_{look}"] = accessory_turn_animation(look, poses)
        animations[f"look_turn_batch_{look}"] = accessory_turn_animation(look, poses)
        animations[f"look_back_idle_{look}"] = accessory_idle_animation(look, back=True, poses=poses)

    slots = [
        {"name": "ring_back", "bone": "ring", "attachment": "ring_back_1"},
        {"name": "glasses_back", "bone": "glasses_bone"},
        {"name": "duck_pose", "bone": "duck", "attachment": "pose_0"},
        {"name": "hat", "bone": "hat_bone"},
        {"name": "glasses_front", "bone": "glasses_bone"},
        {"name": "glasses_rear", "bone": "glasses_rear_bone"},
        {"name": "ring_front", "bone": "ring", "attachment": "ring_front_1"},
        {"name": "prize", "bone": "prize"},
    ]

    skeleton = {
        "skeleton": {
            "hash": "duck-your-luck-turn-v40-front-rear-accessory-fit",
            "spine": "4.2.0",
            "x": -FRAME_SIZE / 2,
            "y": -FRAME_SIZE / 2,
            "width": FRAME_SIZE,
            "height": FRAME_SIZE,
            "images": "./",
        },
        "bones": [
            {"name": "root"},
            {"name": "float", "parent": "root"},
            {"name": "ring", "parent": "float"},
            {"name": "duck", "parent": "float", "y": -6},
            {"name": "hat_bone", "parent": "duck"},
            {"name": "glasses_bone", "parent": "duck"},
            {"name": "glasses_rear_bone", "parent": "duck"},
            # Runtime text follows the final rear pose and lands on the rump.
            {"name": "prize", "parent": "duck", "y": -52},
        ],
        "slots": slots,
        "skins": [{"name": "default", "attachments": attachments}],
        "animations": animations,
    }
    (OUTPUT_DIR / "duck_turn.json").write_text(
        json.dumps(skeleton, separators=(",", ":")) + "\n"
    )


def main() -> None:
    frames = build_frames()
    build_atlas(frames)
    build_skeleton(frames)
    print(
        f"Built Duck Your Luck 2.5D Spine rig: {POSE_COUNT} poses, "
        f"{TURN_DURATION:.2f}s turn, {len(frames)} atlas layers -> {OUTPUT_DIR}"
    )


if __name__ == "__main__":
    main()
