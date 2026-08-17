// One sample per base-game book event type (contract shapes, amounts in cents).
import type { BookEvent } from '../../game/typesBookEvent';
import { makeBoard, PADDING_POSITIONS, NO_ANTICIPATION } from './helpers';

const events = {
	reveal: {
		index: 0,
		type: 'reveal',
		board: makeBoard([
			['H1', 'L1', 'H3', 'L3', 'H5'],
			['H2', 'L2', 'H4', 'L4', 'L5'],
			['H1', 'DC', 'H3', 'L3', 'H5'],
			['H2', 'L2', 'H4', 'L4', 'L5'],
			['H1', 'L1', 'H3', 'S_DUCK', 'H5'],
		]),
		paddingPositions: PADDING_POSITIONS,
		anticipation: NO_ANTICIPATION,
		gameType: 'basegame',
	},
	winInfo: {
		index: 0,
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
	setTotalWin: { index: 0, type: 'setTotalWin', amount: 200 },
	setWin: { index: 0, type: 'setWin', amount: 200, winLevel: 2 },
	finalWin: { index: 0, type: 'finalWin', amount: 200 },
	duckCollectStart: {
		index: 0,
		type: 'duckCollectStart',
		positions: [
			{ reel: 1, row: 2 },
			{ reel: 3, row: 1 },
		],
	},
	duckReveal: {
		index: 0,
		type: 'duckReveal',
		position: { reel: 1, row: 2 },
		kind: 'mult',
		value: 25,
		runningTotal: 2500,
	},
	duckCollectEnd: { index: 0, type: 'duckCollectEnd', amount: 2500 },
	rollerWildsApply: {
		index: 0,
		type: 'rollerWildsApply',
		reels: [
			{ reel: 0, triggerRow: 3, fakeMultiplier: 5, multiplier: 1 },
			{ reel: 2, triggerRow: 3, fakeMultiplier: 10, multiplier: 2 },
			{ reel: 3, triggerRow: 1, fakeMultiplier: 2, multiplier: 3 },
		],
	},
	// Current math contract: one trigger wild per affected reel. The event expands them.
	revealRollerWilds: {
		index: 0,
		type: 'reveal',
		board: makeBoard([
			['H1', 'H3', 'L1', { name: 'W', wild: true, rollerTrigger: true }, 'H5'],
			['H2', 'L2', 'H4', 'L4', 'L5'],
			['L1', 'H3', 'H5', { name: 'W', wild: true, rollerTrigger: true }, 'H1'],
			['H2', { name: 'W', wild: true, rollerTrigger: true }, 'H4', 'L4', 'L5'],
			['H1', 'L1', 'H3', 'L3', 'H5'],
		]),
		paddingPositions: PADDING_POSITIONS,
		anticipation: NO_ANTICIPATION,
		gameType: 'basegame',
	},
} satisfies Record<string, BookEvent>;

export default events;
