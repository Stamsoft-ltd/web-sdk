import { beforeEach, describe, expect, it } from 'vitest';
import { stateUi } from 'state-shared';

import { ART, ART_GRID } from '../src/game/boardArt';
import { BOARD_SIZES } from '../src/game/constants';
import { stateGameDerived } from '../src/game/stateGame.svelte';
import { stateLayoutDerived } from '../src/game/stateLayout';
import { stateReplayViewport } from '../src/game/replayViewport.svelte';

/**
 * The Popout S replay regression, as a measurement instead of a spelling check.
 *
 * Four rounds of "fixes" shipped against a test that asserted the CSS *contained* certain strings,
 * and all four passed while the panel still covered the bottom reel row. The panel never overflowed
 * the window — it overlapped the board — so nothing that looked only at the panel could see it. What
 * has to hold is a relationship between two things: where the board's bottom rail lands, and where
 * the replay panel's top edge lands. That is what this asserts.
 */

const resize = (width: number, height: number) => {
	Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
	Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
	window.dispatchEvent(new Event('resize'));
};

// Desktop's frame model: how far the drawn rail hangs below the grid, as a fraction of the grid's
// height. The same expression boardLayout() uses to hold that board off the spin button.
const FRAME_UNDER_GRID = (ART.height - ART_GRID.bottom) / (ART_GRID.bottom - ART_GRID.top);

/**
 * Bottom edge of the drawn board frame, in canvas px. MainContainer draws main-space centred on the
 * canvas at mainLayout.scale, so this is that mapping applied to the layout's own frame box.
 *
 * Branch-aware on purpose. The landscape and portrait branches return a real `frameCy`/`frameH` and
 * their own frame model (the grid inflated by MOBILE_FRAME_INNER_H). The desktop branch returns
 * `frameCy: 0` and a `frameH` that is the *grid's* height, not the frame's — so reading those fields
 * there reports a board at the top of the screen and every desktop assertion passes for the wrong
 * reason. FreeSpinCounter.svelte carries the same warning about `frameCx`. `y` is the grid centre in
 * every branch, so desktop is measured from that plus its own rail.
 */
const boardFrameBottomPx = () => {
	const layout = stateGameDerived.boardLayout();
	const main = stateLayoutDerived.mainLayout();
	const canvas = stateLayoutDerived.canvasSizes();
	const gridHeight = BOARD_SIZES.height * layout.boardScale;
	const frameBottomMain =
		stateLayoutDerived.layoutType() === 'desktop'
			? layout.y + gridHeight * (0.5 + FRAME_UNDER_GRID)
			: layout.frameCy + layout.frameH * 0.5;
	return canvas.height * 0.5 + (frameBottomMain - main.height * 0.5) * main.scale;
};

// Popout S/L and the phone sizes the same layout branch serves, plus two desktop sizes for the
// control case. Popout is landscape at min(w, h) <= 480, which utils-layout calls mobile landscape.
const VIEWPORTS: [number, number][] = [
	[640, 420],
	[700, 460],
	[856, 480],
	[900, 480],
	[1000, 600],
	[1280, 800],
	[430, 932],
];

// Every height the panel can plausibly report, from the one-row popout composition up to a stacked
// portrait card with a long currency in it. The board has to clear whichever it gets.
const RESERVES = [48, 64, 90, 130, 180, 240];

describe('replay panel never covers the board', () => {
	beforeEach(() => {
		stateUi.config.mode = 'default';
		stateReplayViewport.bottomReservePx = 0;
	});

	it.each(VIEWPORTS)('holds the board clear at %ix%i', (width, height) => {
		resize(width, height);
		stateUi.config.mode = 'replay';

		for (const reserve of RESERVES) {
			stateReplayViewport.bottomReservePx = reserve;
			const panelTop = height - reserve;
			const boardBottom = boardFrameBottomPx();

			expect(
				boardBottom,
				`${width}x${height} reserve=${reserve}: board bottom ${boardBottom.toFixed(
					1,
				)} is below panel top ${panelTop}`,
			).toBeLessThanOrEqual(panelTop);
			// A board that cleared by collapsing to nothing would pass the line above.
			expect(stateGameDerived.boardLayout().boardScale).toBeGreaterThan(0);
		}
	});

	it.each(VIEWPORTS)('leaves play mode untouched at %ix%i', (width, height) => {
		resize(width, height);
		stateReplayViewport.bottomReservePx = 0;
		const play = boardFrameBottomPx();
		const playScale = stateGameDerived.boardLayout().boardScale;

		// A stale reserve left over from a replay session must not shrink the board in play mode:
		// replayBottomReservePx() is gated on the UI mode, not just on the published number.
		stateReplayViewport.bottomReservePx = 200;
		expect(boardFrameBottomPx()).toBeCloseTo(play, 6);
		expect(stateGameDerived.boardLayout().boardScale).toBeCloseTo(playScale, 6);
	});
});
