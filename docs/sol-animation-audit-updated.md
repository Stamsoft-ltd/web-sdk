# SOL Animation Re-audit — Post-fix Update

- **Date:** 2026-07-25
- **Branch / HEAD:** `feature/forest-gang-v1` / `3cdde5b`
- **Compared with:** the ratified Rev 3 audit in `docs/animation-audit-merged-with-rating.md` and the post-audit changes in `81a1931`, `ab33fbc`, and `3cdde5b`
- **Scope:** `apps/forest-gang`, `packages/pixi-svelte`, `packages/components-pixi`, `packages/state-shared`, and `packages/utils-slots`
- **Author:** Sol

## Executive summary

A substantial amount has improved. The headline `AnimatedSprite` freeze is fixed, paylines now use the board's real per-axis scale, renderer settings are much safer on mobile, the oversized loading atlas is gone, sprite-sheet memory has fallen by roughly 73%, and the new animal win art is far more consistent with the idle art.

The game is nevertheless **not clear of the animation audit yet**. The scene is still rendered by two independent loops, the per-win particle ticker listener still leaks, default reel stops still begin with the verified velocity spike, one-shot actions still reverse through ping-pong playback, and the win-count/tier presentation defects remain. The first free-spin outro also still starts with `show = true`; its one-character fix did not land.

**Updated verdict: BLOCK, but materially improved.** The previous audit had 15 major findings. On the current tree: **2 are resolved, 4 are partially resolved, and 9 remain open**.

---

## What is demonstrably fixed

### 1. RESOLVED — AnimatedSprites no longer freeze when unrelated props change (old R1)

**Files:**
- `packages/pixi-svelte/src/lib/components/AnimatedSprite.svelte:31-43`

`textures` is now excluded from `propsSyncEffect`, guarded by reference equality, and followed by `gotoAndPlay()` when `play` is true. This removes the critical chain where a `y`, `alpha`, `width`, or `height` update reassigned PIXI's stateful `textures` property and stopped the sprite at frame 0.

This addresses the old audit's headline correctness failure. A small follow-up remains: a genuine texture-array identity change restarts at `startFrame` rather than preserving the current normalized frame, so a deferred merge can still produce a phase reset for runtime-built ping-pong arrays. That is a minor discontinuity, not the former permanent freeze.

### 2. RESOLVED — Payline vines use the board's actual scale (old R1a)

**File:** `apps/forest-gang/src/components/Game.svelte:424-429`

The payline container now uses `boardScaleX` and `boardScaleY`, matching the Board and expanded-symbol overlay. Board's previous desktop `+3px` nudge has also been removed, so there is no remaining offset discrepancy.

### 3. MAJOR PROGRESS — texture footprint and oversized loading atlas (old R10)

I rescanned every current spritesheet JSON and its declared dimensions:

| Scope | Previous audit | Current tree | Reduction |
|---|---:|---:|---:|
| All JSON sheets | 33 / 557.767 MiB | 34 / **155.123 MiB** | ~72% |
| Referenced by `assets.ts` | 28 / 483.766 MiB | 29 / **129.858 MiB** | ~73% |
| Deferred wave 0 | 282.287 MiB | **72.719 MiB** | ~74% |
| Unreferenced sheets | 5 / 74.002 MiB | 5 / **25.265 MiB** | ~66% |
| All on-disk images, decoded inventory | 994.445 MiB | **584.928 MiB** | ~41% |

`loading_bar.png` is now **2996×280**, down from 5992×560 and below the common 4096 texture limit. All 29 JSON sheets referenced by `assets.ts` declare dimensions matching their actual image, except the dead `freeSpins` sheet discussed below. The two 4600×500 files that remain are CSS-side HUD/navbar images, not Pixi atlases.

### 4. RESOLVED — safer renderer defaults for Forest Gang

