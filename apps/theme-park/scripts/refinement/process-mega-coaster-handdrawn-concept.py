#!/usr/bin/env python3
"""Prepare the staged hand-drawn Mega Coaster cart/duck concept for review."""

from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


APP = Path(__file__).resolve().parents[2]
ART = APP / "art" / "concepts"
OUTPUT = APP / "source-assets-unused/assets/theme-park/coaster-vomit-handdrawn"
PREVIEW = APP / "art" / "previews" / "mega-coaster-handdrawn-key-poses-v1.png"


def clean_transparent(image: Image.Image) -> Image.Image:
	pixels = np.asarray(image.convert("RGBA")).copy()
	pixels[pixels[:, :, 3] == 0, :3] = 0
	return Image.fromarray(pixels, "RGBA")


def matte_checker(image: Image.Image) -> Image.Image:
	"""Remove only border-connected pale neutral checker pixels."""
	rgb = np.asarray(image.convert("RGB"), dtype=np.uint8)
	hi = rgb.max(axis=2).astype(np.int16)
	lo = rgb.min(axis=2).astype(np.int16)
	candidate = (lo >= 218) & ((hi - lo) <= 28)
	height, width = candidate.shape
	background = np.zeros((height, width), dtype=bool)
	queue: deque[tuple[int, int]] = deque()

	def seed(x: int, y: int) -> None:
		if candidate[y, x] and not background[y, x]:
			background[y, x] = True
			queue.append((x, y))

	for x in range(width):
		seed(x, 0)
		seed(x, height - 1)
	for y in range(height):
		seed(0, y)
		seed(width - 1, y)
	while queue:
		x, y = queue.popleft()
		for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
			if 0 <= nx < width and 0 <= ny < height and candidate[ny, nx] and not background[ny, nx]:
				background[ny, nx] = True
				queue.append((nx, ny))
	alpha = Image.fromarray((~background).astype(np.uint8) * 255, "L")
	alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.55))
	rgba = image.convert("RGBA")
	rgba.putalpha(alpha)
	return clean_transparent(rgba)


def extract_cart(image: Image.Image) -> Image.Image:
	"""Remove the pale concept backdrop without modifying the authored black contour."""
	rgba = matte_checker(image)
	bbox = rgba.getchannel("A").point(lambda value: 255 if value > 20 else 0).getbbox()
	if bbox is None:
		raise ValueError("Empty hand-drawn Mega Coaster cart")
	return clean_transparent(rgba.crop(bbox))


def split_duck_keys(image: Image.Image) -> list[Image.Image]:
	matte = matte_checker(image)
	frames: list[Image.Image] = []
	for index in range(8):
		row, column = divmod(index, 4)
		x0 = round(column * matte.width / 4) + 3
		x1 = round((column + 1) * matte.width / 4) - 3
		y0 = round(row * matte.height / 2) + 3
		y1 = round((row + 1) * matte.height / 2) - 3
		frames.append(matte.crop((x0, y0, x1, y1)))
	return frames


def contain(image: Image.Image, size: tuple[int, int]) -> Image.Image:
	result = Image.new("RGBA", size)
	copy = image.copy()
	copy.thumbnail(size, Image.Resampling.LANCZOS)
	result.alpha_composite(copy, ((size[0] - copy.width) // 2, size[1] - copy.height))
	return result


def front_cart_layer(cart: Image.Image) -> Image.Image:
	"""Body and wheel remain in front; seat back remains behind the duck."""
	pixels = np.asarray(cart.convert("RGBA")).copy()
	y, x = np.ogrid[: cart.height, : cart.width]
	front = (y >= round(cart.height * 0.43)) | (
		(x >= round(cart.width * 0.57))
		& (x <= round(cart.width * 0.76))
		& (y >= round(cart.height * 0.16))
		& (y <= round(cart.height * 0.52))
	)
	pixels[~front] = 0
	return Image.fromarray(pixels, "RGBA")


def composite(cart: Image.Image, duck: Image.Image) -> Image.Image:
	canvas = Image.new("RGBA", (640, 400))
	cart_fit = contain(cart, (580, 280))
	cart_x, cart_y = 30, 105
	canvas.alpha_composite(cart_fit, (cart_x, cart_y))
	duck_bbox = duck.getchannel("A").point(lambda value: 255 if value > 20 else 0).getbbox()
	if duck_bbox is None:
		raise ValueError("Empty hand-drawn Mega Coaster duck")
	duck_fit = contain(duck.crop(duck_bbox), (250, 250))
	canvas.alpha_composite(duck_fit, (150, 64))
	canvas.alpha_composite(front_cart_layer(cart_fit), (cart_x, cart_y))
	return canvas


def main() -> None:
	OUTPUT.mkdir(parents=True, exist_ok=True)
	cart = extract_cart(Image.open(ART / "mega-coaster-handdrawn-empty-cart-v2.png"))
	cart.save(OUTPUT / "empty-cart.png", optimize=True)
	ducks = split_duck_keys(Image.open(ART / "mega-coaster-handdrawn-duck-keys-v1.png"))
	for index, duck in enumerate(ducks):
		clean_transparent(duck).save(OUTPUT / f"duck-key-{index:02d}.png", optimize=True)
	selected = (0, 3, 4, 5, 6, 7)
	preview = Image.new("RGBA", (640 * 3, 400 * 2))
	for cell, index in enumerate(selected):
		preview.alpha_composite(composite(cart, ducks[index]), ((cell % 3) * 640, (cell // 3) * 400))
	PREVIEW.parent.mkdir(parents=True, exist_ok=True)
	preview.save(PREVIEW, optimize=True)
	print(PREVIEW)


if __name__ == "__main__":
	main()
