// Hand-crafted sample books for the BASE mode, conforming to the LOCKED
// theme_park_event_contract.md. All amounts are integer cents of bet (100 = 1x).
import type { BookEvent } from '../../game/typesBookEvent';
import { makeBoard, PADDING_POSITIONS, NO_ANTICIPATION, type StoryBook } from './helpers';
import realBooks from './base_books_real';

// ── Book 1: losing round ────────────────────────────────────────────────────
// Reels 0 and 1 share no symbol names (and no wilds), so no line can pay.
const losingRoundEvents: BookEvent[] = [
	{
		index: 0,
		type: 'reveal',
		board: makeBoard([
			['H1', 'L1', 'H3', 'L3', 'H5'],
			['H2', 'L2', 'H4', 'L4', 'L5'],
			['H1', 'L1', 'H3', 'L3', 'H5'],
			['H2', 'L2', 'H4', 'L4', 'L5'],
			['H1', 'L1', 'H3', 'L3', 'H5'],
		]),
		paddingPositions: PADDING_POSITIONS,
		anticipation: NO_ANTICIPATION,
		gameType: 'basegame',
	},
	{ index: 1, type: 'setTotalWin', amount: 0 },
	{ index: 2, type: 'finalWin', amount: 0 },
];

// ── Book 2: single line win (H1 x3 on payline 1, rows [0,0,0,0,0]) ─────────
const lineWinEvents: BookEvent[] = [
	{
		index: 0,
		type: 'reveal',
		board: makeBoard([
			['H1', 'L1', 'H3', 'L3', 'H5'],
			['H1', 'L2', 'H4', 'L4', 'L5'],
			['H1', 'L1', 'H5', 'L3', 'H3'],
			['L2', 'H2', 'H4', 'L4', 'L5'],
			['L3', 'L1', 'H3', 'H5', 'L2'],
		]),
		paddingPositions: PADDING_POSITIONS,
		anticipation: NO_ANTICIPATION,
		gameType: 'basegame',
	},
	{
		index: 1,
		type: 'winInfo',
		totalWin: 200,
		wins: [
			{
				symbol: 'H1',
				kind: 3,
				win: 200,
				positions: [
					{ reel: 0, row: 0 },
					{ reel: 1, row: 0 },
					{ reel: 2, row: 0 },
				],
				meta: { lineIndex: 0, multiplier: 1, winWithoutMult: 200, lineMultiplier: 1 },
			},
		],
	},
	{ index: 2, type: 'setTotalWin', amount: 200 },
	{ index: 3, type: 'setWin', amount: 200, winLevel: 2 },
	{ index: 4, type: 'finalWin', amount: 200 },
];

// ── Book 3: base-game duck collect (2 DC symbols, mult + multmult) ──────────
const duckCollectEvents: BookEvent[] = [
	{
		index: 0,
		type: 'reveal',
		board: makeBoard([
			['H1', 'L1', 'H3', 'L3', 'H5'],
			['H2', 'L2', 'DC', 'L4', 'L5'],
			['H1', 'L1', 'H3', 'L3', 'H5'],
			['H2', 'DC', 'H4', 'L4', 'L5'],
			['H1', 'L1', 'H3', 'L3', 'H5'],
		]),
		paddingPositions: PADDING_POSITIONS,
		anticipation: NO_ANTICIPATION,
		gameType: 'basegame',
	},
	{
		index: 1,
		type: 'duckCollectStart',
		positions: [
			{ reel: 1, row: 2 },
			{ reel: 3, row: 1 },
		],
	},
	{
		index: 2,
		type: 'duckReveal',
		position: { reel: 1, row: 2 },
		kind: 'mult',
		value: 5,
		runningTotal: 500,
	},
	{
		index: 3,
		type: 'duckReveal',
		position: { reel: 3, row: 1 },
		kind: 'multmult',
		value: 2,
		runningTotal: 1000,
	},
	{ index: 4, type: 'duckCollectEnd', amount: 1000 },
	{ index: 5, type: 'setTotalWin', amount: 1000 },
	{ index: 6, type: 'setWin', amount: 1000, winLevel: 3 },
	{ index: 7, type: 'finalWin', amount: 1000 },
];

// ── Book 4: rare base-game roller wild (reel 1 → full wild x2) ──────────────
// Line 2 (rows [1,1,1,1,1]): H3 + W(x2) + H3 → 3oak H3 (1x = 100) × 2 = 200.
const baseRollerWildEvents: BookEvent[] = [
	{
		index: 0,
		type: 'reveal',
		board: makeBoard([
			['H1', 'H3', 'L1', 'L3', 'H5'],
			['H2', 'L2', 'H4', 'L4', { name: 'W', wild: true, rollerTrigger: true }],
			['L1', 'H3', 'H5', 'L3', 'H1'],
			['H2', 'L2', 'H4', 'L4', 'L5'],
			['H1', 'L1', 'H3', 'L3', 'H5'],
		]),
		paddingPositions: PADDING_POSITIONS,
		anticipation: NO_ANTICIPATION,
		gameType: 'basegame',
	},
	{
		index: 1,
		type: 'rollerWildsApply',
		reels: [{ reel: 1, triggerRow: 4, fakeMultiplier: 10, multiplier: 2 }],
	},
	{
		index: 2,
		type: 'winInfo',
		totalWin: 200,
		wins: [
			{
				symbol: 'H3',
				kind: 3,
				win: 200,
				positions: [
					{ reel: 0, row: 1 },
					{ reel: 1, row: 1 },
					{ reel: 2, row: 1 },
				],
				meta: { lineIndex: 1, multiplier: 2, winWithoutMult: 100, lineMultiplier: 2 },
			},
		],
	},
	{ index: 3, type: 'setTotalWin', amount: 200 },
	{ index: 4, type: 'setWin', amount: 200, winLevel: 2 },
	{ index: 5, type: 'finalWin', amount: 200 },
];

// Hand-crafted books (kept for deterministic minimal coverage)
const handcraftedBooks: StoryBook[] = [
	{
		id: 1,
		payoutMultiplier: 0,
		events: losingRoundEvents,
		criteria: 'basegame',
		baseGameWins: 0,
		freeGameWins: 0,
	},
	{
		id: 2,
		payoutMultiplier: 2,
		events: lineWinEvents,
		criteria: 'basegame',
		baseGameWins: 2,
		freeGameWins: 0,
	},
	{
		id: 3,
		payoutMultiplier: 10,
		events: duckCollectEvents,
		criteria: 'duckcollect',
		baseGameWins: 10,
		freeGameWins: 0,
	},
	{
		id: 4,
		payoutMultiplier: 2,
		events: baseRollerWildEvents,
		criteria: 'rollerwild',
		baseGameWins: 2,
		freeGameWins: 0,
	},
];

// Real rounds sampled from the simulated math engine come first.
const books: StoryBook[] = [...realBooks, ...handcraftedBooks];

export default books;