**Files:**
- `apps/forest-gang/src/components/Game.svelte:386-392`
- `packages/pixi-svelte/src/lib/components/App.svelte`
- `packages/pixi-svelte/src/lib/components/InitialiseApplication.svelte:41-51`

Forest Gang now caps DPR at 2, disables MSAA, and requests WebGL. This fixes the old uncapped-DPR/antialias concern and should materially reduce fragment work on Retina Safari.

### 5. MAJOR PROGRESS — animal art consistency (part of old R5)

The new `*_win_v2` sheets were visually re-inspected against all five idle sheets. Character identity, clothing, rendering style, transparency, and close-up framing now match much better. The old “different costume / different scene / different character” criticism no longer fairly describes the board win animations.

The expanded “money” clips also retain the same characters and clothing. Their tall baked backgrounds remain less clean than the transparent board busts, but this is now a secondary presentation issue rather than a wholesale style break.

### 6. PARTIAL — animation cadence was improved (old R4)

Current key rates are:

- SCATTER: `0.36` → 21.6 frames/tick-second
- WILD: `0.4` → 24
- animal board wins: `0.36` → 21.6
- idle animals: `0.28–0.304` → 16.8–18.2
- free-spin medallion: `0.3` → 18
- expanded animals: `0.25` → 15
- deer presenter: `0.2` → 12

This is a clear improvement over the old 8–18 range, especially for SCATTER, WILD, and animal wins. The source sheets are still frame-decimated, however, and several hero clips remain at 12–18 unique fps. Source durations are still absent, so authored-speed accuracy cannot be claimed either way.

### 7. PARTIAL — some expensive/error-prone animation work was removed

- `ForestBugs.svelte` and its per-frame procedural bug drawing were deleted.
- The old near-miss timeout wobble was removed from `Board.svelte`, resolving that timing hazard.
- `VineRope.svelte` no longer combines a Pixi mask with a filter; it now uses plain layered geometry.
- The custom ticker now checks `document.hidden` before doing its own traversal/render.

These are useful improvements, though the remaining ticker and geometry issues below prevent full closure.

---

## Current blocking findings

### [CRITICAL] The scene is still rendered by two independent loops (old R2 — OPEN)

**Files:**
- `packages/pixi-svelte/src/lib/components/InitialiseApplication.svelte:41-51`
- `apps/forest-gang/src/components/EnableSharedTicker.svelte:21-98`

`app.init()` still does not pass `autoStart: false`. PIXI 8.8.1 therefore starts the application's private ticker and attaches its render listener. `EnableSharedTicker` separately schedules its own rAF, walks the full scene, advances sprites/spines, and calls `app.render()`.

The new 30fps-idle/60fps-active logic only throttles the custom loop; it does **not** throttle PIXI's application ticker. On a 120Hz display, the app ticker may still render around 120 times per second while the manual loop adds another 30 or 60 renders. Likewise, `document.hidden` pauses only the custom work, not the app ticker.

The comment that this app has “no continuous render loop” is contradicted by PIXI's current initialization.

**Fix:** use one animation/render clock. Now that old R1 is fixed, remove the scene-walking patch, restore normal sprite/Spine updates, and retain the application ticker—or explicitly disable the app ticker and migrate every ticker consumer, including emitters, to one controlled loop. Do not simply set `autoStart:false` while `ParticleEmitter` still depends on `app.ticker`.

### [HIGH] Particle ticker listeners still leak and the win subtree still remounts (old R3 — OPEN)

**Files:**
- `packages/pixi-svelte/src/lib/components/ParticleEmitter.svelte:39-52`
- `packages/pixi-svelte/src/lib/components/Particles.svelte:31-35`
- `apps/forest-gang/src/components/Win.svelte:126`

`ParticleEmitter` still adds an anonymous callback to `app.ticker` and destroys only the emitter. It never calls `ticker.remove`. `Win.svelte` still wraps the presentation in `{#key oncomplete}`, so every win destroys/recreates the subtree and adds another callback.

