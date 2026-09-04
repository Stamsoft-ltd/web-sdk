import { createLayout } from 'utils-layout';

export const { stateLayout, stateLayoutDerived } = createLayout({
	backgroundRatio: {
		normal: 1678 / 937,
		portrait: 937 / 1678,
	},
	mainSizesMap: {
		desktop: { width: 1422, height: 800 },
		tablet: { width: 1000, height: 1000 },
		landscape: { width: 1600, height: 900 },
		// Portrait main width hugs the board (655px) so the reels fill ~97% of the phone width
		// (little horizontal margin) and scale up as tall as possible with it; the extra vertical
		// room is letterboxed top/bottom for the logo header and the bottom HUD.
		portrait: { width: 675, height: 1422 },
	},
});
