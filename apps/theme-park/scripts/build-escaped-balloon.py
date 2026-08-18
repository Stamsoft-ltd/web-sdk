#!/usr/bin/env python3
"""Cut the single balloon that drifts up through the plaza sky out of the h3 symbol art.

The centre balloon of `symbols/h3-balloons.png` is the only one in that bunch nothing overlaps, so
it is the one shape in the project that can be lifted whole. Its knot comes with it; the string is
drawn at runtime (it has to sway, so it cannot be baked).

Symbol art is lit for the reels — a neon rim light and a hot specular — while this ends up in the
blurred backdrop plane. The rim is cropped off by the mask and the rest is toned down here rather
than at runtime, so the sprite is already sky-weight when it loads.
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "static/assets/theme-park/v2/symbols/h3-balloons.png"
OUTPUT_DIR = ROOT / "static/assets/theme-park/v2/balloon"

# Body and knot of the centre balloon, in source pixels. The ellipse sits a couple of pixels inside
# the painted edge so the neon rim — and the balloons behind it — stay outside the cut.
BODY = (151, 104, 299, 256)
KNOT = [(209, 240), (241, 240), (246, 278), (204, 278)]
# Padded well clear of the balloon: the blur below is wide enough that a tight crop would square off
# the edge against the frame. The runtime sizes against the body, not this box, so the padding costs
# nothing but a few transparent pixels — see the constants printed at the end.
CROP = (126, 78, 324, 304)

# Native width of each exported variant, chosen to keep the body at the pixel density a tight
# 132-wide crop gave it. The balloon draws at roughly 3% of canvas width, so this is already
# generous; anything larger is bytes nobody sees.
EXPORT_WIDTH = 170

# Target hues in degrees. The source balloon's body measures 332 (magenta), and the rotation below
# works in offsets off that. Picked against the backdrop art: the plaza already has pink, orange,
# yellow, green and blue balloons tied to its kiosks, and one escapee should look like it came from
# that bunch.
SOURCE_HUE = 332
VARIANTS = {
	"pink": 332,
	"orange": 28,
	"yellow": 48,
	"green": 112,
	"blue": 205,
}

# Symbol art is pitched brighter and more saturated than anything in the backdrop plane. These pull
# it back to sky weight; the runtime still fades the sprite in and out at the ends of its climb.
SATURATION = 0.86
BRIGHTNESS = 0.94
# Enough blur to seat it in the depth-of-field backdrop rather than leave it razor-sharp against
# out-of-focus art. Judged against the plaza's own painted balloon stand at the size this draws
# (~43px on a 1600-wide canvas): below about 3 the symbol's confetti speckles and hot specular
# survive the downscale and give the sprite away, and the stand behind it is softer still, so this
# sits at the top of the range where the knot and the silhouette both still read.
BLUR_RADIUS = 6.5


def cut() -> Image.Image:
	source = Image.open(SOURCE).convert("RGBA")

	mask = Image.new("L", source.size, 0)
	draw = ImageDraw.Draw(mask)
	draw.ellipse(BODY, fill=255)
	draw.polygon(KNOT, fill=255)
	# Feathered so the cut edge reads as painted rather than die-cut, then intersected with the
	# symbol's own alpha so the knot keeps its shape.
	mask = mask.filter(ImageFilter.GaussianBlur(1.2))
	alpha = np.minimum(np.asarray(source.getchannel("A")), np.asarray(mask))

	balloon = source.copy()
	balloon.putalpha(Image.fromarray(alpha))
	return balloon.crop(CROP)


def rotate_hue(image: Image.Image, degrees: int) -> Image.Image:
	if degrees == 0:
		return image
	alpha = image.getchannel("A")
	hsv = np.asarray(image.convert("RGB").convert("HSV")).astype(np.int16)
	hsv[..., 0] = (hsv[..., 0] + round(degrees * 255 / 360)) % 256
	shifted = Image.fromarray(hsv.astype(np.uint8), "HSV").convert("RGB").convert("RGBA")
	shifted.putalpha(alpha)
	return shifted


def build() -> None:
	OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
	balloon = cut()
	height = round(balloon.height * EXPORT_WIDTH / balloon.width)

	for name, hue in VARIANTS.items():
		variant = rotate_hue(balloon, (hue - SOURCE_HUE) % 360)
		variant = variant.resize((EXPORT_WIDTH, height), Image.Resampling.LANCZOS)

		# Enhance() would fold the transparent pixels' colour into the edge, so keep alpha aside.
		alpha = variant.getchannel("A")
		rgb = variant.convert("RGB")
		rgb = ImageEnhance.Color(rgb).enhance(SATURATION)
		rgb = ImageEnhance.Brightness(rgb).enhance(BRIGHTNESS)
		variant = rgb.convert("RGBA")
		variant.putalpha(alpha)
		variant = variant.filter(ImageFilter.GaussianBlur(BLUR_RADIUS))

		destination = OUTPUT_DIR / f"{name}.webp"
		variant.save(destination, "WEBP", quality=92, method=6)
		print(f"{destination.relative_to(ROOT)}  {variant.width}x{variant.height}")

	# <EscapedBalloon> sizes and hangs the string off the painted body, not off this box, so that
	# re-cropping or re-blurring here does not silently resize the balloon on screen.
	print("\nEscapedBalloon.svelte:")
	print(f"  SPRITE_ASPECT = {EXPORT_WIDTH} / {height};")
	print(f"  BODY_ASPECT = {BODY[2] - BODY[0]} / {BODY[3] - BODY[1]};")
	print(f"  BODY_SHARE = {(BODY[2] - BODY[0]) / (CROP[2] - CROP[0]):.4f};")
	print(f"  KNOT_SHARE = {(KNOT[2][1] - CROP[1]) / (CROP[3] - CROP[1]):.4f};")


if __name__ == "__main__":
	build()
