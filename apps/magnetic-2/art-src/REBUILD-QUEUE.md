# MOTHERSHIP symbol rebuild queue

Briefs collected 2026-09-02. **Figma access was restored mid-session** — the block was a seat
problem (a Collab seat on Professional is 6 tool calls per MONTH, not per day; Dev/Full is 200/day)
plus a file-access problem, both fixed by the user. `whoami` staying alive while everything else
fails is NOT evidence of a permission fault: it is on Figma's rate-limit-exempt list along with
`create_new_file` and `add_code_connect_map`.

Art notes that held up across all of these:
- `download_assets` returns every raster TWICE, opaque and transparent. Take the transparent one
  (`minAlpha == 0`). The whole-node `export` is always opaque and is usually tiny — it renders the
  node's PLACEMENT rect, which for these is 51x69, not the artwork.
- It also returns the same set for sibling nodes: 9034:26096 and 9034:25820 served identical
  rasters. Do not assume one call per node means one asset per node.
- Several parts arrive as **SVG**, not raster, and some of those are real artwork rather than
  swatches — the scatter's alien and eye are vectors. `cairosvg` is available; render them at
  SUPERSAMPLE x the on-screen size.

---

## 1. BATTERY (L1) — DONE 2026-09-02

Housing `9034:25820` / `9034:26096` (same raster, empty red panel, green strips, cyan antennae),
cell `9034:26061` (the smiling battery with a bolt), balloons `9034:26069` (r=1.5) and
`9034:26092` (r=1).

> base: random bubbles but very few. win: the battery inside blinks and pops, and a lot more
> random bubbles behind.

Art rebuilt through `build-battery-art.py`; PANEL and CELL re-measured. Win blink on the cell is a
tint PLUS an additive ghost of the same sprite — tint alone only scales the texture's channels
down, so it can darken the cell but never make it look lit. Blink period 0.31s, deliberately not a
divisor of the 0.5s pop or the two read as one event. Win balloons 18 -> 34.

**Both balloon swatches are the same fill, #FD5947** — the design varies SIZE, not colour. The
first pass had two hues and invented the difference. The rim and specular highlights matter more
now: one colour on the panel (measured rgb(229,19,28)) leaves size as the only cue, and an unlit
disc of #FD5947 on that ground reads as a stain.

Note `9034:26092` was also given as the scatter lockup — it is a 2px circle swatch, so that was a
paste slip. The scatter's real parts are the `9041:*` set.

## 2. SCATTER — DONE 2026-09-02

Machine `9041:26985` (EMPTY tube, empty base plaque, two green lamps), word `9041:27047`, alien
`9041:27059` (vector), eye `9041:27051` (vector).

> base: the alien blinks slowly and randomly. win: it jumps, the SCATTER text pops / zooms in and
> out, and add lights to the green lights.

`build-scatter-art.py` was rewritten around the new parts. It no longer reconstructs anything — the
old version had to inpaint the alien out of a flat lockup to get an empty tube, and cut the word off
the plate and fill the hole behind it. All four asks are live: randomised slow blink (one blink
opportunity per 3.6s slot, taken 72% of the time, so gaps run from a quick double-blink to ~10s of
stillness), hop, word zoom, and blinking lamps.

Traps:
- **The alien must not fill the tube.** At `ALIEN_OF_TUBE_W = 0.78` it stood 107px in a 114px tube
  and HOP_LIMIT came out at 0.0000 — head already touching the lid, so every frame of the hop was
  eaten by the dome occluder. 0.62 gives +0.0838 of clearance. The script prints HOP_LIMIT; check
  it after any change.
- **The plaque well needs the largest connected blob, not a bbox.** Its dark indigo is also the
  OUTLINE colour used all over the capsule, so the raw key traces the whole base and the bbox of
  that put the word straight over the two green lamps.
- `measure-green-lights.py` finds **4** lamps here — two antenna balls and two on the base — and
  correctly skips the word and the dome, because it selects on compactness and roundness rather
  than colour. They blink around the ring, each a quarter-period behind the last.

## 3. COMPASS (H1) — DONE 2026-09-02

Bezel `9043:27077` / `9043:27116` (same raster), alien face `9043:27102`, antennae `9043:27109` and
`9043:27107`, eye `9043:27112`, badges `9043:27117` (N) and `9043:27118` (S). `9043:27119` is a
green glossy ball with no obvious home — left unused rather than guessed at.

> base: `27109` and `27107` move slightly. win: N and S shake slightly, the alien moves happily,
> the green lights blink.

**The redesign changes what this symbol IS.** There is no needle anywhere in the new part set — it
is a lit ring with an alien face in it. `compass_needle.webp` and `compass_alien.webp` are deleted
and the win spin-up went with them. Live now: antennae sway in both states (base ask), eye blinks on
the randomised slot schedule, face hops happily on a win, N/S shake in antiphase, rim arcs chase.

Traps, all of which cost time:
- **The alien face had to be cut out of the alien.** The design ships the face WITH its antennae
  baked on and there is no node for the face alone. Splitting the SVG on its fills looks right (the
  antennae and the head share `#B0F342`) but those two paths are the head disc and ONE antenna, so
  removing them leaves a headless face. It is a morphological OPENING now: erode until the stalks
  break, keep the largest blob, dilate back. A measured sweep showed radii 10–26 leave the alien as
  one blob and 34 splits it cleanly — the stalks are much thicker than they look.
- **The antenna's height must come from the part's own aspect, not from the measured blob.** The
  blob is the antenna minus the stalk end the head covers, so using its height draws a truncated
  antenna floating clear of the face. Width from the blob is fine; the hidden part is stalk.
- **Anchor the antennae at the BOTTOM.** Anchored at the centre the sway slides them sideways
  instead of leaning them.
- **The face must not fill the well.** At `FACE_OF_WELL = 0.86` it covered the four green arcs —
  the very things the brief asks to blink — and the N/S badges sat on top of it. 0.52.
- **The green lights here are ARCS, not bulbs**, so the round-and-compact filter found zero of them.
  `measure-green-lights.py` now also emits arcs, as chains of points ordered around the plate centre
  sharing a `group` — phase the blink by group or the arc ripples point-by-point instead of
  lighting. Compass: 4 groups / 36 points. Scatter: 4 groups / 4 points (bulbs).

## 4. LIGHTNING BADGE (H2 / wolfTile) — DONE 2026-09-02

Lockup `9051:27145`; parts `9051:27147`, `9051:27153`, `9051:27151`. Staged in `art-src/lightning/`.

> win: the lightning pops and blinks.

Built through `build-lightning-art.py` into `lightning.webp` (+ `_mobile`) and `lightning_bolt.webp`,
driven by `LightningSymbol.svelte`, wired on `H2`.

**Which board symbol this is is now established.** The queue used to say it had not been. Rendering
the three unbuilt lockups beside the live art settles all three at once: lightning -> **H2**
(`wolfTile`), circuit -> **L4** (`qTile`, `energy_screw.webp`), arrows+eye -> **H3** (`bearTile`,
`magnetic_core_cube.webp`). Sections 5 and 10 can be wired without re-deriving this.

The **H3** half of that has since been overtaken: the PORTAL brief of 2026-09-02 replaces the same
`magnetic_core_cube.webp`, and section 10 is now the portal. The slot is right, the lockup is not.
See section 10.

Traps:
- **The lockup node is 64x64.** `export` renders a node at its PLACEMENT rect, so the reference came
  back as a 64px thumbnail — useless for measuring four corner balls. Re-exported with
  `defaultScale: 4`. Check a node's natural size before trusting its reference.
- **Key on the yellow FACE, not the blue frame.** The four green balls sit on the frame's corner
  lobes and their dark outlines cut the blue into pieces, so the frame's key box in the reference is
  a different SHAPE from the one in `body.png` and aligning on it lands the badge wrong.
- **The bolt is two SVGs, white over orange.** They bake into one texture: nothing in the brief moves
  them apart, and one texture means the pop scales one sprite. Each SVG is rendered at the size ITS
  OWN reference box asks for and dropped at that box's offset inside the union — rendering both at
  the union's size stretches each by the other's overhang.
- **`SYMBOL_SIZE_OVERRIDE.wolfTile` had to GO, not be re-tuned.** It was 1.16 because the old export
  put only a 210px badge on the 328x264 canvas; the rebuild fits the badge to the canvas (251x264,
  the same as the compass and the EM device), so the override would now oversize it. Note the
  failure mode: the loose bolt is placed in fractions of the SYMBOL BOX, so it scales with any
  override and stays aligned — a wrong override shows up as a badge out of scale with the set,
  never as a bolt out of place, which is much easier to miss.
- **`BLINK_P` is deliberately not a divisor of `POP_P`.** On a period that divides the pop, the blink
  and the pop land together every cycle and the eye reads ONE event instead of a bolt that is both
  growing and flashing.

### Fixed along the way: the paytable was showing half-built symbols

Splitting a symbol into a base plus loose parts breaks `CustomInfoModal.svelte`, which is plain HTML
— one `<img>` per row — so it can only ever show ONE file. Pointed at a rebuilt base it drew the
symbol with its character missing: an empty yellow lightning badge with no bolt, an EM device with
no antennae or lens, a compass with no needle, a battery with no cell, a magnet with no face, a
scatter with no alien, and a WILD row that was a bare horseshoe magnet with the word WILD nowhere on
it. All of those were correct before the rebuild, because the old art was a single flat file.

