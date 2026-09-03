#!/usr/bin/env python3
"""Cut the MOTHERSHIP paintings into every background the game needs.

Figma supplies whole landscape paintings plus the ship and the logo as loose transparent rasters.
The game needs eight backgrounds -- landscape and portrait for four rooms -- so the portrait
rebuilds are derived here rather than hand-painted.

    bg_base.webp  / bg_mobile_base.webp    the base game        (Figma 9164:12153 "Background 1")
    bg_bonus.webp / bg_mobile_bonus.webp   GRAVITY BREACH       (Figma 9164:12399 "Background 2")
    bg_super.webp / bg_mobile_super.webp   CORE OVERLOAD        (Figma 9164:12644 "Background 3")
    bg_zero.webp  / bg_mobile_zero.webp    ZERO POINT PROTOCOL  (Figma 9164:12890 "Background 4")
    logo_plate.webp                        MAGNETIC 2 MOTHERSHIP
    (the ship is NOT built here any more -- see scripts/build-ufo-art.py)

FOUR paintings, one per room. The game moved outdoors on 2026-09-03: every room is now the same
terrace over the same alien valley, repainted for the hour and the weather -- lilac dusk for the
base game, a deeper violet for Gravity Breach, a starlit night under a moon for Core Overload, and
a green-gold morning for Zero Point Protocol. Background.svelte cross-fades between them, so the
bonus hand-off reads as the sky changing rather than as a different place.

That retired the two things the old interior LAB needed and these do not: the mood GRADE (both
bonus rooms used to be the base room multiplied by a coloured lamp, magenta and green) and the
octagon-anchored portrait rebuild. Nothing is tinted here any more -- every room is its own
painting -- and every portrait is built the one way, by growing sky.

Two things are still derived, not measured, and are the first places to look if a room reads wrong:

  * PORTRAIT. The sources are landscape (~1.6) and the target is 0.5625, so roughly half the
    portrait canvas has no source pixels at all. Everything from the design crop's top row down is
    kept at its own proportions and placed against the bottom edge; the gap above is filled by
    CONTINUING the sky's own per-column gradient upward. Only SKY is ever invented, which is why
    the valley, the horizon and the landing pad keep their shape exactly.

  * BLUR. All four nodes carry the design's own LAYER_BLUR radius 7 -- depth of field, so the
    valley does not compete with the symbols.

Run:  python3 scripts/build-room-art.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art-src" / "room"
BG = ROOT / "static" / "assets" / "components" / "backgrounds"
UI = ROOT / "static" / "assets" / "components" / "ui"
SPLASH = ROOT / "static" / "assets" / "components" / "splash"
PREVIEW = SRC / "preview_rooms.png"

# Landscape output. 16:9 so it matches Background.svelte's DESKTOP_ASPECT exactly -- the sprite is
# drawn at that aspect, so art of any other shape would be STRETCHED, not letterboxed.
LAND_W, LAND_H = 1600, 900
# Portrait output. 1242x2208 is the size the old portrait art shipped at and what
# PORTRAIT_BACKGROUND_RATIO in game/constants.ts already describes.
PORT_W, PORT_H = 1242, 2208

# Every design frame in this file is 1200x670.
DESIGN_FRAME = (1200.0, 670.0)

# Where each painting sits inside its design frame: the node's size, and how far its top-left is
# OUTSIDE the frame. Every painting is hung larger than the frame and cropped by it, so this is what
# says which part of it the design actually shows -- and the four differ, so it cannot be assumed.
#
# `blur` is the Figma LAYER_BLUR on the node, in design px. All four carry radius 7 (on the base the
# designer stacked two identical copies of the painting -- identical and opaque, so the result is a
# single blur, not a double one). It is depth of field, not softness for its own sake: the board and
# its symbols sit on top of this and the valley must not compete with them.
#
# Core Overload's frame has the base painting UNDER its own, fully covered by it. Only the top
# layer is listed, because only the top layer is ever visible.
ROOMS = {
    "base": {  # 9164:12153 "Background 1" -- lilac dusk
        "file": "vista.png",
        "node": (1522.0, 1012.0),
        "offset": (130.0, 189.0),
        "blur": 7.0,
    },
    "bonus": {  # 9164:12399 "Background 2" -- GRAVITY BREACH, deep violet
        "file": "gravity_breach.png",
        "node": (1578.0, 971.0),
        "offset": (169.0, 189.0),
        "blur": 7.0,
    },
    "super": {  # 9164:12644 "Background 3" -- CORE OVERLOAD, starlit night under a moon
        "file": "core_overload.png",
        "node": (1467.0, 902.0),
        "offset": (166.0, 156.0),
        "blur": 7.0,
    },
    "zero": {  # 9164:12890 "Background 4" -- ZERO POINT PROTOCOL, green-gold morning
        "file": "zero_point.png",
        "node": (1599.0, 984.0),
        "offset": (179.5, 189.0),
        "blur": 7.0,
    },
}

# Portrait framing. VIEW_W is how many source pixels of WIDTH the phone shows; everything from the
# design crop's top row down to the bottom of the PAINTING is kept (the sources carry more terrace
# below the design frame, and a phone has room for it), placed against the bottom edge. The gap left
# above is filled by CONTINUING the sky's own vertical gradient upward, per column.
#
# Stretching a band of sky instead leaves a hard seam, and it is worth being clear why: any band
# starting below the crop's first row ends on a colour that is not the crop's first row, so the two
# never meet. Extrapolation joins exactly by construction. SKY_SLOPE_ROWS is how many rows of real
# sky the trend is measured over (the design crops away everything above, and the nearest mountain
# peak is a good 200 rows below it, so a 120-row block under the crop is sky and nothing else).
# SKY_EXTEND_MAX caps the extrapolation at that many blocks' worth of darkening -- the gap is six
# blocks tall, and a straight line over six would run the sky to black.
PORTRAIT_VIEW_W = 900
SKY_SLOPE_ROWS = 120
SKY_EXTEND_MAX = 1.5
# How many columns the per-column slope is averaged over before it is extrapolated -- see extend_sky.
SLOPE_SMOOTH_PX = 81

# Where the design hangs the ship, in design-frame coordinates. It deliberately runs off the right
# edge (x + w = 1226 > 1200), which is why the placements this script prints exceed 1.0 there.
UFO_NODE = (898.0, 20.0, 328.0, 492.0)

WEBP = dict(quality=88, method=6)

# Transparent art is saved LOSSY too, and capped in size. Lossless webp turned the logo into 648KB
# (the plate it replaced was 76KB) and the ship and beam into another 400KB between them -- this
# game has been rejected over blocking payload before, and none of these three is a texture whose
# edges survive being pixel-peeped anyway. Caps are the widest each is ever drawn, doubled.
RGBA_WEBP = dict(quality=88, method=6, alpha_quality=95)
MAX_WIDTH = {"logo_plate": 900, "ufo_ship": 700, "ufo_beam": 700}


def save_rgba(im: Image.Image, path: Path) -> None:
    cap = MAX_WIDTH[path.stem]
    if im.width > cap:
        im = im.resize((cap, max(1, round(im.height * cap / im.width))), Image.LANCZOS)
    im.save(path, **RGBA_WEBP)
    print(f"  {path.name} {im.size} {path.stat().st_size // 1024}KB")


def die(msg: str) -> None:
    sys.exit(f"build-room-art: {msg}")


def design_crop(room: Image.Image, spec: dict) -> Image.Image:
    """The part of the painting the design frame actually shows, trimmed to the output aspect."""
    w, h = room.size
    sx, sy = w / spec["node"][0], h / spec["node"][1]
    x0, y0 = spec["offset"][0] * sx, spec["offset"][1] * sy
    x1, y1 = x0 + DESIGN_FRAME[0] * sx, y0 + DESIGN_FRAME[1] * sy
    # Trim to the output aspect around the same centre so nothing is stretched.
    want = LAND_W / LAND_H
    cw, ch = x1 - x0, y1 - y0
    if cw / ch > want:
        new_w = ch * want
        cx = (x0 + x1) / 2
        x0, x1 = cx - new_w / 2, cx + new_w / 2
    else:
        new_h = cw / want
        cy = (y0 + y1) / 2
        y0, y1 = cy - new_h / 2, cy + new_h / 2
    return room.crop((round(x0), round(y0), round(x1), round(y1)))


def build_portrait(vista: Image.Image, spec: dict) -> Image.Image:
    """Rebuild a room for a 0.5625 canvas by growing its SKY.

    Nothing is stretched except sky: the valley, the horizon and the landing pad keep their
    proportions exactly, and the extra 1000-odd rows a phone needs come out of a vertical gradient
    where a stretch is invisible. The pad ends up low on the canvas, mostly under the portrait HUD,
    and the board floats over the valley -- which is where the landscape design puts it too.
    """
    w, h = vista.size
    sy = h / spec["node"][1]
    top = round(spec["offset"][1] * sy)  # the design crop's first row
    cx = w / 2
    x0 = round(cx - PORTRAIT_VIEW_W / 2)
    x1 = x0 + PORTRAIT_VIEW_W
    if x0 < 0 or x1 > w:
        die(f"portrait view {PORTRAIT_VIEW_W}px does not fit the {w}px painting")

    scale = PORT_W / PORTRAIT_VIEW_W
    body = vista.crop((x0, top, x1, h))
    body = body.resize((PORT_W, round(body.height * scale)), Image.LANCZOS)
    sky_h = PORT_H - body.height
    if sky_h < 0:
        die("portrait: the painting is already taller than the canvas -- raise VIEW_W")

    out = Image.new("RGB", (PORT_W, PORT_H))
    out.paste(body, (0, sky_h))
    if sky_h > 0:
        out.paste(Image.fromarray(extend_sky(vista, x0, x1, top, sky_h, scale)), (0, 0))
    print(
        f"  portrait: scale {scale:.3f}, sky extended {sky_h}px"
        f" ({sky_h / scale / SKY_SLOPE_ROWS:.1f} slope blocks)"
    )
    return out


def extend_sky(vista: Image.Image, x0: int, x1: int, top: int, out_h: int, scale: float):
    """Grow the sky UPWARD from row `top`, following its own per-column gradient."""
    band = np.asarray(vista.crop((x0, top, x1, top + SKY_SLOPE_ROWS))).astype(np.float32)
    join = band[0]  # the row the extension has to meet exactly
    below = band[-4:].mean(axis=0)  # the same columns, one block further down
    step = join - below  # per column, per channel: one block's worth of "going up"
    # Smooth the SLOPE across columns, never the join. A column's slope is a difference of two
    # painted rows, so it carries their noise, and the extrapolation multiplies it by up to
    # SKY_EXTEND_MAX blocks -- unsmoothed, a couple of levels' difference between neighbouring
    # columns opens into visible vertical banding at the top of the canvas. `join` is left exactly
    # as painted because it is what the seam has to meet.
    k = np.ones(SLOPE_SMOOTH_PX, dtype=np.float32) / SLOPE_SMOOTH_PX
    pad = SLOPE_SMOOTH_PX // 2
    step = np.stack(
        [
            np.convolve(np.pad(step[:, c], pad, mode="edge"), k, mode="valid")
            for c in range(step.shape[1])
        ],
        axis=1,
    )
    # Rows are generated from the join upward, so row out_h-1 is the join itself.
    t = (np.arange(out_h - 1, -1, -1, dtype=np.float32) + 0.5) / scale / SKY_SLOPE_ROWS
    f = SKY_EXTEND_MAX * (1 - np.exp(-t / SKY_EXTEND_MAX))
    sky = join[None, :, :] + f[:, None, None] * step[None, :, :]
    sky = np.clip(sky, 0, 255).round().astype(np.uint8)
    return np.asarray(
        Image.fromarray(sky).resize((PORT_W, out_h), Image.LANCZOS)
    )


# Where lamps may be found, as a fraction of the image HEIGHT, and how big they may be, as a
# fraction of its AREA.
#
# The region is load-bearing. The magenta key alone also matches the rim light along the mountain
# crests -- moonlight on rock, hundreds of pixels of it, up in the valley -- and lighting those
# put a pulsing halo on a mountain. Everything that actually emits in these paintings is ON THE
# TERRACE: the landing pad's core and the sill strips of the consoles at either side.
#
# The area cap is 2%, not the 0.2% an earlier interior room used. Out here the pad's glowing core
# IS one blob, ~1.4-1.9% of the frame, and in Core Overload's tighter crop it is the ONLY emissive
# thing in shot -- capping below it left that room with no lamps at all and therefore dead still.
LAMP_REGION = 0.55
LAMP_AREA = (0.00005, 0.02)


def find_lamps(im: Image.Image, limit: int = 9):
    """Locate the room's emissive strips so Background.svelte can light them.

    An older blue-lab table was measured with a local-brightness key because those lamps were
    painted flat and blurred. The terrace needs no such trick: its sill lights and pad ring are one
    saturated magenta, unique in a lilac landscape, so a colour key plus the area bounds above finds
    them exactly. Returned as fractions of THIS image, which is why detection runs on the finished
    background and not on the painting.
    """
    a = np.asarray(im.convert("RGB")).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mask = (r - g > 45) & (b - g > 45) & (r > 190)
    h, w = mask.shape
    mask[: int(h * LAMP_REGION)] = False  # sky and valley: see LAMP_REGION
    lo_px, hi_px = LAMP_AREA[0] * h * w, LAMP_AREA[1] * h * w
    seen = np.zeros_like(mask)
    blobs = []
    ys, xs = np.nonzero(mask)
    for sy, sx in zip(ys, xs):
        if seen[sy, sx]:
            continue
        stack = [(sy, sx)]
        seen[sy, sx] = True
        pts = []
        while stack:
            y, x = stack.pop()
            pts.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        if not lo_px <= len(pts) <= hi_px:
            continue
        py = np.array([p[0] for p in pts])
        px = np.array([p[1] for p in pts])
        mean = a[py, px].mean(axis=0)
        blobs.append((len(pts), py, px, mean))

    blobs.sort(key=lambda t: -t[0])
    lamps = []
    for _n, py, px, mean in blobs[:limit]:
        # Full saturation, like the old table: the glow should read as the lamp's LIGHT, not as a
        # slightly brighter copy of the strip's own paint.
        mx, mn = mean.max(), mean.min()
        sat = mean if mx == mn else (mean - mn) / (mx - mn) * 255
        lamps.append(
            {
                "cx": round(float((px.min() + px.max()) / 2) / w, 4),
                "cy": round(float((py.min() + py.max()) / 2) / h, 4),
                # A minimum size so a thin strip still gets a halo worth seeing.
                "w": round(max(float(px.max() - px.min()) / w, 0.012), 4),
                "h": round(max(float(py.max() - py.min()) / h, 0.012), 4),
                "color": (int(sat[0]) << 16) | (int(sat[1]) << 8) | int(sat[2]),
            }
        )
    return lamps


def write_lights(tables: dict[str, list[dict]]) -> None:
    lines = [
        "// Emissive strips in each room background, so Background.svelte can LIGHT them instead of",
        "// leaving the room a still painting (the Stake review's \"low quality resources\" is partly",
        "// that nothing in the scene moves between spins).",
        "//",
        "// GENERATED by scripts/build-room-art.py -- do not hand-edit. The lamps are keyed by colour",
        "// (the terrace's sill lights are one saturated magenta, unique in a lilac landscape) and",
        "// measured on the FINISHED background, so the fractions stay valid for whatever crop that",
        "// script produces. Each room is keyed on its own painting -- they are four different",
        "// paintings of the same terrace, not four tints of one.",
        "export type BackgroundLight = { cx: number; cy: number; w: number; h: number; color: number };",
        "",
        "export const BACKGROUND_LIGHTS: Record<string, BackgroundLight[]> = {",
    ]
    def entry(l: dict) -> str:
        return (
            f"{{ cx: {l['cx']}, cy: {l['cy']}, w: {l['w']}, h: {l['h']},"
            f" color: 0x{l['color']:06x} }}"
        )

    for key, lamps in tables.items():
        # A one-lamp room is written on ONE line, because that is what prettier does to it and this
        # file is checked -- a room that finds a single lamp would otherwise fail the format check
        # every time it is regenerated.
        if len(lamps) == 1:
            lines.append(f"\t{key}: [{entry(lamps[0])}],")
            continue
        lines.append(f"\t{key}: [")
        for l in lamps:
            lines.append(f"\t\t{entry(l)},")
        lines.append("\t],")
    lines.append("};")
    (ROOT / "src" / "game" / "backgroundLights.ts").write_text("\n".join(lines) + "\n")


def trim_box(im: Image.Image) -> tuple[Image.Image, tuple[int, int, int, int]]:
    """Crop to the visible content AND hand back the box, so placements can follow the crop."""
    bb = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if bb is None:
        die("a transparent source came out empty")
    return im.crop(bb), bb


def trimmed(im: Image.Image) -> Image.Image:
    return trim_box(im)[0]


def ufo_placements(raster: tuple[int, int], boxes: dict[str, tuple[float, ...]]) -> None:
    """Print ship/beam placements as fractions of the FINISHED landscape background.

    The design frame is 1200x670 but the background is trimmed to 16:9 around the same centre, so a
    fraction of the design frame is NOT a fraction of the background -- hence deriving both steps
    here instead of reading the numbers off the Figma boxes.
    """
    nx, ny, nw, nh = UFO_NODE
    rw, rh = raster
    fw, fh = DESIGN_FRAME
    # Horizontal trim applied by design_crop(), in design-frame units.
    want = LAND_W / LAND_H
    vis_w = fh * want
    left = (fw - vis_w) / 2

    print("\n  placements (fractions of bg_base.webp; x may exceed 1 -- the ship runs off frame):")
    for name, (x0, y0, x1, y1) in boxes.items():
        # raster pixels -> design frame -> background
        dx0, dx1 = nx + x0 / rw * nw, nx + x1 / rw * nw
        dy0, dy1 = ny + y0 / rh * nh, ny + y1 / rh * nh
        print(
            f"    {name:5s} cx={((dx0 + dx1) / 2 - left) / vis_w:+.4f}"
            f" cy={((dy0 + dy1) / 2) / fh:+.4f}"
            f" w={(dx1 - dx0) / vis_w:.4f} h={(dy1 - dy0) / fh:.4f}"
        )


def split_ufo(ufo: Image.Image) -> tuple[Image.Image, Image.Image]:
    """Split the ship off its tractor beam so the two can be animated independently.

    Split on COLOUR, not on alpha: the beam is a single flat wash (its median colour is the constant
    below the hull) while the hull is many blues and purples. Alpha is useless here -- the art never
    reaches 255 anywhere, so "fully opaque" matches the beam's edges just as well as the hull.
    """
    art, content = trim_box(ufo)
    a = np.asarray(art)
    rgb = a[:, :, :3].astype(int)
    visible = a[:, :, 3] > 40
    lower = int(art.height * 0.6)
    beam_rgb = np.median(rgb[lower:][visible[lower:]], axis=0)
    is_beam = (np.abs(rgb - beam_rgb).max(axis=2) < 26) & visible
    frac = is_beam.sum(axis=1) / np.maximum(visible.sum(axis=1), 1)

    RUN = 60
    cut = None
    for r in range(art.height - RUN):
        if frac[r : r + RUN].min() > 0.85:
            cut = r
            break
    if cut is None:
        die("could not tell the tractor beam from the hull")
    # Walk back over the rows where the beam is already emerging, so the cut lands at the hull's
    # bottom edge rather than where the beam becomes the ONLY thing left.
    while cut > 0 and frac[cut - 1] > 0.4:
        cut -= 1
    if cut >= art.height - 8:
        die("ship/beam split found no beam below the hull")
    ship_box = (0, 0, art.width, cut)
    # The beam starts a little ABOVE the cut so its emitter stays tucked under the hull instead of
    # showing a hard top edge when the ship bobs away from it.
    overlap = round(art.height * 0.02)
    beam_box = (0, max(0, cut - overlap), art.width, art.height)
    ship, ship_bb = trim_box(art.crop(ship_box))
    beam, beam_bb = trim_box(art.crop(beam_box))
    print(f"  ufo: split at row {cut}/{art.height} -> ship {ship.size}, beam {beam.size}")

    # Absolute boxes within the ORIGINAL raster, so a placement can be derived from the trims this
    # function actually applied rather than assumed. `content` is where trimmed() cropped the raster.
    def absolute(box, bb):
        return (
            content[0] + box[0] + bb[0],
            content[1] + box[1] + bb[1],
            content[0] + box[0] + bb[2],
            content[1] + box[1] + bb[3],
        )

    return ship, beam, absolute(ship_box, ship_bb), absolute(beam_box, beam_bb)


def main() -> None:
    for name in [spec["file"] for spec in ROOMS.values()] + ["ufo.png", "logo.png"]:
        if not (SRC / name).exists():
            die(f"missing source art-src/room/{name}")

    BG.mkdir(parents=True, exist_ok=True)
    UI.mkdir(parents=True, exist_ok=True)
    SPLASH.mkdir(parents=True, exist_ok=True)

    print("rooms:")
    variants: dict[str, tuple[Image.Image, Image.Image]] = {}
    for key, spec in ROOMS.items():
        src = Image.open(SRC / spec["file"]).convert("RGB")
        land = design_crop(src, spec).resize((LAND_W, LAND_H), Image.LANCZOS)
        port = build_portrait(src, spec)
        # The design's LAYER_BLUR is quoted in DESIGN px, so it is applied after the resize and
        # scaled to the output. Figma's radius is about twice the equivalent Gaussian sigma.
        if spec["blur"]:
            sigma = spec["blur"] / 2
            land = land.filter(ImageFilter.GaussianBlur(sigma * LAND_W / DESIGN_FRAME[0]))
            port = port.filter(ImageFilter.GaussianBlur(sigma * PORT_W / DESIGN_FRAME[0]))
        variants[key] = (land, port)
        land.save(BG / f"bg_{key}.webp", **WEBP)
        port.save(BG / f"bg_mobile_{key}.webp", **WEBP)
        print(
            f"  bg_{key}.webp {land.size} {(BG / f'bg_{key}.webp').stat().st_size // 1024}KB"
            f"   bg_mobile_{key}.webp {port.size}"
            f" {(BG / f'bg_mobile_{key}.webp').stat().st_size // 1024}KB"
        )

    # Lamp table. Every room is its own painting now, so every one is keyed on its own finished
    # background -- there is no longer a single set of strips shared between tinted copies of one
    # room. The key is the terrace's magenta sill lights, which all four paintings carry.
    tables: dict[str, list[dict]] = {}
    for key, (land, port) in variants.items():
        name = key.capitalize()
        tables["bg" + name] = find_lamps(land)
        tables["bgMobile" + name] = find_lamps(port)
    write_lights(tables)
    print(
        "lamps: "
        + ", ".join(f"{k} {len(tables['bg' + k.capitalize()])}" for k in variants)
        + " -> src/game/backgroundLights.ts"
    )

    # The ship's ART now comes from the designer's loose parts (scripts/build-ufo-art.py) and its
    # beam is drawn in Background.svelte, so nothing is saved here. The split still runs, because
    # this is the only place that knows how the room was cropped and therefore the only place that
    # can say WHERE in the finished background the design hangs the ship and how far its beam
    # reaches — the numbers Background.svelte's UFO/BEAM constants are set from.
    print("ship (measured only, no files written):")
    ufo_src = Image.open(SRC / "ufo.png").convert("RGBA")
    _ship, _beam, ship_box, beam_box = split_ufo(ufo_src)
    ufo_placements(ufo_src.size, {"ship": ship_box, "beam": beam_box})

    print("logo:")
    logo = trimmed(Image.open(SRC / "logo.png").convert("RGBA"))
    save_rgba(logo, SPLASH / "logo_plate.webp")

    # --- preview ---------------------------------------------------------------------------------
    tiles = []
    for _key, (l_im, p_im) in variants.items():
        tiles.append(l_im.resize((480, 270), Image.LANCZOS).convert("RGBA"))
        ph = 270
        tiles.append(p_im.resize((round(PORT_W * ph / PORT_H), ph), Image.LANCZOS).convert("RGBA"))
    logo_t = logo.resize((320, round(logo.height * 320 / logo.width)), Image.LANCZOS)

    row_w = sum(t.width for t in tiles) + 10 * (len(tiles) + 1)
    bot_w = logo_t.width + 40
    W = max(row_w, bot_w)
    H = 290 + 220
    sheet = Image.new("RGBA", (W, H), (22, 22, 28, 255))
    x = 10
    for t in tiles:
        sheet.alpha_composite(t, (x, 10))
        x += t.width + 10
    x = 10
    for t in (logo_t,):
        sheet.alpha_composite(t, (x, 295))
        x += t.width + 10
    sheet.save(PREVIEW)
    print("\npreview:", PREVIEW.relative_to(ROOT))


if __name__ == "__main__":
    main()
