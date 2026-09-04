import { stateBet } from 'state-shared';
import { loadDemandAssets } from 'pixi-svelte';
import { createPlayBookUtils } from 'utils-book';

import { bookEventHandlerMap } from './bookEventHandlerMap';
import { eventEmitter } from './eventEmitter';
import { stateLayoutDerived } from './stateLayout';
import type { Bet, BookEventOfType } from './typesBookEvent';
import type { RawSymbol, SymbolName, SymbolState } from './types';
import {
	LOW_SYMBOLS,
	PREMIUM_SYMBOLS,
	SYMBOL_PAD_SCALE,
	SYMBOL_SIZE_OVERRIDE,
	SYMBOL_SIZE_RATIOS,
	SYMBOL_W,
} from './constants';

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
	MAGNET: 'magnetTile',
	SCATTER: 'scatterCustom',
	POLARITY: 'polarityNeutral',
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
	MAGNET: 'magnetTile',
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
	MAGNET: 'magnetWinTile',
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
	MAGNET: 'magnetWinTile',
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

// Landscape (mobile horizontal) symbol art. Symbols with no landscape variant fall back to desktop.
const LANDSCAPE_STATIC_KEYS: Partial<Record<SymbolName, string>> = {
	H1: 'foxTileLand',
	H2: 'wolfTileLand',
	H3: 'bearTileLand',
	H4: 'rabbitTileLand',
	L1: 'squirrelTileLand',
	L2: 'aTileLand',
	L3: 'kTileLand',
	L4: 'qTileLand',
	WILD: 'wildTileLand',
	SCATTER: 'scatterTileLand',
};

const LANDSCAPE_WIN_KEYS: Partial<Record<SymbolName, string>> = {
	H1: 'foxWinTileLand',
	H2: 'wolfWinTileLand',
	H3: 'bearWinTileLand',
	H4: 'rabbitWinTileLand',
	L1: 'squirrelWinTileLand',
	L2: 'aWinTileLand',
	L3: 'kWinTileLand',
	L4: 'qWinTileLand',
};

const MULTIPLIER_WILD_KEYS_LANDSCAPE: Record<number, string> = {
	2: 'wild2xTileLand',
	3: 'wild3xTileLand',
	4: 'wild4xTileLand',
	5: 'wild5xTileLand',
	7: 'wild7xTileLand',
	9: 'wild9xTileLand',
	10: 'wild10xTileLand',
};

// Which per-layout art set to use. Portrait → mobile (vertical) art, mobile-landscape → landscape
// (horizontal) art, everything else → desktop.
const layoutVariant = (): 'mobile' | 'land' | 'desktop' => {
	const lt = stateLayoutDerived.layoutType();
	if (lt === 'portrait') return 'mobile';
	if (lt === 'landscape') return 'land';
	return 'desktop';
};

export const getSpriteKeyByName = ({
	name,
	state = 'static',
	multiplier,
	magnet,
}: {
	name: SymbolName;
	state?: 'static' | 'win';
	multiplier?: number;
	magnet?: boolean;
}) => {
	const visualName: SymbolName = magnet && name !== 'WILD' ? 'MAGNET' : name;
	const variant = layoutVariant();
	const staticMap =
		variant === 'mobile' ? MOBILE_STATIC_KEYS : variant === 'land' ? LANDSCAPE_STATIC_KEYS : null;
	const winMap =
		variant === 'mobile' ? MOBILE_WIN_KEYS : variant === 'land' ? LANDSCAPE_WIN_KEYS : null;

	if (visualName === 'WILD' && multiplier && multiplier > 1) {
		const keys = Object.keys(MULTIPLIER_WILD_KEYS)
			.map(Number)
			.sort((a, b) => a - b);
		const snapped = keys.reduce((prev, cur) =>
			Math.abs(cur - multiplier) < Math.abs(prev - multiplier) ? cur : prev,
		);
		const multMap =
			variant === 'mobile'
				? MULTIPLIER_WILD_KEYS_MOBILE
				: variant === 'land'
					? MULTIPLIER_WILD_KEYS_LANDSCAPE
					: MULTIPLIER_WILD_KEYS;
		return multMap[snapped] ?? MULTIPLIER_WILD_KEYS[snapped] ?? 'wild10xTile';
	}

	if (state === 'win') {
		return winMap?.[visualName] ?? DESKTOP_WIN_KEYS[visualName] ?? DESKTOP_STATIC_KEYS[visualName];
	}

	return staticMap?.[visualName] ?? DESKTOP_STATIC_KEYS[visualName] ?? DESKTOP_WIN_KEYS[visualName];
};

export const getReelCenterX = (reelIndex: number): number => SYMBOL_W * (reelIndex + 0.5);
export const getSymbolX = (reelIndex: number): number => SYMBOL_W * (reelIndex + 0.5);

