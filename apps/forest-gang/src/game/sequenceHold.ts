import { stateBet } from 'state-shared';
import { createInterruptible } from 'utils-shared/interruptible';
import { waitForTimeout } from 'utils-shared/wait';

// ── Interruptible sequence holds ─────────────────────────────────────────────────────────────
//
// Every deliberate pause in an animation sequence goes through `hold()` instead of a raw
// `waitForTimeout`, so that it (a) scales with the player's speed mode and (b) resolves early
// when the player presses stop. A raw timeout can do neither: a skip press during one is simply
// ignored, because there is nothing to cancel.
//
// ONE interruptible for the whole book, not one per handler. `createInterruptible`'s
// `pendingInterrupt` is sticky, so a single stop press makes every REMAINING hold of the round
// resolve immediately without racing each one — which is exactly what "skip the rest of this
// round" means. The flip side is the trap: a leaked interrupt would make every hold of every
// LATER spin resolve instantly, a silent permanent turbo with no flag set. `resetHolds()` is
// therefore called on BOTH entry to and exit from `playBet` (see game/utils.ts). `clear()` also
// empties `resolveList`, which `interrupt()` deliberately does not — without it the list would
// grow across rounds with already-settled resolvers.
const interruptible = createInterruptible();

/**
 * Hold scale by speed mode.
 *
 * Deliberately NOT `stateBetDerived.timeScale()`: that value is the *Spine* time scale and
 * returns 1.5 for BOTH turbo and super-turbo, so reusing it here would leave the two modes
 * indistinguishable — the very bug this is meant to fix. (forest-gang binds no Spine to
 * `timeScale()`, so widening it in `state-shared` would only move behaviour in the four sibling
 * games that do; this is the per-game override instead.)
 *
 * 0.375 is not arbitrary: it keeps the hand-tuned scatter hold at exactly its current turbo
 * value (800 → 300 ms). Super-turbo drops holds entirely, as it already did at the three sites
 * that happened to be gated for it.
 */
export const holdScale = () => (stateBet.isSuperTurbo ? 0 : stateBet.isTurbo ? 0.375 : 1);

/**
 * Pause for `ms` scaled to the current speed mode, resolving early on a stop press.
 *
 * Returns true when nothing was actually paced — either a stop press landed, or the speed mode
 * zeroes holds. Callers that present a beat per step should collapse the remaining steps into
 * one when this is true; callers with a single beat can ignore it.
 */
export const hold = async (ms: number) => {
	const scaled = ms * holdScale();
	// Routed through the interruptible even at 0 ms so a sticky interrupt is still reported.
	const { interrupted } = await interruptible.add(() => waitForTimeout(scaled));
	return interrupted || scaled === 0;
};

/** Sequence boundary — clears the resolver list AND the sticky `pendingInterrupt`. */
export const resetHolds = () => interruptible.clear();

/** A stop press: resolve the hold in flight and every hold left in this sequence. */
export const interruptHolds = () => interruptible.interrupt();
