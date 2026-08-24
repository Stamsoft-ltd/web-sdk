import { stateBet } from 'state-shared';

/**
 * Whether a landing reel gets its IMPACT PRESENTATION: the board's jolt, the sparks off the reel's
 * foot, and the squash-and-stretch of the symbols that just arrived.
 *
 * Off in turbo and super turbo. None of it is information — a reel has landed whether or not the
 * board rocked — and all of it is the same beat replayed on every single stop. At normal speed that
 * beat is what gives a reel weight; at four to seven times the spin speed the stops come close
 * enough together that the jolts overlap into a board that never stops shaking, and the player who
 * asked for turbo asked to get to the result, not to be shown the arrival five times a spin.
 *
 * The reel's own settle bounce is NOT this and stays on in every mode — it is how the reel comes to
 * rest rather than dressing over the top of it, and turbo already runs it at a third of the throw
 * (`reelBounceSizeMulti`, game/constants.ts).
 *
 * A function rather than a `$derived` so it can be read from a plain rAF loop as well as from a
 * component's reactive graph.
 */
export const showsReelImpact = () => !stateBet.isTurbo && !stateBet.isSuperTurbo;
