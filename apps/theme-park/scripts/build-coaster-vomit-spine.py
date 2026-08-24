#!/usr/bin/env python3
"""Build the hand-drawn Mega Coaster 128-frame vomiting Spine 4.2 animation.

The cart is one immutable back/front sandwich. Eight authored duck poses are registered
to one fixed cockpit baseline, expanded to a single smooth happy -> sick -> vomit -> happy
loop, then packed as trimmed duck-only atlas attachments.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image


APP = Path(__file__).resolve().parents[1]
SOURCE = APP / "source-assets-unused/assets/theme-park/coaster-vomit-handdrawn"
LEGACY_SOURCE = APP / "source-assets-unused/assets/theme-park/coaster-vomit"
FEATURES = APP / "static/assets/theme-park/v2/features"
OUTPUT = APP / "static/assets/spines/coasterVomit"

FRAME_SIZE = 256
SOURCE_KEY_COUNT = 8
TIMELINE_KEY_COUNT = 16
FRAME_COUNT = 128
ATLAS_MAX_WIDTH = 2048
ATLAS_TRIM_PADDING = 2
ATLAS_REGION_GAP = 2
CART_VISUAL_TARGET_WIDTH = 180
CART_LEFT = 18
GROUND_BASELINE = 238
DUCK_VISUAL_TARGET_HEIGHT = 105
DUCK_CELL_LEFT = 47
DUCK_BASELINE = 216
POSE_END = 4.46
VOMIT_DURATION = 4.5
ATLAS_IMAGE = "coaster_vomit.png"
FRAME_PREFIX = "coaster_vomit"
CART_BACK_ATTACHMENT = "coaster_cart_back"
CART_FRONT_ATTACHMENT = "coaster_cart_front"

EMPTY_CART_SOURCE = SOURCE / "empty-cart.png"
DUCK_KEY_PATTERN = "duck-key-{index:02d}.png"
# Holds preserve readable anticipation and one authored vomit burst without changing runtime timing.
TIMELINE_KEYS = (0, 0, 1, 1, 2, 3, 4, 5, 5, 5, 5, 4, 6, 6, 7, 0)


def write_json(path: Path, data: dict) -> None:
	path.write_text(json.dumps(data, separators=(",", ":")) + "\n", encoding="utf-8")


def clean_transparent(image: Image.Image) -> Image.Image:
	"""Drop matte dust while retaining the main character and nearby vomit droplets."""
	rgba = np.asarray(image.convert("RGBA")).copy()
	mask = rgba[:, :, 3] > 20
	height, width = mask.shape
	labels = np.zeros(mask.shape, dtype=np.int16)
	components: list[tuple[int, int, int, int, int, int]] = []
	label = 0
	for seed_y, seed_x in zip(*np.nonzero(mask), strict=True):
		if labels[seed_y, seed_x] != 0:
			continue
		label += 1
		queue = deque([(int(seed_x), int(seed_y))])
		labels[seed_y, seed_x] = label
		area = 0
		min_x = max_x = int(seed_x)
		min_y = max_y = int(seed_y)
		while queue:
			x, y = queue.popleft()
			area += 1
			min_x, max_x = min(min_x, x), max(max_x, x)
			min_y, max_y = min(min_y, y), max(max_y, y)
			for next_y in range(max(0, y - 1), min(height, y + 2)):
				for next_x in range(max(0, x - 1), min(width, x + 2)):
					if mask[next_y, next_x] and labels[next_y, next_x] == 0:
						labels[next_y, next_x] = label
						queue.append((next_x, next_y))
		components.append((label, area, min_x, min_y, max_x + 1, max_y + 1))
	if not components:
		raise ValueError("Empty hand-drawn Mega Coaster source")
	main = max(components, key=lambda component: component[1])
	_, _, main_x0, main_y0, main_x1, main_y1 = main
	keep = np.zeros(label + 1, dtype=bool)
	for component_label, area, x0, y0, x1, y1 in components:
		dx = max(main_x0 - x1, x0 - main_x1, 0)
		dy = max(main_y0 - y1, y0 - main_y1, 0)
		if component_label == main[0] or (area >= 12 and dx * dx + dy * dy <= 80 * 80):
			keep[component_label] = True
	rgba[~keep[labels]] = 0
	rgba[rgba[:, :, 3] <= 20] = 0
	return Image.fromarray(rgba, "RGBA")


def visible_bbox(image: Image.Image) -> tuple[int, int, int, int]:
	bbox = image.getchannel("A").point(lambda value: 255 if value > 20 else 0).getbbox()
	if bbox is None:
		raise ValueError("Empty hand-drawn Mega Coaster layer")
	return bbox


def load_duck_keys() -> list[Image.Image]:
	keys = [
		clean_transparent(Image.open(SOURCE / DUCK_KEY_PATTERN.format(index=index)))
		for index in range(SOURCE_KEY_COUNT)
	]
	if len({key.size for key in keys}) != 1:
		raise ValueError("Hand-drawn Mega Coaster duck keys must share one cell size")
	return keys


def normalize_cart(image: Image.Image) -> Image.Image:
	"""Place the authored cart once; no per-frame cart pixels exist after this point."""
	image = clean_transparent(image)
	left, _, right, bottom = visible_bbox(image)
	scale = CART_VISUAL_TARGET_WIDTH / (right - left)
	resized = image.resize(
		(round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS
	)
	frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE))
	frame.alpha_composite(
		resized,
		(
			round(CART_LEFT - left * scale),
			round(GROUND_BASELINE - bottom * scale),
		),
	)
	return frame


def normalize_duck_keys(keys: list[Image.Image]) -> list[Image.Image]:
	"""Use one scale and fixed X origin; align only the authored seat baseline across sheet rows."""
	bboxes = [visible_bbox(key) for key in keys]
	visual_height = max(bottom - top for _, top, _, bottom in bboxes)
	scale = DUCK_VISUAL_TARGET_HEIGHT / visual_height
	normalized: list[Image.Image] = []
	for key, bbox in zip(keys, bboxes, strict=True):
		resized = key.resize(
			(round(key.width * scale), round(key.height * scale)), Image.Resampling.LANCZOS
		)
		frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE))
		frame.alpha_composite(
			resized,
			(
				DUCK_CELL_LEFT,
				round(DUCK_BASELINE - bbox[3] * scale),
			),
		)
		normalized.append(frame)
	return normalized


def build_cart_front(fixed_cart: Image.Image) -> Image.Image:
	"""Repeat exact authored cart pixels above the duck: body lip plus complete steering wheel."""
	rgba = np.asarray(fixed_cart.convert("RGBA")).copy()
	left, top, right, bottom = visible_bbox(fixed_cart)
	width, height = right - left, bottom - top
	y, x = np.ogrid[:FRAME_SIZE, :FRAME_SIZE]
	body = y >= round(top + height * 0.43)
	steering = (
		(x >= round(left + width * 0.55))
		& (x <= round(left + width * 0.70))
		& (y >= round(top + height * 0.18))
		& (y <= round(top + height * 0.55))
	)
	rgba[~(body | steering)] = 0
	return Image.fromarray(rgba, "RGBA")


def motion_interpolate_poses(source_poses: list[Image.Image]) -> list[Image.Image]:
	"""Create opaque motion-compensated in-betweens; never alpha-crossfade the duck."""
	if len(source_poses) != TIMELINE_KEY_COUNT + 1:
		raise ValueError("Mega Coaster motion source count mismatch")
	with tempfile.TemporaryDirectory(prefix="theme-park-coaster-handdrawn-flow-") as temp:
		root = Path(temp)
		color_input = root / "color-input"
		alpha_input = root / "alpha-input"
		color_output = root / "color-output"
		alpha_output = root / "alpha-output"
		for directory in (color_input, alpha_input, color_output, alpha_output):
			directory.mkdir()

		for index, pose in enumerate([*source_poses, source_poses[-1]]):
			rgba = np.asarray(pose.convert("RGBA"))
			alpha = rgba[:, :, 3:4].astype(np.float32) / 255
			premultiplied = np.round(rgba[:, :, :3] * alpha).astype(np.uint8)
			alpha_rgb = np.repeat(rgba[:, :, 3:4], 3, axis=2)
			Image.fromarray(premultiplied, "RGB").save(color_input / f"{index:03d}.png")
			Image.fromarray(alpha_rgb, "RGB").save(alpha_input / f"{index:03d}.png")

		filter_graph = "minterpolate=fps=7.9375:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1"
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
					str(FRAME_COUNT),
					str(output_dir / "%03d.png"),
				],
				check=True,
			)

		poses: list[Image.Image] = []
		for index in range(1, FRAME_COUNT + 1):
			color = np.asarray(Image.open(color_output / f"{index:03d}.png").convert("RGB"))
			color = color.astype(np.float32)
			alpha = np.asarray(Image.open(alpha_output / f"{index:03d}.png").convert("RGB"))
			alpha = alpha[:, :, 0:1].astype(np.float32)
			rgb = np.divide(color * 255, alpha, out=np.zeros_like(color), where=alpha > 3)
			rgba = np.concatenate((np.clip(rgb, 0, 255), alpha), axis=2).astype(np.uint8)
			rgba[alpha[:, :, 0] <= 3] = 0
			poses.append(Image.fromarray(rgba, "RGBA"))
		return poses


def composite_rig_pose(
	pose: Image.Image,
	fixed_cart: Image.Image,
	cart_front: Image.Image,
) -> Image.Image:
	composite = fixed_cart.copy()
	composite.alpha_composite(pose)
	composite.alpha_composite(cart_front)
	return composite


def build_runtime_stills_and_rail(
	poses: list[Image.Image],
	fixed_cart: Image.Image,
	cart_front: Image.Image,
) -> None:
	for pose_index, output_name in (
		(0, "coaster-rig-happy.png"),
		(FRAME_COUNT // 2, "coaster-rig-vomit.png"),
	):
		composite_rig_pose(poses[pose_index], fixed_cart, cart_front).save(
			FEATURES / output_name, optimize=True
		)

	rail = Image.open(LEGACY_SOURCE / "rail-source.png").convert("RGBA")
	bbox = visible_bbox(rail)
	padding = 4
	bbox = (
		max(0, bbox[0] - padding),
		max(0, bbox[1] - padding),
		min(rail.width, bbox[2] + padding),
		min(rail.height, bbox[3] + padding),
	)
	rail.crop(bbox).save(FEATURES / "coaster-track.png", optimize=True)


def build_atlas(
	frames: list[Image.Image],
	fixed_cart: Image.Image,
	cart_front: Image.Image,
) -> None:
	OUTPUT.mkdir(parents=True, exist_ok=True)
	entries = [
		*((f"{FRAME_PREFIX}_{index:03d}", frame) for index, frame in enumerate(frames)),
		(CART_BACK_ATTACHMENT, fixed_cart),
		(CART_FRONT_ATTACHMENT, cart_front),
	]
	regions: list[dict[str, object]] = []
	for name, frame in entries:
		bbox = frame.getchannel("A").getbbox()
		if bbox is None:
			raise ValueError(f"Mega Coaster atlas region is empty: {name}")
		left = max(0, bbox[0] - ATLAS_TRIM_PADDING)
		top = max(0, bbox[1] - ATLAS_TRIM_PADDING)
		right = min(FRAME_SIZE, bbox[2] + ATLAS_TRIM_PADDING)
		bottom = min(FRAME_SIZE, bbox[3] + ATLAS_TRIM_PADDING)
		crop = frame.crop((left, top, right, bottom))
		regions.append(
			{
				"name": name,
				"source": frame,
				"crop": crop,
				"left": left,
				"top": top,
				"bottom": bottom,
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
	atlas_height = y + row_height
	atlas = Image.new("RGBA", (atlas_width, atlas_height))
	for region in regions:
		atlas.alpha_composite(region["crop"], (region["x"], region["y"]))

	for region in regions:
		restored = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE))
		restored.alpha_composite(region["crop"], (region["left"], region["top"]))
		if not np.array_equal(np.asarray(restored), np.asarray(region["source"])):
			raise ValueError(f"Mega Coaster trimmed atlas changed region: {region['name']}")
	# Keep transparent RGB zeroed. WebP rewrites hidden RGB and causes Pixi linear-filter fringes.
	atlas.save(OUTPUT / ATLAS_IMAGE, "PNG", optimize=True)

	lines = [
		ATLAS_IMAGE,
		f"size: {atlas_width},{atlas_height}",
		"format: RGBA8888",
		"filter: Linear,Linear",
		"repeat: none",
	]
	for region in regions:
		crop = region["crop"]
		offset_y = FRAME_SIZE - region["bottom"]
		lines.extend(
			[
				region["name"],
				"  rotate: false",
				f"  xy: {region['x']}, {region['y']}",
				f"  size: {crop.width}, {crop.height}",
				f"  orig: {FRAME_SIZE}, {FRAME_SIZE}",
				f"  offset: {region['left']}, {offset_y}",
				"  index: -1",
			]
		)
	(OUTPUT / "coaster_vomit.atlas").write_text("\n".join(lines) + "\n", encoding="utf-8")


def attachment(name: str, time: float | None = None) -> dict[str, object]:
	key: dict[str, object] = {"name": name}
	if time is not None:
		key["time"] = round(time, 5)
	return key


def build_skeleton() -> None:
	names = [f"{FRAME_PREFIX}_{index:03d}" for index in range(FRAME_COUNT)]
	pose_times = [index * POSE_END / (FRAME_COUNT - 1) for index in range(FRAME_COUNT)]
	frames = [attachment(name, time) for name, time in zip(names, pose_times, strict=True)]
	frames.append(attachment(names[-1], VOMIT_DURATION))
	skeleton = {
		"skeleton": {
			"hash": "theme-park-mega-coaster-vomit-v29-handdrawn-128frame",
			"spine": "4.2.0",
			"x": -FRAME_SIZE / 2,
			"y": -FRAME_SIZE / 2,
			"width": FRAME_SIZE,
			"height": FRAME_SIZE,
			"images": "./",
		},
		"bones": [{"name": "root"}, {"name": "art", "parent": "root"}],
		"slots": [
			{"name": "cart_back", "bone": "art", "attachment": CART_BACK_ATTACHMENT},
			{"name": "duck_pose", "bone": "art", "attachment": names[0]},
			{"name": "cart_front", "bone": "art", "attachment": CART_FRONT_ATTACHMENT},
		],
		"skins": [
			{
				"name": "default",
				"attachments": {
					"cart_back": {
						CART_BACK_ATTACHMENT: {"width": FRAME_SIZE, "height": FRAME_SIZE}
					},
					"duck_pose": {
						name: {"width": FRAME_SIZE, "height": FRAME_SIZE} for name in names
					},
					"cart_front": {
						CART_FRONT_ATTACHMENT: {"width": FRAME_SIZE, "height": FRAME_SIZE}
					},
				},
			}
		],
		"animations": {
			"idle": {
				"slots": {
					"duck_pose": {
						"attachment": [attachment(names[0]), attachment(names[0], VOMIT_DURATION)]
					}
				}
			},
			"vomit": {"slots": {"duck_pose": {"attachment": frames}}},
		},
	}
	write_json(OUTPUT / "coaster_vomit.json", skeleton)


def main() -> None:
	duck_keys = normalize_duck_keys(load_duck_keys())
	fixed_cart = normalize_cart(Image.open(EMPTY_CART_SOURCE))
	cart_front = build_cart_front(fixed_cart)
	timeline = [duck_keys[index] for index in TIMELINE_KEYS]
	# Exact happy endpoint makes the loop seamless while motion flow supplies 128 opaque poses.
	poses = motion_interpolate_poses([*timeline, duck_keys[0]])
	build_atlas(poses, fixed_cart, cart_front)
	build_skeleton()
	build_runtime_stills_and_rail(poses, fixed_cart, cart_front)
	print(
		f"Built hand-drawn Mega Coaster Spine rig: {FRAME_COUNT} duck-only poses, "
		f"{VOMIT_DURATION:.2f}s -> {OUTPUT}"
	)


if __name__ == "__main__":
	main()
