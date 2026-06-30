import { stateBet } from 'state-shared';
import { createPlayBookUtils } from 'utils-book';

import { bookEventHandlerMap } from './bookEventHandlerMap';
import { eventEmitter } from './eventEmitter';
import type { Bet, BookEventOfType } from './typesBookEvent';
import type { RawSymbol, SymbolName, SymbolState } from './types';
import { SYMBOL_INFO_MAP, SYMBOL_W } from './constants';

export const spriteKeyByName: Record<SymbolName, string> = {
	H1: 'foxTile',
	H2: 'wolfTile',
	H3: 'bearTile',
	H4: 'rabbitTile',
	L1: 'squirrelTile',
	L2: 'aTile',
	L3: 'kTile',
	L4: 'qTile',
	WILD: 'wildTile',
	MAGNET: 'wildTile',
	SCATTER: 'scatterCustom',
};

export const bonusSpriteKeyByName: Record<SymbolName, string> = {
	...spriteKeyByName,
	MAGNET: 'wildWinTile',
};

export const winSpriteKeyByName: Record<SymbolName, string> = {
	H1: 'foxWinTile',
	H2: 'wolfWinTile',
	H3: 'bearWinTile',
	H4: 'rabbitWinTile',
	L1: 'squirrelWinTile',
	L2: 'aWinTile',
	L3: 'kWinTile',
	L4: 'qWinTile',
	WILD: 'wildWinTile',
	MAGNET: 'wildWinTile',
	SCATTER: 'scatterWin',
};

export const winBoardByAlias: Record<string, string> = {
	zero: 'sweetWinBoard',
	standard: 'sweetWinBoard',
	small: 'sweetWinBoard',
	nice: 'sweetWinBoard',
	substantial: 'wildWinBoard',
	big: 'wildWinBoard',
	superwin: 'epicWinBoard',
	mega: 'mythicWinBoard',
	epic: 'legendaryWinBoard',
	max: 'legendaryWinBoard',
};

export const getReelCenterX = (reelIndex: number): number => SYMBOL_W * (reelIndex + 0.5);
export const getSymbolX = (reelIndex: number): number => SYMBOL_W * (reelIndex + 0.5);

export const getSymbolInfo = ({ rawSymbol, state }: { rawSymbol: RawSymbol; state: SymbolState }) =>
	SYMBOL_INFO_MAP[rawSymbol.name][state];

export const { playBookEvent, playBookEvents } = createPlayBookUtils({ bookEventHandlerMap });

export const playBet = async (bet: Bet) => {
	stateBet.winBookEventAmount = 0;
	await playBookEvents(bet.state);
	eventEmitter.broadcast({ type: 'stopButtonEnable' });
};

const BOOK_EVENT_TYPES_TO_RESERVE_FOR_SNAPSHOT = [
	'reveal',
	'magnetActivated',
	'clusterSeriesUpdate',
	'superSeriesCarry',
	'freeSpinTrigger',
	'updateFreeSpin',
	'setTotalWin',
] as const;

export const convertTorResumableBet = (betToResume: Bet) => {
	const resumingIndex = Number(betToResume.event);
	const bookEventsBeforeResume = betToResume.state.filter((_, eventIndex) => eventIndex < resumingIndex);
	const bookEventsAfterResume = betToResume.state.filter((_, eventIndex) => eventIndex >= resumingIndex);

	const bookEventToCreateSnapshot: BookEventOfType<'createBonusSnapshot'> = {
		index: 0,
		type: 'createBonusSnapshot',
		bookEvents: bookEventsBeforeResume.filter((bookEvent) =>
			BOOK_EVENT_TYPES_TO_RESERVE_FOR_SNAPSHOT.includes(bookEvent.type as (typeof BOOK_EVENT_TYPES_TO_RESERVE_FOR_SNAPSHOT)[number]),
		),
	};

	return {
		...betToResume,
		state: [bookEventToCreateSnapshot, ...bookEventsAfterResume],
	};
};
