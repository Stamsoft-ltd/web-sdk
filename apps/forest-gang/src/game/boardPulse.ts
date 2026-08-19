import type { SymbolName } from './types';

// The premium animals. Everything else — the five card letters plus WILD and SCATTER — reads
// `letterPulse` on the board, so the pulse predicate is exactly the COMPLEMENT of this set.
// N4: an earlier version excluded WILD and SCATTER from the predicate as well, which left a
// winning wild/scatter frozen at whatever scale the last pulse had reached.
export const HIGH_SYMBOLS_SET = new Set<SymbolName>([
	'FOX',
	'WOLF',
	'BEAR',
	'RABBIT',
	'SQUIRREL',
]);

// A winning symbol keeps its win animation through BOTH the per-line 'win' state AND the
// 'postWinStatic' state used during the total-win / SWEET WIN presentation (all lines shown at
// once). Without postWinStatic here the symbols freeze to static art during that presentation.
export const isWinState = (state?: string) => state === 'win' || state === 'postWinStatic';

// Structurally typed so a test can build a board literal without dragging in the whole game state.
export type PulseBoard = readonly {
	reelState: { symbols: readonly { rawSymbol: { name: SymbolName }; symbolState?: string }[] };
}[];

/**
 * True while at least one pulsing symbol (letter, wild or scatter) is showing a win — the gate for
 * Board's pulse clock. Pure, so the N4 regression is testable without a clock: restoring the
 * wild/scatter exclusions changes this function's answer, not the rAF's behaviour.
 */
export const anyPulsingWin = (board: PulseBoard) =>
	board.some((reel) =>
		reel.reelState.symbols.some(
			(sym) => !HIGH_SYMBOLS_SET.has(sym.rawSymbol.name) && isWinState(sym.symbolState),
		),
	);
