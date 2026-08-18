import { stateBet } from 'state-shared';
import { createPlayBookUtils } from 'utils-book';

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

export const getReelCenterX = (reelIndex: number): number => getBoardCellCenterX(reelIndex);

export const getSymbolInfo = ({ rawSymbol, state }: { rawSymbol: RawSymbol; state: SymbolState }) =>
	SYMBOL_INFO_MAP[rawSymbol.name][state];

export const getSymbolX = (reelIndex: number): number => getBoardCellCenterX(reelIndex);

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
export const popupPanelLimits = (canvas: { width: number; height: number }, mainScale: number) => {
	const ratio = canvas.width / canvas.height;
	const heightShare = Math.min(0.63, Math.max(0.5, 0.44 * ratio));
	return {
		maxWidth: (canvas.width / mainScale) * 0.66,
		maxHeight: (canvas.height / mainScale) * heightShare,
	};
};