`scripts/build-paytable-symbols.py` now composites each layered symbol at its REST pose into a
`*_full.webp`, and the modal (plus `CustomBuyBonusModal`'s feature/brief icons) points at those.

- It **parses the placements out of the components** and the source paths out of `assets.ts`.
  Nothing is transcribed: a hand-copied table would be right exactly once, and the next 0.004 nudge
  to a needle would put the paytable quietly out of step with the board.
- **All three anchor conventions cancel at rest** — plain 0.5, the magnet's `{x:0.5,y:1}`, and the EM
  device's measured stalk-base PIVOT all reduce to a box centred on `(dx, dy)`. So the script models
  no anchors at all. That assumption breaks the moment a component gains a layer whose rest pose is
  rotated or offset.
- Additive GHOST layers are **excluded** — compositing one would light the symbol in a still image.
- The `fit` factors were per-symbol taste; they are now one rule, printed by the script:
  `fit = 281 / (alpha box height)`, i.e. "make the rendered art about 36px tall" at the row's ~42px
  image box. Every previous hand-picked value works out to roughly that.
- Two rows were also pointing at RETIRED files whose names do not match their art (`horseshoe.webp`
  is the old compass, `low/bolt.webp` is the old battery). Right symbols, dead art.

**Re-run this script after touching any symbol component or its parts.** It is the only thing that
keeps the paytable and the board telling the same story.

## 5. CIRCUIT (L4 / qTile) — DONE 2026-09-02

**Re-briefed 2026-09-02.** `9053:27244` is the OLD lockup; parts are `9053:27227`, `27240`,
`27250`, `27249`, `27243`, `27228`, `27234` (note `27243`, not the `27241` this section used to
list).

Replaces `low/energy_screw.webp` (the green chip). Mapping established in section 4 — do not
re-derive it.

> maybe make the green `9053:27249` move or drop animated in static mode, and in win make the alien
> zoom and become happy and maybe some lightning.

`scripts/build-circuit-art.py` cuts the base (12 pins + framed board), the face plate with its mouth
removed and filled, the mouth, one eye and the two slime blobs; `src/components/CircuitSymbol.svelte`
assembles them. Idle: each blob sags on its own period. Win: the alien zooms and grins, its eyes
squint, and a bolt jumps between the board's two screws.

### Traps this one set

* **The pins cannot be measured off the reference.** Keying the gold finds the *fill* — no stroke,
  and no inner half (that runs under the frame). Drawn at those bounds they came out as stubby
  squares with a thin brown edge, which is what the user rejected. They are reconstructed from
  `9053:27243`'s own numbers instead: gold is 4.8/6 of the pin's width, the pin is 8/6 as long as it
  is wide, and it grows inward from whichever edge of the artboard it touches.
* **A black stroke is invisible on a dark composite.** The first check of the fix looked like it had
  not applied. It had; the verify crop was composited on the board's dark purple. Check pin art on
  white.
* **`build-paytable-symbols.py` learned to compose placements.** The eyes and mouth are offsets from
  `FACE`, not from the symbol box, because they live in the container the win zooms. A row can now
  name a chain — `"FACE+EYE_L"` — which sums dx/dy down it and takes w/h from the last link, exactly
  what pixi does with a nested `<Container>`.

## 6. MAGNET (L2, the horseshoe) — DONE 2026-09-02

Body `9046:16277`; parts `9046:16278`, `16279`, `16280`, `16281`, `16282` — **all five part nodes
serve the SAME raster**, a single sheet holding the face, both antennae and both green hands. There
is no per-part node to download.

> base: the antennae shake very slightly. win: electricity between + and -, and the antennae move
> faster.

Staged in `art-src/magnet/`: `body.png` (orange horseshoe with the +/- caps, no face), `parts.png`
(the five loose pieces), `reference.png` (the composed lockup the user supplied).

Built by `scripts/build-magnet-art.py` into `MagnetSymbol.svelte`, wired in `Board.svelte` on
`cell.name === 'L2'` (the body keeps the historical filename `nut.webp`). Antennae shake slightly in
base and run 4.2x faster and wider on a win; electricity strikes between the `-` and `+` caps.

Traps:
- **Body and parts are both 1536x1024 in the same frame, and compositing them directly does NOT
  reproduce the symbol.** The sheet is a LOOSE-PARTS layout: the face lands low across the magnet's
  gap, the antennae sit inward, the hands sit on the caps. The real arrangement exists only in
  `reference.png`. So the ART comes from the sheet and the PLACEMENT from the reference, mapped
  through the body, which appears in both.
- **Scale from the body's HEIGHT, never its width.** The green hands overlap the arch's shoulders in
  the reference and hide ~22px of orange, so the visible orange box is 5.6% narrower there and a
  width-derived scale bakes that error into every placement.
- **Fit the ASSEMBLY to the canvas, not the body.** The antennae stand above the arch; fitting the
  body to full canvas height put them at dy -0.55, off the top of the symbol box.
- Sign error worth not repeating: the body's offset inside the assembly is ADDED to the centring
  term. Subtracting it pushes the body up by exactly the gap the antennae needed and the arch loses
  its crown off the canvas.
- The bolt's kinks are perpendicular to the terminal-to-terminal axis and taper to zero at both
  ends, so it always LANDS on the caps. Uniform jitter leaves the ends dancing off them, which
  reads as a loose wire rather than an arc.

## 7. WILD — DONE 2026-09-02

Magnet body `9053:27270`, WILD plaque `9053:27271`, lightning bolt `9053:27272`, eye-blob
`9053:27279`, eye `9053:27273` (SVG). Staged in `art-src/wild/`, plus the designer's `reference.png`.

> the eye blinks, the lightning zooms in/out or pops, and the WILD lights.

Built through `build-wild-art.py` into `wild.webp` (+ `_mobile`), `wild_plaque`, `wild_word`,
`wild_blob`, `wild_eye` and `wild_bolt`, driven by `WildSymbol.svelte`.

**Placement came from the reference, as with the magnet — the five rasters share no frame at all**
(1254x1254, 2172x724, 1217x1293), so their own coordinates carry nothing. The script works entirely
in REFERENCE coordinates: key each part in the reference to find where it sits, key it again in its
own raster to learn what that key leaves out, and use the ratio to expand back to the full extent,
outline included. That two-image comparison earns its keep here because almost everything is
occluded — the blob's stem runs behind the arch crown, and the plaque's top edge runs behind the
caps, so both scale from WIDTH (blob anchored top, plaque anchored bottom).

Traps, in the order they bit:

- **The whole magnet cannot be placed as one part.** One mapping puts the arch dead on — a 50%
  overlay against the reference shows no doubling along it anywhere — and still lands the caps 27
  reference-px too low. The design SEATS THE CAPS HIGHER than the raster does. The arch is placed
  from the two limb blobs; each cap is placed from its own. All four separate cleanly because every
  cap carries a full dark outline where it meets its limb, so the colour key never joins them.
- **And the caps are squashed.** Matching a cap's width and taking its height from the art's own
  aspect leaves it 13% too tall, which pushes the N and S glyphs down behind the plaque — visible in
  the game, invisible in a 50% overlay, because the reference underneath fills the missing halves
  in. The vertical scale comes from the white GLYPH, the only feature inside a cap the plaque does
  not cut. Both poles landed on 0.87 independently (0.869 / 0.877), which is what makes it a real
  measurement rather than noise. The script cross-checks it against the cap-top-to-glyph-top gap and
  dies if the two disagree by more than 8%.
- **A cap layer needs its outline, and a padded crop will not do it** — the limb runs directly above
  each cap, so a padded box drags a red stub in with it. `cap_ink` grows the cap's colour blob one
  step at a time and stops just before the growth touches the limb's colour: the gap between them IS
  the outline, so the last safe radius covers it exactly (17px and 16px at source scale).
- **The base texture keeps the raster's own caps** rather than cutting them out. They end up
  entirely underneath the re-seated ones (same x to within 2px, and everything below the plaque line
  is covered anyway), so cutting would buy nothing and would risk exposing a bite in the limb ends.
- **The reference's arch gap is NOT a white fill.** It samples 245,245,245 — the same as the page
  background. The old `wild.webp` looks like it has one, which makes the trap easy to believe.
- **`wild_word` is not cut out of the plaque.** It is the plaque's own pixels masked to the pink,
  drawn additively at the plaque's exact placement, so the glow lands on the glyphs and nowhere
  else. No hole to fill behind it, and no second copy of the bar to keep aligned.

`WildSymbol` covers idle AND win, so `Board.svelte` skips these cells in the board-wide
`drawWildIdle` layer, exactly as it already skips the scatter. **Multiplier wilds are deliberately
NOT routed through it** — their art still bakes the xN into one flat texture, so they would render a
plain WILD plaque and drop the multiplier. They join in section 9.

## 8. ELECTROMAGNETIC DEVICE (H4 / rabbitTile) — DONE 2026-09-02

Lockup `9046:16355`; parts `9046:16361` (same raster as the lockup), `16363` (green arm), `16367`
(both antennae in one raster), `16374` (the lens). Staged in `art-src/emdevice/`.

> base: the antennae shake very slightly. win: current between the antennae.

Built through `build-emdevice-art.py` into `electromagnetic_device.webp` (+ `_mobile`),
`em_antenna_l/r.webp` and `em_lens.webp`, driven by `EmDeviceSymbol.svelte`, wired on `H4`.

**Placement was free here — do NOT reach for the reference-matching machinery.** All four parts are
1254x1254 in the same frame AND already positioned, so `alpha_composite` in layer order reproduces
the lockup exactly. That is the opposite of the magnet, whose same-frame sheet was a loose-parts
layout, and of the wild, whose parts do not share a frame at all. Three symbols, three answers:
composite first, then decide.

Layer order is body < arm < antennae < lens. The arm merges into the base (nothing moves it); the
antenna stalks run behind the lens, which is what hides each joint while the antenna leans.

Traps:
- **The antennae arrive in ONE raster.** They are cleanly separated in x — columns 82..488 and
  766..1171, nothing between — so a midline split is exact and the magnet's flood fill is not
  needed. The script CHECKS this (`column_runs` must return exactly two runs) rather than assuming.
- **Pivot at the stalk base, not the box centre.** Each stalk leans inward, so the blob's
  bottom-CENTRE is a point in mid-air; the antenna would slide sideways instead of leaning. The
  pivot is the centroid of the bottom 6% of the blob, emitted as a sprite ANCHOR, and the sprite's
  x/y then has to be shifted by `(pivot - 0.5) * size` to keep the box where the placement says.
- **`ARC_BOW`'s ceiling is the symbol box, not the lens.** A straight line between the balls
  (dy -0.154) runs through the eye, so the bolt bows up — but pixi does not clip a Container, and
  the first value tried (0.33) peaked past dy -0.5 and drew over the row above. 0.27 peaks near
  -0.44. Verified frame by frame in `verify_emdevice_anim.png`, which mirrors the component's math
  offline; the same strip showed 0.1s strikes at 6Hz reading as a continuous wire, so `ARC_DUR`
  dropped to 0.07.

### Fixed along the way: every loose symbol part was deferred on desktop

The first desktop boot logged a wall of `Sprite: key "..." is not found in loadedAssets` — not just
the new EM keys but `batteryCell`, all six `magnet*`, all six `compass*` and all four `scatter*`.
They had all been added to `MOBILE_ONLY_KEYS`, and on a desktop layout that list is flagged
`defer`, so the whole layered-symbol part set missed the gating pass. Every one of these symbols
drew as a bare shell for the first seconds of a desktop session — a compass with no face, a device
with no antennae. They are layout-INDEPENDENT (placed by fractions of the symbol box, so the same
crops serve all three layouts) and ~350KB in total, so they were pulled out of the list entirely.
A desktop boot is now clean: 0 console errors, 0 HTTP failures.

## 9. WILD MULTIPLIERS — DONE 2026-09-02

`9076:28836/28837/28838`, `9074:16748/16736/16737`. Staged in `art-src/wildmult/`.

> same animation as the normal wild.

Built through `build-wild-mult-art.py` into `wild_disc.webp` and `wild_mult_x2..x10.webp` (21KB for
the whole set). `WildSymbol.svelte` took a `multiplier` prop rather than gaining a second component:
the disc replaces the bolt in the magnet's gap and inherits the bolt's own pop and flash, which is
literally "the same animation as the normal wild".

**The multiplier lockup IS the normal wild with one part swapped.** Keying both references and
lining their magnets up gives a constant offset of (+63, +31), under which the blob, the plaque and
the word all land within 1px. So there was no second lockup to measure — only the disc, mapped
through that offset into the wild's reference frame and then through the wild's existing canvas
transform. The script asserts both the shared scale and the blob's drift and dies rather than
silently offsetting a lockup that has actually moved.

**The design offered two layouts and the ART chose.** The designer drew the disc-over-the-gap
variant next to one with `WILD` / `x10` stacked on a taller plaque. Only the first is buildable: the
delivered parts are the disc plus the standard-height plaque, and the taller plaque was never
exported. `reference_stacked.png` is kept so that can be re-checked rather than re-argued.

Traps:
- **The disc's violet is not the plaque's purple** — (101,9,252) against (87,55,171). One key finds
  the disc without also finding the bar under it, but only because the blue channel separates them;
  the wild script's `purple` key would have swallowed both.
- **`assetKey` must be the PLAIN wild key**, not `symbolInfo.assetKey`. That still resolves to the
  old flat `wild_xN` texture with the number baked in, which would have shown through as a second
  multiplier behind the disc. Board calls `getSpriteKeyByName({ name: 'WILD', state: 'static' })`.
- **One font size for all seven numbers, not one per string.** Fitting each number to the disc
  gives x2 far bigger digits than x10; the design keeps the digit height constant and lets the short
  numbers be narrower. Size is driven by the digit height, then reduced if `x10` would overflow.
- **The number is set in Chakra Petch, which is NOT the design's face.** The reference sets `x10` in
  the same heavy rounded display font as the WILD wordmark, and that font was never delivered and is
  not in the repo. Chakra Petch 700 is what the redesigned UI already uses, ships with the app and
  is OFL. Lifting the digits from the old multiplier art was checked and rejected — that art sets
  its numbers in a plain angular grotesque. **Worth raising with the designer.**
- The first pass guessed the number's size and gave it an outline. Measured off the reference: 0.79
  of the disc wide, 0.47 tall, +0.049 below centre, and **no outline at all**.

### Verifying it needed the round rewritten in flight

`mock-rgs` cannot produce a multiplier wild: `makeWild()` is only ever called with its default, and
the multiplier rides MAGNET cells instead. So no amount of spinning reaches this branch. It was
verified by intercepting the `/wallet/play` response over CDP and turning three board cells into
wilds with multipliers 10, 5 and 2 — all three rendered correctly. Two things to know if that is
ever repeated: the CORS **preflight** arrives at the same interception point as a 204 and fulfilling
it as JSON strips the preflight headers and kills the POST behind it, and the board centre is not
the spin button (it is at roughly 1144, 832 in a 1600x900 CSS viewport).

### Left behind on purpose

The seven `wild_xN.webp` + mobile/landscape variants (~160KB) are now drawn by nothing, but
`getSpriteKeyByName` still returns their keys and `SYMBOL_HEAD_OFFSET` still lists them. Removing
them means a coordinated edit across `utils.ts`, `constants.ts` and `assets.ts` touching a lookup
used outside the board, so it was left alone rather than swept unasked. It is dead blocking payload.

## 10. PORTAL (H3 / bearTile) — DONE 2026-09-02

Parts `9126:19227` (ring + orb sheet), `9126:19228`, `9046:16321` (alien), `9046:16329` (eye),
`9046:16296`, `9046:16299`, `9046:16290`, `9046:16302` (the four pins). Staged in `art-src/portal/`,
with the assembled reference pasted by the user as `design_ref.png`.

> animate the center to rotate fast when in win and blink in base static and maybe in win state add
> some movement of the antenas

Built through `build-portal-art.py` into `portal.webp` (+ `_mobile`), `portal_core.webp`,
`portal_head.webp` and `portal_antenna_l/r.webp`, driven by `PortalSymbol.svelte`, wired on `H3`.
`magnetic_core_cube.webp` + `_mobile` are deleted.

**This supersedes the ARROWS + EYE brief that used to hold this slot** (`9053:27333` + eight parts,
"base: blink. win: each arrow grows for a moment in turn, clockwise, and the alien pops too", itself
superseding `9012:12114`). Both replace `premium/magnetic_core_cube.webp`, and only one symbol can:
the portal is the later design and it is the one the user briefed. **Worth confirming with the user
that arrows+eye is dropped rather than destined for some other slot** — if it is still wanted, the
only premium slot left is the one this took.

Traps:
- **The orb cannot be measured in the design.** Every edge of it is behind the ring band, so what
  looks like the orb is the ring's APERTURE, whatever size the orb actually is. Placing it at the
  ring's own scale — ring and orb are drawn side by side in one source image, so that reads as the
  obvious answer — makes it 25% too wide, which shows up not as an orb that is too big but as a
  swirl whose arms sweep too wide. It is fitted by searching scale and centre against the reference
  through the aperture. Compare over the aperture INCLUDING its rim: pull the comparison region in
  off the rim and every orb at least as wide as the hole scores identically, and the search settles
  on the smallest one it is allowed to see.
- **The base has the ring's hole punched out of it.** The pins' stalks are long enough to cross the
  middle, and the orb is drawn behind. Three z-levels, not two.
- **The pins are anchored on their BALLS.** A pin is a ball on a stalk up to 1095px long, nearly all
  of it hidden under the ring band, so its bounding box says nothing about where it goes. Which pin
  belongs in which corner is scored over all 24 assignments from the stalk's direction.
- **The alien is cut from the reference, not from `alien.svg`.** The svg is one flat `#ADFA2C` path:
  no outline, no shading, head and antennae fused. The reference has all three, and at 1:1 — the
  lockup is nearly canvas-sized already, so the head lands at ~56px where the reference draws it at
  ~54px.
- **Matting must not get a vote inside the part.** The alien's eye is WHITE, 15 units from the
  reference's page colour, so keying the whole image by distance-from-page makes the eye 80%
  transparent and the alien looks like it has a hole in its face. Alpha is forced to 1 inside each
  part's own mask and only matted at its edge.
- **The head's widest row is the one through its two antenna KNOBS** — two blobs 14px across, 54px
  apart, which measure as one 54px disc floating above the head, which is also 54px across. Its
  longest contiguous run finds the head but centres it on that row, two pixels off, which leaves a
  crescent of its own lower arc outside the cut, coming back as a 53px-tall third "antenna". The
  head is the largest INSCRIBED disc, and the cut radius is opened outward until the alien splits
  into exactly two pieces above it.

## 11. SPLASH texts — DONE 2026-09-02

`9041:26865`, superseded by `9078:18632`. Rebuilt to the new copy: BONUS GAMES now lists three
scatter tiers (3 = GRAVITY BREACH, 4 = CORE OVERLOAD, 5 = ZERO POINT PROTOCOL), the middle card is
POLARITY SHIFTER with a new `polarity.webp` icon, and MAX WIN reads 20'000X.

Traps this cost:

- **The design's type scale is card-relative and had to be MEASURED, not eyeballed.** Against the
  card's own width: title 13.2%, the "N scatters for" line 6.6%, the gold feature name 6.5% (yes,
  SMALLER than the line above it), the scatter count 10.7%, and the 20'000X 15.3%. Setting the
  feature name larger than the sub-line is what made ZERO POINT PROTOCOL wrap onto two lines and
  push the card's contents past its bottom edge.
