// The diner background is ONE wide panorama (2172×724): the splash looks at its left end (door,
// wall lamp, awning) and the base game at its right end (counter + sauce shelf). On leaving the
// splash the "camera" pans right from one view to the other, so the splash (HTML) and the game's
// background (pixi) MUST frame it identically — both use `panoramaRect` below.
//
// Views are measured from the design's Figma crops (splash-screen.svg / base-game.svg place the
// image at ×1.0258, x −127 / −1029): a ~1169×652 window (the old desktop bg's 1.79 aspect),
// cover-scaled to the screen.
export const PANORAMA = { w: 2172, h: 724 };
export const PANORAMA_VIEW = { w: 1169, h: 652 };
export const PANORAMA_SPLASH_X = 124; // left edge of the splash view (panorama px)
export const PANORAMA_BASE_X = PANORAMA.w - PANORAMA_VIEW.w; // 1003 — the base view is flush right

/** Where to draw the whole panorama so the view starting at `viewX` covers a `vw`×`vh` screen. */
export const panoramaRect = (vw: number, vh: number, viewX: number) => {
	const k = Math.max(vw / PANORAMA_VIEW.w, vh / PANORAMA_VIEW.h);
	return {
		k,
		width: PANORAMA.w * k,
		height: PANORAMA.h * k,
		x: vw / 2 - (viewX + PANORAMA_VIEW.w / 2) * k,
		y: vh / 2 - (PANORAMA_VIEW.h / 2) * k,
	};
};
