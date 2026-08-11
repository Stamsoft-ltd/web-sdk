# Duck turn source

`duck_pose_sheet.png` contains five key perspective drawings. `duck_inbetweens.png`
adds the first transition pass. `duck_midposes.png`, `duck_quarterposes.png`, and
`duck_eighthposes.png` add progressively tighter in-betweens. The build selects thirty-two monotonic
authored frames, then adds thirty-two motion-compensated filler frames. The shipped mirrored opening
frame stays byte-identical; authored frames keep their original orientation so the duck turns toward
the side it already faces.
`ring.png` is the complete isolated torus. The generated
drawings were made from tracked turnaround references with the built-in image
generation tool, then chroma-keyed to alpha.

The build splits the ring into rear/front depth arcs. The Duck turns inside the
ring instead of flattening the complete symbol. One fully opaque pose slot swaps
sixty-four drawings with no alpha cross-fade/blink. Independent duck/ring bones, bob,
lean, squash, overshoot, and settle create the
2.5D motion while preserving the glossy 2D game-art aesthetic.

Floaties mix star-only, stripe-only, and stripe-plus-star designs. The rear/front depth split
overlaps by two pixels, preventing a filtering seam while the ring floats and rotates.

Duck looks are a second synchronized Spine track, independent from the floatie. The build exports
25 looks: standard, four sunglasses combinations, four party-hat combinations, and sixteen looks
with independently selected hat/glasses combinations. `party_hat_combo_0.png` through
`party_hat_combo_3.png` and the four `sunglasses_combo`, `sunglasses_front_combo`, and
`sunglasses_rear_combo` families preserve the approved glossy Duck style and multi-color materials.
`hat_bone`, `glasses_bone`, and `glasses_rear_bone` translate, scale, and rotate the assets through
the turn. No accessory is raster-drawn per Duck pose.
Pond ducks randomize combinations; reel-owned ducks use a stable look derived from their cell.
Hats use the approved original 80:101 silhouette and uniform 50% Spine scale. Extra transparent
padding below the brim retains its prior head anchor while the cone becomes taller instead of being
squashed. Sunglasses use the approved fitted three-quarter model: full-eye lenses, asymmetric
perspective, and temple arms that wrap around the head. The complete glasses render below the Duck;
a front layer keeps the lenses and long near-side temple above it while cutting out only the far,
downward temple. At pose 48 the front view swaps to the authored rear temple-arm view. Its two arms
are spread beyond the head edges and stay fitted in every back idle.

Rebuild the four hat and four sunglasses source assets after changing an approved reference:

```sh
python3 apps/theme-park/scripts/build-duck-accessories.py
```

The jump peaks at 36 pixels. The turn runs at 80% of the previous speed: all sixty-four frames
finish in `0.14444 s`.

Rebuild all eight ring variants and the Spine export:

```sh
python3 apps/theme-park/scripts/build-duck-turn-spine.py
```

Output: `static/assets/spines/duckTurn/duck_turn.{json,atlas,png}`.

Animation contract per variant (`1` through `8`):

- `idle_N` — front float loop
- `turn_N` — 0.14444 s sixty-four-frame short-side front-to-rear jump-turn and prize pop
- `turn_batch_N` — identical restart alias for synchronized fast/turbo/skip reveals
- `back_idle_N` — persistent rear float loop
- `prize` slot — runtime-localised value/multiplier badge socket
- `look_idle_L`, `look_turn_L`, `look_turn_batch_L`, `look_back_idle_L` — accessory track, look
  `0` through `24`
