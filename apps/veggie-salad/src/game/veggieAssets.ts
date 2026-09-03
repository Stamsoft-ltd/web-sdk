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
	BROCCOLI: '/assets/veggie-salad/pixel/broccoli.png',
	CORN: '/assets/veggie-salad/pixel/corn.png',
	TOMATO: '/assets/veggie-salad/pixel/tomato.png',
	EGGPLANT: '/assets/veggie-salad/pixel/eggplant.png',
	CARROT: '/assets/veggie-salad/pixel/carrot.png',
	PEPPER: '/assets/veggie-salad/pixel/cauliflower.png',
	// Supplied art has no literal onion vegetable; radish fills that math slot.
	ONION: '/assets/veggie-salad/pixel/radish.png',
	SCATTER: '/assets/veggie-salad/pixel/onion.png',
};
