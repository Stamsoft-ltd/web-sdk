# Forest Gang — Animation Audit, Revision 2 (post-fix re-verification)

- **Date:** 2026-07-25
- **Author:** Fable
- **Branch:** `feature/forest-gang-v1` · **HEAD:** `3cdde5b`
- **Baseline:** `b14a73e` — the commit the three-agent audit (`docs/animation-audit-merged-with-rating.md`, Rev 3, ratified) was written against. Three commits landed after it on 2026-07-24: `81a1931` "redesign big and animations", `ab33fbc`, `3cdde5b`.
- **Method:** every ratified finding re-checked against the current file contents (not the diff hunks). Asset numbers re-measured from disk with a fresh scan. A separate sweep over `b14a73e..HEAD` looked for regressions introduced by the fix commits; each of its claims was then re-verified by hand before being recorded here. Items I could not re-verify from source in this pass are marked as such.

---

## TLDR

**The headline defect is fixed.** R1 — the `AnimatedSprite` frame-0 freeze that explained most of the "poor animation quality" feedback — is genuinely repaired in `packages/pixi-svelte`, and I verified the fix holds for every call site in this app. Texture memory dropped 3.6× (557.8 → 155.1 MiB decoded), the atlas that exceeded the GPU texture limit is now legal, the payline scale bug is a one-liner that got fixed, and the renderer now runs capped-DPR WebGL without MSAA.

**What is still open is the win presentation and the frame loop.** The linear 11-second count-up, the tier board that collapses to nothing up to four times mid-climax, the max-win hard cut, the double render loop, the per-win ticker leak, and the outro that hard-pops on first sight are all byte-for-byte unchanged. Six of the fifteen ratified majors are fixed or materially improved; nine are untouched.

**Four new problems came in with the fixes.** The asset shrink halved every animation sheet in both dimensions, so symbol animations now upscale roughly 2× on a retina desktop where they used to land near 1:1 — with antialiasing now off, that is the most likely thing a fresh reviewer would call "low quality" today. The raised `animationSpeed` values (0.36 / 0.4) divide neither the 60fps nor the 30fps render cadence, so frames are held for uneven numbers of rendered frames — a judder the old slow values did not have. The winning wild and scatter are wired to a pulse clock that explicitly excludes wild and scatter, so on a scatter bonus trigger the emblem sits frozen at a stale scale. And two rAF loops were left running with no consumer, one of them for the entire anticipation phase.

**Verdict: still BLOCK**, but the character of the block has changed. It was "the animations are frozen." It is now "the payoff moment is unchoreographed, the art is being upscaled, and the newest animation code has drivers wired to nothing."

---

## 1. Fixed since the audit (verified)

### R1 — AnimatedSprite freeze at frame 0. **FIXED.**
`packages/pixi-svelte/src/lib/components/AnimatedSprite.svelte:31-44`. `textures` is now added to `propsSyncEffect`'s ignore list and assigned in the play effect behind an identity guard instead, so an unrelated prop write (per-frame `y`, win-zoom `width`/`height`, the win `alpha` dim) no longer re-enters PIXI's `set textures` and its unconditional `gotoAndStop(0)`.

I checked that the guard actually holds here rather than trusting the diff: every call site in the app passes a `$derived` array, so the reference is stable between renders — `Board.svelte:76` (`winAnimTextures`), `:89-95` (`scatterFrames`, `wildFrames`), `:114` (`idleAnimTextures`), `ExpandedSymbolOverlay.svelte:61,76`, `ExpandedSymbolPresenter.svelte`, `BonusSymbolPanel.svelte`, `GameLogoFrame.svelte`. No inline array literal reaches a `textures=` prop anywhere in the app.

One caveat for the shared package, not for this game: the guard compares `props.textures !== animatedSprite.textures`, and PIXI only preserves that reference when the array holds bare `Texture` objects. A caller passing `FrameObject[]` (the `{texture, time}` form) gets a normalized internal array, the comparison never matches, and the freeze returns silently. Forest Gang passes `Texture[]` everywhere, so it is safe today; a sibling game using per-frame durations would not be. Worth a comparison on the source array instead.

