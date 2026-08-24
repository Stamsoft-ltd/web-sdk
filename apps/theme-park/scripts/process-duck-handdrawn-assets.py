#!/usr/bin/env python3
"""Prepare generated hand-drawn Duck Your Luck art for the Spine builder.

Image generation supplies the painted source art. This script performs only deterministic
production work: background matting, pose separation, registration-friendly sheet assembly,
ring masking, accessory sizing, and palette variants.
"""

from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


APP = Path(__file__).resolve().parents[1]
ART = APP / "art" / "concepts"
OLD = APP / "source-assets-unused" / "assets" / "theme-park" / "duck-turn"
OUTPUT = APP / "source-assets-unused" / "assets" / "theme-park" / "duck-turn-handdrawn"


TURNAROUND_SOURCE = ART / "duck-your-luck-mega-style-old-shape-turnaround-v1.png"
RING_SOURCE = ART / "duck-your-luck-mega-style-ring-base-v1.png"
STAR_SOURCE = ART / "duck-your-luck-mega-style-star-badge-v1.png"
HAT_SOURCE = ART / "duck-your-luck-mega-style-party-hat-legacy-fit-v2.png"
GLASSES_SOURCE = ART / "duck-your-luck-mega-style-sunglasses-legacy-fit-v2.png"


def flood_neutral_background(
    image: Image.Image,
    extra_seeds: tuple[tuple[int, int], ...] = (),
) -> Image.Image:
    """Remove only border-connected pale neutral pixels; enclosed eye whites survive."""
    rgb = np.asarray(image.convert("RGB"), dtype=np.uint8)
    hi = rgb.max(axis=2).astype(np.int16)
    lo = rgb.min(axis=2).astype(np.int16)
    candidate = (lo >= 218) & ((hi - lo) <= 28)
    height, width = candidate.shape
    background = np.zeros((height, width), dtype=np.bool_)
    queue: deque[tuple[int, int]] = deque()

    def seed(x: int, y: int) -> None:
        if candidate[y, x] and not background[y, x]:
            background[y, x] = True
            queue.append((x, y))

    for x in range(width):
        seed(x, 0)
        seed(x, height - 1)
    for y in range(height):
        seed(0, y)
        seed(width - 1, y)
    for x, y in extra_seeds:
        seed(x, y)

    while queue:
        x, y = queue.popleft()
        if x and candidate[y, x - 1] and not background[y, x - 1]:
            background[y, x - 1] = True
            queue.append((x - 1, y))
        if x + 1 < width and candidate[y, x + 1] and not background[y, x + 1]:
            background[y, x + 1] = True
            queue.append((x + 1, y))
        if y and candidate[y - 1, x] and not background[y - 1, x]:
            background[y - 1, x] = True
            queue.append((x, y - 1))
        if y + 1 < height and candidate[y + 1, x] and not background[y + 1, x]:
            background[y + 1, x] = True
            queue.append((x, y + 1))

    subject = Image.fromarray((~background).astype(np.uint8) * 255, "L")
    # Pull the matte one pixel into the dark painted contour before softening it. This avoids the
    # pale checker fringe generated around otherwise-transparent output.
    subject = subject.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.55))
    rgba = image.convert("RGBA")
    rgba.putalpha(subject)
    return rgba


def prepared(
    image: Image.Image,
    extra_seeds: tuple[tuple[int, int], ...] = (),
) -> Image.Image:
    if image.mode != "RGBA" or image.getchannel("A").getextrema() == (255, 255):
        return flood_neutral_background(image, extra_seeds)
    return image.convert("RGBA")


def clean_transparent(image: Image.Image) -> Image.Image:
    pixels = np.asarray(image.convert("RGBA")).copy()
    pixels[pixels[:, :, 3] == 0, :3] = 0
    return Image.fromarray(pixels, "RGBA")


