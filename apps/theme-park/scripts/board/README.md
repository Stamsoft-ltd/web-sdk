# The board frame

The purple frame around the reels. One drawing (`source/frame.png`) goes in; the three layers
`<BoardFrame>` needs come out, along with the geometry that pins them to the grid.

```sh
python3 scripts/board/build_board_frame.py
```

| asset                        | drawn                                    |
| ---------------------------- | ---------------------------------------- |
| `v2/board/frame-grid.webp`   | below the reels, clipped to the grid     |
| `v2/board/frame-rail.webp`   | ABOVE the reels                          |
| `v2/board/frame-glow.webp`   | above that again, additive, pulsing      |

It also writes `src/game/boardArt.ts` and `verify_board_frame.png`. **Look at that sheet.** It is
built the way the game builds the board — clipped grid down, rail on top — over a green ground that
appears nowhere in the art, so the two mistakes this pipeline can make are the only green left on
it: a divider that has drifted off its fifth, and a wedge at a corner, which is the park showing
through the board. The run prints how many such pixels are left inside the frame; it should be none.

## What it replaced

A rail of sixty painted bulbs. That art needed a great deal of machinery this one does not:

* Its rail overlapped the first and last cells, so the texture had to be **warped sideways** to put
  the bulbs on the extrapolated grid edges while pinning the four internal dividers.
* Because the rail overlapped the reels, only **emissive pixels** were allowed in the layer above
  them — anything opaque up there would have trimmed an edge reel.
* The bulbs were painted, not lit, so a **table of their centres** (`game/boardBulbs.ts`) drove a
  two-group chase of additive halos over them.

None of that survives, and none of it should come back: this drawing's opening is exactly the
gameplay rect, which is what lets the rail go above the reels opaque and the dividers land on the
cell boundaries without a warp. If the art is ever replaced again, keep that property.

## Two things to know before touching it

* **The dividers are not in the art.** They are drawn here at exact fifths of the opening, so a
  runtime that stretches the opening onto the gameplay rect lands them on the cells. Change
  `COLUMNS`/`ROWS` if the board's shape ever does.
* **`GRID_RADIUS` is not `BOARD_CORNER_RADIUS`.** The drawn corners bite much deeper into the
  opening than a rounded rect does, and the grid is clipped at the deepest of those cuts so it always
  runs past the opening — the rail above hides the overshoot. Clip any rounder and the park shows
  through the board's corners. `BOARD_CORNER_RADIUS` is a separate thing: the shape feature art is
  masked to.

## The pulse

Nothing in the art is lit — there is no bulb layer to switch on and no bulbs to switch. `frame-glow`
is the rail keyed by brightness, so it is the neon line and the bright lip of the bevel and nothing
else, and `<BoardFrame>` adds it back over the rail on a slow breath that quickens in a bonus. One
sprite's alpha changes per frame.
