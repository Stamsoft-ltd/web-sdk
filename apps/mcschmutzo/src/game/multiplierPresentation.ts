import type { BookEventOfType } from './typesBookEvent';

/** Math-owned ladder: games/0_0_mcschmutzo/math_data.py, including the 100x rung. */
export const MULTIPLIER_LADDER = [
	1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 100, 120, 150, 200, 250, 300,
	350, 400, 500, 600, 800, 1000,
] as const;
export function climbMultiplier(mult: number, steps: number) {
	const at = Math.max(
		0,
		MULTIPLIER_LADDER.findLastIndex((m) => m <= mult),
	);
	return MULTIPLIER_LADDER[
		Math.min(MULTIPLIER_LADDER.length - 1, at + Math.max(0, Math.floor(steps)))
	];
}
export type PaylinePresentation = {
	lineIndex: number;
	symbol?: string;
	path: Array<{ reel: number; row: number }>;
	/** All amounts are authoritative book units (100 = 1x base bet). */
	baseAmount: number;
	multiplier: number;
	amount: number;
};
export function presentLine(win: BookEventOfType<'winInfo'>['wins'][number]): PaylinePresentation {
	return {
		lineIndex: win.meta.lineIndex,
		symbol: win.symbol,
		path: [...win.positions]
			.sort((a, b) => a.reel - b.reel)
			.map(({ reel, row }) => ({ reel, row: row - 1 })),
		baseAmount: win.meta.winWithoutMult,
		multiplier: win.meta.multiplier,
		amount: win.win,
	};
}
/** Never recompute the settled result: the final value is supplied by the book. */
export function formatLineCalculation(
	win: PaylinePresentation,
	format: (amount: number) => string,
) {
	// A capped/adjusted book amount must not be printed as a false equality.
	const relation = Math.abs(win.baseAmount * win.multiplier - win.amount) < 1e-6 ? '=' : '→';
	return `${format(win.baseAmount)} × ${win.multiplier} ${relation} ${format(win.amount)}`;
}
export function showBaseMultiplier(bonusMode: 'freegame' | null, locks: number, mult: number) {
	return bonusMode !== 'freegame' && (locks > 0 || mult > 1);
}
export function soupSteps(total: number, values: Array<number | undefined>) {
	if (
		values.length &&
		values.every((v) => Number.isInteger(v) && Number(v) > 0) &&
		values.reduce<number>((a, v) => a + Number(v), 0) === total
	)
		return values.map(Number);
	const each = Math.floor(total / Math.max(1, values.length)),
		rest = total - each * values.length;
	return values.map((_, i) => each + (i < rest ? 1 : 0));
}
/** Source label uses the existing shot clock; fades away as the +N blob leaves the stew. */
export function soupSourceCallout(elapsedMs: number, chargeMs: number) {
	const enter = Math.max(0, Math.min(1, (elapsedMs + 200) / 160));
	const leave = Math.max(0, Math.min(1, (elapsedMs - chargeMs) / 180));
	return { alpha: enter * (1 - leave), rise: enter * 0.08, scale: 0.9 + enter * 0.1 };
}
export function baseMultiplierLanding(card: { left: number; top: number; w: number; h: number }) {
	return { x: card.left + card.w / 2, y: Math.max(16, card.top - card.h * 0.9) };
}
/** Shared wall anchor: keep the desktop multiplier above, rather than replacing, the order notes. */
export function orderNotesPlacement(
	frame: { left: number; right: number },
	canvas: { width: number; height: number },
) {
	const gutter = frame.left + ((frame.right - frame.left) * (1 - 1 / 1.043)) / 2;
	const artAsp = 1678 / 937;
	const coverH = Math.max(canvas.width / artAsp, canvas.height);
	const top = (canvas.height - coverH) / 2 + coverH * 0.275;
	const room = coverH * (0.6 - 0.275);
	return { left: gutter / 2, top, w: Math.min(gutter * 0.6, room / 1.45, 230), canvasH: canvas.height };
}
export function baseMultiplierPlacement(
	layout: string,
	frame: { left: number; right: number; top: number; bottom: number },
	canvas: { width: number; height: number },
) {
	if (layout === 'portrait')
		return {
			left: Math.max(4, frame.left),
			top: frame.bottom + 5,
			w: Math.min(180, (frame.right - frame.left) * 0.48),
			h: Math.max(28, Math.min(44, canvas.height * 0.042)),
		};
	const w = Math.max(80, Math.min(layout === 'landscape' ? 160 : 210, frame.left - 16));
	const h = layout === 'landscape' ? 48 : Math.min(86, w * 0.45);
	const note = orderNotesPlacement(frame, canvas);
	if ((layout === 'desktop' || layout === 'tablet') && note.w > 70)
		return {
			left: Math.max(4, Math.min(frame.left - w - 8, note.left - w / 2)),
			top: Math.max(6, note.top - h - Math.max(18, note.w * 0.14)),
			w,
			h,
		};
	return {
		left: Math.max(4, frame.left - w - 8),
		top: Math.max(6, frame.top + (layout === 'landscape' ? 12 : (frame.bottom - frame.top) * 0.15)),
		w,
		h,
	};
}
