# 08 — The reel-stop parameters are configured beside the spin speed instead of derived from it

- **Covers:** R6 (3-agent, HIGH — settled by three independent derivations) · **Effort:** ~half a day · **Blocked by:** nothing
- **Files:** `apps/forest-gang/src/game/constants.ts`, `packages/utils-slots/src/createReelForSpinning.svelte.ts`

## Problem

**The structural defect, stated first.** `reelSpinSpeedBeforeBounce` is a **single shared constant** (2.8), but the incoming velocity at the handoff is chosen by two *independent* mechanisms, so one constant cannot match it.

**Which spin functions even reach the eased leg** (`createReelForSpinning.svelte.ts`): only `normalSpin` (`:280-296`) and `anticipatedSpin` (`:299-313`). `fastSpin` (`:268-277`) performs a single linear `slideY` and never reads `reelSpinSpeedBeforeBounce` or `reelStopEasing`. **Super-turbo therefore never executes this handoff at all** — `getSpinType` returns `'fast'` unconditionally for it (`createEnhanceBoardSpin.ts:43-56`).

**But which options object is in force is decided separately**, in `stateGame.svelte.ts:61-81`, and that predicate checks turbo/autospin **before** it looks at `spinType`. So turbo *does* reach the eased leg — on any spin with anticipation, reels at or after the first anticipated reel that are not themselves anticipated get `spinType 'normal'` — and it arrives carrying `SPIN_OPTIONS_TURBO`. The reachable incoming speeds are a cross product, not a list of modes:

| path to the eased leg | options in force | `v_in` | ratio at handoff (`3 × 2.8 / v_in`) |
|---|---|---:|---:|
| default `normalSpin` | `DEFAULT` | 2.3 | **3.65×** |
| anticipated reel (bought inherits 3.0) | `ANTICIPATED` | 3.0 | 2.80× |
| autospin + turbo, anticipation present | `FAST` | 4 | 2.10× |
| turbo, anticipation present | `TURBO` | 7 | 1.20× |

So the constant is wrong for **four reachable incoming speeds**, and the defect is worst in the mode players spend most of their time in and nearly absent in turbo. **That is plausibly why it was never reported** — the player most likely to notice a stop artefact is the one least exposed to it.

This supersedes two earlier framings, both wrong: mine ("three of the four modes are wrong by construction" — it is not a per-mode property) and Sol's correction to it ("fast/turbo do not execute the eased leg" — turbo does, via the `noStop` -> `'normal'` branch). The prescription is unchanged and better supported: **derive the stop from whatever `v_in` the active path supplies, at the use site.**

### The default-mode symptom, derived

`slideY` converts a speed into a tween duration (`createReelForSpinning.svelte.ts:134-148`):

```js
const slideY = async ({ reelY: targetY, speed, easing }) => {
    const distance = Math.abs(targetY - reelY.current);
    const duration = distance / speed;      // speed unit: px/ms
    await reelY.set(targetY, { duration, easing });
};
```

`normalSpin()` (`:281-296`) uses it twice:

```js
await slideY({ reelY: defaultY * basePaddingSize(), speed: reelSpinSpeed });        // 2.3, linear
await slideY({ reelY: defaultY + bounceSize,
               speed: reelSpinSpeedBeforeBounce,                                    // 2.8
               easing: reelStopEasing });                                           // cubicOut
```

Because `duration = distance / 2.8`, the second leg's **average** velocity is 2.8 px/ms. `cubicOut` is `f(t) = 1 − (1−t)³`, so `f'(0) = 3` — the instantaneous velocity at the handoff is `3 × 2.8 = 8.4 px/ms`, against 2.3 px/ms coming in. **A 3.65× step change, in the segment whose stated purpose is deceleration.**

At 8.4 px/ms a symbol travels 140 px in one 16.67 ms frame. `SYMBOL_H` is 103 (`constants.ts:8`). **The reel jumps more than a full cell in the first frame of its "deceleration".**

The comment at `constants.ts:70-72` still calls 2.8 "slower than" the 2.3 spin speed. It is not, and the easing derivative makes the real gap 3.65×. That comment is why this survived two audits — it was corrected this round to explain that the *old* value of 4 was worse, which still leaves the claim wrong.

All three agents derived this independently and reached the same number, from the shared package rather than from `constants.ts` alone. It is settled; only the fix is open.

## Change

Derive the stop from a velocity-continuity constraint rather than picking a speed constant by feel.

**The constraint:** for an easing `f` on a segment of distance `d` and duration `T`, the initial velocity is `f'(0) · d / T`. Matching it to the incoming velocity `v_in` gives `T = f'(0) · d / v_in`. For `cubicOut`, `f'(0) = 3`, so `T = 3d / v_in` — equivalently the segment's *average* speed must be `v_in / 3`.

