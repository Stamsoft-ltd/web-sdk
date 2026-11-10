# Symbol motion approval studies

Preview only. No runtime rig, game assets, outcome books or timing contracts changed.

Serve `apps/the-gates` on localhost; open `/tools/symbol-motion-preview/index.html`.
Current preview server: `http://127.0.0.1:3032`.

## Playback contract

- One deterministic 1,800ms paying gesture; Fast 1,000ms, Turbo 600ms.
- Rest → anticipation → internal action → settle. 400ms rest between preview loops.
- Same event clock for all eight matching cluster cells.
- Play/replay and symbol/speed changes restart the study; pause/scrub hold a pose.
- Reduced motion keeps all symbols at rest, including the existing Eye study.
- Key uses the original live KEY.json paying track (820ms) then holds rest for the remainder of the study. No new turn, squash, sparkle or glare.
- Wild final tint demonstrates cluster colour; no gameplay meaning assigned here.
- No portal sequencing or game animation waits added.

## Final asset handoff

All layers: transparent PNG, **same canvas, same pivot, same alignment**, no extra glow.
Keep all artwork painted behind movable pieces (no holes in underlying layers).
Prefer >=512px longest edge; selected Crystal Lotus Wild is 1254px.

| Symbol | Aligned layers requested |
| --- | --- |
| Envelope | body/interior, flap (hinge noted), wax seal |
| Sun coin | Supplied Sunburst Rays / Smiling Sun / Orange Medallion Badge; no rough cuts remain |
| Orb | Updated Group 348 body (271×272) + Groupс 349 spiral (142×108), copied unchanged |
| Pharaoh | headdress, clean face, eye whites, left/right pupils, eyelids, eyebrows, forehead gem |
| Wild | selected Crystal Lotus: gold frame, six frosted petals, central blue gem; aligned separate layers preferred |
| Gems | Current PNGs sufficient for the light-sweep study; facet layers optional |
| Key | Current PNG + original KEY.json paying tracks; fixed blue card drawn in code |
| Eye | Updated Group 353 rim with gems / Blue Almond / Iris Icon 3; copied unchanged |

Rough masks/reconstructed paper, skin and smooth Eye volume are **Canvas code**, not modified source PNGs. Envelope/Pharaoh may have patch seams; they are not production assets. Crystal Lotus Wild uses the selected high-resolution PNG with approximate code-only petal-light masks.

## Checks

```sh
node --test tools/symbol-motion-preview/motion.test.mjs tools/eye-look-preview/motion.test.mjs
```

Seven deterministic tests cover bounds, speed equivalence, reduced-motion/rest frames,
seal-before-flap order, iris perspective, reversed Orb/full Sun turns and exact original Key track samples. Browser visual checks required for all
studies. Local Canvas CPU/frame cost is displayed after 120 rendered frames; this
is not FPS or a low-end-device performance certification. Cached 300px surfaces,
no external libraries, no per-frame pixel readbacks, background-tab rendering paused.

### Local verification (2026-10-20)

- Five motion tests PASS; JS syntax and `git diff --check` PASS.
- Chrome close-up and eight-symbol cluster checked for envelope, Pharaoh, sun,
  orb and Wild; all twelve studies visible in the animated gallery.
- Turbo control shows 600ms; reduced-motion Wild remains at rest.
- Observed local CPU cost ~3.3–7.2ms per rendered frame with full gallery and
  cluster drawing. Not an FPS guarantee; no mobile GPU/device sign-off performed.

### Revision 2026-10-21

- Orb: supplied split layers, counterclockwise full turn, no colour-key extraction or reconstructed glass. Native rest orientation preserved after one full turn. Tiny supplied exports appear soft enlarged; no raster upscaling/editing performed.
- Sun: one full ray rotation instead of 12.6° sway; face/rim stay fixed; added glare and wink removed. Original painted highlights remain part of the source PNG.
- Key: direct linear sampling of live KEY.json paying rotation/translation, degrees converted from Spine Y-up to Canvas Y-down. Curved tracks fail explicitly instead of silently approximating. Live gameplay unchanged.
- Seven motion tests + JS syntax + diff whitespace checks PASS. Chrome visual checks completed for all three revised studies.

