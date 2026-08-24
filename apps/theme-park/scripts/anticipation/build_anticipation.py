"""Build the anticipation reel frame — the marquee that lights up around a reel still spinning
while the board waits on a bonus scatter.

    python3 scripts/anticipation/build_anticipation.py

## What this replaces

The frame used to be a generated neon concept (`build-anticipation-frame.py`, and
`features/anticipation-frame-v2.webp`): two lightning rails with an ornate cap top and bottom, and a
bespoke chase of coloured dots drawn over it in <Anticipation>. Design replaced it with the plain
bulb marquee (Figma 7142:29286, "expand"), which is the same vocabulary as every other sign in the
game — a gold rail, a purple band, and a run of bulbs the code lights.

## Why it is DRAWN rather than exported

The design's frame is 175x484, a good deal wider for its height than a reel is. Exporting it and
stretching it to fit would squash every bulb into an oval, and the bulbs are the whole point of the
sign. It is also completely flat art: two gold lines, a purple band between them, and one dome
repeated. So the geometry is MEASURED off the design and the frame is redrawn at the aspect the game
actually needs, with round bulbs at the design's own pitch.

What that means in practice: the number of bulbs is NOT the design's. The design fits 18 down a
side; a reel is taller for its width, so at the same pitch this fits more. Keeping the pitch and
letting the count fall out is what makes it read as the same sign — keeping the count would stretch
the spacing instead.

## Sources (`source/`)

| file         | what it is                                    | what is read from it            |
| ------------ | --------------------------------------------- | ------------------------------- |
| `frame.png`  | Figma 7142:29237, the bands with no bulbs      | rail geometry, the two colours  |
| `expand.png` | Figma 7142:29286, the whole sign               | bulb pitch and dome diameter    |
| `bulb.png`   | the dome's own art, trimmed to its ink         | the bulb, drawn into the frame  |

`frame.png` is the node EXPORT, so its middle is opaque white rather than transparent — see the
white-fill trap in the Figma notes. That is harmless here: nothing is copied out of it, only
measured, and the measuring looks for gold and purple.

## Outputs

* `static/assets/theme-park/v2/features/anticipation-marquee.webp` — the sign, bulbs unlit.
* `src/game/anticipationFrame.ts` — the aspect, the bulb size, and every bulb's centre and place in
  the run around the perimeter.

Bulbs are drawn into the art UNLIT and lit by <WinCardLights>, the same as the marquee pad. The
table carries each bulb's PERIMETER POSITION as well as its centre, because that component's default
chase runs on the angle about the centre — which is right for a wide sign and wrong for this one,
where it would light the whole left rail and the whole right rail as two lumps.
"""

import pathlib

import numpy as np
from PIL import Image, ImageDraw

BASE = pathlib.Path(__file__).resolve().parent
APP = pathlib.Path(__file__).resolve().parents[2]
SOURCE = BASE / 'source'
OUT_ART = APP / 'static/assets/theme-park/v2/features/anticipation-marquee.webp'
OUT_TS = APP / 'src/game/anticipationFrame.ts'

#: The rect the game draws the frame in, in board design units — a reel column, a shade proud of the
#: board's height. From game/constants.ts: CELL_W = SYMBOL_H * 691 / 457, BOARD_SIZES.height =
#: CELL_H * BOARD_DIMENSIONS.y, CELL_H = SYMBOL_H * 1.05. Only the ASPECT of this reaches the game —
#: <Anticipation> takes its width from the reel and its height from the aspect — so a later change to
#: the cell size moves the frame without distorting it, and only a change to the SHAPE of a reel is
#: a reason to rebuild.
SYMBOL_H = 103
CELL_W = SYMBOL_H * 691 / 457
CELL_H = SYMBOL_H * 1.05
TARGET_W = CELL_W * 1.02
TARGET_H = CELL_H * 5 * 1.015

#: Rendered width of the art. The frame is drawn about a fifth of the stage wide and the game runs at
#: up to 2x, so this has a comfortable margin over the ~400px it is ever asked for.
OUT_W = 448

def load(name):
    return Image.open(SOURCE / name).convert('RGBA')


def runs(mask):
    """Contiguous True runs of a 1-D boolean as (start, end) inclusive."""
    indices = np.nonzero(mask)[0]
    if not len(indices):
        return []
    out = []
    start = previous = indices[0]
    for index in indices[1:]:
        if index != previous + 1:
            out.append((int(start), int(previous)))
            start = index
        previous = index
    out.append((int(start), int(previous)))
    return out


def is_gold(pixels):
    return (pixels[..., 0] > 150) & (pixels[..., 2] < 110)


