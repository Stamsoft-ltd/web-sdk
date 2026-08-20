# Congratulations marquee pipeline

Turns the Figma congratulations designs into the game assets under
`static/assets/theme-park/v2/popup/congrats/` and the generated aspect + bulb table
`src/game/congratsPanelParts.ts` that `<CongratsPanel>` draws them with.

`<CongratsPanel>` is shared by both bonus screens — `<FreeSpinIntro>` (bonus won) and
`<FreeSpinOutro>` (bonus complete) — so this runs once for both. They pick their art with a
`variant` prop.

Run only when the Figma design changes.

## Figma nodes

File `Aw2jKodPiSHlDLcYjaNjbo` (Theme Park Slot). Two frames, one per screen:

| screen          | frame       | marquee node | box in the frame |
| --------------- | ----------- | ------------ | ---------------- |
| bonus won       | 7033:24761  | 7033:24760   | 348,1 524x600    |
| bonus complete  | 7032:19821  | 7032:20069   | 337,57 532x377   |

Everything else on those screens is drawn by the component: the copy, the black amount well (a
rounded plate whose width follows its text) and the bonus's scatter symbol in the middle of the tall
one. The design's third layer, a static confetti fan behind the marquee (`7033:24815` /
`7032:19875`), is deliberately **not** shipped — `<WinConfettiRain>` falls the same scraps down the
whole canvas instead (design ask, 2026-08-18), so the screen has one vocabulary of paper.

The boxes are hard-coded in `build_congrats.py`, but only their **aspect** is used; the component
places everything as a fraction of the marquee it is drawing.

## Getting the art

Use the Figma MCP `download_assets` on the marquee node and keep the **`rawImages`**, not the
`export`: the node export has the frame's fill baked in and comes back fully opaque. Each node
returns its raw at full size plus a quarter-size thumbnail, and some return an extra opaque copy —
take the **largest one that actually has transparency**.

Save them as `source/marquee-tall.webp` and `source/marquee-wide.webp`, **lossless**
(`img.save(path, 'WEBP', lossless=True, method=6)`). They are committed — a Figma asset URL expires
after a week, so a pipeline whose inputs live in someone's Downloads folder cannot be re-run.

Nothing is trimmed: trimming would move every bulb by the margin and buy nothing.

**The tall marquee is stretched.** Its raw is 1086x1448 (0.750) in a 524x600 box (0.873), i.e. the
design pulls it 16% wider — so that is what ships, and `build_congrats.py` bakes the stretch in by
resizing to the box's aspect. Doing it here rather than in the component means the bulbs are found
in the shipped image's own space and a round glow still lands on a round bulb. The wide raw already
has its box's aspect to within 0.1%, so nothing happens to it.

## Steps

```sh
python3 build_congrats.py   # write the webp marquees, find the bulbs, emit congratsPanelParts.ts
```

It also writes `verify_tall_bulbs.png` and `verify_wide_bulbs.png` — every ring drawn on them should
sit on a bulb. Check them; a bulb found on bare metal shows in game as a light blinking on nothing,
and it will only appear at the phase of the chase that lights it, so a single screenshot of the
running game will not catch it. Current counts: **85** on the tall, **49** on the wide.

## Bulb finding

The bulbs are painted into the art, so lighting them means finding their centres here and letting
`<WinCardLights>` draw an additive glow on each. A bulb is a compact ROUND bright blob; the
compactness test is what keeps the gold rail's specular highlights out, since a highlight running
along a curl is a local maximum with darker surroundings and passes every brightness test.

One extra discriminator does the rest: `min_core_green`. The only things on this art that survive
roundness without being bulbs are the white wedges of the striped tent top, which at this scale are
a convincing round blob — but they sit in the tent's red shade, so their core is pink (G/R 0.68)
where a lit bulb's core is blown out towards white (0.82 and up on every real one). Both marquees
use the same thresholds: same artist, same rail, both shipped 1024 wide.

## Where the layout lives

Not here. `<CongratsPanel>`'s `LAYOUT` table holds the copy positions, both taken straight off the
two Figma frames — Y as a fraction of the marquee's HEIGHT, sizes as a fraction of its WIDTH. Those
are no longer the same number: the old panel was square to within 0.2% and these are 0.87 and 1.41.
