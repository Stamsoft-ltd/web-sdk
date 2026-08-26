import { stateBet } from 'state-shared';
import { checkIsMultipleRevealEvents, createPlayBookUtils } from 'utils-book';

import { bookEventHandlerMap } from './bookEventHandlerMap';
import { eventEmitter } from './eventEmitter';
import type { Bet, BookEventOfType } from './typesBookEvent';
import type { SymbolName, SymbolState, RawSymbol } from './types';
import { getBoardCellCenterX, SYMBOL_INFO_MAP } from './constants';

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
	DC: 'tpDuckScatterDesktop',
	S_DUCK: 'tpDuckScatterDesktop',
	S_ROLLER: 'tpRollerScatterDesktop',
	S_COASTER: 'tpCoasterScatterDesktop',
};

// Bonus spins reuse the same themed symbol atlas.
export const bonusSpriteKeyByName: Record<SymbolName, string> = { ...spriteKeyByName };

// Win state sprite keys
export const winSpriteKeyByName: Record<SymbolName, string> = {
	...spriteKeyByName,
	// Every symbol except the duck scatter is deliberately absent: the flat cartoon redraws keep
	// their one piece of art through a win, lit by <SymbolBulbs> where they have bulbs and by the
	// board's win pulse where they do not, so they all fall through to `spriteKeyByName`.
	DC: 'tpDuckScatterDesktop',
};

export type SpecialSymbolVisual =
	| 'wild'
	| 'megaWild'
	| 'duckScatter'
	| 'rollerScatter'
	| 'rollerSign'
	| 'coasterScatter'
	| 'coasterHouse';

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
	// The same sign with the star and the two words left out, for <RollerWilds> to draw them on
	// itself. It follows the layout variants for the same reason the still does — it is the same
	// picture minus three small parts, so it costs the same texture.
	rollerSign: {
		desktop: 'tpRollerSignDesktop',
		portrait: 'tpRollerSignMobile',
		landscape: 'tpRollerSignLandscape',
	},
	coasterScatter: {
		desktop: 'tpCoasterScatterDesktop',
		portrait: 'tpCoasterScatterMobile',
		landscape: 'tpCoasterScatterLandscape',
	},
	/** The same pavilion with no sign on it, for <MegaCoaster> to hang the live one on. */
	coasterHouse: {
		desktop: 'tpCoasterHouseDesktop',
		portrait: 'tpCoasterHouseMobile',
		landscape: 'tpCoasterHouseLandscape',
	},
} as const;

export const getSpecialSymbolKey = (visual: SpecialSymbolVisual, layoutType: string) => {
	const variant =
		layoutType === 'portrait' ? 'portrait' : layoutType === 'landscape' ? 'landscape' : 'desktop';
	return specialSymbolKeys[visual][variant];
};

export const getReelCenterX = (reelIndex: number): number => getBoardCellCenterX(reelIndex);

export const getSymbolInfo = ({ rawSymbol, state }: { rawSymbol: RawSymbol; state: SymbolState }) =>
	SYMBOL_INFO_MAP[rawSymbol.name][state];

export const getSymbolX = (reelIndex: number): number => getBoardCellCenterX(reelIndex);

export const { playBookEvent, playBookEvents } = createPlayBookUtils({ bookEventHandlerMap });

/**
 * Pick/collect rounds can contain one reel reveal, so the generic multiple-reveal check sees them
 * as ordinary wins and prefetches `/wallet/end-round` before their Duck animations. Treat their
 * interactive animation events as bonus playback so settlement runs only after the book finishes.
 */
export const shouldDeferEndRound = (bet: Pick<Bet, 'state'>) =>
	checkIsMultipleRevealEvents({ bookEvents: bet.state }) ||
	bet.state.some(({ type }) => type === 'duckPickStart' || type === 'duckCollectStart');

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

// ── Congratulations panel sizing (FreeSpinIntro / FreeSpinOutro) ─────────────────────────────────
//
// Matched to the design's live render, where the card sits in the band between the logo and the
// HUD bar: 63% of the frame height, with the logo clear above it and the bar clear below. (The
// static Figma frame draws the same card at 78.5% of a 670-tall frame, overlapping both — the
// render is the one that shows how it is meant to sit.) The card is normally sized off the reel
// grid; these caps are what stop that rule on a squarish window, where the grid itself fills the
// frame and grid-relative sizing swallowed the screen. A fixed share cannot serve both shapes, so
// the height share scales with the frame ratio — the render's 63% on a wide frame, easing to half
// the screen on a square one. The width share is the backstop for narrow frames.
//
// Returned in main-layout units, which is what the popups lay out in; the shares themselves are
// applied to the CANVAS, because mainLayout's width/height are fixed per layout type and do not
// follow the window's real shape.
//
// RAISED ABOUT A TWELFTH ON REQUEST (2026-08-26), AND ANOTHER TENTH LATER THE SAME DAY. The
// bonus-won screen was still coming up smaller than it wanted to be — the caps are what it lands
// on, so this is the only place growing it can come from — and the band it sits in has the room:
// the render these were matched to left a good deal of clear board above the marquee and below it.
//
// Both raises are what answer "the blurb should be a bigger font": every size in <CongratsPanel>
// is a fraction of the marquee's WIDTH, so the column cannot give the blurb more without taking it
// off something else — but the whole card growing hands every line of it more pixels at once, the
// blurb included, and moves nothing.
//
// 0.75 is the ceiling HERE because of the HUD bar: <FreeSpinOutro>'s assembly runs to the edges of
// its box, so at this share its foot lands at 0.839 of the canvas and the bar's top edge is at
// 0.843. <FreeSpinIntro> supersedes this cap with a larger one of its own — its marquee art has
// transparent margins inside its box, so the same share leaves it visibly smaller than the outro.
// See CARD_HEIGHT_SHARE there.
export const popupPanelLimits = (canvas: { width: number; height: number }, mainScale: number) => {
	const ratio = canvas.width / canvas.height;
	const heightShare = Math.min(0.75, Math.max(0.6, 0.52 * ratio));
	return {
		maxWidth: (canvas.width / mainScale) * 0.78,
		maxHeight: (canvas.height / mainScale) * heightShare,
	};
};
