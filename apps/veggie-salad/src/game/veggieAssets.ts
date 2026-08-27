export const VEGGIE_SYMBOL_NAMES = [
	'BROCCOLI',
	'CORN',
	'TOMATO',
	'EGGPLANT',
	'CARROT',
	'PEPPER',
	'ONION',
] as const;

export type VeggieSymbolName = (typeof VEGGIE_SYMBOL_NAMES)[number];
export type VeggieDisplaySymbolName = VeggieSymbolName | 'SCATTER';

// Art source has cauliflower but no pepper. Keep the math contract stable for now:
// PEPPER events render with the supplied cauliflower art until product locks the rename.
export const VEGGIE_SYMBOL_ASSETS: Record<VeggieDisplaySymbolName, string> = {
	BROCCOLI: '/assets/veggie-salad/symbols/broccoli.png',
	CORN: '/assets/veggie-salad/symbols/corn.png',
	TOMATO: '/assets/veggie-salad/symbols/tomato.png',
	EGGPLANT: '/assets/veggie-salad/symbols/eggplant.png',
	CARROT: '/assets/veggie-salad/symbols/carrot.png',
	PEPPER: '/assets/veggie-salad/symbols/cauliflower.png',
	ONION: '/assets/veggie-salad/symbols/onion.png',
	SCATTER: '/assets/veggie-salad/symbols/scatter.png',
};
