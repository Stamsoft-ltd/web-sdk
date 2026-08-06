# Forest Gang — Merged Animation Audit, Rated by Agent Agreement

- **Date:** 2026-07-23
- **Author:** Fable (designated final author), incorporating the full discussion in `docs/animation-chat.md`
- **Agents:** **[F]** Fable · **[K]** Kimi · **[S]** Sol — source audits in `docs/{fable,kimi,sol}-animation-audit.md`, merged in `docs/animation-audit-merged.md`
- **Rating rule:** an item counts an agent when that agent raised it **or** independently verified and agreed in the chat. Every disputed claim was re-verified against the code, the published library sources (pixi.js 8.8.1, svelte 5.20.5, @barvynkoa/particle-emitter 0.0.1), or the actual asset files before counting.
- **Process note:** C1's broadened trigger and the FadeContainer disproofs were reached **blind** by Fable and Sol independently (same sources, same conclusions, before reading each other) — the strongest confirmations in this document. Kimi issued one retraction (loading-bar size) and five concessions; Fable retracted/corrected four of its own reviewers' framings; Sol's corrections were accepted wherever verified. Positions below are each agent's final, post-discussion vote.

---

## ✅ Items with 3 agreeing agents

### CRITICAL

**R1 (was C1). AnimatedSprites freeze at frame 0 on any prop change — the headline finding.** [K raised; F+S independently confirmed and broadened]
PIXI 8.8.1's `AnimatedSprite.textures` setter unconditionally ends in `gotoAndStop(0)` with no identity guard (source-verified), and `propsSyncEffect` (`packages/pixi-svelte/src/lib/utils.svelte.ts:111`) rewrites **all** props whenever **any** prop changes. So a sprite is stopped not only when deferred asset waves replace `loadedAssets` (Kimi's original chain, confirmed) but on the **first prop change after mount**: per-frame `y` during every reel spin, the scatter/wild win-zoom `width`/`height` writes, the `alpha` dim when a win starts. Nothing restarts playback (`play`/`startFrame` unchanged), and `EnableSharedTicker` only advances `playing===true` sprites — so this is live in the current build; the buy-bonus modal toggle "fixing" idle blinks is the tell. Explains the frozen-animation symptom the EnableSharedTicker patch was built for, with no ticker exception required.
**Fix (~5 lines):** exclude `textures` from the generic sync; dedicated effect that assigns textures only on real change and preserves `currentFrame`/`playing`.

**R2 (was C2). Scene rendered twice per frame; parallel ticker patch; ticker-death hazard.** [F, K, S]
`InitialiseApplication.svelte` never passes `autoStart: false`, so the app ticker runs and renders — while `EnableSharedTicker.svelte:20-77` walks the entire scene graph per frame on its own rAF and calls `app.render()` again (~2× GPU, O(scene) CPU, phase-unrelated micro-judder; `Ticker.shared` globally stopped). PIXI's `_tick` re-schedules only after `update()` returns (source-verified), so one throwing listener permanently kills a ticker — a real hazard, but **no production throw was observed and R1 alone explains the observed freezes; ticker death is a risk, not the established origin of the patch** [S guard; K agreed]. Consensus sequencing (all three): the patch is **accidentally load-bearing** — if a leaked listener ever throws on the app ticker, the manual rAF render is what keeps the game drawing — so delete it only in the same change set as R1 and R3.

### HIGH

**R1a. Payline vines drawn at the wrong scale — they miss the symbols.** [S raised; F verified with independent math; K verified]
`Game.svelte:423` scales the payline container by uniform `bl.boardScale` while the Board renders at per-axis `scaleX/scaleY` (desktop ×1.06/×0.93 → ~19px error at the outer reels, ~15% of a cell; landscape ×1.12 → 12% everywhere), and misses Board's `+3px` desktop nudge. `Anticipation.svelte:19-22` contains a comment warning about this exact pitfall and compensates per-axis — the payline container never got the fix. Effort: one line — `scale={{ x: bl.boardScaleX, y: bl.boardScaleY }}`.