For the default spin (`v_in` = 2.3 px/ms) that means an effective `reelSpinSpeedBeforeBounce ≈ 0.77`, not 2.8.

**Do not just change the constant to 0.77.** At 0.77 the duration becomes `distance / 0.77`, roughly 3.6× longer than today — you would trade the velocity spike for a visible crawl, and the stop would feel sluggish. The two are coupled: with `cubicOut` fixed, you cannot choose duration and initial velocity independently.

Pick one:

- **(a) Derive duration from continuity, then pick the easing to hit the wanted total time.** Compute `T` from `v_in` and `d`, then choose an easing whose `f'(0)` gives an acceptable `T`. A gentler curve (`f'(0)` closer to 1) allows a shorter, continuous stop: with a quadratic-out, `f'(0) = 2`, so `T = 2d / v_in`.
- **(b) Keep the duration you want and use a custom easing whose initial derivative matches.** Construct `f` with `f'(0) = v_in · T / d` for the chosen `T`. This gives full control over both feel and continuity, at the cost of a hand-authored curve.

Whichever you choose, **do it in `createReelForSpinning` so the stop is derived from whatever `reelSpinSpeed` the active mode supplies.** That is the actual fix for the headline defect: once the stop leg computes its own duration from the `v_in` it is actually handed, **every reachable eased-leg path is continuous automatically** and `reelSpinSpeedBeforeBounce` stops being a constant anyone has to tune. Leaving the derivation in `constants.ts` — even with a better number — leaves the other reachable incoming velocities unmatched.

Also fix the comment at `constants.ts:70-72` regardless of which route you take. If the numbers change, it should describe the constraint; if they somehow do not, it must stop claiming 2.8 is slower than 2.3.

## Do not

- Do not swap 2.8 → 0.77 alone. See above; it fixes the spike and introduces a crawl.
- Do not change `reelStopEasing` without recomputing duration. Every easing has a different `f'(0)`, so changing the curve silently changes the spike.
- Do not tune this by eye at 60 fps. A one-frame 140 px jump is close to invisible at full speed and obvious in a frame capture, which is how it went unnoticed.

## Verify

1. **Frame capture** the stop at 60 fps and measure per-frame displacement across the handoff. It should be continuous — no frame should show a jump materially larger than the preceding one. Today the first frame of the stop moves ~140 px against ~38 px before it.
2. **All four paths that reach the eased leg**, per the table above. Each must be continuous with the speed its own options object supplies. **This is the acceptance test for the headline defect**, so enumerate them rather than sampling:
   - default `normalSpin` — `v_in` **2.3** (3.65× today)
   - an anticipated reel — `v_in` **3.0** (2.80×)
   - **autospin + turbo, anticipation present** — `v_in` **4** (2.10×), FAST options reaching `normalSpin`/`anticipatedSpin` via the anticipation predicates
   - **turbo, anticipation present** — `v_in` **7** (1.20×)

   The last two are the ones nobody thinks to set up, and neither is covered by the `fastSpin` check below — they carry FAST/TURBO options but arrive through the anticipation predicates, which is the entire point of the cross product. (Sol caught this list omitting the `v_in = 4` row while Done required all four.)
3. **`fastSpin` paths are a no-regression check, not a target.** Super-turbo, and turbo without anticipation, take a single linear leg with no eased segment. Confirm they are unchanged — do **not** add an eased stop to them to satisfy the test above; they do not have this defect.
4. **Bounce and settle still read correctly** — the overshoot (`reelBounceSizeMulti`) and `reelBounceBackSpeed` legs are downstream and should be unchanged.
5. **Total stop duration** stays within a feel budget agreed with design; log before/after per path.
6. **Sibling games:** `createReelForSpinning` is in `packages/utils-slots`. If you change the shared function's behaviour rather than forest-gang's constants, smoke-test another app that spins reels.

## Done when

Per-frame displacement is continuous across the linear->eased handoff on **all four reachable eased-leg paths** (the table in the problem section), the `fastSpin` paths are unchanged and still have no eased segment, total stop duration is within budget, and `constants.ts:70-72` describes what the code does.
