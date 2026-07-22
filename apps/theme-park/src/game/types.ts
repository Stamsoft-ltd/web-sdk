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
	wild?: boolean;
	scatter?: boolean;
	duck?: boolean;
	persistent?: boolean;
	rollerTrigger?: boolean;
};

export type Position = { reel: number; row: number };

export type RollerRowMultiplier = { row: number; multiplier: number };
export type RollerReel = {
	reel: number;
	triggerRow: number;
	multiplier: number;
	multipliers: RollerRowMultiplier[];
};

export type BetMode = 'BASE' | 'ANTE' | 'FSPIN1' | 'FSPIN2' | 'DUCK' | 'ROLLER' | 'COASTER';

export type BonusType = 'roller' | 'coaster';

export type DuckKind = 'mult' | 'multmult';
export type DuckPrize = { kind: DuckKind; value: number };
