# Animation Audit — web-sdk / forest-gang

Date: 2026-07-22
Scope: `packages/pixi-svelte`, `packages/utils-slots`, `packages/components-pixi`, `packages/components-shared`, `packages/state-shared`, `apps/forest-gang` (active project), with cross-checks against PIXI v8.8.1, spine-pixi-v8 4.2, @barvynkoa/particle-emitter, and svelte 5.20.5 sources.

The animation-quality issues are real. Several root causes compound each other; the most damaging ones are small and cheap to fix.

---

## Critical

### 1. Playing `AnimatedSprite`s freeze at frame 0 when deferred asset waves land

**Files:**
- `packages/pixi-svelte/src/lib/components/AnimatedSprite.svelte`
- `packages/pixi-svelte/src/lib/utils.svelte.ts` (`propsSyncEffect`)
- `packages/pixi-svelte/src/lib/components/AssetsLoader.svelte`
- `apps/forest-gang/src/components/Board.svelte`
- `apps/forest-gang/src/game/assets.ts`

**Chain of failure:**

1. PIXI v8.8.1's `AnimatedSprite.textures` setter (verified in source) has **no equality guard** and unconditionally ends with `gotoAndStop(0)` — assigning textures **stops playback and jumps to frame 0**:

   ```ts
   set textures(value: AnimatedSpriteFrames) {
       ...
       this._previousFrame = null;
       this.gotoAndStop(0);
       this._updateTexture();
   }
   ```

2. `propsSyncEffect` re-writes **all** props whenever any tracked prop changes — including `textures`.

3. forest-gang's `Board.svelte` builds frame arrays with `$derived.by` (`[...t, ...t.slice(1,-1).reverse()]`) → **new array identity on every recompute** (same for `winAnimTextures`, `idleAnimTextures`, `animFrames`, `lowAnimFrames`).

4. `AssetsLoader.svelte` merges each deferred wave by **replacing** `loadedAssets` (`{...loadedAssets, ...waveAssets}`) → all deriveds reading it invalidate → new frame-array identities → `propsSyncEffect` re-sets `textures` → `gotoAndStop(0)`.

5. The `play` effect does **not** re-fire (its deps — `props.play`, `props.startFrame`, `animatedSprite.totalFrames` — are unchanged), and `EnableSharedTicker` only advances nodes with `playing === true` → **the sprite stays frozen indefinitely**.

**Real-world effect:** idle animal blinks mount at wave 0, then freeze on frame 0 when wave 1/2 merge (seconds later) and never recover until `play` toggles — opening/closing the Buy Bonus modal "fixes" them, which makes the bug look random. Win / expanded-symbol anims freeze if a wave lands mid-presentation. This is very likely the actual cause of the "win-symbol animations read as the static win tile" symptom that `EnableSharedTicker.svelte`'s comment attributes to the ticker.

**Fix (in `AnimatedSprite.svelte`):** exclude `textures` from `propsSyncEffect` and sync it in a dedicated effect that preserves playback state:

```ts
propsSyncEffect({ props, target: animatedSprite, ignore: ['play', 'startFrame', 'textures'] });

$effect(() => {
	const frame = animatedSprite.currentFrame;
	const playing = animatedSprite.playing;
	animatedSprite.textures = props.textures ?? [];
	if (playing) animatedSprite.gotoAndPlay(Math.max(0, Math.min(frame, animatedSprite.totalFrames - 1)));
});
```

---

### 2. `EnableSharedTicker` is a symptom patch that doubles GPU work

**File:** `apps/forest-gang/src/components/EnableSharedTicker.svelte`

