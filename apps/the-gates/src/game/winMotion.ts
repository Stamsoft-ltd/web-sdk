/** Viewport-aware celebration travel. Spine coordinates are Y-up; exit offset is screen Y-down. */
export const WIN_ENTER_MS = 950;
export const WIN_EXIT_MS = 360;
export const WIN_REDUCED_EXIT_MS = 120;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const out = (age: number, delay: number, duration: number) =>
	1 - (1 - clamp((age - delay) / duration)) ** 3;
export function winEntranceFrame(
	age: number,
	xDistance: number,
	yDistance: number,
	reduced = false,
) {
	if (reduced)
		return { bannerY: 0, titleY: 0, leftX: 0, rightX: 0, titleAlpha: 1, alpha: clamp(age / 140) };
	return {
		bannerY: -yDistance * (1 - out(age, 0, 850)),
		titleY: 90 * (1 - out(age, 160, 740)),
		leftX: -xDistance * (1 - out(age, 100, 800)),
		rightX: xDistance * (1 - out(age, 100, 800)),
		titleAlpha: out(age, 140, 220),
		alpha: 1,
	};
}
export function winExitFrame(age: number, distance: number, reduced = false) {
	const p = clamp(age / (reduced ? WIN_REDUCED_EXIT_MS : WIN_EXIT_MS));
	return { y: reduced || p === 0 ? 0 : -distance * p * p, alpha: reduced ? 1 - p : 1, done: p === 1 };
}

/** Mirrored downward dip, settling back on entry; a small final dip during fly-out. */
export function winTrumpetTilt(age: number, exiting = false, reduced = false) {
	if (reduced) return 0;
	return exiting
		? 8 * clamp(age / WIN_EXIT_MS)
		: 9 * Math.sin(Math.PI * clamp((age - 100) / 800));
}