- **The cards are `justify-content: space-evenly`, not `center`.** They hold 8 lines / 3 blocks /
  4 lines respectively and the design spreads each set across the same plate.
- **Portrait cannot use the design's percentages.** The portrait plate is WIDER than it is tall
  (266x240) where the landscape one is much taller than wide, so card-relative type overflows it.
  Portrait is sized to fit the POLARITY card, the tallest of the three.
- **The sky is clipped to the window opening** (`.sky-clip`, an octagon measured off room.webp).
  Clouds, moon and planet are drawn over the room art, so without it they drift across the ship's
  metal frame.

**This introduces a copy conflict that is still open**: the splash now names three bonus tiers and a
5-scatter entry, while `Game.svelte`, `CustomBuyBonusModal.svelte`, `bookEventHandlerMap.ts` and the
`RULE*` strings still say MEGA CHAIN / MAGNETIC MEGA CHAIN, and the math has only two bonus modes
(freegame at 3 scatters, superspin at 4+).

## 12. ASTRONAUT (L3 / kTile) — DONE 2026-09-02

Lockup `9133:10682`; parts `9126:19253` (helmet), `19254` (head), `19255` / `19256` (the eyes).
Replaces `low/coil.webp` (the blue/orange spring).

> in static make the eyes like looking around, and in win make the head zoom in/out and shake maybe.

