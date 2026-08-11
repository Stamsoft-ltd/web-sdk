#!/usr/bin/env python3
"""Build the regenerated Mega Coaster 128-frame vomiting Spine 4.2 animation.

One rigidly registered 4x4 source sheet drives the loop. Its cart/body/head registration
is fixed at generation time; only the arm, face and vomit change between source poses.
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
SOURCE = APP / "source-assets-unused/assets/theme-park/coaster-vomit"
FEATURES = APP / "static/assets/theme-park/v2/features"
OUTPUT = APP / "static/assets/spines/coasterVomit"

FRAME_SIZE = 256
SOURCE_FRAME_COUNT = 16
FRAME_COUNT = 128
ATLAS_MAX_WIDTH = 2048
ATLAS_TRIM_PADDING = 2
ATLAS_REGION_GAP = 2
CART_VISUAL_TARGET_WIDTH = 175
CART_LEFT = 20
GROUND_BASELINE = 235
VERTICAL_SCALE_CORRECTION = 1.0
POSE_END = 4.46
VOMIT_DURATION = 4.5
ATLAS_IMAGE = "coaster_vomit.png"
FRAME_PREFIX = "coaster_vomit"
CART_BACK_ATTACHMENT = "coaster_cart_back"
CART_FRONT_ATTACHMENT = "coaster_cart_front"

REGENERATED_SHEET = SOURCE / "regenerated-16.png"
EMPTY_CART_SOURCE = SOURCE / "regenerated-empty-cart.png"
SICK_TINT_AMOUNTS = (0.0, 0.1, 0.3, 0.55, 0.75, 0.9, 1.0, 1.0, 1.0, 1.0, 1.0, 0.8, 0.55, 0.25, 0.0, 0.0)


def write_json(path: Path, data: dict) -> None:
	path.write_text(json.dumps(data, separators=(",", ":")) + "\n", encoding="utf-8")


def remove_stray_components(image: Image.Image) -> Image.Image:
	"""Remove neighbouring-cell slivers and distant generation specks; retain nearby droplets."""
	rgba = np.asarray(image.convert("RGBA")).copy()
	mask = rgba[:, :, 3] > 0
	labels = np.zeros(mask.shape, dtype=np.int16)
	components: list[tuple[int, int, int, int, int, int]] = []
	height, width = mask.shape
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
		raise ValueError("Mega Coaster sheet cell is empty")
	main = max(components, key=lambda component: component[1])
	_, _, main_x0, main_y0, main_x1, main_y1 = main
	keep = np.zeros(label + 1, dtype=bool)
	keep[main[0]] = True
	for component_label, _, x0, y0, x1, y1 in components:
		if component_label == main[0]:
			continue
		touches_edge = x0 <= 1 or y0 <= 1 or x1 >= width - 1 or y1 >= height - 1
		dx = max(main_x0 - x1, x0 - main_x1, 0)
		dy = max(main_y0 - y1, y0 - main_y1, 0)
		if not touches_edge and dx * dx + dy * dy <= 48 * 48:
			keep[component_label] = True
	rgba[~keep[labels]] = 0
	return Image.fromarray(rgba, "RGBA")


def extract_regenerated_frames() -> list[Image.Image]:
	"""Extract the newly generated, rigidly registered 4x4 animation cells."""
	sheet = Image.open(REGENERATED_SHEET).convert("RGBA")
	frames: list[Image.Image] = []
	for index in range(SOURCE_FRAME_COUNT):
		row, col = divmod(index, 4)
		x0 = round(col * sheet.width / 4) + 2
		x1 = round((col + 1) * sheet.width / 4) - 2
		y0 = round(row * sheet.height / 4) + 2
		y1 = round((row + 1) * sheet.height / 4) - 2
		frames.append(remove_stray_components(sheet.crop((x0, y0, x1, y1))))
	if len(frames) != SOURCE_FRAME_COUNT:
		raise ValueError(f"Expected {SOURCE_FRAME_COUNT} regenerated poses, found {len(frames)}")
	return frames


def cart_visual_metrics(image: Image.Image) -> tuple[int, int, int]:
	"""Measure the cart silhouette in its lower band, excluding duck and most liquid."""
	alpha = np.asarray(image.getchannel("A")) > 32
	lower = alpha.copy()
	lower[: round(image.height * 0.48), :] = False
	column_counts = lower.sum(axis=0)
	xs = np.flatnonzero(column_counts > max(3, round(image.height * 0.015)))
	if len(xs) == 0:
		raise ValueError("Could not locate the stable Mega Coaster cart silhouette")
	left, right = int(xs[0]), int(xs[-1] + 1)
	# Ground from the rear half only: front vomit/drips cannot move the wheel baseline.
	rear_right = min(image.width, left + max(1, round((right - left) * 0.48)))
	rows = np.flatnonzero(alpha[:, left:rear_right].sum(axis=1) > 3)
	if len(rows) == 0:
		raise ValueError("Could not locate the stable Mega Coaster wheel baseline")
	return left, right - left, int(rows[-1] + 1)


def regenerated_scale(frames: list[Image.Image]) -> float:
	"""Use one scale for the full regenerated sheet. Never fit individual frames."""
	return CART_VISUAL_TARGET_WIDTH / cart_visual_metrics(frames[0])[1]


def duck_registration_anchor(image: Image.Image) -> tuple[float, float]:
	"""Measure the rigid yellow body/head mass, excluding the cart and outward liquid."""
	rgba = np.asarray(image.convert("RGBA"))
	red, green, blue = rgba[:, :, 0], rgba[:, :, 1], rgba[:, :, 2]
	y, x = np.ogrid[: image.height, : image.width]
	duck = (
		(rgba[:, :, 3] > 32)
		& (red > 120)
		& (green > 50)
		& (red > green * 1.02)
		& (blue < 120)
		& (x > image.width * 0.18)
		& (x < image.width * 0.7)
		& (y < image.height * 0.68)
	)
	ys, xs = np.nonzero(duck)
	if len(xs) < 100:
		raise ValueError("Could not locate regenerated Mega Coaster duck")
	return float(xs.mean()), float(ys.mean())


def validate_regenerated_registration(frames: list[Image.Image]) -> None:
	"""Reject source sheets whose rigid cart/body/head registration can visibly shake."""
	reference_cart = cart_visual_metrics(frames[0])
	reference_duck = duck_registration_anchor(frames[0])
	for index, frame in enumerate(frames[1:], start=1):
		cart = cart_visual_metrics(frame)
		duck = duck_registration_anchor(frame)
		if any(abs(value - reference) > 2 for value, reference in zip(cart, reference_cart)):
			raise ValueError(f"Mega Coaster regenerated cart drifts in source frame {index}")
		if abs(duck[0] - reference_duck[0]) > 3 or abs(duck[1] - reference_duck[1]) > 3:
			raise ValueError(f"Mega Coaster regenerated duck drifts in source frame {index}")


def normalize_pose(
	image: Image.Image,
	x_scale: float,
	reference_left: int,
	reference_ground: int,
) -> Image.Image:
	"""Apply one global transform; no per-frame fit, translation or shake correction."""
	y_scale = x_scale * VERTICAL_SCALE_CORRECTION
	resized = image.resize(
		(round(image.width * x_scale), round(image.height * y_scale)),
		Image.Resampling.LANCZOS,
	)
	frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE))
	frame.alpha_composite(
		resized,
		(
			round(CART_LEFT - reference_left * x_scale),
			round(GROUND_BASELINE - reference_ground * y_scale),
		),
	)
	return frame


def dilate_mask(mask: np.ndarray, radius: int) -> np.ndarray:
	"""Small NumPy-only dilation used to retain character outlines over the fixed cart."""
	result = mask.copy()
	for _ in range(radius):
		padded = np.pad(result, 1, mode="constant")
		result = np.logical_or.reduce(
			[
				padded[0:-2, 0:-2],
				padded[0:-2, 1:-1],
				padded[0:-2, 2:],
				padded[1:-1, 0:-2],
				padded[1:-1, 1:-1],
				padded[1:-1, 2:],
				padded[2:, 0:-2],
				padded[2:, 1:-1],
				padded[2:, 2:],
			]
		)
	return result


def largest_component_mask(mask: np.ndarray) -> np.ndarray:
	"""Keep the main duck colour mass; reject detached gold/red cart trim."""
	labels = np.zeros(mask.shape, dtype=np.int16)
	height, width = mask.shape
	label = 0
	areas: list[int] = [0]
	for seed_y, seed_x in zip(*np.nonzero(mask), strict=True):
		if labels[seed_y, seed_x] != 0:
			continue
		label += 1
		queue = deque([(int(seed_x), int(seed_y))])
		labels[seed_y, seed_x] = label
		area = 0
		while queue:
			x, y = queue.popleft()
			area += 1
			for next_y in range(max(0, y - 1), min(height, y + 2)):
				for next_x in range(max(0, x - 1), min(width, x + 2)):
					if mask[next_y, next_x] and labels[next_y, next_x] == 0:
						labels[next_y, next_x] = label
						queue.append((next_x, next_y))
		areas.append(area)
	if label == 0:
		return mask
	return labels == int(np.argmax(areas))


def remove_small_components_mask(mask: np.ndarray, minimum_area: int) -> np.ndarray:
	"""Keep real liquid masses/droplets; drop tiny colour-key noise from cart trim."""
	labels = np.zeros(mask.shape, dtype=np.int16)
	height, width = mask.shape
	label = 0
	areas: list[int] = [0]
	for seed_y, seed_x in zip(*np.nonzero(mask), strict=True):
		if labels[seed_y, seed_x] != 0:
			continue
		label += 1
		queue = deque([(int(seed_x), int(seed_y))])
		labels[seed_y, seed_x] = label
		area = 0
		while queue:
			x, y = queue.popleft()
			area += 1
			for next_y in range(max(0, y - 1), min(height, y + 2)):
				for next_x in range(max(0, x - 1), min(width, x + 2)):
					if mask[next_y, next_x] and labels[next_y, next_x] == 0:
						labels[next_y, next_x] = label
						queue.append((next_x, next_y))
		areas.append(area)
	keep = np.array([area >= minimum_area for area in areas], dtype=bool)
	return keep[labels]


def character_over_cart_mask(rgba: np.ndarray) -> np.ndarray:
	"""Duck/vomit colours plus their outlines; cart reds and gold trim stay excluded."""
	rgb = rgba[:, :, :3].astype(np.float32)
	red, green, blue = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
	alpha = rgba[:, :, 3] > 0
	y, x = np.ogrid[: rgba.shape[0], : rgba.shape[1]]
	green_character = (
		(green > 58)
		& (green > red * 0.88)
		& (green > blue * 1.35)
		& (x >= round(FRAME_SIZE * 0.16))
		& (y < round(FRAME_SIZE * 0.88))
	)
	yellow_duck = (
		(red > 135)
		& (green > 55)
		& (red > green * 1.04)
		& (blue < 105)
		& (x >= round(FRAME_SIZE * 0.22))
		& (x <= round(FRAME_SIZE * 0.6))
		& (y < round(FRAME_SIZE * 0.73))
	)
	red_duck_detail = (
		(red > 70)
		& (red > green * 1.15)
		& (x >= round(FRAME_SIZE * 0.235))
		& (x <= round(FRAME_SIZE * 0.63))
		& (y < round(FRAME_SIZE * 0.65))
	)
	central_character = (
		(green_character | yellow_duck | red_duck_detail)
		& (x <= round(FRAME_SIZE * 0.7))
		& (y < round(FRAME_SIZE * 0.76))
	)
	duck_core = largest_component_mask(alpha & central_character)
	duck_zone = (
		(
			(x >= round(FRAME_SIZE * 0.26))
			& (x <= round(FRAME_SIZE * 0.7))
			& (y < round(FRAME_SIZE * 0.61))
		)
		| (
			(x >= round(FRAME_SIZE * 0.28))
			& (x <= round(FRAME_SIZE * 0.52))
			& (y < round(FRAME_SIZE * 0.72))
		)
	)
	liquid_zone = (
		(x >= round(FRAME_SIZE * 0.18))
		& (y < round(FRAME_SIZE * 0.84))
	)
	face_zone = (
		((x - round(FRAME_SIZE * 0.45)) / (FRAME_SIZE * 0.28)) ** 2
		+ ((y - round(FRAME_SIZE * 0.36)) / (FRAME_SIZE * 0.29)) ** 2
		<= 1
		) & (x >= round(FRAME_SIZE * 0.28)) & (y < round(FRAME_SIZE * 0.55))
	hand_zone = (
		(x >= round(FRAME_SIZE * 0.4))
		& (x <= round(FRAME_SIZE * 0.64))
		& (y >= round(FRAME_SIZE * 0.4))
		& (y < round(FRAME_SIZE * 0.66))
	)
	# Green vomit can extend far from the body and form detached droplets.
	liquid_core = remove_small_components_mask(
		alpha & green_character & (x >= round(FRAME_SIZE * 0.5)),
		minimum_area=10,
	)
	duck_pixels = alpha & dilate_mask(duck_core, 3) & duck_zone
	hand_core = remove_small_components_mask(alpha & yellow_duck & hand_zone, minimum_area=4)
	hand_pixels = alpha & dilate_mask(hand_core, 3) & hand_zone
	liquid_pixels = alpha & dilate_mask(liquid_core, 3) & liquid_zone
	core = (alpha & duck_core & duck_zone) | liquid_core
	outline = duck_pixels | liquid_pixels
	red_cart = (red > 52) & (red > green * 1.2) & (red > blue * 1.18) & (green < 120)
	# Preserve face and hands in full. Keep the broad geometry away from the seat/steering so
	# the source cart cannot leak into the animated attachment and appear to shake.
	return (alpha & face_zone) | core | ((outline | hand_pixels) & ~red_cart)


def cart_region_mask() -> np.ndarray:
	"""Rigid cart footprint in normalized 256px pose space."""
	y, x = np.ogrid[:FRAME_SIZE, :FRAME_SIZE]
	return (
		(x >= round(FRAME_SIZE * 0.055))
		& (x <= round(FRAME_SIZE * 0.81))
		& (y >= round(FRAME_SIZE * 0.34))
	)


def build_fixed_cart(empty_cart_pose: Image.Image) -> Image.Image:
	"""Use the clean regenerated empty cart directly; no masks, cuts or painted repairs."""
	return empty_cart_pose.copy()


def build_cart_front(fixed_cart: Image.Image, canonical_pose: Image.Image) -> Image.Image:
	"""Restore one immutable steering assembly and the cockpit/body foreground."""
	current = np.asarray(fixed_cart.convert("RGBA")).copy()
	canonical = np.asarray(canonical_pose.convert("RGBA")).copy()
	y, x = np.ogrid[:FRAME_SIZE, :FRAME_SIZE]
	body_region = (
		(x >= round(FRAME_SIZE * 0.21))
		& (x <= round(FRAME_SIZE * 0.64))
		& (y >= round(FRAME_SIZE * 0.64))
	)
	steering_region = (
		(x >= round(FRAME_SIZE * 0.5))
		& (x <= round(FRAME_SIZE * 0.62))
		& (y >= round(FRAME_SIZE * 0.545))
		& (y <= round(FRAME_SIZE * 0.685))
	)
	steering_luma = canonical[:, :, :3].astype(np.float32).mean(axis=2)
	steering_pixels = remove_small_components_mask(
		steering_region & (canonical[:, :, 3] > 0) & (steering_luma < 115),
		minimum_area=24,
	)
	current[steering_pixels] = canonical[steering_pixels]
	front_region = body_region | steering_region
	current[~front_region] = 0
	return Image.fromarray(current, "RGBA")


def dynamic_layer_masks(poses: list[Image.Image]) -> list[np.ndarray]:
	"""Keep only the regenerated duck, moving arm, face and vomit pixels."""
	masks: list[np.ndarray] = []
	for pose in poses:
		rgba = np.asarray(pose.convert("RGBA"))
		alpha = rgba[:, :, 3] > 0
		masks.append(alpha & character_over_cart_mask(rgba))
	return masks


def apply_dynamic_masks(poses: list[Image.Image], masks: list[np.ndarray]) -> list[Image.Image]:
	"""Strip every cart pixel, leaving a transparent duck/vomit-only frame."""
	if len(poses) != len(masks):
		raise ValueError("Mega Coaster pose/mask count mismatch")
	dynamic_layers: list[Image.Image] = []
	for pose, mask in zip(poses, masks, strict=True):
		current = np.asarray(pose.convert("RGBA")).copy()
		current[~mask] = 0
		dynamic_layers.append(Image.fromarray(current, "RGBA"))
	return dynamic_layers


def apply_sick_tint(poses: list[Image.Image]) -> list[Image.Image]:
	"""Turn only the rigid duck skin green through the retch/vomit phase."""
	if len(poses) != len(SICK_TINT_AMOUNTS):
		raise ValueError("Mega Coaster sick tint/pose count mismatch")
	tinted: list[Image.Image] = []
	for pose, amount in zip(poses, SICK_TINT_AMOUNTS, strict=True):
		rgba = np.asarray(pose.convert("RGBA")).copy()
		rgb = rgba[:, :, :3].astype(np.float32)
		red, green, blue = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
		y, x = np.ogrid[:FRAME_SIZE, :FRAME_SIZE]
		yellow_skin = (
			(rgba[:, :, 3] > 0)
			& (red > 105)
			& (green > 52)
			& (green > red * 0.5)
			& (red > green * 1.06)
			& (blue < green * 0.62)
			& (x >= round(FRAME_SIZE * 0.22))
			& (x <= round(FRAME_SIZE * 0.62))
			& (y < round(FRAME_SIZE * 0.74))
		)
		sick_rgb = rgb.copy()
		# Match the supplied sick-duck reference palette: olive/lime, not neon green.
		sick_rgb[:, :, 0] *= 0.65
		sick_rgb[:, :, 1] *= 0.95
		sick_rgb[:, :, 2] *= 1.05
		mixed = rgb * (1.0 - amount) + sick_rgb * amount
		rgba[yellow_skin, :3] = np.clip(mixed[yellow_skin], 0, 255).astype(np.uint8)
		tinted.append(Image.fromarray(rgba, "RGBA"))
	return tinted


def motion_interpolate_poses(source_poses: list[Image.Image]) -> list[Image.Image]:
	"""Create opaque motion-compensated in-betweens; alpha crossfades make hands transparent."""
	if len(source_poses) != SOURCE_FRAME_COUNT + 1:
		raise ValueError("Mega Coaster motion source count mismatch")
	with tempfile.TemporaryDirectory(prefix="theme-park-coaster-flow-") as temp:
		root = Path(temp)
		color_input = root / "color-input"
		alpha_input = root / "alpha-input"
		color_output = root / "color-output"
		alpha_output = root / "alpha-output"
		for directory in (color_input, alpha_input, color_output, alpha_output):
			directory.mkdir()

		# Duplicate the exact loop endpoint once more. minterpolate needs a future frame to emit
		# the final requested loop sample.
		for index, pose in enumerate([*source_poses, source_poses[-1]]):
			rgba = np.asarray(pose.convert("RGBA"))
			alpha = rgba[:, :, 3:4].astype(np.float32) / 255
			premultiplied = np.round(rgba[:, :, :3] * alpha).astype(np.uint8)
			alpha_rgb = np.repeat(rgba[:, :, 3:4], 3, axis=2)
			Image.fromarray(premultiplied, "RGB").save(color_input / f"{index:03d}.png")
			Image.fromarray(alpha_rgb, "RGB").save(alpha_input / f"{index:03d}.png")

		filter_graph = (
			"minterpolate=fps=7.9375:mi_mode=mci:mc_mode=aobmc:"
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
			FEATURES / output_name,
			optimize=True,
		)

	rail = Image.open(SOURCE / "rail-source.png").convert("RGBA")
	bbox = rail.getchannel("A").getbbox()
	if not bbox:
		raise ValueError("Empty Mega Coaster rail source")
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
		*(
			(f"{FRAME_PREFIX}_{index:03d}", frame)
			for index, frame in enumerate(frames)
		),
		(CART_BACK_ATTACHMENT, fixed_cart),
		(CART_FRONT_ATTACHMENT, cart_front),
	]
	regions: list[dict[str, object]] = []
	for name, frame in entries:
		bbox = frame.getchannel("A").getbbox()
		if not bbox:
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

	# Height-sorted shelf packing keeps every exact 128-frame pose while cutting the former
	# 4096x2304 transparent texture down to a mobile-safe <=2048px atlas.
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

	# Prove trimming/offset data reconstructs every original 256x256 layer pixel-for-pixel.
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
		name = region["name"]
		x, y = region["x"], region["y"]
		crop = region["crop"]
		offset_y = FRAME_SIZE - region["bottom"]
		lines.extend(
			[
				name,
				"  rotate: false",
				f"  xy: {x}, {y}",
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
			"hash": "theme-park-mega-coaster-vomit-v28-trimmed-atlas-128frame",
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
	frames = extract_regenerated_frames()
	validate_regenerated_registration(frames)
	reference_left, _, reference_ground = cart_visual_metrics(frames[0])
	scale = regenerated_scale(frames)
	normalized_poses = [
		normalize_pose(frame, scale, reference_left, reference_ground) for frame in frames
	]
	empty_cart = Image.open(EMPTY_CART_SOURCE).convert("RGBA")
	cart_left, cart_width, cart_ground = cart_visual_metrics(empty_cart)
	cart_scale = CART_VISUAL_TARGET_WIDTH / cart_width
	normalized_cart = normalize_pose(empty_cart, cart_scale, cart_left, cart_ground)
	fixed_cart = build_fixed_cart(normalized_cart)
	cart_front = build_cart_front(fixed_cart, normalized_cart)
	source_masks = dynamic_layer_masks(normalized_poses)
	dynamic_source_poses = apply_sick_tint(
		apply_dynamic_masks(normalized_poses, source_masks)
	)
	# End on the exact opening happy pose. Motion flow keeps moving hands opaque and removes
	# the small alpha-crossfade wobble between registered keys.
	poses = motion_interpolate_poses([*dynamic_source_poses, dynamic_source_poses[0]])
	build_atlas(poses, fixed_cart, cart_front)
	build_skeleton()
	build_runtime_stills_and_rail(poses, fixed_cart, cart_front)
	print(
		f"Built Mega Coaster vomiting Spine rig: {FRAME_COUNT} duck-only poses, "
		f"{VOMIT_DURATION:.2f}s -> {OUTPUT}"
	)


if __name__ == "__main__":
	main()