export const getSymbolInfo = ({
	rawSymbol,
	state,
}: {
	rawSymbol: RawSymbol;
	state: SymbolState;
}) => {
	const assetState = ['win', 'magnet'].includes(state) ? 'win' : 'static';
	const assetKey = getSpriteKeyByName({
		name: rawSymbol.name,
		state: assetState as 'static' | 'win',
		multiplier: rawSymbol.multiplier,
		magnet: rawSymbol.magnet || rawSymbol.name === 'MAGNET',
	});

	const baseRatios =
		rawSymbol.name === 'WILD' && rawSymbol.multiplier && rawSymbol.multiplier > 1
			? SYMBOL_SIZE_RATIOS.multiplierWild
			: PREMIUM_SYMBOLS.includes(rawSymbol.name)
				? SYMBOL_SIZE_RATIOS.premium
				: LOW_SYMBOLS.includes(rawSymbol.name)
					? SYMBOL_SIZE_RATIOS.low
					: SYMBOL_SIZE_RATIOS.special;
	// Cancel the transparent padding baked into this particular asset so the ARTWORK fills a
	// consistent share of the cell (see SYMBOL_PAD_SCALE). Keyed by asset key, not symbol name,
	// because the desktop / mobile / landscape art of one symbol is padded differently.
	//
	// This replaces a hand-tuned `H1 -> * 0.84` shrink. That existed because H1's art fills more of
	// its file vertically than its peers (0.81 vs ~0.71), so at a shared ratio it read oversized —
	// exactly the imbalance normalising against measured content now removes for every symbol at
	// once. Keeping both would leave H1 uniquely undersized.
	const pad = (SYMBOL_PAD_SCALE[assetKey] ?? 1) * (SYMBOL_SIZE_OVERRIDE[assetKey] ?? 1);
	const sizeRatios =
		pad === 1 ? baseRatios : { width: baseRatios.width * pad, height: baseRatios.height * pad };

	return {
		type: 'sprite' as const,
		assetKey,
		sizeRatios,
	};
};

export const shouldShowMultiplierText = (rawSymbol: RawSymbol) =>
	rawSymbol.wild && !!rawSymbol.multiplier && rawSymbol.multiplier > 1;

// Bonus art is demand-loaded (see the deferDemand list in game/assets.ts), so every book event
// that DRAWS it has to wait for it. This is the complete consumer list: the bonus backgrounds and
// transition spine (freeSpinTrigger / freeSpinEnd), the free-spins popups (both fire off
// freeSpinTrigger), and a resumed round, which replays all of those inside itself
// (createBonusSnapshot). Between them they cover every entry path into the bonus — natural
// scatter, a bought GRAVITY BREACH / CORE OVERLOAD round, an activated FEATURE round, and resume —
// because the gate is on the event that draws, not on how the round was entered.
const BONUS_ART_EVENTS: ReadonlySet<string> = new Set([
	'freeSpinTrigger',
	'freeSpinEnd',
	'createBonusSnapshot',
	// The Mystery draw runs BEFORE the trigger it announces, and it draws its own art (the orb and
	// the three "you won" plates), so it needs the gate in its own right — waiting only on the
	// trigger would have the orb try to paint from an empty texture cache.
	'mysteryBonusReveal',
]);

// Gating the handlers rather than playBet itself keeps the spin start instant: playBet kicks the
// download off as soon as the book arrives, the board drops through it, and only the first event
// that actually draws bonus art waits — by which point it is normally already in.
type AnyBookEventHandler = (bookEvent: never, context: never) => Promise<void>;
const bonusArtGatedHandlerMap = Object.fromEntries(
	Object.entries(bookEventHandlerMap as Record<string, AnyBookEventHandler>).map(
		([type, handler]) =>
			BONUS_ART_EVENTS.has(type)
				? ([
						type,
						(async (bookEvent, context) => {
							await loadDemandAssets();
							await handler(bookEvent, context);
						}) as AnyBookEventHandler,
					] as const)
				: ([type, handler] as const),
	),
) as typeof bookEventHandlerMap;

export const { playBookEvent, playBookEvents } = createPlayBookUtils({
	bookEventHandlerMap: bonusArtGatedHandlerMap,
});

export const playBet = async (bet: Bet) => {
	stateBet.winBookEventAmount = 0;
	// Start the bonus-art download the moment the book is known — deliberately NOT awaited, the
	// presentation must not wait on it here. loadDemandAssets() is idempotent and returns the one
	// shared promise, so the handler gate above awaits this very load.
	if (bet.state.some((bookEvent) => BONUS_ART_EVENTS.has(bookEvent.type))) void loadDemandAssets();
	await playBookEvents(bet.state);
	eventEmitter.broadcast({ type: 'stopButtonEnable' });
};

const BOOK_EVENT_TYPES_TO_RESERVE_FOR_SNAPSHOT = [
	'reveal',
	'magnetTargetSelected',
	'magnetActivated',
	'clusterSeriesUpdate',
	'superSeriesCarry',
	'freeSpinTrigger',
	'updateFreeSpin',
	'setTotalWin',
] as const;

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
			BOOK_EVENT_TYPES_TO_RESERVE_FOR_SNAPSHOT.includes(
				bookEvent.type as (typeof BOOK_EVENT_TYPES_TO_RESERVE_FOR_SNAPSHOT)[number],
			),
		),
	};

	return {
		...betToResume,
		state: [bookEventToCreateSnapshot, ...bookEventsAfterResume],
	};
};
