/** Slider detents: existing small counts, then 100-spin steps through 1000. */
export const AUTOPLAY_COUNTS = [
	...Array.from({ length: 19 }, (_, i) => 10 + i * 5),
	...Array.from({ length: 9 }, (_, i) => 200 + i * 100),
];
export function autoplayCountAt(index: number) {
	return AUTOPLAY_COUNTS[
		Math.max(
			0,
			Math.min(AUTOPLAY_COUNTS.length - 1, Math.round(Number.isFinite(index) ? index : 0)),
		)
	];
}
export const validAutoplayCount = (count: number) => AUTOPLAY_COUNTS.includes(count);
