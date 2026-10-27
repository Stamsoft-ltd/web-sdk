"""Big-win screen art (Figma 11008:29395 sweet, 11008:29897 wild, 9034:25341 epic,
11008:29144 mythic, 11008:29646 legendary, 11008:30148 max) for WinScreen.svelte.

art-src/win/*.png  the Figma image fills, untouched
  plate.png         the neon plate (Neon Purple Sci-Fi UI Badge 2; MAX's Badge 1 is the same art)
  cloud.png         the purple cloud on the plate (Glossy Purple Cloud Plaque 2; not on MAX)
  jelly.png         the big pink jelly bubbles behind the plaque (Glossy Pink Jelly Bubble 6/7)
  plaque.png        the old slime plaque with its balloons baked in (no longer built)
  bubble.png        the purple bubble (11008:29321 and its copies; BonusCard's flyers)
  drip-4.png        the long slime drip (the right drip, rotated, and the amount box's corner drip)
  drip-5.png        the short slime splat (the left drip)
  title-<tier>.png  the tier word; win-<tier>.png the WIN word
  sym-*.png         the happy blobs peeking out
  2x/<name>.png     Real-ESRGAN 2x of plate, cloud, jelly, title-mythic (upscale-art.py), used
                    in place of the master when present
  -> public/win/hd/*.webp, same canvases (only scaled), so the design's crop percentages hold.
    (hd/: new folder rather than new contents, browsers keep the old art under the old names)
    python3 apps/split-party/scripts/build-win-screens.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'art-src' / 'win'
OUT = ROOT / 'public' / 'win' / 'hd'
# Max width per file: its largest design width x 3.2 (stage scale 1.6 at 1920x1080, DPR 2);
# the plate (max 1159 -> 3709) is capped by its 2x master. The old plaque is replaced by
# plate + cloud.
WIDTH = {'plate': 3548, 'cloud': 2284, 'jelly': 1500, 'title-mythic': 1820, 'bubble': 700, 'drip-4': 700, 'drip-5': 700}
SKIP = {'plaque'}
OUT.mkdir(parents=True, exist_ok=True)
for src in sorted(SRC.glob('*.png')):
    name = src.stem
    if name in SKIP:
        continue
    w = WIDTH.get(name, 2400 if name.startswith('title') else 1800 if name.startswith('win') else 850)
    hd = SRC / '2x' / src.name
    im = Image.open(hd if hd.exists() else src).convert('RGBA')
    if im.width > w:
        im = im.resize((w, round(w * im.height / im.width)), Image.LANCZOS)
    im.save(OUT / f'{name}.webp', quality=90, method=6)
    print(name, im.size, (OUT / f'{name}.webp').stat().st_size // 1024, 'KB')
