/** Bounded cosmetic fountain. No influence on prizes or win-tier timing. */
export function winCoinFountain(tier: number) {
	const index = Math.max(0, Math.min(4, Math.trunc(tier)));
	return {
		max: [90, 120, 160, 210, 260][index],
		frequency: [0.045, 0.032, 0.024, 0.018, 0.014][index],
		burst: 12 + index * 4,
	};
}
/** Title center in the existing native win-art viewBox, not the amount/banner below. */
export const WIN_COIN_ORIGIN_Y = 0.45833;
