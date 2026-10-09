import { createLayout } from 'utils-layout';

import { BOARD_SIZES } from './constants';

/** Portrait "short phone" = the screen is wider than the 675×1422 main's aspect by a margin. */
export const PORTRAIT_SHORT_ASPECT = 0.52;

/**
 * Portrait fit, in screen px: the board FRAME (1.043 × 1.0473 of the board, see boardLogo) must sit
 * below the header (the Press Play mark, then the logo straddling the frame's top rail) with the
 * phone chef's hat on screen, and above the bottom HUD, whose height is a pure function of the
 * width (HudHtml .pt-hud: --u = min(97vw, max(412px, min(70vw, 600px))); 18 pad + 0.14u stats + 0.055u gap + 6 + 0.138u bar,
 * with the spin disc 0.036u above the bar). The board is as wide as the phone when that fits and
 * shrinks only when it doesn't (short phones — Stake rejection R-14: the bottom row sat under the
 * controls); the slack left over on tall phones goes mostly ABOVE the board so it sits on the HUD
 * instead of leaving an empty strip of counter below it.
 * Returns the px-per-main-unit scale and the frame's top edge (px).
 */
const FRAME_W = BOARD_SIZES.width * 1.043;
const FRAME_H = BOARD_SIZES.height * 1.0473;
const LOGO_RISE = 0.0868; // logo top above the frame top, × frame width (boardLogo portrait box)
const CHEF_RISE = 0.2741; // phone chef's hat above the frame top, × frame height (MobileChef BODY)
const PP_ASPECT = 78 / 25; // press-play.svg
const GAP = 6;
const SLACK_ABOVE = 0.65;
export const portraitFit = (vw: number, vh: number) => {
	const short = vw / Math.max(1, vh) > PORTRAIT_SHORT_ASPECT;
	const u = Math.min(vw * 0.97, Math.max(412, Math.min(vw * 0.7, 600)));
	const hudTop = vh - (18 + 0.14 * u + 0.055 * u + 6 + 0.138 * u + 0.036 * u);
	const ppW = short ? Math.min(vw * 0.22, 110) : Math.min(vw * 0.32, 150);
	const ppBottom = vh * (short ? 0.008 : 0.02) + ppW / PP_ASPECT;
	const bottom = hudTop - GAP;
	const s = Math.min(
		vw / 675,
		(bottom - ppBottom - GAP) / (FRAME_H + LOGO_RISE * FRAME_W),
		(bottom - 2) / (FRAME_H * (1 + CHEF_RISE)),
	);
	const minTop = Math.max(ppBottom + GAP + LOGO_RISE * FRAME_W * s, 2 + CHEF_RISE * FRAME_H * s);
	const slack = Math.max(0, bottom - FRAME_H * s - minTop);
	return { scale: s, frameTop: minTop + slack * SLACK_ABOVE };
};

const viewport = () =>
	typeof window === 'undefined' ? { w: 675, h: 1422 } : { w: window.innerWidth, h: window.innerHeight };

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
		// Portrait: the main is the whole screen at portraitFit's scale (so a main unit is exactly the
		// fitted px), and boardLayout places the board at the fitted frame top. Width-limited phones
		// keep the old 675-wide main; short ones get a wider main (the board shrinks inside it).
		get portrait() {
			const { w, h } = viewport();
			const { scale } = portraitFit(w, h);
			return { width: w / scale, height: h / scale };
		},
	},
});
