import type { Win } from './contract';
/** Display only: never credits or re-evaluates a payout. */
export function tumbleLabelAnchors(wins: Win[]) {
	const grouped = new Map<Win['symbol'], Win>();
	for (const win of wins) {
		if (!win.positions.length || win.rawAmount <= 0) continue;
		const existing = grouped.get(win.symbol);
		if (!existing) grouped.set(win.symbol, { ...win, positions: [...win.positions] });
		else {
			existing.rawAmount += win.rawAmount;
			existing.positions.push(...win.positions);
			existing.size += win.size;
		}
	}
	return [...grouped.values()].map((win) => ({
		...win,
		position: [...win.positions].sort(
			(a, b) => (a.reel - 2.5) ** 2 + (a.row - 2) ** 2 - ((b.reel - 2.5) ** 2 + (b.row - 2) ** 2),
		)[0],
	}));
}
export function liveSpinWin(
	raw: number,
	multiplier: number,
	active: boolean,
	settled: number,
	phase: string,
) {
	return phase === 'settling' || (phase === 'idle' && settled > 0)
		? settled
		: Math.min(2_500_000, raw * (active ? multiplier : 1));
}
