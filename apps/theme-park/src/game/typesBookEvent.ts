import type { BetType } from 'rgs-requests';
import type {
	SymbolName,
	RawSymbol,
	GameType,
	Position,
	BonusType,
	DuckKind,
	DuckPrize,
} from './types';

// ── Standard events (theme_park_event_contract.md, v1 LOCKED) ─────────────────
// All amount / totalWin / win values are integer cents of bet (100 = 1x bet).

type BookEventReveal = {
	index: number;
	type: 'reveal';
	// 7 rows per reel (1 pad top, 1 pad bottom); visible rows are indices 1..5
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
		kind: number; // line length 3 | 4 | 5
		win: number;
		positions: Position[];
		meta: {
			lineIndex: number; // 0-based
			multiplier: number;
			winWithoutMult: number;
			lineMultiplier: number;
		};
	}[];
};

type BookEventSetTotalWin = { index: number; type: 'setTotalWin'; amount: number };
type BookEventSetWin = { index: number; type: 'setWin'; amount: number; winLevel: number };
type BookEventFinalWin = { index: number; type: 'finalWin'; amount: number };

type BookEventFreeSpinTrigger = {
	index: number;
	type: 'freeSpinTrigger';
	totalFs: number; // always 10
	positions: Position[]; // scatter positions
	bonusType: BonusType;
};

type BookEventUpdateFreeSpin = {
	index: number;
	type: 'updateFreeSpin';
	amount: number; // current spin idx, 0-based
	total: number; // always 10
};

type BookEventFreeSpinEnd = {
	index: number;
	type: 'freeSpinEnd';
	amount: number;
	winLevel: number;
};

// Emitted when the running total reaches the 25,000x cap (amount = 2500000); round then ends
type BookEventWincap = { index: number; type: 'wincap'; amount: number };

// ── Duck Collect (spin with DC symbols) ────────────────────────────────────────

type BookEventDuckCollectStart = {
	index: number;
	type: 'duckCollectStart';
	positions: Position[]; // DC symbols on board, flip order = array order
};

type BookEventDuckReveal = {
	index: number;
	type: 'duckReveal';
	position: Position;
	kind: DuckKind;
	// `mult` adds this many whole bets; `multmult` multiplies the running currency total.
	value: number;
	runningTotal: number; // cents
};

type BookEventDuckCollectEnd = { index: number; type: 'duckCollectEnd'; amount: number };

// ── Duck Your Luck bonus (25 ducks shown, 10 manual picks) ─────────────────────

type BookEventDuckPickStart = {
	index: number;
	type: 'duckPickStart';
	totalPicks: number;
	pool: DuckPrize[]; // 25 prizes: first 10 picked outcomes, remaining 15 end reveals
	// New books provide the three landed S_DUCK cells. Optional keeps published legacy books playable.
	positions?: Position[];
};

type BookEventDuckPick = {
	index: number;
	type: 'duckPick';
	pickIndex: number; // 0-9
	kind: DuckKind;
	value: number;
	runningTotal: number; // cents
};

type BookEventDuckPickEnd = { index: number; type: 'duckPickEnd'; amount: number };

// ── Roller Wilds ───────────────────────────────────────────────────────────────
// Emitted AFTER the trigger-Wild reveal settles. The event drives the coaster
// animation, then transforms the complete reel. One event multiplier is presented on the
// duck-car plaque; multiple transformed reels also add when used on one win line.

type BookEventRollerWildsApply = {
	index: number;
	type: 'rollerWildsApply';
	reels: {
		reel: number;
		fakeMultiplier?: number;
		multiplier: number;
		triggerRow?: number;
	}[];
};

// ── Mega Coaster ───────────────────────────────────────────────────────────────
// pukes = ordered animation list (multiplier = tile value AFTER that puke: 2,4,8,...),
// tiles = final persistent wild map. Emitted after freeSpinTrigger, before the
// first freegame reveal. Persistent wilds are baked into every freegame reveal.

type BookEventCoasterSetup = {
	index: number;
	type: 'coasterSetup';
	pukes: { reel: number; row: number; multiplier: number }[];
	tiles: { reel: number; row: number; multiplier: number }[];
};

// ── Client-side synthetic event for bonus resume ───────────────────────────────

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
	| BookEventFreeSpinTrigger
	| BookEventUpdateFreeSpin
	| BookEventFreeSpinEnd
	| BookEventWincap
	| BookEventDuckCollectStart
	| BookEventDuckReveal
	| BookEventDuckCollectEnd
	| BookEventDuckPickStart
	| BookEventDuckPick
	| BookEventDuckPickEnd
	| BookEventRollerWildsApply
	| BookEventCoasterSetup
	| BookEventCreateBonusSnapshot;

export type Bet = BetType<BookEvent>;
export type BookEventOfType<T> = Extract<BookEvent, { type: T }>;
export type BookEventContext = { bookEvents: BookEvent[] };
