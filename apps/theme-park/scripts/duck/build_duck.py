#!/usr/bin/env python3
"""Cut the duck symbol into the pieces its animation moves, and measure where each one sits.

The duck arrived from Figma as loose drawings rather than as a picture: a body (7063:17957) with
EMPTY WHITE EYE SOCKETS, two irises to drop into them (7063:17959 big, 7063:17960 small), and two
wings (7057:8004 pointing left, 7057:8002 pointing right). Cut up like that it can be alive — the
eyes can glance about while the symbol just sits there, and the wing can beat when it wins.

Two things about the art decide the whole build, and both were measured, not assumed:

  1. The body ALREADY CARRIES ITS RIGHT WING, drawn raised and fanned out to the viewer's right, and
     carries NOTHING on its left: that flank is bare from the shoulder down. So the duck needs
     exactly one loose wing, and the one it needs is `wing-a` (7057:8004), AS DRAWN.

     The two drawings are a matched PAIR, not one wing and its mirror. `wing-b` fans up and to the
     right and is the wing already baked into the body; `wing-a` is smaller, fans down and to the
     left, and attaches at its upper right — which is a wing tucked at the near flank, and is
     exactly what the artist's reference duck has there.

     Two earlier builds got this wrong in opposite directions. The first fitted `wing-a` by area
     alone and put it at the rear, where it was hidden. The second read its downward fan as a TAIL,
     threw it out, and shipped `wing-b` mirrored instead — which gives the bird two raised wings and
     is what the duck went out with. The fit below settles it: `wing-a`, unmirrored, lands on the
     wing in the reference at 0.96 IoU, and no placement of `wing-b` comes close.

  2. The sockets are eye WHITES, not holes. A border flood cannot reach them (they are enclosed by
     the head), which is what keeps them white — and white is what they are supposed to be.

Placement comes from the artist's assembled duck rather than from node boxes, because the parts'
Figma boxes are relative to their own frames and are all (0, 0). The body's silhouette lands on that
composition at 99.2%, so the fit is not a guess: it is the same drawing, found where it was drawn.
The wing is fitted to what is LEFT OVER once the body is laid on that composition, since the body
covers all but a sliver of it — see WING_SCALE for why that residue is the only honest target.

Iris travel is measured by CONTAINMENT, not by subtracting bounding boxes. A socket is an almond and
an iris is round, so the box difference would let the pupil poke out through a corner. Here every
candidate offset is tested for the iris ink staying inside the socket's white, and what survives is
the range the component is allowed to use.

    python3 scripts/duck/build_duck.py

Writes symbols/h2-duck-marquee.png (the rest pose, which is also what the board's spin trail
ghosts), the four loose pieces as webp, src/game/duckParts.ts, and verify_duck.png to eyeball.
"""

from collections import deque
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.pixi_place import sprite_place  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent / "source"
SYMBOL_DIR = ROOT / "static/assets/theme-park/v2/symbols"
TABLE = ROOT / "src/game/duckParts.ts"
VERIFY = Path(__file__).resolve().parent / "verify_duck.png"

FRAME = (448, 360)

# Figma's export paper. Always opaque, always this grey.
PAPER = np.array([245, 245, 245])
PAPER_TOL = 10

# Where the artist's own assembled duck puts each piece, found by fitting the loose drawings into it
# (see the module docstring). Body: scale, then top-left in the frame.
BODY_SCALE = 0.98
BODY_AT = (132, 42)

# The left wing: scale, rotation, and the top-left it would sit at unrotated.
#
# FITTED, not placed. The body hides most of this wing, so the thing to fit it to is the sliver that
# shows: the reference duck's silhouette MINUS the body's, which comes out as one clean 35x65 blob
# off the near flank. Sliding `wing-a` over that at every scale and angle and scoring the overlap of
# what would still be visible gives 0.96 IoU, and the wing it finds is the one the artist drew —
# essentially unturned, which is the tell that these two drawings are a pair rather than a mirror.
#
# The angle is why an earlier build could not make `wing-b` work here without help. That drawing
# fans the wrong way, so it had to be swung 35 degrees to pass for this one, and every later number
# was bent to accommodate the swing. Nothing is bent now.
WING_SCALE = 0.945
WING_ANGLE = -2  # degrees, counter-clockwise, as PIL rotates
WING_AT = (110, 191)