- Nothing stops `app.ticker` — `InitialiseApplication.svelte` calls `app.init({...})` without `autoStart: false`, so PIXI's own ticker renders every frame. The manual loop additionally calls `app.render()` on its own rAF → **every frame is rendered twice** whenever the app ticker is alive, at uncontrolled relative phase (micro-judder, ~2× GPU/battery on mobile).
- The loop recursively walks the **entire scene graph** every frame (per-node type checks + try/catch, descending into `ParticleContainer` children) and advances spines even when hidden.
- The underlying disease it works around: in PIXI v8, `Ticker._tick` schedules the next rAF **after** `update()` returns (verified in `Ticker.ts`):

  ```ts
  this._tick = (time) => {
      this._requestId = null;
      if (this.started) {
          this.update(time);                       // <- a throwing listener escapes here
          if (this.started && this._requestId === null && this._head.next) {
              this._requestId = requestAnimationFrame(this._tick);  // <- never reached
          }
      }
  };
  ```

  **Any exception in any listener permanently kills that ticker.** That is the "a listener error killed shared.update" from the component's own comment. The correct fix is at the source (no leaking/throwing listeners, optionally a guarded ticker), not a parallel render loop.

---

### 3. Ticker listener leaks — one per win presentation

**Files:**
- `packages/pixi-svelte/src/lib/components/Particles.svelte` — `ticker.add(...)` with **no removal at all**; keeps calling `props.update(particles)` + `particleContainer.update()` on dead state forever after unmount.
- `packages/pixi-svelte/src/lib/components/ParticleEmitter.svelte` — `onDestroy` destroys the emitter but never removes the ticker callback (it no-ops post-destroy, but accumulates; each leaked closure is a future ticker-kill hazard per finding 2).
- `apps/forest-gang/src/components/Win.svelte` — `{#key oncomplete}` wraps the whole win subtree; `oncomplete` is reassigned on **every** `winUpdate` event → the entire subtree (coins emitter, spines, WinBoard) is destroyed and recreated per win → multiplies the leaks and causes a rebuild flash.

Over a session this is a steadily growing per-frame cost and a steadily growing list of candidates to kill the ticker.

---

## High

### 4. Video-derived animations play at 8–18 fps

**File:** `apps/forest-gang/src/components/Board.svelte` (also `ExpandedSymbolOverlay.svelte`)

PIXI `animationSpeed` is frames per 60fps tick (`elapsed = animationSpeed * deltaTime`). The sheets are 31–41 frames cut from 24–30 fps video (`generate_win_anim.py`), but play at:

| Element | `animationSpeed` | Effective fps |
|---|---|---|
| Scatter medallion (40f) | 0.14 | ~8.4 |
| WILD loop (40f) | 0.26 | ~15.6 |
| Idle blinks (41f) | 0.28 (+offset) | ~17 |
| Letter win anims | 0.25 | 15 |
| Animal win anims | 0.3 | 18 |
| Expanded overlay anims | 0.25 | 15 |

Playback below the source frame rate = frames duplicated irregularly = visibly steppy/choppy motion everywhere on the board. This is the single most pervasive "low quality" look.

**Fix:** play at/near source rate (`animationSpeed ≈ 0.4–0.5` for 24–30fps sources), or better: author the sheets with per-frame durations (`FrameObject.time`) and set `animationSpeed = 1`.

### 5. Particle emitter time units are wrong

**File:** `packages/pixi-svelte/src/lib/components/ParticleEmitter.svelte:42`

```ts
const deltaUpdate = ticker.deltaMS * (props.emitSpeed || 0.00234);
emitter.update(deltaUpdate);
```

The library's `update()` expects **seconds** (verified: `update(delta)` with `if (typeof delta !== 'number') delta = delta.deltaTime`). The default `0.00234` makes particles run at ~**2.34× real-time**; passing `emitSpeed: 1` would run them **1000× too fast**. It only looks right because the configs were tuned by eye against the broken scale.

**Fix:** `ticker.deltaMS * 0.001 * (props.emitSpeed ?? 1)` and re-tune configs accordingly.

### 6. Coin fountain visibly pops during count-up

**File:** `apps/forest-gang/src/components/WinCoins.svelte`

`config` derives from `tierKey`, which derives from the **live** count-up multiplier → each tier crossing produces a new `config` identity → `ParticleEmitter`'s effect re-runs `emitter.init(updatedConfig)` → all existing particles are destroyed and spawn state resets → the fountain restarts with a visible pop exactly as the win climbs tiers.

