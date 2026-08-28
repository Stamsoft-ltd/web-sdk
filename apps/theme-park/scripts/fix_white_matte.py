#!/usr/bin/env python3
"""Un-matte artwork that was flattened onto white before its alpha was cut.

The signature is unmistakable and cannot be confused with white ARTWORK: a matted file's colour
climbs toward 255 as its alpha falls, because what the soft edge is mixed with is the background it
was flattened on. Real white art keeps its colour at every alpha. So the test is on the faintest
pixels only (alpha <= 64), where a matte has almost nothing but background left in it, and interior
pixels — where alpha is 255 and no matte can reach — are never touched by the correction.

Reverses the compositing per pixel: observed = true*a + 255*(1-a)  ->  true = (observed - 255*(1-a))/a.

    python3 scripts/fix_white_matte.py            # report only
    python3 scripts/fix_white_matte.py --write    # rewrite the files it flags
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'static/assets/theme-park'
# A matte shows up in the faintest pixels. 200 is far above anything the art itself reaches there
# (the clean siblings sit at 60-120), and far below the 210-250 a white matte leaves behind. The
# band starts at 8 rather than 0: below that sit the file's fully-cleared pixels, which carry black
# RGB by convention and would drag the mean down past the threshold on a genuinely matted file.
FAINT_LO, FAINT_HI = 8, 64
MATTE_MEAN = 200.0
# Ignore files with almost no soft edge — a handful of pixels is noise, not a matte.
MIN_FAINT = 40
# Second half of the test: the same file's nearly-opaque pixels, where the matte contributes almost
# nothing, must be much darker than its faintest ones. A logo that is simply painted white fails
# this (it is white at both ends); every matted file here clears it by 120+.
DENSE_LO, DENSE_HI = 192, 254
MIN_CLIMB = 80.0


def diagnose(path: Path):
    rgba = np.array(Image.open(path).convert('RGBA')).astype(np.float64)
    rgb, alpha = rgba[..., :3], rgba[..., 3]
    faint = (alpha > FAINT_LO) & (alpha <= FAINT_HI)
    dense = (alpha > DENSE_LO) & (alpha <= DENSE_HI)
    if faint.sum() < MIN_FAINT or dense.sum() < MIN_FAINT:
        return None
    return faint.sum(), rgb[faint].min(axis=-1).mean(), rgb[dense].min(axis=-1).mean()


def unmatte(path: Path) -> None:
    rgba = np.array(Image.open(path).convert('RGBA')).astype(np.float64)
    a = rgba[..., 3:4] / 255.0
    soft = (a[..., 0] > 0) & (a[..., 0] < 1)
    rgb = rgba[..., :3].copy()
    rgb[soft] = np.clip((rgb[soft] - 255.0 * (1.0 - a[soft])) / a[soft], 0, 255)
    Image.fromarray(np.dstack([rgb, a * 255]).astype(np.uint8)).save(path)


def main() -> int:
    write = '--write' in sys.argv
    flagged = []
    for path in sorted(ART.rglob('*.png')):
        found = diagnose(path)
        if not found:
            continue
        count, mean, dense_mean = found
        if mean >= MATTE_MEAN and mean - dense_mean >= MIN_CLIMB:
            flagged.append((path, count, mean, dense_mean))
    for path, count, mean, dense_mean in flagged:
        print(
            f'{"fixed " if write else "matted"}  {path.relative_to(ROOT)}  '
            f'faint={count} {mean:.0f} -> dense {dense_mean:.0f}'
        )
        if write:
            unmatte(path)
    if not flagged:
        print('no white-matted art found')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
