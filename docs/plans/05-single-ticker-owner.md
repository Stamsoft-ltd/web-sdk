# 05 — One ticker/update/render owner

- **Covers:** R2 (3-agent, CRITICAL), R3 (HIGH), N2 (MEDIUM), N3 (MEDIUM) · **Effort:** ~1 day · **Blocked by:** plan 04 recommended first
- **Files:** `packages/pixi-svelte/src/lib/components/InitialiseApplication.svelte`, `apps/forest-gang/src/components/EnableSharedTicker.svelte`, `packages/pixi-svelte/src/lib/components/ParticleEmitter.svelte`, `packages/pixi-svelte/src/lib/components/Particles.svelte`, `apps/forest-gang/src/components/Win.svelte`

## Problem

### R2 — the scene is rendered twice per frame

`InitialiseApplication.svelte:38-53` never passes `autoStart: false`, so PIXI starts the application's private ticker and registers `app.render` on it (`TickerPlugin`, at `UPDATE_PRIORITY.LOW`). Separately, `EnableSharedTicker.svelte` schedules its own `requestAnimationFrame`, walks the whole scene graph, advances every playing `AnimatedSprite` and `Spine`, and calls `app.render()` again. `Ticker.shared.stop()` at `:21` does not touch the app ticker — `sharedTicker` defaults to false, so they are different objects.

Result: ~2× GPU cost, an O(scene) CPU walk, and two render calls at unrelated phases.

The hardening added this round is real and worth keeping — per-node `try/catch`, guarded walk, guarded render, `document.hidden` pause, cleanup on destroy. It closes the ticker-death hazard *inside the manual loop*. It does not close the defect.

**Two comments in this file are false** and all three agents flagged them:
- `:10-11` — "This app renders reactively (no continuous render loop)". It does not; the app ticker runs.
- `:66-73` — "~halves idle GPU cost" and "caps the active path at ~60" on ProMotion. Neither happens (**N3**): the throttle governs only the manual loop while the app ticker renders uncapped at panel rate. `document.hidden` likewise pauses only the custom work.

### R3 — a leaked ticker listener and a full subtree rebuild per win

`ParticleEmitter.svelte:38-46` registers an **anonymous** callback on `app.ticker`; `onDestroy` (`:48-51`) destroys the emitter but never calls `ticker.remove`. `Win.svelte:126` wraps the win presentation in `{#key oncomplete}` with `oncomplete` reassigned per win, so every win destroys and recreates the subtree *and* adds another callback. The listener list grows without bound for the session.

Destroyed emitters' `update()` no-ops, so this is not hundreds of live particle simulations — it is an unbounded closure list plus a rebuild flash per win. With R1 fixed, these leaked closures are the **only** non-render listeners on the app ticker, so the audit's ticker-death hypothesis has exactly one live candidate site.

`Particles.svelte:31-35` has the same missing removal (unused by forest-gang; fix it anyway — it is a shared package).

### N2 — playback rates beat against the render cadence

PIXI advances `_currentTime += animationSpeed × deltaTime` and displays `floor(_currentTime)`. `EnableSharedTicker.svelte:84` passes `deltaFrames = ms/16.6667`; `:80` caps the loop at 30 fps whenever `isIdle()` — exactly when idle blinks and the scatter shimmer are the only things moving. At 30 fps `deltaFrames` is 2.0, so the step is `2 × animationSpeed` and no current rate divides evenly:

| | step/tick | ticks per animation frame | holds | mean hold | actual deviation |
|---|---:|---:|---|---:|---|
| old `0.14` @ 60 fps | 0.14 | 7.14 | 7 / 8 ticks | 119.0 ms | −2% / +12% |
| `0.28` @ 30 fps idle | 0.56 | 1.79 | 1 / 2 ticks | 59.5 ms | **−44% / +12%** |
| `0.40` @ 30 fps idle | 0.80 | 1.25 | 1,1,1,1,2 | 41.7 ms | **−20% / +60%** |