`scripts/build-coil-art.py` -> `coil.webp` / `_mobile` (helmet), `coil_head.webp`,
`coil_eye_l.webp`, `coil_eye_r.webp`; `src/components/CoilSymbol.svelte` owns idle and win.

Traps this cost:

- **The four "parts" are one image.** Every one of those nodes is a rounded-rectangle whose image
  fill CROPS the same uploaded sheet (an alien on the left, an empty helmet on the right), so the
  node boxes are not geometry — the eye nodes are 17x12, a landscape box around a portrait eye.
  Everything is cut out of the sheet in the build script instead.
- **The base node's box is not the helmet's box.** Node 19249's fill is that whole two-figure sheet,
  so its 65x97.5 frame holds the helmet PLUS the sheet's transparent margin. Ratios taken against
  it come out ~9% small and put the head 3.6% off centre; measured against the RENDER, the head is
  0.5518 x 0.5714 of the helmet and dead centre.
- **The design squeezes the alien ~12% narrower** than the source head's aspect. Kept — un-squeezed,
  the face fills the visor to its edges and the blue ring disappears.
- **Lifting the eyes leaves holes.** `flood_green` grows the FACE colour into them, seeded on the
  green only: seeding on "every opaque pixel that is not a hole" lets the head's dark outline creep
  in and rings each socket in black.
- The eyes live in the same `<Container>` as the head so the win's zoom and shake move the alien as
  one object. The gaze is a saccade — a ~0.045s flick to a new direction, then a 1.45s hold — not a
  sine; a sine reads as the whole face wobbling.

---

## 13. CONFIRM DIALOGS `4036:3584` — DONE 2026-09-02

> you can update confirm dialogs with this design.

Three dialogs wear this plate: `CustomBuyBonusModal` (buy confirmation), `BonusResumeModal` and
`InsufficientFundsModal`. All three were still on the Version2 blue steel frame
(`ui/confirm_panel.webp`), which read as a different game next to the MOTHERSHIP art.

- **The plate art is gone.** The design's panel is a flat rounded rectangle — 458x215, radius 14,
  `#3A3981` over a `#2D2C69` edge — so it is drawn in CSS and `confirm_panel.webp` is deleted (also
  dropped from `LoadingController`'s preload list).
- **The plate is no longer a fixed-aspect box.** The three dialogs hold one nowrap line, a wrapping
  sentence and a single button respectively; an `aspect-ratio` plate sized for any one of them
  clips or strands the other two. Flow layout at the design's own paddings instead.
- Type, measured off the design as fractions of the plate WIDTH: title 30/458 (and WHITE, not the
  Version2 `#2391C1`), body 20/458, buttons 48 tall x 196 wide, 17 apart, label 15/458.
  `confirmDialog.ts` carries the two the text fitter needs.
- Buttons: CANCEL `#47468A` with a `#A88EFF` outline, CONFIRM filled `#A88EFF`. Close button is a
  46px `#494A9B` circle, no ring.

**Note for whoever picks up the buy menu**: the confirm plate now matches MOTHERSHIP but the
BUY BONUS menu behind it (`CustomBuyBonusModal`'s `.card` / `.bet` / `ACTIVATE` buttons) is still
the Version2 blue steel theme, and the clash is obvious the moment the menu opens.

---

## 14. CLUSTER CELLS STOPPED SHOWING OLD ART — DONE 2026-09-02

> all win animations are terrible and in most we use old animations. When in cluster we should not
> add animations
> […] remove all old symbols please and we can see then better

Both complaints had one root: `Board.svelte` drew a **locked cluster cell** through two special paths
that neither the rebuild nor the per-symbol components ever reached.

* A cluster cell in the win pass went to `<SymbolWinFx>` with **only the base texture**. Every
  rebuilt symbol's base is a frame with a hole in it — the portal's galaxy, the chip's alien and the
  compass's face are separate layers — so a winning cluster showed hollow shells (a chip with a blank
  white screen, a portal with a black centre) with the old pop/wobble playing over them.
* Every other locked cell played a `stackAnim*` flipbook. Those seven sheets were built from videos
  of the **pre-rebuild** symbols, so a locked stack of astronauts came up as the old blue coil
  springs.

Fix: the per-cell art chain moved into a `{#snippet symbolArt(...)}` that both render passes call, and
the locked block calls it with `winning` **false**. A cluster reads as a win through its perimeter
electricity; animating the symbols inside it too is noise, which is what the brief asked for. The
seven `stackAnim*` asset entries, their defer flag, `STACK_ANIM_KEYS` and
`static/assets/sprites/stackAnims/` (1.7 MB) are all deleted.

## 15. WIN ANIMATIONS, second pass — DONE 2026-09-02

> the battery in win lets make the [cell] zoom in/out or pop and also add some light
> for this the win animation is too boring  *(astronaut)*
> the win animation of this is very unnatural..lets make it more realistic and cool for slot  *(chip)*
> also for this the win animation is booring  *(compass)*

The first thing this needed was undoing half of section 14. "When in cluster we should not add
animations" and "make the battery's win pop" are only compatible one way: being **locked** is not a
win. A stack that is merely charging through a respin chain sits still — that is the wall of
animation the brief objected to — and the actual win pass runs the symbol's own choreography. So the
locked block passes `winning = cell.symbolState === 'win'` rather than a hardcoded false, and still
never touches `<SymbolWinFx>` or the deleted flipbooks.

Then, per symbol:

* **Battery (L1)** — the pop was a 0.16 kick that decayed inside a fifth of a second, so most of the
  beat was dead air. Added a 2 Hz zoom for it to ride on, and a warm halo around the cell built from
  five nested ellipses (an additive fill of constant alpha has a hard edge, and a hard-edged glow
  reads as a decal). Brightest where the cell is biggest: one event, not two.
* **Astronaut (L3)** — was a scale sine plus a shake, which is what "boring" looks like: no beat, no
  anticipation, no impact. Now a jump on a 0.78 s beat — stretch up, hang (the arc is `sin**0.65`,
  because a plain sine rushes the middle), lean to alternating sides, squash on the landing, and a
  white ring thrown out of the visor as it lands. Eyes go wide and follow the lean.
* **Circuit chip (L4)** — "unnatural" was three separate faults: a scale ramp with no cause, a mouth
  stretched to 1.55 x 1.95 (a rubber face, not a grin), and an arc firing on its own 5.5 Hz clock so
  the light never landed on the same frame as its own lightning. Everything now hangs off one SURGE
  clock: fast attack, slow decay; the traces light, the bolt fires, the alien flinches and then leans
  in grinning, the slime shivers. Grin reduced to 1.24 x 1.38.
* **Compass (H1)** — a hop and blinking rim arcs are both small and local; nothing crossed the
  symbol. Added a RADAR SWEEP inside the bezel (a fan of nine wedges, so the tail can fade — one
  filled wedge can only carry one alpha) with the rim arcs phased off it, plus a bezel flash on each
  landing.

## 16. AUTOSPIN PANEL `4036:2458` + BONUS pill `9076:29225` — DONE 2026-09-02

The autospin dialog was the last thing in the game still wearing the Version2 blue steel. Rebuilt on
the design's flat plate (`9019:15303`, 550x423, #3A3981 over a #2D2C69 edge — the same plate the
confirm dialogs got in section 13), in flow layout at the design's own vertical rhythm rather than
absolute percentages of a fixed-aspect bitmap. `autospin_panel.webp` and its preload entry are gone.

