#!/usr/bin/env python3
"""Build approved Duck Your Luck hat/glasses colour assets.

The hat sources keep the approved palettes. Their visible art is restored to the original tall
80:101 silhouette; transparent padding below the brim preserves the old Spine attachment anchor.
The glasses source is the approved fitted three-quarter model. Its complete drawing renders behind
the Duck while a front-only copy restores the lenses above the face, making the temple arm wrap the
head instead of painting across it. A separately authored rear view keeps both arms visible after
the turn. Hue shifts retain the materials and perspective across all four colour families.
"""

from pathlib import Path

from PIL import Image, ImageDraw


APP_ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = APP_ROOT / "source-assets-unused/assets/theme-park/duck-turn"
CANDIDATE_DIR = SOURCE_DIR / "reference-candidates"

HAT_COLOR_SOURCES = [
    CANDIDATE_DIR / f"party-hat-approved-colour-{index}.png" for index in range(4)
]
GLASSES_SOURCE = CANDIDATE_DIR / "sunglasses-fit-v3-isolated.png"
GLASSES_REAR_SOURCE = CANDIDATE_DIR / "sunglasses-rear-fit-v1.png"

HAT_CONTENT_SIZE = (80, 101)
HAT_CANVAS_SIZE = (88, 149)
GLASSES_CONTENT_SIZE = (145, 52)
GLASSES_CANVAS_SIZE = (153, 60)
GLASSES_FAR_TEMPLE_POLYGON = ((45, 23), (53, 26), (53, 60), (40, 60), (40, 47), (45, 41))
GLASSES_REAR_CONTENT_SIZE = (148, 34)
GLASSES_REAR_CANVAS_SIZE = (156, 42)
GLASSES_REAR_ARM_SPREAD = 18
GLASSES_HUE_SHIFTS = (0, 50, 105, -80)


def resize_content(source: Path, size: tuple[int, int], canvas_size: tuple[int, int]) -> Image.Image:
    image = Image.open(source).convert("RGBA")
    bounds = image.getchannel("A").getbbox()
    if not bounds:
        raise ValueError(f"Accessory source has no alpha: {source}")
    content = image.crop(bounds).resize(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", canvas_size)
    canvas.alpha_composite(content, (4, 4))
    return canvas


def hue_shift(image: Image.Image, shift: int) -> Image.Image:
    rgba = image.convert("RGBA")
    hue, saturation, value = rgba.convert("HSV").split()
    hue = hue.point(lambda channel: (channel + shift) % 256)
    result = Image.merge("HSV", (hue, saturation, value)).convert("RGB")
    result.putalpha(rgba.getchannel("A"))
    return result


def front_glasses_layer(image: Image.Image) -> Image.Image:
    """Hide only the far/downward temple; keep the long near-side arm above the head."""
    result = image.copy()
    mask = Image.new("L", result.size)
    ImageDraw.Draw(mask).polygon(GLASSES_FAR_TEMPLE_POLYGON, fill=255)
    result.paste((0, 0, 0, 0), mask=mask)
    return result


def spread_rear_arms(image: Image.Image) -> Image.Image:
    """Move rear-view arms outside the head without scaling or changing their approved style."""
    split = image.width // 2
    result = Image.new("RGBA", (image.width + GLASSES_REAR_ARM_SPREAD, image.height))
    result.alpha_composite(image.crop((0, 0, split, image.height)), (0, 0))
    result.alpha_composite(
        image.crop((split, 0, image.width, image.height)),
        (split + GLASSES_REAR_ARM_SPREAD, 0),
    )
    return result


def main() -> None:
    for index, source in enumerate(HAT_COLOR_SOURCES):
        resize_content(source, HAT_CONTENT_SIZE, HAT_CANVAS_SIZE).save(
            SOURCE_DIR / f"party_hat_combo_{index}.png", "PNG", optimize=True
        )

    glasses = resize_content(GLASSES_SOURCE, GLASSES_CONTENT_SIZE, GLASSES_CANVAS_SIZE)
    glasses_front = front_glasses_layer(glasses)
    glasses_rear = spread_rear_arms(
        resize_content(
            GLASSES_REAR_SOURCE,
            GLASSES_REAR_CONTENT_SIZE,
            GLASSES_REAR_CANVAS_SIZE,
        )
    )
    for index, shift in enumerate(GLASSES_HUE_SHIFTS):
        hue_shift(glasses, shift).save(
            SOURCE_DIR / f"sunglasses_combo_{index}.png", "PNG", optimize=True
        )
        hue_shift(glasses_front, shift).save(
            SOURCE_DIR / f"sunglasses_front_combo_{index}.png", "PNG", optimize=True
        )
        hue_shift(glasses_rear, shift).save(
            SOURCE_DIR / f"sunglasses_rear_combo_{index}.png", "PNG", optimize=True
        )

    print("Duck accessories: 4 tall hats + 4 depth-split/front/rear sunglasses built")


if __name__ == "__main__":
    main()