### R1a — Payline vines drawn at the wrong scale. **FIXED.**
`Game.svelte:427` now reads `scale={{ x: bl.boardScaleX ?? bl.boardScale, y: bl.boardScaleY ?? bl.boardScale }}`, matching what the Board itself uses. The ~19px desktop drift at the outer reels is gone.

### R10 — Texture memory and oversized atlases. **LARGELY FIXED.**
Every animation sheet was re-exported at half resolution in both dimensions. Measured, decoded-RGBA:

| | Audit (`b14a73e`) | Now (`3cdde5b`) |
|---|---|---|
| JSON spritesheets | 33 | 34 |
| Decoded total | 557.8 MiB | **155.1 MiB** |
| `loading_bar.png` | 5992×560 (over the 4096 limit) | **2996×280** (legal) |
| `wolf_idle` frame | 337×360 | 168×180 |

The GPU-texture-limit violation is resolved. What remains: **five sheets are still shipped and never referenced by `assets.ts`** — `coin_rain_a`, `coin_rain_b` (8.2 MiB each), `MM_pressanywhere` (6.4), `rabbit_10_anim_sheet` (1.5), `MM_Localisation_winsmall` (1.0) = **25.3 MiB decoded, 1.8 MB on disk**, confirmed zero references under `src/`. There is still no `renderer.prepare` warm-up, so first-use upload stalls remain possible, though they matter far less at a quarter of the texture volume.

See **N1** below for the cost this paid.

### R4 — Temporal resolution. **MATERIALLY IMPROVED, not resolved.**
`animationSpeed` went from 0.14/0.25/0.26/0.28/0.3 to: scatter `0.36` (`Board.svelte:476`), wild `0.4` (`:492`), symbol wins `0.36` (`:535`), idles `0.28` plus a per-symbol jitter (`:611`). Effective playback is now roughly **17–24 fps** instead of 8–18. `Board.svelte:611` also adds a `startFrame` offset per (reel, symbol) so the idle loops no longer blink in lockstep — a genuinely good addition nobody asked for.

Unique frame counts did not increase, so the underlying decimation the audit identified is unchanged (wins 31–35 frames, idles 41–45, money 40). And the new values introduce a cadence problem — see **N2**.

### R12 — Per-frame Graphics re-tessellation. **ONE OF FOUR FIXED.**
`ForestBugs.svelte` (8 procedural bugs, ~200 path ops/frame during board wins) was deleted outright. `VineRope.svelte:49-52`, `WinBoard.svelte:141-153` and `ExpandedSymbolOverlay.svelte` still rebuild geometry per frame.

### R9 — Coin fountain re-init. **HALF FIXED.**
`WinCoins.svelte:43-54` now reduces the live count-up multiplier to a discrete `tierKey` before it reaches the emitter config, so the config object identity is stable within a tier. The fountain no longer risks re-initialising on count-up frames. It still re-inits — and therefore still destroys all live particles — on each tier crossing, and `WinBoard.svelte` still collapses the board (see R9 under open items).

### Renderer cost (was a LOW/architecture item). **FIXED.**
`Game.svelte:391`: `<App preloadWebFont={false} maxResolution={2} antialias={false} rendererPreference="webgl">`, plumbed through new optional props in `InitialiseApplication.svelte:22-24,46-50` that default to the old values so sibling games are unaffected. Uncapped `devicePixelRatio` and MSAA on mobile are both addressed. Clean, minimal change — this is the right shape for a shared-package edit.

### EnableSharedTicker hardening (partial credit).
`EnableSharedTicker.svelte:64-82` adds a hidden-tab pause and an idle cadence cap. The `isIdle` call it depends on does exist (`packages/utils-xstate/src/createXstateUtils.svelte.ts:21`), so the throttle engages. Its stated benefit is undercut by R2 — see **N3**.