### Latest supplied-layer revision (2026-10-21)

All eight newly supplied assets copied unchanged; hashes and source paths in
`assets/provenance.json`. Preview only; no production replacements.

- Sun uses three real supplied layers. Face and badge remain fixed; rays rotate.
- Orb uses larger supplied body/spiral. Three CCW turns in 1,332ms of the normal
  1,800ms study (8–82%); then rest. Previously one turn over 1,368ms.
- Eye gallery and dedicated Eye preview share real split layers; rim/gems fixed,
  iris perspective retained. Broad blue interior sampling avoids a doubled almond
  edge; supplied blue alpha masks smooth gaze-linked shading.
- Latest motion tests and syntax checks pass. Browser visual check **pending**:
  local browser control disabled in Work settings. Prior screenshots/performance
  measurements do not certify this latest asset layout.


### Crystal Lotus Wild approval preview (2026-10-21)

Open **http://127.0.0.1:3032/tools/symbol-motion-preview/wild.html**.
The existing gallery also uses the selected Wild and links to this all-variants page.

- Exact uploaded selection copied unchanged to `assets/wild-crystal-lotus.png`.
  Source/hash in `assets/wild-provenance.json`; no replacement of live Wild assets.
- All ten regular paying symbols: Red, Blue, Green, Purple, Amber gems; Eye,
  Envelope, Sun medallion, Orb, Pharaoh. Primary colors match live `SYMBOL_GLOW`;
  accent catches reflect each symbol’s secondary colors. Keys are not Wild clusters.
- Neutral rest → petal illumination + halo → six staggered facet catches → neutral.
  No whole-symbol shaking. Center gem/gold protected by soft geometric/chroma mask.
- 1,800ms Normal, 1,000ms Fast, 600ms Turbo; shared clock across all cards, 500ms
  neutral gap. Pause, scrub, replay and reduced motion supported. Hidden-tab clock freezes.
- Pixel classification and palette tint/halo preparation run once, not per frame.
  Cached 512px surfaces: base + mask + 10 pairs ≈22 MiB raw pixel storage, excluding
  browser overhead and shared original symbols. Display reports measured local
  Canvas CPU time after 120 visible frames; this is not a mobile GPU/FPS certification.
- `wild-motion.test.mjs`: palette completeness/parity, bounded glow, rest/reduced/speed
  behavior, mask protection and uploaded PNG hash. Existing studies remain covered.
- Browser visual QA **pending**: browser control disabled in Work settings (Mac also locked).
  Localhost static-file checks return 200 for page, modules and selected PNG.

```sh
node --test tools/symbol-motion-preview/{motion,wild-motion}.test.mjs tools/eye-look-preview/motion.test.mjs
```


### Supplied redraw / final-component revision (2026-10-21)

- Live and preview Wild now use byte-identical `static/assets/the-gates/wild/flower.png`
  from Glossy Blue Gem Flower Emblem.png. Old concept PNG is authoring-only.
- New Key raw source retained unchanged; visible alpha>96 crop `215,252,500,431`.
- Pharaoh uses actual face / two eyes / two brows / forehead gem exports, including ZIP layers.
  Blink and asymmetric brow lift; no reconstructed skin or fabricated eye whites.
- Envelope uses actual supplied front body / flap / lower seal plus the closed composite.
  Approved full-seal extraction retains white gloss; flap turns around its real base.
- Motion and one-time component preparation browser modules are generated from live TS:
  `node tools/symbol-motion-preview/build-premium-preview.mjs` (or `--check`).
  Canvas study stretches the live 900ms Pharaoh/Envelope gesture to 1800ms for inspection.
- Live board retains native landing / suction / above-frame guards, reduced motion and teardown.
- Browser QA attempted: in-app localhost returned connection refused despite active local server;
  Chrome extension reported debugger unattached. Unit/type/build checks remain authoritative;
  visual review of this revision still required.

### 2026-10-21 alignment correction

