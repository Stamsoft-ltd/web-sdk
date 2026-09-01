#!/usr/bin/env python3
"""Build the frontal-to-vertical Roller Wilds 48-frame Spine animation.

Three approved poses drive one deterministic render pipeline:
* hands-on-wheel frontal start;
* frontal raised-arms pose for the release;
* steep top-down/vertical end pose for the drop.

The duck arms are isolated and moved continuously before a landmark warp pitches
the complete car into its vertical end perspective. Every output frame shares one
fixed 256x334 canvas and registered center; there is no random frame generation.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.web_image import save_web  # noqa: E402


APP = Path(__file__).resolve().parents[1]
STATIC = APP / "static" / "assets"
OUTPUT_DIR = STATIC / "sprites" / "rollerCar"
SOURCE_DIR = APP / "source-assets-unused" / "assets" / "theme-park" / "roller-car-front"
REFERENCE = SOURCE_DIR / "mega-wild-cart-front-reference.png"
RAISED_REFERENCE = SOURCE_DIR / "mega-wild-cart-arms-up.png"
VERTICAL_REFERENCE = SOURCE_DIR / "mega-wild-cart-vertical.png"

ATLAS_IMAGE = "roller_car_ride.webp"
FRAME_PREFIX = "roller_car_ride"
FRAME_W = 256
FRAME_H = 334
FRAME_COUNT = 48
ATLAS_COLS = 8
ATLAS_ROWS = 6
ART_PADDING_X = 10
ART_PADDING_Y = 12
RIDE_DURATION = 0.48

LEFT_UP_POLYGON = [
	(22, 64),
	(70, 64),
	(79, 84),
	(92, 101),
	(108, 116),
	(119, 126),
	(117, 141),
	(103, 140),
	(91, 126),
	(76, 109),
	(62, 105),
	(25, 108),
]
RIGHT_UP_POLYGON = [(FRAME_W - x, y) for x, y in LEFT_UP_POLYGON]
LEFT_DOWN_POLYGON = [
	(73, 119),
	(119, 119),
	(123, 141),
	(119, 166),
	(106, 172),
	(86, 168),
	(75, 157),
]
RIGHT_DOWN_POLYGON = [(FRAME_W - x, y) for x, y in LEFT_DOWN_POLYGON]

# Corresponding features in the raised-frontal and steep vertical key poses. The
# inverse-distance warp moves the complete registered car through these landmarks.
FRONT_LANDMARKS = np.array(
	[
		(0, 0), (128, 0), (255, 0), (0, 167), (255, 167), (0, 333), (128, 333), (255, 333),
		(10, 22), (246, 22), (10, 311), (246, 311),
		(78, 78), (178, 78), (43, 126), (213, 126), (40, 171), (216, 171),
		(128, 24), (76, 64), (180, 64), (108, 75), (148, 75), (128, 97), (128, 121),
		(88, 115), (168, 115), (51, 86), (205, 86), (106, 127), (150, 127),
		(93, 137), (163, 137), (128, 159),
		(42, 172), (214, 172), (128, 171), (29, 198), (227, 198),
		(37, 227), (219, 227), (128, 259), (13, 277), (243, 277), (128, 306),
		(33, 296), (223, 296),
	],
	dtype=np.float32,
)
VERTICAL_LANDMARKS = np.array(
	[
		(0, 0), (128, 0), (255, 0), (0, 167), (255, 167), (0, 333), (128, 333), (255, 333),
		(25, 12), (231, 12), (25, 322), (231, 322),
		(59, 14), (197, 14), (51, 80), (205, 80), (42, 176), (214, 176),
		(128, 22), (80, 70), (176, 70), (108, 91), (148, 91), (128, 111), (128, 136),
		(87, 130), (169, 130), (42, 72), (214, 72), (98, 144), (158, 144),
		(88, 151), (168, 151), (128, 181),
		(43, 180), (213, 180), (128, 180), (35, 213), (221, 213),
		(51, 251), (205, 251), (128, 285), (31, 292), (225, 292), (128, 319),
		(41, 305), (215, 305),
	],
	dtype=np.float32,
)

GRID_Y, GRID_X = np.mgrid[0:FRAME_H, 0:FRAME_W].astype(np.float32)


def write_json(path: Path, data: dict) -> None:
	path.write_text(json.dumps(data, separators=(",", ":")) + "\n", encoding="utf-8")


def normalized_image(path: Path) -> Image.Image:
	image = Image.open(path).convert("RGBA")
	alpha_box = image.getchannel("A").getbbox()
	if not alpha_box:
		raise ValueError(f"Roller reference is fully transparent: {path}")
	image = image.crop(alpha_box)
	available_w = FRAME_W - ART_PADDING_X * 2
	available_h = FRAME_H - ART_PADDING_Y * 2
	scale = min(available_w / image.width, available_h / image.height)
	size = (round(image.width * scale), round(image.height * scale))
	image = image.resize(size, Image.Resampling.LANCZOS)
	frame = Image.new("RGBA", (FRAME_W, FRAME_H))
	frame.alpha_composite(image, ((FRAME_W - size[0]) // 2, (FRAME_H - size[1]) // 2))
	return frame


def polygon_mask(points: list[tuple[int, int]]) -> np.ndarray:
	mask = Image.new("L", (FRAME_W, FRAME_H))
	ImageDraw.Draw(mask).polygon(points, fill=255)
	return np.asarray(mask) > 0


def dilate(mask: np.ndarray, radius: int) -> np.ndarray:
	for _ in range(radius):
		padded = np.pad(mask, 1)
		mask = np.logical_or.reduce(
			[
				padded[dy : dy + FRAME_H, dx : dx + FRAME_W]
				for dy in range(3)
				for dx in range(3)
			]
		)
	return mask


def warm_art_mask(image: Image.Image) -> np.ndarray:
	pixels = np.asarray(image).astype(np.int16)
	r, g, b, alpha = [pixels[:, :, channel] for channel in range(4)]
	return (alpha > 20) & (r > 65) & (r > b + 35) & (g > b * 1.15) & (r > g * 0.92)


def isolated_layer(image: Image.Image, polygon: list[tuple[int, int]]) -> Image.Image:
	core = warm_art_mask(image) & polygon_mask(polygon)
	mask = dilate(core, 2) & polygon_mask(polygon) & (np.asarray(image)[:, :, 3] > 0)
	pixels = np.asarray(image).copy()
	pixels[:, :, 3] = (pixels[:, :, 3].astype(np.float32) * mask).astype(np.uint8)
	return Image.fromarray(pixels)


def build_front_layers(original: Image.Image, raised: Image.Image) -> tuple[Image.Image, Image.Image, Image.Image]:
	down_core = warm_art_mask(original) & (
		polygon_mask(LEFT_DOWN_POLYGON) | polygon_mask(RIGHT_DOWN_POLYGON)
	)
	down_mask = dilate(down_core, 2) & (
		polygon_mask(LEFT_DOWN_POLYGON) | polygon_mask(RIGHT_DOWN_POLYGON)
	)
	soft_mask = Image.fromarray(np.uint8(down_mask) * 255).filter(ImageFilter.GaussianBlur(1.2))
	base = Image.composite(raised, original, soft_mask)
	left_arm = isolated_layer(raised, LEFT_UP_POLYGON)
	right_arm = isolated_layer(raised, RIGHT_UP_POLYGON)
	base.save(SOURCE_DIR / "mega-wild-cart-rig-base.png", optimize=True)
	left_arm.save(SOURCE_DIR / "mega-wild-cart-rig-left-arm.png", optimize=True)
	right_arm.save(SOURCE_DIR / "mega-wild-cart-rig-right-arm.png", optimize=True)
	return base, left_arm, right_arm


def smoothstep(value: float) -> float:
	value = max(0.0, min(1.0, value))
	return value * value * (3 - 2 * value)


def transformed_layer(
	image: Image.Image,
	pivot: tuple[float, float],
	setup_rotation: float,
	delta_rotation: float,
	scale_x: float,
	scale_y: float,
) -> Image.Image:
	def translate(x: float, y: float) -> np.ndarray:
		return np.array([[1.0, 0, x], [0, 1.0, y], [0, 0, 1.0]])

	def rotate(angle: float) -> np.ndarray:
		return np.array(
			[
				[math.cos(angle), -math.sin(angle), 0],
				[math.sin(angle), math.cos(angle), 0],
				[0, 0, 1.0],
			]
		)

	setup = math.radians(setup_rotation)
	delta = math.radians(delta_rotation)
	scale = np.diag([scale_x, scale_y, 1.0])
	matrix = (
		translate(*pivot)
		@ rotate(delta)
		@ rotate(setup)
		@ scale
		@ rotate(-setup)
		@ translate(-pivot[0], -pivot[1])
	)
	inverse = np.linalg.inv(matrix)
	return image.transform(
		(FRAME_W, FRAME_H),
		Image.Transform.AFFINE,
		(
			inverse[0, 0], inverse[0, 1], inverse[0, 2],
			inverse[1, 0], inverse[1, 1], inverse[1, 2],
		),
		resample=Image.Resampling.BICUBIC,
	)


def sample_bilinear(image: np.ndarray, map_x: np.ndarray, map_y: np.ndarray) -> np.ndarray:
	map_x = np.clip(map_x, 0, FRAME_W - 1.001)
	map_y = np.clip(map_y, 0, FRAME_H - 1.001)
	x0 = np.floor(map_x).astype(np.int32)
	y0 = np.floor(map_y).astype(np.int32)
	x1 = np.minimum(x0 + 1, FRAME_W - 1)
	y1 = np.minimum(y0 + 1, FRAME_H - 1)
	dx = (map_x - x0)[:, :, None]
	dy = (map_y - y0)[:, :, None]
	return (
		image[y0, x0] * (1 - dx) * (1 - dy)
		+ image[y0, x1] * dx * (1 - dy)
		+ image[y1, x0] * (1 - dx) * dy
		+ image[y1, x1] * dx * dy
	)


def warp_vertical(vertical: np.ndarray, destination: np.ndarray) -> Image.Image:
	dx = GRID_X[:, :, None] - destination[:, 0]
	dy = GRID_Y[:, :, None] - destination[:, 1]
	weights = 1 / (dx * dx + dy * dy + 1.0)
	delta = VERTICAL_LANDMARKS - destination
	denominator = weights.sum(axis=2)
	map_x = GRID_X + (weights * delta[:, 0]).sum(axis=2) / denominator
	map_y = GRID_Y + (weights * delta[:, 1]).sum(axis=2) / denominator
	warped = sample_bilinear(vertical, map_x, map_y)
	return Image.fromarray(np.uint8(np.clip(warped, 0, 1) * 255))


def blend_rgba(first: Image.Image, second: Image.Image, amount: float) -> Image.Image:
	a = np.asarray(first).astype(np.float32) / 255
	b = np.asarray(second).astype(np.float32) / 255
	a[:, :, :3] *= a[:, :, 3:4]
	b[:, :, :3] *= b[:, :, 3:4]
	mixed = a * (1 - amount) + b * amount
	alpha = mixed[:, :, 3:4]
	mixed[:, :, :3] = np.where(alpha > 0.00001, mixed[:, :, :3] / np.maximum(alpha, 0.00001), 0)
	return Image.fromarray(np.uint8(np.clip(mixed, 0, 1) * 255))


def build_poses() -> list[Image.Image]:
	original = normalized_image(REFERENCE)
	raised = normalized_image(RAISED_REFERENCE)
	vertical_image = normalized_image(VERTICAL_REFERENCE)
	vertical = np.asarray(vertical_image).astype(np.float32) / 255
	base, left_arm, right_arm = build_front_layers(original, raised)
	poses: list[Image.Image] = []

	for index in range(FRAME_COUNT):
		normalized = index / (FRAME_COUNT - 1)
		# Hold the approved hands-on-wheel pose for eight frames, then release smoothly.
		lift = smoothstep((normalized - 0.16) / 0.26)
		flap_phase = max(0.0, (normalized - 0.42) / 0.58)
		flap = math.sin(flap_phase * math.tau * 2) * 9 * flap_phase
		left = transformed_layer(
			left_arm,
			(111, 128),
			-145,
			-95 * (1 - lift) - flap,
			0.45 + 0.55 * lift,
			0.82 + 0.18 * lift,
		)
		right = transformed_layer(
			right_arm,
			(145, 128),
			-35,
			95 * (1 - lift) + flap,
			0.45 + 0.55 * lift,
			0.82 + 0.18 * lift,
		)
		front = base.copy()
		front.alpha_composite(left)
		front.alpha_composite(right)
		# First frames retain the exact approved hands-on-wheel art before release.
		front = blend_rgba(original, front, smoothstep((normalized - 0.16) / 0.08))

		pitch = smoothstep((normalized - 0.32) / 0.24)
		destination = FRONT_LANDMARKS * (1 - pitch) + VERTICAL_LANDMARKS * pitch
		# Reserve the final half of the clip for two readable arm-flap cycles in vertical pose.
		vertical_phase = max(0.0, (normalized - 0.50) / 0.50)
		vertical_flap = math.sin(vertical_phase * math.tau * 2) * 7
		destination[27, 1] += vertical_flap
		destination[28, 1] += vertical_flap
		destination[27, 0] -= vertical_flap * 0.25
		destination[28, 0] += vertical_flap * 0.25
		vertical_pose = warp_vertical(vertical, destination)
		# Short registered handoff: only two fast in-between frames can double, never the full drop.
		vertical_mix = smoothstep((normalized - 0.36) / 0.10)
		pose = blend_rgba(front, vertical_pose, vertical_mix)
		poses.append(pose)

	poses[0] = original
	return poses


def build_atlas(poses: list[Image.Image]) -> None:
	atlas_width = FRAME_W * ATLAS_COLS
	atlas_height = FRAME_H * ATLAS_ROWS
	atlas = Image.new("RGBA", (atlas_width, atlas_height))
	lines = [
		ATLAS_IMAGE,
		f"size: {atlas_width},{atlas_height}",
		"format: RGBA8888",
		"filter: Linear,Linear",
		"repeat: none",
	]
	for index, pose in enumerate(poses):
		x = (index % ATLAS_COLS) * FRAME_W
		y = (index // ATLAS_COLS) * FRAME_H
		name = f"{FRAME_PREFIX}_{index:03d}"
		atlas.alpha_composite(pose, (x, y))
		lines.extend(
			[
				name,
				"  rotate: false",
				f"  xy: {x}, {y}",
				f"  size: {FRAME_W}, {FRAME_H}",
				f"  orig: {FRAME_W}, {FRAME_H}",
				"  offset: 0, 0",
				"  index: -1",
			]
		)
	atlas.save(OUTPUT_DIR / ATLAS_IMAGE, "WEBP", quality=90, method=6, alpha_quality=100)
	(OUTPUT_DIR / "roller_car.atlas").write_text("\n".join(lines) + "\n", encoding="utf-8")

	preview_indexes = [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 47]
	preview = Image.new("RGBA", (FRAME_W * len(preview_indexes), FRAME_H))
	for column, index in enumerate(preview_indexes):
		preview.alpha_composite(poses[index], (column * FRAME_W, 0))
	preview.save(SOURCE_DIR / "mega-wild-cart-48frame-preview.png", optimize=True)


def build_skeleton() -> None:
	names = [f"{FRAME_PREFIX}_{index:03d}" for index in range(FRAME_COUNT)]
	frames = [
		{"time": round(index * RIDE_DURATION / (FRAME_COUNT - 1), 5), "name": name}
		for index, name in enumerate(names)
	]
	skeleton = {
		"skeleton": {
			"hash": "theme-park-roller-car-v6-frontal-to-vertical-arms-48frame-fast",
			"spine": "4.2.0",
			"x": -FRAME_W / 2,
			"y": -FRAME_H / 2,
			"width": FRAME_W,
			"height": FRAME_H,
			"images": "./",
		},
		"bones": [{"name": "root"}, {"name": "art", "parent": "root"}],
		"slots": [{"name": "art", "bone": "art", "attachment": names[0]}],
		"skins": [
			{
				"name": "default",
				"attachments": {
					"art": {name: {"width": FRAME_W, "height": FRAME_H} for name in names}
				},
			}
		],
		"animations": {
			"idle": {"slots": {"art": {"attachment": [{"name": names[0]}]}}},
			"ride": {"slots": {"art": {"attachment": frames}}},
		},
	}
	write_json(OUTPUT_DIR / "roller_car_spine.json", skeleton)


def main() -> None:
	OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
	poses = build_poses()
	build_atlas(poses)
	build_skeleton()
	save_web(poses[0], STATIC / "theme-park" / "v2" / "modes" / "mega-wild-car.webp")
	print(
		f"Built Roller Wilds: frontal release -> vertical drop, {FRAME_COUNT} registered frames, "
		f"{RIDE_DURATION:.2f}s -> {OUTPUT_DIR}"
	)


if __name__ == "__main__":
	main()
