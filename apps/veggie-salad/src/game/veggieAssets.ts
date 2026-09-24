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

// Math symbol names stay unchanged. Pixel art replaces presentation only: the board draws the
// design's newer set (9451:148386), cut by scripts/build-board-crop.py, each in the slot of the
// old art it most resembles so the pay order keeps its colours. The top three payers wear
// sunglasses (designs 9476:55568 / 9476:53635 / 9476:54863, scripts/build-board-premium.py).
const BOARD = '/assets/veggie-salad/pixel/board';
export const VEGGIE_SYMBOL_ASSETS: Record<VeggieDisplaySymbolName, string> = {
	BROCCOLI: `${BOARD}/cabbage-shades.webp`,
	CORN: `${BOARD}/pepper-shades.webp`,
	TOMATO: `${BOARD}/tomato-shades.webp`,
	EGGPLANT: `${BOARD}/eggplant.webp`,
	CARROT: `${BOARD}/potato.webp`,
	PEPPER: `${BOARD}/radish.webp`,
	ONION: `${BOARD}/garlic.webp`,
	SCATTER: '/assets/veggie-salad/pixel/onion.webp',
};

// The premium payers, which sit on the design's gold-edged olive pad.
export const VEGGIE_PREMIUM_SYMBOLS: ReadonlySet<VeggieDisplaySymbolName> = new Set([
	'BROCCOLI',
	'CORN',
	'TOMATO',
]);