**Fix:** don't call `init` on config change while emitting — update `emitter.frequency`/`maxParticles` (behavior props) live, or key separate emitters per tier and crossfade.

### 7. Mid-game stutter from deferred asset waves

**Files:** `AssetsLoader.svelte`, `Sprite.svelte`, `SpriteSheet.svelte`, `SpineProvider.svelte`, `Particles.svelte`

Each wave merge causes:
- Multi-MB sprite sheets are uploaded to the GPU on **first use** (no `renderer.prepare` warm-up) → mid-spin render stalls.
- Sprites whose key isn't loaded yet render `Texture.EMPTY` and execute the template blocks `{console.error(...)}` + `{console.log('loadedAssets', $state.snapshot(...))}` — a **deep clone of the entire assets map**, potentially per frame while that component's other props animate. Several components do this (`Sprite.svelte`, `SpriteSheet.svelte`, `SpineProvider.svelte`, `Particles.svelte`).

**Fix:** warm up textures after each deferred wave (`app.renderer.prepare.upload(...)`), and gate the snapshot logging behind a one-time warn (or remove it).

---

## Medium

### 8. `FadeContainer` mount flash + double start

**File:** `packages/components-pixi/src/components/FadeContainer.svelte`

- Initial value is `show ? 1 : 0` → mounts with `show=true` render **one frame fully visible**, then `onMount` snaps to 0 and fades in.
- The `onMount` fade-in uses `alpha.set(1)` with **no duration → svelte default 400ms**, ignoring `props.duration`.
- The `$effect` also fires `alpha.set(...)` on mount → two competing tween starts.

**Fix:** single code path; initial value 0 when `show` is true at mount; always pass `duration`.

### 9. `Tween.set()` promises never resolve when superseded

Verified in svelte 5.20.5 source (`internal/client/loop.js`):

```js
abort() {
	raf.tasks.delete(task);   // promise never fulfilled
}
```

Any awaited tween chain is silently abandoned if a later `set()` supersedes it:
- `createReelForSpinning.slideY` chains (contained today by the `interruptible` wrapper, but abandoned async functions leak closures).
- `Anticipation.svelte`: `fade.set(0, {duration: 240}).then(() => props.oncomplete())` — if superseded, `oncomplete` never fires and `reelState.anticipating` stays stuck.
- `AmountFadeProvider.svelte`: `fadeIn`/`fadeOut` awaits can hang (also: children are rendered with hardcoded `alpha: 1` — the whole fade is dead code, marked TODO).

**Fix:** never rely on a tween's promise for control flow that must complete; use interruptible/timeout patterns, or wrap `Tween` in a helper whose promise resolves on supersede.

### 10. Spine track switches hard-cut (no crossfade)

**File:** `packages/pixi-svelte/src/lib/components/SpineTrack.svelte`

Animation changes call `spine.state.setEmptyAnimation(track.trackIndex, 0)` then `setAnimation(...)` — mix duration 0 → idle → win / win → static transitions **pop** instead of crossfading. A short mix (e.g. 0.1–0.2s) would noticeably smooth symbol state changes.

### 11. ~11 concurrent rAF loops

svelte's tween loop + PIXI app ticker + the manual `EnableSharedTicker` loop + bespoke per-component clocks:
`Board.svelte` (2), `Anticipation.svelte` (**one per anticipating reel**), `Win.svelte` (breathe), `WinBoard.svelte`, `FreeSpinIntro.svelte`, `FreeSpinOutro.svelte`, `ForestBugs.svelte`, `PaylineVine.svelte`, `BonusSymbolPanel.svelte`, `SplashIntro.svelte`.

Each writes `$state` per frame → independent effect flushes scattered across the frame. **Fix:** one shared clock store (single rAF, seconds-since-epoch) that components derive from.

### 12. Per-frame geometry rebuilds + filters

