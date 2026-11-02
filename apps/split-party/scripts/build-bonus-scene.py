"""Bonus scene layers for BonusNormal.svelte and BonusSuper.svelte.

Normal bonus: Figma 11362:72643 (2026-10-29; it was 11174:5578's sunset, cliffs and domes),
art-src/bonus/normal-v2/*.png, see below. art-src/bonus/dome-blue.png (a 1254 square, the dome
in y 32-68% of it) is the Super bonus's dome; the old cliff/sunset/dome sources stay in art-src.

Super bonus: Figma 11300:27276 (2026-10-29; it was 11174:5079's arches over water).
art-src/bonus-super/dunes.png  11346:48354  the pink sunset dunes, full frame
  + the normal-v2 cloud and art-src/bonus/dome-blue.png -> public/bonus/super/hd/*.webp

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
# 0.3 since 2026-11-02 (quality pass: at 0.6 the cut-outs measured 4-7x softer than the crisp
# symbols and logo beside them).
BLUR = {'sunset': 0.3, 'water': 0.3, 'cliff': 0.3, 'dome': 0.3, 'island': 0.3}
K = 3.2  # px per design px
# Width caps on the big layers' textures (GPU memory): full-frame paintings, and the wide strips.
FULL_W = 2560
STRIP_W = 3072
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
    """The Real-ESRGAN 2x master when there is one (upscale-art.py), else the Figma fill."""
    hd = folder / '2x' / f'{name}.png'
    return Image.open(hd if hd.exists() else folder / f'{name}.png')


def sized(img, w):
    w = min(w, img.width)
    return img.resize((w, round(w * img.height / img.width)), Image.LANCZOS)


OUT.mkdir(parents=True, exist_ok=True)
# The normal bonus redrawn (Figma 11362:72643, 2026-10-29): a gradient sky (drawn live), the
# blob house, the rolling hills, two pink clouds and the dunes, replacing the sunset, cliffs and
# domes. art-src/bonus/normal-v2/*.png, the frame's image fills:
#   hills.png  11362:72645 (194, 248, 1023x342)   house.png 11362:72646 (-56, 102, 369x379)
#   cloud.png  11362:72647 / 72648 (297x99, 60%)  dunes.png 11362:72649 (-209, 315, 1497x500)
V2 = ROOT / 'art-src' / 'bonus' / 'normal-v2'
for name, design_w in (('hills', 1023), ('house', 369), ('cloud', 297), ('dunes', 1497)):
    img = grade(master(V2, name).convert('RGBA'))
    save(blur(sized(img, min(STRIP_W, round(K * design_w))), design_w, BLUR['sunset']), name)

# Super bonus.
SUPER = ROOT / 'art-src' / 'bonus-super'
OUT = ROOT / 'public' / 'bonus' / 'super' / 'hd'
OUT.mkdir(parents=True, exist_ok=True)
# Redrawn 2026-10-29 as Figma 11300:27276: one painting, dunes.png (11346:48354, opaque), plus
# the normal-v2 cloud and the blue dome (11300:27289 = art-src/bonus/dome-blue.png).
dunes = grade(master(SUPER, 'dunes').convert('RGBA'))
save(blur(sized(dunes, min(FULL_W, round(K * 1200))), 1185, BLUR['sunset']).convert('RGB'), 'dunes')
# Half the frame's dome sizes (BonusSuper DOME_SCALE).
# The blue dome at the frame's 133px (it was drawn at half of 563).
dome = grade(Image.open(SRC / 'dome-blue.png').convert('RGBA'))
s = dome.width
dome = dome.crop(tuple(round(f * s) for f in CROP))
w = CROP[2] - CROP[0]
save(blur(sized(dome, round(K * 133 * w)), 133 * w, BLUR['dome']), 'dome-blue')

# Hidden bonus: Figma 11174:6525 ("Hidden"), the neon blue cavern (user, 2026-10-27; it had
# been the Super world at night). art-src/bonus/hidden/*.png, the frame's image fills:
#   cavern.png   11174:6526  the cavern and its glowing floor, full frame
#   mound-a.png  11174:6527 / 6536  the light indigo mound;  mound-b.png 11174:6538 the dark one;
#   mound-c.png  11174:6541  the tall dark mound (drawn squashed, 551x435)
#   gem.png      11174:6535  the cyan jelly gem;  dome.png 11174:6537 / 6539 / 6540 the magenta dome
# Kept as the frame's squares (no dome crop), so the Figma boxes place them as they are.
HIDDEN = ROOT / 'art-src' / 'bonus' / 'hidden'
OUT = ROOT / 'public' / 'bonus' / 'hidden' / 'hd'
OUT.mkdir(parents=True, exist_ok=True)
cavern = grade(master(HIDDEN, 'cavern').convert('RGBA'))
save(blur(sized(cavern, FULL_W), 1235, BLUR['sunset']).convert('RGB'), 'cavern')
for name, size in (('mound-a', 432), ('mound-b', 551), ('gem', 229), ('dome', 314)):
    img = grade(master(HIDDEN, name).convert('RGBA'))
    save(blur(sized(img, round(K * size)), size, BLUR['dome']), name)
