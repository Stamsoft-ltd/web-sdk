#!/usr/bin/env python3
"""Build the runtime anticipation frame from the approved generated concept."""

from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art/concepts/anticipation-frame-concept-v2.png"
OUTPUT = ROOT / "static/assets/theme-park/v2/features/anticipation-frame-v2.webp"

# Crop away concept-sheet breathing room, then compress only the ornate caps. Keeping the final
# canvas height unchanged gives the rails more room without making the overlay shorter than a reel.
CROP = (150, 24, 686, 1866)
TOP_CUT = 270
BOTTOM_CUT = 1580
CAP_HEIGHT = 118


def smoothstep(values: np.ndarray, low: float, high: float) -> np.ndarray:
	value = np.clip((values - low) / (high - low), 0, 1)
	return value * value * (3 - 2 * value)


def build() -> None:
	source = Image.open(SOURCE).convert("RGB").crop(CROP)
	width, height = source.size
	middle_height = height - CAP_HEIGHT * 2

	top = source.crop((0, 0, width, TOP_CUT)).resize((width, CAP_HEIGHT), Image.Resampling.LANCZOS)
	middle = source.crop((0, TOP_CUT, width, BOTTOM_CUT)).resize(
		(width, middle_height), Image.Resampling.LANCZOS
	)
	bottom = source.crop((0, BOTTOM_CUT, width, height)).resize(
		(width, CAP_HEIGHT), Image.Resampling.LANCZOS
	)

	frame = Image.new("RGB", (width, height))
	frame.paste(top, (0, 0))
	frame.paste(middle, (0, CAP_HEIGHT))
	frame.paste(bottom, (0, height - CAP_HEIGHT))

	pixels = np.asarray(frame).astype(np.float32)
	value = pixels.max(axis=2)
	y, x = np.mgrid[:height, :width]
	alpha = smoothstep(value, 72, 175)

	# Preserve the marquee/caps and rails while removing the generated presentation backdrop.
	structure = (y < CAP_HEIGHT + 18) | (y > height - CAP_HEIGHT - 18) | (x < 82) | (x > width - 83)
	alpha = np.maximum(alpha, smoothstep(value, 28, 105) * structure)

	# Live reel symbols stay fully visible through the centre.
	left, right = 65, width - 66
	top_open, bottom_open = CAP_HEIGHT, height - CAP_HEIGHT
	feather = 12
	inside_x = np.clip(np.minimum(x - left, right - x) / feather, 0, 1)
	inside_y = np.clip(np.minimum(y - top_open, bottom_open - y) / feather, 0, 1)
	alpha *= 1 - inside_x * inside_y

	rgba = np.dstack([pixels, np.clip(alpha * 255, 0, 255)]).astype(np.uint8)
	OUTPUT.parent.mkdir(parents=True, exist_ok=True)
	Image.fromarray(rgba, "RGBA").save(OUTPUT, "WEBP", lossless=True, method=6)
	print(f"built {OUTPUT.relative_to(ROOT)} ({width}x{height})")


if __name__ == "__main__":
	build()