**The deviations are asymmetric, and an earlier revision of this table stated them as `±7 / ±28 / ±40`.** That column was `(range/2) / mean` — a normalised half-range, not a ± variation about the mean. Sol derived the correct asymmetric figures and Kimi co-signed them; they are the ones above. The mechanism is unchanged and still MEDIUM: at 30 fps a 0.28 clip alternates between a 33 ms and a 67 ms hold, and the short hold is 44% under the mean, which is what reads as a stutter. The comment at `Board.svelte:466-469` says 0.36 "stays under the 30fps idle render cap so no frames drop" — dropping is not the failure mode; the ratio is.

**N2 does *not* resolve here.** An earlier version of this plan claimed unifying the cadence removes the beat. It does not, and this plan's own table is the counter-example: at a unified 30 fps, `deltaFrames = 2` and 0.28 still holds 1-vs-2 ticks; even at a unified 60 fps, 0.36 paces 3/3/2. What plan 05 removes is the **split** — two clocks at unrelated phases, one of them un-throttled. The residual unevenness is a rate-versus-cadence mismatch that exists at *any* cadence and is coarsest at 30 Hz, so N2's actual fix is cadence-compatible playback rates and exports, chosen after each clip's `T_clip` is measured (plan 13). Do not close N2 on the strength of this plan.

## Change — Sol's plan, co-signed by all three agents

The invariant is **one ticker/update/render owner**. Not "set `autoStart: false`", not "keep or delete `EnableSharedTicker`" — those are implementation choices underneath the invariant.

### ⚠️ Sequencing warning — read before touching `autoStart`

`ParticleEmitter.svelte:39` drives `emitter.update()` from `context.stateApp.pixiApplication.ticker` — the app ticker. **Passing `autoStart: false` without first migrating emitter drive freezes the coin fountain mid-presentation on every win.** And because `TickerPlugin` registers `app.render` on that same ticker, `autoStart: false` also removes one of the two render paths — so the manual loop cannot be deleted in the same change set either. The two are load-bearing for each other until the migration below is complete.

An earlier version of the fix order in `docs/fable-animation-audit-v2.md` bundled `autoStart: false` + listener cleanup + patch deletion into one change set. It would have shipped a frozen fountain. That is why this warning is here.

### Steps

1. **Keep the auto-started application ticker as the single owner.** Do not pass `autoStart: false`.
2. **Replace `EnableSharedTicker`'s private rAF with one listener on `app.ticker`**, registered at a priority *above* PIXI's render listener (which sits at `UPDATE_PRIORITY.LOW`), e.g.
   ```js
   app.ticker.add(() => advance(app.stage, app.ticker.deltaTime, app.ticker.deltaMS / 1000),
                  null, PIXI.UPDATE_PRIORITY.NORMAL);
   ```
   No `requestAnimationFrame`, no `app.render()` call, no second render. Keep the existing per-node `try/catch` guards — they are the valuable part of the current file.

   Have `advance()` take an **injected delta** rather than reading `app.ticker.deltaTime` internally — plan 14's deterministic clock needs `advanceFrames(n)` to drive it with a fixed step, and retrofitting that later means touching every call site. Pass `app.ticker.deltaTime` from the listener; let the function receive it.

   Verified in `pixi.js@8.8.1/lib/ticker/const.mjs`: `INTERACTION 50, HIGH 25, NORMAL 0, LOW -25, UTILITY -50`, higher runs first, and `TickerPlugin` registers `app.render` at `LOW`. So `NORMAL` reliably advances the scene *before* the render in the same tick.

   **Do not re-add a manual delta clamp.** `Ticker.mjs:50` sets `_maxElapsedMS = 100` and `:241-242` clamps `elapsedMS` to it before `:253` computes `deltaTime = deltaMS × 0.06`, so `deltaTime` can never exceed **6** frames. Today's `Math.min(4, ms/16.6667)` is therefore not a safety net to preserve — it is a tuning value, and its post-migration equivalent is `app.ticker.maxElapsedMS = 66.7`. Set that if 4 is the number you want; otherwise take the built-in 6.
