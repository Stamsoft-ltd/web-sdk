# Win-card parts pipeline

Turns the Figma win-card designs into the game assets under
`static/assets/theme-park/v2/wins/parts/` and the generated layout table
`src/game/winCardParts.ts` that `<ThemeWinBoard>` assembles them from.

Run only when the Figma cards change.

## Figma nodes

File `Aw2jKodPiSHlDLcYjaNjbo` (Theme Park Slot). Each tier is a `Win` frame whose win-card elements
are loose children — panel, tier wordmark, medallion ring, P badge, six coins:

| tier      | frame     | panel     | wordmark  | ring      | badge     |
| --------- | --------- | --------- | --------- | --------- | --------- |
| sweet     | 6089:3983 | 6892:9277 | 6892:9286 | 6892:9285 | 6892:9284 |
| wild      | 6089:3837 | 6892:9253 | 6892:9256 | 6892:9254 | 6892:9255 |
| epic      | 6089:3691 | 6892:9222 | 6892:9224 | 6892:9223 | 6892:9231 |
| mythic    | 6089:434  | 6892:9207 | 6892:9197 | 6892:9198 | 6892:9205 |
| legendary | 6089:3545 | 6892:8314 | 6892:8315 | 6892:8316 | 6892:8323 |

The coin (`6892:9199` and its siblings) is one shared source used by all six positions on all five
tiers, so it is cut once.

## Getting the art

Use the Figma MCP `download_assets` on each node and keep the **`rawImages`**, not the `export`:
the node export has the frame's white fill baked in and comes back fully opaque. Each node returns
its raw at full size plus a quarter-size thumbnail of the same image, and some return an extra
opaque copy — take the **largest one that actually has transparency**.

Drop them in a working directory as `raw*/…png` and point `build_parts.py`'s `TIERS` table at them.

## Steps

```sh
python3 build_parts.py   # cut + trim + resize the parts, write layout.json
python3 build_bulbs.py   # find the marquee bulbs, write bulbs.json + verify_bulbs.png
python3 emit_ts.py       # write src/game/winCardParts.ts
```

`build_bulbs.py` also writes `verify_bulbs.png` with every detected bulb ringed — look at it. The
detection is a brightness-peak search with the open field excluded by region, and a panel whose
frame geometry changed could need `FIELD` retuned.

Placement is worth checking too: recompose the parts and compare against the Figma render. A part
that is 2% out looks fine alone and obviously wrong once the card is on screen.
