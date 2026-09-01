"""How this project writes an image it is going to SHIP.

Every sprite the game downloads is WebP. The art is drawn once here and then served to every
player who ever opens the game, so the extra second a slower encoder costs at build time buys a
smaller download forever.

Nothing that writes into `static/` should call `Image.save` itself, because PIL's default for a
`.webp` path is lossy quality 80 with no alpha setting at all — a script that renamed its output
from `.png` to `.webp` and changed nothing else would quietly throw away a quarter of the quality
of the art it had just drawn, and no one would see it until the asset was on the CDN.

LOSSY (the default here) is quality 92, method 6, and a LOSSLESS alpha channel. Painted art
survives 92 invisibly; keeping alpha exact is what stops the edge of a cut-out from crawling
against whatever backdrop the game composites it over, which is the one artefact a slot player
does notice.

LOSSLESS is for art whose pixels are a grid rather than a painting — bitmap-font pages, where the
glyph edges ARE the asset — and for the handful of files where the measured lossy saving is not
worth having. `exact` preserves the colour under fully transparent pixels, so a later resample
cannot drag garbage out of them.
"""

from pathlib import Path

from PIL import Image

LOSSY = dict(format="WEBP", quality=92, alpha_quality=100, method=6)
LOSSLESS = dict(format="WEBP", lossless=True, exact=True, method=6)


def save_web(image: Image.Image, path: Path | str, *, lossless: bool = False) -> Path:
	"""Write `image` to `path` as the WebP this project ships, and hand the path back."""
	path = Path(path)
	assert path.suffix == ".webp", f"shipped art is WebP, not {path.suffix}: {path}"
	path.parent.mkdir(parents=True, exist_ok=True)
	image.save(path, **(LOSSLESS if lossless else LOSSY))
	return path
