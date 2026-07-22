// One sample per bonus book event type (contract shapes, amounts in cents).
import type { BookEvent } from '../../game/typesBookEvent';
import { makeDuckPool } from './duckPools';

const events = {
	freeSpinTrigger: {
		index: 0,
		type: 'freeSpinTrigger',
		totalFs: 10,
		positions: [
			{ reel: 0, row: 1 },
			{ reel: 2, row: 2 },
			{ reel: 4, row: 3 },
		],
		bonusType: 'roller',
	},
	freeSpinTriggerCoaster: {
		index: 0,
		type: 'freeSpinTrigger',
		totalFs: 10,
		positions: [
			{ reel: 0, row: 1 },
			{ reel: 2, row: 2 },
			{ reel: 4, row: 3 },
		],
		bonusType: 'coaster',
	},
	updateFreeSpin: { index: 0, type: 'updateFreeSpin', amount: 0, total: 10 },
	freeSpinEnd: { index: 0, type: 'freeSpinEnd', amount: 3200, winLevel: 5 },
	wincap: { index: 0, type: 'wincap', amount: 2500000 },
	duckPickStart: {
		index: 0,
		type: 'duckPickStart',
		totalPicks: 10,
		pool: makeDuckPool([
			{ kind: 'mult', value: 10 },
			{ kind: 'multmult', value: 5 },
		]),
	},
	duckPick: {
		index: 0,
		type: 'duckPick',
		pickIndex: 0,
		kind: 'mult',
		value: 10,
		runningTotal: 1000,
	},
	duckPickMultMult: {
		index: 0,
		type: 'duckPick',
		pickIndex: 1,
		kind: 'multmult',
		value: 5,
		runningTotal: 5000,
	},
	duckPickEnd: { index: 0, type: 'duckPickEnd', amount: 5000 },
	coasterSetup: {
		index: 0,
		type: 'coasterSetup',
		pukes: [
			{ reel: 1, row: 1, multiplier: 2 },
			{ reel: 2, row: 3, multiplier: 2 },
			{ reel: 1, row: 1, multiplier: 4 },
			{ reel: 3, row: 2, multiplier: 2 },
			{ reel: 0, row: 4, multiplier: 2 },
		],
		tiles: [
			{ reel: 1, row: 1, multiplier: 4 },
			{ reel: 2, row: 3, multiplier: 2 },
			{ reel: 3, row: 2, multiplier: 2 },
			{ reel: 0, row: 4, multiplier: 2 },
		],
	},
} satisfies Record<string, BookEvent>;

export default events;
