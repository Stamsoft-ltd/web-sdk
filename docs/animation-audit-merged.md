# Forest Gang — Merged Animation Audit

- **Date:** 2026-07-22
- **Branch:** `feature/forest-gang-v1`
- **Sources:** `fable-animation-audit.md` **[F]**, `kimi-animation-audit.md` **[K]**, `sol-animation-audit.md` **[S]** — deduplicated and cross-verified
- **Verification:** claims marked ✅ were re-checked against the code/assets during the merge; the rest stand on the originating audit's code reading

**Combined TLDR.** The three audits converge on the same story from different angles: (1) a broken rendering pipeline — animations that freeze when deferred assets land, the whole scene rendered twice per frame, and per-win ticker leaks — makes quality degrade and stutter; (2) the board's animations are tuned to play at 8–18fps and the source art itself is stylistically inconsistent and sometimes played backwards; (3) the biggest moments (spin stop, win count-up, first bonus outro, max win) each have a specific defect that flattens their impact; (4) turbo/skip leaves uncancellable dead time. Most of the highest-impact fixes are small.

---

## CRITICAL

### C1. Playing AnimatedSprites freeze at frame 0 when deferred asset waves land [K]
`packages/pixi-svelte/src/lib/components/AnimatedSprite.svelte`, `utils.svelte.ts` (`propsSyncEffect`), `AssetsLoader.svelte`, `apps/forest-gang/src/components/Board.svelte`. PIXI v8.8.1's `AnimatedSprite.textures` setter unconditionally ends in `gotoAndStop(0)`. `propsSyncEffect` re-writes all props on any change; Board's frame arrays are rebuilt with new identity whenever `loadedAssets` changes; each deferred wave replaces `loadedAssets` → every playing sprite gets `textures` reassigned → stops at frame 0. The `play` effect's deps are unchanged so nothing restarts it ([F]'s independent read of the effect deps corroborates the delivery mechanism). Idle blinks freeze seconds after load; win anims freeze if a wave lands mid-presentation; toggling the Buy Bonus modal "fixes" it — so it looks random. Very likely the true cause of the frozen-animation symptom that `EnableSharedTicker` was built to patch.
**Fix (~5 lines):** exclude `textures` from `propsSyncEffect`; sync it in a dedicated effect that preserves `currentFrame`/`playing`.

### C2. The scene is rendered twice every frame, and the "fix" component makes it worse [F, K, S] ✅
`apps/forest-gang/src/components/EnableSharedTicker.svelte:20-77` + `packages/pixi-svelte/src/lib/components/InitialiseApplication.svelte`. ✅ Verified: `app.init({...})` never passes `autoStart: false`, so PIXI's application ticker runs and renders every frame — while `EnableSharedTicker` runs a second, phase-unrelated rAF loop that walks the **entire** scene graph with per-node duck-typing probes and calls `app.render()` again. ~2× GPU/battery, micro-judder, O(scene) CPU walk, and `Ticker.shared` is globally stopped (breaking anything else that relies on it). Root cause it papers over [K]: in PIXI v8 a throwing ticker listener permanently kills that ticker (`_tick` only re-schedules after `update()` returns) — fix the throwing/leaking listeners (C1, C3), then delete this component and use one ticker.

### C3. Ticker-listener leak on every win presentation [F, K]
`packages/pixi-svelte/src/lib/components/ParticleEmitter.svelte:38-51` — `ticker.add(() => …)` never removed in `onDestroy`; `Particles.svelte` — same, and its callback keeps doing live work on dead state forever. `apps/forest-gang/src/components/Win.svelte:121` wraps the win subtree in `{#key oncomplete}` with `oncomplete` reassigned per win → the whole subtree (emitter, spines, WinBoard) is destroyed/recreated **every win**, leaking one callback each time and causing a rebuild flash. Steadily growing per-frame cost over a session, and every leaked closure is a candidate to kill the ticker per C2.
**Fix:** named callback + `ticker.remove` in both components; replace `{#key oncomplete}` with explicit state reset.

---

## HIGH

### H1. Board animations play at 8–18fps [K; F flagged the 8fps case]
`Board.svelte`, `ExpandedSymbolOverlay.svelte`. `animationSpeed` values (0.14 scatter ≈ 8.4fps, 0.26 wild ≈ 15.6fps, 0.28 idles ≈ 17fps, 0.25–0.3 win anims = 15–18fps) against 24–30fps video-derived sheets → irregular frame duplication → steppy motion across the whole board, all the time. The most pervasive "low quality" look.
**Fix:** retime to ~source rate (0.4–0.5), or author per-frame durations and run at speed 1.

