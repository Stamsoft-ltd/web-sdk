# Stake review — decoding "poor animations"

- **Date:** 2026-07-27
- **Feedback:** 2 stars from the Stake review team. One reviewer comment: *"poor animations."* No further detail.
- **Build reviewed:** current `feature/forest-gang-v1` — per the team, the latest branch code (local `1e1a2dd`, `origin` `01c7f19`). **Stated, not independently verified.** Everything else below is verified against the tree.
- **Purpose:** translate two words of reviewer feedback into the specific things on screen that produced them.

---

## Status — updated 2026-07-27, after PR #21 and #22

The analysis below is unchanged and still the plan. This section tracks what has landed against it.

| # | Item | Type | Status |
|---|---|---|---|
| — | Frozen expanded-animal clip (companion doc, Finding 1) | code | **Merged** — PR #21, `6f914df`. Was on a sibling branch, not on `feature/forest-gang-v1`; the companion doc's "it is current `HEAD`" was wrong at the time and is now true |
| — | Ticker frame pacing — see *"The 60 fps cap was capping at 58"* below | code | **Merged** — PR #22, `3069dc1` |
| 1 | Confirm source clip masters exist | blocking question | **Not asked.** Still the blocker for everything below it |
| 2 | Drop ping-pong on directional clips (R5b) | code | **Measured, not fixed.** Per-sheet verdicts now in §2 — the decision is no longer a guess |
| 3 | Splash crossfade | code | **Merged** — PR #22, `3069dc1` |
| 3 | Spine mix | code | Open |
| 4 | Re-export sheets at full frame count (R4) | art | **Split.** The judder half — alternating 50/50/33 ms frame holds from non-tick-divisible `animationSpeed`s — shipped as **PR #26** (every cadence is now an exact divisor of the 60 Hz tick; the idle speed-jitter removed with it). The frame-count half remains blocked on #1, now sharpened: the "masters" are the **Magnific mp4s** consumed by `generate_win_anim.py` / `generate_expand_anim.py` (`tools/assets/sprites/rabbitMoney/`), where the decimation is one line of config (`N, STEP = 40, 3`). If the mp4s are gone, AI frame interpolation (RIFE) over the existing evenly-sampled frames is the no-artist fallback; note the money sheets exceed a 4096px atlas beyond ~40 frames and need multi-page sheets at 2× density |
| 5 | Reel spin-state art or bounded blur (R7) | ~~art~~ + code | **PR #25** — resolved with zero artist involvement. Four variants built and compared side by side (`spike/r7-*` branches); shipped: generated pre-blurred spin tiles (a scripted 180°-shutter smear of the existing art, desktop and landscape sets) + echo ghosts of the blurred tile for the velocity turbo carries above base speed, gated on the reel's measured per-tick velocity against `MOTION_BLUR_VELOCITY` — the constant finally has its consumer. Runtime `BlurFilter` was built and rejected (render-to-texture cost on mobile) |

**Update:** R5b closed in PR #23 (all three sheet groups measured, no clip plays backwards), R7 closed in PR #25. Of the three findings that dominate screen time only **R4 remains**, and it is blocked on the source-masters question — which still has not been asked.

---

## Headline

**Twelve of the thirteen remediation plans landed. The one that did not is the only one about how the animation looks.**

Plans 01–12 and 14 all shipped in the 56 commits between `3cdde5b` and the reviewed build. **Plan 13 — `13-art-reauthoring-and-motion.md` — never landed.** Its own header reads:

> The largest effort and the largest visual payoff. This is an art production task with engineering support, not the reverse — it should not be scheduled as a code ticket.

Plan 13 covers exactly three findings: **R4** (frame decimation), **R5b** (reversed one-shots), **R7** (no reel motion treatment). Those three are the entire visible surface of animation quality.

Everything that did land — single ticker owner, velocity-continuous reel stop, texture memory, dead rAF loops, win-payoff choreography, geometry caching, asset residency — was provable from source and largely invisible to a player. The reviewer sees only plan 13.

**"Poor animations" is plan 13, verbatim.** It is not a mystery, and it is not a code defect list.

---

## What the reviewer saw, ranked by screen time

### 1. Reels strobe on every spin — R7

`apps/forest-gang/src/game/constants.ts:131` still declares:

```ts
export const MOTION_BLUR_VELOCITY = 31;
```

It is referenced nowhere in the app. There is no spin-state art and no blur pass. Fully sharp symbol strips travel roughly a full cell per frame and alias.

**Why it dominates:** this is the highest-exposure surface in the game. A reviewer sees a hundred spins before they see a bonus. Every competitor ships either pre-blurred spin strips or a bounded vertical blur; its absence is what makes a spin read as "flat" without the viewer being able to name the cause.

