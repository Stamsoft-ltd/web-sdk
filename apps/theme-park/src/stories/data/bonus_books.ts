// Hand-crafted sample books for the bonus/buy modes, conforming to the LOCKED
// theme_park_event_contract.md. All amounts are integer cents of bet (100 = 1x).
import type { RawSymbol } from '../../game/types';
import type { BookEvent } from '../../game/typesBookEvent';
import {
	makeBoard,
	bakeTiles,
	PADDING_POSITIONS,
	NO_ANTICIPATION,
	type StoryBook,
} from './helpers';
import realBooks from './bonus_books_real';
import { makeDuckPool } from './duckPools';

// Events are authored with index 0 and renumbered sequentially here.
const reindex = (events: BookEvent[]): BookEvent[] =>
	events.map((event, index) => ({ ...event, index }));

// A quiet no-win freegame board (reels 0/1 share no symbol names, no wilds)
const quietBoard = (): RawSymbol[][] =>
	makeBoard([
		['H1', 'L1', 'H3', 'L3', 'H5'],
		['H2', 'L2', 'H4', 'L4', 'L5'],
		['H1', 'L1', 'H3', 'L3', 'H5'],
		['H2', 'L2', 'H4', 'L4', 'L5'],
		['H1', 'L1', 'H3', 'L3', 'H5'],
	]);

const scatterTriggerBoard = (scatter: 'S_DUCK' | 'S_ROLLER' | 'S_COASTER'): RawSymbol[][] =>
	makeBoard([
		['H1', scatter, 'H3', 'L3', 'H5'],
		['H2', 'L2', 'H4', 'L4', 'L5'],
		['H1', 'L1', scatter, 'L3', 'H5'],
		['H2', 'L2', 'H4', 'L4', 'L5'],
		['H1', 'L1', 'H3', scatter, 'H5'],
	]);

const SCATTER_POSITIONS = [
	{ reel: 0, row: 1 },
	{ reel: 2, row: 2 },
	{ reel: 4, row: 3 },
];

// ── Book 1: Duck Your Luck (bought via DUCK mode / 3x S_DUCK) ───────────────
// freeSpinTrigger is omitted for this feature per the contract.
const duckYourLuckEvents: BookEvent[] = reindex([
	{
		index: 0,
		type: 'reveal',
		board: scatterTriggerBoard('S_DUCK'),
		paddingPositions: PADDING_POSITIONS,
		anticipation: [0, 0, 1, 1, 2],
		gameType: 'basegame',
	},
	{ index: 0, type: 'setTotalWin', amount: 0 },
	{
		index: 0,
		type: 'duckPickStart',
		totalPicks: 10,
		pool: makeDuckPool([
			{ kind: 'mult', value: 10 },
			{ kind: 'mult', value: 5 },
			{ kind: 'multmult', value: 2 },
			{ kind: 'mult', value: 25 },
			{ kind: 'mult', value: 2 },
			{ kind: 'multmult', value: 3 },
			{ kind: 'mult', value: 15 },
			{ kind: 'mult', value: 50 },
			{ kind: 'multmult', value: 2 },
			{ kind: 'mult', value: 100 },
		]),
	},
	{ index: 0, type: 'duckPick', pickIndex: 0, kind: 'mult', value: 10, runningTotal: 1000 },
	{ index: 0, type: 'duckPick', pickIndex: 1, kind: 'mult', value: 5, runningTotal: 1500 },
	{ index: 0, type: 'duckPick', pickIndex: 2, kind: 'multmult', value: 2, runningTotal: 3000 },
	{ index: 0, type: 'duckPick', pickIndex: 3, kind: 'mult', value: 25, runningTotal: 5500 },
	{ index: 0, type: 'duckPick', pickIndex: 4, kind: 'mult', value: 2, runningTotal: 5700 },
	{ index: 0, type: 'duckPick', pickIndex: 5, kind: 'multmult', value: 3, runningTotal: 17100 },
	{ index: 0, type: 'duckPick', pickIndex: 6, kind: 'mult', value: 15, runningTotal: 18600 },
	{ index: 0, type: 'duckPick', pickIndex: 7, kind: 'mult', value: 50, runningTotal: 23600 },
	{ index: 0, type: 'duckPick', pickIndex: 8, kind: 'multmult', value: 2, runningTotal: 47200 },
	{ index: 0, type: 'duckPick', pickIndex: 9, kind: 'mult', value: 100, runningTotal: 57200 },
	{ index: 0, type: 'duckPickEnd', amount: 57200 },
	{ index: 0, type: 'setTotalWin', amount: 57200 },
	{ index: 0, type: 'setWin', amount: 57200, winLevel: 9 },
	{ index: 0, type: 'finalWin', amount: 57200 },
]);

