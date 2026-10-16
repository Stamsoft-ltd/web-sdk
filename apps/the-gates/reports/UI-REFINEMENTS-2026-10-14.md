# Gates UI refinements — 2026-10-14

Execute sequentially. Preserve authoritative RGS outcomes, original artwork, canvas ownership and mandatory autoplay safeguards. Scale layouts, not Figma pixel coordinates.

## Confirmed
- Remove optional autoplay loss/single-win thresholds, not funds/session/error/jurisdiction stops.
- Bonus exit: summary retracts into portal → doors close/open → base game returns.

## Tasks
1. [x] Portrait controls: remove landing pause; center bet glyphs; rectangular/padded Bonus.
2. [x] Mobile board/button gold: uniform generated board rim; gold→orange gradient (#EDBD4F / #FDCB02 / #F67F00), dark #021D42 edges.
3. [x] Autoplay: unfinished-round frame style; counts through 1000 (100-step above 100); remove optional stop-limit UI and runtime thresholds.
4. [x] Rules shell: supplied arrow asset; smaller modal, thicker gradient border.
5. [x] Rules content: pages 3–5 native card aspect/bold copy; page 6 portrait Interrupted Rounds + near-square Legal Notice and supplied copy.
6. [x] Bonus transitions: finish scatter/tumble entry round, doors/portal present bonus; reverse summary/doors on exit. No injected math events.
7. [x] Wins (Wild explicitly deferred by user): inset trumpet inner halves beneath title per tier; preserve native image bytes.
8. [x] Validate types, unit/contracts, build, asset packaging/integrity; record visual checks/limitations.

## Verification
- TypeScript: pass.
- Node unit/contract suite: **209/209 pass**.
- Production Vite build + runtime-asset package: pass (existing optional PUBLIC_* / chunk-size warnings).
- Native acquisition integrity: **78 files verified**, original PNG bytes unchanged.
- Browser preview only; no live wagers. Checked desktop 1200×840, portrait 390×844, landscape 844×390.
- Visual: portrait landing has three dots/no Pause; mobile HUD rims/glyph centres verified; autoplay End→1000 then Left→900 verified; rules page 3 equal card geometry + page 6 native nine-slice verified; Sweet/Epic/Mythic/Legendary overlap verified. Wild explicitly deferred by user.
- Bonus intro doors/portal and summary portal retraction visually verified; short cycle returns to base; deterministic boundary/reduced-motion/abort cleanup covered by tests. Did not validate live RGS acceptance.
- Browser automation later lost access to a QA tab; fresh-tab recovery worked once, then final extra narrow/card sweep stopped. No claim of full real-device coverage.
- New game-specific legal keys fall back to English for locales without catalogs. Mandatory unvalidated-math/RGS disclaimer retained.
- Browser viewport override reset.


### Task 1
Removed portrait Pause input/art; three dots centered. Bet +/− now centered SVG paths (not font glyphs). Mobile Bonus has reduced corner radius and side padding. Existing mobile/carousel guards updated for new requirements.

### Task 2
Board opening inset is 7 logical units on all sides; Pixi Graphics, no mobile frame bitmap. Mobile rail, circle faces, Bonus and Spin use requested three-stop gold gradient. 15 mobile/carousel/board tests pass. Portrait and landscape visually checked.

### Task 3
Autoplay shares unfinished-round compact gold frame. Slider detents 10–100 by 5, then 200–1000 by 100. Optional loss/single-win limits removed; launch explicitly uses shared Infinity (disabled) sentinel. Funds/session/errors/jurisdiction guards untouched. 9 autoplay/modal tests pass.

### Task 4
Imported supplied 27×15 arrow PNG unchanged; next arrow rotates same asset. Rules shell reduced to capped 1020×650 with responsive viewport margins; 8-unit three-stop gold/orange border. Navigation remains outside scrolling content.

### Task 5
Pages 3–5 use native visible-art ratio 1121/922, fixed non-shrinking cards and bold copy with inner overflow handling for long locales. Page 6 uses original gold/blue frames with CSS nine-slicing: portrait interruption card and near-square legal card, supplied paragraphs. Unvalidated-math/RGS caveat retained. Types pass. Desktop page 3 and page 6 visually checked.

### Task 6
Deferred bonus intro until first free-spin boundary (remaining entry cascades/settlement processed first). Existing native door/portal rig presents intro; summary retracts before reverse door sequence. Scenery switches behind closed doors. Abort clears transition; reduced motion fades only. Shared canvas job, no new ticker/timers outside playback barrier. 9 bonus/scene checks pass; entry portal and exit retraction visually checked.

### Task 7
Moved independent trumpet centres inward/up to the title row so inward halves are beneath title pixels. Tier scales/title widths unchanged. Native art hashes preserved. Wild’s native right trumpet remains part of its banner (no duplicate); prior left layout restored, as user requested deferral. Sweet, Epic, Mythic and Legendary visually checked. Wild deferred. 20 composition/rig/performance checks pass.

### Visual QA findings (fixed)
- Page 6 right card exceeded the scrolling page: matched reference 565/480 aspect, shared row height; original frame now rendered as CSS nine-slice, no stretched corners/new bitmap.
- Legacy mobile hit-area pseudo-element transformed the new ring; visual contour now separate from touch area. Rail inset shadow no longer hides gold.
- Bonus backdrop cold loads now predecoded before door clock.

### Asset follow-up
Wild right trumpet is flattened into banner. Left now correctly overlaps title, but pair remains asymmetric. Asked for clean Wild banner (separate trumpet sprites already exist). Remaining tiers are independent. User confirmed: ignore Wild until designers supply separated art. Wild changes deferred; remaining tier alignment complete.

User confirmed Wild deferral; prior paired Wild placement retained rather than shipping a more asymmetric half-fix.

Final QA also caught the Super card’s content-driven minimum height: all six cards now measure 249.328×205.063 CSS px at desktop; copy scrolls independently, with keyboard focus available. Original frame corners use CSS nine-slicing on page 6.

### Final build
- Runtime package: 34,621,343 bytes; 127 assets; 80 source modules in closure.
- Existing shared GameInfoCarousel unused-CSS warnings, optional PUBLIC_* export warnings and >500 kB chunk advisory remain; build exits 0.
- `git diff --check`: pass.
- Wild proof image reflects pre-deferral investigation, not a final alignment claim; source restores previous Wild layout.
