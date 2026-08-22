#!/usr/bin/env python3
"""Cut the splash screen's art out of the design's source images.

Figma **7027:12708** (splash) and **7028:15400** (loading) are the 2026-08-19 redesign: a flat
illustrated dusk park, a new THEME PARK logo, and three purple feature panels in place of the gold
marquee signs. Both screens use the SAME background image — the loading screen just multiplies it,
which is what `LoadingScreen.svelte`'s BACKDROP_LEVEL does — so it is shipped once, ungraded.

    python3 scripts/splash/build_splash_art.py

Three things are worth knowing before touching this:

* The background is already graded. The old pipeline darkened a daytime park in code; this art comes
  out of Figma at the exact exposure the splash renders at (measured: the splash applies no tint
  above y=530, only the bottom gradient `.vignette` already draws). Do NOT re-grade it.
* The three feature panels are ONE image in the design, and the three differ only by generation
  noise (mean 2/255 apart). So the middle one is cut out and the page draws it three times, the same
  way the old gold frame was used.
* Every source is an AI render with soft edges, so each piece is trimmed on its own alpha rather
  than on the node box. The Figma node boxes here are padding around the ink, not placements — the
  placements in <SplashIntro> were fitted against the design render instead.
* The background is the CLOUDLESS render of the park. Its sky is an unbroken gradient because the
  clouds are drawn separately and drift across it at runtime — see build_splash_clouds.py. The
  version with clouds painted in left almost nowhere legal to put a drifting one, since a cloud may
  not sit on top of a painted one and may not spend its whole life behind the THEME PARK lockup.
"""

from pathlib import Path

import numpy as np
from PIL import Image

APP = Path(__file__).resolve().parents[2]
SRC = Path(__file__).resolve().parent / 'source'
OUT = APP / 'static/assets/theme-park/v2/splash'

#: Alpha below this is the render's own fringe, not art.
INK = 8


def trim(image: Image.Image) -> Image.Image:
	alpha = np.asarray(image.convert('RGBA'))[..., 3]
	ys, xs = np.where(alpha > INK)
	return image.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


def save(image: Image.Image, name: str, width: int | None = None) -> None:
	if width and width != image.width:
		height = round(image.height * width / image.width)
		image = image.resize((width, height), Image.LANCZOS)
	path = OUT / name
	image.save(path, 'WEBP', quality=88, method=6)
	print(f'{name:22s} {image.size[0]:5d}x{image.size[1]:<5d} {path.stat().st_size / 1024:5.0f} kB')


def middle_card(strip: Image.Image) -> Image.Image:
	"""The centre panel of the three-up strip.

	Split by column run rather than by thirds: the panels are not evenly spaced in the render and a
	third-cut clips the neighbours' rails into the crop.
	"""
	alpha = np.asarray(strip.convert('RGBA'))[..., 3]
	filled = (alpha > INK).any(0)
	runs, start = [], None
	for index, value in enumerate(filled):
		if value and start is None:
			start = index
		if not value and start is not None:
			runs.append((start, index))
			start = None
	if start is not None:
		runs.append((start, len(filled)))
	if len(runs) != 3:
		raise SystemExit(f'expected 3 panels in the strip, found {len(runs)}')
	first, last = runs[1]
	return trim(strip.crop((first, 0, last, strip.height)))


def main() -> None:
	OUT.mkdir(parents=True, exist_ok=True)

	# Full frame, no trim and no grade — this is the whole picture on both screens.
	save(Image.open(SRC / 'park-dusk-clear.png').convert('RGB'), 'background.webp')

	# Drawn at 649 of the 1200-wide design frame, so ~1040px on a 1920 stage; 1300 leaves headroom
	# for a 2x display without shipping the 2172px master.
	save(trim(Image.open(SRC / 'logo.png').convert('RGBA')), 'logo.webp', width=1300)

	# Drawn at 242 of 1200, i.e. ~390px on a 1920 stage. Native size is already well past that.
	save(middle_card(Image.open(SRC / 'feature-cards.png').convert('RGBA')), 'feature-card.webp')


if __name__ == '__main__':
	main()