def keep_largest_alpha_component(image: Image.Image, threshold: int = 20) -> Image.Image:
    """Drop neighbouring-cell fragments from generated grid sheets."""
    rgba = np.asarray(image.convert("RGBA")).copy()
    mask = rgba[:, :, 3] > threshold
    height, width = mask.shape
    visited = np.zeros_like(mask)
    largest: list[tuple[int, int]] = []
    for y in range(height):
        for x in range(width):
            if not mask[y, x] or visited[y, x]:
                continue
            component: list[tuple[int, int]] = []
            queue: deque[tuple[int, int]] = deque([(x, y)])
            visited[y, x] = True
            while queue:
                current_x, current_y = queue.popleft()
                component.append((current_x, current_y))
                for next_x, next_y in (
                    (current_x - 1, current_y),
                    (current_x + 1, current_y),
                    (current_x, current_y - 1),
                    (current_x, current_y + 1),
                ):
                    if (
                        0 <= next_x < width
                        and 0 <= next_y < height
                        and mask[next_y, next_x]
                        and not visited[next_y, next_x]
                    ):
                        visited[next_y, next_x] = True
                        queue.append((next_x, next_y))
            if len(component) > len(largest):
                largest = component
    keep = np.zeros_like(mask)
    for x, y in largest:
        keep[y, x] = True
    rgba[~keep] = 0
    return clean_transparent(Image.fromarray(rgba, "RGBA"))


def split_equal(image: Image.Image, count: int) -> list[Image.Image]:
    frames: list[Image.Image] = []
    for index in range(count):
        left = round(index * image.width / count)
        right = round((index + 1) * image.width / count)
        cell = image.crop((left, 0, right, image.height))
        bbox = cell.getchannel("A").point(lambda value: 255 if value > 20 else 0).getbbox()
        if bbox is None:
            raise ValueError(f"Empty generated duck cell {index}/{count}")
        frames.append(cell.crop(bbox))
    return frames


def split_grid(
    image: Image.Image,
    columns: int,
    rows: int,
    bleed: int = 55,
) -> list[Image.Image]:
    """Split a generated grid without clipping artwork crossing a guide boundary.

    Image generation does not honour the nominal cells exactly. The rear duck crowns cross the
    fourth-row guide, so strict equal crops flatten their heads. Read beyond each guide, isolate
    the cell's largest connected subject, then trim that complete subject.
    """
    frames: list[Image.Image] = []
    for index in range(columns * rows):
        row, column = divmod(index, columns)
        left = max(0, round(column * image.width / columns) - bleed)
        right = min(image.width, round((column + 1) * image.width / columns) + bleed)
        top = max(0, round(row * image.height / rows) - bleed)
        bottom = min(image.height, round((row + 1) * image.height / rows) + bleed)
        cell = keep_largest_alpha_component(image.crop((left, top, right, bottom)))
        bbox = cell.getchannel("A").point(lambda value: 255 if value > 20 else 0).getbbox()
        if bbox is None:
            raise ValueError(f"Empty generated duck grid cell {index}/{columns * rows}")
        frames.append(cell.crop(bbox))
    return frames


def opaque_x_spans(image: Image.Image, threshold: int = 20) -> list[tuple[int, int]]:
    alpha = np.asarray(image.getchannel("A"))
    occupied = (alpha > threshold).any(axis=0)
    spans: list[tuple[int, int]] = []
    start: int | None = None
    for x, active in enumerate([*occupied.tolist(), False]):
        if active and start is None:
            start = x
        elif not active and start is not None:
            spans.append((start, x))
            start = None
    return spans


def crop_span(image: Image.Image, left: int, right: int) -> Image.Image:
    cell = image.crop((left, 0, right, image.height))
    bbox = cell.getchannel("A").point(lambda value: 255 if value > 20 else 0).getbbox()
    if bbox is None:
        raise ValueError("Empty generated accessory span")
    return cell.crop(bbox)


def assemble(frames: list[Image.Image], gap: int = 120, padding: int = 20) -> Image.Image:
    baseline = max(frame.height for frame in frames) + padding
    width = padding * 2 + sum(frame.width for frame in frames) + gap * (len(frames) - 1)
    sheet = Image.new("RGBA", (width, baseline + padding))
    x = padding
    for frame in frames:
        sheet.alpha_composite(frame, (x, baseline - frame.height))
        x += frame.width + gap
    return sheet