- Wild: six complete connected pale crystal interiors receive cluster color, including the outer facets. Tiny white glints on gold and the center blue jewel stay unchanged. One-time mask preparation; no per-frame pixel reads.
- Pharaoh: separate supplied left/right eye PNGs. Both supplied eyebrow files have identical SHA256; the right file is mirrored inward in live, preview and static SVG. A genuinely different right brow needs a replacement source export.
- Envelope: one body/flap assembly at every frame, no composite/parts crossfade. Hinge lowered to y=78 (6px overlap over body top). Lid draws in front while closed, behind the body while open; ordering changes edge-on.
- Seal: lower supplied broken fragment stays on the body; complementary upper fragment, isolated from the approved closed art without paper, travels with the lid. Same geometry shared by Canvas preview and Pixi.
- Existing layers suffice for these corrections. For a pixel-exact match to the closed reference, optional final exports should use one aligned canvas for front/interior, flap and both broken seal fragments.
- Browser visual confirmation pending: computer/browser tool reported no available surfaces. Offline geometry frames inspected; these are not browser screenshots.

## 2026-10-22 Palace replacements (preview only)

The gallery IDs stay `pharaoh` and `envelope` for existing links, but now display **Spirit Knight** and **Enchanted Chalice**. No production renderer, assets, paytable mapping or maths changed in this pass. `premium-render.mjs` and its generated live copies remain available as the previous art study; the gallery uses `palace-render.mjs` instead.

- Knight: new AI-generated body with golden spirit in the chamber. Exactly one masked faceplate from the approved v4 concept rotates about a fixed temple pivot for both open/closed poses; no independent state-image swapping. Gold charge, visor drop at 252–702ms, slight damped plate-only settle, reopen at 1170–1638ms, light settles by1764ms. The body itself does not shake or change size.
- Chalice: approved gold/pink concept. Pink liquid ripples rotate inside a cached basin mask; pink intensity and a gentle rose halo pulse. Gold exterior and cyan jewel stay fixed. Front rim is excluded from the liquid effect.
- Normal1800ms / Fast1000ms / Turbo600ms. Existing replay/pause/scrub/loop and reduced motion apply. Reduced motion holds open visor and neutral liquid. Replay/selection/speed resets the study. Same clock on all eight paying cells.
- `assets/palace/timeline.json` is validated by the event-animation-designer timeline checker. `palace-motion.test.mjs` tests determinism, bounds, rest, speed equivalence, one-plate assembly, provenance and no per-frame bitmap extraction.
- Native PNGs stay unchanged. `assets/palace/provenance.json` contains full image prompt/source hashes and final layer requirements.
- Masks and 2D visor projection are APPROVAL QUALITY, not a production rig. For final art: aligned full helmet body, spirit/emission/eyes, visor and pivot; gold chalice body, liquid and foreground rim. Generated source images are not claimed to be aligned exports.
- Browser QA: open/closed Knight and pink Chalice checked in IAB, including Fast/Turbo duration readouts and reduced-motion rest. Screenshots saved under `reports/concepts/magical-palace-20261022/round-04-spirit-preview/`.
- Observed local Canvas study display: about0.3–0.7ms/rendered frame including gallery and cluster. Not a measured FPS guarantee or mobile/GPU performance certification. One-time masks and cached300px surfaces; no per-frame pixel reads or filters.

```sh
node --test tools/symbol-motion-preview/*.test.mjs tools/eye-look-preview/motion.test.mjs
```

### Two-hinge / splash refinement

- Knight no longer rotates about one corner or scales/shears the faceplate. One rigid texture translates on a shared projected two-arm orbit. Both temple anchors stay fixed and both mounts move together. Each underlying 3D arm radius is170px; 2D projection is an approval approximation, not a final3D mechanism. Uniform0.76 fit on the ENTIRE assembly makes room for the raised visor; this fit never changes during the gesture.
- Chalice wobbles at the foot by at most0.025rad (~1.43degrees),1.5px horizontally and0.7px vertically. Three fluid tongues pulse upward with7 deterministic ballistic droplets; the swirl remains masked to the liquid. No random particles, per-frame pixel extraction or new clock.
- Added tests verify both fixed pivots, equal mount offsets, constant 3D arm radius, no plate-local scale/shear/rotation, bounded splash/wobble and exact rest/reduced motion.
- This revision remains authoring-preview only; live game unchanged.

