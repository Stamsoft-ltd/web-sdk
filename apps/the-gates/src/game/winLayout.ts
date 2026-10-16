/** Shared native-unit celebration composition: title sits ON its plaque, not above it. */
export const WIN_COMPOSITION = {
	bannerY: 30,
	titleY: 45,
	hornAngle: 15,
	amountY: -150,
	amountWidth: 300,
	amountHeight: 82,
} as const;
/** Tier-native proportions, not stretched title bitmaps. Trumpet inner tips sit behind
 * the title's middle/side letters; higher tiers grow the whole composition AND trumpet bells.
 * Legendary's unusually wide native title is intentionally fitted below its old 620u. */
export const WIN_TIER_COMPOSITION = {
	sweet: { scale: 0.82, titleWidth: 430, hornX: 175, hornY: 112, hornWidth: 170 },
	wild: { scale: 0.88, titleWidth: 510, hornX: 190, hornY: 114, hornWidth: 190 },
	epic: { scale: 0.94, titleWidth: 470, hornX: 185, hornY: 114, hornWidth: 210 },
	mythic: { scale: 1, titleWidth: 470, hornX: 190, hornY: 116, hornWidth: 230 },
	legendary: { scale: 1.03, titleWidth: 520, hornX: 198, hornY: 116, hornWidth: 240 },
} as const;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (p: number) => 1 - (1 - clamp(p)) ** 3;
/** Presentation only. Final-target precision stays owned by the shared currency formatter. */
export function celebrationCount(
	amount: number,
	elapsed: number,
	duration: number,
	reduced: boolean,
	finishAt: number | null = null,
) {
	if (reduced || duration <= 0 || elapsed >= duration) return { value: amount, done: true };
	if (finishAt !== null) {
		const from = amount * ease(finishAt / duration),
			p = clamp((elapsed - finishAt) / 120);
		return { value: from + (amount - from) * ease(p), done: p >= 1 };
	}
	return { value: amount * ease(elapsed / duration), done: false };
}