def write_pose_sheets() -> None:
    for obsolete in (
        "duck_inbetweens.png",
        "duck_midposes.png",
        "duck_quarterposes.png",
        "duck_eighthposes.png",
    ):
        (OUTPUT / obsolete).unlink(missing_ok=True)
    frames = [
        keep_largest_alpha_component(frame)
        for frame in split_grid(prepared(Image.open(TURNAROUND_SOURCE)), 4, 4)
    ]
    # Keep all sixteen poses from one coherent art pass. One shared generation sheet avoids the
    # style, scale and contour drift caused by mixing separately generated filler sheets.
    assemble([clean_transparent(frame) for frame in frames]).save(
        OUTPUT / "duck_pose_sheet.png", optimize=True
    )


def fit_generated(source: Path, size: tuple[int, int], padding: int = 3) -> Image.Image:
    image = prepared(Image.open(source))
    bbox = image.getchannel("A").point(lambda value: 255 if value > 20 else 0).getbbox()
    if bbox is None:
        raise ValueError(f"Empty generated accessory: {source}")
    crop = image.crop(bbox)
    inner_size = (size[0] - padding * 2, size[1] - padding * 2)
    fitted = crop.resize(inner_size, Image.Resampling.LANCZOS)
    result = Image.new("RGBA", size)
    result.alpha_composite(fitted, (padding, padding))
    return result


