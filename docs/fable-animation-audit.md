# Forest Gang — Animation Quality Audit

- **Date:** 2026-07-22
- **Branch:** `feature/forest-gang-v1`
- **Trigger:** external feedback that the animations are of poor quality
- **Scope:** `apps/forest-gang` + shared animation packages (`pixi-svelte`, `utils-slots`, `components-pixi`); all findings verified against the actual code

**TLDR — the feedback is fair, and it has four root causes:** the core spin has zero motion-blur treatment so it reads cheap; the win presentation (the most-watched moment) counts up linearly, strobes its tier board, and burns frame budget on per-frame geometry rebuilds; a real ticker leak makes animation quality **degrade the longer a session runs**; and the first bonus summary a player ever sees pops in with no animation at all.

## CRITICAL

### 1. Particle ticker callback leaks on every win — animations degrade over the session
`packages/pixi-svelte/src/lib/components/ParticleEmitter.svelte:38` — `ticker.add(() => …)` registers an anonymous per-frame callback that `onDestroy` never removes (it only destroys the emitter). `apps/forest-gang/src/components/Win.svelte:121` remounts WinCoins under `{#key oncomplete}` on **every win**, so each win leaves a permanent callback calling `update()` on a destroyed emitter. An hour of play accumulates hundreds of dead per-frame callbacks — exactly the failure mode where testers report "poor animations" without being able to point at one thing.

**Fix:** `const update = () => {…}; ticker.add(update); onDestroy(() => ticker.remove(update))`.

## HIGH

### 2. No motion blur on the spinning reels
`apps/forest-gang/src/game/constants.ts:116` — `MOTION_BLUR_VELOCITY = 31` is exported and used nowhere; there is also no `'spin'`-state art. Reels slide fully sharp at ~2.3px/ms, which strobes — the single biggest "cheap spin" tell in the core loop.

**Fix:** per-reel vertical `BlurFilter`/MotionBlur enabled while `motion === 'spinning'`, or blurred spin-state strips.

### 3. The hero win count-up is linear
`packages/components-pixi/src/components/WinCountUpProvider.svelte:29` — `Tween.set(amount, { duration })` with no easing → Svelte's default linear. The most important number in the game climbs at constant speed and stops dead. Compounded by duration: `Win.svelte:120,131` gives LEGENDARY ~11s of linear climb + a 3s hold.

**Fix:** `easing: cubicOut`/`expoOut`, and trim the big-tier duration factor.

### 4. Win tier board strobes — collapses to scale 0 on every tier crossing
`apps/forest-gang/src/components/WinBoard.svelte:39-54` — the live count crosses SWEET→WILD→EPIC→MYTHIC→LEGENDARY and each crossing plays `pop.set(0)` then `pop.set(1)`: the hero board vanishes and re-pops up to 5× during the climax, and the queued 520ms transitions lag the real tier.

**Fix:** cross-fade between tier arts; only the final tier gets the pop.

### 5. First bonus outro pops in with no animation (and its rAF clock runs all session)
`apps/forest-gang/src/components/FreeSpinOutro.svelte:57` — `let show = $state(true)` (the intro correctly starts `false`). The entry tween burns out invisibly at app start, so the first CONGRATULATIONS summary hard-pops; only from the second bonus onward does it animate. Bonus defect: the `show`-gated rAF clock runs from app launch through the entire base game.

**Fix:** `$state(false)` — one character.

### 6. Turbo doesn't shorten the sequence holds, and skip can't cancel them
`apps/forest-gang/src/game/bookEventHandlerMap.ts` — `expandedSymbolReveal` (190ms/reel + 650ms, lines 198/209) has no turbo gate → ~1.4s per expanding spin even in super-turbo; the 600ms inter-bonus-spin pause (:111) skips only super-turbo; `setWin`'s 150ms (:402) is ungated — while other holds (:293, :415) are gated correctly. All 13 `waitForTimeout` sites are raw, so a skip press during a hold is simply ignored. This is the "dead time / turbo feels the same" complaint.

**Fix:** one turbo-scaling helper for every hold, routed through `createInterruptible` cancelled on `stopButtonClick`.

### 7. Per-frame Graphics re-tessellation during the win celebration
Three components rebuild vector geometry every frame exactly when the game needs frame budget most:

