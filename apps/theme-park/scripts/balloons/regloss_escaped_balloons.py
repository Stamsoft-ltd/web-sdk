#!/usr/bin/env python3
"""Repaint the drifting balloons' highlight, in place.

    python3 scripts/balloons/regloss_escaped_balloons.py

Rewrites `static/assets/theme-park/v2/balloon/{pink,orange,yellow,green,blue}-flat.webp` — the five
<EscapedBalloon> flies up the plaza sky — with the highlight fix described in `lib/balloon_gloss`.
Idempotent: it finds its work by looking for paper-coloured pixels, so a second run reports that
there is nothing left to do.

WHY THIS EXISTS RATHER THAN A RE-RUN OF build-escaped-balloon.py

Those five are CUT from `symbols/h3-balloons-marquee.webp`, and the fix is applied upstream of that
by `build_balloons.py` — so the obvious move is to rebuild the marquee and re-cut. It does not work:
`scripts/build-escaped-balloon.py` no longer reproduces the sprites it shipped. Run against the
current marquee it comes back 150x259 where the shipped art is 150x273, and the cut carries the
coloured whiskers its own docstring warns about — its `offset(body, FRAME)` takes slices of the blue
and the green balloon behind. Its printed constants disagree with <EscapedBalloon>'s too
(BODY_ASPECT 134/159 against the component's 130/147). The shipped sprites predate a change to the
bunch art and are correct; the script is stale, and re-running it would swap a highlight problem for
a whiskering one.

So this touches the pixels that are wrong and nothing else. When the cut script is repaired, this
one becomes redundant and should go with it — until then it is the only way the fix reaches the sky.
"""

import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.balloon_gloss import soften  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
BALLOON_DIR = ROOT / "static/assets/theme-park/v2/balloon"

#: Same quality the cut script writes them at, so this is not silently a second generation loss.
QUALITY = 92


def main():
    changed = 0
    for path in sorted(BALLOON_DIR.glob("*-flat.webp")):
        glossed = soften(Image.open(path).convert("RGBA"))
        if not glossed:
            print(f"{path.name}: already glossed, nothing to do")
            continue
        image, area, body = glossed
        image.save(path, quality=QUALITY, method=6, alpha_quality=100)
        print(
            f"{path.name}: highlight {area}px repainted over "
            f"rgb{tuple(int(value) for value in body)}"
        )
        changed += 1
    print(f"{changed} of 5 rewritten")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
