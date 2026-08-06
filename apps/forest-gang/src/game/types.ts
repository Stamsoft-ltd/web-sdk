import { type SpinningReelSymbolState } from 'utils-slots';
import type config from './config';

// Written out explicitly (matches config.symbols) instead of `keyof typeof config.symbols`:
// config.ts itself imports SymbolName to type its reels, so deriving the type from config was a
// circular reference that degraded SymbolName (and everything typed with it) to `any`.
export type SymbolName =
	| 'FOX'
	| 'WOLF'
	| 'BEAR'
	| 'RABBIT'
	| 'SQUIRREL'
	| 'A'
	| 'K'
	| 'Q'
	| 'J'
	| 'T'
	| 'WILD'
	| 'SCATTER';
export type RawSymbol = {
	name: SymbolName;
	multiplier?: number;
	scatter?: boolean;
	wild?: boolean;
};
export type BetMode = keyof typeof config.betModes;
export type GameType = keyof typeof config.paddingReels;

export const SYMBOL_STATES = [
	'static',
	'spin',
	'land',
	'win',
	'postWinStatic',
	'explosion',
] as const;

export type SymbolState = SpinningReelSymbolState | (typeof SYMBOL_STATES)[number];

export type Position = {
	reel: number;
	row: number;
};
