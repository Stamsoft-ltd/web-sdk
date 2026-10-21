"""Drifting sky clouds drawn in the game's jelly style (SkyClouds.svelte, SceneView.ts).

The Figma clouds (art-src/splash/cloud*.webp, the pink bonus/normal/cloud.webp) are flat,
pale airbrush shapes with a long flat tail; next to the glossy, chunky blobs, logo and domes
they read as stock art. These are drawn instead: round lobes on a rounded base, white on top
fading to a lavender underside, a soft rim inside the edge, a light band along the top and
a gloss dot on the two biggest lobes. Far clouds get more blur, for depth.

Each keeps its predecessor's aspect and body placement (base at ~86% of the height), so the
lanes and sizes in SkyClouds / SceneView / the bonus scenes still hold. New file names, since
browsers kept the old art under the old ones.
  -> public/splash/cloud-puff.webp, cloud-puff-far.webp     (sky palette)
  -> public/bonus/normal/crisp/cloud-puff.webp                   (sunset palette)
    python3 apps/split-party/scripts/build-puff-clouds.py
"""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public'
SS = 4  # supersampling for the shape edge

# (cx, cy, r): lobe centres as fractions of width/height, radius as a fraction of the width.
NEAR = [(0.3, 0.66, 0.12), (0.47, 0.52, 0.17), (0.66, 0.56, 0.14), (0.8, 0.68, 0.09), (0.18, 0.74, 0.07)]
FAR = [(0.32, 0.6, 0.14), (0.55, 0.5, 0.17), (0.75, 0.62, 0.11)]
SUNSET = [(0.24, 0.66, 0.09), (0.42, 0.52, 0.14), (0.6, 0.54, 0.12), (0.76, 0.66, 0.08)]

PALETTES = {
    # Body gradient stops (top to underside), rim colour, gloss alpha.
    'sky': ([(0, (255, 255, 255)), (0.5, (240, 246, 255)), (0.75, (206, 222, 255)), (1, (184, 186, 240))], (150, 160, 235), 0.9),
    'sunset': ([(0, (255, 232, 220)), (0.5, (255, 200, 216)), (0.75, (246, 162, 208)), (1, (212, 126, 198))], (186, 96, 178), 0.7),
}


def gradient(stops, h):
    col = Image.new('RGB', (1, h))
    for y in range(h):
        t = y / max(1, h - 1)
        for (a, ca), (b, cb) in zip(stops, stops[1:]):
            if a <= t <= b:
                k = (t - a) / (b - a)
                col.putpixel((0, y), tuple(round(ca[i] + (cb[i] - ca[i]) * k) for i in range(3)))
                break
    return col


def cloud(size, lobes, palette, blur, name):
    W, H = size
    w, h = W * SS, H * SS
    stops, rim_rgb, gloss = PALETTES[palette]
    for cx, cy, r in lobes:
        # A lobe running off the top of the canvas would come out cut flat.
        assert cy - r * W / H >= 0.05, (name, cx, cy, r)
    m = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(m)
    for cx, cy, r in lobes:
        d.ellipse([(cx - r) * w, cy * h - r * w, (cx + r) * w, cy * h + r * w], fill=255)
    d.rounded_rectangle([0.08 * w, 0.55 * h, 0.92 * w, 0.86 * h], radius=int(0.15 * h), fill=255)
    # Flat underside: lobes don't hang below the base.
    d.rectangle([0, 0.86 * h, w, h], fill=0)
    # Round off the joins between lobes, then re-cut a clean edge.
    m = m.filter(ImageFilter.GaussianBlur(SS * W / 680)).point(lambda v: 255 if v > 127 else 0)

    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    img.paste(gradient(stops, h).resize((w, h)), (0, 0), m)
    # Soft rim just inside the edge.
    ring = ImageChops.subtract(m, m.filter(ImageFilter.GaussianBlur(SS * W / 136))).point(lambda v: min(255, int(v * 1.6)))
    rim = Image.new('RGBA', (w, h), rim_rgb + (0,))
    rim.putalpha(ring.point(lambda v: int(v * 0.55)))
    img.alpha_composite(rim)
    # Light band along the top: the sliver the mask uncovers when shifted down.
    shifted = Image.new('L', (w, h), 0)
    shifted.paste(m, (0, int(0.05 * h)))
    top = ImageChops.subtract(m, shifted).filter(ImageFilter.GaussianBlur(SS * W / 270))
    band = Image.new('RGBA', (w, h), (255, 255, 255, 0))
    band.putalpha(top.point(lambda v: int(v * 0.9)))
    img.alpha_composite(band)
    # Gloss dots, upper left of the two biggest lobes.
    g = Image.new('L', (w, h), 0)
    gd = ImageDraw.Draw(g)
    for cx, cy, r in sorted(lobes, key=lambda l: -l[2])[:2]:
        x, y = (cx - r * 0.45) * w, cy * h - r * w * 0.55
        gd.ellipse([x - r * w * 0.28, y - r * w * 0.11, x + r * w * 0.28, y + r * w * 0.11], fill=round(255 * gloss))
    g = ImageChops.multiply(g.filter(ImageFilter.GaussianBlur(SS * W / 550)), m)
    shine = Image.new('RGBA', (w, h), (255, 255, 255, 0))
    shine.putalpha(g)
    img.alpha_composite(shine)

    img = img.resize((W, H), Image.LANCZOS)
    if blur:
        img = img.filter(ImageFilter.GaussianBlur(blur))
    path = OUT / name
    img.save(path, quality=90, method=6)
    print(name, img.size, f'{path.stat().st_size // 1024} KB')


# Same aspects as cloud-2x (1645x625), cloud-far-2x (760x328) and bonus cloud (594x198, drawn
# up to 300 frame px, so 2x here).
cloud((1640, 624), NEAR, 'sky', 1.6, 'splash/cloud-puff.webp')
cloud((760, 328), FAR, 'sky', 3.2, 'splash/cloud-puff-far.webp')
cloud((1188, 396), SUNSET, 'sunset', 3.0, 'bonus/normal/crisp/cloud-puff.webp')