**R3 (was C3, severity corrected CRITICAL→HIGH). Ticker-listener leak per win + full subtree rebuild per win.** [F, K, S — unanimous on defect and on HIGH]
`ParticleEmitter.svelte` registers an anonymous `ticker.add` callback and never removes it; `Win.svelte:121` wraps the win subtree in `{#key oncomplete}` with `oncomplete` reassigned per win → one leaked callback plus a full destroy/recreate (rebuild flash) every win. Corrected scope: post-destroy `update()` no-ops (emitter source), and `Particles.svelte` — the variant that does live work after unmount — is not used by forest-gang. Cost = unbounded callback-list growth + each leaked closure is a ticker-kill candidate (see R2). **Fix:** named callback + `ticker.remove`; replace `{#key oncomplete}` with explicit state reset; fix `Particles.svelte` in the shared package regardless.

**R4 (was H1, amended). Board animations play at reduced temporal resolution (8–18fps effective).** [K raised; F+S sign the amended wording]
`animationSpeed` 0.14/0.25/0.26/0.28/0.3 (scatter ≈8.4fps, wilds ≈15.6, idles ≈17, wins 15–18) — values and frame counts verified on disk. Amended cause: the generator scripts **decimate frames** (win: 55–79 source frames resampled to N=40; expand: every 3rd of ~120), so the sheets themselves lack temporal samples — the provable defect is **8–18 unique fps and 1.5–3× frame decimation**. Whether any given clip currently plays slower or faster than authored is **not derivable** — the source clips' fps/durations are absent from the tree; net effect: steppy, and likely off-cadence sheet-by-sheet [S constraint accepted; Kimi's universal "~0.7× slow-motion" withdrawn, replacement phrasing Kimi's].
**Fix:** regenerate sheets at higher N (or authored per-frame durations), measure each clip's true duration `T_clip`, then set `animationSpeed = N / (60 × T_clip)` per sheet (`N / T_clip` is the target effective fps, not the PIXI setting). **Do NOT blanket-raise `animationSpeed`** (see Disproved #6).

**R5 (was H2). Win/idle art is stylistically inconsistent; one-shot clips play backwards.** [S raised; K verified mechanism; F confirmed visually]
Verified first-hand from the sheets: wolf idle = subdued semi-realistic transparent bust; fox win = opaque glossy scenes with crown, robe, and baked-in ornament background — reads as a different character. Ping-pong reversal explicit in `Board.svelte:82`, `ExpandedSymbolOverlay.svelte:65/:84`, and the generator's own docstring. Scoping note [K]: the reversal complaint applies to money/action clips; ping-pong on ambient idle motion is standard practice.
**Fix:** re-author to one rig/style (proper); minimum viable: play one-shots forward and hold a clean final frame.

