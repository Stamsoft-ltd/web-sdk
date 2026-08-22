"""Cut the base-game backdrop — the daylight park plaza and the house that stands in it.

    python3 scripts/background/build_background.py

Figma 7051:2111 draws the scene as TWO nodes: the plaza (7051:2112) and a larger house (7051:2235)
laid over the small one the plaza art already has painted into its left edge. That split is the whole
point of this script: the house ships on its own so its bulbs can be lit in code.

## What comes out

| asset                                  | what it is                                          |
| -------------------------------------- | --------------------------------------------------- |
| `v2/park/plaza.webp`                    | the whole scene, painted house and all               |
| `v2/park/house.webp`                    | the overlay house, transparent                       |

and `src/game/parkScene.ts`, generated: the plaza's aspect, where the house is pinned in it, every
bulb on the house, its lit panes, and the plaza's four lamp lanterns.

## Two things worth knowing

* **The house is pinned to the plaza, not to the canvas.** The plaza has its own smaller house
  painted in — the overlay covers it exactly, the way the Figma frame composes them — so anything
  that moves the overlay off the backdrop's cover transform reveals the painted one underneath.
* **The plaza's own house is excluded from lamp detection** (`LAMP_MIN_X`). Its window and door
  bulbs are the brightest warm pixels in the art, and they are also the ones nobody ever sees.
"""

import pathlib
from collections import deque

import numpy as np
from PIL import Image, ImageDraw

BASE = pathlib.Path(__file__).resolve().parent
APP = pathlib.Path(__file__).resolve().parents[2]
PLAZA_SRC = BASE / 'source' / 'plaza.png'
HOUSE_SRC = BASE / 'source' / 'house.png'
OUT_TS = APP / 'src/game/parkScene.ts'

#: The plaza fills the screen behind the reels, so it carries the most pixels of anything in the
#: game; 1920 is a 1:1 read on a full-HD stage and 8 MB of texture, where the 3x Figma export is 60.
PLAZA_WIDTH = 1920
#: The house is a third of that width on screen. 760 leaves it sharp when the art is cover-scaled
#: past the canvas on a tall window.
HOUSE_WIDTH = 760

#: The frame's own size, which is what the plaza export is clipped to.
FRAME = (1197, 670)

#: Where the house goes, given as the box its BULB RUN has to land in — fractions of the plaza's
#: width, except `top`, which is a fraction of its height. It hangs off the left edge, which is why
#: `left` is negative and the sprite has to be allowed to overflow.
#:
#: Registering on the bulbs rather than on the drawing's own edges is what lets the house be
#: redrawn. The flower beds banked around it have already changed size once, and when they do the
#: bbox of the PNG moves while the building inside it does not — pin the sprite by its bbox and the
#: house slides off the smaller one the plaza has painted underneath it. The bulb run is nailed to
#: the building.
HOUSE_BULB_BOX = {'left': -0.03411, 'top': 0.49478, 'width': 0.22223}

# ── Finding the house's bulbs ───────────────────────────────────────────────────────────────────
#
# They are painted as pale cream discs with a warm ring already around them, on a purple roof and an
# orange wall. Nothing else on the house is that pale, so the mask is loose and the AREA test is
# what does the work: every disc lands between 240 and 400 px at this size.
#:
#: Loose on purpose. The house has been redrawn soft once already, and a tight mask on soft art
#: finds only the blown-out core of each disc: 36 blobs, all of them half the size of the bulb they
#: are in, which is a diameter — and so a glow — measurably too small. Every threshold from here to
#: R>185 finds the same 36 blobs, so this sits in the middle of that plateau rather than at its edge.
BULB = lambda a: (
    (a[..., 3] > 200) & (a[..., 0] > 195) & (a[..., 1] > 170) & (a[..., 2] < 245) & (a[..., 2] > 90)
)
BULB_AREA = (60, 1400)
BULB_RATIO = (0.6, 1.6)
BULB_FILL = 0.6  # area / bbox area; a disc is pi/4 = 0.785

# The house SHIPS LIT — the drawing's own bulbs, untouched. Erasing the painted cores and leaving
# the amber rail as a run of empty sockets was tried and rejected on sight: a sunlit house with half
# its bulbs visibly dark reads as derelict, not as a marquee. The bulbs stay painted on, and the
# blink is a BLOOM on top of them rather than an on/off — see <ParkHouse>.