def prepare_ring(source: Path) -> Image.Image:
    original = Image.open(source)
    generated = prepared(
        original,
        extra_seeds=((original.width // 2, round(original.height * 0.40)),),
    )
    bbox = generated.getchannel("A").point(lambda value: 255 if value > 20 else 0).getbbox()
    if bbox is None:
        raise ValueError("Empty hand-drawn ring")
    painted = generated.crop(bbox).resize((1254, 738), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (1274, 758))
    canvas.alpha_composite(painted, (10, 10))
    return clean_transparent(canvas)


def write_ring() -> None:
    no_star = prepare_ring(RING_SOURCE)
    no_star.save(OUTPUT / "ring_no_star.png", optimize=True)

    star = prepared(Image.open(STAR_SOURCE))
    bbox = star.getchannel("A").point(lambda value: 255 if value > 20 else 0).getbbox()
    if bbox is None:
        raise ValueError("Empty hand-drawn ring star")
    star = star.crop(bbox)
    star.thumbnail((250, 250), Image.Resampling.LANCZOS)
    decorated = no_star.copy()
    decorated.alpha_composite(
        star,
        # Centre the badge on the torus's front face. 0.67 put its bottom point on the floatie's
        # outer edge, which made a geometrically centred X position read visibly off-centre.
        ((decorated.width - star.width) // 2, round(decorated.height * 0.60)),
    )
    clean_transparent(decorated).save(OUTPUT / "ring.png", optimize=True)


def recolor_hues(image: Image.Image, palette: tuple[int, ...], masters: tuple[int, ...]) -> Image.Image:
    rgba = np.asarray(image.convert("RGBA")).copy()
    hsv = np.asarray(image.convert("RGB").convert("HSV")).copy()
    hue = hsv[:, :, 0].astype(np.int16)
    saturation = hsv[:, :, 1]
    distances = np.stack(
        [np.minimum(abs(hue - master), 256 - abs(hue - master)) for master in masters], axis=2
    )
    regions = distances.argmin(axis=2)
    active = (rgba[:, :, 3] > 8) & (saturation > 45)
    for region, target in enumerate(palette):
        hsv[:, :, 0][active & (regions == region)] = target
    recolored = np.asarray(Image.fromarray(hsv, "HSV").convert("RGB"))
    rgba[:, :, :3] = recolored
    return clean_transparent(Image.fromarray(rgba, "RGBA"))


def contain(image: Image.Image, size: tuple[int, int], padding: int = 3) -> Image.Image:
    bbox = image.getchannel("A").point(lambda value: 255 if value > 20 else 0).getbbox()
    if bbox is None:
        raise ValueError("Empty generated accessory cell")
    crop = image.crop(bbox)
    crop.thumbnail((size[0] - padding * 2, size[1] - padding * 2), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", size)
    canvas.alpha_composite(crop, ((size[0] - crop.width) // 2, (size[1] - crop.height) // 2))
    return clean_transparent(canvas)


def fit_legacy_hat(image: Image.Image) -> Image.Image:
    """Keep the approved tall-hat silhouette and its original attachment-space padding."""
    bbox = image.getchannel("A").point(lambda value: 255 if value > 20 else 0).getbbox()
    if bbox is None:
        raise ValueError("Empty generated party hat")
    crop = image.crop(bbox)
    crop.thumbnail((80, 101), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (88, 149))
    canvas.alpha_composite(crop, ((canvas.width - crop.width) // 2, 4))
    return clean_transparent(canvas)


def write_hats() -> None:
    sheet = prepared(Image.open(HAT_SOURCE))
    spans = opaque_x_spans(sheet)
    if len(spans) != 2:
        raise ValueError(f"Expected two party-hat views, found {len(spans)}")
    front, rear = [crop_span(sheet, left, right) for left, right in spans]
    masters = {
        "front": fit_legacy_hat(front),
        # The generated rear key supplied the correct silhouette but dropped the party pattern.
        # The cone is rotationally symmetric, so keep the fitted patterned master on the rear too.
        "rear": fit_legacy_hat(front),
    }
    # master regions: pink cone, cyan brim/dots, yellow stars/pom, purple dots
    source_hues = (235, 130, 38, 190)
    palettes = (
        (235, 130, 38, 190),
        (18, 190, 72, 130),
        (72, 235, 130, 38),
        (160, 72, 235, 18),
    )
    for index, palette in enumerate(palettes):
        for view, master in masters.items():
            recolor_hues(master, palette, source_hues).save(
                OUTPUT / f"party_hat_{view}_combo_{index}.png", optimize=True
            )


def write_glasses() -> None:
    sheet = prepared(Image.open(GLASSES_SOURCE))
    spans = opaque_x_spans(sheet)
    if len(spans) not in (3, 4):
        raise ValueError(
            f"Expected back frame, front frame, and rear arms; found {len(spans)} spans"
        )
    # New art deliberately copies the approved legacy direction and silhouettes. The rear view
    # can arrive as one joined group or two separated arms, depending on the generated matte.
    back = crop_span(sheet, *spans[0])
    front = crop_span(sheet, *spans[1])
    rear = crop_span(sheet, spans[2][0], spans[-1][1])
    rear_scaled = rear.resize((166, 34), Image.Resampling.LANCZOS)
    rear_canvas = Image.new("RGBA", (174, 42))
    rear_canvas.alpha_composite(rear_scaled, (4, 4))
    masters = {
        "back": contain(back, (153, 60), padding=4),
        "front": contain(front, (153, 60)),
        "rear": clean_transparent(rear_canvas),
    }
    # master regions: cyan frame, purple lenses, pink rivets
    source_hues = (130, 190, 235)
    palettes = (
        (130, 190, 235),
        (190, 235, 18),
        (235, 38, 130),
        (72, 105, 190),
    )
    for index, palette in enumerate(palettes):
        recolor_hues(masters["back"], palette, source_hues).save(
            OUTPUT / f"sunglasses_combo_{index}.png", optimize=True
        )
        recolor_hues(masters["front"], palette, source_hues).save(
            OUTPUT / f"sunglasses_front_combo_{index}.png", optimize=True
        )
        recolor_hues(masters["rear"], palette, source_hues).save(
            OUTPUT / f"sunglasses_rear_combo_{index}.png", optimize=True
        )


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for obsolete in OUTPUT.glob("party_hat_combo_*.png"):
        obsolete.unlink()
    write_pose_sheets()
    write_ring()
    write_hats()
    write_glasses()
    (OUTPUT / "README.md").write_text(
        "Mega Coaster-style Duck Your Luck sources: corrected compact wings, solid floaties in "
        "eight hues with optional star badges, fitted front/rear party hats, and split front/back "
        "sunglasses layers. Generated concepts live in apps/theme-park/art/concepts; rebuild with "
        "scripts/process-duck-handdrawn-assets.py.\n",
        encoding="utf-8",
    )
    print(f"Prepared hand-drawn Duck Your Luck sources: {OUTPUT}")


if __name__ == "__main__":
    main()
