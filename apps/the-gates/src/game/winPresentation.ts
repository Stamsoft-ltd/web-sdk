/** Same tier thresholds and count/hold timings as Veggie Salad. Amounts: 1/100 base bet. */
export const WIN_TIERS = [
	{ minimum: 2000, key: 'sweet', title: 'SWEET WIN', countMs: 2500, holdMs: 5000 },
	{ minimum: 5000, key: 'wild', title: 'WILD WIN', countMs: 3500, holdMs: 6000 },
	{ minimum: 10000, key: 'epic', title: 'EPIC WIN', countMs: 4500, holdMs: 7000 },
	{ minimum: 20000, key: 'mythic', title: 'MYTHIC WIN', countMs: 5250, holdMs: 7750 },
	{ minimum: 50000, key: 'legendary', title: 'LEGENDARY WIN', countMs: 6000, holdMs: 8500 },
] as const;
export function winTier(amount: number) {
	return WIN_TIERS.findLast((tier) => amount >= tier.minimum) ?? null;
}
/** Sub-20× wins stay in the HUD/below-board readout, never a board overlay. */
export const showsInlineWin = (_amount: number) => false;
export const showsAnyWin = (amount: number) => amount >= 2000;
export function winTiming(amount: number, factor = 1) {
	const tier = winTier(amount);
	return tier
		? {
				countMs: Math.max(900, tier.countMs / factor),
				holdMs: Math.max(1500, tier.holdMs / factor),
			}
		: { countMs: 600, holdMs: 1100 };
}

/** Tight native art bounds including crown flight and horn overshoot. */
export const WIN_ART_VIEW = { width: 860, height: 600, offsetY: 20 } as const;