#: The lit panes: the window's four quadrants and the door's fanlight. Deeper and more saturated
#: than the bulbs, which is what separates the two.
PANE = lambda a: (
    (a[..., 3] > 200) & (a[..., 0] > 225) & (a[..., 1] > 170) & (a[..., 1] < 225) & (a[..., 2] < 150)
)
#: Big enough to be a lit opening rather than a warm speck on a flower.
PANE_AREA = 2200
#: Muntins split the window into four and the door's frame splits its fanlight in two; this closes
#: those gaps so each opening comes out as one rect rather than as its glazing bars. A fraction of
#: the art's width, because it is a distance on the drawing and the drawing gets re-exported.
#:
#: There is not much room either side of it: below this the window comes out as four quadrants, and
#: not far above it the run of bulbs along the gable closes into one blob and is mistaken for a
#: third opening. PANE_COUNT is the guard — get this wrong and the house grows a lit roof.
PANE_JOIN = 0.0148
PANE_COUNT = 2

# ── Finding the plaza's lanterns ────────────────────────────────────────────────────────────────
#
# Warm and bright against a scene that is otherwise blue, green and orange. Measured on a normalised
# 1197x670 downsample so the thresholds do not move when the source is re-exported at another scale.
LAMP = lambda a: (a[..., 0] > 205) & (a[..., 1] > 178) & (a[..., 1] - a[..., 2] > 28)
#: Each lantern is three panes of glass; this joins them into one.
LAMP_JOIN = 6
#: Only the avenue. Above it is the ferris wheel's lit hub, below it are the flower beds.
LAMP_BAND = (0.34, 0.64)
#: Left of this is the plaza's own painted house, which the overlay covers — its window and door
#: bulbs are the brightest warm pixels in the art and none of them is ever seen.
LAMP_MIN_X = 0.2
LAMP_MIN_AREA = 40
LAMP_MIN_HEIGHT = 10


def components(mask, join=1):
    """Connected components of a boolean mask as (area, x0, y0, x1, y1, cx, cy), largest first.

    `join` is the reach of the neighbourhood: at 1 it is ordinary 8-connectivity, and above it
    pieces that are close but not touching — the panes of one lantern, the quarters of one window —
    come out as a single component.

    Walks only the set pixels; the mask is a scatter of small blobs on a big canvas and scanning it
    row by row is orders of magnitude more work.
    """
    ys, xs = np.nonzero(mask)
    todo = set(zip(ys.tolist(), xs.tolist()))
    out = []
    while todo:
        queue = deque([todo.pop()])
        blob = []
        while queue:
            cy, cx = queue.popleft()
            blob.append((cy, cx))
            for dy in range(-join, join + 1):
                for dx in range(-join, join + 1):
                    point = (cy + dy, cx + dx)
                    if point in todo:
                        todo.discard(point)
                        queue.append(point)
        bx = [p[1] for p in blob]
        by = [p[0] for p in blob]
        out.append(
            (len(blob), min(bx), min(by), max(bx) + 1, max(by) + 1, sum(bx) / len(blob), sum(by) / len(blob))
        )
    out.sort(reverse=True)
    return out


def find_bulbs(rgba):
    """Disc centres in pixels, plus the mean disc diameter."""
    kept = []
    for area, x0, y0, x1, y1, cx, cy in components(BULB(rgba)):
        w, h = x1 - x0, y1 - y0
        if not BULB_AREA[0] < area < BULB_AREA[1]:
            continue
        if not BULB_RATIO[0] <= w / h <= BULB_RATIO[1]:
            continue
        if area / (w * h) < BULB_FILL:
            continue
        kept.append((cx, cy, (w + h) / 2))
    # Top to bottom, left to right. Nothing reads them in order, but a stable order keeps the diff
    # of a regenerated table down to the numbers that actually moved.
    kept.sort(key=lambda b: (round(b[1], -1), b[0]))
    return [(x, y) for x, y, _ in kept], float(np.mean([d for _, _, d in kept]))


def bulb_colour(rgba, bulbs, radius):
    """The colour to light a disc with: its cream core mixed with the warm ring painted around it.

    Sampled from the ring rather than from the roof and wall the bulbs are nailed to — those are
    purple and orange, and averaging them gives a dirty mauve that reads as a smudge on screen.
    Normalised to full brightness, since this tints an additive sprite.
    """
    h, w = rgba.shape[:2]
    samples = []
    for x, y in bulbs:
        x, y = int(x), int(y)
        core = [(dx, dy) for dx in range(-2, 3) for dy in range(-2, 3)]
        ring = [
            (dx, dy)
            for dx in range(-int(radius * 1.5), int(radius * 1.5) + 1)
            for dy in range(-int(radius * 1.5), int(radius * 1.5) + 1)
            if radius**2 <= dx * dx + dy * dy <= (radius * 1.5) ** 2
        ]
        for offsets in (core, ring):
            samples.append(
                np.mean(
                    [rgba[min(h - 1, max(0, y + dy)), min(w - 1, max(0, x + dx)), :3] for dx, dy in offsets],
                    0,
                )
            )
    rgb = np.mean(samples, 0)
    rgb = rgb / rgb.max() * 255
    return (round(rgb[0]) << 16) | (round(rgb[1]) << 8) | round(rgb[2])


