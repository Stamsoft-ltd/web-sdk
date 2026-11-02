"""Base-game scene layers (Figma 11195:8973) for BaseScene.svelte.

art-src/base/*.png (Figma image fills, untouched)
  hills.png         11195:8974  the sky + rolling hills, full frame
  far-hills.png water.png volcano.png dome-hill.png island.png boat.png
                    11362:70545's split backdrop (2026-10-29): the old seascape as layers, the
                    volcano, and the sailboat that crosses the water
  dome-*.png        11195:8975..8980  the jelly domes along the bottom (1254 square, the dome
                    sits in y 32-68% of it)
  -> public/base/hd/hills.webp, far-hills.webp, water-clear.webp, volcano.webp, volcano-lava.webp, volcano-flow.webp, dome-hill.webp, island.webp,
     boat.webp, dome-*.webp (+ dome-*-small.webp for small domes)

Only a touch of blur is baked in, well under the frame's own (it blurs the seascapes and domes
by 2px, the hills not at all): 2 design px is ~6 device px on a 1920x1080 retina screen, which
smeared the crisp masters into what reviewers called low quality (2026-10-26), so 0.6 keeps
just a hint of depth behind the board, and the colours get a saturation/contrast lift (GRADE): the
earlier heavy soft-focus pass made the backdrop read as a different, painterly style next to
the crisp, glossy board and blobs. BLUR is in design px, baked at each image's own scale so
the page doesn't run CSS filters. Written to public/base/crisp/ (new paths: browsers kept the
soft art under the old ones), now public/base/hd/. The hills are shown ~2.4x their master's
size on a 1920x1080 retina screen, so they come from art-src/base/2x/hills.png (Real-ESRGAN,
upscale-art.py) when present, at HILLS_W: past that the texture memory buys little. Domes are cropped to CROP (the same
box for all three), which BaseScene.svelte mirrors when it places them.
    python3 apps/split-party/scripts/build-base-scene.py
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'art-src' / 'base'
OUT = ROOT / 'public' / 'base' / 'hd'
# Fractions of the dome square kept: x0, y0, x1, y1 (the art spans x 7.6-92%, y 32.2-68.3%).
CROP = (0.06, 0.3, 0.94, 0.7)
DOME_W = 560  # px; the largest dome is ~177 design px wide after the crop
HILLS_W = 2560  # px; the master is 1677, its 2x 3354
# 0.3 since 2026-11-02 (quality pass; see build-bonus-scene.py).
BLUR = {'seascape': 0.3, 'dome': 0.3}
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


def master(name):
    hd = SRC / '2x' / f'{name}.png'
    return Image.open(hd if hd.exists() else SRC / f'{name}.png')


hills = master('hills').convert('RGB')
save(grade(hills.resize((HILLS_W, round(HILLS_W * hills.height / hills.width)), Image.LANCZOS)), 'hills')
# The 2026-10-29 split backdrop (Figma 11362:70545, the volcano version of 11358:69542): the
# seascape became separate layers, drawn at (x, y, w, h) design px in the frame, plus a
# sailboat. Same grade and depth blur as the old seascape, sized for ~3.2 device px per design
# px (capped at the master's own width). crop: the share of the image's width the frame shows
# (the far hills' box is 1011 wide over a 1200-wide image, cut off where the volcano stands).
for name, design_w, crop in (
    ('far-hills', 1011, 1 / 1.1869),  # 11362:70615 at (0, 68, 1011, 400), image 118.69% wide
    ('dome-hill', 267, 1),  # 11362:70936 at (814, 268, 267, 117)
    ('island', 362, 1),  # 11362:70732 at (900, 268, 362, 181)
    ('boat', 77, 1),  # 11362:70765 at (-3, 341, 77, 67)
):
    img = master(name).convert('RGBA')
    img = grade(img.crop((0, 0, round(img.width * crop), img.height)))
    w = min(img.width, round(design_w * 3.2))
    save(blur(img, design_w, BLUR['seascape']).resize((w, round(w * img.height / img.width)), Image.LANCZOS), name)


def pushpull(rgb, known):
    """Fills the unknown pixels smoothly from the known ones (a push-pull pyramid)."""
    levels = [(rgb * known[..., None], known.astype(np.float32))]
    while levels[-1][1].shape[0] > 4:
        c, w = levels[-1]
        h, wd = w.shape[0] // 2 * 2, w.shape[1] // 2 * 2
        c, w = c[:h, :wd], w[:h, :wd]
        levels.append((c[0::2, 0::2] + c[1::2, 0::2] + c[0::2, 1::2] + c[1::2, 1::2], w[0::2, 0::2] + w[1::2, 0::2] + w[0::2, 1::2] + w[1::2, 1::2]))
    c, w = levels[-1]
    est = c / np.maximum(w, 1e-6)[..., None]
    for c, w in reversed(levels[:-1]):
        size = w.shape[::-1]
        up = np.dstack([np.asarray(Image.fromarray(est[..., i].astype(np.float32)).resize(size, Image.BILINEAR)) for i in range(3)])
        a = np.clip(w, 0, 1)[..., None]
        est = c / np.maximum(w, 1e-6)[..., None] * a + up * (1 - a)
    return est


# The volcano with its painted lava taken off (2026-10-29, "now there is NO animation at all ..
# remove the static part of the image"): the lava and its warm rim are filled in from the rock
# round them, so SceneView's lava can draw itself on bare rock, its drips growing and
# shrinking. 11362:70935 at (912, 92, 329, 329).
volcano = Image.open(SRC / 'volcano.png').convert('RGBA')
va = np.asarray(volcano).astype(np.float32)
hot = np.clip((va[..., 0] - va[..., 2] - 70) / 70, 0, 1) > 0.02
near = np.asarray(Image.fromarray((hot * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(41))) > 0
hole = Image.fromarray(((hot | (near & (va[..., 0] - va[..., 2] > 15))) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(11))
rock = pushpull(va[..., :3], (np.asarray(hole) == 0) & (va[..., 3] > 250))
rock = np.asarray(Image.fromarray(rock.clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2)), np.float32)
soft = np.asarray(hole.filter(ImageFilter.GaussianBlur(3)), np.float32)[..., None] / 255
va[..., :3] = va[..., :3] * (1 - soft) + rock * soft
bare = grade(Image.fromarray(va.round().astype(np.uint8), 'RGBA'))
save(blur(bare, 329, BLUR['seascape']).resize((1053, 1053), Image.LANCZOS), 'volcano')
# The volcano's lava on its own (2026-10-29), for SceneView's Lava: the volcano's hot pixels
# (red well over blue: the crater's red-yellow and the orange streams), alpha by how hot, over
# the same grade, blur and size as volcano.webp so it lies exactly on it. Saved raw here for
# the flow map and the gloss below, then again with the gloss baked on.
lava = Image.open(SRC / 'volcano.png').convert('RGBA')
la = np.asarray(lava).astype(np.float32)
hot = np.clip((la[..., 0] - la[..., 2] - 70) / 70, 0, 1)
la[..., 3] *= hot
lava = grade(Image.fromarray(la.astype(np.uint8), 'RGBA'))
save(blur(lava, 329, BLUR['seascape']).resize((1053, 1053), Image.LANCZOS), 'volcano-lava')


def bfs(inside, seeds):
    """Steps (4-connected) from the seeds, walking only through `inside`; -1 where unreached."""
    from collections import deque
    h, w = inside.shape
    d = np.full((h, w), -1, np.int32)
    q = deque()
    for y, x in zip(*np.nonzero(seeds)):
        d[y, x] = 0
        q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and inside[ny, nx] and d[ny, nx] < 0:
                d[ny, nx] = d[y, x] + 1
                q.append((ny, nx))
    return d


# Its flow map, for SceneView's LavaFilter, at a quarter of volcano-lava's size: R how far down
# its own stream (0 in the crater's pool, 1 at that stream's tip: each drip grows and shrinks
# over its own length), G how deep inside a stream (0 at its edge, 1 from ~6 design px in: the
# molten core vs the cooled crust, and the drips' round tips), B the stream's phase (so the
# three drips never move in step). Spread past the lava's edge so the filter's linear sampling
# doesn't pull in black.
FLOW = 263
la = np.asarray(Image.open(OUT / 'volcano-lava.webp').resize((FLOW, FLOW), Image.BILINEAR))[..., 3] > 60
crater = la.copy()
crater[round(FLOW * 0.3) :] = False  # the crater's pool: the lava's top rows (y < 30%)
down = bfs(la, crater).astype(np.float32)
down_max = max(1, down.max())
down = np.where(down < 0, 0, down / down_max)
edge = bfs(np.ones_like(la), ~la).astype(np.float32)
core = np.clip(edge / (6 * FLOW / 329), 0, 1)
# The streams: the lava past POOL steps from the crater, apart from each other (left, the short
# middle drip, right), each measured over its own length.
POOL = 12
streams = la & (down * down_max > POOL)
label = np.zeros(la.shape, np.int32)
for y, x in zip(*np.nonzero(streams)):
    if label[y, x]:
        continue
    label[y, x] = label.max() + 1
    todo = [(y, x)]
    while todo:
        a, b = todo.pop()
        for c, e in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
            if 0 <= c < FLOW and 0 <= e < FLOW and streams[c, e] and not label[c, e]:
                label[c, e] = label[y, x]
                todo.append((c, e))
frac = np.zeros_like(down)
phase = np.zeros_like(down)
for i, ph in zip(range(1, label.max() + 1), (0.0, 0.37, 0.71, 0.18, 0.55, 0.88)):
    m = label == i
    d = down[m] * down_max - POOL
    frac[m] = d / max(1, d.max())
    phase[m] = ph
stream_down = down  # the gloss below fades in along the whole lava's length
down = frac
noise = phase
grow = la.copy()
for _ in range(4):  # bleed R and B outward a few px
    g = np.pad(grow, 1)
    nb = g[:-2, 1:-1] | g[2:, 1:-1] | g[1:-1, :-2] | g[1:-1, 2:]
    dp = np.pad(down, 1)
    vals = np.maximum.reduce([dp[:-2, 1:-1], dp[2:, 1:-1], dp[1:-1, :-2], dp[1:-1, 2:]])
    down = np.where(~grow & nb, vals, down)
    pp = np.pad(noise, 1)
    noise = np.where(~grow & nb, np.maximum.reduce([pp[:-2, 1:-1], pp[2:, 1:-1], pp[1:-1, :-2], pp[1:-1, 2:]]), noise)
    grow |= nb
flow = np.dstack([down, core, noise]) * 255
Image.fromarray(flow.round().astype(np.uint8), 'RGB').save(OUT / 'volcano-flow.webp', lossless=True)
print('volcano-flow', (FLOW, FLOW), f'{(OUT / "volcano-flow.webp").stat().st_size // 1024} KB')


def erode_steps(mask, n):
    """Steps (8-connected) from each inside pixel to the outside, capped at n."""
    d = np.zeros(mask.shape, np.float32)
    m = mask.copy()
    for _ in range(n):
        d += m
        p = np.pad(m, 1)
        m = m & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:] & p[:-2, :-2] & p[2:, 2:] & p[:-2, 2:] & p[2:, :-2]
    return d


# The lava's jelly gloss (2026-10-29, "confirm it's in the whole style of the slot"): the blobs
# and pads are glossy jelly lit from the top left, so the streams get the same: a crisp white
# highlight a few px inside the edges facing the light, and a soft deep-pink shade inside the
# edges facing away. Baked onto the lava, so it grows and shrinks with the drips.
K = 1053 / 329  # px per design px
la_a = np.asarray(Image.open(OUT / 'volcano-lava.webp'))[..., 3].astype(np.float32) / 255
mask = la_a > 0.5
e = erode_steps(mask, round(12 * K))
# Rounded: raw step counts turn corners into hard angles (they read as the lava 'cut').
e = np.asarray(Image.fromarray((e * 255 / e.max()).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5 * K)), np.float32) * e.max() / 255
# None in the crater's pool (a recessed pool, not a raised jelly: a highlight round its rim
# read as a cut edge), fading in down the streams.
stream = np.asarray(Image.fromarray((stream_down * 255).astype(np.uint8)).resize(mask.shape[::-1], Image.BILINEAR), np.float32) / 255
stream = np.clip((stream - 0.1) / 0.14, 0, 1) ** 2
soft = np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4 * K)), np.float32)
gy, gx = np.gradient(soft)
gl = np.hypot(gx, gy) + 1e-6
facing = (gx * 0.5 + gy * 0.86) / gl  # inward normal . down-right: +1 where the edge faces the light
band = np.exp(-(((e / K) - 2.6) / 1.1) ** 2) * mask * stream
ga = (0.75 * band * np.clip(facing, 0, 1) ** 1.3).astype(np.float32)
sa = (0.38 * np.exp(-(((e / K) - 1.6) / 2.2) ** 2) * mask * stream * np.clip(-facing, 0, 1) ** 1.2).astype(np.float32)
ga = np.asarray(Image.fromarray((ga * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.5 * K)), np.float32) / 255
sa = np.asarray(Image.fromarray((sa * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2 * K)), np.float32) / 255
shade = np.array([176, 30, 84], np.float32)
out_a = ga + sa * (1 - ga)
rgb = (255 * ga[..., None] + shade * (sa * (1 - ga))[..., None]) / np.maximum(out_a, 1e-6)[..., None]
base = np.asarray(Image.open(OUT / 'volcano-lava.webp'), np.float32)
ba = base[..., 3] / 255
fa = out_a + ba * (1 - out_a)
frgb = (rgb * out_a[..., None] + base[..., :3] * (ba * (1 - out_a))[..., None]) / np.maximum(fa, 1e-6)[..., None]
save(Image.fromarray(np.dstack([frgb, fa * 255]).clip(0, 255).round().astype(np.uint8), 'RGBA'), 'volcano-lava')

# The water cleared of its painted streaks (2026-10-29, "clear the image and animate the sea"):
# each row filled with that row's median colour, the alpha kept, so SceneView draws its own
# reflections and swells over a clean sea of the painting's colours.
wa = np.asarray(Image.open(SRC / 'water.png').convert('RGBA')).astype(np.float32)
rows = np.zeros((wa.shape[0], 3), np.float32)
for y in range(wa.shape[0]):
    m = wa[y, :, 3] > 200
    rows[y] = np.median(wa[y, m, :3], axis=0) if m.sum() > 50 else (rows[y - 1] if y else 0)
k = 32  # smooth down the rows, so the bands do not step
rows = np.stack([np.convolve(np.pad(rows[:, c], k, mode='edge'), np.ones(2 * k + 1) / (2 * k + 1), 'valid') for c in range(3)], 1)
wa[..., :3] = rows[:, None, :]
clear = grade(Image.fromarray(wa.clip(0, 255).astype(np.uint8), 'RGBA'))
save(blur(clear, 1209, BLUR['seascape']).resize((2171, 724), Image.LANCZOS), 'water-clear')

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
