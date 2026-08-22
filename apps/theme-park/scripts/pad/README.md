# The marquee pad

The circus sign the game celebrates on. One piece of art, two screens:

| screen                        | asset                                  | component         |
| ----------------------------- | -------------------------------------- | ----------------- |
| tiered big win                | `v2/wins/marquee/plate.webp`           | `<WinCard>`       |
| bonus complete ("congrats 2") | `v2/popup/congrats/marquee-wide.webp`  | `<CongratsPanel>` |

```sh
python3 scripts/pad/build_pad.py
```

Writes both webps, the generated table `src/game/padMarquee.ts`, and `verify_pad.png` — the art with
every bulb it found ringed and the field's top and bottom ruled across it. **Look at that sheet.**
A missed bulb is a dead spot in the chase, and a field measured wrong drops the copy off the sign.

## What it replaced, and why the lighting changed with it

The sign used to be a rendered one: gradients, a specular curl down the rail, and bulbs already
blown out in the art. It was also out of symmetry and lumpy along the bottom, and it did not belong
next to the flat symbol set the rest of the game was redrawn into (2026-08-18).

`source/pad.webp` is the flat drawing that replaced it. Nothing in it is lit — the bulbs are plain
cream discs — so all of the light on screen is now `<WinCardLights>` drawing a core inside each disc
and a halo spilling out of it. That is why the disc's **diameter** is generated here: the glow is
sized off the thing it is lighting, so re-exporting the art at another width cannot put the two out
of scale with each other.

The bulb tint is not the disc's own colour. A flat cream disc sampled on its own gives near-white,
and white light on a warm sign reads as a blown-out screenshot; the tint is the disc mixed with the
orange rail it is set into, which is the amber the sign is actually made of.

## Two things to know before touching it

* **The plate rect is pinned by the FIELD, not by the art's box.** `<WinCard>` measures the
  wordmark, the stars and the amount against the Figma card (`winCardMarquee.ts`), which was drawn
  on a differently-shaped sign. Lining the two boxes up would drop the wordmark off the field.
  `FIELD_CENTRE_Y` is where the design puts the middle of the field in card space, and the pad is
  placed so its own field centre lands there. Change the art, and the card re-pins itself.
* **The field is measured down the CENTRE COLUMN.** The silhouette is a cloud: its bottom lobes
  reach far below the middle. A bounding box would promise height that no copy can be written in.

`<CongratsPanel>` places the bonus-complete copy off `PAD_FIELD_CENTRE` for the same reason, and
works its own screen's height cap and vertical offset out from the pad rather than from the design
frame the screen was originally laid out on — see the module block there.
