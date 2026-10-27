"""2x masters for the art the stage shows bigger than its Figma fill, made with Real-ESRGAN
(realesr-animevideov3, the cartoon model: no halos on the flat neon/glossy art).

Need = the largest design box width x 3.2 (stage scale 1.6 at 1920x1080, DPR 2):
  win/plate        max 1159 -> 3709 px, master 1774
  win/cloud        legendary 713.5 -> 2283, master 1774
  win/jelly        legendary 467.9 -> 1497, master 1254
  win/title-mythic 568 -> 1818, master 1672
  freespins/badge  1324 -> 4237, master 1774
  freespins/cloud  1005 -> 3217, master 1774
  base/hills       the base sky + hills, 1204 design px -> 3853 (unblurred in the design), master
                   1677; built at 2560 (build-base-scene.py)
  splash/logo      the splash logo, ~650 css px = 1300 device px, master 872: the x3 model,
                   which build-logo-layers.py scales down to 2x (1744)
Not the other backdrops: at their display size the 2x versions came out 45-50 dB from a plain
resize of the master (the model mostly smooths the art's grain), so they were not worth 4x the
texture memory. The model brightens by a few levels, so each channel's mean (alpha-weighted, at the master's
size) is put back to the master's. Alpha comes through the tool unchanged in shape.

art-src/<dir>/<name>.png|webp -> art-src/<dir>/2x/<name>.png (3x for the logo, same folder) (gitignored with art-src);
build-win-screens.py / build-free-spins.py / build-logo-layers.py / build-base-scene.py prefer the 2x file when it exists.
Needs realesrgan-ncnn-vulkan (github.com/xinntao/Real-ESRGAN releases, v0.2.5.0) with its
models/ beside it, at ~/tools/realesrgan or $REALESRGAN.
    python3 apps/split-party/scripts/upscale-art.py
"""

import os
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
TOOL = Path(os.environ.get('REALESRGAN', Path.home() / 'tools' / 'realesrgan'))
ART = {'base': ['hills'], 'win': ['plate', 'cloud', 'jelly', 'title-mythic'], 'freespins': ['badge', 'cloud'], 'splash': ['logo']}
SCALE = {'splash/logo': 3}


def mean_fix(master: Image.Image, up: Image.Image) -> Image.Image:
    m = np.asarray(master, dtype=np.float64)
    u = np.asarray(up, dtype=np.float64)
    small = np.asarray(up.resize(master.size, Image.LANCZOS), dtype=np.float64)
    w = m[..., 3:4] / 255
    shift = ((small[..., :3] - m[..., :3]) * w).sum((0, 1)) / max(w.sum(), 1)
    u[..., :3] -= shift
    print('  mean shift', shift.round(2))
    return Image.fromarray(np.clip(u.round(), 0, 255).astype(np.uint8), 'RGBA')


for folder, names in ART.items():
    out = ROOT / 'art-src' / folder / '2x'
    out.mkdir(exist_ok=True)
    for name in names:
        src = next(p for p in (ROOT / 'art-src' / folder).glob(f'{name}.*') if p.suffix in ('.png', '.webp'))
        master = Image.open(src).convert('RGBA')
        x = SCALE.get(f'{folder}/{name}', 2)
        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp) / 'up.png'
            subprocess.run(
                [TOOL / 'realesrgan-ncnn-vulkan', '-i', src, '-o', raw, '-n', 'realesr-animevideov3', '-s', str(x)],
                cwd=TOOL, check=True, capture_output=True,
            )
            up = Image.open(raw).convert('RGBA')
        assert up.size == (master.width * x, master.height * x), up.size
        print(f'{folder}/{name}', master.size, '->', up.size)
        mean_fix(master, up).save(out / f'{name}.png')