Trap: the design renders the − button ringed in **white** and the + in **lavender**. That is not two
styles — the mockup is drawn at the minimum spin count, so − is disabled.

Trap: `NUMBER OF SPINS` needs an explicit `line-height: 1.5`. The design gives that line a 30px box
against a 20px face; at the browser default the stack comes up ~6 design px short and the plate ends
up proportionally wider than 550x423, which shows as slack under the START button.

`START AUTOPLAY` and the HUD's BONUS pill are both **Audiowide**, joining the balance/bet/win
numerals from section 12's font pass.

## 17. SYMBOL SCALE CONSISTENCY — DONE 2026-09-03

> this looks a bit bigger can you please check all for consistency  *(the lightning badge)*

Measured, and it was true, but the lightning badge was not the odd one out — the LOWS were. Every
symbol is drawn into a box that is its class ratio of the cell and then fills however much of that
box its own build script happened to leave it, and ten separate scripts had fitted their art ten
different ways. On the cell, in height:

| | before | after |
|---|---|---|
| premiums H1–H4 | 0.763 – 0.920 | 0.920 each |
| lows L1–L4 | 0.766 – 0.896 (**17% spread**) | 0.815 each |
| specials | 0.950 | 0.950 |

`scripts/measure-symbol-padding.py` was rewritten to do this properly and now generates
`SYMBOL_PAD_SCALE`. Two things it does differently from the version that had produced an empty table:

* it measures the **`*_full` composites**, not the base textures. Several rebuilt symbols have loose
  parts outside their base (the magnet's antennae and hands, the compass's antennae, the chip's
  slime), so the base under-reports the footprint and the correction pushes those parts into the
  cell border. Run `build-paytable-symbols.py` first.
* it reads the class ratios out of `constants.ts` instead of assuming 0.92 for everything, which
  stopped being true when the lows dropped to 0.815.

It equalises the **limiting axis**, not the covered area. Area would blow the narrow symbols out of
the cell trying to make up their missing width — the battery's art is 0.56 of the canvas wide.

`SYMBOL_SIZE_OVERRIDE` is now empty. It held `kTile: 1.3` and `squirrelTile: 1.1`, both written for
the pre-rebuild slim diagonal screws and bolts; the symbols in those slots are now a chunky helmet
and a chunky battery, so the reason had gone while the numbers stayed — and they multiply ON TOP of
`SYMBOL_PAD_SCALE`, which is what made the astronaut and the battery ~10% taller than their class.

Also deleted: `SYMBOL_HEAD_OFFSET` and `SYMBOL_ZAP_OVERRIDE` (~130 lines). They positioned the
stacked-cell electric burst that was removed on 2026-08-07; nothing has imported either since, and
every number in them was measured against pre-rebuild art.

Verified on the live board by measuring the rendered ink per cell: premiums 0.902–0.912, lows
0.795–0.827.

**Left alone, deliberately:** the lightning badge still reads a little larger than the chip beside
it. That is the intended premium-over-low step (0.92 vs 0.815, +13%) plus the fact that a filled
SQUARE at a given bounding box carries ~27% more ink than a circle at the same box, and both the
lightning badge and the chip are squares while the compass and the portal are discs. Correcting that
means shrinking the two squares against their own classes — a design call, not a bug.

## Still queued from the 2026-09-01 session, untouched

- ARROWS+EYE `9012:12114` (parts `12143`, `12125`, `12127`, `12137`, `12135`, `12133`, `12139`) —
  win: arrows light green -> orange -> purple -> blue, repeating clockwise; eye blinks in both states.
- TERMINALS `9013:9005` (parts `9014`, `9019`, `9018`, `9016`, `9021`, `9022`) — win: antennae move
  outward and flicker, lightning on the +/- caps; base: `9021` and `9022` undulate like slime.

---

## Also landed 2026-09-02 (not symbol work)


**UFO tractor beam enlarged, ship tremble cut.** `Background.svelte`. The beam is back to the
design's own spread (`BEAM` 0.132x0.256 -> 0.2022x0.4757) on request, matched against a reference
the user supplied. That reverses an earlier deliberate decision: the cone now carries PAST the
window's inner sill (0.579 of the background height in that column) and pools light on the interior
wall, in front of a frame the ship is hanging outside of. The reference shows exactly that, so it is
intended — but if the light ever reads as landing on the wrong side of the glass, this is the trade
that did it.

The beam also had to change COLOUR to survive at the new size: the design's lilac composites to
about rgb(215,196,239) over the room's pale interior wall, which is a white haze, not a beam. The
reference's cone interior samples at rgb(148,122,216), so the main slab now fills with `BEAM_CORE`
0x7d5ecb (measured back at rgb(174,152,229) in-game) and the lilac stays on the halo and rim.

**Tremble**: idle amplitude 0.0026 -> 0.0007 of the hull width, brake 0.017 -> 0.009, roll 0.0035 ->
0.0011, and every frequency cut to roughly a third (37.1/23.7/41.3/19.4 -> 13.9/8.9/11.3/7.2).
Amplitude alone was not the problem — a small displacement at 37 rad/s is a buzz, and the eye
catches the RATE long before it judges the distance.

Verified in headless Chrome at 1600x900. Note the running mock-rgs on :8788 predates the
`magnetic-2` registry entry and 404s for it; a second instance (`PORT=8880 node mock-rgs/server.mjs`,
plain-HTTP twin on 8881) serves it.

## Blocked, added 2026-09-02

- **Splash texts** `9041:26865` — "texts added" to the splash design. Needs Figma.
- **The multiplier-wild art does not cover the values the paytable advertises.** Needs a MATH answer,
  not a design one. `CustomInfoModal.svelte` states `2x, 3x, 4x, 5x, 10x, 25x` as standard and
  `50x, 100x` as rare — eight values. The art set (both the retired flat `wild_xN` and the rebuilt
  `wild_mult_xN`) covers `2, 3, 4, 5, 7, 9, 10`, and `MULTIPLIER_WILD_KEYS` snaps anything else to
  the nearest, so a 100x wild would draw **x10** on the board. Note the two directions of the
  mismatch: 7x and 9x have art nobody advertises, and 25x/50x/100x are advertised with no art.
  This is PRE-EXISTING — the rebuild reproduced the old set exactly — but it is squarely the kind of
  thing the 2026-08-22 payout-table round was rejected for.
  Not fixed unilaterally because (a) nothing in the repo says which is right: no books ship here,
  the force records carry no `multiplier` field, and `config_fe_magnetic_2.json` has no multiplier
  data; and (b) the numbers share ONE font size so that x2 and x10 match, so adding a three-digit
  `x100` shrinks all seven existing discs. Get the real list from the math side first, then re-run
  `build-wild-mult-art.py` once.

## 18. LEFT-RAIL PLATES — RESPIN / FREE SPINS / TOTAL WIN — DONE 2026-09-03

Brief: *"from here take the respin, free spins and total win new designs"* → `9032:22823`, whose
`9053:27285` holds the three plates at (37, 187) in the 1200x670 frame.

**The plate is the one the dialogs already wear.** 222x93, radius 8, flat `#3A3981` over a 4px
`#2D2C68` inside stroke, 8px apart — identical to the autospin panel and the three confirm dialogs.
So `InfoBox.svelte` DRAWS it now (one `Graphics` rounded rect) and `frames/info_box.webp`, the
Version2 steel-and-navy bitmap, is deleted along with its `RECOLOUR` entry in `build-ui-art.py`.
A drawn plate is also sharper: the bitmap was 781x335 stretched to whatever the rail asked for.

**The design order changed.** Version2 stacked RESPIN / FREE SPINS / TOTAL WIN; MOTHERSHIP puts
FREE SPINS on top and RESPIN in the middle. `CapsulePanel` and `RespinPanel` swapped rail slots.

**The font is Poppins 700, not Chakra Petch.** This design file mixes three faces on purpose —
Chakra Petch on the HUD, Audiowide on the big numerals, Poppins on these plates — so do not assume
one house face and do not eyeball it: the render's plain oval `0` (Chakra Petch's is SLASHED) is what
gives it away, and the REST API's `style.fontFamily` is what settles it. `poppins-700.woff2` (7.8KB
latin, copied from apps/forest-gang) joins `fonts.css`, and `app.html` warms it — a face used only
from pixi `Text` never gets fetched by `@font-face` alone, and pixi does not redraw when it lands.

**The node boxes lie again, in a new way.** `9053:27285`'s children report `x=222` (their own width,
not their offset) and text `y` values past the parent's height, so every number here was taken off
the 1200x670 render instead: plate runs y 188..280 / 289..380 / 389..481 at x 37..258. The one thing
worth reading from the API is the TEXT STYLE — sizes, weights, tracking and `textCase` are exact
there and unmeasurable from a render.

**The two value plates are not placed identically.** FREE SPINS puts its label box at dy 19 and its
value at 34; TOTAL WIN at 14 and 32. Hand placement, not a rule — InfoBox averages them into one
rhythm all three plates share, which reads more even than either original.

