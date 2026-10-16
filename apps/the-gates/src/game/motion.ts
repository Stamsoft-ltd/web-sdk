import type { Speed } from './uiPolicy';

/** Veggie Salad gravity / bottom-first staggering / skip-tail, tuned for a 6x5 board.
 * Freeze the profile for each wave; never restart cells that already landed.
 */
export const MOTION = {
	// Normal has a deliberate ~1.3s exit + reveal, with readable contact squash.
	normal: {
		unit: 86,
		min: 78,
		row: 12,
		tumbleRow: 10,
		reel: 50,
		jitter: 8,
		impact: 240,
		remove: 820,
	},
	fast: { unit: 55, min: 50, row: 8, tumbleRow: 6, reel: 24, jitter: 8, impact: 160, remove: 500 },
	turbo: { unit: 24, min: 20, row: 3, tumbleRow: 2, reel: 10, jitter: 4, impact: 80, remove: 180 },
} as const;
export type Wave = {
	speed: Speed;
	kind: 'spin' | 'tumble' | 'exit' | 'remove';
	cut: number | null;
	tail: number;
};
export function skipAdjust(delay: number, duration: number, cut: number | null, tail = 130) {
	if (cut === null || delay + duration <= cut) return { delay, duration };
	const end = Math.min(delay + duration, cut + tail);
	return { delay: Math.min(delay, cut), duration: end - Math.min(delay, cut) };
}
export function cellMotion(wave: Wave, reel: number, row: number, offset: number, rows = 5) {
	const p = MOTION[wave.speed];
	// Stable visual jitter only: never touches outcome RNG or changes during a skip.
	const jitter = ((reel * 17 + row * 13) % 23) / 23;
	const exit = wave.kind === 'exit';
	const distance = exit ? rows - row + 1 : Math.abs(offset) / 100;
	const stagger = wave.kind === 'tumble' ? p.tumbleRow : p.row;
	const simultaneous = wave.speed !== 'normal' && ['spin', 'tumble', 'exit'].includes(wave.kind);
	const delay = simultaneous
		? 0
		: wave.kind === 'remove'
			? jitter * 12
			: (rows - row - 1) * stagger + reel * p.reel + jitter * p.jitter;
	const duration = simultaneous
		? wave.speed === 'turbo'
			? 65
			: 145
		: wave.kind === 'remove'
			? p.remove
			: Math.max(p.min, p.unit * Math.sqrt(distance));
	const timing = skipAdjust(delay, duration, wave.cut, wave.tail);
	// A skip speeds up future contacts only; already landed bounces never restart.
	const impact =
		wave.cut !== null && delay + duration > wave.cut ? Math.min(p.impact, 80) : p.impact;
	return { ...timing, impact, offset: exit ? distance * 109 : offset * 1.09 };
}

/** Gravity and Spine contact share the book-wave clock, not separate CSS start times.
 * Returned travel is in row pitches; the whole tile (pad + symbol) moves together.
 */
export function sampleTileTravel(
	motion: ReturnType<typeof cellMotion>,
	elapsed: number,
	exit: boolean,
) {
	const progress = Math.max(
		0,
		Math.min(1, (elapsed - motion.delay) / Math.max(1, motion.duration)),
	);
	const gravity = progress * progress;
	return (motion.offset / 109) * (exit ? gravity : 1 - gravity);
}

export function landingProgress(
	now: number,
	timing: { startedAt: number; delay: number; duration: number },
) {
	const elapsed = now - timing.startedAt - timing.delay;
	return elapsed < 0 ? null : Math.min(1, elapsed / Math.max(1, timing.duration));
}
