import { createLayout } from 'utils-layout';

export const { stateLayout, stateLayoutDerived } = createLayout({
	backgroundRatio: {
		normal: 2039 / 1000,
		portrait: 1242 / 2208,
	},
	mainSizesMap: {
		desktop: { width: 1422, height: 800 },
		// Almost-square windows (layoutType 'tablet') render the DESKTOP scene: every component
		// branches isPortrait/isLandscape and falls through to desktop art for 'tablet', but the
		// old 1000×1000 main size scaled that 1422-wide scene up ~1.24× and the board overflowed
		// both edges of the window. Same geometry as desktop = scale-to-fit, letterboxed.
		tablet: { width: 1422, height: 800 },
		landscape: { width: 1600, height: 900 },
		portrait: { width: 800, height: 1422 },
	},
});
