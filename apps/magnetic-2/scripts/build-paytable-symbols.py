#!/usr/bin/env python3
"""Flatten the layered board symbols into single images for the PAYTABLE.

WHY THIS EXISTS
---------------
The MOTHERSHIP rebuild split six symbols into a base texture plus loose parts, so that each one can
animate: the compass turns its needle, the magnet shakes its antennae, the lightning pops its bolt.
On the board that is assembled live by a per-cell Svelte component.

The paytable is NOT the board. CustomInfoModal.svelte is plain HTML -- one <img> per row -- so it
can only ever show ONE file. Pointed at a rebuilt base it therefore showed the symbol with its
character missing: an empty yellow lightning badge with no bolt, an EM device with no antennae or
lens, and a WILD row that was a bare horseshoe magnet with the word WILD nowhere on it. Every one of
those used to be correct, because the pre-rebuild art was a single flat file.

So: composite the same layers, at their REST pose, into one flat file per symbol.

WHY IT READS THE COMPONENTS
---------------------------
Every placement here is parsed straight out of the .svelte component that owns the symbol, and every
source path is parsed out of assets.ts. Nothing is transcribed. A hand-copied table would be correct
exactly once -- the next time somebody nudges a compass needle by 0.004 the paytable would quietly
start disagreeing with the board, and it is the kind of disagreement nobody notices until a reviewer
does.

WHY THE PLACEMENT MATH IS ONE LINE
----------------------------------
The components anchor their sprites three different ways -- anchor 0.5, anchor {x:0.5,y:1} for the
magnet's antennae, and a measured stalk-base PIVOT for the EM device's. All three cancel at rest:

    anchor 0.5      : left = dx*W                        - 0.5*w*W
    anchor {.5, 1}  : left = dx*W, top = (dy + h/2)*H    - 1.0*h*H   ==  (dy - h/2)*H
    anchor PIVOT    : left = (dx + w*(P.x-0.5))*W        - P.x*w*W   ==  (dx - w/2)*W

so all of them reduce to a box centred on (dx, dy). The pivots only matter once something rotates,
and nothing rotates at rest. That is why this script does not model anchors at all -- if a component
ever gains a layer whose REST pose is rotated or offset, this assumption breaks and the composite
will be visibly wrong, which is what the verify sheet is for.
"""

import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
STATIC = ROOT / "static"
ASSETS_TS = SRC / "game" / "assets.ts"
COMPONENTS = SRC / "components"
VERIFY = ROOT / "art-src" / "verify_paytable_symbols.png"

CANVAS_W, CANVAS_H = 328, 264


def die(msg: str):
    sys.exit(f"build-paytable-symbols: {msg}")