// ── Book 2: Roller Wilds bonus (10 free spins, transforms on spins 2 and 7) ─
const buildRollerBonusEvents = (): BookEvent[] => {
	const events: BookEvent[] = [
		{
			index: 0,
			type: 'reveal',
			board: scatterTriggerBoard('S_ROLLER'),
			paddingPositions: PADDING_POSITIONS,
			anticipation: [0, 0, 1, 1, 2],
			gameType: 'basegame',
		},
		{ index: 0, type: 'setTotalWin', amount: 0 },
		{
			index: 0,
			type: 'freeSpinTrigger',
			totalFs: 10,
			positions: SCATTER_POSITIONS,
			bonusType: 'roller',
		},
	];

	let totalWin = 0;
	for (let spin = 0; spin < 10; spin += 1) {
		events.push({ index: 0, type: 'updateFreeSpin', amount: spin, total: 10 });

		if (spin === 2) {
			// Three random-row triggers stress concurrent staging. Reel 4 has no plaque (x1).
			// H1 + W(x5) + W(x10) → H1 3oak (2x=200) × (5+10) = 3000.
			events.push({
				index: 0,
				type: 'reveal',
				board: makeBoard([
					['H1', 'H2', 'L1', 'L3', 'H5'],
					['H2', 'L2', 'H4', 'L4', { name: 'W', wild: true, rollerTrigger: true }],
					['L1', { name: 'W', wild: true, rollerTrigger: true }, 'H5', 'L3', 'H1'],
					['L2', 'H2', 'H4', 'L4', 'L5'],
					['L3', 'L1', { name: 'W', wild: true, rollerTrigger: true }, 'H5', 'L2'],
				]),
				paddingPositions: PADDING_POSITIONS,
				anticipation: NO_ANTICIPATION,
				gameType: 'freegame',
			});
			events.push({
				index: 0,
				type: 'rollerWildsApply',
				reels: [
					{ reel: 1, triggerRow: 4, fakeMultiplier: 2, multiplier: 5 },
					{ reel: 2, triggerRow: 1, fakeMultiplier: 25, multiplier: 10 },
					{ reel: 4, triggerRow: 2, fakeMultiplier: 5, multiplier: 1 },
				],
			});
			totalWin += 3000;
			events.push({
				index: 0,
				type: 'winInfo',
				totalWin: 3000,
				wins: [
					{
						symbol: 'H1',
						kind: 3,
						win: 3000,
						positions: [
							{ reel: 0, row: 0 },
							{ reel: 1, row: 0 },
							{ reel: 2, row: 0 },
						],
						meta: { lineIndex: 0, multiplier: 15, winWithoutMult: 200, lineMultiplier: 15 },
					},
				],
			});
			events.push({ index: 0, type: 'setTotalWin', amount: totalWin });
		} else if (spin === 7) {
			// Reel 0 transforms: W(x2) + H2 + H2 → H2 3oak (1x=100) × 2 = 200
			events.push({
				index: 0,
				type: 'reveal',
				board: makeBoard([
					['H1', 'L1', 'H3', { name: 'W', wild: true, rollerTrigger: true }, 'H5'],
					['H2', 'L2', 'H2', 'L4', 'L5'],
					['L1', 'H3', 'H2', 'L3', 'H1'],
					['H5', 'L2', 'L1', 'L4', 'L5'],
					['H1', 'L1', 'H3', 'L3', 'H5'],
				]),
				paddingPositions: PADDING_POSITIONS,
				anticipation: NO_ANTICIPATION,
				gameType: 'freegame',
			});
			events.push({
				index: 0,
				type: 'rollerWildsApply',
				reels: [{ reel: 0, triggerRow: 3, fakeMultiplier: 10, multiplier: 2 }],
			});
			totalWin += 200;
			events.push({
				index: 0,
				type: 'winInfo',
				totalWin: 200,
				wins: [
					{
						symbol: 'H2',
						kind: 3,
						win: 200,
						positions: [
							{ reel: 0, row: 2 },
							{ reel: 1, row: 2 },
							{ reel: 2, row: 2 },
						],
						meta: { lineIndex: 2, multiplier: 2, winWithoutMult: 100, lineMultiplier: 2 },
					},
				],
			});
			events.push({ index: 0, type: 'setTotalWin', amount: totalWin });
		} else {
			events.push({
				index: 0,
				type: 'reveal',
				board: quietBoard(),
				paddingPositions: PADDING_POSITIONS,
				anticipation: NO_ANTICIPATION,
				gameType: 'freegame',
			});
		}
	}

	events.push({ index: 0, type: 'freeSpinEnd', amount: totalWin, winLevel: 5 });
	events.push({ index: 0, type: 'finalWin', amount: totalWin });
	return reindex(events);
};

