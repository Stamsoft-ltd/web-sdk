#!/usr/bin/env python3
"""Emit SYMBOL_PAD_SCALE for game/constants.ts, and audit the whole set for scale consistency.

WHAT IT FIXES
-------------
Every symbol is drawn into a box that is `SYMBOL_SIZE_RATIOS[class]` of the cell, and its artwork
then fills however much of that box it happens to fill. Two symbols in the same class therefore end
up different sizes on the board purely because one build script fitted its art tighter than another.
Measured 2026-09-03, the LOW symbols spanned 0.766 to 0.895 of the cell in height -- a 17% spread
inside one class -- which is what "the lightning badge looks bigger" is a symptom of.

So: per asset key, a multiplier that cancels ITS OWN padding, leaving the class ratio as the only
thing that changes a symbol's size. After this pass every premium reaches 0.92 of the cell on its
limiting axis, every low 0.815, every special 0.95.

WHY IT MEASURES THE *_full COMPOSITES
-------------------------------------
The rebuilt symbols are a base texture plus loose parts, and several parts stick OUT of the base:
the magnet's antennae and hands, the compass's antennae, the chip's slime. Measuring the base alone
under-reports how much room the symbol actually needs, and the correction then pushes those parts
into the cell border. `scripts/build-paytable-symbols.py` already assembles each symbol at its rest
pose for the paytable, so those composites are the honest footprint -- run it first.

The composites exist for the DESKTOP art only, and that is fine: the mobile and landscape files are
resampled copies of the same drawing (coil_mobile.webp is coil.webp at half resolution), so the
content FRACTIONS are identical and one measurement serves every variant of a symbol.

WHY THE FLOOR IS 1.0
--------------------
Nothing in the set overfills its canvas, so every scale comes out >= 1 and this pass only ever
enlarges. If a future symbol is cut oversized the right fix is its build script, not a shrink here.

Run from apps/magnetic-2:  python3 scripts/build-paytable-symbols.py && \
                           python3 scripts/measure-symbol-padding.py
"""
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSETS_TS = ROOT / 'src' / 'game' / 'assets.ts'
CONSTANTS_TS = ROOT / 'src' / 'game' / 'constants.ts'
STATIC = ROOT / 'static'
SYMBOLS = STATIC / 'assets/components/symbols/magnetic'

# The assembled symbol for each PAY symbol, and the asset-key stem its variants share. The stems are
# matched with a word boundary against the key, so `aTile` does not also catch `scatterTile`.
SETS = [
    ('H1', 'premium/compass_full.webp', ('foxTile', 'foxWinTile')),
    ('H2', 'premium/lightning_full.webp', ('wolfTile', 'wolfWinTile')),
    ('H3', 'premium/portal_full.webp', ('bearTile', 'bearWinTile')),
    ('H4', 'premium/electromagnetic_device_full.webp', ('rabbitTile', 'rabbitWinTile')),
    ('L1', 'low/battery_full.webp', ('squirrelTile', 'squirrelWinTile')),
    ('L2', 'low/magnet_full.webp', ('aTile', 'aWinTile')),
    ('L3', 'low/coil_full.webp', ('kTile', 'kWinTile')),
    ('L4', 'low/energy_screw_full.webp', ('qTile', 'qWinTile')),
    ('WILD', 'special/wild_full.webp', ('wildTile', 'wildWinTile')),
    ('WILDx', 'special/wild_x10_full.webp', (
        'wild2xTile', 'wild3xTile', 'wild4xTile', 'wild5xTile', 'wild7xTile', 'wild9xTile',
        'wild10xTile',
    )),
    ('SCATTER', 'special/scatter_full.webp', ('scatterCustom', 'scatterWin', 'scatterTile')),
]

# SYMBOL_SIZE_RATIOS in game/constants.ts. Read rather than transcribed: a class ratio that changed
# there and not here would make every number this script prints quietly wrong.
CLASS_OF = {
    'H1': 'premium', 'H2': 'premium', 'H3': 'premium', 'H4': 'premium',
    'L1': 'low', 'L2': 'low', 'L3': 'low', 'L4': 'low',
    'WILD': 'special', 'WILDx': 'multiplierWild', 'SCATTER': 'special',
}


def die(msg):
    sys.exit(f'measure-symbol-padding: {msg}')


def class_ratios() -> dict:
    m = re.search(r'export const SYMBOL_SIZE_RATIOS = \{(.*?)\n\} as const;',
                  CONSTANTS_TS.read_text(), re.S)
    if not m:
        die('could not find SYMBOL_SIZE_RATIOS in game/constants.ts')
    out = {}
    for name, w, h in re.findall(r'(\w+):\s*\{\s*width:\s*([\d.]+),\s*height:\s*([\d.]+)\s*\}',
                                 m.group(1)):
        out[name] = (float(w), float(h))
    return out


def variant_keys(stems) -> list:
    """Every sprite key in assets.ts built from one of these stems (desktop / mobile / landscape)."""
    text = ASSETS_TS.read_text()
    keys = [k for k, _ in re.findall(r"^\t(\w+):\s*\{\s*type: 'sprite',\s*src: '([^']+)'", text, re.M)]
    return [k for k in keys if any(re.match(rf'{s}(Mobile|Land)?$', k) for s in stems)]


def main():
    ratios = class_ratios()
    rows, audit = [], []

    for name, comp, stems in SETS:
        path = SYMBOLS / comp
        if not path.exists():
            die(f'{comp} is missing -- run scripts/build-paytable-symbols.py first')
        im = Image.open(path).convert('RGBA')
        bb = im.getbbox()
        if not bb:
            die(f'{comp} is empty')
        fw = (bb[2] - bb[0]) / im.width
        fh = (bb[3] - bb[1]) / im.height
        cls = CLASS_OF[name]
        rw, rh = ratios[cls]
        # The limiting axis is the one that decides how big the symbol LOOKS. Equalising it is what
        # makes a class read as one set; equalising area instead would blow the narrow symbols
        # (the battery is 0.56 of the canvas wide) far past the cell.
        scale = round(1 / max(fw, fh), 3)
        keys = variant_keys(stems)
        if not keys:
            die(f'{name}: no sprite keys in assets.ts matched {stems}')
        if scale > 1.001:
            for k in keys:
                rows.append((k, scale, name, fw, fh))
        audit.append((name, cls, fw, fh, scale, rw * scale * fw, rh * scale * fh, len(keys)))

    print(f'// Generated by scripts/measure-symbol-padding.py -- cancels each symbol\'s own padding')
    print(f'// so the class ratio in SYMBOL_SIZE_RATIOS is the ONLY thing that changes its size.')
    print('export const SYMBOL_PAD_SCALE: Record<string, number> = {')
    for key, scale, name, fw, fh in sorted(rows, key=lambda r: (-r[1], r[0])):
        print(f'\t{key}: {scale},'.ljust(36) + f'// {name}: art fills {fw:.2f}w x {fh:.2f}h of its file')
    print('};')

    print('\n-- audit: share of the CELL each symbol occupies after the scale above', file=sys.stderr)
    print(f"{'sym':8}{'class':16}{'fills file':>13}{'pad':>7}{'W/cell':>8}{'H/cell':>8}{'keys':>6}",
          file=sys.stderr)
    for name, cls, fw, fh, scale, W, H, n in audit:
        print(f'{name:8}{cls:16}{fw:6.2f}x{fh:<6.2f}{scale:7.3f}{W:8.3f}{H:8.3f}{n:6}', file=sys.stderr)


if __name__ == '__main__':
    main()