**The RESPIN glyph is drawn from SVG path data**, pulled from node `9076:28692` via
`/v1/images?format=svg` and handed to `Graphics.svg()`. No asset, crisp at any rail size, and it
replaces `respin_icon.webp` — a blue lightning-textured arrow that was pure Version2 leftover.

The old 781/335 aspect had FOUR hand-synced copies (desktop rail, mobile landscape, portrait top
bar, RespinPanel). They now all read `INFO_BOX_ASPECT` / `INFO_BOX_GAP` from `game/constants.ts`.

Value sizing is continuous now (`min(design size, maxWidth / (len * 0.58em))`) rather than the old
three-step ladder, which visibly jumped a size mid count-up as the amount crossed 7 and 9 characters.

Verified in headless Chrome at 1200x670 (desktop rail), 414x896 (portrait top bar) and 844x390
(mobile landscape), with the bonus/respin gates temporarily forced. Live plate measured 369x154 at
2x = aspect 2.396 against the design's 2.387.

## 19. GAME RULES CAROUSEL — shell + page 1 (OVERVIEW) — 2026-09-03

Brief: *"you can fix now game rules and start with this screen"* → `4504:4289`. All SEVEN pages are
designed and were pulled together, because the shell they share had to be built once and correctly:

| # | node | title |
|---|---|---|
| 1 | `4504:4289` | OVERVIEW |
| 2 | `9076:28194` | PAYTABLE |
| 3 | `4453:7420` | FEATURES |
| 4 | `4453:7579` | CLUSTER WIN |
| 5 | `4453:7151` | FEATURE BUY |
| 6 | `4214:3232` | GENERAL INFO |
| 7 | `4725:11860` | USER INTERFACE GUIDE |

**The whole carousel is now three flat rectangles and two typefaces.**

```
--panel     #3A3981  r10   the popup           (9074:16670, 954x552 of 1200x670)
--card      #343376  r10   + 3-4px #8284D6     (9074:16650 / 16676 / 17516 / 18460)
--btn       #49489B  r50%  + 1px #A88EFF       (pager); the CLOSE button rings in WHITE instead
--pad-head  #21206E  r8    + 1px #49489B       paytable header row + symbol column
--pad-cell  #49489B  r8                        paytable value cells
--display   Audiowide 400   page titles 35, card titles 18, stat values 20-24, ls 0.03em
--text      Poppins 500/700 body 13, cluster copy 15, paytable 12/16, legal + ctrl desc 10
```

**Everything is white.** Not one cyan pixel survives: `#2391C1` headings, `#6FB6F6` icons,
`#8EC7FF`, `#E8F2FF` and the `#D7D7D7` body grey are all gone. When a design gives every text node
the same colour, hierarchy has to come from SIZE and FACE — that is why the display/text split
matters here more than it did on the Version2 screens, which leaned on colour to do the ranking.

**Four bitmaps retired** (~230KB): `info_panel_v2.webp` (the steel frame), `info_card_tall_v2.webp`,
`info_hero_v2.webp` and `info_box_grid.webp`, plus the three old stat icons. `bb_card_panel_v2` and
`bb_bet_panel_v2` STAY — the buy-bonus modal still uses them. The overview hero is now the game's
own `splash/logo_plate.webp`: Figma `9074:16658` measures 1.6641 against the plate's 1.6636, i.e.
the same drawing, and reusing it means the rules page loads nothing new.

### Traps this page hit

- **The design mixes THREE faces on purpose** — Chakra Petch (HUD), Audiowide (headings/numerals),
  Poppins (running text) — and one page slips: the PAYTABLE title is Orbitron 700 where the other
  six are Audiowide 400. Treated as a slip; all seven titles are Audiowide.
- **The panel is not vertically centred on pages 1-3** (y 71) but is on 4-7 (y 60). Centred wins.
- **Column ratios are the layout.** The overview's copy column is 325 and its hero 413, not an even
  split; at 1fr/1fr the paragraphs run ~30% wider and the page stops being the design. Same for the
  page inset: page 1 insets its content 77 from the panel edge, the paytable only 42, so the panel
  padding is the SMALL one and page 1 adds its own.
- **A percentage measured off the design is measured off the PANEL, not its content box.** The stat
  row is 820 of 954 = 86% of the panel — but the row lives inside the panel's padding, so in CSS it
  is 92.5%. The first pass used 86 and came out 38px narrow.
- **`cqw` flips meaning in portrait.** The hero at `34.4cqw` is right in a landscape container and
  renders at ~140px in a tall one; the portrait query sets its own width.
- **Icons keep their Figma BOX, untrimmed.** The trophy and horseshoe sit low inside their boxes on
  purpose; trimming to the ink would need a per-icon offset to put them back.

### Page 2 (PAYTABLE) — done in the same pass, `9076:28194`

Brief: *"this is the paytable just use the new symbols and this style"*. The designer's own symbol
column is a placeholder coin repeated eight times, so the STYLE is the deliverable and the art stays
the game's real `*_full` composites.

```
band     table 165..850 (685) | gap 11 | aside 861..1034 (173)   = 42 in, 43 out of the 954 panel
header   pads y 161..199, r8, #21206E + 1px #49489B, Poppins 500 / 16
rows     8 on a 42 pitch — cell 38 tall, 4 apart; values #49489B, no edge, Poppins 500 / 12
columns  symbol 85, then twelve of 46 on a 50 pitch
aside    173x374, the shared card, Audiowide 18 title over Poppins body
```

Cells are a FIXED height now rather than text-plus-padding, so a row holding "0.15x" is the same
size as one holding a symbol — which is what makes the grid read as a grid.

- **The design's own 38 does not fit.** A `border-separate` table also spaces above the header and
  below the last row, so nine 38s and ten 4s come to 382 against the design's 374-tall band, and
  those 8px are exactly enough to slide the pager arrows on top of the last row of values. 36 fits
  with ~20 to spare and is indistinguishable.
- **The panel padding was 8px too generous.** The design's tightest content inset is this page's:
  42 across and 24 down (title top 95, panel top 71). Page 1 adds its own extra to reach 77.
- **Two portrait overrides fight the desktop proportions** and have to be re-tuned together: the
  symbol column at the design's 12.4% is ~34px on a 414-wide panel, where the art stops being
  identifiable, so portrait takes it to 11% of a narrower table instead.
- The aside's body copy is `Inter 400 #D7D7D7` in the file — a Version2 leftover the designer did
  not update, and the only non-Poppins non-white text left on any of the seven pages. Set in
  Poppins white like the rest of the carousel.

### Page 4 (CLUSTER WIN) — `4453:7579`

The design keeps each wordmark and its example board as two separate nodes; the page renders ONE
image per side, so a COMPOSE stage in `scripts/build-ui-art.py` stacks them at the design's own
offsets into `info_win.webp` / `info_nowin.webp`.

```
band    copy 313 | gap 40 | boards 506   inside 173..1032 of the 1200 frame
boards  242 wide each, 12 apart; wordmark above, both cut from ONE vertical band 201..494
```

- **NO WIN goes on the LEFT.** The design puts the counter-example first (the red diagonal), which
  is the opposite of the order the page had.
- **Both sides are cut from the same band** even though the design starts the WIN wordmark 3px lower
  than NO WIN — that is what keeps the two images exactly the same height when the page lays them
  out side by side off a shared `max-height`.
- The columns were `1fr / 1.15fr`, which gave the copy half the page and left the boards well short
  of the size the design draws them.

### Page 7 (USER INTERFACE GUIDE) — `4725:11860`

Twelve buttons, all replaced with the design's own SVGs: a flat `#49489B` disc under a white glyph
with an `#A88EFF` hairline — the same `--btn` / `--btn-edge` the modal already used. SPIN is the odd
one out, a FILLED `#A88EFF` disc, and the only one the design draws bigger (52 against 48).

- **The row metrics came with the icons.** The set was running ~25% oversized: three rows wanted
  536px of the 452 the page has, and the grid silently overflowed UP, under the title. The design's
  own geometry (48 icon, Poppins 700 14.5 name, Poppins 500 10 desc, 10.7 between rows, 52.5 between
  columns in a 767-wide band) fits with 20px to spare.
- **SPIN's old `transform: scale(1.32)`** was correcting the retired 3D art's metallic frame, not
  following any design. It is a 52/48 box ratio now.
- **TURBO is the one icon Figma will not export as vector** — it hands back a 1254px PNG pattern
  (175KB). Its bolt is a straight-edged ring, so it is traced into two 8-vertex polygons drawn
  even-odd: same shape, 1/180th the bytes, sharp at any size.

### Still to do on this screen family

- **Page 6**'s two icons are still Version2 art.
- **Page 5 has four cards to the design's three** — the app has an Extra Chance buy mode the design
  frame predates. Left alone deliberately.
- The control **names and descriptions** are still the app's own wording (INCREASE BET / DECREASE
  BET, "Start a game round with your selected bet."). The design says BET + / BET - and "Starts a new
  game round." Not changed: the copy is translated into 17 locales and the icons were the ask.

## 20. BIG-WIN CARD — SECTION `4013:920` "Types of wins" — REDONE 2026-09-03

Brief: *"here are the new win screens. Lets animate the plate to come from bottom, texts from top,
then the alienship from far away animated"* — then, on the first build: *"thats terrible..."* with a
screenshot of the real design.

