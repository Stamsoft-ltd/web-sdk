import { Tween } from 'svelte/motion';
import { cubicOut } from 'svelte/easing';

import { stateGame } from './stateGame.svelte';

// Win focus: while win lines are on show every cell that is NOT on one dims, so the eye goes to the
// winners. One shared 0..1 level (driven by Board.svelte off stateGame.paylineWins) that the reel
// symbols and the locked cells both read.
// 45% dim. It was a light 13% (from a review note's "~10–15%"), but at that level players don't see
// it — the user asked for the usual clear dim (2026-10-06). On the dark tiles, alpha reads as darker.
export const LOSER_ALPHA = 0.55;
export const winFocus = new Tween(0, { duration: 220, easing: cubicOut });

/** reel / row are 0-based grid positions (paylineWins' convention). */
export const isWinningCell = (reel: number, row: number) =>
	stateGame.paylineWins.some((win) => win.path.some((p) => p.reel === reel && p.row === row));

// Tease spotlight: while a reel is teasing the bonus (Anticipations), the symbols on reels that have
// already landed dim — except the scatters — so the scatters and the spinning reel own the board.
export const TEASE_DIM_ALPHA = 0.5;
export const teaseFocus = new Tween(0, { duration: 260, easing: cubicOut });
export const teaseAlpha = (landed: boolean, scatter: boolean) =>
	landed && !scatter ? 1 - (1 - TEASE_DIM_ALPHA) * teaseFocus.current : 1;

/** Alpha for a cell under the current focus: winners stay lit, the rest fade toward LOSER_ALPHA. */
export const focusAlpha = (winning: boolean) =>
	winning ? 1 : 1 - (1 - LOSER_ALPHA) * winFocus.current;
