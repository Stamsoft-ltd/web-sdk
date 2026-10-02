import type { getContext } from './context';
import { LOGO_ASPECT } from './logoSplash';

type Context = ReturnType<typeof getContext>;

// The logo box (wordmark + its code-drawn splats, game/logoSplash).
export const BOARD_LOGO_ASPECT = LOGO_ASPECT;

/**
 * Board logo placement in MAIN-container units (desktop/landscape; portrait draws an HTML header).
 * Sized as a fraction of the board width so it never overflows a narrow board. Desktop's board sits
 * right under the screen top (≈33 main units free), so the logo is a bit smaller there and its top
 * is clamped just inside the main area; landscape has room above. Its bottom (the wordmark's lower
 * edge) dips just over the board's top edge.
 */
export const boardLogoLayout = (context: Context) => {
	const board = context.stateGameDerived.boardLayout();
	const width = board.width * (context.stateLayoutDerived.layoutType() === 'desktop' ? 0.36 : 0.46);
	const bottom = Math.max(
		board.y - board.height * 0.5 + board.height * 0.075 - board.width * 0.03,
		4 + width / BOARD_LOGO_ASPECT,
	);
	return { x: board.x, bottom, width, height: width / BOARD_LOGO_ASPECT };
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