# --- what each paytable row is made of ------------------------------------------------------------
# (out_name, component, base asset key, [(part asset key, placement const), ...])
#
# The order is the component's own render order, back to front. Additive GHOST layers -- the copies
# kept mounted at alpha 0 so a win can flash them -- are deliberately absent: at rest they contribute
# nothing, and compositing one would light the symbol in a still image.
SYMBOLS = [
    (
        "premium/compass_full",
        "CompassSymbol.svelte",
        "foxTile",
        [
            ("compassAntennaL", "ANTENNA_L"),
            ("compassAntennaR", "ANTENNA_R"),
            ("compassFace", "FACE"),
            ("compassEye", "EYE"),
            ("compassN", "BADGE_N"),
            ("compassS", "BADGE_S"),
        ],
    ),
    (
        "premium/lightning_full",
        "LightningSymbol.svelte",
        "wolfTile",
        [("lightningBolt", "BOLT")],
    ),
    (
        "premium/portal_full",
        "PortalSymbol.svelte",
        "bearTile",
        # The core is drawn BEHIND the base: the base texture is the ring with its own hole punched
        # out of it, and the galaxy is what shows through. Composite it after the base instead and
        # the ring disappears under an orb a third wider than its aperture.
        [
            ("portalCore", "CORE"),
            "BASE",
            ("portalAntennaL", "ANTENNA_L"),
            ("portalAntennaR", "ANTENNA_R"),
            ("portalHead", "HEAD"),
        ],
    ),
    (
        "premium/electromagnetic_device_full",
        "EmDeviceSymbol.svelte",
        "rabbitTile",
        [
            ("emAntennaL", "ANTENNA_L"),
            ("emAntennaR", "ANTENNA_R"),
            ("emLens", "LENS"),
        ],
    ),
    (
        "low/battery_full",
        "BatterySymbol.svelte",
        "squirrelTile",
        # The one layer whose position and size come from DIFFERENT constants: the cell is sized by
        # CELL but seated on the housing's PANEL, because the panel is the hole it sits in.
        [("batteryCell", ("PANEL", "CELL"))],
    ),
    (
        "low/coil_full",
        "CoilSymbol.svelte",
        "kTile",
        # The eye placements are offsets from the HEAD's centre, not the symbol box's -- but the
        # head is dead centre of the helmet (HEAD.dx = HEAD.dy = 0), so the two frames coincide and
        # the constants can be used here as they stand. If the head ever moves off centre, this row
        # has to compose them.
        [("coilHead", "HEAD"), ("coilEyeR", "EYE_R"), ("coilEyeL", "EYE_L")],
    ),
    (
        "low/energy_screw_full",
        "CircuitSymbol.svelte",
        "qTile",
        # The alien's parts are offsets from FACE, not from the symbol box -- they live in the
        # container the win zooms -- so they are named as a chain here rather than transcribed.
        # The mouth's odd markup (anchor y 0.18, y pulled up by 0.32h) cancels exactly at rest:
        # 0.32 + 0.18 = 0.5, which is the plain centred box this script already assumes.
        [
            ("circuitFace", "FACE"),
            ("circuitEye", "FACE+EYE_L"),
            ("circuitEye", "FACE+EYE_R"),
            ("circuitMouth", "FACE+MOUTH"),
            ("circuitSlimeA", "SLIME_A"),
            ("circuitSlimeB", "SLIME_B"),
        ],
    ),
    (
        "low/magnet_full",
        "MagnetSymbol.svelte",
        "aTile",
        [
            ("magnetAntennaL", "ANTENNA_L"),
            ("magnetAntennaR", "ANTENNA_R"),
            "BASE",  # the horseshoe sits OVER its own antennae -- their stalks run behind it
            ("magnetHandL", "HAND_L"),
            ("magnetHandR", "HAND_R"),
            ("magnetFace", "FACE"),
        ],
    ),
    (
        "special/scatter_full",
        "ScatterSymbol.svelte",
        "scatterCustom",
        # Only the ALIEN and its EYE are missing from the base -- the component's own comments record
        # that the lid and the word composite back pixel-identically at rest, and they do, so they
        # are already in the plate. The lid is redrawn here anyway because it is what the alien hops
        # BEHIND: leave it off and the alien's head sits over the machine's metal top.
        [
            ("scatterAlien", "ALIEN"),
            ("scatterEye", "EYE"),
            # x={0} width={W} in the markup, so DOME_FRONT carries only dy and h.
            ("scatterDome", "DOME_FRONT", {"dx": 0.0, "w": 1.0}),
        ],
    ),
    (
        "special/wild_full",
        "WildSymbol.svelte",
        "wildTile",
        [
            ("wildBolt", "BOLT"),
            ("wildPlaque", "PLAQUE"),
            ("wildBlob", "BLOB"),
            ("wildEye", "EYE"),
        ],
    ),
    (
        "special/wild_x10_full",
        "WildSymbol.svelte",
        "wildTile",
        # The multiplier lockup is the same wild with the bolt swapped for a numbered disc -- the
        # design replaces it rather than stacking, so the bolt is absent here, not hidden.
        [
            ("wildDisc", "DISC"),
            ("wildMultX10", "NUM"),
            ("wildPlaque", "PLAQUE"),
            ("wildBlob", "BLOB"),
            ("wildEye", "EYE"),
        ],
    ),
]


def asset_paths() -> dict:
    """key -> file on disk, read out of assets.ts so no path is transcribed here."""
    text = ASSETS_TS.read_text()
    out = {}
    for key, src in re.findall(r"^\t(\w+):\s*\{\s*type: 'sprite',\s*src: '([^']+)'", text, re.M):
        out[key] = STATIC / src.split("?")[0].lstrip("./")
    return out


def placements(component: str) -> dict:
    """const NAME = { dx, dy, w, h } -> dict, parsed from the component that owns the symbol."""
    text = (COMPONENTS / component).read_text()
    out = {}
    for name, body in re.findall(r"^\tconst ([A-Z][A-Z_0-9]*) = \{([^}]*)\};", text, re.M):
        fields = dict(
            (k, float(v)) for k, v in re.findall(r"(\w+):\s*(-?[\d.]+)", body)
        )
        out[name] = fields
    return out