### Current Knight motion — outward swing, not a flip

Supersedes the lift/arms experiment above. The current visor rotates only0–60degrees, keeping its front upright. A pair of concealed fixed hinges behind the short integral temple tabs drives one rigid faceplate. A perspective texture mesh projects this motion; no long translating arms, single-corner rotation, global Y-scale, or over-the-top flip. The helmet is back at its original fixed fit. Neutral/current projected surfaces are cached and reused across all cluster cells. The mesh is an approval approximation; final aligned visor/body layers still required.

Regression gates: both hinge locations invariant; plate3D distances preserved; raised front stays upright with nonzero projected height; finite smooth open/close path; speed/reduced-motion equivalence. Chalice splash/swirl/wobble unchanged.

### Latest correction — pin the visible artwork corners

The prior model incorrectly put hinges70px behind the visible connections, so the visible corners still travelled even though those hidden pivots stayed fixed. Removed that offset. The actual texture coordinates(53,120) and(215,126) now have zero depth and remain invariant at every angle. The visor front has depth only between short curved side cheeks. Mesh vertices explicitly include both visible corner pins and the hinge-axis row; interpolation can no longer skip the anchors. No moving mount lines remain.

`Show hinge anchors` adds optional cyan reference dots at those fixed positions. IAB open/closed captures saved as `knight-visible-pins-{open,closed}-v4.png`; same dot coordinates and artwork connections in both. Regression tests call the actual rendered `visorPoint` function at these exact source corners, not just an abstract pivot helper.25 preview tests PASS. Live unchanged.

### Separate-component short Knight — current preview

`short-knight.html` now uses the new independent `knight-components/helmet.png` and alpha-cutout `visor.png`, not the rejected redraw or two-state image sheet. Previous static view remains at `short-knight-components-static.html`.

- Visor on shared300px canvas: x−5/y109 (was x0/y116.28), width279.9. Spirit lifted7px inside a feathered cached interior patch; stationary shell/rim retained. No source PNG edited.
- Two fixed anchors at the visor's actual left/right extremes (alpha>128 boundary), mesh vertices exactly on the axis. Curved plate undergoes0–44degree rotation; no single-corner pivot or uniform vertical squashing. Canvas projection is an approval approximation, not a final3D model.
-2600ms deterministic cycle: wait0–240, open240–960, hold960–1660, close1660–2360, settle2360–2600;500ms preview-loop gap. Replay/Pause/Scrub, optional hinge markers, visor visibility and reduced-motion rest. Document hidden→freeze clock. OneRAF, cached600px surfaces, no per-frame bitmap readbacks or new canvases; no measured FPS claim.
- `component-knight-motion.test.mjs`: both end anchors invariant, rigid3D distances, identity at rest, nonzero raised plate height, bounded continuous motion, placement/timeline/reduced-motion, PNG hashes/alpha, render lifecycle.30 total preview tests PASS.
- `assets/palace/knight-components/animation-timeline.json` validated by the event-animation-designer checker. Live game unchanged. Production still benefits from an explicitly exported spirit layer; this preview isolates it at render time.

### Left-facing perspective correction

The short-visor arc now peaks40% of the way from the left hinge, not50%. This moves the lifting center~22.6px left in the300px authoring space to follow the lower guard's front ridge. Both original end anchors, rest placement, spirit offset and timing remain unchanged. The mesh includes an exact vertex at the offset apex. Regression covers left-of-midpoint peak, bounded depth and unchanged rigid rotation/hinge invariance.31 preview tests PASS.

### Smooth short-visor arc

Replaced sparse span sampling with64 evenly spaced segments plus the exact offset apex/pins. Small0.12px clip overlap removes antialias seams without blurring source art. Arc midpoint error remains below0.05 authoring pixels (<0.1 backing pixel at2x) in regression samples. Shared vertices now project once per frame; raised/rest textures remain cached. More triangles, no measured FPS claim.32 preview tests PASS; motion, fixed anchors, left-facing peak and PNGs unchanged.
