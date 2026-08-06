# 13 — Frame decimation, reversed one-shots, and no reel motion treatment

- **Covers:** R4 (PARTIAL), R5b (HIGH), R7 (HIGH) — all 3-agent · **Effort:** ~1–2 weeks, art-led · **Blocked by:** plans 05 and 07
- **Files:** `apps/forest-gang/static/assets/sprites/**`, the generator scripts, `Board.svelte`, `ExpandedSymbolOverlay.svelte`, `constants.ts`

The largest effort and the largest visual payoff. This is an art production task with engineering support, not the reverse — it should not be scheduled as a code ticket.

## Problem

### R4 — the sheets lack temporal samples

Playback rates rose this round (scatter 0.36, wild 0.4, wins 0.36, idles 0.28 + per-symbol jitter, medallion 0.3, expanded animals 0.25, deer 0.2), giving roughly 12–24 fps effective against 8–18 before. `Board.svelte:611` also added a `startFrame` offset per (reel, symbol) so idle loops no longer blink in lockstep — a good unrequested addition.

**But unique frame counts did not increase.** Measured from the sheet JSONs: animal wins (`*_win_v2`) **35** each, letter wins **31** each, idles **41** (bear/fox/squirrel/wolf) to **45** (rabbit), money **40** each. Note the 31-frame letter sheets are exactly the ones plan 03 deletes, so post-03 this reads simply "every hero win clip is 35 frames" — and `LETTER_WIN_TRIM_START/END` (10 frames off 31, ping-ponged back up to 40 textures) becomes moot with them. The decimation Rev 3 identified — win clips resampled from 55–79 source frames to N=40, expansion clips taking every 3rd of ~120 — is untouched. What changed is playback *rate*, which Rev 3's Disproved #6 explicitly warned is not the fix: raising the rate plays the same jumps faster without adding samples. Expanded animals remain at 15 fps and the deer at 12 fps.

**Source clip durations are still absent from the tree**, so whether any given clip currently plays faster or slower than authored is not derivable. Only the decimation is provable.

### R5b — directional clips play backwards

Ping-pong construction at `Board.svelte:82,89` and `ExpandedSymbolOverlay.svelte:65,84` appends the reversed frame range. Money falls and character actions therefore run backwards after reaching the end. Ping-pong is legitimate for subtle ambient idle motion; it is wrong for directional coin falls and one-shot acting.

The style half of R5 **is** fixed — the new `*_win_v2` sheets match the idle art in character identity, clothing, rendering style and framing. That was confirmed by two independent visual inspections and is the round's only claim resting on eyes rather than source.

### R7 — no motion treatment on spinning reels

`constants.ts:123` `MOTION_BLUR_VELOCITY = 31` is exported and referenced nowhere; there is no `'spin'`-state art. Fully sharp symbol strips travel roughly a cell per 60 Hz frame and alias.

**It is template debt, not a design intent, and the value is wrong for this game.** The same constant is declared — and used nowhere — in **eight** apps: `cluster`, `forest-gang`, `price`, `scatter`, `magnetic-megachain`, `ways`, `number-picker`, `lines` all hardcode `31`, while `press_play_template:94` has `MOTION_BLUR_VELOCITY = SYMBOL_H * 0.7`. So `31` is a literal copied out of the template's formula, and for forest-gang's `SYMBOL_H = 103` that formula yields **72.1** — the hardcoded 31 is 43% of it. Two consequences: nobody here planned reel blur (so "it reads as an implemented feature" is a weak argument for deleting it), and **if you wire it up, do not wire up `31`** — it would threshold at less than half the velocity the template intended for a symbol this size.

## Change

### Prerequisites, in this order

