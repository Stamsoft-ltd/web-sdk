import { createLayout } from 'utils-layout';

/** Portrait "short phone" = the screen is wider than the 675×1422 main's aspect by a margin. */
export const PORTRAIT_SHORT_ASPECT = 0.52;
const portraitMainHeight = () => {
	if (typeof window === 'undefined') return 1422;
	const aspect = window.innerWidth / Math.max(1, window.innerHeight);
	return aspect > PORTRAIT_SHORT_ASPECT ? Math.round(675 / aspect) : 1422;
};

export const { stateLayout, stateLayoutDerived } = createLayout({
	backgroundRatio: {
		normal: 1678 / 937,
		portrait: 937 / 1678,
	},
	mainSizesMap: {
		// Smaller main => the 655×600 board fills more of the canvas (design ask: bigger board).
		desktop: { width: 1370, height: 792 },
		tablet: { width: 930, height: 930 },
		// Landscape main is sized so the 655×600 board fills ~88% of the height (extend-the-board ask:
		// a big centred board flanked by the balance/bet gutter (left) and the control rail (right),
		// using the generous horizontal margins there was room in). The whole MainContainer scales to
		// the canvas, so the board — and every board-space overlay — grows/shrinks together across all
		// landscape sizes. (1600×900 → board only ~67% tall; 1300×716 → ~84%.)
		landscape: { width: 1300, height: 684 },
		// Portrait main width hugs the board (655px) so the reels fill ~97% of the phone width
		// (little horizontal margin) and scale up as tall as possible with it; the extra vertical
		// room is letterboxed top/bottom for the logo header and the bottom HUD.
		// Getter (createLayout reads the map on every layout call): on SHORT phones (320×568, 360×640,
		// 375×667 …) a fixed 1422 made the main height-limited, shrinking the board to ~82% of the
		// width with dead bands above/below it. There the main takes the screen's own aspect, so the
		// board is width-limited again (~97% of the width) and the logo header tightens (HudHtml
		// .pt-top--short). Tall phones keep 1422 unchanged.
		get portrait() {
			return { width: 675, height: portraitMainHeight() };
		},
	},
});