def band_geometry():
    """The rail, measured across the middle of the bulb-less frame.

    Returns everything as a fraction of the frame's INK width — the sign itself, not the node's box,
    which carries padding either side — plus the two colours.
    """
    art = np.asarray(load('frame.png').convert('RGB')).astype(int)
    height, width, _ = art.shape
    row = art[height // 2]
    gold = is_gold(row)
    gold_runs = runs(gold)
    if len(gold_runs) != 4:
        raise SystemExit(f'expected 4 gold lines across the frame, found {len(gold_runs)}')
    outer_left, inner_left, inner_right, outer_right = gold_runs
    ink = outer_right[1] - outer_left[0] + 1

    # The gold line is averaged over all four; the band is measured on the LEFT rail alone, since the
    # right is its mirror and averaging the two would only hide a source that is out of symmetry.
    line = float(np.mean([r[1] - r[0] + 1 for r in gold_runs]))
    band = float(inner_left[0] - outer_left[1] - 1)

    gold_colour = tuple(int(v) for v in art[height // 2, outer_left[0] + round(line / 2)])
    purple_colour = tuple(int(v) for v in art[height // 2, outer_left[1] + 1 + round(band / 2)])
    return {
        'ink': ink,
        'line': line / ink,
        'band': band / ink,
        'rail': (line * 2 + band) / ink,
        'gold': gold_colour,
        'purple': purple_colour,
        'purple_rgb': np.array(purple_colour),
    }


def bulb_geometry(rail):
    """Bulb pitch and dome diameter, from the sign WITH its bulbs, as fractions of the ink width.

    Read down the middle of the left band, where the run alternates band, dome, band. The dome is
    whatever is not the band's purple — its rim is nearly black and its face is gold, and both belong
    to the bulb.
    """
    art = np.asarray(load('expand.png').convert('RGB')).astype(int)
    height, width, _ = art.shape
    gold = is_gold(art)

    # The ink box, from the outermost gold anywhere in the sign.
    columns = np.nonzero(gold.any(0))[0]
    rows = np.nonzero(gold.any(1))[0]
    ink = columns[-1] - columns[0] + 1
    band_centre = int(round(columns[0] + rail['rail'] * ink / 2))

    column = art[:, band_centre]
    not_band = np.abs(column - rail['purple_rgb']).sum(1) > 90
    # Clear of the top and bottom rails, whose gold lines cross this column too.
    inside = np.zeros(height, bool)
    inside[rows[0] + int(rail['rail'] * ink) : rows[-1] - int(rail['rail'] * ink)] = True
    domes = runs(not_band & inside)
    if len(domes) < 6:
        raise SystemExit(f'expected a run of bulbs down the band, found {len(domes)}')

    centres = [(s + e) / 2 for s, e in domes]
    pitch = float(np.mean(np.diff(centres)))
    dome = float(np.mean([e - s + 1 for s, e in domes]))
    return {'pitch': pitch / ink, 'dome': dome / ink, 'measured': len(domes)}


def perimeter_ring(width, height, rail, pitch):
    """Bulb centres around the middle of the band, and each one's place in the run, 0-1.

    The four corners are single bulbs shared by two sides — that is what the design does, and it is
    also the only way the spacing can stay even all the way round. Each side gets the bulb count that
    lands its own spacing nearest the design's pitch, so the top and bottom of a tall frame are not
    forced to the side's count.
    """
    left = rail / 2
    right = width - rail / 2
    top = rail / 2
    bottom = height - rail / 2
    span_x = right - left
    span_y = bottom - top

    down = max(1, round(span_y / pitch))
    across = max(1, round(span_x / pitch))

    ring = []
    # Clockwise from the top-left corner, so `place` is the distance travelled around the run.
    for step in range(across):
        ring.append((left + span_x * step / across, top))
    for step in range(down):
        ring.append((right, top + span_y * step / down))
    for step in range(across):
        ring.append((right - span_x * step / across, bottom))
    for step in range(down):
        ring.append((left, bottom - span_y * step / down))

    total = 2 * (span_x + span_y)
    places = []
    travelled = 0.0
    for index, point in enumerate(ring):
        places.append(travelled / total)
        following = ring[(index + 1) % len(ring)]
        travelled += abs(following[0] - point[0]) + abs(following[1] - point[1])
    return ring, places, down + 1, across + 1


def draw_frame(size, rail, line, colours):
    """The sign itself: an outer gold line, the purple band, an inner gold line, an open middle."""
    width, height = size
    art = Image.new('RGBA', size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(art)
    draw.rectangle([0, 0, width - 1, height - 1], fill=colours['gold'] + (255,))
    draw.rectangle([line, line, width - 1 - line, height - 1 - line], fill=colours['purple'] + (255,))
    inner = rail - line
    draw.rectangle([inner, inner, width - 1 - inner, height - 1 - inner], fill=colours['gold'] + (255,))
    draw.rectangle([rail, rail, width - 1 - rail, height - 1 - rail], fill=(0, 0, 0, 0))
    return art


def paste_bulbs(art, ring, dome_px):
    """Every bulb, unlit, on the band. Drawn once and reused, so all 48 are the same pixels."""
    source = load('bulb.png')
    height_px = max(1, round(dome_px * source.height / source.width))
    bulb = source.resize((max(1, round(dome_px)), height_px), Image.LANCZOS)
    for x, y in ring:
        art.alpha_composite(bulb, (round(x - bulb.width / 2), round(y - bulb.height / 2)))
    return art


def emit(aspect, dome, bulbs, places, counts):
    points = ' '.join(f'{x:.5f},{y:.5f}' for x, y in bulbs)
    packed_places = ' '.join(f'{p:.5f}' for p in places)
    down, across = counts
    text = f'''// GENERATED by scripts/anticipation/build_anticipation.py — see the docstring there.
// Do not hand-edit.
//
// The anticipation reel marquee (Figma 7142:29286): the sign that lights up around a reel still
// spinning while the board waits on a bonus scatter.
//
// Coordinates are in FRAME-WIDTH units from the frame's centre, both axes — the convention
// <WinCardLights> takes — so <Anticipation> sizes the whole sign off the width of a reel.

/** Width / height of the art. The frame is as wide as a reel; this is what makes it as tall. */
export const ANTICIPATION_ASPECT = {aspect:.5f};

/** The dome's diameter, in frame widths, so the light stays in scale with the bulb under it. */
export const ANTICIPATION_BULB = {dome:.5f};

/**
 * Every bulb's centre, clockwise from the top-left corner. {down} down each side and {across} across
 * the top and bottom, corners shared — the count is not the design's, because the design's frame is
 * far wider for its height than a reel is and what carries over is the PITCH, not the number.
 */
export const ANTICIPATION_BULBS: [number, number][] = '{points}'
	.split(' ')
	.map((pair) => {{
		const [x, y] = pair.split(',');
		return [Number(x), Number(y)];
	}});

/**
 * Where each bulb sits in the run AROUND the frame, 0-1 — handed to <WinCardLights> as its chase
 * order. Its own default orders bulbs by their ANGLE about the centre, which is right for a sign
 * that is roughly as wide as it is tall and wrong for this one: nearly every bulb here is at some
 * angle near straight up or straight down, so a chase would light the two long rails as two lumps
 * instead of running round the sign.
 */
export const ANTICIPATION_PLACES: number[] = '{packed_places}'.split(' ').map(Number);
'''
    OUT_TS.write_text(text)


def main():
    rail_ratios = band_geometry()
    bulb_ratios = bulb_geometry(rail_ratios)

    aspect = TARGET_W / TARGET_H
    out_h = round(OUT_W / aspect)
    rail_px = rail_ratios['rail'] * OUT_W
    line_px = rail_ratios['line'] * OUT_W
    pitch_px = bulb_ratios['pitch'] * OUT_W
    dome_px = bulb_ratios['dome'] * OUT_W

    ring, places, down, across = perimeter_ring(OUT_W, out_h, rail_px, pitch_px)
    art = draw_frame((OUT_W, out_h), round(rail_px), round(line_px), rail_ratios)
    art = paste_bulbs(art, ring, dome_px)

    OUT_ART.parent.mkdir(parents=True, exist_ok=True)
    art.save(OUT_ART, 'WEBP', quality=92, method=6)

    bulbs = [((x - OUT_W / 2) / OUT_W, (y - out_h / 2) / OUT_W) for x, y in ring]
    emit(aspect, bulb_ratios['dome'], bulbs, places, (down, across))

    print(f'source  rail {rail_ratios["rail"]:.5f}w  line {rail_ratios["line"]:.5f}w  '
          f'gold #{rail_ratios["gold"][0]:02x}{rail_ratios["gold"][1]:02x}{rail_ratios["gold"][2]:02x}  '
          f'purple #{rail_ratios["purple"][0]:02x}{rail_ratios["purple"][1]:02x}{rail_ratios["purple"][2]:02x}')
    print(f'bulbs   pitch {bulb_ratios["pitch"]:.5f}w  dome {bulb_ratios["dome"]:.5f}w  '
          f'({bulb_ratios["measured"]} measured down the design)')
    print(f'frame   {OUT_W}x{out_h}  aspect {aspect:.5f}  {len(ring)} bulbs '
          f'({down} down, {across} across, corners shared)')
    print(f'{OUT_ART.stat().st_size // 1024:4d} KB  {OUT_ART.relative_to(APP)}')
    print(f'-> {OUT_TS.relative_to(APP)}')

    preview = Image.new('RGBA', art.size, (26, 12, 42, 255))
    preview.alpha_composite(art)
    preview.convert('RGB').save(BASE / 'verify_anticipation.png')


if __name__ == '__main__':
    main()
