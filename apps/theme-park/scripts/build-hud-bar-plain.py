#!/usr/bin/env python3
"""Strip the painted sparkles off the HUD bar plates, and measure their neon edges.

The bar art ships with bright points baked onto its border. They never move, so on a bar that sits
on screen for the whole session they read as dirt on the glass rather than as lights — and they
cannot coexist with the running lights the popups use, because a light passing a painted one looks
like it stopped. This removes them, and also prints a geometry/colour-ramp table for running real lights along the
same line. Only the REPAIRED PLATES are still used: the running-lights components and the
`POPUP_BORDERS` table they fed were deleted 2026-08-26 as dead code (recover from git if they come
back). Nothing consumes what the table half of this script prints.

Two plates carry the same painted bar: hud/bar_plate.webp behind the desktop control row, and
controls/nav-bar.png — the same art cropped tight and made vertically symmetric — behind the
portrait one. They have different borders, so each is measured and repaired on its own.

Same idea as hud/neon-frame-plain.png, which was made from neon-frame.png for the popup frame.

The repair works in the border's own (t, offset) space rather than in x/y: a sparkle is erased by
interpolating along the line between the clean stretches either side of it, at every depth through
the glow. Interpolating along x instead only works where the line is straight, and two of these
sparkles sit on the corners, where it flattens the curve into a horizontal smear.
"""

import math
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]


@dataclass
class Plate:
	"""One bar plate: where its art is, and where the neon line sits on it.

	The line is the OUTER of the two concentric strokes the art paints, found per column as the
	first luminance peak walking in from the edge. An intensity-weighted centroid lands between the
	two and puts the lights in the dark gap; the outer line is also the one the popup arts run their
	lights on.

	`radius` is a single number for both axes even where the painted corner is a pixel out of round:
	the inverse map below (pixel -> point on the line) is exact for a circular corner and only
	approximate for an elliptical one, and half a pixel of corner radius is invisible where being
	wrong about which part of the line a pixel belongs to is not.
	"""

	name: str
	source: Path
	output: Path
	left: float
	top: float
	right: float
	bottom: float
	radius: float
	segments: list[float] = field(init=False)
	perimeter: float = field(init=False)

	def __post_init__(self) -> None:
		run_x = self.right - self.left - 2 * self.radius
		run_y = self.bottom - self.top - 2 * self.radius
		arc = math.pi * self.radius / 2
		self.segments = [run_x / 2, arc, run_y, arc, run_x, arc, run_y, arc, run_x / 2]
		self.perimeter = sum(self.segments)


PLATES = [
	# Desktop control row. Straight runs at x 8 and 1114, y 7 and 92; corner 21 wide by 20 tall.
	Plate(
		name="bar",
		source=ROOT / "static/assets/theme-park/v2/hud/bar_plate.webp",
		output=ROOT / "static/assets/theme-park/v2/hud/bar_plate-clean.webp",
		left=8.0,
		top=7.0,
		right=1114.0,
		bottom=92.0,
		radius=20.5,
	),
	# Portrait control row: the same art cropped tighter top and bottom, so the border sits at y 4
	# and 89 with a smaller corner. Same x as the desktop plate — it was not cropped horizontally.
	Plate(
		name="navBar",
		source=ROOT / "static/assets/theme-park/v2/controls/nav-bar.png",
		output=ROOT / "static/assets/theme-park/v2/controls/nav-bar-clean.png",
		left=8.0,
		top=4.0,
		right=1114.0,
		bottom=89.0,
		radius=17.0,
	),
]

# How deep the repair reaches, in pixels off the line. Outward is generous — it has to take a
# sparkle's whole bloom with it, since a cleaned core inside a surviving halo looks worse than the
# sparkle did. Inward is not: the plate is only 85px tall between its lines, so reaching 26 in from
# both would meet in the middle, and pixels equidistant from every edge have no meaningful position
# along the line to repair them by. 34 clears the sparkles' inner bloom off the dark fill and still
# leaves a gap either side of the plate's centre line.
REPAIR_DEPTH_OUT = 26
REPAIR_DEPTH_IN = 34
# Depth used when looking FOR sparkles: near the line only, where a sparkle is unambiguous.
DETECT_DEPTH = 6

