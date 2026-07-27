# 04 — Two per-frame rAF loops with no consumer

- **Covers:** N5 (3-agent, MEDIUM) · **Effort:** ~20 minutes · **Blocked by:** nothing
- **Files:** `apps/forest-gang/src/components/Board.svelte`

## Problem

Both loops were introduced by the recent commits and both drive state that nothing reads.

**(a) Win pop — `Board.svelte:241-287`.** An `$effect` maintains a `popStarts` Map keyed `"reel:row"` and runs a `requestAnimationFrame` loop for up to `POP_T` (0.8 s) every time a WILD or SCATTER enters its win state, writing `popNow`. The only reader is `popScale` (`:281-287`), and `grep -c popScale Board.svelte` returns **1** — its own definition. Nothing calls it.

This is the leftover driver of the one-shot spring pop that `3cdde5b` replaced with the continuous pulse (see the comment at `:461-462`). The call site was removed; the machinery was not. The `$effect` also re-runs on every board symbol-state change to rebuild a `Set` and reconcile the Map, so there is per-spin cost even when no pop is "running".

Dead along with it: `POP_T`, `POP_DECAY`, `POP_FREQ`, `POP_AMP`, `POP_AMP_DEFAULT` (`:241-246`), `popNow` (`:247`), `popStarts` (`:248`).

**(b) Anticipation bob — `Board.svelte:289-305`.** An unthrottled rAF runs for the **entire anticipation phase** — the longest suspense window in the game — writing `anticT`. Its only reader `anticZoom` (`:305`) also occurs once and is never referenced in the template. The comment at `:289-290` promises that "the landed scatters bob with excitement and shimmer faster"; no scatter reads `anticZoom` and no `animationSpeed` changes during anticipation. The feature was never wired up.

Dead: `anticT` (`:292`), the effect (`:293-303`), `anticZoom` (`:305`). **Keep `anticipating`** (`:291`) — check for other consumers before removing it.

## Change

Delete both blocks and their now-unused constants.

For (b) there is a product decision hiding in the deletion: **the anticipation bob was designed and never connected.** Two valid outcomes —

- **Delete it** (recommended, and what this plan assumes). The comment describes intent that was never shipped, so nothing regresses. Anticipation currently reads through reel padding and the audio duck, which is a defensible design.
- **Wire it** if design still wants it: apply `scale={anticZoom}` to the landed scatter sprite (`:470-479`) and raise its `animationSpeed` while `anticipating`. This is a feature, not a fix — it should be a separate ticket with design sign-off, not smuggled into a cleanup. Note it would also interact with plan 05: a bob at ±7% and 2.4 Hz needs a stable cadence, which only exists after the ticker work.

Ask design which; default to delete.

## Do not

Do not delete `anticipating` (`:291`) reflexively — grep for it first. It is a plausible consumer elsewhere in the component and is not part of this defect.

Do not "fix" (a) by re-adding a `popScale(...)` call to the scatter/wild templates. The continuous pulse replaced the one-shot pop deliberately (`:461-462`), and stacking both would double-scale the emblem on win entry. Note that the pulse itself is separately broken — see plan 02, which is the actual fix for special-symbol win animation.

## Verify

1. `grep -n 'popScale\|popNow\|popStarts\|POP_\|anticT\|anticZoom' Board.svelte` returns nothing.
2. `pnpm svelte-check` reports no new errors (the repo was at zero as of `86c0237`).
3. **Behavioural no-op:** a wild/scatter win looks identical before and after (the pulse from plan 02 is what animates it, not this code). An anticipation spin looks identical.
4. Confirm the loops are gone: during an anticipation spin, no rAF callback attributable to `Board.svelte` should be scheduled.

## Done when

Both blocks are removed, `svelte-check` is clean, and wild/scatter wins plus anticipation spins are visually unchanged.

**Sequencing note:** do this before plan 05. Plan 05 consolidates the app's clocks, and two of the clocks it would otherwise have to account for are these — driving nothing.
