#!/usr/bin/env python3
"""Bake the two full-viewport CSS backdrop blurs into assets.

Both `.game-shell::before` (<Game>) and `.backdrop` (<SplashIntro>) used to paint the full-size art
and then ask the browser for `filter: blur(20-26px) brightness(...) saturate(...)` on a layer the
size of the viewport. WebKit rasterises large-radius blurs far slower than Blink does, and this one
sits directly under a canvas that repaints every frame — measured on forest-gang as one of the two
causes of "Safari is very laggy". A blurred image is a blurred image: bake it once, ship a tiny file,
and let the browser do nothing but scale it.

The blur radius is scaled to the BAKE size. CSS `blur(<len>)` is a Gaussian whose standard deviation
IS that length, applied at the element's rendered size — roughly 1.24x the viewport width here
(inset -6% plus scale(1.12)). So the equivalent radius at bake width w is `len * w / rendered`, and
the browser's own upscale back to the viewport only smooths it further.

Run from apps/theme-park:  python3 scripts/backdrop/build_backdrop.py
"""

from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
STATIC = ROOT / "static" / "assets" / "theme-park"

# Width the blur was authored against: a 1920 viewport, blown up by inset -6% and scale(1.12).
RENDERED_W = 1920 * 1.24
# Small enough that the file is a rounding error, large enough that the upscale stays smooth.
BAKE_W = 480


def bake(source: Path, target: Path, blur_px: float, brightness: float, saturate: float) -> None:
    image = Image.open(source).convert("RGB")
    scale = BAKE_W / RENDERED_W
    height = round(BAKE_W * image.height / image.width)
    image = image.resize((BAKE_W, height), Image.LANCZOS)
    image = image.filter(ImageFilter.GaussianBlur(radius=blur_px * scale))
    image = ImageEnhance.Color(image).enhance(saturate)
    image = ImageEnhance.Brightness(image).enhance(brightness)
    image.save(target, "WEBP", quality=82, method=6)
    print(f"{target.relative_to(ROOT)}  {image.width}x{image.height}  {target.stat().st_size / 1024:.1f} KB")


def main() -> None:
    bake(STATIC / "v2/park/plaza.webp", STATIC / "v2/park/plaza_backdrop.webp", 20, 0.28, 0.8)
    bake(
        STATIC / "v2/splash/background.webp",
        STATIC / "v2/splash/background_backdrop.webp",
        26,
        0.26,
        0.85,
    )


if __name__ == "__main__":
    main()
