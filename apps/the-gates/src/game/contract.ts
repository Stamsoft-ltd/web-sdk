import type { BetType } from 'rgs-requests';
export const SYMBOLS = [
	'GUARDIAN_MASK',
	'SUN_MEDALLION',
	'SACRED_EYE',
	'RUNE_CHALICE',
	'CRYSTAL_ORB',
	'RED_GEM',
	'BLUE_GEM',
	'GREEN_GEM',
	'PURPLE_GEM',
	'AMBER_GEM',
	'KEY',
	'WILD',
] as const;
export type SymbolName = (typeof SYMBOLS)[number];
export type Position = { reel: number; row: number };
export type Board = ({ name: SymbolName } | null)[][];
export type Tier = 'normal' | 'super' | 'hidden';
export const COSTS = {
	BASE: 1,
	CHANCE: 2,
	FEATURE: 20,
	BONUS: 100,
	SUPER: 300,
	MYSTERY: 400,
} as const;
export type Mode = keyof typeof COSTS;
export const PAYS = [
	[10, 25, 50],
	[2.5, 10, 25],
	[2, 5, 15],
	[1.5, 2, 12],
	[1, 1.5, 10],
	[0.8, 1.2, 8],
	[0.5, 1, 5],
	[0.4, 0.9, 4],
	[0.25, 0.75, 2],
	[0.2, 0.5, 1.5],
];
export type Reward =
	| { kind: 'addMultiplier' | 'multiplyMultiplier'; value: number }
	| { kind: 'stickyWild'; positions: Position[] }
	| { kind: 'extraSpin' | 'retrigger'; spinsAdded: number };
export type Win = { symbol: SymbolName; size: number; positions: Position[]; rawAmount: number };
type Payload =
	| { type: 'featureSpinStart'; cost: number }
	| {
			type: 'spinStart';
			spinId: number;
			gameType: string;
			tier: Tier | null;
			freeSpin: number;
			multiplier: number;
			multiplierActive: boolean;
			stickyPositions: Position[];
	  }
	| {
			type: 'reveal';
			board: Board;
			spinId: number;
			cascadeIndex: number;
			gameType: string;
			movements: { reel: number; fromRow: number; toRow: number; name: SymbolName }[];
	  }
	| {
			type: 'cascadeWin';
			spinId: number;
			cascadeIndex: number;
			wins: Win[];
			rawAmount: number;
			rawSpinWin: number;
	  }
	| { type: 'gateProgress'; spinId: number; cascadeIndex: number; progress: number }
	| { type: 'gateOpen'; spinId: number; gate: number; cascadeIndex: number; rewardCount: number }
	| {
			type: 'gateReward';
			spinId: number;
			gate: number;
			order: number;
			reward: Reward;
			previousMultiplier: number;
			multiplier: number;
			multiplierActive: boolean;
			totalFs: number;
			stickyPositions: Position[];
	  }
	| { type: 'tumbleRemove'; spinId: number; cascadeIndex: number; positions: Position[] }
	| {
			type: 'spinWin';
			spinId: number;
			rawAmount: number;
			multiplier: number;
			uncappedAmount: number;
			amount: number;
			cascades: number;
			capped: boolean;
	  }
	| { type: 'mysterySelect'; tier: Tier; scatterCount: number; positions: Position[] }
	| {
			type: 'freeSpinTrigger';
			tier: Tier;
			source: string;
			scatterCount: number;
			positions: Position[];
			totalFs: number;
	  }
	| { type: 'updateFreeSpin'; amount: number; total: number; remaining: number; tier: Tier }
	| {
			type: 'freeSpinEnd';
			tier: Tier;
			amount: number;
			spinsPlayed: number;
			totalSpinsAwarded: number;
			capped: boolean;
	  }
	| { type: 'setTotalWin' | 'setWin' | 'finalWin' | 'maxWin'; amount: number };
export type BookEvent = Payload & { index: number; eventId?: string | number };
// Some RGS deployments use betID; SDK schema names the same identifier roundID.
export type Bet = BetType<BookEvent> & { betID?: string | number };
export const posKey = (p: Position) => `${p.reel}:${p.row}`;
export const emptyBoard = (): Board => Array.from({ length: 6 }, () => Array(5).fill(null));
