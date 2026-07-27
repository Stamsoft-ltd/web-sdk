# 06 — The win payoff: count-up, tier crossings, and MAX WIN

- **Covers:** R8, R9, R14 (all 3-agent, HIGH) · **Effort:** ~3 days plus a design decision · **Blocked by:** plan 05
- **Files:** `packages/components-pixi/src/components/WinCountUpProvider.svelte`, `apps/forest-gang/src/components/Win.svelte`, `WinBoard.svelte`, `WinCoins.svelte`, `MaxWinScreen.svelte`, `packages/pixi-svelte/src/lib/components/ParticleEmitter.svelte`

**These three must be fixed together.** They all fire during the same 2–11 second window and they interact: a bare `cubicOut` on the count-up would bunch the tier crossings early and make R9 visibly worse. Fixing them separately means fixing R9 twice.

This is the largest remaining quality gap and the most-watched moment in the game. None of it changed in the post-audit commits.

## Problem

### R8 — the count-up is linear and overlong

`WinCountUpProvider.svelte:29`:
```js
const countUp = () => countUpAmount.set(props.amount, { duration: props.duration });
```
No `easing`, and Svelte's `Tween` defaults to linear. The most important number in the game climbs at constant speed and stops dead.

Duration compounds it. `Win.svelte:125` clamps to 400 ms only when `!hasBoardAnimation`, so **big-win counts run full length even in super-turbo**. `winLevelMap.ts:96` gives LEGENDARY `presentDuration: 45 * SECOND`, × 0.25 = an **11.25-second linear climb**, followed by a 3 s auto-close hold (`Win.svelte:136`).

Small and medium wins moved from ×0.25 to ×0.5 this round — a real improvement for the common case. The tier that matters most is untouched.

### R9 — tier crossings vanish the board and reset the fountain

`WinBoard.svelte:41-56` runs, on every tier change:
```js
if (displayedKey) await pop.set(0, { duration: 180, easing: cubicIn });
displayedKey = next;
await pop.set(1, { duration: 340, easing: backOut });
```
`pop.current` scales the container wrapping glow + board + amount (`:143`). A slow big-win climb crosses SWEET → WILD → EPIC → MYTHIC → LEGENDARY, so **the hero board fully disappears up to four times during its own climax.** The guard (`animating`) correctly prevents an unbounded queue and skips tiers when the count outruns a cycle — that part is sound design, not a defect.

Simultaneously, `WinCoins.svelte` rebuilds its emitter config when `tierKey` changes, and `ParticleEmitter.svelte:34-36` calls `emitter.init(updatedConfig)`, which begins with `cleanup()` — destroying every live particle. **The fountain pops out at the same instants the board vanishes.**

*Correction on the record:* `WinCoins.svelte` is byte-identical to `b14a73e`. Two agents initially credited a post-audit improvement here; `git diff` is empty. The `tierKey` discretization was always there. Nothing about R9 was fixed.

### R14 — MAX WIN hard-cuts in

`Win.svelte:154-157` conditionally swaps `MaxWinScreen` in place of the tier subtree the moment the live count crosses 25,000×, **inside an already-visible `FadeContainer`**. `MaxWinScreen.svelte:45-47` has no entrance of its own — only the ambient `breatheScale` it inherits. New art and a dedicated sound landed this round; neither is a transition. The game's biggest possible moment has the least choreography of any tier.

## Change

### Decide first (design, not engineering)

1. **The count curve.** It must decelerate into the final value without bunching the tier crossings into the first second. A reasonable shape: mostly linear through the tier range, easing out only over the final ~20%. Model it before implementing — plot amount-vs-time and mark where each tier boundary falls, for a 500× win and for a 25,000× win.
2. **Big-tier duration.** 11.25 s of climb plus 3 s of hold is long. Decide the target for LEGENDARY, and decide whether turbo should clamp big wins at all (today it does not).
3. **Tier transition.** Cross-fade is the recommendation; the pop is reserved for the final tier only.

### Then implement

1. **Add easing to `WinCountUpProvider`.** Take an optional `easing` prop rather than hardcoding — it is a shared package used by other games; the default must stay linear so no sibling game changes behaviour.
2. **Trim big-tier duration** via the `winLevelMap` factors and/or `Win.svelte:125`, and extend the turbo clamp to board wins if design agrees.
3. **Cross-fade tiers in `WinBoard`.** Replace the collapse/re-pop with two overlapping tier sprites and an alpha cross-fade; keep `pop` only for first appearance and for the final tier. The `animating` guard and tier-skipping behaviour should survive — that logic is correct.
4. **Stop re-initialising the emitter.** Mutate intensity live (`frequency`, `maxParticles`) instead of handing `ParticleEmitter` a new config object per tier. This likely needs a small shared-package change: a way to update emitter config without `init()`'s `cleanup()`. Coordinate with the emitter time-units fix (`deltaMS × 0.00234` → ~2.34× real time) — the configs are tuned against the broken scale, so units and tuning must change together or the fountain will look wrong.
5. **Give MAX WIN an entrance.** Trigger a dedicated transition on the threshold crossing — a flash, an overshoot, or a cross-fade from the LEGENDARY board — rather than substituting the component silently.

## Do not

- Do not just add `easing: cubicOut` to `WinCountUpProvider` and call R8 done. It front-loads the climb, so every tier crossing lands in the first seconds and R9's collapse fires four times in rapid succession. This was raised in round 1 and accepted by all three agents.
- Do not change the shared `WinCountUpProvider` default. Other games in `apps/` use it.
- Do not remove `WinBoard`'s `animating` guard while replacing the transition. It is what prevents a queue of stale tier transitions.
- Do not fix the emitter time units without retuning the configs in the same change.

## Verify

1. **Count curve:** capture a LEGENDARY and a 25,000× win. The number should decelerate to a stop, and no two tier crossings should land within ~400 ms of each other.
2. **Tier crossings:** the hero board must remain continuously visible through a slow big-win climb. Record and step frame-by-frame — this is the specific regression being fixed.
3. **Fountain continuity:** coins must not disappear at a tier boundary. Watch a single particle across a crossing.
4. **MAX WIN:** the 25,000× screen must have a visible entrance, distinguishable from a hard cut at 1× playback.
5. **Turbo:** confirm the intended behaviour for big wins in turbo and super-turbo, whichever design chose.
6. **Sibling games:** if `WinCountUpProvider` changed, smoke-test one other app that uses it.

## Done when

The count-up decelerates, the tier board never vanishes mid-climb, the fountain survives every crossing, and MAX WIN enters with designed choreography rather than a substitution.
