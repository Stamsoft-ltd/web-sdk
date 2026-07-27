# Forest Gang — Animation Audit v2 (Post-Fix Re-Verification)

- **Date:** 2026-07-24
- **Author:** Kimi
- **Scope:** Re-verification of every item in the ratified three-agent audit (`docs/animation-audit-merged-with-rating.md` Rev 3) against the current code, after the post-audit fix commits:
  - `81a1931` redesign big and animations
  - `ab33fbc` did some improvements and fix some issues
  - `3cdde5b` fixes and improves
- **Method:** same rule as the original audit — nothing taken on faith. Every item below was re-checked against the current source (file:line cited) or re-measured from the assets on disk (`sips` / sheet JSON scans). Commit messages and code comments were treated as claims, not evidence.

## Status summary

| Status | Items |
|---|---|
| ✅ **FIXED** | R1 (AnimatedSprite freeze), R1a (payline scale), R4 (temporal resolution), R10-memory (484→130 MiB referenced; loading atlas ≤4096), near-miss wobble timer (removed), resolution/antialias LOW |
| 🟡 **PARTIAL** | R2 (double render persists; hazard guarded + cost cut), R5 (new v2/v3 art; reversal retained), R11 (component-side trims only; handler untouched; core open), R12 (ForestBugs deleted; VineRope/WinBoard glow remain) |
| ❌ **NOT FIXED** | R3 (listener leak + `{#key oncomplete}` + emitter time units), R6 (velocity spike — new comment contradicts the math), R7 (dead blur const), R8 (linear count-up), R13 (outro `show=true`), R14 (MaxWin hard swap), emitter time units, CONGRATULATIONS snap, splash carousel, music duck, snapshot logging, no texture prewarm, spine timeScale 1.5/1.5 |

**Headline:** the #1 finding (R1) is fixed correctly, in the exact shape the consensus prescribed — board animations no longer freeze on prop changes. R1a and the asset-memory collapse are also done. The largest remaining risks are R3 (ticker-listener leak, now sitting on the *unguarded app ticker*) and R2's residual double render.

---

## ✅ Fixed (verified)

### R1 — AnimatedSprites freeze at frame 0 on any prop change → **FIXED**
`packages/pixi-svelte/src/lib/components/AnimatedSprite.svelte` (rewritten):
- `propsSyncEffect({ ..., ignore: ['play', 'startFrame', 'textures'] })` — `textures` is out of the generic sync, so a `y`/`width`/`alpha` write can no longer trigger the `set textures → gotoAndStop(0)` path.
- Dedicated effect with an identity guard (`props.textures !== animatedSprite.textures`) and play-state restore (`gotoAndPlay(frame)` / `gotoAndStop(frame)`) in the same run — the consensus fix, implemented with an accurate comment describing the original bug.
- Residual nuance (minor): a genuine textures swap restarts from `startFrame` rather than preserving `currentFrame`. Acceptable — a real swap is rare (deferred asset wave) and frame-0 restart ≫ frozen forever.
- Consequence: `EnableSharedTicker` is no longer load-bearing for the R1 freeze; it now only covers the shared-ticker-advance path it was designed for.

### R1a — Payline vines at wrong scale → **FIXED**
`Game.svelte:427`: `scale={{ x: bl.boardScaleX ?? bl.boardScale, y: bl.boardScaleY ?? bl.boardScale }}` — per-axis with fallback, exactly the prescribed one-liner.

### R4 — Board animations at 8–18fps effective → **FIXED (re-authored + retimed)**
- New sheets on disk: `wild_anim_v3` (40f), `scatter_anim` (40f), `wolf_win_v2` (35f), `squirrel_win_v2`, `rabbit_win_v2`, plus re-encoded idles/money clips (much smaller).
- `Board.svelte`: scatter `animationSpeed 0.36` (~22fps), wild `0.4` (24fps), win anims `0.36`, idles `0.28 + stagger` — the code comment at `:466` explicitly documents the old 0.14 (~8fps) stepping problem. This matches the ratified fix (re-author at adequate N, then set the rate per sheet cadence — not a blanket raise: values differ per clip).

