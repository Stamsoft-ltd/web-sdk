#!/usr/bin/env python3
"""Cut the Version2 MOTHERSHIP room (Figma 9032:23054) into every background the game needs.

Figma supplies ONE landscape painting of the room (1536x1024) plus the ship and the logo as loose
transparent rasters. The game needs six backgrounds -- landscape and portrait, in three moods -- so
the portrait crops and the two bonus moods are derived here rather than hand-painted.

    bg_base.webp / bg_mobile_base.webp     the room as designed
    bg_bonus.webp / bg_mobile_bonus.webp   the same room lit magenta   (freegame)
    bg_super.webp / bg_mobile_super.webp   the same room lit green     (superspin)
    (the ship is NOT built here any more -- see scripts/build-ufo-art.py)
    logo_plate.webp                        MAGNETIC 2 MOTHERSHIP

Two things here are derived, not measured, and are the first places to look if a room reads wrong:

  * PORTRAIT. The source is landscape (1.5), the target is 0.5625, so roughly a third of the
    portrait canvas has no source pixels at all. The room is rebuilt: the wall above the octagon is
    extended with its own flat ceiling colour (rows 0..30 measure std 3.5, i.e. effectively flat, so
    stretching them is invisible), and the floor is stretched from the floor line down. The floor
    stretch is the visible compromise -- the tiles get longer the further the target is from 1.5.
    The portrait HUD covers most of it.

  * MOODS. bonus/super are the base room under a coloured lamp (an RGB multiply), matched to the
    association the game already ships (bgBonus = magenta, bgSuper = green -- verified against the
    old art's mean RGB, NOT guessed from the node names, which read the other way round).

Unlike the old blue-lab set, NOTHING is blurred or pre-dimmed here. The design shows the room at
full brightness and the board now carries its own opaque plate, so Background.svelte's two dim
rectangles came off at the same time as this landed.

Run:  python3 scripts/build-room-art.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

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

# The design places the room node at (-27,-37) sized 1275x850 inside a 1200x670 frame, so this much
# of the painting is what the design actually shows. Everything else is cropped by the frame.
DESIGN_NODE = (1275.0, 850.0)
DESIGN_OFFSET = (27.0, 37.0)
DESIGN_FRAME = (1200.0, 670.0)

# Measured off the painting (see the analysis in this file's history): the flat ceiling band, the
# floor line, and the centre octagon the board sits over.
CEILING_BAND = (0, 30)
FLOOR_ROW = 873
OCTAGON = {"x0": 455, "x1": 1067, "y0": 199, "y1": 847}

# Where the design hangs the ship, in design-frame coordinates. It deliberately runs off the right
# edge (x + w = 1226 > 1200), which is why the placements this script prints exceed 1.0 there.
UFO_NODE = (898.0, 20.0, 328.0, 492.0)

# Portrait framing. VIEW_W is how many source pixels of WIDTH the portrait shows: smaller = the
# octagon fills more of the phone, but more floor has to be stretched to reach the bottom.
PORTRAIT_VIEW_W = 780
# Where the octagon's centre lands down the portrait canvas. The board sits slightly above centre.
PORTRAIT_OCTAGON_CY = 0.455

# Mood grades: an RGB MULTIPLY, i.e. the room lit by a coloured lamp, plus an overall dim.
#
# Not a hue rotation. Rotating hue drags the alien landscape through the windows along with the
# walls, so the planet and the foliage change species between rooms; multiplying keeps every
# object's own relationship to the light and just changes what is lighting them.
#
# Which mood is which colour is taken from the art the game ALREADY ships (bg_bonus mean RGB is
# magenta, bg_super's is green), not from the Figma node names, which read the other way round.
MOODS = {
    "bonus": ((1.00, 0.42, 0.96), 0.94),  # magenta -- the freegame room
    "super": ((0.46, 1.00, 0.58), 0.94),  # green   -- the superspin room
}

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


def design_crop(room: Image.Image) -> Image.Image:
    """The part of the painting the design frame actually shows, trimmed to the output aspect."""
    w, h = room.size
    sx, sy = w / DESIGN_NODE[0], h / DESIGN_NODE[1]
    x0, y0 = DESIGN_OFFSET[0] * sx, DESIGN_OFFSET[1] * sy
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


def build_portrait(room: Image.Image) -> Image.Image:
    """Rebuild the room for a 0.5625 canvas by extending the ceiling and the floor.

    The source is landscape, so this cannot be a crop -- about a third of the portrait canvas has no
    source pixels. The octagon is placed first (it is what the board sits over) and the wall and
    floor are grown outward from it.
    """
    w, h = room.size
    scale = PORT_W / PORTRAIT_VIEW_W
    oct_cx = (OCTAGON["x0"] + OCTAGON["x1"]) / 2
    oct_cy = (OCTAGON["y0"] + OCTAGON["y1"]) / 2

    x0 = round(oct_cx - PORTRAIT_VIEW_W / 2)
    x1 = x0 + PORTRAIT_VIEW_W
    if x0 < 0 or x1 > w:
        die(f"portrait view {PORTRAIT_VIEW_W}px does not fit the {w}px painting around the octagon")

    # Walls: everything from the top of the painting down to the floor line.
    walls = room.crop((x0, 0, x1, FLOOR_ROW)).resize(
        (PORT_W, round(FLOOR_ROW * scale)), Image.LANCZOS
    )
    top_gap = round(PORTRAIT_OCTAGON_CY * PORT_H - oct_cy * scale)
    if top_gap < 0:
        die("octagon target sits above the canvas -- raise PORTRAIT_OCTAGON_CY or VIEW_W")
    floor_top = top_gap + walls.height
    floor_h = PORT_H - floor_top
    if floor_h <= 0:
        die("no room left for the floor -- lower PORTRAIT_OCTAGON_CY or raise PORTRAIT_VIEW_W")

    out = Image.new("RGB", (PORT_W, PORT_H))
    # Ceiling extension: the top band measures flat, so stretching it reads as more wall rather
    # than as a smeared panel.
    ceiling = room.crop((x0, CEILING_BAND[0], x1, CEILING_BAND[1]))
    out.paste(ceiling.resize((PORT_W, max(1, top_gap)), Image.LANCZOS), (0, 0))
    out.paste(walls, (0, top_gap))
    # Floor: stretched from the floor line to the bottom edge. This is the one visible compromise --
    # the tiles get longer the taller the canvas is.
    floor = room.crop((x0, FLOOR_ROW, x1, h))
    out.paste(floor.resize((PORT_W, floor_h), Image.LANCZOS), (0, floor_top))

    stretch = floor_h / (floor.height * scale)
    print(f"  portrait: scale {scale:.3f}, ceiling fill {top_gap}px, floor stretch {stretch:.2f}x")
    return out


def grade(im: Image.Image, tint: tuple[float, float, float], dim: float) -> Image.Image:
    """Light the room with a coloured lamp: multiply by `tint`, then dim."""
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    a = a * np.array(tint, dtype=np.float32) * dim
    return Image.fromarray(np.clip(a, 0, 255).round().astype(np.uint8), "RGB")


# Blob area bounds, as fractions of the image. The upper bound is load-bearing: the alien FLORA
# through the windows is painted the same magenta as the ship's light strips, so no colour key can
# tell them apart -- but the smallest plant is 5x the area of the largest strip, and lighting a
# bush would spill a halo across the landscape. Measured margin: strips top out near 0.0008, plants
# start near 0.0042.
LAMP_AREA = (0.0001, 0.002)


def find_lamps(im: Image.Image, limit: int = 9):
    """Locate the room's emissive strips so Background.svelte can light them.

    The old blue-lab table was measured with a local-brightness key because those lamps were painted
    flat and blurred. This room needs no such trick: every emissive element is one saturated magenta,
    unique in a lavender room, so a colour key plus the area bounds above finds them exactly.
    Returned as fractions of THIS image, which is why detection runs on the finished background and
    not on the painting.
    """
    a = np.asarray(im.convert("RGB")).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mask = (r - g > 45) & (b - g > 45) & (r > 190)
    h, w = mask.shape
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
        "// (every emissive element in this room is the same saturated magenta, unique against the",
        "// lavender walls) and measured on the FINISHED background, so the fractions stay valid for",
        "// whatever crop that script produces. The bonus/super tables are the same strips under each",
        "// room's coloured lamp.",
        "export type BackgroundLight = { cx: number; cy: number; w: number; h: number; color: number };",
        "",
        "export const BACKGROUND_LIGHTS: Record<string, BackgroundLight[]> = {",
    ]
    for key, lamps in tables.items():
        lines.append(f"\t{key}: [")
        for l in lamps:
            lines.append(
                f"\t\t{{ cx: {l['cx']}, cy: {l['cy']}, w: {l['w']}, h: {l['h']},"
                f" color: 0x{l['color']:06x} }},"
            )
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
    for name in ("room.png", "ufo.png", "logo.png"):
        if not (SRC / name).exists():
            die(f"missing source art-src/room/{name}")

    room = Image.open(SRC / "room.png").convert("RGB")
    BG.mkdir(parents=True, exist_ok=True)
    UI.mkdir(parents=True, exist_ok=True)
    SPLASH.mkdir(parents=True, exist_ok=True)

    print("rooms:")
    land = design_crop(room).resize((LAND_W, LAND_H), Image.LANCZOS)
    port = build_portrait(room)

    variants = {"base": (land, port)}
    for mood, (tint, dim) in MOODS.items():
        variants[mood] = (grade(land, tint, dim), grade(port, tint, dim))

    for mood, (l_im, p_im) in variants.items():
        l_im.save(BG / f"bg_{mood}.webp", **WEBP)
        p_im.save(BG / f"bg_mobile_{mood}.webp", **WEBP)
        print(
            f"  bg_{mood}.webp {l_im.size} {(BG / f'bg_{mood}.webp').stat().st_size // 1024}KB"
            f"   bg_mobile_{mood}.webp {p_im.size}"
            f" {(BG / f'bg_mobile_{mood}.webp').stat().st_size // 1024}KB"
        )

    # Lamp table. The strips are in the same place in every mood, so they are located ONCE on the
    # base art and then re-coloured per room -- keying the tinted rooms would find the same blobs
    # more slowly, and a magenta room defeats a magenta key outright.
    land_lamps, port_lamps = find_lamps(land), find_lamps(port)
    tables = {"bgBase": land_lamps, "bgMobileBase": port_lamps}
    for mood, (tint, _dim) in MOODS.items():
        name = mood.capitalize()
        for key, lamps in (("bg" + name, land_lamps), ("bgMobile" + name, port_lamps)):
            tables[key] = [
                {
                    **l,
                    "color": (
                        (min(255, int(((l["color"] >> 16) & 0xFF) * tint[0])) << 16)
                        | (min(255, int(((l["color"] >> 8) & 0xFF) * tint[1])) << 8)
                        | min(255, int((l["color"] & 0xFF) * tint[2]))
                    ),
                }
                for l in lamps
            ]
    write_lights(tables)
    print(f"lamps: {len(land_lamps)} landscape, {len(port_lamps)} portrait -> src/game/backgroundLights.ts")

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
    for mood, (l_im, p_im) in variants.items():
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