---

## 2. Still open (verified unchanged)

Line numbers below are current.

### CRITICAL

**R2 — Scene rendered twice per frame.** `InitialiseApplication.svelte:38-53` still never passes `autoStart: false`, so the PIXI application's own ticker keeps running and rendering, while `EnableSharedTicker.svelte` walks the scene and calls `app.render()` again on its own rAF. (`Ticker.shared` is stopped at `:21`, but that is not the application's ticker — PIXI's `sharedTicker` option defaults to false. Source-verified during the original audit; `node_modules` is not installed here, so I could not re-open the library source this pass.)

This is now the biggest remaining structural item, and it has gotten *more* costly in relative terms: the new idle throttle only governs the manual loop. The application ticker still renders at the display's full rate, uncapped, on 120Hz panels too — so the comment at `:66-73` claiming the idle path "~halves idle GPU cost" is not what actually happens. See **N3**.

The audit's sequencing note still stands: `EnableSharedTicker` is accidentally load-bearing, so it must be deleted in the same change set that fixes R2/R3, never before.

### HIGH

**R3 — Ticker-listener leak per win.** `ParticleEmitter.svelte:39-47` still registers an anonymous `ticker.add(() => …)`; `onDestroy` at `:48-51` destroys the emitter but never removes the callback. `Win.svelte:126` still wraps the win subtree in `{#key oncomplete}` with `oncomplete` reassigned per win, so every win leaks one callback and rebuilds the whole subtree. Unchanged. Named callback + `ticker.remove` is a two-line fix.

**R5 — Art style inconsistency and reversed one-shots.** Ping-pong construction unchanged at `Board.svelte:82` and `:89`, `ExpandedSymbolOverlay.svelte:65,84`. Money and win clips still play forward-then-backward.

**R6 — Reel stop begins with a ~3.5× velocity spike.** `constants.ts:73-83`: `reelSpinSpeed: 2.3` hands off to `reelSpinSpeedBeforeBounce: 2.8` under `cubicOut`, whose initial derivative is 3× its average — an instantaneous ~8.4 px/ms, about a full symbol cell in one frame. The comment at `:70-72` was rewritten and now explains that the *old* value of 4 was too fast, but 2.8 is still greater than 2.3 and the easing discontinuity is unchanged. The comment reads as if the problem were solved; the numbers say it was reduced, not removed.

**R7 — No motion treatment on spinning reels.** `constants.ts:123` `MOTION_BLUR_VELOCITY = 31` is still exported and still referenced nowhere in `src/`.

**R8 — Hero win count-up is linear and overlong.** `WinCountUpProvider.svelte:29` still calls `countUpAmount.set(props.amount, { duration })` with no easing (Svelte `Tween` defaults to linear). `Win.svelte:122` still clamps to 400ms only for non-board wins, so big wins run full length even in super-turbo, and `winLevelMap.ts:96` LEGENDARY `presentDuration: 45 * SECOND` × 0.25 is still an **11.25-second linear climb** followed by a 3s auto-close hold (`Win.svelte:136`). Small/medium wins were changed from a quarter to a half of `presentDuration`, which is a real improvement for the common case; the tier that matters most is untouched.

**R9 — Tier crossings vanish the win board.** `WinBoard.svelte:41-56`: `pop.set(0, {duration: 180, easing: cubicIn})` then `pop.set(1, {duration: 340, easing: backOut})` on every tier change, wrapping glow + board + amount (`:143`). A slow big-win climb still fully disappears the hero board up to four times during its own climax. The emitter half of this is described under R9 in the fixed section.