### R10 (memory half) — **FIXED, dramatic**
Re-measured with the same method as the ratified scan (`meta.size` × RGBA over every JSON sheet):
- **34 sheets / 155.1 MiB total, 129.9 MiB referenced, 25.3 MiB unreferenced** — vs the audit's 33 / 557.8 / 483.8 / 74.0. Referenced decoded footprint dropped **~73%** (483.8 → 129.9 MiB).
- `loading_bar.png`: **5992×560 → 2996×280** — now under the 4096 GPU texture limit.
- Remaining sub-items (NOT done): `navbar/bar.webp` and `hud_frame.webp` still 4600×500 (CSS-side, decoded-memory concern only); ~25 MiB unreferenced leftovers (`coin_rain_a/b`, `MM_pressanywhere`, `MM_Localisation_winsmall`, `rabbit_10_anim_sheet`); no `renderer.prepare` upload prewarm (grep: zero hits).

### Near-miss wobble timing hazard → **MOOT (code removed)**
The `setTimeout(280)` wobble in `Board.svelte` is gone; no `wobble`/`280` references remain in the component (the only board `setTimeout` left is `:366`, an 80ms expanded-symbol reveal with proper effect cleanup).

### LOW: uncapped resolution + antialias → **FIXED**
`Game.svelte:391`: `<App preloadWebFont={false} maxResolution={2} antialias={false} rendererPreference="webgl">`, plumbed through `App.svelte` → `InitialiseApplication.svelte` (`resolution: Math.min(devicePixelRatio.current, props.maxResolution ?? Infinity)`). Defaults preserve other games.

---

## 🟡 Partially fixed

