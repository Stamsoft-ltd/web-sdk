import type { BetType } from 'rgs-requests';

import type { SymbolName, RawSymbol, GameType, Position } from './types';

type BookEventReveal = {
	index: number;
	type: 'reveal';
	board: RawSymbol[][];
	paddingPositions: number[];
	anticipation: number[];
	gameType: GameType;
};

type BookEventWinInfo = {
	index: number;
	type: 'winInfo';
	totalWin: number;
	wins: {
		symbol: SymbolName;
		kind: number;
		win: number;
		positions: Position[];
		meta: {
			lineIndex: number;
			multiplier: number;
			winWithoutMult: number;
			globalMult: number;
			lineMultiplier: number;
		};
	}[];
};

type BookEventSetTotalWin = { index: number; type: 'setTotalWin'; amount: number };
type BookEventSetWin = { index: number; type: 'setWin'; amount: number; winLevel: number };
type BookEventFinalWin = { index: number; type: 'finalWin'; amount: number };
type BookEventWincap = { index: number; type: 'wincap'; amount: number };

type BookEventFreeSpinTrigger = {
	index: number;
	type: 'freeSpinTrigger';
	totalFs: number;
	positions: Position[];
};

type BookEventUpdateFreeSpin = {
	index: number;
	type: 'updateFreeSpin';
	amount: number;
	total: number;
};

type BookEventFreeSpinEnd = {
	index: number;
	type: 'freeSpinEnd';
	amount: number;
	globalMult: number;
};

type BookEventLockRespinStart = {
	index: number;
	type: 'lockRespinStart';
	symbol: SymbolName;
	lockedPositions: Position[];
	globalMult: number;
};

type BookEventLockRespinUpdate = {
	index: number;
	type: 'lockRespinUpdate';
	newLockedPositions: Position[];
	scatterPositions: Position[];
	multiplierPositions: Position[];
	collectedScatters: number;
	addedSteps: number;
	globalMult: number;
};

type BookEventLockRespinEnd = {
	index: number;
	type: 'lockRespinEnd';
	symbol: SymbolName;
	lockedPositions: Position[];
	collectedScatters: number;
	globalMult: number;
};

type BookEventUpdateGlobalMult = {
	index: number;
	type: 'updateGlobalMult';
	previousGlobalMult: number;
	globalMult: number;
	addedSteps: number;
	source: string;
};

type BookEventBonusWheel = {
	index: number;
	type: 'bonusWheel';
	scatterEntry: number;
	freeSpins: number;
	addedSteps: number;
	previousGlobalMult: number;
	globalMult: number;
};

type BookEventCreateBonusSnapshot = {
	index: number;
	type: 'createBonusSnapshot';
	bookEvents: BookEvent[];
};

export type BookEvent =
	| BookEventReveal
	| BookEventWinInfo
	| BookEventSetTotalWin
	| BookEventSetWin
	| BookEventFinalWin
	| BookEventWincap
	| BookEventFreeSpinTrigger
	| BookEventUpdateFreeSpin
	| BookEventFreeSpinEnd
	| BookEventLockRespinStart
	| BookEventLockRespinUpdate
	| BookEventLockRespinEnd
	| BookEventUpdateGlobalMult
	| BookEventBonusWheel
	| BookEventCreateBonusSnapshot;

export type Bet = BetType<BookEvent>;
export type BookEventOfType<T> = Extract<BookEvent, { type: T }>;
export type BookEventContext = { bookEvents: BookEvent[] };
