/** Presentation-only reset under closed bonus-exit doors. Never changes round payouts. */
export function panelCounters(
	game: { progress: number; multiplier: number; multiplierActive: boolean },
	reset: boolean,
	gateMeterReset = false,
) {
	return reset
		? { progress: 0, multiplier: 1, multiplierActive: false }
		: {
				progress: gateMeterReset ? 0 : game.progress,
				multiplier: game.multiplier,
				multiplierActive: game.multiplierActive,
			};
}

/** Includes entry/Key awards; cumulative book total and summary use the same scope. */
export function panelBonusWin(
	game: { total: number; freeSpin: number; lastType: string },
	spinTotalBefore: number,
	currentSpinWin: number,
) {
	if (game.lastType === 'freeSpinEnd' || !game.freeSpin) return game.total;
	return Math.max(game.total, spinTotalBefore + currentSpinWin);
}

/** Restore presentation consumption without changing authoritative book progress. */
export function consumedGateMeter(events: { type: string }[], cursor: number) {
	for (let i = cursor - 1; i >= 0; i--) {
		if (events[i].type === 'gateOpen') return true;
		if (['gateProgress', 'spinStart', 'freeSpinTrigger'].includes(events[i].type)) return false;
	}
	return false;
}