### 2. Win and action clips play backwards — R5b

Ping-pong construction is unchanged:

- `apps/forest-gang/src/components/Board.svelte:80` — `const pingPong = (t: Texture[]) => (t.length > 2 ? [...t, ...t.slice(1, -1).reverse()] : t);`
- `apps/forest-gang/src/components/Board.svelte:73` — same shape, inline
- `apps/forest-gang/src/components/ExpandedSymbolOverlay.svelte:93` — `frames = [...t, ...t.slice(1, -1).reverse()];`

35 authored frames become 68 textures: forward, then rewind. The wolf howls, then un-howls. Coins fall, then rise back up.

**Why it matters disproportionately:** ping-pong on a directional one-shot is the single most recognizable low-budget tell in 2D slot art. Someone who reviews games professionally identifies it in one spin. Ping-pong remains legitimate for subtle ambient idle motion — the objection is scoped to directional falls and one-shot character acting.

**This is the one item in plan 13 that is a code fix, not an art order.**

#### Measured, 2026-07-27 — which clips actually need the ping-pong

"Drop the ping-pong" was until now a judgement call per clip: remove it from a sheet that does *not* loop cleanly and you trade a rewind for a hard cut at the wrap. That is now measured rather than guessed. Each sheet's **wrap seam** — the pixel delta between its last and first frame — is compared against the **median delta between adjacent frames**. A ratio near 1 means the wrap is indistinguishable from ordinary motion, i.e. the clip was authored to loop.

| sheet | frames | seam | adj. median | ratio | verdict |
|---|---|---|---|---|---|
| `wild_anim_v3` | 40 | 8.55 | 5.56 | **1.5** | loops clean |
| `scatter_anim` | 40 | 4.54 | 5.44 | **0.8** | loops clean |
| `fox_money` | 40 | 20.41 | 12.22 | 1.7 | loops clean |
| `rabbit_money` | 40 | 24.62 | 13.11 | 1.9 | loops clean |
| `squirrel_money` | 40 | 24.27 | 11.90 | 2.0 | borderline |
| `wolf_money` | 40 | 23.53 | 10.45 | 2.3 | pops |
| `bear_money` | 40 | 26.39 | 9.21 | 2.9 | pops |
| `wolf_win_v2` | 35 | 40.05 | 14.32 | 2.8 | directional |
| `squirrel_win_v2` | 35 | 35.83 | 11.18 | 3.2 | directional |
| `bear_win_v2` | 35 | 26.88 | 7.23 | 3.7 | directional |
| `rabbit_win_v2` | 35 | 29.89 | 8.15 | 3.7 | directional |
| `fox_win_v2` | 35 | 36.40 | 6.47 | 5.6 | directional |

This splits the fix into three groups, only one of which is a judgement call:

1. **`scatterAnim` / `wildAnim` — delete the ping-pong outright.** `Board.svelte:80`. Both were authored as clean loops; `scatter_anim`'s seam is *smaller* than its own average frame-to-frame delta. The ping-pong buys nothing and costs a reversed glint sweep plus double the textures. Strict improvement, no trade-off, no art.
2. **The five `*_win_v2` sheets — play forward once, hold the final frame.** `Board.svelte:73`. All five are strongly directional (2.8–5.6×). Wins are transient, so holding a clean last frame is correct and needs no loop at all.
3. **The five `*Money` expansion sheets — the only real decision.** These sustain for the whole expansion, so they must loop. `fox` and `rabbit` would loop clean today. `bear` (2.9) and `wolf` (2.3) would pop at the wrap, and `squirrel` (2.0) is borderline. Options: a short cross-dissolve at the loop point (code), or split `intro → idle → outro` (art). **Needs eyes on the clips, not another number.**

#### Related, and pointing the other way — three idle sheets loop with a seam

The idle sheets are *not* ping-ponged (`Board.svelte:idleAnimTextures` uses the raw texture list) and loop directly, so a seam in them shows on every non-winning animal on every spin:

| sheet | ratio | |
|---|---|---|
| `rabbit_idle` | 1.3 | clean |
| `fox_idle` | 1.4 | clean |
| `bear_idle` | 2.1 | **pops** |
| `squirrel_idle` | 2.2 | **pops** |
| `wolf_idle` | 2.5 | **pops** |

Absolute seam magnitudes are small (7–13 vs 20–40 for the win sheets) because idle motion is subtle, so this is a much quieter defect than R5b. But it is the *inverse* fix: per this document's own carve-out — *"ping-pong remains legitimate for subtle ambient idle motion"* — bear, squirrel and wolf idles are the three clips that would legitimately benefit from **adding** it.

