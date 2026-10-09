import type { getContext } from './context';
import { BOARD_DIMENSIONS } from './constants';
import { potState } from './potState.svelte';

type Context = ReturnType<typeof getContext>;

// The board at rest comes alive one symbol at a time: every 2–3 s a random cell plays its own win
// motion once, softly (AnimatedSymbol's idle loop for one PERIOD_IDLE cycle — the burger's bun
// hops, a bottle's cap twists, the rings tumble), then settles. Only while nothing else is
// happening: every reel stopped, no win on show, no soup shots flying. The specials that are
// already alive at rest (wild, scatter, soup — config.idle) and locked cells (LockedCells animates
// those) are never picked, nor the same cell twice in a row.
//
// `key` is `reel:symbolIndex` (symbolIndex 1-based, as ReelSymbol / lockedPositions).

/** One spotlight's length: AnimatedSymbol's PERIOD_IDLE, so its loop runs exactly one cycle. */
export const SPOTLIGHT_MS = 2600;
const GAP_MIN = 2200;
const GAP_MAX = 3200;
const ALWAYS_ALIVE = ['W', 'S', 'M'];

export const idleSpotlight = $state({ key: '' });

export const startIdleSpotlight = (context: Context) => {
	let timer = 0;
	let last = '';
	const atRest = () =>
		context.stateGame.board.every((reel) => reel.reelState.motion === 'stopped') &&
		context.stateGame.paylineWins.length === 0 &&
		context.stateGame.winDim === 0 &&
		!potState.volley;
	const pick = () => {
		const locked = new Set(context.stateGame.lockedPositions.map((p) => `${p.reel}:${p.row}`));
		const cells: string[] = [];
		context.stateGame.board.forEach((reel, r) => {
			for (let row = 1; row <= BOARD_DIMENSIONS.y; row += 1) {
				const name = reel.reelState.symbols[row]?.rawSymbol?.name;
				const key = `${r}:${row}`;
				if (name && !ALWAYS_ALIVE.includes(name) && !locked.has(key) && key !== last) cells.push(key);
			}
		});
		return cells.length ? cells[Math.floor(Math.random() * cells.length)] : '';
	};
	const next = (delay: number) => {
		timer = window.setTimeout(tick, delay);
	};
	const tick = () => {
		if (!atRest()) {
			idleSpotlight.key = '';
			next(800);
			return;
		}
		const key = pick();
		idleSpotlight.key = key;
		last = key;
		timer = window.setTimeout(() => {
			idleSpotlight.key = '';
			next(GAP_MIN + Math.random() * (GAP_MAX - GAP_MIN) - SPOTLIGHT_MS * 0.5);
		}, SPOTLIGHT_MS);
	};
	if (!matchMedia('(prefers-reduced-motion: reduce)').matches) next(GAP_MIN);
	return () => {
		clearTimeout(timer);
		idleSpotlight.key = '';
	};
};