3. **`Ticker.shared` must stay stopped.** pixi-svelte's `AnimatedSprite` is constructed with PIXI's default `autoUpdate: true`, which registers it on `Ticker.shared`; restarting shared would double-advance every board sprite. The `advance()` listener from step 2 is not an optimisation — **it is the sprite clock.**
4. **Fix the emitter leaks (R3).** Named callback plus removal, in both shared components:
   ```diff
   -context.stateApp.pixiApplication.ticker.add(() => { … });
   +const update = () => { … };
   +context.stateApp.pixiApplication.ticker.add(update);
    onDestroy(() => {
   +    context.stateApp.pixiApplication?.ticker.remove(update);
        emitter.emit = false;
        emitter.destroy();
    });
   ```
   Apply to `ParticleEmitter.svelte:38-51` and `Particles.svelte:31-35`.
5. **Drop `{#key oncomplete}`** at `Win.svelte:126`, replacing it with explicit state reset on win start. This is what makes each win add a listener and rebuild the subtree.
6. **Move the activity cap onto the ticker** so update and render share one cadence: `app.ticker.maxFPS = …`. Keep the `document.hidden` behaviour via `app.ticker.stop()`/`start()` if wanted.

   **Do not prescribe `idle ? 30 : 60` here.** That is the move that bakes N2 in — 30 Hz is the cadence at which the current rates pace worst. Either keep 60 Hz for now and let plan 13 choose the cap alongside the clip cadences, or pick a cap that the intended `animationSpeed` values divide evenly (at 30 Hz that means rates of the form `1/(2k)` — 0.25, 0.5 — not 0.28/0.36/0.4). Sol flagged the unconditional 30 and Kimi co-signed; the cap value is a plan 13 decision, not a plan 05 one.

   This step is what actually closes **N3**, and the mechanism is stronger than "tidier": the `maxFPS` setter writes `_minElapsedMS` (`Ticker.mjs:312-317`), and `_tick` **returns before running any listener** when `delta < _minElapsedMS` (`:245-250`). One assignment throttles update *and* render together — exactly the property the comment at `EnableSharedTicker.svelte:66-73` claims today and cannot deliver, because it owns only one of the two loops.
7. **Fix the two false comments** at `EnableSharedTicker.svelte:10-11` and `:66-73`, and rename the component — it no longer enables the shared ticker. `SceneAnimationDriver` or similar.

### Alternative endpoint

Fully migrating every consumer to a custom ticker (and then `autoStart: false`) is viable, but it is a larger design and should not be the default. Adding an emitter registry to a recursive duck-typed scene walk makes an emergency patch into architecture.

## Verify

1. **One render per frame.** Instrument or breakpoint `app.render` — it should be called once per tick, from `TickerPlugin` only.
2. **Fountain still runs.** Trigger a big win and confirm coins emit, move and fall. This is the specific thing the sequencing warning protects; check it after *every* step, not just at the end.
3. **No listener growth.** Log `app.ticker.count` after each of 20 consecutive wins — it must be flat. Today it climbs by one per win. (`count` **is** public in v8 — `Ticker.mjs:188-198`, a readonly getter that walks the `_head` linked list. It was questioned in review as non-existent; it exists. O(n) per read, which is irrelevant for an assertion.)
4. **Sprites still animate.** Idle blinks, scatter shimmer, wild loop, animal win animations, and every Spine (free-spin intro/outro board, transition, global multiplier) must all still play — they depend on step 2/3 being correct.
5. **Cadence.** Update and render counts must match one-for-one, and the active path must not follow a 120 Hz panel rate unless deliberately configured — that is the saving `:66-73` claims today but does not deliver. **Do not assert "idle ~30 fps"**: step 6 deliberately declines to prescribe 30, so an acceptance test demanding it would force back the value the plan prohibits. Assert whatever cap was actually configured (60 until plan 13 chooses otherwise).
6. **No rebuild flash** between consecutive wins after step 5.
7. **Tab switch** still stops work, and returning resumes cleanly with no accumulated-delta jump. The ticker's own `maxElapsedMS` provides this (capping `deltaTime` at 6 frames); confirm the resume shows no visible skip-ahead rather than assuming a manual clamp is doing it.

## Done when

`app.render` is called once per frame from one owner, `app.ticker.count` is flat across many wins, every sprite and Spine still animates, the fountain runs, and no comment in the ticker path claims behaviour the code does not have.
