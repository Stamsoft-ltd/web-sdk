#!/usr/bin/env python3
"""Prepare the MOTHERSHIP splash art and measure its layout off the design composite.

Sources in art-src/splash/ (supplied by the designer, not pulled from Figma -- the MCP was out of
quota when this was built):

    room.png        the room, sky empty        -> splash room
    cloud_big.png   \\ two cloud shapes         -> drift across the sky
    cloud_small.png /
    planet.png      the small purple planet    -> slow rotation
    panel_a/b/c.png the three feature panels   -> byte-identical, so ONE file ships
    composite.png   the finished design        -> placements are MEASURED off this

The green moon is the one piece that did NOT arrive as an asset, so it is CUT OUT of the composite
here. The room art carries the same moon, but washed out behind the window's haze -- the composite
has it graded the way the splash wants it, on flat sky that keys cleanly. It is therefore the only
piece whose resolution is limited by the screenshot (about 190px, upscaled ~15%); drop a real
export in as `moon.png` and this script will prefer it.

Run:  python3 scripts/build-splash-art.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art-src" / "splash"
OUT = ROOT / "static" / "assets" / "components" / "splash"
PREVIEW = SRC / "preview_splash.png"

# The splash is drawn edge to edge at the room's own aspect.
ROOM_W = 1920

WEBP = dict(quality=88, method=6)
RGBA_WEBP = dict(quality=90, method=6, alpha_quality=95)


def die(msg: str) -> None:
    sys.exit(f"build-splash-art: {msg}")


def trim(im: Image.Image) -> Image.Image:
    bb = im.getchannel("A").point(lambda v: 255 if v > 6 else 0).getbbox()
    if bb is None:
        die("a transparent source came out empty")
    return im.crop(bb)


def measure(comp: Image.Image) -> dict:
    """Locate the moon, the planet and the three panels in the design composite."""
    a = np.asarray(comp.convert("RGB")).astype(int)
    h, w = a.shape[:2]
    out = {}

    def rec(name, x0, y0, x1, y1):
        out[name] = {
            "cx": round(((x0 + x1) / 2) / w, 4),
            "cy": round(((y0 + y1) / 2) / h, 4),
            "w": round((x1 - x0) / w, 4),
            "h": round((y1 - y0) / h, 4),
        }

    # Moon: the only strong green high on the right. The window stops well above the horizon on
    # purpose — the alien foliage down there is the same green and joins the moon into one blob.
    win = np.zeros((h, w), bool)
    win[int(h * 0.04) : int(h * 0.34), int(w * 0.74) : int(w * 0.97)] = True
    g = win & (a[..., 1] > 150) & (a[..., 1] - a[..., 2] > 60) & (a[..., 1] - a[..., 0] > 20)
    if g.sum() < 500:
        die("could not find the green moon in the composite")
    ys, xs = np.nonzero(g)
    # Fit a CIRCLE rather than trusting the bounding box. Horizontally the moon is alone up here, so
    # its width is a true diameter; vertically the window clips its lower edge, so the centre is
    # derived from the TOP edge plus that radius. Using the raw bbox centre put the crop centre ~9px
    # high, and the radial mask below then shaved the disc flat on one side.
    d = xs.max() - xs.min()
    cx = (xs.min() + xs.max()) / 2
    cy = ys.min() + d / 2
    rec("moon", cx - d / 2, cy - d / 2, cx + d / 2, cy + d / 2)

    # Panels: the flat dark interior, three equal runs across the lower half.
    win = np.zeros((h, w), bool)
    win[int(h * 0.30) : int(h * 0.98), :] = True
    dark = win & (np.abs(a - np.array([45, 44, 92])).max(axis=2) < 22)
    cols = np.nonzero(dark.sum(axis=0) > 90)[0]
    runs, s0, prev = [], cols[0], cols[0]
    for x in cols[1:]:
        if x - prev > 10:
            runs.append((s0, prev))
            s0 = x
        prev = x
    runs.append((s0, prev))
    runs = [r for r in runs if r[1] - r[0] > 60]
    if len(runs) != 3:
        die(f"expected 3 panels in the composite, found {len(runs)}")
    rows = np.nonzero(dark.sum(axis=1) > 150)[0]
    for i, (x0, x1) in enumerate(runs):
        rec(f"panel{i + 1}", x0, rows.min(), x1, rows.max())
    return out


def cut_moon(comp: Image.Image, box: dict) -> Image.Image:
    """Key the moon (and its halo) off the sky behind it.

    PER ROW, not against one sampled sky colour: this sky is a vertical gradient, so a single
    reference keys the moon's own band correctly and turns every other row into opaque background --
    which is exactly the rectangle the first attempt produced. Each row's own left/right margins are
    its sky.
    """
    a = np.asarray(comp.convert("RGB")).astype(np.float32)
    h, w = a.shape[:2]
    # Pad WELL past the disc. The sky reference below comes from this crop's own outer margin, so
    # that margin has to sit beyond the moon's HALO -- measured radially, the body ends near 1.0x the
    # disc radius, the halo fades out by about 1.7x, and the window frame and the small planet start
    # around 1.8x. The cut sits at 1.62x -- just inside them, losing only the faintest of the halo. At a tighter pad the margin lands on the halo, the halo is then read as sky and
    # keyed away, and the moon ends on a hard circular cut.
    pad = 2.4
    cw = box["w"] * w * pad
    x0, x1 = int(box["cx"] * w - cw / 2), int(box["cx"] * w + cw / 2)
    y0, y1 = int(box["cy"] * h - cw / 2), int(box["cy"] * h + cw / 2)
    reg = a[max(0, y0) : y1, max(0, x0) : x1]
    margin = max(4, int(reg.shape[1] * 0.14))
    edges = np.concatenate([reg[:, :margin], reg[:, -margin:]], axis=1)
    sky_row = np.median(edges, axis=1)[:, None, :]  # one sky colour per row
    dist = np.abs(reg - sky_row).max(axis=2)
    # Soft ramp so the halo fades out instead of ending on a hard edge.
    alpha = np.clip((dist - 14) / 40, 0, 1)

    # The moon does not have this corner of the sky to itself: the window frame runs along the top
    # right and the small purple planet sits just below left, and a colour key alone happily takes
    # both. A radial mask keeps the disc and its halo and drops everything past them.
    #
    rh, rw = alpha.shape
    yy, xx = np.mgrid[0:rh, 0:rw]
    rad = np.hypot(xx - (rw - 1) / 2, yy - (rh - 1) / 2)
    # 98th percentile, so a stray speck of frame or planet cannot inflate the radius.
    # Radius from the GREEN disc the caller measured (a true diameter, see measure()), not from the
    # keyed alpha: any sky banding or window frame the key catches would inflate an alpha-derived
    # radius and let the neighbours back in.
    disc = box["w"] * w / 2
    # NB the clip reads "1 inside (A - B), 0 outside A": A is the ZERO point. Keep the halo (to
    # ~1.7x) and cut before the neighbours (~1.8x).
    alpha *= np.clip((disc * 1.62 - rad) / (disc * 0.40), 0, 1)

    rgba = np.dstack([reg, alpha * 255]).astype(np.uint8)
    return trim(Image.fromarray(rgba, "RGBA"))


def main() -> None:
    need = ["room.png", "cloud_big.png", "cloud_small.png", "planet.png", "panel_a.png", "composite.png"]
    for n in need:
        if not (SRC / n).exists():
            die(f"missing art-src/splash/{n}")

    OUT.mkdir(parents=True, exist_ok=True)
    comp = Image.open(SRC / "composite.png")
    place = measure(comp)

    room = Image.open(SRC / "room.png").convert("RGB")
    room = room.resize((ROOM_W, round(room.height * ROOM_W / room.width)), Image.LANCZOS)
    room.save(OUT / "room.webp", **WEBP)

    panel = trim(Image.open(SRC / "panel_a.png").convert("RGBA"))
    panel.save(OUT / "panel.webp", **RGBA_WEBP)

    loose = {}
    for name, fname in (("cloud_a", "cloud_big.png"), ("cloud_b", "cloud_small.png"), ("planet", "planet.png")):
        im = trim(Image.open(SRC / fname).convert("RGBA"))
        im.save(OUT / f"{name}.webp", **RGBA_WEBP)
        loose[name] = im

    # Prefer a real moon export if one ever lands; otherwise cut it out of the composite.
    if (SRC / "moon.png").exists():
        moon = trim(Image.open(SRC / "moon.png").convert("RGBA"))
        print("  moon: using the supplied art-src/splash/moon.png")
    else:
        moon = cut_moon(comp, place["moon"])
        print("  moon: CUT FROM THE COMPOSITE (no moon.png supplied) — lower res than the rest")
    moon.save(OUT / "moon.webp", **RGBA_WEBP)
    loose["moon"] = moon

    print("\nwritten to", OUT.relative_to(ROOT))
    for f in ("room.webp", "panel.webp", "cloud_a.webp", "cloud_b.webp", "planet.webp", "moon.webp"):
        p = OUT / f
        print(f"  {f:14s} {Image.open(p).size} {p.stat().st_size // 1024}KB")

    print("\nplacements (fractions of the splash frame, measured on the composite):")
    for k in ("moon", "panel1", "panel2", "panel3"):
        v = place[k]
        print(f"  {k:7s} cx={v['cx']:.4f} cy={v['cy']:.4f} w={v['w']:.4f} h={v['h']:.4f}")
    pw = panel.width / panel.height
    print(f"  panel art aspect {pw:.4f} (w/h) — drive the panel from its WIDTH and keep this ratio")

    # --- preview: the composite next to our own re-assembly ------------------------------------
    demo = room.convert("RGBA").resize((960, round(room.height * 960 / room.width)), Image.LANCZOS)
    W, H = demo.size
    for key, art in (("moon", moon),):
        v = place[key]
        tw = round(v["w"] * W)
        th = round(tw * art.height / art.width)
        demo.alpha_composite(art.resize((tw, th), Image.LANCZOS), (round(v["cx"] * W - tw / 2), round(v["cy"] * H - th / 2)))
    for i in (1, 2, 3):
        v = place[f"panel{i}"]
        tw = round(v["w"] * W)
        th = round(tw / pw)
        demo.alpha_composite(panel.resize((tw, th), Image.LANCZOS), (round(v["cx"] * W - tw / 2), round(v["cy"] * H - th / 2)))
    ref = comp.convert("RGBA").resize((960, round(comp.height * 960 / comp.width)), Image.LANCZOS)
    sheet = Image.new("RGBA", (960, demo.height + ref.height + 30), (20, 20, 26, 255))
    sheet.alpha_composite(ref, (0, 10))
    sheet.alpha_composite(demo, (0, ref.height + 20))
    sheet.save(PREVIEW)
    print("\npreview (design above, our re-assembly below):", PREVIEW.relative_to(ROOT))


if __name__ == "__main__":
    main()
