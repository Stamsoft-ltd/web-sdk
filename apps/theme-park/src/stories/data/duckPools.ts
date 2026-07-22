import type { DuckPrize } from '../../game/types';

const FILLER_PRIZES: DuckPrize[] = [
	{ kind: 'mult', value: 2 },
	{ kind: 'mult', value: 3 },
	{ kind: 'multmult', value: 2 },
	{ kind: 'mult', value: 5 },
	{ kind: 'mult', value: 10 },
	{ kind: 'mult', value: 2 },
	{ kind: 'multmult', value: 3 },
	{ kind: 'mult', value: 15 },
	{ kind: 'mult', value: 3 },
	{ kind: 'mult', value: 25 },
	{ kind: 'multmult', value: 2 },
	{ kind: 'mult', value: 5 },
	{ kind: 'mult', value: 50 },
	{ kind: 'mult', value: 2 },
	{ kind: 'mult', value: 100 },
	{ kind: 'mult', value: 3 },
	{ kind: 'multmult', value: 5 },
	{ kind: 'mult', value: 2 },
	{ kind: 'mult', value: 10 },
	{ kind: 'mult', value: 5 },
	{ kind: 'multmult', value: 2 },
	{ kind: 'mult', value: 3 },
	{ kind: 'mult', value: 25 },
	{ kind: 'mult', value: 2 },
	{ kind: 'mult', value: 15 },
];

export const makeDuckPool = (selected: DuckPrize[]): DuckPrize[] => [
	...selected,
	...FILLER_PRIZES.slice(0, 25 - selected.length),
];