**The first build was wrong in concept, not in tuning.** It was composed from three loose
RECTANGLEs on the Design page (`9148:31503` plate, `9148:31504` saucer, `9041:26599` alien) on the
belief that no assembled win screen existed in the file. It does — six of them, one per tier, each a
full 1200x670 game screen with the card composited on top, in **SECTION `4013:920` "Types of wins"**:

```
EPIC 9034:25341 · SWEET 9034:25584 · MYTHIC 9034:25101
LEGENDARY 9041:26358 · WILD 9034:25823 · MAX 7103:5231
```

They were missed because only the Design page's DIRECT children were searched. A section's children
are a level down.

What the design actually is — and what the first attempt got backwards:

| | first attempt | the design |
|---|---|---|
| wordmark | small, INSIDE the plate | the hero: 600px wide, straddling the plate top and bottom |
| plate | a banner with text in it | a backing slab the mark sits over |
| amount | inside the plate | its own rounded plaque BELOW the whole assembly |
| slime | — | a green splat beside the mark (MAX throws nine across the screen) |

`game/winCardTiers.ts` is now GENERATED by `scripts/build-win-card.py`: every piece is trimmed to
its own ink, that ink is mapped back into frame coordinates and printed centre-relative. Nothing in
that file is hand-tuned.

```
frame    1200x670, S = min(w/1200, h/670); portrait fits the lockup's own 820
lockup   plate 665x313 @ (-2,-22) · saucer 260x184 @ (-5,-221) · alien 95x145 @ (-5,-192)
plaque   399x120 @ (-12,+213), fill #3A3981, 4px stroke, radius 17.8 — DRAWN, no art
amount   Lilita One 400 / 59.33px / ls 2.08, #AFB1FB (MAX: #9BF715)
MAX      the same lockup at 1.2x, 24px higher (its wordmark is two lines)
beats    plate 0-0.52s · wordmark 0.24-0.80 · plaque 0.40-0.92 · saucer 0.60-1.38 · alien 0.98
```

- **Z-order is load-bearing.** The plate art has the saucer's BELLY baked into its top edge, so the
  dome renders behind the plate with the alien in between. Put the saucer on top and it reads as a
  sticker.
- **The blob is one drawing exported at four rotations** (0/15/30/45°). Figma renders a rotated node
  already rotated, so four small files remove four sets of trigonometry from the component.
- **Lilita One is now self-hosted** (`static/fonts/web`, warmed in `app.html` — PIXI rasterises Text
  once and never redraws when a webfont lands later). Regular is the family's only weight.
- **The HTML HUD is ABOVE the pixi canvas**, so the opaque bottom bar cut the amount plaque in half.
  `Win.svelte` now sets `stateGame.celebrationActive` for the length of a big win, which is the flag
  that already dims the HUD for the congratulations panel — and is what the design screens show.
- **The board's amount was the raw count-up tween**, so a big win read "$608.8582" all the way up.
  It gets the same in-flight rounding the small-win plaque already had.
- **Verification is settled-state only.** Under headless swiftshader a single `captureScreenshot`
  costs ~2.5s and `Page.screencast` yields ~3fps, so a 1.4s entrance cannot be resolved at all —
  a "700ms" frame came back taken at 5.6s with the card long since assembled. There are six
  `emitterEvent: winShow (<tier>)` stories in `ComponentsGame.stories.svelte` (written out one by
  one: Storybook's CSF indexer only sees literal `<Story>` tags, an `{#each}` indexes as nothing).
  Storybook has no `preview-head.html`, so NO webfont loads there — the amount renders in a fallback
  face in every story screenshot. Check the font on the dev server, not in Storybook.

What it replaced: `WinSign.svelte` + `game/winSignTiers.ts` (five loose parts per tier across six
tiers) and `game/goldGradient.ts`. `win_boards/` went 1.5MB → 612KB.

## 21. BASE-GAME BACKGROUND `9164:12153` + DRIFTING CLOUDS — DONE 2026-09-03

Brief: *"lets use [9164:12153] for base game background and also add random animated clouds moving
realistically"*.

The base game moved OUTDOORS: a landing pad looking over an alien valley under a wide open sky. The
bonus and superspin rooms are still the interior lab — they are the "somewhere else" the buy-bonus
hand-off walks into, and `Background.svelte` already cross-fades between rooms.
`scripts/build-room-art.py` now carries two source paintings (`BASE_SOURCE` / `BONUS_SOURCE`); point
the second at `VISTA` if the bonus rooms should follow.

- **The design's own LAYER_BLUR is part of the art** (radius 7 in design px, and the designer stacked
  two identical copies of it — identical opaque layers, so the result is a single blur). It is depth
  of field: the board and its symbols sit on this and the valley must not compete with them. Applied
  after the resize, scaled to the output.
- **The portrait rebuild only stretches SKY.** The lab's portrait has to stretch its floor 2.7x; the
  vista does not stretch the valley or the pad at all — the ~1000 extra rows a phone needs come out
  of the sky, by EXTRAPOLATING its own per-column gradient upward from the crop's first row.
  Stretching a band of sky instead leaves a hard seam, and the reason is worth remembering: any band
  starting below the first row ends on a colour that is not the first row, so the two never meet.
  Extrapolation joins exactly by construction. The slope is capped (`VISTA_SKY_EXTEND_MAX`) — the gap
  is six slope-blocks tall and a straight line over six runs the sky to black.
- **The clouds come from the SPLASH.** The vista painting's sky is completely empty, and the splash
  already drifts two of the designer's own cloud shapes across its sky
  (`splash/cloud_a|b.webp`, cut by `build-splash-art.py`) — so the game now opens and plays under
  the same weather instead of under two different painters' clouds. Same files and the same `?v=`
  the splash requests, so the pair costs one 6KB download between them.
  (A first pass DREW four flat-vector clouds in `scripts/build-clouds.py`; that script is gone.)
- **Width comes from the SHAPE, not from depth alone.** The splash gives its big shape 9–13% of the
  frame and the small one 4.5–7.5%, and gives the big one less spread because at the top of its
  range it stops reading as a cloud and starts reading as scenery. Rolling one width band for both
  draws the big shape at the small one's size half the time.
- **The randomness is per session, and re-rolled per crossing.** `SkyClouds.svelte` rolls shape,
  size, height, speed and opacity at start-up AND again every time a cloud leaves the frame, so the
  sky never repeats a formation.
- **Depth is one parameter, not five.** Size, brightness, height and speed all correlate with it:
  near = bigger, brighter, lower, faster. Varying them independently reads as a screensaver.
  A near cloud crosses in ~60s, a far one in ~3.5min; the whole thing ticks at 30fps because at 60
  these move a fraction of a pixel per frame. An earlier pass ran them at 13–34% of the background
  and each one read as a fog bank crossing the frame — the art was fine, the scale was not.
- Clouds are gated on `bgBase`/`bgMobileBase` and ride the room cross-fade — the lab has no sky.

## 22. CONFIRM POPUP PLATE re-measure + UNFINISHED-ROUND close button — DONE 2026-09-03

Brief: *"here we need x button i tink and its not following [9078:18631]"*, on the UNFINISHED ROUND
dialog.

Two separate things, and the second one is the interesting one.

**The X.** Every dismissible popup in SECTION `9078:18631` POPUPS carries a close button at the
SCREEN's top-right — 48.7px, `#49489B`, white glyph, at (1118, 29) of the 1200x670 frame. Autospin
and the buy confirmation already had it; the resume dialog was the only one without. ("Free spins
won" has none — it is a celebration that dismisses itself, which is why the button is not simply
"on every popup".)

It is wired to **PLAY ROUND**, not END ROUND. There is no third outcome — an open round has to be
either played or settled — so the X takes the non-destructive one: ending the round settles a bonus
the player never gets to see, which is not what an X should do.

**The plate was measured off a node the design has since replaced.** The `confirm popup` FRAME is
still `4036:3584`, but the plate inside it is now `9076:28671`, and it is not a resize of the old
one — it changed the FACES:

| | old (4036-era) | `9076:28671` |
|---|---|---|
| plate | 458x215, 1px #2D2C69 edge | 467x225 #2D2C69 over 459x216 #3A3981 + a #5E4374 hairline |
| title | Chakra Petch **700** 30px | **Audiowide 400** 32px |
| body | Chakra Petch **600** 20px | **Poppins 400** 20px |
| buttons | 196x48, radius 12/458, Chakra Petch 700 | 196.5x50, radius 12/467, **Audiowide 400** 16px |

- **A frame id is not a plate id.** The old numbers were right for the node they were taken from;
  the design replaced that node in place and kept the frame. Re-read the frame's CHILDREN, not the
  frame, when a dialog "stops following the design".
- **Three dialogs wear this plate** (buy confirmation, unfinished round, insufficient funds) and the
  fitter metrics are shared in `confirmDialog.ts`, so all four files move together. Measuring the
  title in Chakra Petch while rendering Audiowide gives a fit factor for the wrong glyph widths —
  Audiowide is far wider — and the title silently overflows.
- **Poppins Regular was not self-hosted**; only 500 and 700 were, so a `font-weight: 400` request
  matched the 500 and the dialog rendered a step heavier than the design. `poppins-400.woff2` added.
- The design's primary button has no stroke. It needs no rule: the shared ring is already `#A88EFF`,
  so on an `#A88EFF` fill it is invisible — and both variants keep the same box.


