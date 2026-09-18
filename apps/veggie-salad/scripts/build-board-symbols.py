"""Board symbols from the design's board (Figma 9235:181907, the "Menu" frame's 7x7 tablo).

The board art in Figma is vector pixel art drawn on a 69-unit cell, and until now the game
shipped it as 1x (69px) exports, which blur on any board bigger than that — the designer flagged
every symbol except the carrot and the file called cauliflower (the radish art), which were
already 276px masters. This rebuilds the rest as 4x (276px) masters from the same component
instances so all seven symbols share one resolution.

Sources in art/symbols-9235-181907:
  * PNG exports at 4x of the "Component 25" instances. Figma exports opaque, so the pad colour
    (#42561f) is keyed out by a flood fill from the border — pixel art with hard edges, so the
    key is exact and nothing inside the art matches it.
  * The king (scatter) as the vector layer itself, rasterised at 4x; its export carried an
    opaque black instance fill instead.

Historical filenames are reversed and stay that way (see VEGGIE_SYMBOL_ASSETS): radish.webp
holds the cauliflower art and onion.webp the king."""

from collections import deque
from pathlib import Path

import cairosvg
from PIL import Image

HERE = Path(__file__).parent
ART = HERE / "art" / "symbols-9235-181907"
OUT = HERE.parent / "static" / "assets" / "veggie-salad" / "pixel"
PAD = (66, 86, 31)
SCALE = 4
CELL = 69 * SCALE

EXPORTS = {
    "corn": "corn-9235-181976.png",
    "tomato": "tomato-9235-181956.png",
    "eggplant": "eggplant-9235-181969.png",
    "broccoli": "broccoli-9235-181961.png",
    "radish": "cauliflower-9235-181954.png",
}
KING = ("onion", "king-9235-182103.svg", 89 * SCALE)


def key_pad(im: Image.Image) -> Image.Image:
    """Make every pad-coloured pixel reachable from the border transparent."""
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    seen = bytearray(w * h)
    queue = deque()
    for x in range(w):
        queue.extend(((x, 0), (x, h - 1)))
    for y in range(h):
        queue.extend(((0, y), (w - 1, y)))
    while queue:
        x, y = queue.popleft()
        if not (0 <= x < w and 0 <= y < h) or seen[y * w + x]:
            continue
        seen[y * w + x] = 1
        if px[x, y][:3] != PAD:
            continue
        px[x, y] = (0, 0, 0, 0)
        queue.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return im


def centred(im: Image.Image, side: int) -> Image.Image:
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    return canvas


def save(name: str, im: Image.Image) -> None:
    out = OUT / f"{name}.webp"
    im.save(out, "WEBP", lossless=True)
    print(out, im.size, out.stat().st_size, "bytes")


for name, source in EXPORTS.items():
    # The cauliflower instance is 67 units, not 69; keep every symbol on the 69-unit cell so the
    # per-symbol CSS boxes (.symbol-corn etc.) still mean what they did.
    save(name, centred(key_pad(Image.open(ART / source)), CELL))

name, source, side = KING
king = Image.open(
    __import__("io").BytesIO(cairosvg.svg2png(url=str(ART / source), scale=SCALE))
).convert("RGBA")
save(name, centred(king, side))
