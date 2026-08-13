# Congratulations panel pipeline

Turns the Figma congratulations design into the game assets under
`static/assets/theme-park/v2/popup/congrats/` and the generated layout + bulb table
`src/game/congratsPanelParts.ts` that `<CongratsPanel>` assembles them from.

`<CongratsPanel>` is shared by both bonus screens — `<FreeSpinIntro>` (bonus won) and
`<FreeSpinOutro>` (bonus complete) — so this runs once for both.

Run only when the Figma design changes.

## Figma nodes

File `Aw2jKodPiSHlDLcYjaNjbo` (Theme Park Slot), frame `6909:9366` ("Free spins won"). The screen's
pieces are loose children of the frame:

| part                     | node      | box in the frame |
| ------------------------ | --------- | ---------------- |
| panel (frame + well)     | 6909:9521 | 318,16 566x567   |
| medallion ring           | 6909:9528 | 494,179 212x318  |
| gold P                   | 6909:9529 | 559,265 89x133   |
| CONGRATULATIONS! (text)  | 6909:9450 | 36px, white      |
| YOU WON (text)           | 6909:9449 | 28px, #D836FC→#272FDD |
| amount (text)            | 6909:9523 | 60px, gold ramp  |

The boxes are hard-coded in `build_congrats.py` — everything the component places is expressed as a
fraction of the PANEL's box, so one size scales the whole screen.

## Getting the art

Use the Figma MCP `download_assets` on each node and keep the **`rawImages`**, not the `export`: the
node export has the frame's white fill baked in and comes back fully opaque. Each node returns its
raw at full size plus a quarter-size thumbnail, and some return an extra opaque copy — take the
**largest one that actually has transparency**.

Save them as `source/panel.webp`, `source/ring.webp`, `source/p.webp`, **lossless**
(`img.save(path, 'WEBP', lossless=True, method=6)`). They are committed — a Figma asset URL expires
after a week, so a pipeline whose inputs live in someone's Downloads folder cannot be re-run.

Unlike the win cards, nothing here is trimmed: each raw has the same aspect as its node box, so the
box IS the image and fractions map straight across.

## Steps

```sh
python3 build_congrats.py   # write the webp parts, find the bulbs, emit congratsPanelParts.ts
```

It also writes `verify_panel_bulbs.png` and `verify_ring_bulbs.png` — every ring drawn on them
should sit on a bulb. Check them; a bulb found on bare metal shows in game as a light blinking on
nothing, and it will only appear at the phase of the chase that lights it, so a single screenshot of
the running game will not catch it.

## Bulb finding

The bulbs are painted into the art, so lighting them means finding their centres here and letting
`<WinCardLights>` draw an additive glow on each. A bulb is a compact ROUND bright blob; the
compactness test is what keeps the gold scrollwork's specular highlights out, since a highlight
running along a curl is a local maximum with darker surroundings and passes every brightness test.

Each art needs one extra discriminator of its own:

- **panel** — a blue floor. Its bulbs are white-lilac; everything else bright on that art (the gold,
  the amber studs, the sparks on the field) is warm.
- **ring** — a radius band. Its bulbs sit on one circle; the four stars and the outer rail's tiny
  studs are outside it and pass everything else.
