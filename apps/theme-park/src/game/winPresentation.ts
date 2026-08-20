import type { MarqueeTier } from './winCardMarquee';

// Theme Park math win-level contract:
// 20x SWEET · 50x WILD · 100x EPIC · 250x MYTHIC · 1000x LEGENDARY · 25000x MAX.
export const tierForMultiplier = (multiplier: number): MarqueeTier =>
	multiplier >= 1000
		? 'legendary'
		: multiplier >= 250
			? 'mythic'
			: multiplier >= 100
				? 'epic'
				: multiplier >= 50
					? 'wild'
					: 'sweet';

/**
 * The win cap. At and above it the marquee card is replaced outright by <MaxWinCard> — the design
 * gives MAX WIN its own lockup (Figma 6090:4147) rather than a sixth wordmark on the same plate, so
 * it cannot be reached through `tierForMultiplier`.
 */
export const MAX_WIN_MULTIPLIER = 25000;

export const isMaxWin = (multiplier: number) => multiplier >= MAX_WIN_MULTIPLIER;