**R11 — Turbo/skip dead time.** `bookEventHandlerMap.ts` still has 6 `waitForTimeout` sites in the same shape: raw at `:198` (190ms per reel), `:209` (650ms), `:406` (150ms); semi-gated at `:111` (600ms, skips only super-turbo); properly gated at `:297` and `:416-419`. Component side has drifted slightly but not improved: `DealItMultiplierPanel.svelte:134,137,139` raw 300/80/180 plus `:142,148` raced with `skipReveal` (900/260); `GlobalMultiplier.svelte:108,120` raw 170/280. `stateBet.svelte.ts:57` still returns `1.5` for both turbo and super-turbo, so the two modes remain indistinguishable to every spine.

**R12 — Remaining per-frame geometry.** `VineRope.svelte:49-52` rebuilds the full payline path, its extents and its mask every frame per win line, under a GlowFilter — only the mask rect actually depends on `progress`. `WinBoard.svelte:141-153` redraws 14 concentric circles every frame because `boardSize` (`:68`) folds in the breathing scale. `ExpandedSymbolOverlay.svelte` rebuilds its mask through the 460ms expansion.

**R13 — First bonus outro pops in unanimated.** `FreeSpinOutro.svelte:60` is still `let show = $state(true)` while the intro correctly uses `$state(false)` (`FreeSpinIntro.svelte:66`). The `$effect` at `:69-74` fires once at app launch and burns the 750ms entry tween while nothing is on screen; the first real `freeSpinOutroShow` sets `show = true` when it is already `true`, the effect never re-runs, and the summary hard-cuts in. The `show`-gated rAF clock at `:78-87` still runs from launch through the whole base game.

This one is still a single character, and this revision of the file rewrote the lines directly around it (`:57`, `:91-110`) without touching it. Related: the auto-advance timer was deliberately removed at `:100-108` in favour of waiting for a press, which is a stated design decision — but it means the very first summary a player sees both hard-pops *and* then sits there until they press.

**R14 — MaxWin hard-cuts in.** `Win.svelte:151-155` still swaps `MaxWinScreen` in place of the tier subtree the instant the live count crosses 25,000×, inside an already-visible `FadeContainer`. `MaxWinScreen.svelte:45-47` has no entrance of its own — only the inherited `breatheScale`. The game's largest possible moment still has the least choreography of any win tier.

### MEDIUM (all verified unchanged)

| Item | Location | Note |
|---|---|---|
| Particle time units | `ParticleEmitter.svelte:41-42` | `deltaMS × 0.00234` into a seconds API → 2.34× real time |
| CONGRATULATIONS pulse snaps on | `FreeSpinIntro.svelte:134`, `FreeSpinOutro.svelte:89` | free-running `sin(animT)` gated at `slideIn ≥ 0.99`, so it jumps to an arbitrary phase as the title lands |
| Splash carousel hard-cuts | `SplashIntro.svelte:39` | 3s `setInterval` block swap, no crossfade — first screen a player sees |
| Anticipation music duck | `Anticipations.svelte:32-38` | instant 10% step, restores a mount-time snapshot over any user change |
| Transition atlas misdeclared | `spines/transition/transition.atlas` | declares `size:1219,1042`; the webp measures **1215×1038** — Spine UVs sample against the wrong page size |
| Missing-asset fallback logging | `Particles.svelte:40`, `SpineProvider.svelte:69`, `Sprite.svelte:26`, `SpriteSheet.svelte:21` | `$state.snapshot(...)` deep-clone in a template block, re-runs through loading |
| Repo hygiene | — | 13 tracked `.pyc` (6 in `apps/chicken-crossing/__pycache__`, 7 in `tmp_fg_math/__pycache__`), **23 MB** `Forest Gang_Project/` at repo root, **15 MB** `old_assets/` (38 files) |
| Generator scripts inside the served tree | `static/assets/**` | **13 `.py` files, 69 KB**, shipped inside `static/` and therefore uploaded with the build |

### LOW (verified unchanged)

