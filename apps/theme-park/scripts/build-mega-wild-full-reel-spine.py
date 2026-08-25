#!/usr/bin/env python3
"""Build the full-height Mega Wild rails + fixed plaque + duck wind-spin Spine rig."""

from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image, ImageOps


APP = Path(__file__).resolve().parents[1]
CLEAN_SOURCE = (
    APP
    / "source-assets-unused"
    / "assets"
    / "theme-park"
    / "mega-wild-clean"
)
FULL_REEL_SOURCE = CLEAN_SOURCE / "track-clean.png"
# The multiplier card is the SAME flat neon plate a regular win's amount is drawn inside — the one
# `scripts/win-plate/build_win_plate.py` composes from Figma 7100:26891 and the Roller Wilds star.
# The reel used to hang an authored gold plaque here, drawn with six perspective poses of its own,
# and it was the one card in the game that belonged to no other screen. Reading the finished plate
# rather than rebuilding it from the card and the star keeps the two literally one file: run that
# script first if the plate itself changes.
#
# The retired gold plaque family is left where it was drawn, under source-assets-unused, unread:
# it is the only copy of that art.
PLAQUE_SOURCE = (
    APP / "static" / "assets" / "theme-park" / "v2" / "wins" / "small-win-plate-neon-v1.png"
)
CART_SOURCE = CLEAN_SOURCE / "cart-flat.png"
CART_STEEP_SOURCE = CLEAN_SOURCE / "cart-steep.png"
CART_HIGH_MID_SOURCE = CLEAN_SOURCE / "cart-high-mid.png"
CART_MID_SOURCE = CLEAN_SOURCE / "cart-mid.png"
CART_LOW_MID_SOURCE = CLEAN_SOURCE / "cart-low-mid.png"
OUTPUT = APP / "static" / "assets" / "spines" / "megaWildFullReel"
NAME = "mega_wild_full_reel"
WIDTH = 256
HEIGHT = 824
PAGE_WIDTH = 1024
FRAME_COUNT = 64
PLAQUE_POSE_COUNT = 128
FRAME_DURATION = 1 / 60
SLIDE_END_FRAME = 24
# The cart centre crosses the fixed plaque between frames 12 and 13. Wind starts the roll there.
# Fake-start uses five half-turns; real-start uses four. Both candidate values become readable more
# than once, both variants land on the real value, and the longer window slows the roll by ~1/3.
ROLL_START_FRAME = 12
ROLL_END_FRAME = 42
ROLL_FLIPS_FAKE_START = 5
ROLL_FLIPS_REAL_START = 4
PLAQUE_EDGE_SCALE = 0.24
# The plate's own authored size. It is SHORTER than the gold plaque this replaced (171), which is
# what keeps the neon card from being stretched into a footprint drawn for a different piece of art.
PLAQUE_FRONT_SIZE = (244, 148)
CART_LAYER_SIZE = (220, 329)
CART_START_SCALE = 0.5
CART_VIEWS = ("steep", "high_mid", "mid", "low_mid", "flat")
CART_VIEW_TRANSITIONS = ((8, 12), (12, 16), (16, 20), (20, 24))
CART_Y = -183
PLAQUE_Y = 0
# End on the flat bottom track. The aligned transparent cart canvases share one baseline; this
# position places that baseline at the reel edge without changing size between authored views.
RIDE_END_Y = -112


def trim(image: Image.Image, pad: int = 0) -> Image.Image:
    rgba = image.convert("RGBA")
    bbox = rgba.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("source contains no visible pixels")
    bbox = (
        max(0, bbox[0] - pad),
        max(0, bbox[1] - pad),
        min(rgba.width, bbox[2] + pad),
        min(rgba.height, bbox[3] + pad),
    )
    return rgba.crop(bbox)