### R2 — Double render / ticker patch / ticker-death hazard
- **Ticker-death hazard in the manual loop: FIXED.** `EnableSharedTicker.svelte` (rewritten): per-node `try/catch` on every `update()`, guarded `advance()` walk, guarded `app.render()`, `document.hidden` pause, cleanup on destroy. Nothing inside the loop can kill it now.
- **Cost: substantially reduced.** Active cap ~61fps (also fixes 120Hz ProMotion over-render), idle throttle to 30fps via `stateXstateDerived.isIdle()`, hidden-tab full pause.
- **Double render: NOT fixed — it persists.** `InitialiseApplication.svelte` still never passes `autoStart: false`, and nothing stops the Application's own ticker (per PIXI v8.8.1's TickerPlugin, source-verified in Rev 3: default `autoStart: true` → `ticker.add(this.render)` + start; `Ticker.shared.stop()` does not touch the app ticker). The app ticker still renders every frame *in addition to* the manual rAF render.
- **New documentation bug:** the rewritten `EnableSharedTicker` comment claims *"This app renders reactively (no continuous render loop)"* — that contradicts the source-verified PIXI v8 behavior and the ratified R2. The comment should be corrected; the actual fix remains `autoStart: false` on `app.init()` (safe now that the manual loop exists and R1 is fixed — this is the deletion window the audit's sequencing note described).
- Note: the loop now also advances Spine nodes in seconds — scope expanded deliberately; safe because `Ticker.shared` is stopped (no double-advance).

### R5 — Style consistency / reversed one-shots
- New v2/v3 win art shipped ("redesign big and animations"); visual style-consistency improvement likely but not verifiable from source.
- Ping-pong reversal **retained deliberately**: `Board.svelte:82/:89`, `ExpandedSymbolOverlay.svelte:65/:84`, with comments explaining the trim construction. The audit's "play one-shots forward and hold final frame" was not adopted; recorded as a retained design choice pending visual QA of the new art.

### R9 — Tier crossings
- **CORRECTION (Sol catch, animation-chat-2):** ~~Emitter churn reduced~~ — `WinCoins.svelte` is **byte-identical to the baseline** (`git diff b14a73e..HEAD` empty); the discrete `tierKey`, the stable `intensity`, and the "not every frame of the count-up" comment all predate the audit. Rev 3 itself already described re-init as "per tier", so my "was: config identity flip per frame" claim credited a change that never happened — the same error class as my R11 `:419` claim, caught the same way.
- **Status: OPEN, unchanged, no post-audit fix.** `init()` per tier change still destroys all live particles (fountain pop at crossings), and `WinBoard.svelte:38-53` retains the guarded magnetic collapse/re-pop (the hero board still vanishes up to 4× on a slow big-win climb).

### R11 — Turbo/skip dead time
- Improved (component side only): bought-bonus anticipation now runs at half padding (`SPIN_OPTIONS_ANTICIPATED_BOUGHT`, `constants.ts`); DealIt panel waits trimmed 320/120/200 → **300/80/180** (`DealItMultiplierPanel.svelte:134-139`), raced 900/240 → 900/**260**.
- **CORRECTION (Opus disproof, animation-chat-2):** `bookEventHandlerMap.ts` is **byte-identical to the baseline** (`git diff b14a73e..HEAD` on it is empty). An earlier version of this section claimed `:419` "became gated" and "grew 240→550ms" — false: it was 550ms and fully turbo-gated at ratification, and no 240 ever existed in that file (I conflated DealIt's raced 240 with the handler). Rev 3's own handler line numbers were ~4 lines off the baseline file, which invited the false "line drift" narrative.
- Unchanged: the three raw holds (`:198` 190ms/reel, `:209` 650ms, `:111` 600ms semi-gated), `:406` 150ms bonus-mode-gated, `:419` 550ms fully gated, GlobalMultiplier 170/280, and **`stateBet.svelte.ts:57` timeScale still 1.5 for turbo AND super-turbo**. No interruptible hold helper yet. Re-rated: **OPEN, marginally improved** (was "partial").

### R12 — Per-frame Graphics re-tessellation
- **`ForestBugs.svelte` deleted** (the worst offender, ~200 path ops/frame × 8 bugs).
- Still per-frame: `VineRope.svelte:60-81` (`line.clear()` + full path + circles per frame per line), `WinBoard.svelte:147-152` (glow circles rebuilt per breathing frame).

---

## ❌ Not fixed (verified against current code)

### R3 — Ticker-listener leak + `{#key oncomplete}` + emitter time units — **now the top remaining item**
`packages/pixi-svelte/src/lib/components/ParticleEmitter.svelte` is **unchanged**:
- Anonymous `ticker.add(() => …)` on the **app ticker**, never removed (`onDestroy` only destroys the emitter). One leaked closure per win presentation, growing unboundedly.
- **Severity note, updated:** with R1 fixed, these leaked callbacks are the *only* known listeners on the app ticker besides `render`. The app ticker is unguarded — if any leaked closure ever throws (e.g. emitter internals after a future refactor), PIXI kills the whole app ticker: automatic rendering stops, and the game would silently depend on the manual rAF. The audit's "ticker-death" hypothesis now has exactly one live candidate site.
- Time-units bug unchanged: `ticker.deltaMS * (props.emitSpeed || 0.00234)` into a seconds-based `update()` → 2.34× real-time; `emitSpeed` still a 1000× footgun. Configs remain tuned against the broken scale — fix units + retune together, as ratified.
- `Win.svelte:126` `{#key oncomplete}` unchanged → full win-subtree destroy/recreate per win (rebuild flash) remains.

### R6 — Reel-stop velocity spike — **NOT fixed; new comment contradicts the math**
`constants.ts`: `reelSpinSpeedBeforeBounce: 2.8` + `cubicOut` unchanged (diff only added the bought-bonus block). The new comment claims the reel now "DECELERATES into the bounce point". The math disagrees: the cubicOut segment averages 2.8px/ms → **initial derivative = 3 × 2.8 = 8.4px/ms**, a ~3.65× spike over the 2.3px/ms incoming linear speed — exactly the ratified R6. The handoff still accelerates into the stop; the fix (velocity-continuous easing/derived duration) was not applied. Flag: the comment now documents intent the constants don't fulfill.

### R7 — Reel motion blur — **NOT fixed**
`MOTION_BLUR_VELOCITY = 31` (`constants.ts:123`) still unreferenced; no spin-state art.

### R8 — Linear, overlong count-up — **NOT fixed**
`WinCountUpProvider.svelte:29`: `countUpAmount.set(props.amount, { duration: props.duration })` — no easing → Svelte `Tween` default linear. `Win.svelte:125` turbo clamp still applies only when `!hasBoardAnimation` (big-win counts exempt in turbo).

### R13 — First bonus outro pops in unanimated — **NOT fixed (1-char fix still available)**
`FreeSpinOutro.svelte:60`: `let show = $state(true);` (intro correctly `false` at `FreeSpinIntro.svelte:66`). The 750ms entry still burns invisibly at app start; the `show`-gated rAF clock (`:84-86`) still runs from launch all session.

### R14 — MaxWin hard swap — **NOT fixed**
`Win.svelte:154-157`: conditional `{#if … >= 25000}` swap unchanged; `MaxWinScreen` has no entrance transition (only the ambient `breatheScale`).

### MEDIUM items — all verified unchanged
- **CONGRATULATIONS pulse snap:** free-running `sin(animT)` gated at `slideIn ≥ 0.99` — `FreeSpinIntro.svelte:135`, `FreeSpinOutro.svelte:89`.
- **Splash carousel:** `SplashIntro.svelte:39` — 3s `setInterval` block swap, no crossfade.
- **Anticipation music duck:** `Anticipations.svelte:33-38` — instant 10% step + mount-time snapshot restore (still clobbers mid-anticipation volume changes).
- **Missing-asset snapshot logging:** still deep-clones `stateApp` in template blocks of 3 shared components (`SpineProvider.svelte:69`, `Sprite.svelte:26`, `Particles.svelte:40`; `AnimatedSprite` dropped it in the rewrite — was 4).

### LOW items — unchanged
`SymbolWrap.svelte` still present (dead) · `AmountFadeProvider` dead fade · no `prefers-reduced-motion` · FadeContainer competing paths (code-smell only) · three timing domains.

---

## New observations introduced by the fix commits (not in Rev 3)

1. **`EnableSharedTicker` comment is factually wrong** about the render model ("no continuous render loop"). Cosmetic, but it will mislead the next person to touch the ticker stack — and it hides the actual remaining R2 work (`autoStart: false`).
2. **R6's comment overclaims.** The recorded intent ("decelerates into the bounce point") is not what the constants compute. Either fix the easing or fix the comment — right now the documentation asserts the bug is gone.
3. **Idle-throttle couples render cadence to XState derivation** (`stateXstateDerived.isIdle()`), guarded with try/catch defaulting to active. Sensible; worth a glance that no state exists where sprites animate while `isIdle()` is true (idle blink loops are explicitly fine at 30fps per the comment; 22–24fps win clips would drop frames at the 30fps idle cap if a win ever played while classified idle — the Board comment at `:466` shows this was considered for the idle cap).
4. **Board `{#each}` index keying retained** (`Board.svelte:447/:449`) — consistent with the ratified resolution (rejected under the current reel model), and now safe because R1 removed the stateful-`textures` pathology it interacted with.

---

## Recommended remaining order (updated)

1. **R3** — named callback + `ticker.remove` in `ParticleEmitter.svelte`; drop `{#key oncomplete}` in `Win.svelte`; fix emitter time units and retune. *(Highest residual risk — unguarded app-ticker listeners.)*
2. **R2 residual** — pass `autoStart: false` in `InitialiseApplication` (forest-gang opts in via prop), fix the EnableSharedTicker comment. Single render owner: the manual loop.
3. **R13** — `$state(false)` (one character).
4. **R6** — velocity-continuous stop easing (or at minimum correct the comment).
5. **R8 + R9 remainder** — designed count curve (coordinate with tier cross-fade), live-mutate emitter props instead of re-`init`.
6. **R14** — MaxWin entrance choreography.
7. **R11 remainder** — interruptible turbo-scaled hold helper; distinct super-turbo `timeScale`.
8. **R12 remainder** — cache VineRope / WinBoard glow geometry.
9. **R10 remainder** — delete the ~25 MiB unreferenced sheets, downscale the two 4600px CSS images, add `renderer.prepare` prewarm after each wave.
10. **MEDIUM sweep** — pulse phase-lock, splash crossfade, duck fade, drop snapshot logging.

## Reconciliation against Rev 3

- Every "FIXED" above was verified in code, not from commit messages. In three cases the commit comments and code disagreed (R2 render model, R6 deceleration claim, and R13's still-`true` `show` despite the outro being touched) — the code won.
- No previously-disproved item regressed: FadeContainer remains a smell-only, keying resolution stands, no new `waitForTimeout` sites appeared (still 6 in the handler, all pre-existing).
- Net: of the 15 ratified majors, **4 fixed, 3 partial, 8 open** (R11 and R9 re-rated open after the chat-2 disproofs — see those sections); of the 10 MEDIUMs, **1 fixed (resolution cap, formerly LOW), 1 moot (near-miss), 8 open**. The single most valuable fix (R1) is done and done right.