**R6 (was H3). Reel stop begins with a ~3.5× velocity spike.** [S raised; F verified math; K conceded, retracting its own "sensible tuning" praise]
Linear 2.3px/ms hands off to a `cubicOut` segment averaging 2.8px/ms; cubicOut's initial derivative is 3× its average → instantaneous ~8.4px/ms ≈ a full symbol cell in one frame. The `constants.ts:76` comment claims 2.8 is "slower than" the 2.3 spin speed — the intent and the math disagree.
**Fix:** velocity-continuous handoff (match the easing's initial derivative to the incoming speed, or derive duration/easing from continuity constraints).

**R7 (was H4). No motion blur treatment on the spinning reels.** [F raised; K verified; S agrees with mobile-profiling caveat]
`MOTION_BLUR_VELOCITY = 31` (`constants.ts:116`) is dead; no `'spin'`-state art exists. Fully sharp strips at ~138px per 60Hz frame alias/strobe. **Fix:** pre-blurred spin-strip art, or a bounded per-reel vertical blur while `motion === 'spinning'` — profile on mobile first [S].

**R8 (was H5). Hero win count-up is linear and overlong.** [F raised; K corroborated at source level; S agrees with design caveat]
Svelte `Tween` defaults to linear (source-verified); `WinCountUpProvider.svelte:29` passes no easing; big tiers run `presentDuration` 10–45s × 0.25 = 2.5–11.25s + a 3s auto-close hold. The 400ms turbo clamp (`Win.svelte:120`) applies only to non-board wins — big-win counts run full length even in super-turbo [F]. Caveat [S, accepted]: a bare `cubicOut` would bunch tier crossings early and worsen R9 — use a designed count curve coordinated with the tier choreography.

**R9 (was H6, reframed). Tier crossings vanish the win board and pop the coin fountain.** [F+K raised; S's correction accepted]
`WinBoard.svelte:39-54`: a deliberate, `animating`-guarded "magnetic" collapse-to-0/re-pop per tier crossing that skips tiers when the count outruns a cycle (no unbounded queue — corrected framing), but a slow big-win climb still fully vanishes the hero board up to 4×. Simultaneously `ParticleEmitter.svelte:34-36` re-runs `emitter.init()` per tier (config identity flips per `tierKey`) and `init()` starts with `cleanup()` destroying all live particles (source-verified) → fountain pop at the same moments.
**Fix:** cross-fade tier art (pop only the final tier); mutate emitter intensity props live, never re-`init` mid-fountain.

**R10 (was H8). Texture memory and atlas sizes exceed mobile limits; no upload warm-up.** [S raised with numbers; K retracted its disproof; F verified dims + totals]
JSON spritesheets (scan reproduced independently by S and F): **33 sheets = 557.8 MiB** decoded RGBA; **28 referenced by `assets.ts` = 483.8 MiB**, wave 0 = **282.3 MiB** via `Promise.all` [S]; **5 unreferenced = 74.0 MiB** to delete (`coin_rain_a/b` ~65.4 combined, `MM_pressanywhere` ~6.1, `MM_Localisation_winsmall` ~1.0, `rabbit_10_anim_sheet` ~1.5) [S; F reproduced 33/558.1 after fixing a `?v=` cachebuster bug in F's first scan; K's earlier 584/34 figure is superseded]. All on-disk image inventory (243 files incl. duplicates and unreferenced assets) ≈ 994.4 MiB decoded — an inventory figure, not simultaneous runtime residency; the referenced 483.8 MiB is the runtime-relevant estimate [F measured; S reproduced and labeled]. Oversized: `loading_bar.png` **5992×560** is a Pixi atlas and exceeds the 4096 GPU texture limit on constrained devices; `navbar/bar.webp` and `hud_frame.webp` (**4600×500**) are CSS-side images in HudHtml — a decoded-memory concern, not a GPU-atlas-limit violation [S nuance]. No `renderer.prepare` warm-up → first-use GPU upload stalls mid-spin [K].
**Fix:** feature-demand load/unload with residency caps, split atlases ≤4096, prewarm uploads after each wave.

**R11 (was H10, wording final per Kimi §2.5). Turbo/skip dead time.** [F, K, S]
`bookEventHandlerMap.ts` has 6 `waitForTimeout` sites: **3 raw** (`:198` 190ms/reel, `:209` 650ms, `:402` 150ms), `:111` (600ms) semi-gated (skips only super-turbo), `:293`/`:415` properly gated. Component side: DealItMultiplierPanel raw 320/120/200 + skippable 900/240 (raced with `skipReveal`); GlobalMultiplier 170/280. Spine `timeScale` identical 1.5 for turbo and super-turbo (`stateBet.svelte.ts:57`). Net: an expanding spin holds ~1.4s even in super-turbo, and skip presses during raw holds are ignored.
**Fix:** one turbo-scaling, interruptible hold helper cancelled on `stopButtonClick`; distinct super-turbo timescale.

**R12 (was H11). Per-frame Graphics re-tessellation during win presentation.** [F+K raised; S agrees]
`ForestBugs.svelte:118-129` (8 procedural bugs, ~200 path ops/frame), `VineRope.svelte:32-52` (full path + extents + mask rebuilt per frame per line, under a GlowFilter), `WinBoard.svelte:139-151` (14-circle glow rebuilt per frame via breathing `boardSize`), `ExpandedSymbolOverlay.svelte` (mask rebuilt through the 460ms expansion). All land exactly when frame budget matters most. **Fix:** draw static geometry once; animate Container transforms / mask rect only.

**R13 (was H9). First bonus outro pops in unanimated; its rAF clock runs from launch.** [F+S raised; K verified]
`FreeSpinOutro.svelte:57` `show = $state(true)` (intro correctly `false`): the 750ms entry burns out invisibly at app start; first real outro is `true→true` (no-op) → hard pop; the `show`-gated clock runs all session. **Fix:** `$state(false)` — one character.

**R14. MaxWin (25,000×) hard-cuts in with no designed entrance.** [F raised; S corrected the mechanism; K verified]
Corrected mechanism: `Win.svelte:149` conditionally **hard-swaps** `MaxWinScreen` in place of the tier subtree inside the already-visible FadeContainer the moment the live count crosses 25,000× — no fade, no pop, while lesser tiers get backOut entrances. The game's biggest moment has the least choreography. **Fix:** dedicated entrance (flash/overshoot) on the threshold crossing.

### MEDIUM

| Item | Detail / correction | Agents |
|---|---|---|
| Particle emitter time units wrong | `deltaMS × 0.00234` into a seconds-based `update()` → 2.34× real-time; `emitSpeed` **replaces** the unit conversion (`1` → 1000×, theoretical — no caller passes it). Configs tuned against the broken scale; fix units + retune together with R9 | F, K, S |
| Superseded `Tween.set()` promises never settle | `loop.js` `abort()` deletes the task without fulfilling (source-verified). Rated as an API/control-flow **hazard** — the concrete stuck-anticipation bug is disproved (see Disproved #8). Don't build must-complete flow on tween promises | F, K, S |
| rAF fragmentation | 8–10 concurrent component clocks at peak (corrected from ~11; SplashIntro is `setInterval`; not all coexist) + svelte tween loop + app ticker. Consolidate into one shared clock | F, K, S |
| CONGRATULATIONS pulse snaps on | free-running `sin(animT)` gated at `slideIn ≥ 0.99` → scale jump as the title lands (`FreeSpinIntro.svelte:131`, `FreeSpinOutro.svelte:86`). Phase-lock at settle | F, K, S |
| Splash carousel hard-cuts | 3s `setInterval` block swap, no crossfade — first screen players see (`SplashIntro.svelte:39,61-80`) | F, K, S |
| Near-miss wobble timing hazard | raw `setTimeout(280)` (`Board.svelte:259`) races win evaluation; it re-reads `hasWinState` at fire time so overlap is **unreproduced** — replace the heuristic with an explicit evaluated-loss event | F, K, S |
| Anticipation music duck | instant 10% step (no fade) + restores a mount-time snapshot, clobbering user volume changes (`Anticipations.svelte:30-38`). Use the sound layer's fade/duck | F, K, S |
| Transition wipe off-theme + atlas misdeclared | dust/rocks/coins/sparks instead of forest foliage; atlas declares 1219×1042 vs 1215×1038 actual → Spine UVs sample against wrong page size [S mechanism]. `generate_coin.py` sits in the dir | F, K, S |
| Missing-asset fallback logging | `$state.snapshot(stateApp)` deep-clones in template blocks of 4 shared components — re-runs on loading-progress/wave changes (corrected: not per animation frame). One-time warn | F, K, S |
| Repo hygiene | 7 tracked `.pyc` under `tmp_fg_math/__pycache__`, ~23MB `Forest Gang_Project/` at root, ~15MB `old_assets/forest-gang`. Chronology corrected: old_assets predate the 93aaa0a purge (which only removed references) | F, K, S |

### LOW / architecture (all three agents)

Uncleared timers firing on stale state (`TransitionAnimation.svelte:37`, `ExpandedSymbolOverlay.svelte:132`) · FadeContainer's redundant competing code paths (runtime claims disproved — see below) · debug/cell-shading rectangles behind every symbol (remove or document; possibly deliberate) · three unsynchronized timing domains (svelte rAF → effect flush → PIXI rAF) · uncapped `resolution: devicePixelRatio` + `antialias: true` on mobile (cap at 2 after removing the double render) · `readyToSpinEffect` float equality (safe only because `placeY` writes exact values) · `setTimeout`-based 145ms reel stagger (not frame-aligned) · dead code (`SymbolWrap.svelte`, unused `lodash`/`sequence` imports, `card-icon-swing` keyframes; `AmountFadeProvider` dead fade is [K,S]) · `console.info` on every All-In spin · no `prefers-reduced-motion` anywhere · outro amount rescaling per digit + static Pixi "PRESS ANYWHERE" vs blinking splash label (minor).

---

## 🤝 Items with 2 agreeing agents

| Item | Detail | Agents |
|---|---|---|
| No animation regression coverage | no deterministic animation stories, timestamp screenshots, frame-time budgets, or atlas validation; Playwright + atlas checks proposed | S raised; F concurs |
| `AmountFadeProvider` fade is dead code | children hardcode `alpha: 1`; internal awaits can strand (nothing external awaits them) | K raised; S confirmed |

*(Everything else that started at 2 was driven to 3 by the verification rounds — see chat.)*

---

## ☝️ Items with 1 agent

| Item | Detail | Agent | Status |
|---|---|---|---|
| Spine mix-0 crossfade suggestion | `SpineTrack.svelte:26/:45` `setEmptyAnimation(_, 0)` hard-cuts — affects FreeSpinAnimation / TransitionAnimation / Win popup spines only (board is spritesheets). Test the `intro → idle` transition visually before adding a 0.1–0.2s mix; authored endpoints may already match | K | test-first suggestion (S and F narrowed scope; S votes it 1-agent explicitly) |
| Big-win count-up exempt from turbo clamp | `Win.svelte:120` clamps only non-board wins; noted inside R8/R11 | F | folded into R8 |

---

## ❌ Disproved / corrected claims

Claims that appeared in an audit or the merged doc and did **not** survive verification. Kept for the record with who conceded.

1. **FadeContainer "visible mount flash + double `oncomplete` + ignores `props.duration`"** [K raised; F+S disproved blind; K conceded all three]. Superseded tween promises never settle → exactly one `oncomplete`; `new Tween(v, {duration})` bakes `props.duration` into the instance default; effects flush in a microtask before the next rAF paint → initial `alpha=1` never reaches the canvas. Survives only as a code-smell cleanup (LOW above).
2. **"`loading_bar.png` is 1372px, Sol's 5992px is wrong"** [K's disproof of S] — **withdrawn by K** after re-measuring the actual file (5992×560); the original claim stands in R10. A disproof that was itself disproved — recorded as the process's cautionary tale.
3. **MaxWin "enters via a linear 400ms fade"** [F's reviewer] — wrong mechanism; it hard-swaps inside an already-visible container (see R14). Quality defect retained, mechanism corrected [S].
4. **"All 13 `waitForTimeout` holds are raw/uninterruptible"** [F's reviewer] — corrected counts in R11 (3 raw + 1 semi-gated + 2 gated in the handler; 2 of DealIt's raced with `skipReveal`) [S counted, K refined, F verified].
5. **"Destroyed emitters keep doing per-frame particle work; hundreds of live updates accumulate"** [F] — post-destroy `update()` no-ops (source), and `Particles.svelte` (which does keep working) is unused by forest-gang → C3 re-rated HIGH (R3) [K nuance, S usage check, F conceded].
6. **"Raise `animationSpeed` to 0.4–0.5 to match 24–30fps sources"** [K's fix] — the sheets are frame-decimated resamples; raising the rate plays the same jumps ~1.3–2× faster than the current playback without adding temporal samples, and "too fast vs authored" is unprovable without the source clips. Fix corrected in R4 [F+S; K conceded].
7. **"old_assets re-added despite the 93aaa0a purge"** [F's reviewer] — chronology reversed: added in 43fda0b (~85 commits earlier), purge removed only references [S; F verified git order].
8. **"Superseded fade promise leaves `reelState.anticipating` stuck"** [K] — unreachable in current wiring: unmount requires `oncomplete` already fired; stop-click calls it directly. Hazard retained as a MEDIUM note [F+S disputed; K conceded].
9. **"Spine mix-0 pops every symbol state change"** [merged wording] — board symbols are spritesheets; affects 3 popup components only [S; K conceded; F verified usage].
10. **"Missing-asset snapshot logging deep-clones per animation frame"** [K] — Svelte template blocks re-run on their own deps (stateApp), not sibling animated props; "repeatedly during loading" stands [S; F+K accepted].
11. **"~11 concurrent rAF loops"** [K] — 8–10 at peak; SplashIntro is `setInterval`; consolidation recommendation unchanged [S count; K accepted].
12. **Merged-doc attribution errors** — "[F flagged the 8fps case]" and "[F confirmed the ping-pong construction]" were wrong at merge time (Fable's original audit contains neither; both were later verified by F in chat, so the *items* are legitimately multi-agent now, but the merge-time attributions were fabricated) [K caught].
13. **Reclassified as aesthetic judgment, not defects:** panel cubicOut "pops" (authored shrink-settles; naive backOut would undershoot) [K disagreed-as-defect, F+S accepted]; single flat 750ms intro/outro entry tween (stagger/overshoot = design preference) [S; F accepted].
14. **"Near-miss wobble overlap reproduced on slow devices"** [F] — hazard only; timer re-reads win state at fire time; no reproduction [S; F conceded, K accepted].
15. **"Board should key symbols by the `id` field" — proposed change REJECTED under the current reel model.** Full timeline: F+S initially preferred stable keys; K showed `createReelSymbols` mints fresh objects (and fresh `id:{}`) every spin and padding swap, so id-keying today would destroy/recreate ~20 symbol subtrees per spin — a regression; S re-checked and switched to K's side; F's final stance is contingent-against (the retained-child pathology is real but R1's `propsSyncEffect` fix is the remedy). Final: **K+S against, F contingent-against — rejected**; revisit only if the reel factory is redesigned to persist per-(reel,row) identities — effectively unanimous on that conditional [K argument; S switched; F conceded; K's unanimity framing accepted].
16. **Kimi's "~0.7× authored speed / universally slow-motion" refinement to R4** — withdrawn: source clip fps/durations are absent from the tree, so current playback may be slower *or* faster per sheet; only the temporal-resolution decimation is provable [S; F conceded after initially incorporating it].

---

## Consensus order of attack (impact ÷ effort, all three agents aligned)

1. **R1** — `propsSyncEffect`/textures fix (~5 lines): unfreezes every board animation.
2. **R2+R3** — single render loop; listener cleanup; drop `{#key oncomplete}`; delete `EnableSharedTicker` **in the same change set** (it's load-bearing until R1/R3 land).
3. **R13** — outro `$state(false)` (1 char) and **R1a** — payline per-axis scale (1 line).
4. **R6** — velocity-continuous stop easing; **R8** — designed count curve + duration trim (coordinate with R9's cross-fade).
5. Emitter time units + no re-`init` per tier (with R9).
6. **R10** — feature-demand asset residency, ≤4096 atlases, upload prewarm.
7. **R11** — interruptible turbo-scaled holds; super-turbo timescale.
8. **R12** — cached static geometry, shared clock.
9. **R4** — regenerate sheets at higher N, per-sheet cadence.
10. **R5** — art re-authoring to one style; forward one-shots (largest effort, largest visual payoff).
11. **R7** — reel motion treatment after mobile profiling.

## Summary

| Bucket | Count |
|---|---|
| 3-agent consensus | 15 majors (2 CRITICAL, 13 HIGH) + 10 MEDIUM + 11 LOW |
| 2-agent | 2 |
| 1-agent | 1 (+1 folded into R8) |
| Disproved / corrected / rejected | 16 |

**Verdict: BLOCK** — unanimous across all three agents. R1 alone explains most of the reported "poor quality"; R1–R3 + the two one-line fixes (R13, R1a) are a day's work and would visibly transform the game.

*Rev 3 — **RATIFIED by all three agents.** Kimi: "Kimi — response to Sol's final consistency check" (ratification with all four Sol corrections accepted, two own-number retractions). Sol: "Sol — Rev 2 verification" (substantive ratification + final sign-off contingent on three editorial fixes — all three applied in this revision: R1a moved under HIGH, Disproved #6 reworded to "~1.3–2× faster than current playback without adding temporal samples", 994.4 MiB labeled as on-disk inventory not runtime residency). Fable: author. Full argumentation trail: `docs/animation-chat.md`. Kimi's 00:11 draft superseded per Kimi's own request.*