def contain(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    return ImageOps.contain(image, size, Image.Resampling.LANCZOS)


def background_layer() -> Image.Image:
    """Clean opaque reel-sized track. Prevents board/renderer bars during the duck pass."""
    return Image.open(FULL_REEL_SOURCE).convert("RGBA").resize(
        (WIDTH, HEIGHT), Image.Resampling.LANCZOS
    )


def cart_layer() -> Image.Image:
    return cart_perspective_layer(CART_SOURCE)


def cart_perspective_layer(source: Path) -> Image.Image:
    """Scale the shared canvases together so view changes cannot resize or shake the cart."""
    return contain(Image.open(source).convert("RGBA"), CART_LAYER_SIZE)


def plaque_layer() -> Image.Image:
    # Keep the proven in-game footprint while replacing the old low-res screenshot extraction.
    return trim(Image.open(PLAQUE_SOURCE)).resize(PLAQUE_FRONT_SIZE, Image.Resampling.LANCZOS)


def plaque_projected_scale(angle: float) -> float:
    return PLAQUE_EDGE_SCALE + (1 - PLAQUE_EDGE_SCALE) * abs(math.cos(math.radians(angle)))


def plaque_side_layer(angle: float) -> Image.Image:
    # Every view is the front drawing squashed to its projected height, edge-on included. The gold
    # plaque this replaced had authored depth art for the 90-degree poses; a flat neon card has no
    # depth to draw, and borrowing the gold edges would flash a different plaque mid-roll.
    image = trim(Image.open(PLAQUE_SOURCE))
    height = max(2, round(PLAQUE_FRONT_SIZE[1] * plaque_projected_scale(angle)))
    return image.resize((PLAQUE_FRONT_SIZE[0], height), Image.Resampling.LANCZOS)


def sparkle_layer() -> Image.Image:
    # Retain the slot for backwards-compatible Spine layout, but remove the six side glows.
    return Image.new("RGBA", (WIDTH, HEIGHT))


def pack_atlas(layers: dict[str, Image.Image]) -> tuple[Image.Image, dict[str, tuple[int, int]]]:
    placements: dict[str, tuple[int, int]] = {}
    x = y = row_height = 0
    for name, image in layers.items():
        if x and x + image.width > PAGE_WIDTH:
            x = 0
            y += row_height
            row_height = 0
        placements[name] = (x, y)
        x += image.width
        row_height = max(row_height, image.height)
    page = Image.new("RGBA", (PAGE_WIDTH, y + row_height))
    for name, image in layers.items():
        page.alpha_composite(image, placements[name])
    return page, placements


def smoothstep(value: float) -> float:
    return value * value * (3 - 2 * value)


def frame_time(frame: float) -> float:
    return round(frame * FRAME_DURATION, 6)


def plaque_sample_frame(sample: int) -> float:
    """Map dense plaque pose samples onto the unchanged 64-frame intro timeline."""
    return sample * (FRAME_COUNT - 1) / (PLAQUE_POSE_COUNT - 1)


def slide_keys() -> list[dict[str, float]]:
    keys: list[dict[str, float]] = []
    # Spine Y-up: duck starts above the top edge, blasts past the fixed centre plaque, and exits
    # below the reel. Its speed/wind—not a collision—starts the plaque roll.
    start_y = HEIGHT * 0.72
    for frame in range(FRAME_COUNT):
        progress = min(1.0, frame / SLIDE_END_FRAME)
        eased = smoothstep(progress)
        world_y = start_y + (RIDE_END_Y - start_y) * eased
        keys.append({"time": frame_time(frame), "y": round(world_y - RIDE_END_Y, 5)})
    keys[-1]["y"] = 0
    return keys


def cart_scale_keys() -> list[dict[str, float]]:
    """Grow with track perspective while descending from the narrow crest to the flat foreground."""
    keys: list[dict[str, float]] = []
    for frame in range(FRAME_COUNT):
        progress = min(1.0, frame / SLIDE_END_FRAME)
        scale = CART_START_SCALE + (1 - CART_START_SCALE) * smoothstep(progress)
        keys.append({"time": frame_time(frame), "x": round(scale, 5), "y": round(scale, 5)})
    return keys


def plaque_pose(frame: float, roll_flips: int) -> tuple[float, float, float, float, float]:
    """Return x scale, y scale, centred rotation, tilt and signed top/bottom facing."""
    if not ROLL_START_FRAME <= frame <= ROLL_END_FRAME:
        return 1.0, 1.0, 0.0, 0.0, 0.0
    phase = (frame - ROLL_START_FRAME) / (ROLL_END_FRAME - ROLL_START_FRAME)
    eased = smoothstep(phase)
    angle = eased * math.pi * roll_flips
    facing = math.sin(angle)
    projection = abs(math.cos(angle))
    edge = 1 - projection
    scale_x = 1 + 0.055 * edge
    scale_y = PLAQUE_EDGE_SCALE + (1 - PLAQUE_EDGE_SCALE) * projection
    # No sideways bank: the plaque must flip on its exact horizontal centre axis.
    rotation = 0.0
    tilt = math.degrees(math.asin(min(1.0, abs(facing))))
    return scale_x, scale_y, rotation, tilt, facing


PLAQUE_VIEW_ANGLES = (0.0, 35.0, 60.0, 90.0)
PLAQUE_VIEWS = (
    "front",
    "top_35",
    "top_60",
    "top_side",
    "bottom_35",
    "bottom_60",
    "bottom_side",
)


def plaque_view_name(direction: str, angle: float) -> str:
    if angle == 0:
        return "front"
    if angle == 90:
        return f"{direction}_side"
    return f"{direction}_{round(angle)}"


def plaque_view_weights(frame: float, roll_flips: int) -> dict[str, float]:
    """Crossfade between authored perspective art instead of jumping among three states."""
    weights = dict.fromkeys(PLAQUE_VIEWS, 0.0)
    _, _, _, tilt, facing = plaque_pose(frame, roll_flips)
    if tilt <= 0:
        weights["front"] = 1.0
        return weights

    direction = "top" if facing >= 0 else "bottom"
    for low, high in zip(PLAQUE_VIEW_ANGLES, PLAQUE_VIEW_ANGLES[1:]):
        if tilt <= high:
            blend = smoothstep(max(0.0, min(1.0, (tilt - low) / (high - low))))
            weights[plaque_view_name(direction, low)] = 1 - blend
            weights[plaque_view_name(direction, high)] = blend
            return weights

    weights[f"{direction}_side"] = 1.0
    return weights


def plaque_text_alpha(frame: float, roll_flips: int) -> float:
    """Keep text on broad faces; hide it smoothly before the plaque reaches its edge."""
    _, _, _, tilt, _ = plaque_pose(frame, roll_flips)
    if tilt <= 35:
        return 1.0
    if tilt >= 78:
        return 0.0
    return 1 - smoothstep((tilt - 35) / (78 - 35))


def plaque_face_is_real(frame: float, initial_real: bool, roll_flips: int) -> bool:
    """Alternate fake/real on every half-turn, swapping only while the plaque is edge-on."""
    if frame < ROLL_START_FRAME:
        return initial_real
    if frame >= ROLL_END_FRAME:
        return True
    phase = (frame - ROLL_START_FRAME) / (ROLL_END_FRAME - ROLL_START_FRAME)
    half_turn = smoothstep(phase) * roll_flips
    face_index = min(roll_flips, max(0, math.floor(half_turn + 0.5)))
    return initial_real != (face_index % 2 == 1)


def plaque_spin_keys(roll_flips: int) -> dict[str, list[dict[str, float]]]:
    """One eased wind-driven roll. The plaque never collapses into a zero-height blink."""
    scale: list[dict[str, float]] = []
    rotate: list[dict[str, float]] = []
    for sample in range(PLAQUE_POSE_COUNT):
        frame = plaque_sample_frame(sample)
        scale_x, scale_y, rotation, _, _ = plaque_pose(frame, roll_flips)
        scale.append(
            {
                "time": frame_time(frame),
                "x": round(scale_x, 5),
                "y": round(scale_y, 5),
            }
        )
        rotate.append({"time": frame_time(frame), "value": round(rotation, 5)})
    return {"scale": scale, "rotate": rotate}


def plaque_edge_spin_keys(roll_flips: int) -> dict[str, list[dict[str, float]]]:
    """Side art is already foreshortened, so it widens but never gets squashed twice."""
    scale: list[dict[str, float]] = []
    rotate: list[dict[str, float]] = []
    for sample in range(PLAQUE_POSE_COUNT):
        frame = plaque_sample_frame(sample)
        scale_x, _, rotation, _, _ = plaque_pose(frame, roll_flips)
        scale.append({"time": frame_time(frame), "x": round(scale_x, 5), "y": 1.0})
        rotate.append({"time": frame_time(frame), "value": round(rotation, 5)})
    return {"scale": scale, "rotate": rotate}


def plaque_view_correction_keys(view_angle: float, roll_flips: int) -> list[dict[str, float]]:
    """Keep both drawings in each crossfade on the same projected outer bounds."""
    authored_scale = plaque_projected_scale(view_angle)
    keys: list[dict[str, float]] = []
    for sample in range(PLAQUE_POSE_COUNT):
        frame = plaque_sample_frame(sample)
        _, current_scale, _, _, _ = plaque_pose(frame, roll_flips)
        keys.append(
            {
                "time": frame_time(frame),
                "x": 1.0,
                "y": round(current_scale / authored_scale, 5),
            }
        )
    return keys


def rgba(alpha: float) -> str:
    return f"ffffff{round(max(0.0, min(1.0, alpha)) * 255):02x}"


def cart_view_colors(view: str) -> list[dict[str, str | float]]:
    """Crossfade five pitch views over dense keys without extending the faster descent."""
    keys: list[dict[str, str | float]] = []
    for frame in range(FRAME_COUNT):
        weights = dict.fromkeys(CART_VIEWS, 0.0)
        if frame <= CART_VIEW_TRANSITIONS[0][0]:
            weights["steep"] = 1.0
        elif frame >= CART_VIEW_TRANSITIONS[-1][1]:
            weights["flat"] = 1.0
        else:
            for index, (start, end) in enumerate(CART_VIEW_TRANSITIONS):
                if start <= frame <= end:
                    blend = smoothstep((frame - start) / (end - start))
                    weights[CART_VIEWS[index]] = 1 - blend
                    weights[CART_VIEWS[index + 1]] = blend
                    break
        keys.append({"time": frame_time(frame), "color": rgba(weights[view])})
    return keys


def plaque_slot_colors(view: str, roll_flips: int) -> list[dict[str, str | float]]:
    keys: list[dict[str, str | float]] = []
    for sample in range(PLAQUE_POSE_COUNT):
        frame = plaque_sample_frame(sample)
        keys.append(
            {"time": frame_time(frame), "color": rgba(plaque_view_weights(frame, roll_flips)[view])}
        )
    return keys


def multiplier_colors(
    real: bool, initial_real: bool, roll_flips: int
) -> list[dict[str, str | float]]:
    # Text follows the broad face only. Alternate fake/real at every hidden edge-on pose, then hold
    # the real value after the fifth half-turn.
    keys: list[dict[str, str | float]] = []
    for sample in range(PLAQUE_POSE_COUNT):
        frame = plaque_sample_frame(sample)
        face_is_real = plaque_face_is_real(frame, initial_real, roll_flips)
        selected = face_is_real if real else not face_is_real
        keys.append(
            {
                "time": frame_time(frame),
                "color": rgba(plaque_text_alpha(frame, roll_flips) if selected else 0.0),
            }
        )
    return keys


def intro_animation(initial_real: bool) -> dict:
    """Build either seeded starting face while preserving one real-value landing pose."""
    roll_flips = ROLL_FLIPS_REAL_START if initial_real else ROLL_FLIPS_FAKE_START
    return {
        "bones": {
            "ride": {"translate": slide_keys()},
            "cart": {"scale": cart_scale_keys()},
            "plaque": plaque_spin_keys(roll_flips),
            "plaque_edge": plaque_edge_spin_keys(roll_flips),
            "plaque_top_35": {"scale": plaque_view_correction_keys(35, roll_flips)},
            "plaque_top_60": {"scale": plaque_view_correction_keys(60, roll_flips)},
            "plaque_top_side": {"scale": plaque_view_correction_keys(90, roll_flips)},
            "plaque_bottom_35": {"scale": plaque_view_correction_keys(35, roll_flips)},
            "plaque_bottom_60": {"scale": plaque_view_correction_keys(60, roll_flips)},
            "plaque_bottom_side": {"scale": plaque_view_correction_keys(90, roll_flips)},
        },
        "slots": {
            "cart_steep": {"rgba": cart_view_colors("steep")},
            "cart_high_mid": {"rgba": cart_view_colors("high_mid")},
            "cart_mid": {"rgba": cart_view_colors("mid")},
            "cart_low_mid": {"rgba": cart_view_colors("low_mid")},
            "cart": {"rgba": cart_view_colors("flat")},
            "plaque": {"rgba": plaque_slot_colors("front", roll_flips)},
            "plaque_top_35": {"rgba": plaque_slot_colors("top_35", roll_flips)},
            "plaque_top_60": {"rgba": plaque_slot_colors("top_60", roll_flips)},
            "plaque_top_side": {"rgba": plaque_slot_colors("top_side", roll_flips)},
            "plaque_bottom_35": {"rgba": plaque_slot_colors("bottom_35", roll_flips)},
            "plaque_bottom_60": {"rgba": plaque_slot_colors("bottom_60", roll_flips)},
            "plaque_bottom_side": {"rgba": plaque_slot_colors("bottom_side", roll_flips)},
            "fake_multiplier": {
                "rgba": multiplier_colors(False, initial_real, roll_flips)
            },
            "multiplier": {"rgba": multiplier_colors(True, initial_real, roll_flips)},
            "sparkles": {
                "rgba": [
                    {
                        "time": frame_time(frame),
                        "color": f"ffffff{min(255, max(40, frame * 5)):02x}",
                    }
                    for frame in range(FRAME_COUNT)
                ]
            },
        },
    }


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    plaque_front = plaque_layer()
    layers = {
        "background": background_layer(),
        "cart_steep": cart_perspective_layer(CART_STEEP_SOURCE),
        "cart_high_mid": cart_perspective_layer(CART_HIGH_MID_SOURCE),
        "cart_mid": cart_perspective_layer(CART_MID_SOURCE),
        "cart_low_mid": cart_perspective_layer(CART_LOW_MID_SOURCE),
        "cart": cart_layer(),
        "plaque": plaque_front,
        "plaque_top_35": plaque_side_layer(35),
        "plaque_top_60": plaque_side_layer(60),
        "plaque_top_side": plaque_side_layer(90),
        "plaque_bottom_35": plaque_side_layer(35),
        "plaque_bottom_60": plaque_side_layer(60),
        "plaque_bottom_side": plaque_side_layer(90),
        "sparkles": sparkle_layer(),
        "fake_multiplier_slot": Image.new("RGBA", (1, 1)),
        "multiplier_slot": Image.new("RGBA", (1, 1)),
    }
    page, placements = pack_atlas(layers)
    page.save(OUTPUT / f"{NAME}.png", optimize=True)

    # Static fallback: rails + fixed centre plaque. The passing duck has exited below the reel.
    fallback = Image.new("RGBA", (WIDTH, HEIGHT))
    fallback.alpha_composite(layers["background"])
    plaque = layers["plaque"]
    fallback.alpha_composite(plaque, ((WIDTH - plaque.width) // 2, (HEIGHT - plaque.height) // 2))
    fallback.alpha_composite(layers["sparkles"])
    fallback.save(OUTPUT / f"{NAME}_fallback.png", optimize=True)

    atlas_lines = [
        f"{NAME}.png",
        f"size: {page.width},{page.height}",
        "format: RGBA8888",
        "filter: Linear,Linear",
        "repeat: none",
    ]
    for region, (x, y) in placements.items():
        image = layers[region]
        atlas_lines += [
            region,
            "  rotate: false",
            f"  xy: {x}, {y}",
            f"  size: {image.width}, {image.height}",
            f"  orig: {image.width}, {image.height}",
            "  offset: 0, 0",
            "  index: -1",
        ]
    (OUTPUT / f"{NAME}.atlas").write_text("\n".join(atlas_lines) + "\n")

    attachments = {
        "background": {"background": {"width": WIDTH, "height": HEIGHT}},
        "cart_steep": {
            "cart_steep": {
                "width": layers["cart_steep"].width,
                "height": layers["cart_steep"].height,
            }
        },
        "cart_high_mid": {
            "cart_high_mid": {
                "width": layers["cart_high_mid"].width,
                "height": layers["cart_high_mid"].height,
            }
        },
        "cart_mid": {
            "cart_mid": {
                "width": layers["cart_mid"].width,
                "height": layers["cart_mid"].height,
            }
        },
        "cart_low_mid": {
            "cart_low_mid": {
                "width": layers["cart_low_mid"].width,
                "height": layers["cart_low_mid"].height,
            }
        },
        "cart": {"cart": {"width": layers["cart"].width, "height": layers["cart"].height}},
        "plaque": {"plaque": {"width": layers["plaque"].width, "height": layers["plaque"].height}},
        "plaque_top_35": {
            "plaque_top_35": {
                "width": layers["plaque_top_35"].width,
                "height": layers["plaque_top_35"].height,
            }
        },
        "plaque_top_60": {
            "plaque_top_60": {
                "width": layers["plaque_top_60"].width,
                "height": layers["plaque_top_60"].height,
            }
        },
        "plaque_top_side": {
            "plaque_top_side": {
                "width": layers["plaque_top_side"].width,
                "height": layers["plaque_top_side"].height,
            }
        },
        "plaque_bottom_35": {
            "plaque_bottom_35": {
                "width": layers["plaque_bottom_35"].width,
                "height": layers["plaque_bottom_35"].height,
            }
        },
        "plaque_bottom_60": {
            "plaque_bottom_60": {
                "width": layers["plaque_bottom_60"].width,
                "height": layers["plaque_bottom_60"].height,
            }
        },
        "plaque_bottom_side": {
            "plaque_bottom_side": {
                "width": layers["plaque_bottom_side"].width,
                "height": layers["plaque_bottom_side"].height,
            }
        },
        "sparkles": {"sparkles": {"width": WIDTH, "height": HEIGHT}},
        "fake_multiplier": {"fake_multiplier_slot": {"width": 1, "height": 1}},
        "multiplier": {"multiplier_slot": {"width": 1, "height": 1}},
    }
    skeleton = {
        "skeleton": {
            "hash": "theme-park-mega-wild-v33-no-wobble-plaque-roll",
            "spine": "4.2.0",
            "x": -WIDTH / 2,
            "y": -HEIGHT / 2,
            "width": WIDTH,
            "height": HEIGHT,
            "images": "./",
        },
        "bones": [
            {"name": "root"},
            {"name": "background", "parent": "root"},
            {"name": "ride", "parent": "root", "y": RIDE_END_Y},
            {"name": "cart", "parent": "ride", "y": CART_Y},
            # Fixed in reel/world space. Never inherits the duck slide.
            {"name": "plaque", "parent": "root", "y": PLAQUE_Y},
            {"name": "plaque_edge", "parent": "root", "y": PLAQUE_Y},
            {"name": "plaque_top_35", "parent": "plaque_edge"},
            {"name": "plaque_top_60", "parent": "plaque_edge"},
            {"name": "plaque_top_side", "parent": "plaque_edge"},
            {"name": "plaque_bottom_35", "parent": "plaque_edge"},
            {"name": "plaque_bottom_60", "parent": "plaque_edge"},
            {"name": "plaque_bottom_side", "parent": "plaque_edge"},
            {"name": "fake_multiplier", "parent": "plaque"},
            {"name": "multiplier", "parent": "plaque"},
            {"name": "sparkles", "parent": "root"},
        ],
        "slots": [
            {"name": "background", "bone": "background", "attachment": "background"},
            {
                "name": "cart_steep",
                "bone": "cart",
                "attachment": "cart_steep",
                "color": "ffffff00",
            },
            {
				"name": "cart_high_mid",
                "bone": "cart",
				"attachment": "cart_high_mid",
                "color": "ffffff00",
            },
            {
				"name": "cart_mid",
                "bone": "cart",
				"attachment": "cart_mid",
                "color": "ffffff00",
            },
            {
                "name": "cart_low_mid",
                "bone": "cart",
                "attachment": "cart_low_mid",
                "color": "ffffff00",
            },
            {"name": "cart", "bone": "cart", "attachment": "cart"},
            {"name": "plaque", "bone": "plaque", "attachment": "plaque"},
            {
                "name": "plaque_top_35",
                "bone": "plaque_top_35",
                "attachment": "plaque_top_35",
                "color": "ffffff00",
            },
            {
                "name": "plaque_top_60",
                "bone": "plaque_top_60",
                "attachment": "plaque_top_60",
                "color": "ffffff00",
            },
            {
                "name": "plaque_top_side",
                "bone": "plaque_top_side",
                "attachment": "plaque_top_side",
                "color": "ffffff00",
            },
            {
                "name": "plaque_bottom_35",
                "bone": "plaque_bottom_35",
                "attachment": "plaque_bottom_35",
                "color": "ffffff00",
            },
            {
                "name": "plaque_bottom_60",
                "bone": "plaque_bottom_60",
                "attachment": "plaque_bottom_60",
                "color": "ffffff00",
            },
            {
                "name": "plaque_bottom_side",
                "bone": "plaque_bottom_side",
                "attachment": "plaque_bottom_side",
                "color": "ffffff00",
            },
            {"name": "fake_multiplier", "bone": "fake_multiplier", "attachment": "fake_multiplier_slot", "color": "ffffffff"},
            {"name": "multiplier", "bone": "multiplier", "attachment": "multiplier_slot", "color": "ffffff00"},
            {"name": "sparkles", "bone": "sparkles", "attachment": "sparkles", "color": "ffffff38"},
        ],
        "skins": [{"name": "default", "attachments": attachments}],
        "animations": {
            "intro": intro_animation(False),
            "intro_real": intro_animation(True),
            "idle": {
                "bones": {},
                "slots": {
                    "cart_steep": {"rgba": [{"color": "ffffff00"}]},
                    "cart_high_mid": {"rgba": [{"color": "ffffff00"}]},
                    "cart_mid": {"rgba": [{"color": "ffffff00"}]},
                    "cart_low_mid": {"rgba": [{"color": "ffffff00"}]},
                    "cart": {"rgba": [{"color": "ffffffff"}]},
                    "plaque": {"rgba": [{"color": "ffffffff"}]},
                    "plaque_top_35": {"rgba": [{"color": "ffffff00"}]},
                    "plaque_top_60": {"rgba": [{"color": "ffffff00"}]},
                    "plaque_top_side": {"rgba": [{"color": "ffffff00"}]},
                    "plaque_bottom_35": {"rgba": [{"color": "ffffff00"}]},
                    "plaque_bottom_60": {"rgba": [{"color": "ffffff00"}]},
                    "plaque_bottom_side": {"rgba": [{"color": "ffffff00"}]},
                    "fake_multiplier": {"rgba": [{"color": "ffffff00"}]},
                    "multiplier": {"rgba": [{"color": "ffffffff"}]},
                },
            },
        },
    }
    (OUTPUT / f"{NAME}.json").write_text(json.dumps(skeleton, separators=(",", ":")) + "\n")
    print(
        f"Built {OUTPUT}: five-view fast cart + full rails + seven-view plaque + multi-swap wind-spin, "
        f"{FRAME_COUNT} intro frames / {PLAQUE_POSE_COUNT} plaque poses"
    )


if __name__ == "__main__":
    main()
