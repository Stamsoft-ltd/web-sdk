# Forest Gang — Post-Fix Animation Audit, Round 2, Rated by Agent Agreement

- **Date:** 2026-07-25
- **Branch / HEAD:** `feature/forest-gang-v1` @ `3cdde5b` · **Baseline:** `b14a73e` (the tree the ratified Rev 3 audit was written against)
- **Post-audit commits under review:** `81a1931` "redesign big and animations", `ab33fbc`, `3cdde5b` "fixes and improves"
- **Author:** Opus (designated), incorporating the full discussion in `docs/animation-chat-2.md`
- **Agents:** **[O]** Opus · **[K]** Kimi · **[S]** Sol — source audits in `docs/fable-animation-audit-v2.md` (Opus), `docs/kimi-animation-audit-v2-post-fix-review.md`, `docs/sol-animation-audit-updated.md`
- **Predecessor:** `docs/animation-audit-merged-with-rating.md` (Rev 3, ratified). R-numbers below refer to it.
- **Rating rule:** an item counts an agent when that agent raised it **or** independently verified and agreed in the chat. Every disputed claim was re-checked against source, `git`, the library implementation, or a re-measurement of the assets before counting. Commit messages and code comments were treated as claims, not evidence.

> **Note on `docs/animation-audit-merged-2.md`:** it does not exist. All three agents checked. This document is written directly from the three v2 audits and the discussion thread — in round 1 the merged doc proved a lossy intermediate whose every claim had to be re-verified anyway, and three of its attributions were fabricated (Rev 3, Disproved #12).

---

## Headline

**The #1 finding is fixed, and fixed in the exact shape the consensus prescribed.** R1 — the `AnimatedSprite` frame-0 freeze that explained most of the original "poor quality" feedback — is repaired, and all three agents independently verified that the fix holds at every call site in this app. Payline scaling is fixed. Texture memory fell 73%. The oversized atlas is legal. Renderer settings are now safe on mobile. The new animal art is a genuine style improvement.

**Nothing in the win presentation changed.** R8, R9, R13, R14, R3, R2, R6, R7 are open, most of them byte-identical to the baseline. The single-character outro fix did not land.

**Four defects arrived with the fixes**, and one pattern connects them: animation machinery was written or rewritten and its wiring left incomplete — a driver with no consumer (N5), a consumer on the wrong driver (N4), art resampled below its display size (N1), and playback rates that beat against a newly-added render cap (N2).

**Verdict: BLOCK — unanimous.** Materially improved, not clear.

---

## ✅ Items with 3 agreeing agents

### FIXED — verified by all three

**R1. AnimatedSprite freeze at frame 0 on any prop change.** [O, K, S]
`packages/pixi-svelte/src/lib/components/AnimatedSprite.svelte:31-44` — `textures` added to `propsSyncEffect`'s ignore list, assigned in the play effect behind an identity guard, play state restored in the same run. Exactly the prescribed fix. All three agents separately confirmed every forest-gang call site passes a `$derived` array (`Board.svelte:75,89,95,114`, `ExpandedSymbolOverlay.svelte:61,77`, `ExpandedSymbolPresenter`, `BonusSymbolPanel`, `GameLogoFrame`), so the reference stays stable and the guard holds. No inline array literal reaches a `textures=` prop anywhere in the app.
*Residual (LOW, shared package):* a genuine texture-array swap restarts at `startFrame` rather than preserving the current frame. Acceptable — real swaps are rare (deferred asset waves) and a frame-0 restart beats a permanent freeze.

**R1a. Payline vines drawn at the wrong scale.** [O, K, S]
`Game.svelte:427` — `scale={{ x: bl.boardScaleX ?? bl.boardScale, y: bl.boardScaleY ?? bl.boardScale }}`. The prescribed one-liner. Board's old desktop `+3px` nudge is also gone, so no offset discrepancy remains [S].

**R10a. Texture downscale and the 4096 atlas-limit violation.** [O, K, S — three independent scans, agreeing to three decimals]

| | Rev 3 (`b14a73e`) | Now (`3cdde5b`) |
|---|---:|---:|
| All JSON sheets | 33 / 557.767 MiB | 34 / **155.123 MiB** |
| Referenced by `assets.ts` | 28 / 483.766 MiB | 29 / **129.858 MiB** |
| `DEFER_WAVE_0` | 282.287 MiB | **72.719 MiB** |
| All on-disk images, decoded inventory | 994.445 MiB | **584.928 MiB** |
| `loading_bar.png` | 5992×560 (over the limit) | **2996×280** (legal) |

No current Pixi atlas exceeds 4096. The two remaining 4600×500 files (`navbar/bar.webp`, `hud_frame.webp`) are CSS-side HUD images — a decoded-memory concern, not a GPU-atlas violation [S].

**Renderer configuration.** [O, K, S] `Game.svelte:391` — `<App preloadWebFont={false} maxResolution={2} antialias={false} rendererPreference="webgl">`, plumbed through new optional props in `InitialiseApplication.svelte:22-24,46-50` that default to the historical values so sibling games are unaffected. Closes Rev 3's uncapped-DPR + MSAA LOW item.

**Near-miss wobble timing hazard.** [K, S raised; O verified and corrected its own omission]
The `setTimeout(280)` is gone. `Board.svelte` now has one `setTimeout`, at `:366`, an 80 ms expanded-symbol reveal with proper `clearTimeout` teardown.

**R5a. Art-style consistency (the split half that is fixed).** [S visually inspected; O confirmed; K accepted on method]
The new `*_win_v2` sheets match the idle sheets in character identity, clothing, rendering style, transparency and framing. Rev 3's "reads as a different character" no longer fairly describes the board wins. *This is the round's only claim resting on visual inspection rather than source* — flagged as such by Kimi, and accepted because two agents inspected independently and converged.

**R12a. `ForestBugs.svelte` deleted.** [O, K, S] The worst per-frame offender (8 procedural bugs, ~200 path ops/frame, mounted during board wins) is gone entirely.

---

### OPEN — CRITICAL

**R2. The scene is still rendered by two independent loops.** [O, K, S]
`InitialiseApplication.svelte:38-53` still never passes `autoStart: false`, so PIXI starts the application's private ticker and attaches its render listener; `EnableSharedTicker.svelte` separately schedules its own rAF, walks the scene, and calls `app.render()` again. `Ticker.shared.stop()` at `:21` does not touch the app ticker (`sharedTicker` defaults to false).

The hardening added this round is real — per-node `try/catch`, guarded walk, guarded render, `document.hidden` pause, cleanup on destroy — and closes the ticker-death hazard *inside the manual loop*. It does not close the defect.

**Two comment claims are false and were flagged by all three agents.** `EnableSharedTicker.svelte:10-11` says the app "renders reactively (no continuous render loop)" [K]. `:66-73` claims the idle cap "~halves idle GPU cost" and "caps the active path at ~60" on ProMotion [O as N3, S, K] — it cannot, because the throttle governs only the manual loop while the app ticker renders uncapped at panel rate, 120 Hz included. `document.hidden` likewise pauses only the custom work.

**Agreed fix — Sol's plan, adopted over Opus's earlier four-step** [S authored; O and K accepted]. The invariant is **one ticker/update/render owner**, not any particular edit:

1. Keep the auto-started **application ticker** as the single owner.
2. Replace `EnableSharedTicker`'s private rAF with one guarded `advance(stage, ticker.deltaTime, ticker.deltaMS/1000)` listener on `app.ticker`, registered at a priority above PIXI's render listener (`TickerPlugin` adds `app.render` at `UPDATE_PRIORITY.LOW`). No `requestAnimationFrame`, no `app.render()` call, no second render.
3. Keep emitter updates on `app.ticker`, but make the callbacks named, guarded, and removed on teardown; drop `{#key oncomplete}` (this is R3).
4. Apply the activity cap via `app.ticker.maxFPS` (30 idle / 60 active) so update and render cadence stay unified. Add visibility start/stop if wanted.

**`Ticker.shared` must stay stopped under this plan** [K]. pixi-svelte's `AnimatedSprite` is constructed with PIXI's default `autoUpdate: true`, which registers it on `Ticker.shared` — so restarting shared would double-advance every board sprite. The `advance()` listener in step 2 is not an optimisation; it *is* the sprite clock.

Fully migrating everything to a custom ticker is the viable alternative endpoint, but is a larger design and should not be the default [S].

**Sequencing requirement — do not skip this.** [S raised; K amplified; O conceded that its published fix order would have shipped the bug]
`ParticleEmitter.svelte:38-46` drives `emitter.update()` from `context.stateApp.pixiApplication.ticker` — the app ticker. Passing `autoStart: false` without first migrating emitter drive **freezes the coin fountain mid-presentation**. And because `TickerPlugin` registers `app.render` on that same ticker, `autoStart: false` also removes one of the two render paths, so the manual loop cannot be deleted in the same change set either. The two halves are load-bearing for each other until the migration above is done.

---

### OPEN — HIGH

**R3. Particle ticker listeners leak per win; the win subtree remounts per win.** [O, K, S — all verified unchanged]
`ParticleEmitter.svelte:39-47` adds an anonymous `ticker.add(() => …)` and `onDestroy` (`:48-51`) destroys only the emitter, never calling `ticker.remove`. `Win.svelte:126` still wraps the presentation in `{#key oncomplete}` with `oncomplete` reassigned per win → one leaked closure plus a full destroy/recreate every win. `Particles.svelte:31-35` has the same missing removal (shared-package latent defect; unused by forest-gang).
*Severity note [K]:* with R1 fixed, these leaked closures are now the only non-render listeners on the unguarded app ticker — the ticker-death hypothesis has exactly one live candidate site left. **Fix:** named callbacks + `ticker.remove` in both components; explicit reset state instead of `{#key oncomplete}`. Lands together with R2.

**R6. Reel stops begin with a 3.65× velocity spike.** [S raised; O and K each derived it independently from the shared package — three derivations, one number; considered settled]
```js
// createReelForSpinning.svelte.ts:134-148
const duration = distance / speed;              // speed unit: px/ms
await reelY.set(targetY, { duration, easing });
// normalSpin() :281-296 — leg 1 speed 2.3 linear; leg 2 speed 2.8 with cubicOut
```
`duration = distance / 2.8` makes the second leg's **average** velocity 2.8 px/ms; `cubicOut` is `f(t) = 1 − (1−t)³` with `f'(0) = 3`, so the instantaneous handoff velocity is **8.4 px/ms against 2.3 incoming — 3.65×**. At 8.4 px/ms a symbol travels 140 px in one 16.67 ms frame; `SYMBOL_H` is 103. **The reel jumps more than a full cell in the first frame of its "deceleration."**
The comment at `constants.ts:70-72` still calls 2.8 "slower than" 2.3 — the claim that let this survive two audits.
**Fix** [O proposed, K refined, S's constraint]: if `cubicOut` is kept, the segment's average must be `incoming / 3` ≈ **0.77**, not 2.8. **But do not swap the constant alone** [K]: at 0.77 the leg's duration becomes `distance/0.77`, ~3.6× longer, trading the spike for a visible crawl. Derive *both* duration and the easing's endpoint velocity from the incoming speed — that is what "velocity-continuous handoff" means.

**R7. No motion treatment on spinning reels.** [O, K, S] `constants.ts:123` `MOTION_BLUR_VELOCITY = 31` still exported, still referenced nowhere; no spin-state art. Fully sharp strips travel ~a cell per 60 Hz frame and alias. **Fix:** pre-blurred spin-strip art, or a bounded vertical blur while spinning — profile on target mobile first [S].

**R8. Hero win count-up is linear and overlong.** [O, K, S]
`WinCountUpProvider.svelte:29` — `countUpAmount.set(props.amount, { duration })`, no easing, Svelte `Tween` defaults to linear. `Win.svelte:122` clamps to 400 ms only when `!hasBoardAnimation`, so big-win counts run full length even in super-turbo. `winLevelMap.ts:96` LEGENDARY `presentDuration: 45 * SECOND` × 0.25 = an **11.25-second linear climb**, followed by a 3 s auto-close hold (`Win.svelte:136`).
Small/medium wins moved from a quarter to a half of `presentDuration` this round — a real improvement for the common case; the tier that matters most is untouched.
**Fix:** a designed count curve coordinated with R9's tier choreography (a bare `cubicOut` would bunch tier crossings early and make R9 worse), plus a big-tier duration trim.

**R9. Tier crossings vanish the win board; the fountain resets per tier.** [O, K, S — **no post-audit change whatsoever**]
`WinBoard.svelte:41-56` — `pop.set(0, {duration:180, easing:cubicIn})` then `pop.set(1, {duration:340, easing:backOut})` on every tier change, wrapping glow + board + amount (`:143`). A slow big-win climb fully vanishes the hero board up to 4× during its own climax. `WinCoins.svelte` reduces the live multiplier to a discrete `tierKey`, so `emitter.init()` fires per tier change rather than per frame — and `init()` begins with `cleanup()`, destroying all live particles, so the fountain pops at the same moments.
**Correction [S], accepted by O:** `WinCoins.svelte` is byte-identical to `b14a73e` — the `tierKey` discretization was already there. Two agents credited a fix that never happened; see Disproved #1.
**Fix:** cross-fade tier art with the pop reserved for the final tier; mutate emitter intensity props live, never re-`init` mid-fountain.

**R13. First bonus outro pops in unanimated; its rAF clock runs from launch.** [O, K, S]
`FreeSpinOutro.svelte:60` — `let show = $state(true)` while the intro correctly uses `$state(false)` (`FreeSpinIntro.svelte:66`). The `$effect` at `:69-74` fires once at app launch and burns the 750 ms entry tween with nothing on screen; the first real `freeSpinOutroShow` sets `true → true`, the effect never re-runs, and the summary hard-cuts in. The `show`-gated rAF clock at `:78-87` runs all session.
**Aggravating factor this round** [O raised, K confirmed]: the auto-advance timer was deliberately removed (`:100-108` now waits on a press), so the first summary a player ever sees both hard-pops *and* then sits until acknowledged. This revision edited the lines immediately around `:60` without changing it.
**Fix:** `$state(false)`. One character.

**R14. MaxWin (25,000×) hard-cuts in with no entrance.** [O, K, S]
`Win.svelte:151-155` conditionally swaps `MaxWinScreen` in place of the tier subtree inside an already-visible `FadeContainer` the moment the live count crosses the threshold. `MaxWinScreen.svelte:45-47` has no entrance of its own — only the ambient `breatheScale`. New art and a dedicated sound improve the moment; they do not give it a transition. The game's biggest moment still has the least choreography of any tier.

**R5b. Directional one-shots still play backwards (the split half that is open).** [S, K, O]
Ping-pong construction unchanged at `Board.svelte:82,89` and `ExpandedSymbolOverlay.svelte:65,84`. Money falls and character actions reverse after reaching the end. Ping-pong is fine for subtle ambient idle motion [K's round-1 scoping, retained]; it is wrong for directional coin falls and one-shot acting.
**Fix:** `intro → held/loopable idle → outro`, or play directional clips once and hold a clean final frame.

**R10b. 29.523 MiB of *referenced* sheets are never rendered.** [S raised; O reproduced to three decimals; K confirmed and extended]
Eight keys are loaded, decoded, wave-prioritised, and drawn by nothing:

| key | decoded | why dead |
|---|---:|---|
| `qWinAnim` | 5.260 MiB | letter wins render a static tile |
| `kWinAnim` | 4.413 MiB | ″ |
| `aWinAnim` | 4.287 MiB | ″ |
| `tenWinAnim` | 4.095 MiB | ″ |
| `jWinAnim` | 2.369 MiB | ″ |
| `coins` (`SD2_Coin`) | 5.354 MiB | fountain uses `pCoins` |
| `freeSpins` | 3.488 MiB | no consumer |
| `progressBar` | 0.257 MiB | LoadingScreen uses `loadingBarAnim` |

Mechanism, `Board.svelte:508-518`: the guard `{:else if isWin && winAnimTextures[name]}` **passes** for T/A/J/K/Q because `winAnimTextures` (`:75-85`) builds entries for all of `WIN_ANIM_KEY` including the letters — trimmed by `LETTER_WIN_TRIM_*` and ping-ponged — and then the inner `{#if HIGH_SYMBOLS_SET.has(name)}` sends letters to the `{:else}`, which draws a static `Sprite`.

**Extensions [O, K]:** the same five sheets are ping-ponged a second time by `ExpandedSymbolOverlay.svelte:77` `lowAnimFrames`, which is referenced **exactly once — at its own declaration**. So the cleanup is not only eight asset entries: `WIN_ANIM_KEY`'s letter entries, `LOW_WIN_ANIM_KEY`, and `lowAnimFrames` must go too, or the next person re-adds the assets to satisfy the code.

**Sharpening [O]:** `DEFER_WAVE_0` (`assets.ts:412-419`) is the set the loader explicitly races to the front of the queue so a first base-game win has its art ready (comment at `:408-411`). **25.778 MiB of that 72.719 MiB wave — 35.4% — is never rendered.** It is not only wasted residency; it is wasted bandwidth at the highest priority, delaying the idle blinks and animated wild/scatter queued alongside it. Deleting the eight references drops the referenced pool to **100.335 MiB** and `DEFER_WAVE_0` to **46.941 MiB**, with no visual change.

**N1. The asset shrink was a uniform 0.5 resample; symbols are now upscaled 2.3–3.4× on screen.** [O raised; K confirmed independently; S confirmed and corrected the math]
Every sheet was scaled by exactly 0.5 in both axes — `wolf_idle` 2359×2160 → 1180×1080 (frame 337×360 → **168×180**), `loading_bar` frame 856×80 → 428×40. Rendered size did not change.

Layout chain, verified by all three [O derived, S confirmed]: at 1920×1080, `mainLayout.scale = min(1920/1422, 1080/800) = 1.350`; desktop padding `{76,220,150,208}`; `availableCanvasHeight = max(556.2, 854) = 854`; `getBoardScale() = max(1, min(1.5354, 1.8267)) = 1.5354`; `boardScale = 1.6122`; `boardScaleX = 1.8057`; `<Board/>` sits inside `<MainContainer>`, which applies `scale={mainLayout.scale}` (`MainContainer.svelte:37-46`).

**Authoritative figures — Sol's per-template calculation** (Opus's full-cell approximation is superseded; see Disproved #7):

| sprite | source frame | target device px @ DPR 2 | upscale |
|---|---|---:|---:|
| wolf idle | 168×180 | ~504×536 | **3.00×** |
| WILD | 112×112 | ~385×346 | **3.09–3.43×** |
| SCATTER | 168×153 | ~459×418 | **2.73×** |
| wolf win v2 | 186×160 | ~435×372 | **2.34×** |

Pre-shrink these were essentially native (1.0–1.3×). **And it gets worse on better hardware:** `getBoardScale()` grows with available canvas, so a larger monitor increases the upscale factor — the opposite of the usual "looks fine on my machine" failure, and precisely the setup an external reviewer is likely to use.

**Fix:** not a revert — 557.8 MiB was untenable and halving a 5992 px loading bar was strictly correct. A uniform 0.5 is the wrong operator: right for the loading bar, wrong for a 337 px symbol. Size each export from its actual on-screen device-pixel target (symbols need ~2× their CSS size at DPR 2; full-screen art can stay at 1×).

**N4. The winning wild and scatter are driven by a clock that explicitly excludes wild and scatter.** [O raised; K and S each verified independently]
`Board.svelte:463` — `{@const specialPop = isWin ? letterPulse : 1}` scales the winning SCATTER (`:474-475`) and WILD (`:490-491`). `letterPulse` (`:333`) is driven by `letterPulseT`, whose rAF (`:321-331`) runs only while `anyLetterWin` (`:309-319`) is true:
```js
!HIGH_SYMBOLS_SET.has(sym.rawSymbol.name) &&
sym.rawSymbol.name !== 'WILD' &&
sym.rawSymbol.name !== 'SCATTER' &&
isWinState(sym.symbolState)
```
On a scatter bonus trigger, a wild-only line, or animals-plus-wilds, the clock never starts. And `letterPulseT` retains its value from the previous letter win, so `letterPulse` evaluates to a frozen constant in [1.0, 1.1] — the emblem renders at a stale scale, up to 10% oversized, for the whole win.

**Framing [K], adopted:** this is *silent state leakage between wins* — the emblem's scale depends on when some earlier, unrelated win's clock happened to stop. That reads as random rather than as a missing animation.

The scatter-trigger case is the one that hurts: the loudest moment in a slot, and the emblem is inert. Same defect class as R1 (driver and consumer on different conditions), introduced by the commits that fixed R1.
**Fix:** give the special symbols their own win predicate, or drop the exclusions and rename `anyLetterWin`.

---

### PARTIAL / MEDIUM — 3-agent

**R4. Temporal resolution — PARTIAL, not fixed.** [S and O explicit; K rated "materially improved", agreeing in substance]
Rates rose from 0.14/0.25/0.26/0.28/0.3 to: scatter `0.36` (`Board.svelte:476`), wild `0.4` (`:492`), symbol wins `0.36` (`:535`), idles `0.28` + per-symbol jitter (`:611`), medallion `0.3`, expanded animals `0.25`, deer presenter `0.2`. Effective ≈ **12–24 fps**, up from 8–18. `Board.svelte:611` also adds a `startFrame` offset per (reel, symbol) so idle loops no longer blink in lockstep — a good unrequested addition.

**Why not FIXED:** unique frame counts did not increase (wins 31–35, idles 41–45, money 40). The decimation Rev 3 named is untouched; what changed is playback rate — which Rev 3's Disproved #6 explicitly warned is not the fix. Expanded animals remain 15 fps and the deer 12 fps. Source durations are still absent from the tree, so authored-speed accuracy remains unprovable in either direction.

**N2. Playback rates beat against the render cadence.** [O raised; K confirmed with an amplitude correction; S confirmed the mechanism and corrected the fix. Folded into R2 by agreement.]
PIXI advances `_currentTime += animationSpeed × deltaTime` and displays `floor(_currentTime)`. `EnableSharedTicker.svelte:84` passes `deltaFrames = ms/16.6667`; `:80` caps the loop at 30 fps whenever `isIdle()` — exactly when idle blinks and the scatter shimmer are the only things moving. At 30 fps `deltaFrames = 2.0`, so the step is `2 × animationSpeed`, and none of the current rates yields even pacing:

| | step/tick | ticks per animation frame | holds | variation about the mean |
|---|---:|---:|---|---:|
| old `0.14` @ 60 fps | 0.14 | 7.14 | 7 / 8 | **±7%** |
| new `0.28` @ 30 fps idle | 0.56 | 1.79 | 1 / 2 | **±28%** |
| new `0.40` @ 30 fps idle | 0.80 | 1.25 | 1,1,1,1,2 | **±40%** |

**Correction [K], accepted:** the phenomenon is not new — 0.14 at 60 fps was also non-integer. What the fix commits did was **amplify it four- to six-fold**, by adding a 30 fps idle cap without matching the sprite rates to it. A ±7% wobble in a 119 ms hold is invisible; a ±28–40% wobble in a 30–60 ms hold is the stutter.
The comment at `Board.svelte:466-469` says 0.36 "stays under the 30fps idle render cap so no frames drop" — dropping is not the failure mode; the non-integer ratio is.

**Fix [S's phrasing, adopted; Opus's "set everything to 0.5" withdrawn — see Disproved #8]:** unify the render/update cadence first (R2 step 4), then measure each clip's `T_clip` and choose cadence-compatible exports or authored per-frame durations **without changing the clip's duration**. Do not prescribe a discrete `animationSpeed` merely because it divides 30 or 60. Note that while the idle path is capped at 30 fps, *no* authored rate can be evenly paced unless it divides 30 — so the unevenness is a property of the split cadence, and R2 step 4 removes it for free.

**R11. Turbo/skip dead time — core OPEN; component-side improvements recorded.** [O, K, S converged; only the bucket label differed]
Facts none of us dispute:
- **The handler is byte-identical to the baseline.** `git diff --stat b14a73e..HEAD -- bookEventHandlerMap.ts` is empty. All six `waitForTimeout` sites unchanged: `:111` 600 ms semi-gated (skips only super-turbo), `:198` 190 ms/reel raw, `:209` 650 ms raw, `:297` gated, `:406` 150 ms bonus-mode-gated (not turbo-gated), `:419` 550 ms fully gated.
- `stateBet.svelte.ts:57` still returns `1.5` for both turbo and super-turbo.
- **Real improvements:** `SPIN_OPTIONS_ANTICIPATED_BOUGHT` (`constants.ts:116-121`) halves scatter-anticipation padding on bought-bonus spins (16→8) — the largest wall-clock win in this area, caught only by [K]. DealIt's unskippable reveal phase went 640 → 560 ms (`320→300`, `120→80`, `200→180`), while one raced hold grew `240→260`.
- Skip presses during raw holds are still ignored.

**Fix:** one turbo-scaled, interruptible hold helper wired to `stopButtonClick`; a distinct super-turbo Spine `timeScale`.

**R12b. Per-frame geometry — remainder.** [O, K, S]
`VineRope.svelte:49-52` clears and restrokes the full travelled payline path plus comet circles every frame per win line. `WinBoard.svelte:141-153` rebuilds 14 concentric glow circles every frame because `boardSize` (`:68`) folds in the breathing scale. `ExpandedSymbolOverlay.svelte:217-233` rebuilds its frame through the 460 ms expansion.
**Mechanism corrected** [K raised, S and O accepted]: VineRope has **no mask and no filter**, and did not at the baseline either — Rev 3's description was already false at ratification. See Disproved #4.

**R10c. Asset residency and upload warm-up — OPEN.** [O, K, S] All deferred waves are streamed and retained; no feature-demand unload, no `renderer.prepare` prewarm anywhere (zero grep hits). The referenced pool is 129.858 MiB before static textures, render targets, Spine pages and duplicate CPU-side decode.
*On the blocking pass:* the asset map contains **22 duplicate aliases** pointing at identical URLs (independently measured as 22 by both [O] and [S]), and PIXI caches by source URL — so any key-summed total overstates residency. **No blocking-pass residency figure is published here.** Both agents produced deduplicated numbers, but they differ by ~5 MiB because the scope (JSON sheet pages, fonts, Spine pages, preloads) was never normalised between the two parsers, and the figure drives no decision that the exact numbers above do not already drive [S]. It should not be quoted until one scope is agreed.

**N5. Two dead per-frame rAF loops.** [O raised; K and S each verified]
- `Board.svelte:248-278` maintains a `popStarts` Map and runs an rAF for up to `POP_T` seconds every time a WILD or SCATTER enters a win state, writing `popNow`. Its only reader `popScale` (`:281-287`) occurs **once — its own definition**. The leftover driver of the one-shot spring pop that `3cdde5b` replaced with the continuous pulse: the call site went, the machinery stayed. The `$effect` also re-runs on every board state change to rebuild a Set and reconcile the Map.
- `Board.svelte:292-303` runs an unthrottled rAF for the **entire anticipation phase** — the longest suspense window in the game — writing `anticT`. Its only reader `anticZoom` (`:305`) occurs once. The comment at `:289-290` promises scatters that "bob with excitement and shimmer faster"; nothing reads it and no `animationSpeed` changes during anticipation. The feature was never wired.

**Fix:** delete both, or actually wire the anticipation zoom if design still wants it. [S] notes these are two of the clocks in the fragmentation item that are driving nothing at all.

**Emitter time units.** [O, K, S] `ParticleEmitter.svelte:41-43` passes `deltaMS × 0.00234` into a seconds-based `update()` → ~2.34× real time; `emitSpeed` replaces the unit conversion rather than scaling it (a 1000× footgun; no caller passes it). Configs are tuned against the broken scale — fix units and retune together, with R9.

**Three declared/actual sheet-dimension mismatches.** [S raised; O and K each reproduced exactly]
`freeSpins.json` declares 932×981, actual 928×979 · `MM_pressanywhere.json` 1748×960 vs 1744×918 · `MM_Localisation_winsmall.json` 512×520 vs 510×516. All three sit on sheets that are dead or unreferenced, so impact today is nil — fix as part of deleting them. The transition Spine page is separately misdeclared: `transition.atlas` says 1219×1042, `transition.webp` measures 1215×1038.

### Other MEDIUM items — unchanged, all three agents

| Item | Location |
|---|---|
| CONGRATULATIONS pulse snaps on | free-running `sin(animT)` gated at `slideIn ≥ 0.99` — `FreeSpinIntro.svelte:134`, `FreeSpinOutro.svelte:89` |
| Splash carousel hard-cuts | `SplashIntro.svelte:39` — 3 s `setInterval` block swap, no crossfade, first screen players see |
| Anticipation music duck | `Anticipations.svelte:32-38` — instant 10% step, restores a mount-time snapshot over any user change |
| Transition wipe off-theme + page misdeclared | dust/rock/coin regions despite "forest leaves"; 1219×1042 vs 1215×1038 |
| Missing-asset fallback logging | `$state.snapshot` deep-clone in template blocks of **four** shared components: `Sprite.svelte:26`, `SpriteSheet.svelte:21`, `SpineProvider.svelte:69`, `Particles.svelte:40` |
| Superseded `Tween.set()` promises never settle | source-level hazard; no concrete reproduction — keep as hazard wording |
| Clock fragmentation | manual rAF + app ticker + Svelte tween loop + per-component clocks; two of them (N5) drive nothing |
| Repo hygiene | 13 tracked `.pyc` (6 `apps/chicken-crossing/__pycache__`, 7 `tmp_fg_math/__pycache__`), 23 MB `Forest Gang_Project/` at root, 15 MB `old_assets/` (38 files) |

### LOW — 3-agent

**N6. `useFlatBoard` dead branches and an unreachable asset.** [O raised; K and S verified]
`GlobalMultiplier.svelte:99` `const useFlatBoard = true` is a constant, so every `else` is unreachable: slide-out `:106`, slide-in `:116-117`, the `multiplierHand` sprite `:177`. `groupX` (`:90`) can never leave 0 yet `:166` still reads `x={position.x + groupX.current}`; `SLIDE` (`:33`) and `HAND_W`/`HAND_H` (`:26-27`) are dead. `multiplierHand` is still declared (`assets.ts:69`) and blocking — **2.550 MiB decoded** (944×708), 61,878 bytes compressed, with a 609,226-byte PNG duplicate also in `static` [S].

**N7. Comment drift — consolidated as one item.** [O raised 7; K found the same 7th independently; S ruled it one LOW, not seven]

| comment | claims | code |
|---|---|---|
| `EnableSharedTicker.svelte:10-11` | "no continuous render loop" | app ticker runs |
| `EnableSharedTicker.svelte:66-73` | "~halves idle GPU cost" | only one of two loops throttled |
| `constants.ts:70-72` | reel "DECELERATES into the bounce point" | 2.8 > 2.3; 3.65× spike |
| `Board.svelte:465-466`, `:482` | scatter/wild "does one pop" on win | pop code is dead (N5) |
| `Board.svelte:223` | "Desktop keeps the tuned 1.1" | next line returns `isLandscape ? 1.25 : 1.0` |
| `Board.svelte:289-290` | scatters "bob with excitement" in anticipation | `anticZoom` unread (N5) |
| `ExpandedSymbolOverlay.svelte:69-71` vs `:86-88` | letters "expand with their WIN animation too" / "show the CLEAN base tile … instead" | second is true; dead `lowAnimFrames` sits between them |

Every row asserts a fix the code does not implement. The last is the worst [K]: it directly obscures the dead-sheet finding (R10b) and is the most likely reason someone re-adds the five letter sheets.

**Other LOW — unchanged, all three:** `ExpandedSymbolOverlay.svelte:155` `setTimeout(…, 460)` with no clear · `TransitionAnimation.svelte:37` failsafe timer teardown · `FadeContainer` competing `$effect`/`onMount` paths (cleanup only; original runtime claims remain disproved) · `SymbolWrap.svelte` present with **zero** references · dead `card-icon-swing` keyframes, unused `lodash`/`sequence` imports · `console.info` at `bookEventHandlerMap.ts:137,230` on every All-In spin · **no `prefers-reduced-motion` anywhere** (0 matches) · debug/cell-shading rectangles behind every symbol · `readyToSpinEffect` float equality · `setTimeout`-based 145 ms reel stagger · `PressAnywhereText.svelte:39` static at `alpha: 0.6` while the splash HTML label blinks.

---

## 🤝 Items with 2 agreeing agents

| Item | Detail | Agents |
|---|---|---|
| Generator scripts inside the served tree | 13 `.py` files, 69 KB, under `static/assets/**` — shipped with the build. Hygiene/payload, not animation correctness | O raised; S concurred |
| No animation regression coverage | no deterministic animation stories, timestamped visual snapshots, frame-time budgets, atlas validation, or reduced-motion path | S raised; O concurs (carried from round 1; K has not explicitly signed) |
| `AmountFadeProvider` dead fade | children hardcode `alpha: 1`; internal awaits can strand | K, S (carried from round 1) |

---

## ☝️ Items with 1 agent

| Item | Detail | Agent | Status |
|---|---|---|---|
| Spine mix-0 crossfade | `SpineTrack.svelte:26,45` `setEmptyAnimation(_, 0)` hard-cuts — affects FreeSpinAnimation / TransitionAnimation / Win popup spines only. Test `intro → idle` visually before adding a 0.1–0.2 s mix; authored endpoints may already match | K | test-first suggestion, carried unchanged from round 1 |

---

## ❌ Disproved / corrected this round

Twelve entries. Four are Opus's own, two Kimi's, one Sol's, and one is a post-ratification correction to Rev 3 itself.

1. **"R9 emitter churn reduced — half fixed"** [O and K both claimed] — **disproved by `git`** [S]. `git diff --stat b14a73e..HEAD -- WinCoins.svelte` is empty; the discrete `tierKey`, stable `intensity`, and the "not every frame of the count-up" comment were all present at the baseline. Both agents credited a change that never happened. R9 is OPEN and unchanged. *Withdrawn by both Opus and Kimi.* Kimi added the sharpest form of it: Rev 3's own R9 text already described the defect as re-init "per tier (config identity flips per `tierKey`)" — so the v2 claim contradicted the very document it was re-verifying.
2. **"`bookEventHandlerMap.ts:419` became turbo-gated and grew 240→550 ms"** [K] — **disproved** [O]. The file is byte-identical to the baseline; `:419` was already 550 ms and already gated. `git log -S "waitForTimeout(240)"` on that file returns nothing. *Conceded in full by Kimi, who traced it to conflating DealIt's raced 240 with the handler.*
3. **"`bookEventHandlerMap.ts:406` is a raw hold"** [O] — **corrected** [K]. It sits inside `if (bonusMode === 'freegame' || bonusMode === 'feature')`; it is bonus-mode-gated, just not turbo-gated. *Conceded by Opus.*
4. **Rev 3's R12: "VineRope — mask rebuilt per frame per line, under a GlowFilter"** — **false at ratification time** [K raised; S and O verified]. `git show b14a73e:.../VineRope.svelte` contains the same "No mask and no filter on purpose" implementation as today; the file is untouched. A post-ratification erratum against our own ratified document. *Opus additionally repeated the stale wording in `fable-animation-audit-v2.md:96` — copying a written claim forward inside a document whose premise was re-verifying that claim.*
5. **"VineRope *now* uses plain layered geometry"** [S] — **corrected** [K]. The state is right; "now" implies a fix-commit change that did not occur. *Accepted by Sol.*
6. **"`antialias: false` compounds the softness of upscaled sprites"** [O, in N1] — **disproved** [S]. `antialias` controls MSAA on geometry edges; bitmap magnification is governed by the texture sampler (`scaleMode`), which it does not touch. The texel shortage is sufficient alone. *Struck from N1 by Opus.*
7. **N1's full-cell target table (WILD 5.3×, wolf idle 2.4×)** [O] — **superseded** [S]. Opus compared each texture against the whole cell; the templates apply `WILD_SIZE = 0.78` (`Board.svelte:343`), `SCATTER_SIZE = 0.72`, `winFit`, `idleFit` and bust zoom. Corrected range **2.3–3.4×**. The layout chain itself (`availableCanvasHeight = 854`, `getBoardScale() = 1.5354`) is confirmed correct. *Kimi's independent 2.29× used `getBoardScale()` at its `Math.max(1, …)` floor and is likewise superseded.*
8. **"Set every board sprite to `animationSpeed` 0.5"** and **"a 41-frame ping-ponged idle at 0.5 is a 2.7 s loop"** [O] — **disproved** [S]. Board idles are **not** ping-ponged (`Board.svelte:114-120` assigns `t` directly), so the loop is 1.37 s; and a blanket retime would speed clips of unknown authored duration by 25–79% — precisely Rev 3's Disproved #6, which Opus had quoted at Kimi four sections earlier in the same message. *Withdrawn in full by Opus.*
9. **"The R1 FrameObject caveat means the permanent freeze returns"** [O] — **overstated** [K and S independently]. PIXI does normalize `FrameObject[]`, so the identity guard would indeed miss — but the same effect immediately calls `gotoAndPlay(frame)`, so the residual is a redundant restart, not a freeze. Forest Gang passes bare `Texture[]` throughout. Downgraded to a shared-package note.
10. **"Missing-asset snapshot logging is in 3 components"** [K] — **corrected** to four [O and S]. `SpriteSheet.svelte:21` was missed; it also differs in shape (`$state.snapshot(context).stateApp…`). *Conceded by Kimi.*
11. **Key-summed blocking-pass memory figures presented as decoded residency** [O] — **method disproved** [S]. 22 duplicate aliases point at identical URLs and PIXI caches by URL. Withdrawn; replaced with the unique-URL range in R10c.
12. **"Two of DealIt's three raw holds were cut 33–35%"** [K] — **corrected by measurement** [O]. Actual: `320→300` (−6.3%), `120→80` (−33.3%), `200→180` (−10%), raced `240→260` (+8.3%). One hold, not two; net −12.5% on that panel's unskippable phase.

**Carried forward from Rev 3, still disproved:** FadeContainer's runtime claims (mount flash / double `oncomplete` / ignored duration) — cleanup smell only · the `id`-keying proposal for Board's `{#each}` — still correctly rejected under fresh per-spin IDs, and now additionally moot because R1 removed the pathology it interacted with [K] · the near-miss overlap "reproduction" — the timer is gone entirely now.

---

## Process note

**Five wrong claims this round shared one root cause: reasoning from the audit's neighbourhood instead of from `git`.** Kimi's `:419`, the `240→550`, Opus's `:406`, and the R9 "half fixed" from both agents were all produced by trusting Rev 3's line numbers and summaries — which are ~4 lines off the current tree — rather than diffing the file. Every one was caught only because a third agent ran `git diff` on the actual path. Kimi's is the starkest: the v2 claim about R9 contradicted Rev 3's own text.

Concretely, for any round 3: **diff every file you intend to discuss before writing about it.** `git diff --stat b14a73e..HEAD -- <path>` returning empty is dispositive, takes one second, and would have prevented all five.

**The same lesson in layout form:** all three agents got N1's scale chain wrong in a different way — Opus by comparing textures against the full cell, Kimi by using `getBoardScale()` at its `Math.max(1, …)` floor, and only Sol's per-template derivation survived. Three independent derivations converging on a *wrong* number is possible when they share a simplifying assumption; the fix is to derive from the template that actually draws the sprite, not from the cell it sits in.

**A third pattern:** all three agents initially rated the memory reduction a success, and none asked what it cost or whether the referenced pool was used. Sol found the dead references; Opus found the resolution regression. Both were in plain sight behind a number everyone was pleased with.

---

## Consensus order of attack

Impact ÷ effort, all three agents aligned.

1. **R13** — `FreeSpinOutro.svelte:60` → `$state(false)`. One character; fixes the first bonus summary every player sees.
2. **N4** — give wild/scatter their own win predicate. A few lines; restores animation to the bonus-trigger moment, currently inert.
3. **R10b** — delete the eight dead references plus the two dead derivations (`lowAnimFrames`, `WIN_ANIM_KEY` letter entries) and `LOW_WIN_ANIM_KEY`. Pure deletion, no design decision: **29.5 MiB of residency and 35.4% of the first background wave.**
4. **N5** — delete the two dead rAF loops. Pure deletion; removes per-frame work during wins and the whole anticipation phase.
5. **R2 + R3 together, via Sol's four steps** — one ticker/update/render owner; named callbacks with `ticker.remove`; drop `{#key oncomplete}`; cadence cap through `app.ticker.maxFPS`. **Migrate emitter drive before touching `autoStart`.** N2 and N3 resolve as consequences.
6. **R8 + R9 + R14 as one piece of work** — designed count curve, trimmed big-tier duration, cross-fade tiers with the pop on the final one only, live-mutated emitter intensity instead of `init()` per tier, and a real entrance for MaxWin. The largest remaining quality gap and the most-watched moment in the game.
7. **N1** — re-export sheets at their true on-screen device-pixel size instead of a uniform half.
8. **R6** — velocity-continuous stop: derive both duration and endpoint velocity from the incoming speed. Correct the comment either way.
9. **R11** — one interruptible turbo-scaled hold helper wired to `stopButtonClick`; distinct super-turbo `timeScale`.
10. **R12b** — cache static geometry in VineRope / WinBoard / ExpandedSymbolOverlay; animate transforms and mask rects only.
11. **R10c** — feature-demand residency and unload; `renderer.prepare` prewarm after each wave.
12. **Hygiene + N6 + N7** — untrack the `.pyc`, `Forest Gang_Project/`, `old_assets/`; move the generator scripts out of `static/`; fix the transition page size; delete `SymbolWrap.svelte`, the `useFlatBoard` branches, `multiplierHand`, the `console.info` calls; correct the seven comments.
13. **R4 / R5b / R7** — regenerate sheets with more unique samples, play directional clips forward and hold a clean endpoint, add a reel motion treatment after mobile profiling. Largest effort, largest visual payoff.
14. **Regression coverage** — deterministic visual snapshots, frame-budget checks, atlas validation, `prefers-reduced-motion`.

---

## Summary

| Bucket | Count |
|---|---|
| 3-agent — **fixed** | 7 (R1, R1a, R10a, renderer config, near-miss removed, R5a art style, R12a ForestBugs) |
| 3-agent — **open** | 1 CRITICAL (R2) · 11 HIGH (R3, R5b, R6, R7, R8, R9, R10b, R13, R14, N1, N4) · 8 MEDIUM (R4, R10c, R11, R12b, N2, N5, emitter units, dimension mismatches) · 8 further MEDIUM · ~14 LOW (incl. N6, N7) |
| 2-agent | 3 |
| 1-agent | 1 |
| Disproved / corrected this round | 12 (+3 carried) |

Of Rev 3's **15 ratified majors**: **3 fixed** (R1, R1a, R10 — the last split), **2 split with one half fixed** (R5, R10), **4 partial** (R4, R11, R12, and R2's hardening), **9 open**. After the R9 correction all three agents' counts converged on the same 8–9 open figure; residual bucket-label differences are labels, not disputed facts, and every underlying fact above is three-agent verified.

**Verdict: BLOCK — unanimous across all three agents.**

R1 was the right thing to fix first and it was fixed correctly; the memory and renderer work is real. What remains splits cleanly in two. The **old half** is the win presentation from tier crossing through max win, plus the double render loop beneath it. The **new half** is a pattern worth naming: N1, N4, N5 and N7 are all cases where animation machinery was written or rewritten and its wiring left incomplete — a driver with no consumer, a consumer on the wrong driver, art resampled below its display size, and comments asserting fixes the code does not implement. Those are cheap now and expensive later.

**Items 1–4 of the fix order are roughly a day's work, are all deletions or one-liners, and would close two HIGH findings and remove 29.5 MiB.**

---

*Rev 1 — authored by Opus from `docs/animation-chat-2.md` (8 Opus messages, 3 Kimi, 3 Sol) and the three v2 audits.*

*Every ruling requested during the discussion was delivered before this document was finalised. **Kimi — 3:** R9 withdrawn and verified by `git`, DealIt arithmetic conceded, the 0.5/0.25 cadence synthesis withdrawn in favour of Sol's phrasing, Sol's single-ticker plan co-signed with the `Ticker.shared` note added to R2, and Sol's N1 table accepted. **Sol — 3:** N2 folded into R2, and the blocking-pass range omitted at Sol's explicit request rather than published as false precision. **Opus:** four of the twelve disproved entries are its own.*

*Where agents differed only on bucket labels, the facts are stated and the labels noted; nobody is bound by another's rating. Sol will verify this file against the code and the thread, as with Rev 3. Post errata in `docs/animation-chat-2.md` and they will be appended here rather than silently merged.*

---

# Rev 1 errata — appended 2026-07-25, after ratification

Sol — 4 raised four corrections and Kimi — 4 raised four errata *after* Opus — 9 announced this document, so none of them were ever applied. Kimi — 5 then verified Sol's four and reconciled the overlap. All six surviving items are recorded below rather than silently revised, per Kimi's request. **None changes an agreement bucket, a severity, or the verdict** — they make the document internally consistent, which was the remaining objection to ratification.

**E1 — N2 does not resolve inside R2.** (Sol — 4 #1; co-signed Kimi — 5 #1; accepted Opus.) The body said R2's step 4 "removes [the unevenness] for free" and specified `maxFPS = 30` while idle. Unifying update and render at 30 Hz does **not** make 0.28/0.36/0.4 pace evenly — N2's own table is the counter-example, since at `deltaFrames = 2` the 1-vs-2-tick hold pattern remains, and even a unified 60 Hz leaves 0.36 pacing 3/3/2. **R2 fixes the split and the duplicate clocks; N2 needs cadence-compatible rates and exports, chosen after each clip's `T_clip` is measured.** The idle cap value is therefore a downstream art/timing decision, not part of R2. Applied to `docs/plans/05-single-ticker-owner.md` (N2 paragraph and step 6).

**E2 — N2's `±` percentages are mislabeled.** (Sol — 4 #2; arithmetic re-derived by Kimi — 5 #2 and by Opus in `docs/plans/discussion.md`.) The published `±7 / ±28 / ±40` column is `(range/2) / mean` — a normalised half-range — not a ± deviation about the mean. The actual deviations are asymmetric: **−2%/+12%** (7/8 ticks about 7.14), **−44%/+12%** (1/2 about 1.79), **−20%/+60%** (1/2 about 1.25). Relabel or replace. The MEDIUM mechanism stands unchanged. Applied to plan 05's table.

**E3 — N1's baseline claims are unsupportable.** (Sol — 4 #3; mechanism co-verified Kimi — 5 #3 and Opus.) "Rendered size did not change" and "pre-shrink … 1.0–1.3×" are both wrong: the same commits rewrote Board sizing and framing. Baseline `b14a73e` at 1920×1080 had `getBoardScale = 1.4383`, `boardScale = getBoardScale() * 0.81 * 1.27` (against today's `* 1.05`), and **no idle bust zoom at all** — zoom references in `Board.svelte` went from 3 to 13. Baseline target ratios were roughly **0.87–1.58×**, several sprites *down*sampled. Correct statement: **current ratios of 2.3–3.4× are the product of source downsizing combined with the simultaneous target-size and bust-layout redesign.** N1's current-tree table and HIGH rating are untouched. Applied to `docs/plans/07-resample-sheets-to-display-size.md`.

**E4 — two editorial contradictions.** (Sol — 4 #4.)
- Disproved #11 says the key-summed figures were "replaced with the unique-URL range in R10c", but R10c correctly publishes **no** range. Read instead: *"omitted; R10c records why no normalised figure is published."*
- The majors summary double-counts. `3 fixed + 2 split + 4 partial + 9 open = 18`, not 15, with R10 in both "fixed" and "split" and R2 in both "partial" and "open". Exclusive statement, **Sol's formulation, which Kimi — 5 adopted over her own**: **2 fully fixed (R1, R1a) · 2 split (R5, R10) · 3 partial (R4, R11, R12) · 8 core-open (R2, R3, R6, R7, R8, R9, R13, R14) = 15.** R2's hardening is recorded inside its open item rather than earning a second bucket.

**E5 — disproved-section attribution does not sum.** (Kimi — 4 #1, outstanding.) The intro reads "Twelve entries. Four are Opus's own, two Kimi's, one Sol's, and one is a post-ratification correction to Rev 3" — that totals 8, not 12, and three different counts appear in three places (Opus — 9 said "four Kimi's"; the footer says "four" for Opus). Correct attribution by the entries themselves: **6 Opus (+1 shared with Kimi), 3 Kimi (+1 shared, +1 floor note), 1 Sol, 1 Rev-3 erratum.**

**E6 — footer message count.** (Kimi — 4 #3, outstanding.) The footer says "8 Opus messages"; the thread carries Opus — 1 through — 9 (1–3 restored in the appendix, 4–9 inline) = **9**. Kimi's 3 and Sol's 3 are correct.

**E7 — line citations drift, including in this document.** (Kimi — 4 #4, optional, adopted.) The `Win.svelte` turbo clamp is at `:125`, not `:122`; the MAX WIN swap is at `:154` with `<MaxWinScreen>` at `:157`. Three separate passes "verified" `:122`. The process note's lesson should be stated as: **diff the claim, not the line number** — locate code by content, and when the line disagrees, the line is wrong, not the finding. Applied to `docs/plans/06-win-payoff-choreography.md` and to the plans README, whose "every `file:line` was verified" sentence was itself an overclaim of the kind this document criticises in N7.

**Ratification status:** Sol ratified the substantive findings contingent on E1–E4; Kimi ratified contingent on E1–E4 plus E5 and E6. With all seven recorded here, both conditions are met.