Destroyed emitters return early, so this is not hundreds of active particle simulations; it is an unbounded listener/closure list plus repeated presentation rebuilds and a ticker-failure surface. `Particles.svelte` has the same missing removal and remains a shared-package latent defect.

**Fix:** store and remove named callbacks in both shared components; replace `{#key oncomplete}` with explicit reset state.

### [HIGH] Default reel stops still begin with a velocity spike (old R6 — OPEN)

**Files:**
- `apps/forest-gang/src/game/constants.ts:73-83`
- `packages/utils-slots/src/createReelForSpinning.svelte.ts:278-309`

Default spin velocity remains 2.3px/ms, followed by a segment parameterized at 2.8px/ms with `cubicOut`. Because `cubicOut` starts at three times its average derivative, the handoff begins near 8.4px/ms—about 3.65× the incoming default velocity.

The comment still calls 2.8 “slower than” 2.3, which is incorrect even before applying the easing derivative.

**Fix:** derive the stop duration per spin mode from a velocity-continuity constraint. If retaining `cubicOut`, its average speed must be approximately incoming speed divided by three to match the initial derivative.

### [HIGH] One-shot clips still reverse and several hero animations remain low-cadence (old R4/R5 — PARTIAL)

**Files:**
- `apps/forest-gang/src/components/Board.svelte:60-94`
- `apps/forest-gang/src/components/ExpandedSymbolOverlay.svelte:50-84`
- `apps/forest-gang/src/components/ExpandedSymbolOverlay.svelte:209`
- `apps/forest-gang/src/components/ExpandedSymbolPresenter.svelte:322`

The art is much more consistent, but runtime arrays still append reversed frames. Money falling and character actions therefore play backward after reaching the end. Ping-pong is acceptable for a subtle idle/glint, but not for directional coin falls or one-shot acting.

Expanded animals remain at 15fps and the deer at 12fps. Do not blanket-retime without source duration; regenerate/re-author clips with more temporal samples, then set each rate from `animationSpeed = N / (60 × T_clip)`.

**Fix:** use `intro → held/loopable idle → outro`, or play directional clips once and hold a clean endpoint. Reserve ping-pong for genuinely reversible ambient motion.

### [HIGH] Spinning reels still have no motion treatment (old R7 — OPEN)

**File:** `apps/forest-gang/src/game/constants.ts:123`

`MOTION_BLUR_VELOCITY` remains unused, with no spin-state strip or filter. Fully sharp symbols still travel roughly a cell per 60Hz frame and can alias/strobe.

**Fix:** prefer pre-blurred spin-strip art; alternatively use a bounded vertical blur only while spinning and profile it on target mobile hardware.

### [HIGH] Hero count-up, tier collapse, and coin resets remain (old R8/R9 — OPEN)

**Files:**
- `packages/components-pixi/src/components/WinCountUpProvider.svelte:24-31`
- `apps/forest-gang/src/components/Win.svelte:125-137`
- `apps/forest-gang/src/components/WinBoard.svelte:37-55`
- `apps/forest-gang/src/components/WinCoins.svelte:35-85`
- `packages/pixi-svelte/src/lib/components/ParticleEmitter.svelte:34-36`

The count-up still uses Svelte's default linear easing. Big wins still run for 2.5–11.25 seconds and remain exempt from the turbo clamp, followed by a 3-second hold. Tier changes still collapse the board to zero before popping the next one, and every live tier-key change creates a new emitter config that calls `emitter.init()`, destroying the current fountain.

**Fix:** coordinate a designed count curve with tier timing, crossfade tier boards rather than fully vanishing them, and mutate emitter intensity without reinitializing live particles.

### [HIGH] Asset residency remains high, and 29.523 MiB of referenced sheets are currently dead (old R10 — PARTIAL)

**Files:**
- `apps/forest-gang/src/game/assets.ts:299-360,374-458`
- `packages/pixi-svelte/src/lib/components/AssetsLoader.svelte:116-140`
- `apps/forest-gang/src/components/Board.svelte:60-83`
- `apps/forest-gang/src/components/ExpandedSymbolOverlay.svelte:68-84`

