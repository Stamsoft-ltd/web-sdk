import type { Speed } from './uiPolicy';

/** Veggie Salad gravity / bottom-first staggering / skip-tail, tuned for a 6x5 board.
 * Freeze the profile for each wave; never restart cells that already landed.
 */
export const MOTION = {
	// Normal has a deliberate ~1s exit + reveal; Fast/Turbo keep their existing profiles.
	normal: {
		unit: 86,
		min: 78,
		row: 12,
		tumbleRow: 10,
		reel: 50,
		jitter: 8,
		impact: 120,
		remove: 280,
	},
	fast: { unit: 55, min: 50, row: 8, tumbleRow: 6, reel: 24, jitter: 8, impact: 80, remove: 190 },
	turbo: { unit: 24, min: 20, row: 3, tumbleRow: 2, reel: 10, jitter: 4, impact: 40, remove: 70 },
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
	const timing = skipAdjust(
		wave.kind === 'remove'
			? jitter * 12
			: (rows - row - 1) * stagger + reel * (exit ? 3 : p.reel) + jitter * p.jitter,
		wave.kind === 'remove' ? p.remove : Math.max(p.min, p.unit * Math.sqrt(distance)),
		wave.cut,
		wave.tail,
	);
	return { ...timing, impact: p.impact, offset: exit ? distance * 109 : offset * 1.09 };
}