def find_panes(rgba):
    """The lit openings — the window and the door's fanlight — as pixel rects, largest first."""
    found = [
        (x0, y0, x1, y1)
        for area, x0, y0, x1, y1, _, _ in components(PANE(rgba), round(rgba.shape[1] * PANE_JOIN))
        if area >= PANE_AREA
    ]
    if len(found) != PANE_COUNT:
        raise SystemExit(
            f'found {len(found)} lit openings, expected {PANE_COUNT} — retune PANE_JOIN and look at '
            'the sheet before changing PANE_COUNT'
        )
    return found


def find_lamps(plaza):
    """The plaza's lanterns as (x, y, size) in art fractions, size relative to the biggest."""
    small = plaza.convert('RGB').resize(FRAME, Image.LANCZOS)
    a = np.asarray(small).astype(int)
    mask = LAMP(a)
    h, w = mask.shape
    rows = np.arange(h)[:, None]
    mask &= (rows > LAMP_BAND[0] * h) & (rows < LAMP_BAND[1] * h)

    kept = []
    for area, x0, y0, x1, y1, cx, cy in components(mask, LAMP_JOIN):
        if area < LAMP_MIN_AREA or y1 - y0 < LAMP_MIN_HEIGHT or cx / w < LAMP_MIN_X:
            continue
        kept.append((cx / w, cy / h, float(y1 - y0)))
    tallest = max(glass for _, _, glass in kept)
    kept.sort(key=lambda lamp: lamp[0])
    return [(x, y, glass / tallest) for x, y, glass in kept]


def place_house(bulbs):
    """The sprite's centre and width in plaza fractions, so its bulb run lands on HOUSE_BULB_BOX.

    Inverts exactly what <ParkHouse> does with the result: it puts the sprite's centre at the
    backdrop's (x, y) and scales every bulb offset by the sprite's WIDTH on both axes, so the y here
    has to be converted through the plaza's aspect and not through its height.
    """
    xs = [x for x, _ in bulbs]
    ys = [y for _, y in bulbs]
    width = HOUSE_BULB_BOX['width'] / (max(xs) - min(xs))
    x = HOUSE_BULB_BOX['left'] - min(xs) * width
    y = HOUSE_BULB_BOX['top'] - min(ys) * width * (FRAME[0] / FRAME[1])
    return x, y, width


def emit(house_aspect, house_at, bulbs, diameter, colour, panes, lamps):
    packed = ' '.join(f'{x:.5f},{y:.5f}' for x, y in bulbs)
    pane_lines = '\n'.join(
        f'\t{{ x: {p["x"]:.5f}, y: {p["y"]:.5f}, w: {p["w"]:.5f}, h: {p["h"]:.5f} }},' for p in panes
    )
    lamp_lines = '\n'.join(
        f'\t{{ x: {x:.4f}, y: {y:.4f}, size: {size:.2f} }},' for x, y, size in lamps
    )
    text = f'''// GENERATED by scripts/background/build_background.py — see the README there. Do not hand-edit.
//
// The base-game park: the plaza backdrop, the house that stands in it, and the lights on both.

const points = (packed: string): [number, number][] =>
	packed.split(' ').map((pair) => {{
		const [x, y] = pair.split(',');
		return [Number(x), Number(y)];
	}});

/** Width / height of the plaza art. */
export const PARK_ASPECT = {FRAME[0]} / {FRAME[1]};

/**
 * Where the house is pinned in the plaza: its centre and width as fractions of the backdrop's DRAWN
 * width and height, so it rides the same cover transform the art does.
 *
 * It hangs off the left edge, and it has to: the plaza has a smaller house painted into that corner
 * and this one covers it. Moving it reveals the painted one. Solved from the bulb run rather than
 * from the drawing's edges, so a redraw with bigger flower beds does not slide the building.
 */
export const PARK_HOUSE = {{ x: {house_at[0]:.5f}, y: {house_at[1]:.5f}, w: {house_at[2]:.5f} }};

/** Width / height of the house art, including whatever transparent margin it was drawn with. */
export const HOUSE_ASPECT = {house_aspect:.5f};

/**
 * The bulb as the art draws it: a cream disc, painted already lit. `size` is its diameter, so a glow
 * can be sized off the thing it is lighting rather than off a number that has to be re-tuned
 * whenever the house is re-exported at another width.
 */
export const HOUSE_BULB = {{ size: {diameter:.5f}, colour: 0x{colour:06x} }};

/**
 * Every bulb on the gables and the door arch, in HOUSE-WIDTH units from the house's centre on both
 * axes — the convention <WinCardLights> wants.
 */
export const HOUSE_BULBS: [number, number][] = points(
	'{packed}',
);

/** The lit openings — the window and the door's fanlight — in the same units. */
export const HOUSE_PANES = [
{pane_lines}
];

/**
 * The plaza's lamp lanterns: the glass of each, as fractions of the backdrop's drawn width and
 * height, with `size` relative to the biggest. The two down the avenue are a third of the near
 * pair, which is what sells the distance.
 */
export const PARK_LAMPS = [
{lamp_lines}
];
'''
    OUT_TS.write_text(text)