### H2. Win/idle art is stylistically inconsistent; one-shot clips play backwards [S; F confirmed the ping-pong construction]
`Board.svelte:55-82`, `ExpandedSymbolOverlay.svelte:51-84`. Idle animals are transparent cutouts; win sheets are opaque rectangular scenes with different proportions/costumes/backgrounds — transitions read as unrelated AI-generated clips, not the same character animating. Non-looping clips are ping-ponged (`[...t, ...t.slice(1,-1).reverse()]`), so actions and falling coins visibly reverse.
**Fix:** re-author to a consistent rig/style (ideal), or at minimum play one-shots forward and hold a clean final frame.

### H3. Reel stop begins with a ~3.5× velocity spike [S — math verified]
`constants.ts:74-90` + `createReelForSpinning.svelte.ts:280-299`. The stop segment switches from linear 2.3px/ms to a 2.8px/ms-average `cubicOut` segment; cubicOut's initial derivative is 3× its average → instantaneous ~8.4px/ms at the handoff. The reel visibly *accelerates* into its stop — the exact snap the tuning comment says it was meant to remove.
**Fix:** match the easing's initial derivative to the incoming velocity (or derive duration/easing from velocity-continuity constraints).

### H4. No motion blur on the spinning reels [F]
`constants.ts:116` — `MOTION_BLUR_VELOCITY = 31` is dead; no `'spin'`-state art either. Fully sharp strips at 2.3px/ms strobe. **Fix:** per-reel vertical blur while `motion === 'spinning'`, or blurred spin-state strips.

### H5. Hero win count-up is linear and overlong [F]
`components-pixi/WinCountUpProvider.svelte:29` (no easing → Svelte default linear, [K] verified the default in Svelte source) + `Win.svelte:120,131` (LEGENDARY ≈ 11s climb + 3s hold). Constant-speed climb that stops dead. **Fix:** `cubicOut`/`expoOut` + shorter big-tier factor.

### H6. Tier crossings strobe the win board and pop the coin fountain [F, K]
`WinBoard.svelte:39-54` — each tier crossing collapses the board to scale 0 and re-pops (up to 5× per big win; queued 520ms tweens lag the real tier). `WinCoins.svelte` + `ParticleEmitter.svelte:34-36` — `config` identity changes per tier → `emitter.init()` destroys all live particles → fountain restarts with a visible pop at the same moment. **Fix:** cross-fade tier art (pop only the final tier); mutate emitter behavior props live instead of re-`init`.

### H7. Paylines are drawn at the wrong scale — vines miss the symbols [S] ✅
`Game.svelte:423` uses uniform `scale={bl.boardScale}` while Board renders at per-axis `boardScaleX/boardScaleY`. ✅ Verified: landscape `boardScale` = pitch × 1.12 vs per-axis pitch (~12% off); desktop ±6–7% per axis (H_SPREAD 1.06 / V_TIGHTEN 0.93). **Fix:** `scale={{ x: bl.boardScaleX, y: bl.boardScaleY }}` on the payline container.

### H8. Texture memory and atlas sizes exceed sane/mobile limits [S; K for upload stalls] ✅
`assets.ts:262-425`, `AssetsLoader.svelte`. ~484MB decoded RGBA across referenced sheets, ~282MB in wave 0 via `Promise.all` ([S] estimate, not re-verified). ✅ Verified oversized atlases: `loading_bar.png` **5992px** wide, `navbar/bar.webp` and `frames/hud_frame.webp` **4600px** — all above the 4096 limit on constrained devices. No `renderer.prepare` warm-up → multi-MB GPU uploads happen on first use, mid-spin [K]. **Fix:** load per-feature, split atlases ≤4096, stagger + prewarm uploads after each wave.

### H9. First bonus outro pops in with no entrance; its rAF clock runs all session [F, S]
`FreeSpinOutro.svelte:57` — `show = $state(true)` (intro correctly `false`): the 750ms entry tween burns out invisibly at app start; first real outro sets `true→true` (no-op) → hard pop; the `show`-gated rAF clock runs from launch. **Fix:** `$state(false)`.

