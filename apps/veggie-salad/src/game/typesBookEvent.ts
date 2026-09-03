import type { BetType } from 'rgs-requests';

import type { BonusTier, GameType, Position, RawSymbol, SymbolName } from './types';

export type ClusterWin = {
	clusterId: string;
	symbol: Exclude<SymbolName, 'SCATTER'>;
	size: number;
	positions: Position[];
	rawAmount: number;
	multiplierValues: number[];
	rawMultiplier: number;
	appliedMultiplier: number;
	amount: number;
};

type Indexed = { index: number };

export type BookEvent =
	| (Indexed & {
			type: 'reveal';
			board: RawSymbol[][];
			gridSize: 7 | 8 | 9 | 10;
			cascadeIndex: number;
			gameType: GameType;
			paddingPositions: number[];
			anticipation: number[];
	  })
	| (Indexed & { type: 'clusterWin'; cascadeIndex: number; wins: ClusterWin[]; totalWin: number })
	| (Indexed & { type: 'tumbleRemove'; positions: Position[]; cascadeIndex: number })
	| (Indexed & { type: 'setTotalWin'; amount: number })
	| (Indexed & { type: 'setWin'; amount: number; winLevel: number })
	| (Indexed & { type: 'finalWin'; amount: number })
	| (Indexed & { type: 'featureSpinStart'; cost: number; gridSize: 7 })
	| (Indexed & {
			type: 'freeSpinTrigger';
			tier: BonusTier;
			source: 'natural' | 'buy' | 'mystery';
			scatterCount: number;
			positions: Position[];
			totalFs: number;
			gridSize: 8 | 9 | 10;
	  })
	| (Indexed & { type: 'updateFreeSpin'; amount: number; total: number; tier: BonusTier })
	| (Indexed & {
			type: 'retrigger';
			tier: BonusTier;
			scatterCount: number;
			spinsAdded: number;
			total: number;
			// Current books provide exact landed scatter cells. Optional keeps old replay books valid.
			positions?: Position[];
		  })
	| (Indexed & {
			type: 'freeSpinEnd';
			tier: BonusTier;
			amount: number;
			spinsPlayed: number;
			totalSpinsAwarded: number;
	  })
	| (Indexed & {
			type: 'mysterySelect';
			tier: BonusTier;
			gridSize: 8 | 9 | 10;
			// The entry spin's scatters, so the pick can be celebrated on the board before the
			// placard names the tier. Absent on older books.
			scatterCount?: number;
			positions?: Position[];
	  })
	| {
			index: -1;
			type: 'restoreSnapshot';
			board?: RawSymbol[][];
			gridSize: 7 | 8 | 9 | 10;
			gameType: GameType;
			totalWin: number;
			spinStartTotal: number;
			freeSpinCurrent: number;
			freeSpinTotal: number;
			tier: BonusTier | null;
	  };

export type Bet = BetType<BookEvent>;
export type BookEventOfType<T extends BookEvent['type']> = Extract<BookEvent, { type: T }>;
export type BookEventContext = { bookEvents: BookEvent[] };
