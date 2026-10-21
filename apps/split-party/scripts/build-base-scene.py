"""Base-game scene layers (Figma 11195:8973) for BaseScene.svelte.

art-src/base/*.png (Figma image fills, untouched)
  hills.png         11195:8974  the sky + rolling hills, full frame
  seascape.png      11195:9215 / 9216  the island seascape; the frame uses it twice (one mirrored)
  dome-*.png        11195:8975..8980  the jelly domes along the bottom (1254 square, the dome
                    sits in y 32-68% of it)
  -> public/base/hills.webp, seascape.webp, dome-*.webp (+ dome-*-small.webp for small domes)
  -> public/base/seascape-front.webp  the island (bushes, grass, rock, and the water below it)
                    cut out of seascape.webp, drawn over the blobs that peek out from behind it

Only a touch of blur is baked in, close to the frame's own (it blurs the seascapes and domes
by 2px, the hills not at all), and the colours get a saturation/contrast lift (GRADE): the
earlier heavy soft-focus pass made the backdrop read as a different, painterly style next to
the crisp, glossy board and blobs. BLUR is in design px, baked at each image's own scale so
the page doesn't run CSS filters. Written to public/base/crisp/ (new paths: browsers kept the
soft art under the old ones). Domes are cropped to CROP (the same
box for all three), which BaseScene.svelte mirrors when it places them.
    python3 apps/split-party/scripts/build-base-scene.py
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'art-src' / 'base'
OUT = ROOT / 'public' / 'base' / 'crisp'
# Fractions of the dome square kept: x0, y0, x1, y1 (the art spans x 7.6-92%, y 32.2-68.3%).
CROP = (0.06, 0.3, 0.94, 0.7)
DOME_W = 560  # px; the largest dome is ~177 design px wide after the crop
SEASCAPE_DESIGN_W = 772  # 11195:9215's width in the frame
BLUR = {'hills': 1.0, 'seascape': 2.0, 'dome': 1.5}
GRADE = {'saturation': 1.18, 'contrast': 1.06}


def grade(img):
    """Saturation/contrast lift on the colour only; alpha is kept."""
    rgb = ImageEnhance.Contrast(ImageEnhance.Color(img.convert('RGB')).enhance(GRADE['saturation'])).enhance(GRADE['contrast'])
    if img.mode != 'RGBA':
        return rgb
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


OUT.mkdir(exist_ok=True)
hills = grade(Image.open(SRC / 'hills.png').convert('RGBA'))
save(blur(hills, 1204, BLUR['hills']).convert('RGB'), 'hills')
sea = grade(Image.open(SRC / 'seascape.png').convert('RGBA'))
sea_out = blur(sea, SEASCAPE_DESIGN_W, BLUR['seascape']).resize((1544, round(1544 * sea.height / sea.width)), Image.LANCZOS)
save(sea_out, 'seascape')
# Island front: per column over the island (x 58-99.5%), everything from the top of its green
# (the bushes and grass; the mountains behind are blue/purple) down is in front.
px = np.asarray(sea).astype(int)
r, g, b, al = (px[..., i] for i in range(4))
green = (al > 200) & (g > r + 15) & (g > b + 15)
front = np.zeros(al.shape, bool)
h, w = al.shape
for x in range(int(0.58 * w), int(0.995 * w)):
    ys = np.nonzero(green[:, x])[0]
    if len(ys):
        front[ys.min():, x] = True
mask = Image.fromarray((front * 255).astype(np.uint8))
# Same soft edge as the blurred art, then scaled like seascape.webp.
mask = mask.filter(ImageFilter.GaussianBlur(BLUR['seascape'] * w / SEASCAPE_DESIGN_W)).resize(sea_out.size, Image.LANCZOS)
cut = sea_out.copy()
cut.putalpha(Image.fromarray((np.asarray(sea_out)[..., 3].astype(float) * np.asarray(mask) / 255).astype(np.uint8)))
save(cut.crop((int(0.5 * cut.width), 0, cut.width, cut.height)), 'seascape-front')
for name in ('dome-magenta', 'dome-green', 'dome-purple'):
    dome = grade(Image.open(SRC / f'{name}.png').convert('RGBA'))
    s = dome.width
    dome = dome.crop(tuple(round(f * s) for f in CROP))
    dome = dome.resize((DOME_W, round(DOME_W * dome.height / dome.width)), Image.LANCZOS)
    # Sized for the largest dome (201 design px).
    save(blur(dome, 201 * (CROP[2] - CROP[0]), BLUR['dome']), name)
    # The small domes (54-90 px) drawn from that would come out nearly sharp, since the baked
    # blur shrinks with the image: they get their own copy, blurred for a ~72px dome.
    small = dome.resize((280, round(280 * dome.height / dome.width)), Image.LANCZOS)
    save(blur(small, 72 * (CROP[2] - CROP[0]), BLUR['dome']), f'{name}-small')