`ExpandedSymbolOverlay.svelte:155` `setTimeout(…, 460)` with no clear · `TransitionAnimation.svelte:37` failsafe timer · `FadeContainer.svelte` still carries both the `$effect` and the `onMount` path (the runtime claims against it stay disproved; this is cleanup only) · `SymbolWrap.svelte` still present with **zero** references · `console.info` at `bookEventHandlerMap.ts:137,230` on every All-In spin · **no `prefers-reduced-motion` guard anywhere** (0 matches in `src/`) · `PressAnywhereText.svelte:39` static at `alpha: 0.6` while the splash HTML label blinks · 25 `requestAnimationFrame` call sites across 11 components, still unconsolidated.

---

## 3. New findings from this revision

### N1 — The asset shrink halved every animation sheet, so symbols are now upscaled. **HIGH.**
The payload work did not re-export at a chosen target size; it scaled every sheet by exactly 0.5 in both axes. `wolf_idle` frames went 337×360 → **168×180**, `loading_bar` 856×80 → 428×40, and so on across all 34 sheets.

The rendered size did not change. On desktop the layout reference is 1422×800 (`constants.ts:54-60`) and `mainLayout.scale = min(canvasW/1422, canvasH/800)` (`packages/utils-layout/src/createLayout.svelte.ts:59-65`). A symbol cell is `SYMBOL_W` 121 × `boardScaleX` (`boardScale × H_SPREAD` = 1.05 × 1.12) ≈ 142 layout units. On a 1920×1080 viewport that is ≈ 192 CSS px, and at the newly-capped `devicePixelRatio` of 2 it is ≈ **384 device px** — drawn from a 168–186 px source frame. That is roughly a **2× upscale** where the previous 337 px source landed near 1:1.

Compounding it: `antialias: false` is now set, so upscaled sprite edges get no MSAA help either. This is a coherent, checkable explanation for a "still looks low quality" reaction on a retina display *even after* R1 unfroze the animations, and it was introduced by the same commits that fixed the memory problem.

The fix is not to revert — 557.8 MiB was untenable. It is to pick the export size from the actual on-screen device-pixel size per sheet rather than applying a uniform 0.5. Symbols need roughly 2× the CSS size at DPR 2; full-screen art (max-win plaque, backgrounds) can stay at 1×. Halving a 5992 px loading bar was correct; halving a 337 px symbol was not.

### N2 — The new `animationSpeed` values beat against the render cadence. **MEDIUM.**
PIXI advances `_currentTime += animationSpeed × deltaTime` and displays `floor(_currentTime)`. `EnableSharedTicker.svelte:84` passes `deltaFrames = ms / 16.6667`, and `:80` caps the loop at 30fps while the state machine is idle — which is exactly when the idle blinks and the scatter shimmer are the only things moving.

At 30fps, `deltaFrames` is 2.0, so the per-tick step is `2 × animationSpeed`:

| Sprite | `animationSpeed` | step/tick at 30fps | result |
|---|---|---|---|
| wild (`Board.svelte:492`) | 0.40 | 0.80 | every 5th animation frame is shown twice |
| scatter / wins (`:476`, `:535`) | 0.36 | 0.72 | uneven, repeat roughly every 3–4 ticks |
| idles (`:611`) | 0.28–0.31 | 0.56–0.62 | holds alternate between 1 and 2 rendered frames |

Only steps that are 1 or a unit fraction produce even pacing. Across both cadences the app actually uses (≈60fps active, 30fps idle) the beat-free values are **0.5 (30fps) and 0.25 (15fps)**; 0.36, 0.4 and 0.28 are in neither set. The comment at `Board.svelte:466-469` says 0.36 "stays under the 30fps idle render cap so no frames drop" — dropping is not the failure mode; the non-integer ratio is, and it produces exactly the micro-stutter the value was raised to eliminate.

Recommendation: use **0.5** for anything that should read as smooth (30fps playback, and every sheet has enough frames for it — a 41-frame ping-ponged idle at 0.5 is a 2.7s loop), or 0.25 where a slower loop is wanted. This costs nothing and is strictly better than either the old or the new values.

