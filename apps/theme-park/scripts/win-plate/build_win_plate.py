"""
The neon card a REGULAR win's amount is drawn inside — Figma 7100:26891.

The design is one portrait card art squashed into a landscape box, with the Roller Wilds star from
the sign lockup straddling its top rail. So the plate is not a single exported image: the star has
to be composited into it here, because the card is what the amount is centred in and the star hangs
outside that box.

WHY THIS IS ITS OWN SCRIPT. The same card is the Mega Wild reel's plaque, and for a while one
builder — `build-mega-wild-full-reel-spine.py` — wrote both from one layer so they could not drift.
That rig has since been put back on the authored GOLD plaque and its six drawn perspective poses
(c312551), which the flat neon card has no equivalent of. The two are genuinely different pieces of
art now, so this plate is built and named on its own rather than taken out of the reel rig.

Run: python3 scripts/win-plate/build_win_plate.py
"""

from pathlib import Path

from PIL import Image

APP = Path(__file__).resolve().parents[2]
CARD_SOURCE = APP / "art" / "concepts" / "mega-wild-plaque-neon-v2.png"
STAR_SOURCE = APP / "static" / "assets" / "theme-park" / "v2" / "symbols" / "roller-wilds-star.png"
OUTPUT = APP / "static" / "assets" / "theme-park" / "v2" / "wins" / "small-win-plate-neon-v1.png"

WIDTH = 244
# The design's own box: 118 x 67.23 in Figma. The card art is PORTRAIT, so honouring this is a
# deliberate squash rather than a fit — that is how the composed design draws it.
ASPECT = 118.0 / 67.23255673265089
# The star's height and how far it rises above the card's top rail, both as fractions of the card's
# own height, measured off the composed design.
STAR_HEIGHT = 0.2696
STAR_RISE = 0.0609
# Composed large and reduced once. The card is being squashed and the star carries a thin gold
# outline; doing either at final size frays the outline into the purple behind it.
SUPERSAMPLE = 4


def main() -> None:
    width = WIDTH * SUPERSAMPLE
    card_height = round(width / ASPECT)
    rise = round(card_height * STAR_RISE)
    star_height = round(card_height * STAR_HEIGHT)

    star_art = Image.open(STAR_SOURCE).convert("RGBA")
    star = star_art.resize(
        (round(star_height * star_art.width / star_art.height), star_height), Image.LANCZOS
    )
    card = Image.open(CARD_SOURCE).convert("RGBA").resize((width, card_height), Image.LANCZOS)

    plate = Image.new("RGBA", (width, card_height + rise), (0, 0, 0, 0))
    plate.alpha_composite(card, (0, rise))
    # Centred on the card, hung from the top of the canvas: the canvas is exactly as much taller
    # than the card as the star rises, so this seats the star on the rail by construction.
    plate.alpha_composite(star, ((width - star.width) // 2, 0))

    out = plate.resize(
        (WIDTH, round(plate.height / SUPERSAMPLE)),
        Image.LANCZOS,
    )
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    out.save(OUTPUT, optimize=True)
    print(f"card {WIDTH}x{card_height // SUPERSAMPLE} star {star_height // SUPERSAMPLE}")
    print(f"{OUTPUT.relative_to(APP)} {out.width}x{out.height} {OUTPUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
