import { createLayout } from 'utils-layout';

export const { stateLayout, stateLayoutDerived } = createLayout({
	backgroundRatio: {
		normal: 1678 / 937,
		portrait: 937 / 1678,
	},
	mainSizesMap: {
		// Smaller main => the 655×600 board fills more of the canvas (design ask: bigger board).
		desktop: { width: 1370, height: 792 },
		tablet: { width: 930, height: 930 },
		// Landscape main is sized so the 655×600 board fills ~80% of the height (design ask: a big
		// centred board flanked by the balance/bet gutter (left) and the control rail (right)). The
		// whole MainContainer scales to the canvas, so the board — and every board-space overlay —
		// grows/shrinks together across all landscape sizes. (Was 1600×900 → board only ~67% tall.)
		landscape: { width: 1300, height: 716 },
		// Portrait main width hugs the board (655px) so the reels fill ~97% of the phone width
		// (little horizontal margin) and scale up as tall as possible with it; the extra vertical
		// room is letterboxed top/bottom for the logo header and the bottom HUD.
		portrait: { width: 675, height: 1422 },
	},
});