def main():
    plaza = Image.open(PLAZA_SRC).convert('RGBA')
    house = Image.open(HOUSE_SRC).convert('RGBA')
    rgba = np.asarray(house).astype(int)
    hw, hh = house.size
    house_aspect = hw / hh

    bulbs_px, diameter = find_bulbs(rgba)
    colour = bulb_colour(rgba, bulbs_px, diameter / 2)
    #: House-width units from the house's centre, on both axes.
    bulbs = [((x - hw / 2) / hw, (y - hh / 2) / hw) for x, y in bulbs_px]

    panes_px = find_panes(rgba)
    panes = [
        {
            'x': ((x0 + x1) / 2 - hw / 2) / hw,
            'y': ((y0 + y1) / 2 - hh / 2) / hw,
            'w': (x1 - x0) / hw,
            'h': (y1 - y0) / hw,
        }
        for x0, y0, x1, y1 in panes_px
    ]

    lamps = find_lamps(plaza)

    for art, width, name in ((plaza, PLAZA_WIDTH, 'plaza'), (house, HOUSE_WIDTH, 'house')):
        path = APP / f'static/assets/theme-park/v2/park/{name}.webp'
        path.parent.mkdir(parents=True, exist_ok=True)
        scaled = art.resize((width, round(width * art.height / art.width)), Image.LANCZOS)
        # The plaza has no transparency and never will — it is the bottom of the stack — so it ships
        # as RGB, which is a third off the file and a quarter off the texture.
        if name == 'plaza':
            scaled = scaled.convert('RGB')
        scaled.save(path, 'WEBP', quality=90, method=6)
        print(f'{width:5d}px  {path.stat().st_size // 1024:5d} KB  {path.relative_to(APP)}')

    house_at = place_house(bulbs)
    emit(house_aspect, house_at, bulbs, diameter / hw, colour, panes, lamps)
    print(f'house aspect {house_aspect:.4f}  bulbs {len(bulbs)}  disc {diameter / hw:.5f}w  #{colour:06x}')
    print(f'house at {house_at[0]:.5f},{house_at[1]:.5f}  w {house_at[2]:.5f}')
    print(f'panes {len(panes)}   lamps {len(lamps)}')
    for x, y, size in lamps:
        print(f'  lamp {x:.4f},{y:.4f}  size {size:.2f}')
    print(f'-> {OUT_TS.relative_to(APP)}')

    # === THE SHEET ===
    # The house composited where it will actually sit, with every bulb ringed and every lantern
    # circled. A missed bulb is a dead spot in the chase and a lantern that is really a flower bed is
    # a glow floating in the shrubbery — neither is visible in the table.
    box_w = round(house_at[2] * plaza.width)
    box_h = round(box_w / house_aspect)
    box_x = round(house_at[0] * plaza.width - box_w / 2)
    box_y = round(house_at[1] * plaza.height - box_h / 2)
    sheet = plaza.copy()
    sheet.alpha_composite(
        house.resize((box_w, box_h), Image.LANCZOS), (max(0, box_x), box_y), source=(max(0, -box_x), 0)
    )
    draw = ImageDraw.Draw(sheet)
    scale = box_w / hw
    for x, y in bulbs_px:
        r = diameter * scale * 0.75
        px, py = box_x + x * scale, box_y + y * scale
        draw.ellipse([px - r, py - r, px + r, py + r], outline=(0, 255, 120, 255), width=3)
    for x0, y0, x1, y1 in panes_px:
        draw.rectangle(
            [box_x + x0 * scale, box_y + y0 * scale, box_x + x1 * scale, box_y + y1 * scale],
            outline=(255, 80, 200, 255),
            width=3,
        )
    for x, y, size in lamps:
        r = plaza.width * 0.012 * (0.5 + size * 0.5)
        px, py = x * plaza.width, y * plaza.height
        draw.ellipse([px - r, py - r, px + r, py + r], outline=(60, 200, 255, 255), width=4)
    sheet.convert('RGB').resize((1400, round(1400 * plaza.height / plaza.width))).save(
        BASE / 'verify_background.png'
    )
    print('wrote verify_background.png')


if __name__ == '__main__':
    main()
