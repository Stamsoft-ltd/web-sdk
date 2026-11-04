"""Splash cards v2 (user's art, 2026-11-04): the card frame and the English card titles.

art-src/splash/v2/panel.png         the card frame, 990x1478 (kept whole: its rim is the box)
  -> public/splash/v2/panel.webp    native size, ~3.6x the 273x410 card
art-src/splash/v2/title-split.png   SPLIT FOR / BIGGER WINS   (cropped to the lettering)
                 title-max.png     MAX / WIN
                 title-bonus.png   THREE / BONUS MODES
                 max-20000.png     20'000X
  -> public/splash/v2/<name>.webp   3x their display width on the card (WIDTH), never upscaled
The lettering is English: Splash.svelte shows it only for the English locale and keeps the live
JellyText titles for every other language.
    python3 apps/split-party/scripts/build-splash-cards.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'art-src' / 'splash' / 'v2'
OUT = ROOT / 'public' / 'splash' / 'v2'
# Display width on the 273px card, css px (Splash.svelte .card-art boxes).
WIDTH = {'title-split': 214, 'title-max': 132, 'title-bonus': 226, 'max-20000': 206}


def main():
	OUT.mkdir(parents=True, exist_ok=True)
	panel = Image.open(SRC / 'panel.png').convert('RGBA')
	panel.save(OUT / 'panel.webp', quality=92, alpha_quality=100, method=6)
	print('panel', panel.size)
	for name, w in WIDTH.items():
		im = Image.open(SRC / f'{name}.png').convert('RGBA')
		im = im.crop(im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox())
		px = min(im.width, w * 3)
		out = im.resize((px, round(im.height * px / im.width)), Image.LANCZOS)
		out.save(OUT / f'{name}.webp', quality=92, alpha_quality=100, method=6)
		print(name, out.size, f'display {w}x{w * im.height / im.width:.1f}')


main()
