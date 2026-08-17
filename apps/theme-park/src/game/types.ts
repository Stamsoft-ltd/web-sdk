// Theme Park symbol set — see theme_park_event_contract.md
export type SymbolName =
	| 'H1' // Coaster Car
	| 'H2' // Rubber Duck
	| 'H3' // Balloon
	| 'H4' // Popcorn
	| 'H5' // Ferris Wheel
	| 'L1' // A
	| 'L2' // K
	| 'L3' // Q
	| 'L4' // J
	| 'L5' // 10
	| 'W' // wild
	| 'DC' // duck collect symbol
	| 'S_DUCK' // Duck Your Luck scatter
	| 'S_ROLLER' // Roller Wilds scatter
	| 'S_COASTER'; // Mega Coaster scatter

export type SymbolState = 'spin' | 'land' | 'static' | 'win';
export const SYMBOL_STATES: SymbolState[] = ['spin', 'land', 'static', 'win'];

export type GameType = 'basegame' | 'freegame';

// Board cells per contract:
// {"name":"W","wild":true,"multiplier":N,"persistent":true} / {"name":"S_DUCK","scatter":true} / {"name":"DC","duck":true}
export type RawSymbol = {
	name: SymbolName;
	multiplier?: number;
	reelMultiplier?: number;
	// Client-only: final Roller reel rig has already played its rails + duck/plaque roll reveal.
	rollerExpanded?: boolean;
	wild?: boolean;
	scatter?: boolean;
	duck?: boolean;
	persistent?: boolean;
	rollerTrigger?: boolean;
	// Client-only deterministic Duck art copied from the reveal event. Persisting the resolved
	// values prevents a moving reel symbol from changing style when its temporary row index shifts.
	duckStyleSeed?: number;
	duckVariant?: number;
	duckLook?: number;
};

export type Position = { reel: number; row: number };

export type RollerReel = {
	reel: number;
	triggerRow: number;
	fakeMultiplier: number;
	multiplier: number;
	initialReal: boolean;
};

export type BetMode = 'BASE' | 'ANTE' | 'FSPIN1' | 'FSPIN2' | 'DUCK' | 'ROLLER' | 'COASTER';

export type BonusType = 'roller' | 'coaster';

// Legacy wire names: `mult` is a flat whole-bet addition; `multmult` multiplies the running total.
export type DuckKind = 'mult' | 'multmult';
export type DuckPrize = { kind: DuckKind; value: number };