- `VineRope.svelte`: clears and re-strokes the full Graphics **and** rebuilds its mask every frame during draw-on — per winning line — each wrapped in a `GlowFilter` (render-to-texture, `quality: 0.3`).
- `ForestBugs.svelte`: 8 bugs redrawn via Graphics per frame.
- `ExpandedSymbolOverlay.svelte`: mask Graphics rebuilt every frame during the 460ms expansion.

Bounded in time, but they're the heaviest GPU moments and coincide with win presentations (the worst time to drop frames). Consider caching static geometry (only the mask needs to move), and pre-rendering the glow.

### 13. Always-on debug rectangles on the board

**File:** `apps/forest-gang/src/components/Board.svelte`

Every symbol renders a `<Rectangle ... backgroundColor={0x000000} alpha={0.02} />` behind it — 20–40 extra quads every frame, near-invisible. Gate behind `debug`.

### 14. Turbo and super-turbo have identical spine timescale

**File:** `packages/state-shared/src/stateBet.svelte.ts:57`

```ts
const timeScale = () => (stateBet.isSuperTurbo ? 1.5 : stateBet.isTurbo ? 1.5 : 1);
```

Both branches 1.5 — super-turbo gets no extra speedup for spine animations.

---

## Lower / architecture

- **Three unsynchronized timing domains**: svelte's rAF (Tweens) → effect flush → PIXI's render rAF. Best case a constant ~1-frame lag; under load, phase drift = judder. Driving positions from PIXI's ticker (or rendering after the svelte flush) would tighten this.
- **Mobile GPU budget**: `resolution: devicePixelRatio` (up to 3×) + `antialias: true` + WebGPU + (currently) double rendering. Consider capping resolution at 2.
- `AmountFadeProvider.svelte` — fade logic is dead (children get `alpha: 1`); remove or finish.
- **Reel sequencing uses `setTimeout`** (`waitForTimeout` — 145ms per-reel stagger etc.) — not frame-aligned, jittery under load; acceptable but noticeable next to the rAF-driven motion.
- `createReelForSpinning.readyToSpinEffect` relies on `reelY.current === defaultY` **float equality** — works only because `placeY` sets the exact value; fragile against any future easing/offset change.
- `propsSyncEffect` writes **all** props on any change — during tweens that's a full prop write per component per frame (plus fresh inline object identities for `scale`/`pivot`). Cheap individually, noisy in aggregate; and it's the delivery mechanism for finding 1.

---

## What's already good

- The pre-spin wrap math in `createReelForSpinning` is frame-exact — symbol positions are identical across the padding swap, so the loop seam is invisible.
- Svelte `Tween` defaults to `linear` easing (verified in 5.20.5 source) — the long padding slide is constant speed, which is correct for reels; `reelStopEasing: cubicOut` decelerating into the bounce is sensible tuning.
- The `forceStop` escape hatch for anticipated (`noStop`) reels and the pending-interrupt design in `createInterruptible` are sound.
- The deferred-waves loading strategy itself is right; only its side effects (findings 1 & 7) need handling.

---

## Suggested order of attack

| # | Fix | Effort | Impact |
|---|---|---|---|
| 1 | `AnimatedSprite` textures freeze (finding 1) | ~5 lines | Animations stop freezing — biggest visible win |
| 2 | Remove `EnableSharedTicker`; fix `Particles`/`ParticleEmitter` leaks, drop `{#key oncomplete}` (findings 2, 3) | Small | Kills double-render, leaks, ticker-death class |
| 3 | Emitter time units + no `init()` on tier change (findings 5, 6) | Small | Coins run at correct speed, no pops |
| 4 | Re-time `animationSpeed` to source fps (finding 4) | Tuning | Board-wide smoothness |
| 5 | `FadeContainer` single-path start; remove debug rects (findings 8, 13) | Small | No mount flash, less overdraw |
| 6 | `renderer.prepare` warm-up for deferred sheets; silence snapshot logging (finding 7) | Small | No mid-game upload stalls |
| 7 | Consolidate rAF clocks; spine crossfade mixes; cached vine geometry (findings 10–12) | Medium | Frame pacing + polish |