### 3. The feature reveal is the choppiest thing in the game — R4

PIXI advances `_currentTime += animationSpeed × deltaTime` and displays `floor(_currentTime)`. The ticker is now capped at 60 Hz (`SceneAnimationDriver.svelte:35`), so effective rates are:

| what | speed | effective | source |
|---|---|---|---|
| deer presenter | 0.2 | **12 fps** | `ExpandedSymbolPresenter.svelte:336` |
| expanded animal | 0.25 | **15 fps** | `ExpandedSymbolOverlay.svelte:284` |
| idle symbols | 0.28 + jitter | 16.8 fps | `Board.svelte:556` |
| bonus panel / logo | 0.28 | 16.8 fps | `BonusSymbolPanel.svelte:200`, `GameLogoFrame.svelte:184` |
| free-spin intro/outro | 0.3 | 18 fps | `FreeSpinIntro.svelte:216`, `FreeSpinOutro.svelte:177` |
| scatter | 0.36 | 21.6 fps | `Board.svelte:417` |
| symbol wins | 0.36 | 21.6 fps | `Board.svelte:478` |
| WILD | 0.4 | 24 fps | `Board.svelte:433` |

**The priority is inverted.** The expanded-symbol reveal — the moment the game is judged on — runs at 12–15 fps while ordinary background idle runs at 16.8.

**It also judders.** 0.36 and 0.4 do not divide evenly into a 60 Hz tick:

| speed | ticks per frame | hold pattern |
|---|---|---|
| 0.36 | 2.78 | 50 ms, 50 ms, 33 ms |
| 0.40 | 2.50 | 50 ms, 33 ms |

The two most-watched sprites in the game — the winning symbol and the WILD — are the two with the worst pacing wobble. `SceneAnimationDriver.svelte:35` documents this and explicitly defers the resolution to plan 13.

**Root cause is the sheets, not the rates.** Measured unique frame counts in the current tree:

| sheet | unique frames |
|---|---|
| `rabbit_idle.json` | 45 |
| `wolf_idle` / `squirrel_idle` / `fox_idle` / `bear_idle` | 41 |
| `*_win_v2` (all five animals) | 35 |

Per plan 13, win clips were resampled down from 55–79 source frames, and expansion clips take every 3rd frame of roughly 120. **The smoothness was discarded at export.** The previous round raised `animationSpeed` — that plays the same gaps faster without refilling them, which Rev 3's Disproved #6 had already warned against.

### 4. Two hard cuts outside plan 13

- ~~**Splash carousel.**~~ `SplashIntro.svelte:45` — `setInterval(() => (slide = (slide + 1) % SLIDE_COUNT), 3000)`. A bare block swap with no crossfade, and it is the first motion any player sees. **Fixed in PR #22** — the three blocks stay mounted and stacked, cross-fading on `opacity` over 450 ms. Keeping them mounted also stopped `fitLabel` re-measuring every text block every 3 s.
- **Spine state changes.** `packages/pixi-svelte/src/lib/components/SpineTrack.svelte:26,45` — `setEmptyAnimation(trackIndex, 0)` with mix 0 hard-cuts. Affects `FreeSpinAnimation`, `TransitionAnimation`, and the win-popup spines. Test `intro → idle` visually before adding a 0.1–0.2 s mix; authored endpoints may already line up. **Still open.**

### 5. The 60 fps cap was capping at 58 — and every drop was a doubled frame

*Found 2026-07-27, not present in the original analysis. Fixed in PR #22 (`3069dc1`).*

`SceneAnimationDriver.svelte` set `MAX_FPS = 60` to hold update and render to one cadence. That line was itself what prevented 60 fps.

PIXI's throttle truncates the elapsed time to whole milliseconds *before* testing it — `const delta = currentTime - this._lastFrame | 0` (`Ticker.mjs:246`) — then compares it against `_minElapsedMS = 1000 / maxFPS`. At `maxFPS = 60` the threshold is 16.6667 ms while a real 16.67 ms vsync frame truncates to `16`, which is less. **The frame is dropped.** The cap admits only frames of ≥ 17 ms — a hard ceiling of 58.8 fps, reachable by no display.

A dropped frame is also worse than a missing one. The early `return` happens before `this.lastTime = currentTime`, so the elapsed time is not consumed — the *next* accepted frame carries `deltaTime` 2.0 and every time-based tween and sprite advance takes a double step. The result is a periodic hitch, not a uniformly lower rate.

Simulated against that exact code path:

| panel | `maxFPS` | fps | frames dropped | `deltaTime` |
|---|---|---|---|---|
| 60 Hz | 60 (before) | 58.0 | 9/299 | mean 1.031, **max 2.001** |
| 60 Hz | **62 (after)** | **59.8** | **0/299** | mean 1.000, max 1.061 |
| 120 Hz | 60 (before) | 58.0 | 309/599 | mean 1.031 |
| 120 Hz | **62 (after)** | **60.0** | 299/599 | mean 0.997 |

Reproduces with zero timing jitter (3/299 dropped), so it is the truncation and not timing noise. Any value ≥ 62 behaves identically on a 60 Hz panel — the constant only has to clear the truncation, it does not name the target rate. 62 still throttles a 120 Hz ProMotion panel, so it is strictly better on both.

**Scope of the win, honestly stated:** this makes the motion the game already has run smoothly and removes a hitch roughly twice a second. It adds no frames to any sheet. It does not touch R4 — see the note on scope at the end.

---

## Blocker: the source frames are not in the repo

Re-exporting at full frame count requires the original sequences. They are not in the tree:

- `apps/forest-gang/source_assets/` contains only static reference PNGs (`background-source.png`, `wild-symbol-source.png`, per-animal stills under `Slots Figma/`).
- The archived `Forest Gang_Project/` and `old_assets/` in git history are documents, screenshots, old Spine JSON and stills — 38 objects, no per-frame sequences.

**Confirm with whoever produced the original clips that the 55–79 frame masters still exist.** That answer decides whether plan 13 is a re-export measured in days or a re-animation measured in weeks. Nothing else in the plan can be scoped until it is settled.

---

## Recommended order

| # | Item | Type | Notes |
|---|---|---|---|
| 1 | Confirm source clip masters exist | blocking question | **Still not asked.** Decides the scope of everything below |
| 2a | Delete ping-pong on `scatterAnim` / `wildAnim` | **code**, 1 line | **Done, PR #23.** Measured as clean loops (0.8 / 1.5) |
| 2b | Win sheets: play forward once, hold final frame | **code**, small | **Done, PR #23.** All five measured strongly directional (2.8–5.6); all five final frames verified as deliberate poses |
| 2c | Money sheets: loop treatment | ~~decision~~ | **Done, PR #23.** Decided by eyes-on review plus measurement: no clean loop point exists anywhere in the sheets (tail-trim explored, best 2.64), and every final frame is a deliberate celebration pose — play once, hold, ±2% breathe |
| 3 | ~~Splash crossfade~~ + Spine mix | code, small | Splash **done** (PR #22). `SpineTrack.svelte:26,45` still open |
| 4 | Re-export sheets at full frame count (R4) | **art** | Then set per-clip cadence so rates divide evenly into 60 Hz. Raise the expanded-symbol and deer clips first — they are the lowest fps and the most watched. Since PR #22 the tick is a steady `deltaTime` 1.0, so this per-clip arithmetic is now worth doing — before it, doubled frames would have broken any cadence chosen |
| 5 | Reel spin-state art or bounded blur (R7) | **art** + code | Profile on target mobile before choosing. `MOTION_BLUR_VELOCITY` is already declared and unused. Symbols draw individually via `symbolY()` with no per-reel container, so a code-only path exists: one `Container` per reel carrying a `BlurFilter` with `strengthX = 0` and `strengthY` scaled by Δ`reelY`/frame. Costs one render pass per spinning reel — if that does not hold up on target mobile, it reverts to an art order |

---

## Note on scope

Items 4 and 5 are art orders, not tickets. No amount of editing Svelte moves a 2-star animation score, because the frames genuinely are not present in the sheets. Plan 13 said this at the time it was written; the review confirms it empirically.

Item 2 is the exception — a real code fix, small, and it addresses the defect most likely to have triggered the specific phrase used.

The two items merged since (PR #21, PR #22) do not change this. The frozen-clip fix removed a hard defect and the frame-pacing fix removed a periodic hitch — both real, neither adding a single frame to a single sheet. **The score still lives in items 4 and 5.**

---

*Verified against the working tree at `fd75e79`. Plan-landing status derived from `git log 3cdde5b..HEAD`. Frame counts measured from the sheet JSONs. Effective fps derived from PIXI's `AnimatedSprite` advance rule against the 60 Hz cap in `SceneAnimationDriver.svelte`.*

*Updated 2026-07-27 against `3069dc1`. Loop-seam ratios measured from the sheet atlases — each frame untrimmed onto its `sourceSize` canvas, mean per-pixel RGBA delta, wrap seam over median adjacent-frame delta. Ticker figures simulated against a transcription of `Ticker.update()` from the installed `pixi.js@8.8.1`, driven by jittered 60 Hz and 120 Hz frame streams.*