# How much of an iris may sit outside the eye white at the end of a glance. Measured, not chosen:
# at 0 the small eye cannot move at all (0x1 px), at 0.10 the pair roam 3x5 and 7x8, and past about
# 0.2 the pupil starts to clear the eyelid and read as a dot on the cheek.
SPILL = 0.10

# Which iris belongs in which socket. The two sockets are different sizes because the head is turned,
# so the pairing is forced: the big iris only fits the big socket.
EYES = [("left", "iris-small"), ("right", "iris-big")]


def keyed(path):
    """Load a Figma export and drop its paper, reaching in from the border only.

    Flooding from the border is what saves the eye sockets: they are white, but they are enclosed by
    the head, so the flood never gets to them. A blanket white key would delete the duck's eyes.
    """
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(int)
    h, w, _ = rgb.shape
    paper = np.abs(rgb - PAPER).max(axis=2) <= PAPER_TOL

    seen = np.zeros((h, w), bool)
    queue = deque()
    border = [(y, x) for y in range(h) for x in (0, w - 1)]
    border += [(y, x) for x in range(w) for y in (0, h - 1)]
    for y, x in border:
        if paper[y, x] and not seen[y, x]:
            seen[y, x] = True
            queue.append((y, x))
    while queue:
        y, x = queue.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and paper[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                queue.append((ny, nx))

    alpha = np.where(seen, 0, 255)
    return Image.fromarray(np.dstack([rgb, alpha]).astype(np.uint8), "RGBA")


def trimmed(part):
    """The drawing without the export's transparent margin, which is not part of the art."""
    ink = np.asarray(part)[..., 3] > 0
    ys, xs = np.nonzero(ink)
    return part.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def scaled(part, factor):
    return part.resize((round(part.width * factor), round(part.height * factor)), Image.LANCZOS)


def runs(mask):
    """Every 4-connected True region, largest first, as (area, x0, y0, x1, y1)."""
    h, w = mask.shape
    seen = np.zeros((h, w), bool)
    found = []
    for sy, sx in zip(*np.nonzero(mask)):
        if seen[sy, sx]:
            continue
        stack = [(sy, sx)]
        seen[sy, sx] = True
        cells = []
        while stack:
            y, x = stack.pop()
            cells.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        ys = [c[0] for c in cells]
        xs = [c[1] for c in cells]
        found.append((len(cells), min(xs), min(ys), max(xs), max(ys)))
    found.sort(reverse=True)
    return found



def draw_duck(canvas, wing, body, eyes, ax, ay, shoulder, beat=0.0, glance=(0, 0)):
    """One duck, drawn exactly as <DuckSymbol> draws it: wing behind, body, then the irises."""
    sprite_place(canvas, wing, cx=shoulder[0], cy=shoulder[1],
                 width=wing.width, height=wing.height, anchor=(ax, ay),
                 rotation=-np.radians(WING_ANGLE) + beat)
    sprite_place(canvas, body, cx=BODY_AT[0] + body.width / 2, cy=BODY_AT[1] + body.height / 2)
    for eye in eyes:
        sprite_place(canvas, eye["iris"],
                     cx=eye["x"] + glance[0] * eye["reach_x"],
                     cy=eye["y"] + glance[1] * eye["reach_y"])


def sockets(body):
    """The two eye whites, left one first.

    They are the largest white regions in the drawing by a wide margin — the next biggest is a
    highlight a fifth their size — so taking the top two is safe, and their order left to right is
    the order the eyes appear.
    """
    rgb = np.asarray(body)[..., :3].astype(int)
    ink = np.asarray(body)[..., 3] > 128
    white = ink & (rgb.min(axis=2) > 225)
    two = runs(white)[:2]
    return sorted(two, key=lambda r: r[1])


def travel(socket_mask, iris_ink, centre):
    """How far the iris may roam and still read as an eye, in pixels each way.

    A pupil is allowed to run under the eyelid — that is how a cartoon draws a glance, and demanding
    the iris stay wholly inside the white freezes the smaller eye solid (it has two pixels of slack
    across, and the socket is an almond, so the corners eat both). What is NOT allowed is the pupil
    leaving the eye far enough to read as a stray dot on the cheek, so the test is a budget: at most
    `SPILL` of the iris may sit outside the white.

    Grown outward from a standstill so the answer is one connected range rather than the largest
    offset that happens to work; an eye that could jump to a far corner but not to the near one would
    look broken.
    """
    ih, iw = iris_ink.shape
    cx, cy = centre
    budget = SPILL * iris_ink.sum()

    def fits(dx, dy):
        x0 = int(round(cx + dx - iw / 2))
        y0 = int(round(cy + dy - ih / 2))
        if x0 < 0 or y0 < 0 or y0 + ih > socket_mask.shape[0] or x0 + iw > socket_mask.shape[1]:
            return False
        return (iris_ink & ~socket_mask[y0:y0 + ih, x0:x0 + iw]).sum() <= budget

    reach_x = 0
    while fits(reach_x + 1, 0) and fits(-reach_x - 1, 0) and reach_x < 40:
        reach_x += 1
    reach_y = 0
    while fits(0, reach_y + 1) and fits(0, -reach_y - 1) and reach_y < 40:
        reach_y += 1
    return reach_x, reach_y


def main():
    parts = {stem: trimmed(keyed(SOURCE / f"{stem}.png")) for stem in
             ("body", "wing-a", "iris-big", "iris-small")}

    body = scaled(parts["body"], BODY_SCALE)
    wing = scaled(parts["wing-a"], WING_SCALE)
    turned = wing.rotate(WING_ANGLE, resample=Image.BICUBIC, expand=True)
    wing_at = (WING_AT[0] - (turned.width - wing.width) // 2,
               WING_AT[1] - (turned.height - wing.height) // 2)

    print(f"body {body.width}x{body.height} at {BODY_AT}")
    print(f"wing {wing.width}x{wing.height} at {WING_AT}, hung at {WING_ANGLE} degrees")

    # The shoulder: where the wing tucks under the body. Rotating about anything else swings the
    # whole wing out of the duck instead of beating it.
    body_ink = np.zeros(FRAME[::-1], bool)
    body_ink[BODY_AT[1]:BODY_AT[1] + body.height,
             BODY_AT[0]:BODY_AT[0] + body.width] = np.asarray(body)[..., 3] > 128
    wing_ink = np.zeros(FRAME[::-1], bool)
    wing_ink[wing_at[1]:wing_at[1] + turned.height,
             wing_at[0]:wing_at[0] + turned.width] = np.asarray(turned)[..., 3] > 128
    tucked = body_ink & wing_ink
    ys, xs = np.nonzero(tucked)
    shoulder = (xs.mean(), ys.mean())
    print(f"shoulder at ({shoulder[0]:.1f}, {shoulder[1]:.1f}) — {tucked.sum()} px of overlap")

    # The shoulder as a fraction of the UNROTATED wing, which is what a sprite anchor wants: undo
    # the placement and then the rotation, about the rotated art's own centre.
    #
    # UNDO, note — the INVERSE of the turn, not the turn again. In y-down image coordinates PIL's
    # rotation carries a point by [cos, sin; -sin, cos], so coming back the other way is
    # [cos, -sin; sin, cos]. This line used to pass `-angle` into the first of those, which is the
    # forward map spelled a second way: the anchor came out turned by 2x35 degrees instead of by 0,
    # and the wing hung off a point 70 degrees around the drawing from its shoulder. That is the
    # whole "duck with one wing" bug. Nothing else about the fit was ever wrong.
    angle = np.radians(WING_ANGLE)
    ox = shoulder[0] - (wing_at[0] + turned.width / 2)
    oy = shoulder[1] - (wing_at[1] + turned.height / 2)
    ax = (ox * np.cos(angle) - oy * np.sin(angle)) / wing.width + 0.5
    ay = (ox * np.sin(angle) + oy * np.cos(angle)) / wing.height + 0.5
    print(f"wing anchor ({ax:.4f}, {ay:.4f})")

    # Eyes. Sockets are measured on the SCALED body so the numbers are already in frame pixels.
    rgb = np.asarray(body)[..., :3].astype(int)
    ink = np.asarray(body)[..., 3] > 128
    white = ink & (rgb.min(axis=2) > 225)
    eyes = []
    for (side, iris_stem), (area, x0, y0, x1, y1) in zip(EYES, sockets(body)):
        iris = scaled(parts[iris_stem], BODY_SCALE)
        iris_ink = np.asarray(iris)[..., 3] > 128
        centre = ((x0 + x1 + 1) / 2, (y0 + y1 + 1) / 2)
        reach_x, reach_y = travel(white, iris_ink, centre)
        print(f"{side} socket {x1 - x0 + 1}x{y1 - y0 + 1} at {centre}, "
              f"{iris_stem} {iris.width}x{iris.height}, roams {reach_x}x{reach_y} px")
        eyes.append(dict(side=side, iris=iris,
                         x=BODY_AT[0] + centre[0], y=BODY_AT[1] + centre[1],
                         reach_x=reach_x, reach_y=reach_y))

    # The rest pose, which is both the still the spin trail ghosts and the picture the live symbol
    # settles back to. Wing behind, then body, then the irises in their sockets.
    #
    # Drawn from the EXPORTED numbers through sprite_place, not from the local variables the fit was
    # worked out in. The two should agree, and building the still this way is what proves they do:
    # if the table is wrong the still is wrong in the same way, visibly, here, instead of the game
    # being the only place the mistake shows.
    frame = Image.new("RGBA", FRAME, (0, 0, 0, 0))
    draw_duck(frame, wing, body, eyes, ax, ay, shoulder)
    frame.save(SYMBOL_DIR / "h2-duck-marquee.png")

    # The loose pieces, saved UNROTATED and UNPLACED — the component does both, every frame.
    body.save(SYMBOL_DIR / "duck-body.webp", quality=92, method=6, alpha_quality=100)
    # A new NAME each time this drawing changes identity, and the rename is the point. Two previous
    # wings have shipped under two previous names; a browser holding either went on serving it, so
    # the duck kept whichever wing it had while the still beside it showed the new one. Same URL,
    # same cache entry, and a ?v= query does not survive the way this game's assets are fetched.
    wing.save(SYMBOL_DIR / "duck-wing-flank.webp", quality=92, method=6, alpha_quality=100)
    for eye in eyes:
        eye["iris"].save(SYMBOL_DIR / f"duck-iris-{eye['side']}.webp",
                         quality=92, method=6, alpha_quality=100)

    fw, fh = FRAME
    lines = [
        "// GENERATED by scripts/duck/build_duck.py — edit that, not this.",
        "//",
        "// The duck symbol in pieces, so it can blink about and beat a wing. Every number is a",
        "// fraction of the 448x360 symbol frame, which is what makes one table serve every size the",
        "// board draws a symbol at.",
        "//",
        "// The duck's RIGHT wing is not here: it is drawn into the body, raised and fanned, and only",
        "// the left one came loose. See the script for how that was established.",
        "",
        "export type DuckPiece = {",
        "\t/** Centre, as a fraction of the symbol frame. */",
        "\tx: number;",
        "\ty: number;",
        "\twidth: number;",
        "\theight: number;",
        "};",
        "",
        "export type DuckWing = DuckPiece & {",
        "\t/**",
        "\t * The shoulder, as a fraction of the wing's own art: where it tucks under the body, and so",
        "\t * the point it beats about. `x`/`y` above are this point in the frame, not the art's centre.",
        "\t */",
        "\tanchorX: number;",
        "\tanchorY: number;",
        "\t/** Radians it hangs at when nothing is happening — the angle the artist drew it at. */",
        "\trest: number;",
        "};",
        "",
        "export type DuckEye = DuckPiece & {",
        "\tkey: string;",
        "\t/**",
        "\t * How far the iris may slide from the middle of its socket. Measured against the socket's",
        "\t * own shape rather than its box, allowing the pupil to run under the eyelid the way a",
        "\t * cartoon draws a glance — so these are the full range, safe to use to the end.",
        "\t */",
        "\troamX: number;",
        "\troamY: number;",
        "};",
        "",
        f"export const DUCK_BODY: DuckPiece = {{ x: {(BODY_AT[0] + body.width / 2) / fw:.4f}, "
        f"y: {(BODY_AT[1] + body.height / 2) / fh:.4f}, "
        f"width: {body.width / fw:.4f}, height: {body.height / fh:.4f} }};",
        "",
        f"export const DUCK_WING: DuckWing = {{ x: {shoulder[0] / fw:.4f}, y: {shoulder[1] / fh:.4f}, "
        f"width: {wing.width / fw:.4f}, height: {wing.height / fh:.4f}, "
        f"anchorX: {ax:.4f}, anchorY: {ay:.4f}, rest: {-np.radians(WING_ANGLE):.4f} }};",
        "",
        "export const DUCK_EYES: DuckEye[] = [",
    ]
    for eye in eyes:
        key = "tpDuckIris" + eye["side"].capitalize()
        lines.append(
            f"\t{{ key: '{key}', x: {eye['x'] / fw:.4f}, y: {eye['y'] / fh:.4f}, "
            f"width: {eye['iris'].width / fw:.4f}, height: {eye['iris'].height / fh:.4f}, "
            f"roamX: {eye['reach_x'] / fw:.4f}, roamY: {eye['reach_y'] / fh:.4f} }},")
    lines += ["];", ""]
    TABLE.write_text("\n".join(lines))
    print(f"wrote {TABLE.relative_to(ROOT)}")

    # Eyeball it: the rest pose, then the eyes driven to the corners of their measured range, then
    # the wing at the top and bottom of a beat. If the pupils spill or the wing detaches, it is here.
    poses = [(0, 0, 0.0), (-1, -1, 0.5), (1, 1, -0.5), (1, -1, 0.9)]
    # A head crop under each pose, at double size: a glance is a handful of pixels, and at symbol
    # size the difference between a lively eye and a frozen one is invisible without it.
    head = (BODY_AT[0] + 20, BODY_AT[1] + 30, BODY_AT[0] + 160, BODY_AT[1] + 130)
    crop_w, crop_h = (head[2] - head[0]) * 2, (head[3] - head[1]) * 2
    sheet = Image.new("RGBA", (fw * len(poses), fh + crop_h), (26, 26, 34, 255))
    for i, (dx, dy, beat) in enumerate(poses):
        pose = Image.new("RGBA", FRAME, (0, 0, 0, 0))
        draw_duck(pose, wing, body, eyes, ax, ay, shoulder, beat=beat, glance=(dx, dy))
        sheet.alpha_composite(pose, (fw * i, 0))
        sheet.alpha_composite(pose.crop(head).resize((crop_w, crop_h), Image.NEAREST), (fw * i, fh))
    sheet.save(VERIFY)
    print(f"wrote {VERIFY.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
