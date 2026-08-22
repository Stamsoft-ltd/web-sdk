# The park

The base game's backdrop. Figma 7051:2111 draws it as two nodes, and it ships as two files:

| asset                        | node      | drawn by       |
| ---------------------------- | --------- | -------------- |
| `v2/park/plaza.webp`         | 7051:2112 | `<Background>` |
| `v2/park/house.webp`         | 7051:2235 | `<ParkHouse>`  |

```sh
python3 scripts/background/build_background.py
```

Writes both webps, the generated table `src/game/parkScene.ts`, and `verify_background.png` — the
house composited where it will actually sit, with every bulb ringed, both lit openings boxed and
every lamp lantern circled. **Look at that sheet.** A missed bulb is a dead spot in the chase, and a
"lamp" that is really a flower bed is a glow hanging in the shrubbery; neither is visible in the
table.

## What it replaced

A dusk plaza, deliberately blurred (`background-blur.webp`) so its detail did not fight the reels.
This one ships sharp: the middle of the scene is an empty orange path, so there is nothing behind the
board to read through, and a blurred backdrop under the flat symbol set the game was redrawn into
(2026-08-18) looked like a photograph someone had left out of focus.

That art had a painted balloon stand, and `<EscapedBalloon>` was pinned to it. This one does not —
see `RELEASE` there.

## Two things to know before touching it

* **The house must stay on the backdrop's cover transform.** The plaza has its OWN smaller house
  painted into that corner, and the overlay covers it exactly, which is how the Figma frame composes
  them. Anything that moves the overlay — a different anchor, a canvas-relative position, a nudge for
  a nicer composition — reveals the painted one underneath it.
* **The lamps are found, not typed.** They come out of the same detection pass, on a normalised
  1197x670 downsample so the thresholds do not move when the source is re-exported at another scale.
  The plaza's own painted house is excluded from that pass (`LAMP_MIN_X`): its window and its door
  bulbs are the brightest warm pixels in the whole art, and not one of them is ever seen.

## The lighting

Nothing on the house is lit in the art — the bulbs are cream discs and the window is flat paint — so
all of it is `<ParkHouse>` drawing on the table this generates. It borrows `<WinCardLights>`, which
is the same lighting model the marquee pad uses, but nothing like the same settings: this is a house
in full daylight, so the floor is high enough that every bulb stays lit and the chase is a slow wave
crossing them rather than a front running round a sign.
