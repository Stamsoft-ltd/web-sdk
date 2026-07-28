import { stateBet } from 'state-shared';
import { loadDemandAssets } from 'pixi-svelte';
import { createPlayBookUtils } from 'utils-book';
import { createGetEmptyPaddedBoard } from 'utils-slots';

import { SYMBOL_W, SYMBOL_H, SYMBOL_SIZE, REEL_PADDING, BOARD_DIMENSIONS } from './constants';
import { eventEmitter } from './eventEmitter';
import type { Bet, BookEventOfType } from './typesBookEvent';
import { bookEventHandlerMap } from './bookEventHandlerMap';
import { resetHolds } from './sequenceHold';
import { stateGameDerived } from './stateGame.svelte';
import type { RawSymbol, SymbolState } from './types';

export const { getEmptyBoard } = createGetEmptyPaddedBoard({ reelsDimensions: BOARD_DIMENSIONS });

// Bonus art is demand-loaded (assets.ts DEMAND_BONUS_ART), so every book event that DRAWS it has to
// wait for it. This is the complete consumer list: the transition spine and bonus backgrounds
// (freeSpinTrigger / freeSpinEnd), the deer presenter (bonusSymbolSelected), the expanded money
// sheets (expandedSymbolReveal), and a resumed round, which replays all of those inside itself
// (createBonusSnapshot). Between them they cover every entry path into the bonus — natural scatter,
// a bought BONUS/SUPER round, a one-spin FEATURE book, and resume — because the gate is on the
// event that draws, not on how the round was entered.
const BONUS_ART_EVENTS: ReadonlySet<string> = new Set([
	'freeSpinTrigger',
	'freeSpinEnd',
	'bonusSymbolSelected',
	'expandedSymbolReveal',
	'createBonusSnapshot',
]);

// Gating the handlers rather than playBet itself keeps the spin start instant: playBet kicks the
// download off as soon as the book arrives, the reels spin through it, and only the first event
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
	// Sequence boundary. One book = one hold sequence, so a stop press skips the remaining beats
	// across every handler in it — but `pendingInterrupt` is sticky, so it MUST be cleared here
	// (and in the `finally` below, incl. the throw path) or the next round's holds all resolve
	// instantly and the game sits in an invisible permanent turbo.
	resetHolds();
	try {
		await playBookEvents(bet.state);
	} catch (error) {
		// A book-event handler that throws (e.g. a malformed/partial event with a missing
		// field) must NOT reject the game actor: the xstate `play`/`ending` states have no
		// onError, so a rejection would strand the machine in `bet` with frozen reels and no
		// error modal. Contain it here — log, settle the board to a safe state, and resolve
		// normally so the machine still flows play.onDone -> endGame and the round is credited
		// from the authoritative RGS result rather than the (aborted) local presentation.
		console.error('[forest-gang] playBet aborted — book-event playback threw:', error);
		try {
			stateGameDerived.enhancedBoard.settle();
		} catch {
			// settle is best-effort recovery; never let it re-throw out of the catch.
		}
	} finally {
		resetHolds();
		// Always hand controls back to the player, even on the abort path.
		eventEmitter.broadcast({ type: 'stopButtonEnable' });
	}
};

// Keep ALL event types so createBonusSnapshot can replay the full bonus from scratch
const BOOK_EVENT_TYPES_TO_RESERVE_FOR_SNAPSHOT = [
	'reveal',
	'bonusSymbolSelected',
	'updateGlobalMultiplier',
	'expandedSymbolReveal',
	'freeSpinTrigger',
	'updateFreeSpin',
	'applyTempMultiplier',
	'winInfo',
	'setWin',
	'setTotalWin',
	'retriggerFreeSpins',
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

	const stateToResume = [bookEventToCreateSnapshot, ...bookEventsAfterResume];

	return { ...betToResume, state: stateToResume };
};

export const getSymbolX = (reelIndex: number) => SYMBOL_W * (reelIndex + REEL_PADDING);
export const getSymbolY = (symbolIndexOfBoard: number) => (symbolIndexOfBoard + 0.5) * SYMBOL_H;
export const getReelCenterX = (reelIndex: number) => SYMBOL_W * (reelIndex + 0.5);

export const spriteKeyByName: Record<string, string> = {
	FOX: 'foxTile',
	WOLF: 'wolfTile',
	BEAR: 'bearTile',
	RABBIT: 'rabbitTile',
	SQUIRREL: 'squirrelTile',
	A: 'aTile',
	K: 'kTile',
	Q: 'qTile',
	J: 'jTile',
	T: 'tTile',
	WILD: 'wildTile',
	SCATTER: 'scatterCustom',
};

// Board sprites in bonus mode — same as base (premiums use the standard animal art)
export const bonusSpriteKeyByName: Record<string, string> = { ...spriteKeyByName };

// Mobile-landscape base + win art (dedicated framed tiles). Only used when
// layoutType() === 'landscape'; desktop/portrait keep the maps above untouched.
export const spriteKeyByNameLandscape: Record<string, string> = {
	FOX: 'foxTileLs',
	WOLF: 'wolfTileLs',
	BEAR: 'bearTileLs',
	RABBIT: 'rabbitTileLs',
	SQUIRREL: 'squirrelTileLs',
	A: 'aTileLs',
	K: 'kTileLs',
	Q: 'qTileLs',
	J: 'jTileLs',
	T: 'tTileLs',
	WILD: 'wildTileLs',
	SCATTER: 'scatterCustomLs',
};

export const winSpriteKeyByNameLandscape: Record<string, string> = {
	FOX: 'foxWinTileLs',
	WOLF: 'wolfWinTileLs',
	BEAR: 'bearWinTileLs',
	RABBIT: 'rabbitWinTileLs',
	SQUIRREL: 'squirrelWinTileLs',
	WILD: 'wildTileLs',
	SCATTER: 'scatterCustomLs',
};

// Win-state board sprites on reel. Animals point at their own win still (the held final frame of
// the win clip) rather than the base tile, so a win that falls back to a static shows the
// celebration pose, not the idle one — matching what the landscape map has always done.
// Letters are absent on purpose: Board draws a winning letter from this map's fallback (its CLEAN
// base tile) with a continuous pulse, so the old dedicated card_*_win art was never reached and
// has been deleted along with its keys.
export const winSpriteKeyByName: Record<string, string> = {
	FOX: 'foxWinTile',
	WOLF: 'wolfWinTile',
	BEAR: 'bearWinTile',
	RABBIT: 'rabbitWinTile',
	SQUIRREL: 'squirrelWinTile',
	WILD: 'wildWinTile',
	SCATTER: 'scatterWin',
};

// Win board asset key by win level alias
export const winBoardByAlias: Record<string, string> = {
	big: 'sweetWinBoard',
	superwin: 'wildWinBoard',
	mega: 'epicWinBoard',
	epic: 'mythicWinBoard',
	max: 'legendaryWinBoard',
};

// Reverse: board asset key → win level alias (for dynamic coin escalation)
export const winAliasByBoard: Record<string, string> = {
	sweetWinBoard: 'big',
	wildWinBoard: 'superwin',
	epicWinBoard: 'mega',
	mythicWinBoard: 'epic',
	legendaryWinBoard: 'max',
};