## 23. BONUS ROOM BACKGROUNDS `9164:12399` / `9164:12644` / `9164:12890` — DONE 2026-09-03

The three bought bonuses each get their own sky, so the whole game is now outdoors and the interior
lab is retired. All three are the SAME terrace as the base game, repainted for the hour:

| room | node | painting | opens on |
|---|---|---|---|
| Gravity Breach | `9164:12399` "Background 2" | deep-violet dusk | 3 scatters |
| Core Overload | `9164:12644` "Background 3" | starlit night under a moon | 4 scatters |
| Zero Point Protocol | `9164:12890` "Background 4" | green-gold morning | 5+ scatters |

- **The room is chosen by SCATTER COUNT, not by bet mode.** The math has two bought bonus modes
  (`BONUS` and `SUPER`) and the design names three bonuses, so `bonusMode` cannot tell Core Overload
  from Zero Point Protocol — it folds both into `superspin`. `stateGame.bonusRoom` is set from
  `freeSpinTrigger.positions.length` alongside it, is read by `Background.svelte` and nothing else,
  and a Feature Spin leaves it null so that one spin stays outside in the base sky.
- **Zero Point Protocol has no bet mode of its own.** It is a room, not a bonus: nothing in
  `library/configs/config_fe_magnetic_2.json` buys it, and mock-rgs's `SUPER` book lands exactly 4
  scatters, so the only way it opens today is a real book with 5. Verified by temporarily lowering
  the threshold to 4 and buying a MEGA CHAIN.
- **Core Overload's frame stacks its painting over the base one**, which it fully covers. Only the
  top layer is built. Its crop is also TIGHTER than the others (node 1467x902 against ~1580x975),
  which is why the console sill lights are out of shot in that room and the pad's core is the only
  emissive thing in it.
- **The lamp key had to change, and the fix was the REGION, not the threshold.** The old key was
  tuned for an interior: magenta, and under 0.2% of the frame. Outdoors it matched the moonlit rim
  along the mountain crests (a pulsing halo on a mountain) and rejected the landing pad's core as
  too big — Core Overload came out with zero lamps and therefore dead still. Lamps are now looked
  for only in the bottom 45% (the terrace) and may be up to 2% of the frame. Raising the brightness
  threshold instead does not work: the glow is one continuous mass and never splits, at any level.
- **Only SKY is invented in portrait.** Every room is rebuilt for 0.5625 the one way now — the
  design crop and everything below it is kept at its own proportions against the bottom edge, and
  the ~1100 rows above are extrapolated from the sky's own per-column gradient. The SLOPE is
  smoothed across columns (`SLOPE_SMOOTH_PX`) before it is extrapolated; unsmoothed, two levels'
  difference between neighbouring columns opens into visible vertical banding at the top.
- **The rooms got ~20x smaller.** Four landscapes + four portraits total ~305KB, against the ~720KB
  the two interior bonus rooms cost on their own. They are flat painted art at q88.
- Found while verifying: a bought MEGA CHAIN threw out of `playGame` on its first `superSeriesCarry`
  and the round stopped advancing. That event's `series` ships as `null` (nothing to carry) and as a
  BARE SNAPSHOT (exactly one cluster) as well as the array the types promise;
  `setSeriesSnapshots` already normalised both, the direct readers did not. `seriesOf()` in
  `bookEventHandlerMap.ts` is the other half of that guard.

## 24. SHIP IN PORTRAIT + THE SYMBOL IN THE BEAM — `4336-15793` — DONE 2026-09-03

The mobile design hangs the same ship top-CENTRE over the logo with its beam coming down into the
gap above the board, and puts ONE symbol pad inside the cone (`9126:19900`). Both are in.

- **The beam now holds the cluster's symbol.** `stateGame.magnetTargetSymbol` is the cluster's own
  symbol and is null whenever there is no cluster, so the prop appears and clears with the cluster
  and needs no bookkeeping of its own. It enters at the mouth of the cone and rides up to a hold
  point (the "sucked up" read — starting it at rest just popped it into existence half way down),
  then sways, bobs, turns and swells on the same grab pulse the beam flares on.
- **It renders through the BOARD's own per-cell components** (`BeamSymbol.svelte` dispatches on the
  symbol name), not through a texture. The rebuilt symbols are assembled from loose parts, so a base
  texture alone is a bezel with no alien in it; and going through the components means the symbol in
  the beam keeps its idle life instead of hanging there as a still. The flat `*_full` composites
  exist but they are for the HTML paytable and cost a texture each.
- **The beam is quoted in HULL widths now**, not in fractions of the background (0.94 across,
  1.25 long). That is the same cone — it is the landscape numbers divided by the landscape hull —
  but it lets portrait reuse them: the beam scales with the ship rather than with the canvas.
  Portrait shortens the REACH to 0.78, because the board plate starts much closer to the ship there
  and a full-length beam runs behind it and loses its pool.
- **Portrait does NOT use the design's own y for the ship.** The design was composed inside a phone
  mock whose Stake header covers the top 93px, and it hangs the ship half behind that header. In the
  real game there is no header there, so the same y would hang half the saucer off the canvas.
- The rest of this design landed in the round below.

### symbol width cap (same round)

H4's drum read "too big vs the others" (user). It was not padding: the limiting axis is HEIGHT for
every symbol in this set, so equalising it leaves a symbol drawn on an unusually WIDE silhouette
matching its class in height and overhanging it across — 0.774 of the cell against 0.70–0.72 for the
other three premiums. `scripts/measure-symbol-padding.py` now caps any symbol more than 6% wider
than its class MEDIAN width at that median, which pulls H4 to 0.712 and touches nothing else. Only
classes with three or more members are capped: a median over two is the mean of a shape the designer
chose to differ (the scatter capsule is 0.53 wide, the wild horseshoe 0.72, and neither is wrong).

## 25. THE REST OF THE PORTRAIT DESIGN — `4336-15793` — DONE 2026-09-04

Everything §24 left open. The design's own numbers are quoted against the 360x577 the game actually
owns — its frame is 360x800, but the top 93 is the Stake header and the bottom 130 the nav bar, and
neither is ours to draw in. That distinction is the whole reason the first pass measured wrong.

- **The board is FULL-BLEED.** The plate runs the entire width, 0..360, and the 7x7 grid is inset
  inside it, so the scale is quoted against the PLATE and against the VISIBLE canvas — main.width is
  the virtual 800 box, and at this aspect the player sees ~887 of it, so a fraction of main.width
  lands the board inboard of where it was measured. Our plate surrounds its grid by 11/84 of a cell
  each side, which puts the grid at 0.964 of the screen against the design's 0.959: half a percent,
  inside the plate's own border. `PORTRAIT_FRAME_FILL` / `PORTRAIT_TOP_OFFSET` are gone; the plate's
  centre is now the design's 0.4766 of the visible height.
- **The three info plates sit in the top corners**, 90.9 x 38.1 of 360. That aspect is 2.386 against
  `INFO_BOX_ASPECT`'s 2.387 and its type sizes are the fractions `InfoBox` already draws, so the
  plates needed a WIDTH and a position and nothing else. Same visible-canvas rule as the board.
- **The buy-bonus is the design's violet CAPSULE reading "BONUS"**, not a round badge reading "BUY
  BONUS" over two lines — the one control on the bar that did not speak the rest of the UI's
  language. `i18nDerived.bonus()` is the short form the desktop bar already uses (each locale's own
  BUY BONUS with the verb dropped, which also sidesteps the social-mode rename); the aria-label
  keeps the full wording.
- **BALANCE and WIN are near-black glass**, #000616 at 78% behind a 1px white hairline at 9%, radius
  8 — NOT the violet bar plate. That is what sets the two readouts off from the bet plate between
  them, which is the violet card (with the bar's own 4px #2D2C69 edge and radius 10, not the 2px it
  had). WIN is left-aligned like BALANCE: mirroring it made the pair read as pointing outward.
- The control bar is the design's 90.6% x 17.4vw.
- NOT taken from the design: the portrait logo's size. The design draws it ~21% larger than the live
  ramp does at 360px wide, but that ramp is a user pass (2026-08-10) — the HTML HUD sits at its
  minimum PIXEL sizes on small phones and eats proportionally more of the screen there.

### the SOUND icon's off state (same round)

MUSIC has had a struck-through off state since the Version2 art landed; SOUND signalled muted by
dimming the speaker to 40%. Two rows one above the other, one struck and one merely faded, do not
read as the same control in two states (user: "make the sound button to be like the music with /").

`scripts/build-sound-off-icon.py` draws `menu_sound_off.webp` from the ON-state SVG plus the note's
OWN slash, measured off `menu_music_off.webp`: corner to corner, 45 degrees, 8.27% of the box across
(an 11px horizontal run on a 94px box, over root two). The slash is UNION'd with the glyph — the
note's is too, there is no gap between the two.

The canvas is SQUARE while `ic_sound.svg` is 22.5 x 16.09, deliberately: both icons are
`contain`-fitted into the same 20x20 glyph box, so a square off-state whose speaker is drawn at the
on-state's own aspect puts the two speakers at exactly the same size and lets the slash overhang.
Squaring the box after the fact is what forced `menu_music_off`'s 0.895 CSS correction; this one
needs none. The SOUND row now uses the same mask glyph MUSIC does (so it also picks up the row's
hover colour), and the bar's mute buttons swap art instead of dimming.
