"""Mystery Bonus card icon from design node 9318:37405 (a 1254x1254 transparent render of the
gift box). The card draws its icon in a 70x69 design-unit box, so a 160px master covers the
menu at 2x with room to spare; the render is cropped to its opaque bounds first so the box
fills the icon slot the way the vegetables do."""

from pathlib import Path

from PIL import Image

HERE = Path(__file__).parent
SRC = HERE / "art" / "mystery-box-9318-37405.png"
OUT = HERE.parent / "static" / "assets" / "veggie-salad" / "pixel" / "mystery-box.webp"
SIZE = 160
PAD = 6

im = Image.open(SRC).convert("RGBA")
alpha = im.getchannel("A").point(lambda v: 255 if v > 8 else 0)
box = alpha.getbbox()
im = im.crop(box)
w, h = im.size
side = max(w, h) + PAD * 2
canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
canvas.paste(im, ((side - w) // 2, (side - h) // 2))
canvas = canvas.resize((SIZE, SIZE), Image.LANCZOS)
OUT.parent.mkdir(parents=True, exist_ok=True)
canvas.save(OUT, "WEBP", lossless=True)
print(OUT, canvas.size, OUT.stat().st_size, "bytes")
