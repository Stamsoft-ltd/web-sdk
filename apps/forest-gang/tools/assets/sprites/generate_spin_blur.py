"""Vertically motion-blurred spin variants of the board symbol tiles (R7).

True motion blur, not gaussian: the tile is averaged over 8 copies shifted along Y across the
distance a symbol travels in half a frame at base spin speed (a 180-degree shutter, the standard
cinematic look). Base spin is 2.3 px/ms in board units -> ~38 board px per 60 Hz frame against a
103 px cell; half of that, rescaled to each tile's native height, is the smear length.

Averaging is pure PIL: pairwise ImageChops.add(scale=2) over a power-of-two sample count, shifted
copies pasted onto transparent canvases (never ImageChops.offset, which wraps around).

The ANIMAL tiles are composited before blurring. Their statics are frameless, transparent busts —
at rest Board draws `animal_border` underneath them (Board.svelte:504) and the bust on top, but the
spin branch (Board.svelte:454) replaces the WHOLE cell, border included. Blurring a bare bust would
smear an animal with no card behind it, so the frame is composited in here at the same geometry
Board uses. The letters and wild/scatter are self-contained art and blur as-is.

Usage: python3 generate_spin_blur.py   (writes <name>_spin.webp next to each source)
"""
from pathlib import Path
from PIL import Image, ImageChops, ImageFilter

SYMBOLS_DIR = Path(__file__).resolve().parents[2] / "../static/assets/components/symbols"
BOARD_PX_PER_FRAME = 2.3 * 1000 / 60  # reelSpinSpeed (px/ms) x frame time
CELL_W, CELL_H = 121.0, 103.0  # SYMBOL_W / SYMBOL_H
SHUTTER = 0.5  # fraction of the frame's travel that smears (180-degree shutter)
SAMPLES = 16  # power of two, see avg(); 8 left visible banding at ~9px steps

# Board.svelte's cell geometry, mirrored so the composite lands where the live draw does.
BORDER_SIZE = 0.8
FRAME_ASPECT = 516 / 388  # animal_border.webp native aspect
FRAME_H_MULT = 0.826  # desktop/landscape fit (portrait's 0.88 is close enough for a smear)
INNER_FRAC = 0.86  # idleFit: fraction of the frame the bust fills
ANIMALS = ("fox", "wolf", "bear", "rabbit", "squirrel")

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


def framed(bust, landscape):
    """animal_border + bust on a cell-aspect canvas — what a stationary animal cell looks like."""
    border_art = Image.open(SYMBOLS_DIR.resolve() / "animal_border.webp").convert("RGBA")
    # The canvas is the whole CELL: the spin sprite is drawn at symbolW x symbolH, not at the
    # frame's footprint, so the frame has to sit inside the canvas at its own fraction of it.
    cw = bust.width
    ch = round(cw * CELL_H / CELL_W)
    frame_w_mult = FRAME_H_MULT * (CELL_H / CELL_W) * FRAME_ASPECT * (0.93 if landscape else 1)
    bw, bh = round(cw * BORDER_SIZE * frame_w_mult), round(ch * BORDER_SIZE * FRAME_H_MULT)
    sw, sh = round(cw * BORDER_SIZE * FRAME_H_MULT * INNER_FRAC), round(ch * BORDER_SIZE * FRAME_H_MULT * INNER_FRAC)
    canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    canvas.alpha_composite(border_art.resize((bw, bh), Image.LANCZOS), ((cw - bw) // 2, (ch - bh) // 2))
    canvas.alpha_composite(bust.resize((sw, sh), Image.LANCZOS), ((cw - sw) // 2, (ch - sh) // 2))
    return canvas


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
        if src.stem in ANIMALS:
            img = framed(img, landscape=src.parent.name == "landscape")
        length = BOARD_PX_PER_FRAME * SHUTTER * (img.height / CELL_H)
        offsets = [round(-length / 2 + length * i / (SAMPLES - 1)) for i in range(SAMPLES)]
        blurred = avg([shifted(img, dy) for dy in offsets])
        # melt the residual sample banding; radius small enough to keep horizontal detail
        blurred = blurred.filter(ImageFilter.GaussianBlur(1.5))
        # Next to the SOURCE, not in the root dir: building dst from out_dir + stem dropped every
        # landscape/ tile on top of the portrait tile of the same name, so desktop spun with
        # landscape art and landscape/*_spin.webp never existed.
        dst = src.with_name(src.stem + "_spin.webp")
        blurred.save(dst, "WEBP", quality=88)
        print(f"{dst.parent.name}/{dst.name}: {img.width}x{img.height}, smear {length:.0f}px")


if __name__ == "__main__":
    main()