### H10. Turbo/skip dead-time cluster [F, K]
`bookEventHandlerMap.ts` — `expandedSymbolReveal` holds (190ms/reel + 650ms, :198/:209) have no turbo gate (~1.4s per expanding spin even in super-turbo); the 600ms inter-bonus-spin pause (:111) skips only super-turbo; `setWin` 150ms (:402) ungated; all 13 `waitForTimeout` sites are raw, so skip presses during holds are ignored. Plus `state-shared/stateBet.svelte.ts:57` — spine `timeScale` is 1.5 for both turbo *and* super-turbo [K]. **Fix:** one turbo-scaling, interruptible hold helper; distinct super-turbo timescale.

### H11. Per-frame Graphics re-tessellation during win presentation [F, K]
`ForestBugs.svelte:118-129` (8 procedural bugs, ~200 path ops/frame), `VineRope.svelte:32-52` (full path + extent scans + mask rebuilt per frame per line, under a `GlowFilter` render-to-texture), `WinBoard.svelte:66,139-151` (14-circle glow rebuilt per frame via breathing scale), `ExpandedSymbolOverlay.svelte` (mask rebuilt per frame during the 460ms expansion). All land exactly when frame budget matters most. **Fix:** draw static geometry once; animate via Container transform / mask rect only.

---

## MEDIUM

- **Particle emitter time units are wrong** [K] — `ParticleEmitter.svelte:42` passes `deltaMS × 0.00234` to a library expecting seconds → ~2.34× real-time; `emitSpeed: 1` would be 1000× too fast. Configs were tuned against the broken scale. Fix: `deltaMS * 0.001 * (emitSpeed ?? 1)` + re-tune.
- **`Tween.set()` promises never resolve when superseded** [K, verified in Svelte 5.20.5 source] — `Anticipation.svelte`'s `fade.set(0).then(oncomplete)` can hang → `reelState.anticipating` stuck; `AmountFadeProvider` awaits can hang (its fade is dead code anyway — children hardcode `alpha: 1`). Don't build control flow on tween promises.
- **Spine track switches hard-cut** [K] — `SpineTrack.svelte` uses `setEmptyAnimation(track, 0)` + mix 0; a 0.1–0.2s mix would smooth every symbol state change.
- **~11 concurrent rAF loops** [K; F found the outro one] — Svelte tween loop + app ticker + EnableSharedTicker + per-component clocks (`Board` ×2, `Anticipation` per anticipating reel, `Win`, `WinBoard`, `FreeSpinIntro/Outro`, `ForestBugs`, `PaylineVine`, `BonusSymbolPanel`, `SplashIntro`), each writing `$state` per frame → scattered effect flushes. Consolidate into one shared clock.
- **FadeContainer defects** [F, K] — one-frame fully-visible flash on mount, competing `onMount`/`$effect` starts each firing `oncomplete`, fade-in ignores `props.duration` (uses default 400ms linear).
- **CONGRATULATIONS pulse snaps on** [F] — `FreeSpinIntro.svelte:131` / `FreeSpinOutro.svelte:86`: free-running `sin(animT)` gated at `slideIn ≥ 0.99` twitches as the title lands. Phase-lock to the settle moment.
- **Intro/outro entry is one flat tween** [F] — single shared 750ms cubicOut, no stagger, no overshoot; and **MaxWinScreen** (25,000×) gets only a linear 400ms fade while lesser tiers pop [F]. Invert the hierarchy.
- **SplashIntro carousel hard-cuts** [F] — `SplashIntro.svelte:39,61-80`, 3s `setInterval` block swaps, no crossfade — first screen the player sees.
- **Near-miss wobble races win evaluation** [F] — `Board.svelte:259` raw `setTimeout(280)` can fire the shake over the win animation on slow devices.
- **Anticipation music duck** [F] — `Anticipations.svelte:32-38` steps volume instantly and restores a mount-time snapshot, clobbering user changes.
- **Transition spine is off-theme and its atlas is misdeclared** [S] ✅ — generic coins/rocks/sparks instead of forest foliage; ✅ verified `transition.atlas` declares 1219×1042 but `transition.webp` is 1215×1038 → edge regions sample/clip wrong.
- **Always-on debug rectangles** [K; F noted] — `Board.svelte:370-377`: 20–40 near-invisible quads (alpha 0.02) behind every symbol, every frame. Gate behind `debug`.
- **Missing-asset fallback does per-frame deep clones** [K] — `Sprite/SpriteSheet/SpineProvider/Particles.svelte` template blocks run `console.log('loadedAssets', $state.snapshot(...))` (full assets-map clone) whenever a key is missing while props animate. One-time warn instead.
- **Repo hygiene (this branch)** [F] — `tmp_fg_math/__pycache__/*.pyc` tracked; `Forest Gang_Project/` ~24MB of .wav/.docx/design sources at repo root; `old_assets/…spines` re-added despite the 93aaa0a purge.