# Detection, in samples around the border (SAMPLES of them). A sparkle is a short run sitting above
# the local average of the line's own brightness; BASELINE_SPAN is the window that average is taken
# over, wide enough that a sparkle cannot lift its own baseline.
SAMPLES = 2000
BASELINE_SPAN = 301
# Excess brightness (0-255) that starts a run, and the share of a run's peak that ends it.
PEAK_THRESHOLD = 30
EDGE_SHARE = 0.35
# Runs closer than this (in t) are treated as one, and every run is padded by this much before the
# repair, so the interpolation starts from genuinely clean line.
MERGE_GAP = 0.004
RUN_PAD = 0.004
# Repairing a sparkle lowers the average the next detection measures against, which can expose the
# outer wings of a big bloom that the first pass read as baseline. Two or three passes settle it;
# the cap is there so a plate whose line genuinely varies cannot be flattened all the way round.
MAX_PASSES = 4

RAMP_STEPS = 96
# How far either side of the measured line to look, in pixels. Only wide enough to absorb rounding.
RAMP_OFFSETS = range(-2, 3)
RAMP_SMOOTH = 5


def border_point(plate: Plate, t: float) -> tuple[float, float]:
	"""Port of roundedRectPoint from src/lib/roundedRectPath.ts, in source pixels."""
	left, top = plate.left, plate.top
	right, bottom = plate.right, plate.bottom
	rx = ry = plate.radius
	segments = plate.segments
	run_x, run_y = segments[4], segments[2]

	distance = (t % 1.0) * plate.perimeter
	for index, span in enumerate(segments):
		if distance <= span:
			f = distance / span
			if index == 0:
				return left + rx + run_x / 2 + run_x / 2 * f, top
			if index == 1:
				a = -math.pi / 2 + f * math.pi / 2
				return right - rx + rx * math.cos(a), top + ry + ry * math.sin(a)
			if index == 2:
				return right, top + ry + run_y * f
			if index == 3:
				a = f * math.pi / 2
				return right - rx + rx * math.cos(a), bottom - ry + ry * math.sin(a)
			if index == 4:
				return right - rx - run_x * f, bottom
			if index == 5:
				a = math.pi / 2 + f * math.pi / 2
				return left + rx + rx * math.cos(a), bottom - ry + ry * math.sin(a)
			if index == 6:
				return left, bottom - ry - run_y * f
			if index == 7:
				a = math.pi + f * math.pi / 2
				return left + rx + rx * math.cos(a), top + ry + ry * math.sin(a)
			return left + rx + run_x / 2 * f, top
		distance -= span
	return left + rx, top


def border_normal(plate: Plate, t: float) -> tuple[float, float]:
	"""Unit normal pointing away from the panel, from the tangent at `t`."""
	x, y = border_point(plate, t)
	ahead_x, ahead_y = border_point(plate, t + 0.0005)
	dx, dy = ahead_x - x, ahead_y - y
	length = math.hypot(dx, dy) or 1.0
	# t runs clockwise, so the outward side is the tangent turned anticlockwise. This has to agree
	# with the sign `inverse_map` gives `offset` (positive outside), or the repair samples an inside
	# pixel from outside the plate entirely and writes transparency into the middle of the bar.
	return dy / length, -dx / length