### N3 — The idle render cap cannot deliver its stated saving while R2 stands. **MEDIUM.**
`EnableSharedTicker.svelte:66-73` documents "~halves idle GPU cost" and "caps the active path at ~60 (was rendering ~120/s)" on ProMotion. Both claims describe the manual loop only. Because `InitialiseApplication` still starts the application ticker (R2), the application's own `app.render()` continues at the display's full rate — 120Hz included — no matter what the manual loop does. Idle GPU cost is not halved; the second render loop is simply throttled while the first one is not.

This is not a reason to revert the throttle: it becomes correct the moment R2 is fixed. It is a reason not to bank the saving until then, and to fix the comment so the next reader is not misled.

### N4 — The wild/scatter win pulse is wired to a clock that excludes wild and scatter. **HIGH.**
`Board.svelte:463` sets `specialPop = isWin ? letterPulse : 1`, and that value scales the winning scatter (`:474-475`) and wild (`:490-491`). But `letterPulse` (`:333`) is driven by `letterPulseT`, whose rAF clock (`:321-331`) only runs while `anyLetterWin` is true — and `anyLetterWin` (`:309-319`) explicitly excludes `WILD`, `SCATTER` **and** every entry in `HIGH_SYMBOLS_SET`:

```js
!HIGH_SYMBOLS_SET.has(sym.rawSymbol.name) &&
sym.rawSymbol.name !== 'WILD' &&
sym.rawSymbol.name !== 'SCATTER' &&
isWinState(sym.symbolState)
```

So on any win that contains no card letter — a scatter bonus trigger, a wild-only line, animals with wilds — the clock never starts and the emblems do not pulse at all. Worse than not animating: `letterPulseT` keeps whatever value the previous letter win left it at, so `letterPulse` evaluates to a frozen constant somewhere in [1.0, 1.1] and the scatter or wild renders at a stale scale up to 10% oversized for the duration of the win. Only on a fresh page, before any letter win, does the frozen value happen to be exactly 1.0.

The scatter-trigger case is the one that hurts — that is the moment the bonus is announced, and the emblem is inert.

**Fix:** give the special symbols their own win predicate (or drop the exclusions from `anyLetterWin` and rename it), so the clock runs whenever anything that uses `letterPulse` is winning.

### N5 — Two dead per-frame rAF loops, both running during the moments the audit cared about. **MEDIUM.**
Both were introduced by the recent commits, and both are driven work with no consumer:

- **Win pop** — `Board.svelte:248-278` maintains a `popStarts` Map and runs an rAF for up to `POP_T` seconds every time a WILD or SCATTER enters a win state, writing `popNow`. Its only reader is `popScale` (`:281-287`), and `popScale` is **never called anywhere in the file** (one occurrence: its own definition). The `$effect` also re-runs on every board symbol-state change to rebuild a `Set` and reconcile the Map. This is the leftover driver of the one-shot spring pop that `3cdde5b` replaced with the continuous pulse — the call site was removed, the machinery was not.
- **Anticipation bob** — `Board.svelte:292-303` runs an unthrottled rAF for the entire anticipation phase (the longest suspense window in the game) writing `anticT`. Its only reader, `anticZoom` (`:305`), is **never referenced in the template**. The comment at `:289-290` promises "the landed scatters bob with excitement and shimmer faster"; no scatter reads `anticZoom`, and no `animationSpeed` changes during anticipation. The behaviour was never wired up, and the clock burns frames waiting to be asked.

**Fix:** delete both blocks (`popNow`, `popStarts`, `POP_*`, `popScale`, `anticT`, `anticZoom`) — or wire `anticZoom` into the scatter if the bob is still wanted, which is what the comment implies was intended.

