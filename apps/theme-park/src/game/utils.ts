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
	H1: 'tpH1',
	H2: 'tpH2',
	H3: 'tpH3',
	H4: 'tpH4',
	H5: 'tpH5',
	L1: 'tpL1',
	L2: 'tpL2',
	L3: 'tpL3',
	L4: 'tpL4',
	L5: 'tpL5',
	W: 'tpWildDesktop',
	DC: 'tpH2',
	S_DUCK: 'tpDuckScatterDesktop',
	S_ROLLER: 'tpRollerScatterDesktop',
	S_COASTER: 'tpCoasterScatterDesktop',
};

// Bonus spins reuse the same themed symbol atlas.
export const bonusSpriteKeyByName: Record<SymbolName, string> = { ...spriteKeyByName };

// Win state sprite keys
export const winSpriteKeyByName: Record<SymbolName, string> = {
	...spriteKeyByName,
	H1: 'tpH1Win',
	H2: 'tpH2Win',
	H3: 'tpH3Win',
	H4: 'tpH4Win',
	H5: 'tpH5Win',
	L1: 'tpL1Win',
	L2: 'tpL2Win',
	L3: 'tpL3Win',
	L4: 'tpL4Win',
	L5: 'tpL5Win',
	DC: 'tpH2Win',
};

export type SpecialSymbolVisual =
	| 'wild'
	| 'megaWild'
	| 'duckScatter'
	| 'rollerScatter'
	| 'coasterScatter';

const specialSymbolKeys = {
	wild: {
		desktop: 'tpWildDesktop',
		portrait: 'tpWildMobile',
		landscape: 'tpWildLandscape',
	},
	megaWild: {
		desktop: 'tpMegaWildDesktop',
		portrait: 'tpMegaWildMobile',
		landscape: 'tpMegaWildLandscape',
	},
	duckScatter: {
		desktop: 'tpDuckScatterDesktop',
		portrait: 'tpDuckScatterMobile',
		landscape: 'tpDuckScatterLandscape',
	},
	rollerScatter: {
		desktop: 'tpRollerScatterDesktop',
		portrait: 'tpRollerScatterMobile',
		landscape: 'tpRollerScatterLandscape',
	},
	coasterScatter: {
		desktop: 'tpCoasterScatterDesktop',
		portrait: 'tpCoasterScatterMobile',
		landscape: 'tpCoasterScatterLandscape',
	},
} as const;

export const getSpecialSymbolKey = (visual: SpecialSymbolVisual, layoutType: string) => {
	const variant =
		layoutType === 'portrait' ? 'portrait' : layoutType === 'landscape' ? 'landscape' : 'desktop';
	return specialSymbolKeys[visual][variant];
};

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
	const bookEventsBeforeResume = betToResume.state.filter(
		(_, eventIndex) => eventIndex < resumingIndex,
	);
	const bookEventsAfterResume = betToResume.state.filter(
		(_, eventIndex) => eventIndex >= resumingIndex,
	);

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
