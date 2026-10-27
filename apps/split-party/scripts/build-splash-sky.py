"""The splash sky (Figma 11174:5004): the seascape painting, its jelly domes and the two islands,
rebuilt from the masters with a light blur.

The frame blurs every layer 2-2.5 design px, ~7 device px on a 1920x1080 retina screen, and the
old files were that blur baked in at 1.5 px per design px: the crisp masters read as smeared
("low quality resources" review, 2026-10-26). Now 0.6 design px of blur at 3.2 px per design px
(the painting at its master's own scale, 1.38: an upscaled master looked the same).

art-src/splash/sky.png     11174:5005 "Serene Gradient Island Seascape" (raw fill ef395, 1672x941)
art-src/splash/island.png  11174:5015/5016 "Pastel Floating Island" (raw fill 5f858, 1254)
art-src/base/dome-*.png    the jelly domes (magenta 5006-5010, green 5011-5012, purple 5013-5014)
  -> public/splash/hd/sky-bg.webp     the 1200x670 frame, the painting at its box (-4.5, -9,
                                      1209x680) as the frame places it
  -> public/splash/hd/dome-<node>.webp  the node's square plus a 12 design px margin each side
                                      (src/lib/splash-domes.json: x = node x - 12, size = box + 24)
  -> public/splash/hd/island.webp     the 93px node plus 6 px each side (Splash.svelte: 105 wide)
The loader (index.html #boot, Loading.svelte) keeps the light public/splash/sky-bg.webp.
    python3 apps/split-party/scripts/build-splash-sky.py
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'art-src'
OUT = ROOT / 'public' / 'splash' / 'hd'
K = 3.2  # px per design px (stage 1.6 at 1920x1080, DPR 2)
BLUR = 0.6  # design px
DOMES = {
    '5006': ('magenta', 186),
    '5007': ('magenta', 82),
    '5008': ('magenta', 82),
    '5009': ('magenta', 82),
    '5010': ('magenta', 82),
    '5011': ('green', 201),
    '5012': ('green', 124),
    '5013': ('purple', 168),
    '5014': ('purple', 168),
}


def save(img, name):
    img.save(OUT / f'{name}.webp', quality=90, method=6)
    print(name, img.size, (OUT / f'{name}.webp').stat().st_size // 1024, 'KB')


def framed(master, box, margin):
    """The square master at box design px, centred in a canvas `margin` design px wider each
    side, blurred premultiplied (so the transparent edge doesn't go dark)."""
    side = round((box + 2 * margin) * K)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(master.convert('RGBA').resize((round(box * K),) * 2, Image.LANCZOS), (round(margin * K),) * 2)
    px = np.asarray(canvas, dtype=np.float32)
    a = px[..., 3:4]
    pre = Image.fromarray(np.dstack([px[..., :3] * a / 255, a]).round().astype(np.uint8), 'RGBA')
    px = np.asarray(pre.filter(ImageFilter.GaussianBlur(BLUR * K)), dtype=np.float32)
    a = px[..., 3:4]
    rgb = px[..., :3] * 255 / np.maximum(a, 1)
    return Image.fromarray(np.dstack([rgb.clip(0, 255), a]).round().astype(np.uint8), 'RGBA')


OUT.mkdir(parents=True, exist_ok=True)
sky = Image.open(ART / 'splash' / 'sky.png').convert('RGB')
k = sky.width / 1209  # px per design px, the master's own
sky = sky.resize((round(1209 * k), round(680 * k)), Image.LANCZOS).filter(ImageFilter.GaussianBlur(BLUR * k))
frame = Image.new('RGB', (round(1200 * k), round(670 * k)))
frame.paste(sky, (round(-4.5 * k), round(-9 * k)))
save(frame, 'sky-bg')
masters = {c: Image.open(ART / 'base' / f'dome-{c}.png') for c in ('magenta', 'green', 'purple')}
for node, (colour, box) in DOMES.items():
    save(framed(masters[colour], box, 12), f'dome-{node}')
save(framed(Image.open(ART / 'splash' / 'island.png'), 93, 6), 'island')
