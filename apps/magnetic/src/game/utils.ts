import { stateBet } from 'state-shared';
import { createPlayBookUtils } from 'utils-book';

import { bookEventHandlerMap } from './bookEventHandlerMap';
import { eventEmitter } from './eventEmitter';
import { stateLayoutDerived } from './stateLayout';
import type { Bet, BookEventOfType } from './typesBookEvent';
import type { RawSymbol, SymbolName, SymbolState } from './types';
import { LOW_SYMBOLS, PREMIUM_SYMBOLS, SYMBOL_SIZE_RATIOS, SYMBOL_W } from './constants';

const MOBILE_LAYOUT_TYPES = new Set(['portrait']);
const MOBILE_ELIGIBLE_SYMBOLS = new Set<SymbolName>([
	'H1', 'H2', 'H3', 'H4', 'L1', 'L2', 'L3', 'L4', 'WILD', 'SCATTER',
]);

const DESKTOP_STATIC_KEYS: Record<SymbolName, string> = {
	H1: 'foxTile',
	H2: 'wolfTile',
	H3: 'bearTile',
	H4: 'rabbitTile',
	L1: 'squirrelTile',
	L2: 'aTile',
	L3: 'kTile',
	L4: 'qTile',
	WILD: 'wildTile',
	SCATTER: 'scatterCustom',
};

const MOBILE_STATIC_KEYS: Partial<Record<SymbolName, string>> = {
	H1: 'foxTileMobile',
	H2: 'wolfTileMobile',
	H3: 'bearTileMobile',
	H4: 'rabbitTileMobile',
	L1: 'squirrelTileMobile',
	L2: 'aTileMobile',
	L3: 'kTileMobile',
	L4: 'qTileMobile',
	WILD: 'wildTileMobile',
	SCATTER: 'scatterCustomMobile',
};

const DESKTOP_WIN_KEYS: Record<SymbolName, string> = {
	H1: 'foxWinTile',
	H2: 'wolfWinTile',
	H3: 'bearWinTile',
	H4: 'rabbitWinTile',
	L1: 'squirrelWinTile',
	L2: 'aWinTile',
	L3: 'kWinTile',
	L4: 'qWinTile',
	WILD: 'wildWinTile',
	SCATTER: 'scatterWin',
};

const MOBILE_WIN_KEYS: Partial<Record<SymbolName, string>> = {
	H1: 'foxWinTileMobile',
	H2: 'wolfWinTileMobile',
	H3: 'bearWinTileMobile',
	H4: 'rabbitWinTileMobile',
	L1: 'squirrelWinTileMobile',
	L2: 'aWinTileMobile',
	L3: 'kWinTileMobile',
	L4: 'qWinTileMobile',
	WILD: 'wildWinTileMobile',
	SCATTER: 'scatterWinMobile',
};

const MULTIPLIER_WILD_KEYS: Record<number, string> = {
	2: 'wild2xTile',
	3: 'wild3xTile',
	4: 'wild4xTile',
	5: 'wild5xTile',
	7: 'wild7xTile',
	9: 'wild9xTile',
	10: 'wild10xTile',
};

const MULTIPLIER_WILD_KEYS_MOBILE: Record<number, string> = {
	2: 'wild2xTileMobile',
	3: 'wild3xTileMobile',
	4: 'wild4xTileMobile',
	5: 'wild5xTileMobile',
	7: 'wild7xTileMobile',
	9: 'wild9xTileMobile',
	10: 'wild10xTileMobile',
};

const useMobileVariant = (name: SymbolName) =>
	MOBILE_LAYOUT_TYPES.has(stateLayoutDerived.layoutType()) && MOBILE_ELIGIBLE_SYMBOLS.has(name);

export const getSpriteKeyByName = ({
	name,
	state = 'static',
	multiplier,
}: {
	name: SymbolName;
	state?: 'static' | 'win';
	multiplier?: number;
}) => {
	const mobile = useMobileVariant(name);

	if (name === 'WILD' && multiplier && multiplier > 1) {
		const keys = Object.keys(MULTIPLIER_WILD_KEYS).map(Number).sort((a, b) => a - b);
		const snapped = keys.reduce((prev, cur) => (Math.abs(cur - multiplier) < Math.abs(prev - multiplier) ? cur : prev));
		return (mobile ? MULTIPLIER_WILD_KEYS_MOBILE : MULTIPLIER_WILD_KEYS)[snapped]
			?? (mobile ? 'wild10xTileMobile' : 'wild10xTile');
	}

	if (state === 'win') {
		return (mobile ? MOBILE_WIN_KEYS[name] : undefined)
			?? DESKTOP_WIN_KEYS[name]
			?? DESKTOP_STATIC_KEYS[name];
	}

	return (mobile ? MOBILE_STATIC_KEYS[name] : undefined)
		?? DESKTOP_STATIC_KEYS[name]
		?? DESKTOP_WIN_KEYS[name];
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

export const getSymbolInfo = ({ rawSymbol, state }: { rawSymbol: RawSymbol; state: SymbolState }) => {
	const assetState = ['win', 'locked', 'magnet'].includes(state) ? 'win' : 'static';
	const assetKey = getSpriteKeyByName({
		name: rawSymbol.name,
		state: assetState as 'static' | 'win',
		multiplier: rawSymbol.multiplier,
	});

	const sizeRatios =
		rawSymbol.name === 'WILD' && rawSymbol.multiplier && rawSymbol.multiplier > 1
			? SYMBOL_SIZE_RATIOS.multiplierWild
			: PREMIUM_SYMBOLS.includes(rawSymbol.name)
				? SYMBOL_SIZE_RATIOS.premium
				: LOW_SYMBOLS.includes(rawSymbol.name)
					? SYMBOL_SIZE_RATIOS.low
					: SYMBOL_SIZE_RATIOS.special;

	return {
		type: 'sprite' as const,
		assetKey,
		sizeRatios,
	};
};

export const shouldShowMultiplierText = (rawSymbol: RawSymbol) =>
	rawSymbol.wild && !!rawSymbol.multiplier && rawSymbol.multiplier > 1;

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
