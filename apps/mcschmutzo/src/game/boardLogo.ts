import type { getContext } from './context';
import { LOGO_ASPECT, LOGO_WORD } from './logoSplash';
import { BOARD_DIMENSIONS } from './constants';

type Context = ReturnType<typeof getContext>;

// The logo box (wordmark + its code-drawn splats, game/logoSplash).
export const BOARD_LOGO_ASPECT = LOGO_ASPECT;
// How far (fraction of a row) the logo may reach into the top row: its empty padding above the art.
const LOGO_ROW_DIP = 0.06;
const LOGO_TOP_MARGIN = 4; // main units kept clear above the logo

/**
 * Board logo placement in MAIN-container units. Portrait draws it as HTML (HudHtml .pt-logo) at
 * this same spot; desktop/landscape draw it in pixi (FeatureOverlay).
 * Sized as a fraction of the board width so it never overflows a narrow board. It sits on the
 * frame's top rail: its bottom (the wordmark's lower edge) may dip only into the top row's empty
 * padding, never over a symbol. Desktop's board sits right under the screen top, so when the room
 * above that line is short the logo SHRINKS to fit rather than sliding down onto the reels (it used to
 * be pushed down by a top clamp and covered the top cell of reel 3).
 */
export const boardLogoLayout = (context: Context) => {
	const board = context.stateGameDerived.boardLayout();
	if (context.stateLayoutDerived.layoutType() === 'portrait') {
		// Phone (Figma 8870:32978): the logo straddles the frame's top rail, left of the chef. Its art
		// box there is 202 × 54 design px centred at (192, −3) of the 380 × 347 frame → the logo BOX
		// (the word is LOGO_WORD.w of it) in frame fractions.
		const frameW = board.width * 1.043;
		const frameH = board.height * 1.0473;
		const frameTop = board.y - board.height * 0.5 - board.height * 0.0224;
		const width = (0.532 / LOGO_WORD.w) * frameW;
		const height = width / BOARD_LOGO_ASPECT;
		const cy = frameTop - 0.0085 * frameH;
		return { x: board.x + 0.0054 * frameW, bottom: cy + height / 2, width, height };
	}
	const row = board.height / BOARD_DIMENSIONS.y;
	const bottom = board.y - board.height * 0.5 + row * LOGO_ROW_DIP;
	const preferredWidth =
		board.width * (context.stateLayoutDerived.layoutType() === 'desktop' ? 0.36 : 0.46);
	const height = Math.min(preferredWidth / BOARD_LOGO_ASPECT, bottom - LOGO_TOP_MARGIN);
	return { x: board.x, bottom, width: height * BOARD_LOGO_ASPECT, height };
};

/** The same logo in canvas px (= the HTML overlay's px: the canvas fills the window, unscaled). */
export const boardLogoScreenRect = (context: Context) => {
	const l = boardLogoLayout(context);
	const m = context.stateLayoutDerived.mainLayout();
	// MainContainer: position (m.x, m.y), pivot at the main area's centre (anchor 0.5), scale m.scale.
	const sx = (v: number) => m.x + (v - m.width * 0.5) * m.scale;
	const sy = (v: number) => m.y + (v - m.height * 0.5) * m.scale;
	const width = l.width * m.scale;
	const height = l.height * m.scale;
	return { cx: sx(l.x), cy: sy(l.bottom) - height * 0.5, width, height };
};

/**
 * The board FRAME's box in canvas px (= HTML px). The frame art overhangs the reels by ~2.2% on each
 * side (BoardFrame.svelte). The landscape HUD uses it to size its corner readouts to the real gap
 * beside / below the board rather than assuming the board is as wide as the viewport is tall.
 */
export const boardFrameScreenRect = (context: Context) => {
	const board = context.stateGameDerived.boardLayout();
	const m = context.stateLayoutDerived.mainLayout();
	const sx = (v: number) => m.x + (v - m.width * 0.5) * m.scale;
	const sy = (v: number) => m.y + (v - m.height * 0.5) * m.scale;
	const halfW = board.width * 0.5 * 1.043;
	const halfH = board.height * 0.5 * 1.0473;
	return {
		left: sx(board.x - halfW),
		right: sx(board.x + halfW),
		top: sy(board.y - halfH),
		bottom: sy(board.y + halfH),
	};
};
