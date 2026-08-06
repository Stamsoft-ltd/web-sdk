# SOL Animation Audit

## Executive summary

The feedback that the animations are poor quality is justified. The recent polish pass adjusts timing, but the largest problems are source-asset consistency, reversed clips, rendering performance, and visual alignment.

## Findings

### [HIGH] Win animations visibly change art style

**Files:**
- `apps/forest-gang/src/components/Board.svelte:55-82`
- `apps/forest-gang/src/components/Board.svelte:420-455`

**Issue:** Idle animals are transparent semi-realistic cutouts, while win sheets are fully opaque rectangular scenes with different proportions, costumes, crowns, and backgrounds. Expanded “money” animations show similar pose and scale discontinuities. These transitions read as unrelated AI-generated clips rather than the same character animating.

**Fix:** Re-author from one consistent rig and style—preferably transparent Spine rigs—or create art-directed sprite animations with fixed silhouettes, costumes, lighting, and anchors.

### [HIGH] One-shot actions are played backward

**Files:**
- `apps/forest-gang/src/components/Board.svelte:82`
- `apps/forest-gang/src/components/ExpandedSymbolOverlay.svelte:51-84`

**Issue:** Non-looping clips are converted into ping-pong loops. Character actions and falling coins consequently reverse direction, which looks synthetic and physically wrong.

**Fix:** Use authored `intro → idle → outro` sequences. Otherwise, play once and hold a clean final frame instead of reversing.

### [HIGH] Animation loading can consume roughly 484 MB of decoded texture memory

**Files:**
- `apps/forest-gang/src/game/assets.ts:262-361`
- `apps/forest-gang/src/game/assets.ts:376-425`
- `packages/pixi-svelte/src/lib/components/AssetsLoader.svelte:63-82`

**Issue:** The referenced sprite sheets total approximately 484 MB as decoded RGBA textures, excluding static art, video, Spine, and CPU-side decoding. Wave 0 alone loads about 282 MB concurrently through `Promise.all`, immediately after play becomes available. This can cause upload stalls, dropped frames, and mobile GPU eviction. The preloaded loading sheet is also 5992px wide, exceeding the 4096 texture limit on some fallback devices.

**Fix:** Load animations only when their feature is entered, unload them afterward, stagger uploads, trim transparent space, reduce frame dimensions and counts, and split atlases below 4096px.

### [HIGH] Reel “deceleration” begins with a large acceleration spike

**Files:**
- `apps/forest-gang/src/game/constants.ts:74-90`
- `packages/utils-slots/src/createReelForSpinning.svelte.ts:280-299`

**Issue:** The reel changes from linear `2.3px/ms` to a `2.8px/ms` segment using `cubicOut`. Since `cubicOut` starts at roughly three times its average velocity, the approach begins near `8.4px/ms`—over 3.5 times the preceding speed—before slowing. This creates the exact snap the change intended to remove.

**Fix:** Use an easing whose initial derivative matches the incoming velocity, or calculate duration and easing from continuous velocity constraints.

### [HIGH] The scene is likely rendered twice each frame

**Files:**
- `apps/forest-gang/src/components/EnableSharedTicker.svelte:20-77`
- `packages/pixi-svelte/src/lib/components/InitialiseApplication.svelte:31-43`

**Issue:** Pixi’s application ticker remains auto-started, while a second RAF traverses the entire stage and calls `app.render()` again. This doubles rendering work and adds a full scene-graph walk every frame.

**Fix:** Use one ticker. Either disable Pixi auto-start explicitly or move sprite and Spine advancement onto the application ticker and remove the manual render loop.

### [HIGH] Paylines do not use the board’s actual scaling

**Files:**
- `apps/forest-gang/src/components/Game.svelte:420-425`
- `apps/forest-gang/src/game/stateGame.svelte.ts:290-308`

**Issue:** Paylines use uniform `boardScale`, while reel positions use `boardScaleX` and `boardScaleY`. Lines therefore miss symbol centers—by about 12% in landscape and 6–7% per axis on desktop.

**Fix:** Apply `scale={{ x: bl.boardScaleX, y: bl.boardScaleY }}` to the payline container.

### [MEDIUM] First free-spin outro skips its entrance choreography

**File:** `apps/forest-gang/src/components/FreeSpinOutro.svelte:57-95`

**Issue:** `show` starts as `true`, so the 750ms slide plays during initial application mount before any outro content exists. The first actual outro sets `true` again and does not retrigger it.

**Fix:** Initialize `show` to `false` and reset the entrance tween when outro data arrives.

### [MEDIUM] Transition is mislabeled and visually off-theme

**Files:**
- `apps/forest-gang/src/components/TransitionAnimation.svelte:18-55`
- `apps/forest-gang/static/assets/spines/transition/transition.atlas:1-44`

**Issue:** The supposed “forest leaves” wipe contains generic coins, rocks, dust, sparks, and purple debris. Its atlas declares `1219×1042`, while the image is `1215×1038`, clipping several regions.

**Fix:** Replace it with authored forest foliage or retain a clean veil transition. Re-export the atlas against the exact texture dimensions.

### [MEDIUM] No motion or performance regression coverage

**Project:** `apps/forest-gang`

**Issue:** There are stories but no automated animation tests, visual snapshots, frame-time budgets, reduced-motion behavior, or atlas validation.

**Fix:** Add deterministic animation stories, Playwright screenshots at key timestamps and layouts, GPU and atlas validation, and `prefers-reduced-motion` handling.

## Review summary

| Severity | Count | Status |
|----------|------:|--------|
| CRITICAL | 0 | pass |
| HIGH | 6 | block |
| MEDIUM | 3 | info |
| LOW | 0 | note |

**Verdict: BLOCK** — prioritize replacing the inconsistent character clips, fixing the render and loading architecture, and correcting reel and payline motion before further timing polish.

## Validation note

Build and lint could not be executed because `pnpm` and installed dependencies were unavailable in the audit environment. The findings above are based on static code review, animation-frame sampling, atlas validation, texture-footprint analysis, and inspection of the recent animation changes.
