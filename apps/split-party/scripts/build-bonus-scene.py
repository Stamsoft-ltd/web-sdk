"""Bonus scene layers for BonusNormal.svelte and BonusSuper.svelte.

Normal bonus: Figma 11174:5578 ("Background 22").

art-src/bonus/*.png (Figma image fills, untouched)
  sunset.png        11174:5579  the sky, sun and pink hills, full frame
  cloud.png         11174:5580..5582  the pink cloud (used three times)
  cliff.png         11174:5583..5585  the candy cliff with lime slime (used three times, two mirrored)
  dome-*.png        11174:5586..5592  the blue / green / magenta jelly domes (1254 square, the dome
                    sits in y 32-68% of it)
  -> public/bonus/normal/*.webp

Super bonus: Figma 11174:5079 ("Background 18"); it reuses the cloud and the blue and magenta
domes from art-src/bonus.
art-src/bonus-super/*.png
  arches.png        11174:5080  the sunset arches over calm water, full frame
  island.png        11174:5083 / 5553  the floating melting-jelly island (1254 square)
  water.png         11174:5084 / 5085  the pink-purple sheen lying on the water
  dome-purple.png   11174:5081  the purple jelly dome
  -> public/bonus/super/*.webp

Blurred like the base scene (build-base-scene.py): the frame blurs every layer 2-2.5px, which
is 6-8 device px on a 1920x1080 retina screen and smeared the crisp masters (the "low quality
resources" review, 2026-10-26), so only 0.6 design px is baked in, at each image's own scale.
Sizes are 3.2x design px (stage 1.6 at 1920x1080, DPR 2), capped at each master's own (an
upscaled master looked the same at display size, see upscale-art.py). Written to */hd/. Small copies (-small) exist where one source is drawn at very different sizes, since the
baked blur shrinks with the image.
    python3 apps/split-party/scripts/build-bonus-scene.py
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'art-src' / 'bonus'
OUT = ROOT / 'public' / 'bonus' / 'normal' / 'hd'
# Fractions of the dome square kept: x0, y0, x1, y1 (the art spans x 8-92%, y 32-68%).
CROP = (0.06, 0.3, 0.94, 0.7)
# Close to the frames' own light blur, plus the base scene's colour lift (build-base-scene.py):
# the earlier heavy soft focus read as a painterly style next to the crisp, glossy board.
# Written to */crisp/ (new paths: browsers kept the soft art under the old ones). The clouds
# are drawn by build-puff-clouds.py.
BLUR = {'sunset': 0.6, 'water': 0.6, 'cliff': 0.6, 'dome': 0.6, 'island': 0.6}
K = 3.2  # px per design px
GRADE = {'saturation': 1.18, 'contrast': 1.06}


def grade(img):
    """Saturation/contrast lift on the colour only; alpha is kept."""
    rgb = ImageEnhance.Contrast(ImageEnhance.Color(img.convert('RGB')).enhance(GRADE['saturation'])).enhance(GRADE['contrast'])
    rgb.putalpha(img.getchannel('A'))
    return rgb


def save(img, name):
    img.save(OUT / f'{name}.webp', quality=90, method=6)
    print(name, img.size, f'{(OUT / f"{name}.webp").stat().st_size // 1024} KB')


def blur(img, design_w, sigma):
    """Gaussian blur of sigma design px, premultiplied so the transparent edge doesn't go dark."""
    px = np.asarray(img, dtype=np.float32)
    a = px[..., 3:4]
    pre = Image.fromarray(np.dstack([px[..., :3] * a / 255, a]).round().astype(np.uint8), 'RGBA')
    px = np.asarray(pre.filter(ImageFilter.GaussianBlur(sigma * img.width / design_w)), dtype=np.float32)
    a = px[..., 3:4]
    rgb = px[..., :3] * 255 / np.maximum(a, 1)
    return Image.fromarray(np.dstack([rgb.clip(0, 255), a]).round().astype(np.uint8), 'RGBA')


def master(folder, name):
    return Image.open(folder / f'{name}.png')


def sized(img, w):
    w = min(w, img.width)
    return img.resize((w, round(w * img.height / img.width)), Image.LANCZOS)


OUT.mkdir(parents=True, exist_ok=True)
sunset = grade(master(SRC, 'sunset').convert('RGBA'))
save(blur(sunset, 1260, BLUR['sunset']).convert('RGB'), 'sunset')
cliff = grade(master(SRC, 'cliff').convert('RGBA'))
# Big for the two tall cliffs (356 / 408 px), small for the 207px one.
save(blur(sized(cliff, round(K * 408)), 408, BLUR['cliff']), 'cliff')
save(blur(sized(cliff, round(K * 207)), 207, BLUR['cliff']), 'cliff-small')
# Each colour at K x its largest use, plus a small copy where it is also drawn small.
# Drawn at half the frame's dome sizes (BonusNormal DOME_SCALE).
DOMES = {'dome-blue': (145, 70), 'dome-green': (158, 75), 'dome-magenta': (255, None)}
for name, (big, small) in DOMES.items():
    dome = grade(Image.open(SRC / f'{name}.png').convert('RGBA'))
    s = dome.width
    dome = dome.crop(tuple(round(f * s) for f in CROP))
    w = CROP[2] - CROP[0]
    save(blur(sized(dome, round(K * big * w)), big * w, BLUR['dome']), name)
    if small:
        save(blur(sized(dome, round(K * small * w)), small * w, BLUR['dome']), f'{name}-small')

# Super bonus.
SUPER = ROOT / 'art-src' / 'bonus-super'
OUT = ROOT / 'public' / 'bonus' / 'super' / 'hd'
OUT.mkdir(parents=True, exist_ok=True)
arches = grade(master(SUPER, 'arches').convert('RGBA'))
save(blur(arches, 1202, BLUR['sunset']).convert('RGB'), 'arches')
# The islands fly in front of the sky, K x their 142px.
save(blur(sized(grade(Image.open(SUPER / 'island.png').convert('RGBA')), round(K * 142)), 142, BLUR['island']), 'island')
water = grade(master(SUPER, 'water').convert('RGBA'))
save(blur(sized(water, round(K * 675)), 675, BLUR['water']), 'water')
save(blur(sized(water, round(K * 343)), 343, BLUR['water']), 'water-small')
# Half the frame's dome sizes (BonusSuper DOME_SCALE).
for src, name, size in (
    (SUPER / 'dome-purple.png', 'dome-purple', 159),
    (SRC / 'dome-magenta.png', 'dome-magenta', 86),
    (SRC / 'dome-blue.png', 'dome-blue', 282),
):
    dome = grade(Image.open(src).convert('RGBA'))
    s = dome.width
    dome = dome.crop(tuple(round(f * s) for f in CROP))
    w = CROP[2] - CROP[0]
    save(blur(sized(dome, round(K * size * w)), size * w, BLUR['dome']), name)