// ── Book 3: Mega Coaster bonus (setup + 10 free spins, persistent wilds) ────
const COASTER_TILES = [
	{ reel: 1, row: 1, multiplier: 4 },
	{ reel: 2, row: 3, multiplier: 4 },
	{ reel: 3, row: 2, multiplier: 2 },
	{ reel: 0, row: 4, multiplier: 2 },
	{ reel: 4, row: 0, multiplier: 2 },
];

const buildCoasterBonusEvents = (): BookEvent[] => {
	const events: BookEvent[] = [
		{
			index: 0,
			type: 'reveal',
			board: scatterTriggerBoard('S_COASTER'),
			paddingPositions: PADDING_POSITIONS,
			anticipation: [0, 0, 1, 1, 2],
			gameType: 'basegame',
		},
		{ index: 0, type: 'setTotalWin', amount: 0 },
		{
			index: 0,
			type: 'freeSpinTrigger',
			totalFs: 10,
			positions: SCATTER_POSITIONS,
			bonusType: 'coaster',
		},
		// 7 pukes; a repeat hit doubles the tile (multiplier = value AFTER the puke)
		{
			index: 0,
			type: 'coasterSetup',
			pukes: [
				{ reel: 1, row: 1, multiplier: 2 },
				{ reel: 2, row: 3, multiplier: 2 },
				{ reel: 1, row: 1, multiplier: 4 },
				{ reel: 3, row: 2, multiplier: 2 },
				{ reel: 0, row: 4, multiplier: 2 },
				{ reel: 2, row: 3, multiplier: 4 },
				{ reel: 4, row: 0, multiplier: 2 },
			],
			tiles: COASTER_TILES,
		},
	];

	let totalWin = 0;
	for (let spin = 0; spin < 10; spin += 1) {
		events.push({ index: 0, type: 'updateFreeSpin', amount: spin, total: 10 });

		if (spin === 0) {
			// Line 2 (rows [1,1,1,1,1]): H2 + W(x4 tile) + H2 → 100 × 4 = 400
			events.push({
				index: 0,
				type: 'reveal',
				board: bakeTiles(
					makeBoard([
						['H1', 'H2', 'H3', 'L3', 'H5'],
						['L1', 'L2', 'H4', 'L4', 'L5'],
						['L4', 'H2', 'H3', 'L3', 'H5'],
						['H4', 'L2', 'L1', 'L4', 'L5'],
						['H1', 'L1', 'H3', 'L3', 'H5'],
					]),
					COASTER_TILES,
				),
				paddingPositions: PADDING_POSITIONS,
				anticipation: NO_ANTICIPATION,
				gameType: 'freegame',
			});
			totalWin += 400;
			events.push({
				index: 0,
				type: 'winInfo',
				totalWin: 400,
				wins: [
					{
						symbol: 'H2',
						kind: 3,
						win: 400,
						positions: [
							{ reel: 0, row: 1 },
							{ reel: 1, row: 1 },
							{ reel: 2, row: 1 },
						],
						meta: { lineIndex: 1, multiplier: 4, winWithoutMult: 100, lineMultiplier: 4 },
					},
				],
			});
			events.push({ index: 0, type: 'setTotalWin', amount: totalWin });
		} else if (spin === 5) {
			// Line 5 (rows [4,4,4,4,4]): W(x2 tile) + H4 + H4 → 50 × 2 = 100
			events.push({
				index: 0,
				type: 'reveal',
				board: bakeTiles(
					makeBoard([
						['H1', 'L1', 'H3', 'L3', 'H5'],
						['H2', 'L2', 'L1', 'L4', 'H4'],
						['L1', 'H3', 'H5', 'L3', 'H4'],
						['H2', 'L2', 'L4', 'L1', 'L5'],
						['L2', 'L1', 'H3', 'L3', 'H5'],
					]),
					COASTER_TILES,
				),
				paddingPositions: PADDING_POSITIONS,
				anticipation: NO_ANTICIPATION,
				gameType: 'freegame',
			});
			totalWin += 100;
			events.push({
				index: 0,
				type: 'winInfo',
				totalWin: 100,
				wins: [
					{
						symbol: 'H4',
						kind: 3,
						win: 100,
						positions: [
							{ reel: 0, row: 4 },
							{ reel: 1, row: 4 },
							{ reel: 2, row: 4 },
						],
						meta: { lineIndex: 4, multiplier: 2, winWithoutMult: 50, lineMultiplier: 2 },
					},
				],
			});
			events.push({ index: 0, type: 'setTotalWin', amount: totalWin });
		} else {
			events.push({
				index: 0,
				type: 'reveal',
				board: bakeTiles(quietBoard(), COASTER_TILES),
				paddingPositions: PADDING_POSITIONS,
				anticipation: NO_ANTICIPATION,
				gameType: 'freegame',
			});
		}
	}

	events.push({ index: 0, type: 'freeSpinEnd', amount: totalWin, winLevel: 3 });
	events.push({ index: 0, type: 'finalWin', amount: totalWin });
	return reindex(events);
};