1. **Plan 05 first.** Without one deterministic update/render cadence, per-clip timing cannot be measured or trusted — and a 30 fps idle cap makes any non-divisor rate pace unevenly regardless of what the art does.
2. **Plan 07 first.** It re-exports every sheet for resolution. Doing frame-count work in the same pass avoids exporting twice, but only if the pipeline is settled; otherwise sequence them.
3. **Recover or re-render the source clips.** This is the blocker for all of R4 and it is a production question, not a code one. The generator scripts (`generate_win_anim.py`, `generate_emblem_anim.py`, `generate_coin.py`, …) record the pipeline; the sources they consumed are not in the tree. Without them, "correct cadence" is unknowable and the only honest option is to author new clips.

### Then

**R4 — regenerate with adequate samples.**
- Decide a target effective fps per clip class with design. 24–30 fps for hero win animations, lower is defensible for ambient idles.
- Export enough unique frames to hit it: `N = target_fps × T_clip`.
- Set the rate per sheet as `animationSpeed = N / (60 × T_clip)`. Note `N / T_clip` is the target effective fps, **not** the PIXI value — that error was made in round 1.
- **Do not blanket-retime.** Prescribing a discrete `animationSpeed` because it divides 30 or 60 changes the clip's duration, which is Rev 3's Disproved #6. Preserve each measured duration; let plan 05's unified cadence handle pacing.
- Watch the payload budget. More frames means more bytes, and this competes directly with plan 07's resolution increase. Expect to trade: fewer frames on ambient loops, more on hero clips.

**R5b — play directional clips forward.**
- Preferred: author `intro → held/loopable idle → outro` so a clip can start, sustain and end without reversing.
- Minimum viable: play one-shots forward once and hold a clean final frame. That requires the final frame to *be* clean — several letter-win clips fade through black, which is why `LETTER_WIN_TRIM_START/END` exists. Trim or re-author the endpoints.
- Keep ping-pong for genuinely reversible ambient motion (idle breathing, a glint sweep that reads either way).

**R7 — reel motion treatment.**
- Preferred: pre-blurred spin-strip art, swapped in while `motion === 'spinning'`. No runtime filter cost.
- Alternative: a bounded per-reel vertical `BlurFilter` while spinning. **Profile on target mobile before committing** — this is Sol's caveat and it is the reason R7 has stayed open rather than being an obvious win.
- Either way, connect or delete `MOTION_BLUR_VELOCITY`. A dead exported constant reads as an implemented feature.

## Do not

- Do not raise `animationSpeed` further as a substitute for frames. It plays the same jumps faster. This was disproved in round 1, and shipping it anyway is what turned R4 from "fixed" into "partial".
- Do not claim a clip plays at the wrong speed relative to its source. The sources are absent; only the decimation is provable. Two agents were corrected on this.
- Do not remove ping-pong globally. Ambient idle motion is a legitimate use.
- Do not add a runtime blur without mobile profiling.

## Verify

1. **Frame-count table** per sheet: unique frames, measured `T_clip`, resulting effective fps. Every hero clip should hit the agreed target.
2. **Frame-step capture** of a win animation — no visible jump between consecutive frames.
3. **No clip runs backwards** except designated ambient loops. Watch every money clip and every win clip start to finish.
4. **Payload budget** after the combined 07 + 13 export. Compare against the 4.7 MB blocking target from `1763ced` and get an explicit decision if it is exceeded.
5. **Spin treatment profiled** on the lowest-tier target device, with frame times before and after; abandon the runtime-filter route if it costs more than a few ms.
6. **Cadence check after plan 05:** state an acceptable cadence error and measure against it — **"no uneven holds" is not achievable across this plan's own target range.** A 24 fps clip on a 60 Hz cadence necessarily holds 2/3 render ticks; within 24-30 fps only 30 divides 60 evenly. Either accept a bounded hold variation while preserving authored duration, or make cadence-compatibility an export requirement (target fps divides the render cadence) — but do not carry both a 24 fps target and a zero-unevenness acceptance test.

## Done when

Every hero clip has enough unique frames to hit its agreed fps at its authored duration, no directional clip reverses, the reels have a motion treatment or `MOTION_BLUR_VELOCITY` is deleted, and the payload is within an agreed budget.
