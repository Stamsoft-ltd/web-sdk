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

// Math symbol names stay unchanged. Pixel art replaces presentation only.
export const VEGGIE_SYMBOL_ASSETS: Record<VeggieDisplaySymbolName, string> = {
	BROCCOLI: '/assets/veggie-salad/pixel/broccoli.webp',
	CORN: '/assets/veggie-salad/pixel/corn.webp',
	TOMATO: '/assets/veggie-salad/pixel/tomato.webp',
	EGGPLANT: '/assets/veggie-salad/pixel/eggplant.webp',
	CARROT: '/assets/veggie-salad/pixel/carrot.webp',
	// Historical filenames are reversed: cauliflower.png contains beetroot,
	// radish.png contains cauliflower. Keep math/paytable slots unchanged.
	PEPPER: '/assets/veggie-salad/pixel/cauliflower.webp',
	ONION: '/assets/veggie-salad/pixel/radish.webp',
	SCATTER: '/assets/veggie-salad/pixel/onion.webp',
};
