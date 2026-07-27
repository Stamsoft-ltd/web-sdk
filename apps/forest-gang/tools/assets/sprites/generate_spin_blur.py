"""Vertically motion-blurred spin variants of the board symbol tiles (R7).

True motion blur, not gaussian: the tile is averaged over 8 copies shifted along Y across the
distance a symbol travels in half a frame at base spin speed (a 180-degree shutter, the standard
cinematic look). Base spin is 2.3 px/ms in board units -> ~38 board px per 60 Hz frame against a
103 px cell; half of that, rescaled to each tile's native height, is the smear length.

Averaging is pure PIL: pairwise ImageChops.add(scale=2) over a power-of-two sample count, shifted
copies pasted onto transparent canvases (never ImageChops.offset, which wraps around).

Usage: python3 generate_spin_blur.py   (writes <name>_spin.webp next to each source)
"""
from pathlib import Path
from PIL import Image, ImageChops, ImageFilter

SYMBOLS_DIR = Path(__file__).resolve().parents[2] / "../static/assets/components/symbols"
BOARD_PX_PER_FRAME = 2.3 * 1000 / 60  # reelSpinSpeed (px/ms) x frame time
CELL_H = 103.0  # SYMBOL_H
SHUTTER = 0.5  # fraction of the frame's travel that smears (180-degree shutter)
SAMPLES = 16  # power of two, see avg(); 8 left visible banding at ~9px steps

SOURCES = [
    "card_a.webp", "card_k.webp", "card_q.webp", "card_j.webp", "card_t.webp",
    "fox.webp", "wolf.webp", "bear.webp", "rabbit.webp", "squirrel.webp",
    "wild_v2.webp", "scatter_v2.webp",
    # Mobile-landscape uses its own framed tile art — blur those too, or a landscape spin
    # would flash desktop art at speed.
    "landscape/card_a.webp", "landscape/card_k.webp", "landscape/card_q.webp",
    "landscape/card_j.webp", "landscape/card_t.webp",
    "landscape/fox.webp", "landscape/wolf.webp", "landscape/bear.webp",
    "landscape/rabbit.webp", "landscape/squirrel.webp",
    "landscape/wild.webp", "landscape/scatter.webp",
]


def shifted(img, dy):
    canvas = Image.new("RGBA", img.size, (0, 0, 0, 0))
    canvas.paste(img, (0, dy), img)
    return canvas


def avg(imgs):
    while len(imgs) > 1:
        imgs = [ImageChops.add(imgs[i], imgs[i + 1], scale=2) for i in range(0, len(imgs), 2)]
    return imgs[0]


def main():
    out_dir = SYMBOLS_DIR.resolve()
    for name in SOURCES:
        src = out_dir / name
        img = Image.open(src).convert("RGBA")
        length = BOARD_PX_PER_FRAME * SHUTTER * (img.height / CELL_H)
        offsets = [round(-length / 2 + length * i / (SAMPLES - 1)) for i in range(SAMPLES)]
        blurred = avg([shifted(img, dy) for dy in offsets])
        # melt the residual sample banding; radius small enough to keep horizontal detail
        blurred = blurred.filter(ImageFilter.GaussianBlur(1.5))
        dst = out_dir / (src.stem + "_spin.webp")
        blurred.save(dst, "WEBP", quality=88)
        print(f"{dst.name}: {img.width}x{img.height}, smear {length:.0f}px")


if __name__ == "__main__":
    main()