def inverse_map(
	plate: Plate, xs: np.ndarray, ys: np.ndarray
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
	"""Every pixel's (t, offset), plus whether that pair means anything.

	The nearest point on a rounded rectangle is found by clamping into the rectangle the corner
	centres describe and stepping one radius back out along the direction that clamp moved.
	"""
	left, top = plate.left, plate.top
	right, bottom = plate.right, plate.bottom
	radius = plate.radius

	clamped_x = np.clip(xs, left + radius, right - radius)
	clamped_y = np.clip(ys, top + radius, bottom - radius)
	dx, dy = xs - clamped_x, ys - clamped_y
	distance = np.hypot(dx, dy)
	# Pixels sitting exactly on a corner centre — and the whole interior spine, which clamps to
	# itself — are equidistant from the line in every direction and have no position along it.
	valid = distance > 1e-6
	safe = np.where(valid, distance, 1.0)
	offset = distance - radius
	point_x = clamped_x + dx / safe * radius
	point_y = clamped_y + dy / safe * radius

	# Arc length of that point, walking the same segment order as border_point.
	run_x, arc = plate.segments[4], plate.segments[1]
	starts = np.cumsum([0.0] + plate.segments[:-1])

	angle = np.arctan2(point_y - clamped_y, point_x - clamped_x)

	# Corners first, then the straight runs overwrite where they apply — the corner test is an angle
	# and the straight test an exact coordinate, so the straight one is the more certain of the two.
	right_top = (point_x > clamped_x) & (point_y < clamped_y)
	right_bottom = (point_x > clamped_x) & (point_y >= clamped_y)
	left_bottom = (point_x <= clamped_x) & (point_y >= clamped_y)
	left_top = (point_x <= clamped_x) & (point_y < clamped_y)

	length = np.where(right_top, starts[1] + (angle + math.pi / 2) / (math.pi / 2) * arc, 0.0)
	length = np.where(right_bottom, starts[3] + angle / (math.pi / 2) * arc, length)
	length = np.where(
		left_bottom, starts[5] + (angle - math.pi / 2) / (math.pi / 2) * arc, length
	)
	length = np.where(
		left_top,
		starts[7] + ((angle + math.pi) % (2 * math.pi)) / (math.pi / 2) * arc,
		length,
	)

	straight_top = np.isclose(point_y, top, atol=0.01)
	straight_bottom = np.isclose(point_y, bottom, atol=0.01)
	straight_right = np.isclose(point_x, right, atol=0.01)
	straight_left = np.isclose(point_x, left, atol=0.01)

	middle = left + radius + run_x / 2
	length = np.where(
		straight_top,
		np.where(
			point_x >= middle,
			starts[0] + (point_x - middle),
			starts[8] + (point_x - (left + radius)),
		),
		length,
	)
	length = np.where(straight_right, starts[2] + (point_y - (top + radius)), length)
	length = np.where(straight_bottom, starts[4] + ((right - radius) - point_x), length)
	length = np.where(straight_left, starts[6] + ((bottom - radius) - point_y), length)

	return (length / plate.perimeter) % 1.0, offset, valid


def sample(pixels: np.ndarray, xs: np.ndarray, ys: np.ndarray) -> np.ndarray:
	"""Bilinear sample of the source at arbitrary coordinates."""
	height, width = pixels.shape[:2]
	xs = np.clip(xs, 0, width - 1.001)
	ys = np.clip(ys, 0, height - 1.001)
	x0, y0 = np.floor(xs).astype(int), np.floor(ys).astype(int)
	fx, fy = (xs - x0)[..., None], (ys - y0)[..., None]
	top = pixels[y0, x0] * (1 - fx) + pixels[y0, x0 + 1] * fx
	bottom = pixels[y0 + 1, x0] * (1 - fx) + pixels[y0 + 1, x0 + 1] * fx
	return top * (1 - fy) + bottom * fy


def find_sparkles(plate: Plate, pixels: np.ndarray) -> list[tuple[float, float]]:
	"""Runs of t where the line is whiter than its own neighbourhood.

	Whiteness, not brightness: the neon is saturated and its strongest channel is pinned at 255 for
	most of the ring, so a peak in `max(rgb)` finds nothing. What a painted sparkle does is lift the
	channels the hue leaves dark, and `min(rgb)` sees only that.
	"""
	luma = pixels[..., :3].min(axis=2) * (pixels[..., 3] / 255)

	brightness = np.empty(SAMPLES)
	for index in range(SAMPLES):
		t = index / SAMPLES
		x, y = border_point(plate, t)
		nx, ny = border_normal(plate, t)
		depths = np.arange(-DETECT_DEPTH, DETECT_DEPTH + 1)
		xs = np.clip(np.round(x + nx * depths).astype(int), 0, luma.shape[1] - 1)
		ys = np.clip(np.round(y + ny * depths).astype(int), 0, luma.shape[0] - 1)
		brightness[index] = luma[ys, xs].max()

	# Circular rolling mean, so the baseline is continuous across t = 0.
	pad = BASELINE_SPAN // 2
	wrapped = np.r_[brightness[-pad:], brightness, brightness[:pad]]
	baseline = np.convolve(wrapped, np.ones(BASELINE_SPAN) / BASELINE_SPAN, mode="same")[
		pad : pad + SAMPLES
	]
	excess = brightness - baseline

	runs: list[list[int]] = []
	for index in np.argsort(excess)[::-1]:
		if excess[index] < PEAK_THRESHOLD:
			break
		if any(run[0] <= index <= run[1] for run in runs):
			continue
		floor = excess[index] * EDGE_SHARE
		start = index
		while excess[(start - 1) % SAMPLES] > floor and index - start < SAMPLES // 4:
			start -= 1
		end = index
		while excess[(end + 1) % SAMPLES] > floor and end - index < SAMPLES // 4:
			end += 1
		runs.append([start, end])

	spans = sorted((start / SAMPLES, end / SAMPLES) for start, end in runs)
	merged: list[tuple[float, float]] = []
	for start, end in spans:
		if merged and start - merged[-1][1] <= MERGE_GAP:
			merged[-1] = (merged[-1][0], max(merged[-1][1], end))
		else:
			merged.append((start, end))
	return merged


def repair(plate: Plate, image: Image.Image, spans: list[tuple[float, float]]) -> Image.Image:
	pixels = np.asarray(image).astype(np.float32)
	height, width = pixels.shape[:2]
	ys, xs = np.mgrid[0:height, 0:width]
	t, offset, valid = inverse_map(plate, xs.astype(np.float64), ys.astype(np.float64))

	repaired = pixels.copy()
	near = valid & (offset <= REPAIR_DEPTH_OUT) & (offset >= -REPAIR_DEPTH_IN)

	for start, end in spans:
		start, end = start - RUN_PAD, end + RUN_PAD
		# A run can wrap past t = 1; shift the whole comparison so it does not have to.
		shifted = (t - start) % 1.0
		width_t = (end - start) % 1.0
		inside = near & (shifted <= width_t)
		if not inside.any():
			continue

		fraction = (shifted[inside] / width_t)[..., None]
		depth = offset[inside]
		# The same depth through the glow at each clean end of the run, blended across it. Sampling
		# at matching depth is what keeps the line's cross-section — its core, its falloff — intact
		# while the sparkle sitting on top of it is interpolated away.
		before_x, before_y = border_point(plate, start), border_normal(plate, start)
		after_x, after_y = border_point(plate, end), border_normal(plate, end)
		before = sample(
			pixels, before_x[0] + before_y[0] * depth, before_x[1] + before_y[1] * depth
		)
		after = sample(pixels, after_x[0] + after_y[0] * depth, after_x[1] + after_y[1] * depth)
		repaired[inside] = before * (1 - fraction) + after * fraction

	return Image.fromarray(np.clip(repaired, 0, 255).astype(np.uint8), "RGBA")


def sample_ramp(plate: Plate, image: Image.Image) -> list[int]:
	pixels = np.asarray(image).astype(np.float32)
	height, width = pixels.shape[:2]
	ramp: list[np.ndarray] = []

	for step in range(RAMP_STEPS):
		t = step / RAMP_STEPS
		x, y = border_point(plate, t)
		nx, ny = border_normal(plate, t)

		# Read a short profile across the line and take its brightest opaque pixel. The measured
		# geometry already puts us on the outer stroke, so this only has to absorb the rounding —
		# searching a wider band lands in the fringe of the glow, whose hue has drifted well off the
		# line's own.
		best = None
		best_luma = -1.0
		for depth in RAMP_OFFSETS:
			px, py = int(round(x + nx * depth)), int(round(y + ny * depth))
			if not (0 <= px < width and 0 <= py < height):
				continue
			if pixels[py, px, 3] < 200:
				continue
			rgb = pixels[py, px, :3]
			if rgb.max() > best_luma:
				best_luma = rgb.max()
				best = rgb

		# Normalised to full brightness, the way the popup ramps are: this is the colour a light
		# GLOWS, not the colour the art happens to be painted at that point, and a ramp of half-lit
		# samples makes every running light look like it needs a new bulb.
		if best is None or best.max() <= 0:
			ramp.append(np.zeros(3))
		else:
			ramp.append(best * (255 / best.max()))

	# Circular smoothing, for the same reason the popup ramps are smoothed: a ramp read straight off
	# painted art steps, and a light stepping hue as it travels reads as a bug.
	stacked = np.stack(ramp)
	smoothed = np.zeros_like(stacked)
	for index in range(RAMP_STEPS):
		window = [(index + k) % RAMP_STEPS for k in range(-RAMP_SMOOTH, RAMP_SMOOTH + 1)]
		smoothed[index] = stacked[window].mean(axis=0)

	# Smoothing mixes neighbouring hues and pulls each entry back off full brightness, so put every
	# entry back on its own peak afterwards — the ramp is a ring of hues, all at full strength.
	peaks = smoothed.max(axis=1, keepdims=True)
	smoothed = np.where(peaks > 0, np.clip(smoothed * (255 / np.maximum(peaks, 1)), 0, 255), 0)

	return [
		(int(r) << 16) | (int(g) << 8) | int(b) for r, g, b in np.round(smoothed).astype(np.int32)
	]


def build_plate(plate: Plate) -> None:
	print(f"=== {plate.name}: {plate.source.relative_to(ROOT)}")
	plain = Image.open(plate.source).convert("RGBA")
	for pass_number in range(1, MAX_PASSES + 1):
		spans = find_sparkles(plate, np.asarray(plain).astype(np.float32))
		if not spans:
			print(f"pass {pass_number}: clean")
			break
		print(
			f"pass {pass_number}: {len(spans)} sparkles — "
			+ ", ".join(f"t {a:.4f}..{b:.4f}" for a, b in spans)
		)
		plain = repair(plate, plain, spans)

	if plate.output.suffix == ".png":
		plain.save(plate.output, "PNG", optimize=True)
	else:
		plain.save(plate.output, "WEBP", quality=94, method=6, lossless=False)
	print(f"{plate.output.relative_to(ROOT)}  {plain.width}x{plain.height}")

	width, height = plain.size
	print(f"\n\t{plate.name}: {{")
	for key in ("left", "top", "right", "bottom"):
		extent = width if key in ("left", "right") else height
		print(f"\t\t{key}: {getattr(plate, key) / extent:.5f},")
	print(f"\t\trx: {plate.radius / width:.5f},")
	print(f"\t\try: {plate.radius / height:.5f},")
	print("\t\tramp: [")
	ramp = sample_ramp(plate, plain)
	for row in range(0, RAMP_STEPS, 6):
		entries = ", ".join(f"0x{value:06x}" for value in ramp[row : row + 6])
		print(f"\t\t\t{entries},")
	print("\t\t],\n\t},\n")


if __name__ == "__main__":
	for entry in PLATES:
		build_plate(entry)