- `ForestBugs.svelte:118-129` — 8 procedural bugs fully redrawn per frame (~200 path ops/frame), mounted during board wins.
- `VineRope.svelte:32-52` — full payline path + extent scans rebuilt per frame per win line; only the mask rect actually depends on `progress`.
- `WinBoard.svelte:66,139-151` — 14-circle radial glow rebuilt per frame because `boardSize` includes the breathing scale.

**Fix:** draw static geometry once; animate via Container transform/mask only.

## MEDIUM

- **`EnableSharedTicker.svelte:20-77`** — globally stops `Ticker.shared` and replaces it with a permanent rAF loop that duck-type-probes the *entire* scene graph and calls `app.render()` unconditionally every frame — an O(scene) walk plus a forced 60fps render loop, on top of the leaked ticker callbacks above. Self-acknowledged sledgehammer for a frozen-AnimatedSprite bug; the right fix is keeping the shared ticker alive with a guarded listener.
- **`FreeSpinIntro.svelte:131` / `FreeSpinOutro.svelte:86`** — CONGRATULATIONS pulse snaps on discontinuously (free-running `sin(animT)` gated at `slideIn ≥ 0.99` → visible twitch as the title lands). Phase-lock it to the settle moment.
- **FreeSpinIntro/Outro entry** — the whole layout rides one shared 750ms cubicOut tween; no stagger, no overshoot. Reads templated.
- **`MaxWinScreen.svelte:45`** — the 25,000× max win, the game's biggest moment, enters via a plain linear 400ms fade while lesser tiers get a backOut pop. Invert that hierarchy.
- **`SplashIntro.svelte:39,61-80`** — the mobile feature carousel hard-cuts between slides every 3s, no crossfade — the first screen a player sees.
- **`Board.svelte:259`** — the near-miss wobble is armed by a raw `setTimeout(280)` racing win evaluation; on a slow device it can fire on top of the win animation.
- **`Anticipations.svelte:32-38`** — music ducks as a step (no fade) and restores a mount-time volume snapshot, clobbering any user change mid-anticipation.
- **Repo hygiene (this branch):** `tmp_fg_math/__pycache__/*.pyc` committed (add `__pycache__/`/`*.pyc` to .gitignore), `Forest Gang_Project/` ~24MB of .wav/.docx/design sources at repo root, and `old_assets/…spines` re-added despite the dead-asset purge commit (93aaa0a).

## LOW (quick wins, mostly deletions)

- Uncleared timers that fire on stale state: `TransitionAnimation.svelte:37`, `ExpandedSymbolOverlay.svelte:132`.
- `FadeContainer` calls `oncomplete` twice on mount; fade is default linear.
- Panel "pops" use cubicOut so they read as shrinks — backOut sells them: `BonusEarnedPanel.svelte:85`, `FreeSpinCounter.svelte:78`.
- Outro win amount rescales per digit during count-up (headline number jitters).
- Pixi "PRESS ANYWHERE" prompt is static while the splash HTML label blinks — inconsistent affordance.
- Dead code: `SymbolWrap.svelte` (unused component), unused `lodash`/`sequence` imports in `bookEventHandlerMap.ts`, dead `card-icon-swing` keyframes in `CustomBuyBonusModal.svelte:378`.
- `console.info` diagnostics ship on every All-In spin (`bookEventHandlerMap.ts:137,230`).
- No `prefers-reduced-motion` guard anywhere in the app.
- Board `{#each}` keys symbols by index instead of the `id` the reel code creates for that purpose.

## What is already good

The CSS/HUD layer is clean (no `transition: all`, no layout-property animation, no hidden infinite loops). The reel-stop physics (cubicOut decel → overshoot → settle) and the non-count-up easings are genuinely well-tuned. The problems are concentrated in the win payoff, the leaks/per-frame work, and the unanimated edge cases above.

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 1     | block  |
| HIGH     | 6     | block  |
| MEDIUM   | 8     | info   |
| LOW      | ~12   | note   |

**Verdict: BLOCK** — the CRITICAL leak and the outro one-liner are must-fixes; the HIGH cluster is what the "poor quality" feedback is actually describing.

**Highest impact-per-line fix order:** outro `$state(false)` → ticker leak → count-up easing → turbo/skip gating → tier-board cross-fade → reel motion blur.