def main():
    paths = asset_paths()
    built = []

    for out_name, component, base_key, layers in SYMBOLS:
        place = placements(component)
        plate = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))

        def draw_base():
            base = Image.open(paths[base_key]).convert("RGBA")
            if base.size != (CANVAS_W, CANVAS_H):
                die(f"{out_name}: base {base_key} is {base.size}, expected {(CANVAS_W, CANVAS_H)}")
            plate.alpha_composite(base)

        if "BASE" not in layers:
            draw_base()

        for layer in layers:
            if layer == "BASE":
                draw_base()
                continue
            key, const, *rest = layer
            override = rest[0] if rest else {}
            pos_name, size_name = const if isinstance(const, tuple) else (const, const)

            def resolve(spec: str) -> dict:
                """One placement const, or a chain of them summed: "FACE+EYE_L".

                A chain is what a NESTED <Container> looks like from out here. <CircuitSymbol> puts
                the alien's face, eyes and mouth in one container so a win can zoom them together,
                which means the eye constants are offsets from the FACE's centre, not the symbol
                box's. Summing the dx/dy down the chain is exactly what pixi does when it composes
                the transforms; the SIZE comes from the last link, which is the sprite's own.
                """
                names = spec.split("+")
                out = {}
                for i, name in enumerate(names):
                    if name not in place:
                        die(f"{out_name}: {component} has no const {name}")
                    if i == 0:
                        out = dict(place[name])
                        continue
                    out = {
                        **place[name],
                        "dx": out.get("dx", 0.0) + place[name].get("dx", 0.0),
                        "dy": out.get("dy", 0.0) + place[name].get("dy", 0.0),
                    }
                return out

            pos = {**resolve(pos_name), **override}
            size = {**resolve(size_name), **override}
            for field, src in (("dx", pos_name), ("dy", pos_name), ("w", size_name), ("h", size_name)):
                if field not in (pos if field in ("dx", "dy") else size):
                    die(
                        f"{out_name}: const {src} has no '{field}' -- the component supplies it "
                        f"literally in the markup, so pass it as this layer's override"
                    )
            if key not in paths:
                die(f"{out_name}: assets.ts has no sprite key {key}")

            w = max(1, round(size["w"] * CANVAS_W))
            h = max(1, round(size["h"] * CANVAS_H))
            left = round((pos["dx"] - size["w"] / 2) * CANVAS_W + CANVAS_W / 2)
            top = round((pos["dy"] - size["h"] / 2) * CANVAS_H + CANVAS_H / 2)

            part = Image.open(paths[key]).convert("RGBA")
            # The components hand pixi the raw texture and a target width/height, so pixi stretches
            # the WHOLE file -- transparent margin included. Cropping to the alpha box here would
            # place the ink differently from the board.
            plate.alpha_composite(part.resize((w, h), Image.LANCZOS), (left, top))

        out = STATIC / "assets/components/symbols/magnetic" / f"{out_name}.webp"
        plate.save(out, lossless=True, method=6)
        bbox = plate.getchannel("A").getbbox()
        bh = bbox[3] - bbox[1]
        # The modal scales each row's image by --fit. Every existing fit in CustomInfoModal.svelte
        # works out to "make the rendered art about 36px tall", which at the row's 42px-wide image
        # box is fit ~= 281 / (alpha box height). Emitting it keeps the eight rows consistent
        # instead of re-guessing per symbol.
        built.append((out_name, bbox, 281.0 / bh))
        print(
            f"{out_name:38s} bbox {bbox}  w={bbox[2]-bbox[0]:3d} h={bh:3d}  fit {281.0/bh:.2f}"
        )

    # A contact sheet of everything, on the modal's own dark card colour.
    cols = 4
    rows = (len(built) + cols - 1) // cols
    sheet = Image.new("RGBA", (CANVAS_W * cols, CANVAS_H * rows), (41, 78, 118, 255))
    for i, (name, _, _) in enumerate(built):
        im = Image.open(STATIC / "assets/components/symbols/magnetic" / f"{name}.webp").convert("RGBA")
        sheet.alpha_composite(im, ((i % cols) * CANVAS_W, (i // cols) * CANVAS_H))
    VERIFY.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(VERIFY)
    print(f"\nverify -> {VERIFY.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