// ── Book 4: wincap round — Duck Your Luck hits the 25,000x cap ──────────────
// Running total clamps at 2,500,000 cents; all ten manual picks still resolve.
const wincapEvents: BookEvent[] = reindex([
	{
		index: 0,
		type: 'reveal',
		board: scatterTriggerBoard('S_DUCK'),
		paddingPositions: PADDING_POSITIONS,
		anticipation: [0, 0, 1, 1, 2],
		gameType: 'basegame',
	},
	{ index: 0, type: 'setTotalWin', amount: 0 },
	{
		index: 0,
		type: 'duckPickStart',
		totalPicks: 10,
		pool: makeDuckPool([
			{ kind: 'mult', value: 500 },
			{ kind: 'multmult', value: 50 },
			{ kind: 'mult', value: 2 },
			{ kind: 'mult', value: 3 },
			{ kind: 'multmult', value: 2 },
			{ kind: 'mult', value: 5 },
			{ kind: 'mult', value: 10 },
			{ kind: 'mult', value: 2 },
			{ kind: 'multmult', value: 3 },
			{ kind: 'mult', value: 15 },
		]),
	},
	{ index: 0, type: 'duckPick', pickIndex: 0, kind: 'mult', value: 500, runningTotal: 50000 },
	{ index: 0, type: 'duckPick', pickIndex: 1, kind: 'multmult', value: 50, runningTotal: 2500000 },
	{ index: 0, type: 'duckPick', pickIndex: 2, kind: 'mult', value: 2, runningTotal: 2500000 },
	{ index: 0, type: 'duckPick', pickIndex: 3, kind: 'mult', value: 3, runningTotal: 2500000 },
	{ index: 0, type: 'duckPick', pickIndex: 4, kind: 'multmult', value: 2, runningTotal: 2500000 },
	{ index: 0, type: 'duckPick', pickIndex: 5, kind: 'mult', value: 5, runningTotal: 2500000 },
	{ index: 0, type: 'duckPick', pickIndex: 6, kind: 'mult', value: 10, runningTotal: 2500000 },
	{ index: 0, type: 'duckPick', pickIndex: 7, kind: 'mult', value: 2, runningTotal: 2500000 },
	{ index: 0, type: 'duckPick', pickIndex: 8, kind: 'multmult', value: 3, runningTotal: 2500000 },
	{ index: 0, type: 'duckPick', pickIndex: 9, kind: 'mult', value: 15, runningTotal: 2500000 },
	{ index: 0, type: 'duckPickEnd', amount: 2500000 },
	{ index: 0, type: 'wincap', amount: 2500000 },
	{ index: 0, type: 'setTotalWin', amount: 2500000 },
	{ index: 0, type: 'setWin', amount: 2500000, winLevel: 10 },
	{ index: 0, type: 'finalWin', amount: 2500000 },
]);

// Hand-crafted books (kept for deterministic minimal coverage)
const handcraftedBooks: StoryBook[] = [
	{
		id: 101,
		payoutMultiplier: 572,
		events: duckYourLuckEvents,
		criteria: 'duck',
		baseGameWins: 0,
		freeGameWins: 572,
	},
	{
		id: 102,
		payoutMultiplier: 32,
		events: buildRollerBonusEvents(),
		criteria: 'roller',
		baseGameWins: 0,
		freeGameWins: 32,
	},
	{
		id: 103,
		payoutMultiplier: 5,
		events: buildCoasterBonusEvents(),
		criteria: 'coaster',
		baseGameWins: 0,
		freeGameWins: 5,
	},
	{
		id: 104,
		payoutMultiplier: 25000,
		events: wincapEvents,
		criteria: 'wincap',
		baseGameWins: 0,
		freeGameWins: 25000,
	},
];

// Real rounds sampled from the simulated math engine come first.
const books: StoryBook[] = [...realBooks, ...handcraftedBooks];

export default books;