### N6 — `GlobalMultiplier` has a hardcoded flag that makes half the component unreachable. **LOW.**
`GlobalMultiplier.svelte:99` `const useFlatBoard = true;` is a constant, so every `else` branch is dead: the slide-out at `:106`, the slide-in at `:116-117`, and the `multiplierHand` sprite at `:177`. Consequently `groupX` (`:90`) can never leave 0, yet `:166` still reads `x={position.x + groupX.current}`, and `SLIDE` (`:33`), `HAND_W`/`HAND_H` (`:26-27`) are dead constants. The `multiplierHand` asset is still declared in `assets.ts:69` and still on disk (`multiplier_hand.png` 609 KB, `.webp` 62 KB) for a sprite that cannot render.

Not an animation defect — the reachable path (fade + oversized `groupScale` settling under `backOut`) is fine. It is payload and read-cost for nothing.

### N7 — Comments that describe behaviour the code does not have. **LOW, but corrosive.**
Several comments were left describing the pre-change behaviour, and they actively mislead:

- `Board.svelte:465-466` "Scatter … does one pop when it enters the win state" and `:482` "Animated WILD … one pop on a win" — the pop was replaced by the continuous pulse three lines earlier at `:461-462`, and the pop code no longer runs at all (N5).
- `Board.svelte:223` "Desktop keeps the tuned 1.1" — the very next line returns `isLandscape ? 1.25 : 1.0`, so desktop WILD is **1.0**.
- `Board.svelte:289-290` promises an anticipation bob that is not wired (N5).
- `EnableSharedTicker.svelte:66-73` claims a halved idle GPU cost that R2 prevents (N3).
- `constants.ts:70-72` implies the reel-stop handoff decelerates, when 2.8 > 2.3 still accelerates into the easing (R6).
- `GlobalMultiplier.svelte:86-87,101-102,172` describe per-layout slide/hand behaviour that `useFlatBoard` removed (N6).

Each of these is a comment asserting a fix that the code does not implement. That is the failure mode most likely to make the *next* audit — human or otherwise — mark something resolved when it is not.

---

## 4. Where this leaves the fix order

The audit's order still holds for what remains, minus the items now done. Roughly by impact ÷ effort:

1. **R13** — `FreeSpinOutro.svelte:60` → `$state(false)`. One character, fixes the first bonus summary every player sees.
2. **N4** — fix the wild/scatter pulse predicate. A few lines, and it restores animation to the bonus-trigger moment, which is currently inert.
3. **N5** — delete the two dead rAF loops (`popNow`/`popScale`, `anticT`/`anticZoom`) in `Board.svelte`. Pure deletion; removes per-frame work during wins and anticipation.
4. **N2** — set `animationSpeed` to 0.5 across the board sprites. Trivial edit, removes the judder the current values introduce.
5. **R2 + R3** — `autoStart: false` in `InitialiseApplication`, named ticker callback with `ticker.remove` in `ParticleEmitter`, drop `{#key oncomplete}` from `Win.svelte:126`, then delete `EnableSharedTicker` **in the same change set**. Removes the double render, the per-win leak and the per-win subtree rebuild together, and makes N3's saving real.
6. **R8 + R9 + R14** — the win payoff as one piece of work: a designed count curve instead of linear, trimmed big-tier duration, cross-fade between tiers with the pop reserved for the final one, live-mutated emitter intensity instead of `init()` per tier, and a real entrance for MaxWin. This is the largest remaining quality gap and the most-watched moment in the game.
7. **N1** — re-export sheets at their true on-screen device-pixel size instead of a uniform half. Restores symbol sharpness without giving back the memory win.
8. **R6** — velocity-continuous reel-stop handoff, and correct the `constants.ts:70-72` comment either way.
9. **R11** — one interruptible, turbo-scaled hold helper cancelled on `stopButtonClick`; give super-turbo its own `timeScale`.
10. **R12** — cache static geometry in VineRope / WinBoard / ExpandedSymbolOverlay; animate transforms and mask rects only.
11. **R10 tail + N6** — delete the 5 unreferenced sheets (1.8 MB on disk, 25.3 MiB decoded) and the unreachable `multiplierHand` asset; add `renderer.prepare` warm-up per wave.
12. **Hygiene + N7** — untrack the 13 `.pyc`, the 23 MB `Forest Gang_Project/`, the 15 MB `old_assets/`, and move the 13 `.py` generator scripts out of `static/`. Fix the transition atlas page size. Delete `SymbolWrap.svelte`, the dead `useFlatBoard` branches, and the two `console.info` calls. Correct the six stale comments in N7 — cheap, and it stops the next reviewer trusting a claim the code does not honour.
13. **R4 / R5 / R7** — regenerate sheets at higher unique frame counts, re-author to one art style with forward-playing one-shots, and add a reel motion treatment after mobile profiling. Largest effort, largest visual payoff, unchanged from the audit.

