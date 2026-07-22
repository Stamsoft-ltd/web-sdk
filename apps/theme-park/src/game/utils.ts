import { stateBet } from 'state-shared';
import { createPlayBookUtils } from 'utils-book';

import { bookEventHandlerMap } from './bookEventHandlerMap';
import { eventEmitter } from './eventEmitter';
import type { Bet, BookEventOfType } from './typesBookEvent';
import type { SymbolName, SymbolState, RawSymbol } from './types';
import { SYMBOL_INFO_MAP, SYMBOL_W } from './constants';

// Maps from SymbolName → asset key for each state.
// Used by Board.svelte when NOT in bonus mode (base game).
export const spriteKeyByName: Record<SymbolName, string> = {
	H1: 'tp_h1.png',
	H2: 'tp_h2.png',
	H3: 'tp_h3.png',
	H4: 'tp_h4.png',
	H5: 'tp_h5.png',
	L1: 'tp_l1.png',
	L2: 'tp_l2.png',
	L3: 'tp_l3.png',
	L4: 'tp_l4.png',
	L5: 'tp_l5.png',
	W: 'tp_wild.png',
	DC: 'tp_duck_collect.png',
	S_DUCK: 'tp_scatter_duck.png',
	S_ROLLER: 'tp_scatter_roller.png',
	S_COASTER: 'tp_scatter_coaster.png',
};

// Bonus spins reuse the same themed symbol atlas.
export const bonusSpriteKeyByName: Record<SymbolName, string> = { ...spriteKeyByName };

// Win state sprite keys
export const winSpriteKeyByName: Record<SymbolName, string> = { ...spriteKeyByName };

export const getReelCenterX = (reelIndex: number): number => SYMBOL_W * (reelIndex + 0.5);

export const getSymbolInfo = ({ rawSymbol, state }: { rawSymbol: RawSymbol; state: SymbolState }) =>
	SYMBOL_INFO_MAP[rawSymbol.name][state];

export const getSymbolX = (reelIndex: number): number => SYMBOL_W * (reelIndex + 0.5);

export const { playBookEvent, playBookEvents } = createPlayBookUtils({ bookEventHandlerMap });

export const playBet = async (bet: Bet) => {
	stateBet.winBookEventAmount = 0;
	await playBookEvents(bet.state);
	eventEmitter.broadcast({ type: 'stopButtonEnable' });
};

const BOOK_EVENT_TYPES_TO_RESERVE_FOR_SNAPSHOT = [
	'reveal',
	'freeSpinTrigger',
	'updateFreeSpin',
	'coasterSetup',
	'rollerWildsApply',
	'winInfo',
	'setWin',
	'setTotalWin',
];

export const convertTorResumableBet = (betToResume: Bet) => {
	const resumingIndex = Number(betToResume.event);
	const bookEventsBeforeResume = betToResume.state.filter((_, eventIndex) => eventIndex < resumingIndex);
	const bookEventsAfterResume = betToResume.state.filter((_, eventIndex) => eventIndex >= resumingIndex);

	const bookEventToCreateSnapshot: BookEventOfType<'createBonusSnapshot'> = {
		index: 0,
		type: 'createBonusSnapshot',
		bookEvents: bookEventsBeforeResume.filter((bookEvent) =>
			BOOK_EVENT_TYPES_TO_RESERVE_FOR_SNAPSHOT.includes(bookEvent.type),
		),
	};

	return {
		...betToResume,
		state: [bookEventToCreateSnapshot, ...bookEventsAfterResume],
	};
};