---

## LOW / architecture

- Three unsynchronized timing domains (Svelte rAF → effect flush → PIXI rAF): ~1-frame lag best case, phase-drift judder under load [K].
- Mobile GPU budget: `resolution: devicePixelRatio` (up to 3×) + `antialias: true` + double rendering — cap resolution at 2 [K] ✅ (settings confirmed in `InitialiseApplication.svelte`).
- Uncleared timers firing on stale state: `TransitionAnimation.svelte:37`, `ExpandedSymbolOverlay.svelte:132` [F].
- Panel "pops" use cubicOut (reads as a shrink) — backOut sells them: `BonusEarnedPanel.svelte:85`, `FreeSpinCounter.svelte:78` [F].
- Outro win amount rescales per digit during count-up [F]; Pixi "PRESS ANYWHERE" static while splash label blinks [F].
- `readyToSpinEffect` float-equality on `reelY.current === defaultY` — works only because `placeY` writes the exact value [K].
- `propsSyncEffect` rewrites all props on any change (fresh `scale`/`pivot` identities per frame during tweens) — noisy, and the delivery mechanism for C1 [K].
- Reel sequencing via `setTimeout` (145ms stagger) — not frame-aligned [K].
- Dead code: `SymbolWrap.svelte`, unused `lodash`/`sequence` imports in `bookEventHandlerMap.ts`, `card-icon-swing` keyframes, `AmountFadeProvider` fade [F, K].
- `console.info` diagnostics on every All-In spin [F]; no `prefers-reduced-motion` anywhere [F, S]; board `{#each}` keyed by index instead of the symbol `id` [F].
- No animation regression coverage: no deterministic stories, visual snapshots, frame-time budgets, or atlas validation [S].

---

## Consensus on what's already good

Pre-spin wrap math is frame-exact (invisible loop seam); `reelStopEasing` intent and the `forceStop`/`createInterruptible` design are sound [K]; the CSS/HUD layer is clean (no `transition: all`, no layout-property animation) and non-count-up easings are well chosen and varied [F]; the deferred-wave loading *strategy* is right — only its side effects (C1, H8) need handling [K].

## Notes on disagreements

- **EnableSharedTicker's origin story:** [K]'s C1 chain explains the frozen animations the component's comment attributes to shared-ticker throttling; both are plausible PIXI failure modes, and the ticker-kill-on-throw mechanism [K] explains the "listener error killed shared.update" observation. Either way the fix direction is the same: repair the causes, remove the patch.
- **Leak severity:** [F] read the destroyed-emitter updates as active per-frame cost; [K]'s library read says post-destroy `update()` no-ops for `ParticleEmitter` (the cost is the growing callback list + ticker-kill hazard) but confirms `Particles.svelte` does live work after unmount. Merged as C3 either way.

## Combined summary

| Severity | Count | Status |
|----------|------:|--------|
| CRITICAL | 3 | block |
| HIGH | 11 | block |
| MEDIUM | 14 | info |
| LOW | ~15 | note |

**Verdict: BLOCK.**

## Suggested order of attack (impact ÷ effort)

| # | Fix | Effort |
|---|-----|--------|
| 1 | C1 — AnimatedSprite textures freeze | ~5 lines |
| 2 | C2+C3 — one render loop; fix leaks; drop `{#key oncomplete}`; delete EnableSharedTicker | small |
| 3 | H9 — outro `$state(false)` | 1 char |
| 4 | H7 — payline per-axis scale | 1 line |
| 5 | H5 — count-up easing + duration | small |
| 6 | H1 — retime `animationSpeed` to source fps | tuning |
| 7 | MEDIUM — emitter time units + no `init()` per tier (with H6 board cross-fade) | small |
| 8 | H3+H4 — velocity-continuous stop easing + reel motion blur | small/medium |
| 9 | H10 — turbo/skip gating + super-turbo timescale | medium |
| 10 | H11 — cache static Graphics; move breathing to Container scale | medium |
| 11 | H8 — asset diet, ≤4096 atlases, prewarm uploads | medium |
| 12 | H2 — re-author win/idle art to one style; kill ping-pong reversal | large (art) |
