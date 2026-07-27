# 01 — The first bonus outro hard-pops in with no animation

- **Covers:** R13 (3-agent, HIGH) · **Effort:** ~5 minutes · **Blocked by:** nothing
- **Files:** `apps/forest-gang/src/components/FreeSpinOutro.svelte`

## Problem

`FreeSpinOutro.svelte:60` initialises `let show = $state(true)`. The intro correctly uses `$state(false)` (`FreeSpinIntro.svelte:66`).

Two consequences, both verified:

1. The entry `$effect` (`:69-74`) runs once at app mount, when `show` is already `true`. It plays the 750 ms `slideIn` tween to completion while `winLevelData` is still undefined, so nothing is on screen. When the first real bonus ends, `freeSpinOutroShow` sets `show = true` — no state change, so the effect never re-runs and `slideIn` stays at 1. **The first CONGRATULATIONS screen a player ever sees hard-cuts in.** Every subsequent outro animates correctly, because by then `show` has been toggled to `false` and back.
2. The pulse clock at `:78-87` is gated on `show`, so it runs a `requestAnimationFrame` loop from app launch through the entire base game.

**Aggravating factor from this round's commits:** the auto-advance timer was deliberately removed (`:100-108` now waits on a press). So the first summary both hard-pops *and* then sits on screen until the player presses. This revision edited the lines immediately around `:60` without changing it.

## Change

```diff
-	let show = $state(true);
+	let show = $state(false);
```

That is the entire fix. The entry effect then fires on the first genuine `false → true` transition, and the pulse clock does not start until a bonus actually ends.

## Do not

Do not "fix" this by forcing the tween in the `freeSpinOutroShow` handler (e.g. calling `slideIn.set(0)` then `slideIn.set(1)` there). It would work, but it duplicates logic the `$effect` already owns and leaves the mount-time clock running. The state initialiser is the actual defect.

## Verify

1. Cold-load the game, trigger a bonus, let it finish. The board should slide up from the bottom and CONGRATULATIONS drop from the top, over ~750 ms — matching the intro's entrance and matching a *second* bonus outro today.
2. Confirm the clock no longer runs at launch: with the game idle on the base game, `animT` should stay 0 (or set a breakpoint in the `tick` closure at `:82` — it should not be reached before a bonus ends).
3. Compare first-outro and second-outro entrances; they should now be identical.

## Done when

The first bonus outro of a session animates in exactly like the second, and no rAF loop attributable to `FreeSpinOutro` is running while the base game is idle.
