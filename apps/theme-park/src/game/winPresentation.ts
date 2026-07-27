// Theme Park math win-level contract:
// 20x SWEET · 50x WILD · 100x EPIC · 250x MYTHIC · 1000x LEGENDARY.
// The dedicated 25,000x MAX board is handled by Win.svelte.
export const boardKeyForMultiplier = (multiplier: number) =>
	multiplier >= 1000
		? 'winLegendary'
		: multiplier >= 250
			? 'winMythic'
			: multiplier >= 100
				? 'winEpic'
				: multiplier >= 50
					? 'winWild'
					: 'winSweet';