The 73% reduction is excellent, but all deferred waves are still streamed and retained; there is no feature-demand unload or `renderer.prepare` upload warm-up. The referenced sheet pool remains 129.858 MiB before static textures, render targets, Spine pages, or duplicate CPU-side decode.

Eight referenced JSON sheets are not actually rendered:

- five letter-win sheets: **20.424 MiB** total; Board and ExpandedSymbolOverlay still derive them, but low-symbol win branches render static pulsing tiles
- `coins` (`SD2_Coin`): **5.354 MiB**; the fountain uses only `pCoins`
- `freeSpins`: **3.488 MiB**; no component consumes the key
- `progressBar`: **0.257 MiB**; LoadingScreen uses `loadingBarAnim`

Removing these lowers the referenced sheet pool to about **100.335 MiB** and wave 0 from 72.719 to about **46.941 MiB**, without a visual change.

**Fix:** remove the eight dead references first, then add feature-demand residency/unload and post-wave upload prewarming.

### [HIGH] Turbo/skip dead time remains (old R11 — OPEN)

**Files:**
- `apps/forest-gang/src/game/bookEventHandlerMap.ts:111,198,209,297,406,419`
- `apps/forest-gang/src/components/DealItMultiplierPanel.svelte:134-149`
- `apps/forest-gang/src/components/GlobalMultiplier.svelte:108-120`
- `packages/state-shared/src/stateBet.svelte.ts:57`

The expansion still has raw 190ms-per-reel and 650ms holds, followed by a raw 150ms beat. Deal It's initial 300/80/180ms reveal phase is intentionally unskippable, and GlobalMultiplier still has raw 170/280ms holds. Turbo and super-turbo Spine time scales are both 1.5.

Some holds are correctly gated or raced, and the latest Deal It values are slightly shorter than the old audit, but the central issue remains.

**Fix:** one turbo-scaled, interruptible hold helper wired to `stopButtonClick`, plus a distinct super-turbo Spine rate.

### [HIGH] First free-spin outro still skips its first entrance (old R13 — OPEN)

**File:** `apps/forest-gang/src/components/FreeSpinOutro.svelte:60-91`

`show` is still initialized to `true`. Its entry tween and pulse clock start at app mount before outro data exists; the first real `freeSpinOutroShow` is then `true → true`, so the entry does not retrigger.

**Fix:** initialize `show` to `false`. This remains the original one-character fix.

### [HIGH] MAX WIN still hard-swaps without an entrance (old R14 — OPEN)

**Files:**
- `apps/forest-gang/src/components/Win.svelte:150-158`
- `apps/forest-gang/src/components/MaxWinScreen.svelte`

At 25,000×, the normal tier subtree is conditionally replaced by `MaxWinScreen` inside an already-visible parent. The new art and dedicated sound improve the moment, but there is still no visual entrance; the game's highest tier hard-cuts in.

**Fix:** trigger a dedicated threshold entrance—flash/overshoot/crossfade—when MAX WIN becomes active.

---

## Remaining medium / maintenance findings

