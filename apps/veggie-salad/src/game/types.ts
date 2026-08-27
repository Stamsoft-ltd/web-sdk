export const SYMBOL_NAMES = [
	'CORN',
	'TOMATO',
	'ONION',
	'CARROT',
	'EGGPLANT',
	'BROCCOLI',
	'PEPPER',
	'SCATTER',
] as const;

export type SymbolName = (typeof SYMBOL_NAMES)[number];
export type RawSymbol = { name: SymbolName; multiplier?: number; scatter?: boolean };
export type GameType = 'basegame' | 'feature' | 'normal' | 'super' | 'hidden';
export type BonusTier = 'normal' | 'super' | 'hidden';
export type Position = { reel: number; row: number };