---

## Summary

| Ratified item | Status at `3cdde5b` |
|---|---|
| R1 AnimatedSprite freeze (CRITICAL) | **Fixed** |
| R2 double render / ticker (CRITICAL) | Open |
| R1a payline scale | **Fixed** |
| R3 ticker leak + per-win rebuild | Open |
| R4 temporal resolution | Improved (17–24 fps), not resolved; introduced N2 |
| R5 art style / ping-pong | Open |
| R6 stop velocity spike | Open |
| R7 motion blur | Open |
| R8 linear count-up | Open |
| R9 tier strobe | Emitter half fixed; board collapse open |
| R10 texture memory / atlas limits | **Largely fixed** (557.8 → 155.1 MiB); introduced N1 |
| R11 turbo / skip dead time | Open |
| R12 per-frame Graphics | 1 of 4 fixed (`ForestBugs` deleted) |
| R13 outro `$state(true)` | Open |
| R14 MaxWin hard swap | Open |
| MEDIUM (10) | All open; renderer DPR/MSAA item (LOW) fixed |
| LOW (11) | All open |

| New this revision | |
|---|---|
| N1 sheets halved → symbols upscaled ~2× | HIGH |
| N2 `animationSpeed` beats the render cadence | MEDIUM |
| N3 idle cap's stated saving blocked by R2 | MEDIUM |
| N4 wild/scatter pulse clock excludes wild/scatter | HIGH |
| N5 two dead per-frame rAF loops | MEDIUM |
| N6 `useFlatBoard` dead branches + unreachable asset | LOW |
| N7 six comments asserting fixes the code lacks | LOW |

**Counts:** of 15 ratified majors — **3 fixed** (R1, R1a, R10), **3 materially improved** (R4, R9, R12), **9 open**. Seven new findings introduced by the fix commits, two of them HIGH.

**What is clean.** I looked specifically for regressions in the new code and did not find them in three categories worth naming: no new `Graphics draw={}` callback closes over a per-frame value (all four new ones read layout-derived or constant inputs, so they do not re-tessellate); every new rAF returns `cancelAnimationFrame` and the new `unhandledrejection` listener in `StakeSync.svelte` is removed on teardown — the commits net-*removed* timers; and the new tweens in `DealItMultiplierPanel` and `GlobalMultiplier` all pass explicit `backOut`/`cubicIn` on their scale legs, with linear left only on alpha crossfades where it belongs.

**Verdict: BLOCK.** R1 was the right thing to fix first and it was fixed correctly — that removes the defect that explained most of the original feedback, and the memory and renderer work is solid. What remains splits in two. The old half is the win presentation from tier crossing through max win, plus the frame loop underneath it. The new half is a pattern worth naming: N4, N5 and N7 are all cases where animation machinery was written or rewritten and its wiring left incomplete — a driver with no consumer, a consumer on the wrong driver, a comment describing the intent rather than the result. Those are cheap to fix now and expensive to find later. R13, N4, N5 and N2 are together perhaps an hour of work and would remove two HIGH findings.

---

*Baseline: `docs/animation-audit-merged-with-rating.md` Rev 3 (three-agent ratified, 2026-07-23). Argumentation trail: `docs/animation-chat.md`. This revision is Fable's own re-verification against `3cdde5b` and has not been reviewed by Kimi or Sol.*