1. **Per-frame geometry remains, partially reduced.** `VineRope.svelte:60-83` clears and strokes four paths plus a comet every draw frame; `WinBoard.svelte:145-154` rebuilds 14 glow circles as `boardSize` breathes; `ExpandedSymbolOverlay.svelte:217-233` rebuilds its frame during expansion. ForestBugs removal is a win, but old R12 is only partially closed.
2. **Particle time units remain wrong.** `ParticleEmitter.svelte:41-43` still passes `deltaMS × 0.00234` to a seconds-based API (~2.34× real time). Fix to `deltaMS * 0.001 * (emitSpeed ?? 1)` and retune configs.
3. **Transition asset is still mislabeled/off-theme and misdeclared.** `transition.atlas` still declares 1219×1042 while `transition.webp` is 1215×1038. Region names are dust/rocks/coins/sparks despite source comments calling it a forest-leaf wipe.
4. **Animation clocks remain fragmented.** The manual scene rAF coexists with the app ticker, Svelte's tween loop, Board clocks, intro/outro clocks, payline clocks, and presenter clocks. Consolidation remains advisable after removing the duplicate-render architecture.
5. **CONGRATULATIONS still snaps into its pulse.** Both intro and outro gate a free-running sine at `slideIn.current >= 0.99`, so scale can jump at settle.
6. **Splash portrait slides still hard-cut.** `SplashIntro.svelte:39` changes the block every three seconds without a crossfade.
7. **Anticipation ducking still restores a stale volume snapshot.** `Anticipations.svelte:32-38` directly writes the preference and can overwrite a user volume change.
8. **No animation regression or reduced-motion coverage exists.** No timestamped visual snapshots, frame-budget tests, atlas validation test, or `prefers-reduced-motion` path was found.
9. **Shared missing-asset fallbacks still snapshot/log the full asset map.** Present in `Sprite`, `SpriteSheet`, `SpineProvider`, and `Particles`.
10. **Dead code/repo hygiene remains.** `SymbolWrap.svelte`, dead `AmountFadeProvider` alpha, unused `_`/`sequence` imports, dead `card-icon-swing`, normal-flow diagnostics, tracked design/source directories, and tracked Python cache files remain.
11. **Timers still need teardown in a few components.** `TransitionAnimation`'s failsafe/hold and `ExpandedSymbolOverlay`'s delayed pop can write after teardown.
12. **FadeContainer remains redundant but not runtime-broken as previously alleged.** Its competing `$effect`/`onMount` paths should be simplified; the old flash/double-completion/ignored-duration claims remain disproved.

---

## Asset-validation results

- **150/150** literal paths in `assets.ts` exist.
- **31** JSON sheets have matching declared/actual dimensions.
- **3** JSON sheets have mismatches:
  - referenced but unused `freeSpins.json`: declares 932×981, actual 928×979
  - unreferenced `MM_pressanywhere.json`: declares 1748×960, actual 1744×918
  - unreferenced `MM_Localisation_winsmall.json`: declares 512×520, actual 510×516
- Transition Spine page mismatch remains: declared 1219×1042, actual 1215×1038.
- No current Pixi atlas exceeds 4096px. The two remaining 4600px images are CSS-side files.
- `git diff --check b14a73e..HEAD` passes.

Build, lint, and `svelte-check` could not be run because `pnpm` and installed dependencies are absent in this environment.

---

## Updated order of attack

1. **Remove the duplicate render architecture** while preserving a single functioning ticker for sprites, Spine, and emitters.
2. **Remove particle ticker listeners on destroy** and replace `{#key oncomplete}` with explicit reset state.
3. Apply the two correctness/continuity quick wins: **`FreeSpinOutro show=false`** and velocity-continuous reel stopping.
4. Remove the **eight dead referenced sheets** (~29.5 MiB), then add demand-based residency/prewarm.
5. Stop ping-ponging directional actions; re-author/hold endpoints and measure per-clip cadence.
6. Redesign the big-win count curve, crossfade tier boards, and stop emitter reinitialization.
7. Make all sequence holds turbo-scaled/interruptible and differentiate super-turbo.
8. Add MAX WIN entrance choreography and reel motion treatment.
9. Cache remaining static graphics and consolidate clocks.
10. Add deterministic visual/performance/atlas/reduced-motion tests.

## Review summary

| Severity | Count | Status |
|---|---:|---|
| CRITICAL | 1 | block |
| HIGH | 9 | block |
| MEDIUM | 12 | info |
| LOW | 0 | note |

**Verdict: BLOCK — much improved, but the duplicate render loop and remaining HIGH animation defects should be fixed before considering the audit closed.**
