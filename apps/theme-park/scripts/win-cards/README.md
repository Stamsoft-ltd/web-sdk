# Win-card pipelines

Two cards, two scripts, the same idea: cut the Figma design into loose pieces and generate the
layout table the game assembles them from.

| card                  | script              | assets                              | table                     | component        |
| --------------------- | ------------------- | ----------------------------------- | ------------------------- | ---------------- |
| tiered big win        | `build_marquee.py`  | `v2/wins/marquee/`                  | `src/game/winCardMarquee.ts` | `<WinCard>`      |
| MAX WIN (>= 25,000x)  | `build_maxwin.py`   | `v2/wins/maxwin/`                   | `src/game/maxWinCard.ts`  | `<MaxWinCard>`   |

Both use the same CARD SPACE: fractions of the PLATE width, origin at the plate's centre, so one
number in the game sizes the whole assembly.

Run either only when its Figma design changes.

## The marquee card

### Figma nodes

File `Aw2jKodPiSHlDLcYjaNjbo` (Theme Park Slot).

| piece                         | node       |
| ----------------------------- | ---------- |
| the whole card ("sweet win")  | 7013:9117  |
| plate + confetti composite    | 7013:9920  |
| plate alone                   | 7013:10594 |
| confetti alone                | 7013:10597 |
| SWEET wordmark                | 7013:9921  |
| MYTHIC / EPIC / WILD wordmark | 7013:9953 / 9954 / 9955 |
| LEGENDARY wordmark            | 7013:9956  |

There is **no MAX WIN wordmark in this style**, and the wordmarks cannot be spliced into one (none
of them contains an X). The win cap gets a card of its own instead — see below.

The design also draws a static confetti fan around the plate (7013:10597). It is deliberately **not
drawn in the game** (design ask, 2026-08-18): `<WinConfettiRain>` falls the same scraps down the
whole screen, and one moving paper vocabulary beats a frozen fan with a rain behind it. The scraps
are still cut and shipped, because the rain is made of them.

### Getting the art

Use the Figma MCP `download_assets` on each node and keep the **`rawImages`**, not the `export`:
the node export has the frame's white fill baked in and comes back fully opaque. Each node returns
its raw at full size plus a quarter-size thumbnail of the same image, and some return an extra
opaque copy — take the **largest one that actually has transparency**.

Drop them in a working directory and point `$MARQUEE_RAW` at it.

### Steps

```sh
MARQUEE_RAW=/path/to/raw python3 build_marquee.py   # cut the parts, write marquee.json + the TS table
python3 verify_marquee.py                           # recompose and write verify_marquee.png
```

Look at `verify_marquee.png` and compare it against the Figma render of 7013:9117. The composite
(7013:9920) is a single FLATTENED artwork, so the plate and the confetti fan had to be located
inside it by correlation rather than read off node boxes — a part that is 2% out looks fine alone
and obviously wrong once the card is on screen.

`build_marquee.py` also finds the plate's marquee bulbs by brightness peak. The field is flat dark
purple so brightness alone separates them; the only thing excluded by region is the tent flag's
gold knob (`FLAG_BELOW`). Do NOT reintroduce a rectangular field mask — the marquee's frame passes
through the middle of its own bounding box, so one swallows the whole top arch.

## The MAX WIN card

Figma `6090:4147`. Its own lockup rather than a sixth tier: a bulb-framed purple plate carrying the
MAX WIN wordmark and the amount lozenge, a duck bust over it, a coaster loop and a ferris wheel
behind it, balloons, tents and stars off both shoulders, and THEME PARK across the foot.

| piece                | node      | raw file             |
| -------------------- | --------- | -------------------- |
| plate + lozenge      | 6896:9344 | `plate.png`          |
| MAX WIN wordmark     | 6896:9345 | `word.png`           |
| duck bust            | 6896:9343 | `duck.png`           |
| coaster loop         | 6896:9363 | `coaster.png`        |
| ferris wheel         | 6896:9362 | `wheel.png`          |
| stars (two-up sheet) | 6896:9352 / 9348 | `sheet-stars.png` |
| balloons (two-up)    | 6896:9342 / 9346 | `sheet-balloons.png` |
| tents (two-up)       | 6896:9354 / 9341 | `sheet-tents.png` |
| THEME PARK           | 6896:9360 | *not exported* — reuses `v2/splash/logo.webp` |

```sh
MAXWIN_RAW=/path/to/raw python3 build_maxwin.py     # cut the parts, write maxwin.json + the TS table
```

Two traps here, both already paid for:

* **Only five of the eleven node boxes are placements.** Plate, wordmark, duck, coaster and wheel
  are whole images whose node box is exactly their drawn rect — every one of those boxes has its
  source image's aspect ratio, which is how you can tell. The other six are CROPS out of three
  two-up sheets, so their node boxes are clip windows and say nothing about where the art lands.
  Those six were fitted against the 1200x670 design render and are baked into `DESIGN` in the
  script; refitting them means scoring a candidate only on the pixels the piece actually OWNS
  (half of them sit behind the plate, and a plain correlation drifts into the park background).
* The three sheets are **the same file downloaded twice** — the left and right node of a pair both
  return the whole sheet. Split by column run, do not trust the node.

Bulb centres are found by brightness peak, as on the marquee. The wordmark additionally needs the
`WORD_MIN_BLUE` pale cut: the gold rim along the top of every letter is as bright as a lit bulb, and
on brightness alone MAX WIN comes back with a bulb every few pixels along each stroke. Check
`verify_maxwin_plate_bulbs.png` and `verify_maxwin_word_bulbs.png` after a run.

## The loading screen

Unrelated art, different pipeline: see `../loading/build_press_play.py`.
