import type { Board } from './contract';
export const SCATTER_CELEBRATION_MS = { normal: 900, fast: 480, turbo: 260, reduced: 140 } as const;
/** Called only for an authoritative freeSpinTrigger as soon as its triggering Keys land; loops until bonus acknowledgement. */
export function bonusScatterKeys(board: Board) {
	return board.flatMap((column, reel) =>
		column.flatMap((cell, row) => (cell?.name === 'KEY' ? [`${reel}:${row}`] : [])),
	);
}
export function scatterCelebrationFrame(age: number, duration: number, reduced = false) {
	const t = Math.max(0, (Math.max(0, age) % Math.max(1, duration)) / Math.max(1, duration));
	return {
		scale: reduced ? 1 : 1 + Math.sin(t * Math.PI) * 0.12,
		rotation: reduced ? 0 : Math.sin(t * Math.PI * 6) * 0.065 * (1 - t),
		glow: reduced ? 0.65 : 0.55 + Math.sin(t * Math.PI * 4) * 0.2,
		progress: t,
	};
}
