/** Shared logical-stage geometry for HTML controls and Pixi stat cards. */
export const PORTRAIT_LAYOUT = {
	width: 360,
	height: 628,
	boardTop: 166,
	boardHeight: 247,
	bonusTop: 106,
	cardHeight: 48,
	boardCardGap: 8,
	hudTop: 487,
	hudHeight: 75,
	metricsTop: 580,
	metricsHeight: 45,
	controlGap: 18,
} as const;
export type PanelBox = { x: number; y: number; width: number; height: number };
const box = (x: number, y: number, width: number, height: number): PanelBox => ({
	x,
	y,
	width,
	height,
});
/** No screen-pixel heuristics: the same stage scale drives DOM and canvas layout. */
export function statPanelLayout(width: number, boardBottom: number, bonus: boolean) {
	const portrait = width === 360,
		compact = width === 800;
	if (portrait) {
		const y = boardBottom + PORTRAIT_LAYOUT.boardCardGap;
		return {
			portrait,
			compact,
			tumbles: box(8, y, 165, PORTRAIT_LAYOUT.cardHeight),
			multiplier: box(187, y, 165, PORTRAIT_LAYOUT.cardHeight),
			freeSpins: box(8, PORTRAIT_LAYOUT.bonusTop, 165, PORTRAIT_LAYOUT.cardHeight),
			totalWin: box(187, PORTRAIT_LAYOUT.bonusTop, 165, PORTRAIT_LAYOUT.cardHeight),
		};
	}
	if (compact) {
		const height = bonus ? 40 : 64;
		return {
			portrait,
			compact,
			tumbles: box(10, bonus ? 84 : 90, 130, height),
			multiplier: box(10, bonus ? 130 : 163, 130, height),
			freeSpins: box(10, 176, 130, 40),
			totalWin: box(10, 222, 130, 40),
		};
	}
	return {
		portrait,
		compact,
		tumbles: box(13, 130, 196, 125),
		multiplier: box(14, 266, 196, 125),
		freeSpins: box(1000, 170, 175, 115),
		totalWin: box(1000, 292, 175, 115),
	};
}
