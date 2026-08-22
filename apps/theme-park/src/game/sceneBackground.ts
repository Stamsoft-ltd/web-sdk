/**
 * Geometry of the painted plaza backdrop, shared by <Background> (which draws it) and <Clouds>
 * (which has to place clouds in its sky rather than in the canvas's top strip — on a tall canvas
 * the art is cover-scaled and its sky sits well above the canvas top).
 */

import { PARK_ASPECT } from './parkScene';

/** Native size of the plaza art — see scripts/background/build_background.py. */
export const BACKGROUND_ASPECT = PARK_ASPECT;

/**
 * Slight overscan so the drift in <Background> never exposes an edge. Applied to the drawn size,
 * so anything positioning against the art has to use the same factor.
 */
export const BACKGROUND_OVERSCAN = 1.025;

/**
 * Draw order for the backdrop stack. Every MainContainer in <Game> sorts at 0 and pixi's sort is
 * stable, so anything left at 0 is ordered by when it happened to mount — and the backdrop sprite,
 * gated on its texture, mounts last. These keep the sky below the game whatever the load order.
 */
export const BACKGROUND_Z = -7;
/**
 * The house that stands in the plaza — a separate piece of art laid over the smaller one painted
 * into the backdrop, so its bulbs can be lit in code. Directly above the backdrop and below the
 * bonus backdrops, which replace the whole plaza and have no house in them.
 */
export const HOUSE_Z = -6;
/** The two bonus backdrops, which crossfade over the plaza: the coaster POV, then the duck pond. */
export const COASTER_Z = -5;
export const POND_Z = -4;
/** The lamp glows belong to the painted plaza, so nothing in the sky passes behind them. */
export const LAMPS_Z = -3;
export const CLOUDS_Z = -2;
/** The escaped balloon is nearer than the sky, so it passes in front of the clouds. */
export const BALLOON_Z = -1;

export type CanvasSizes = { width: number; height: number };

/** The drawn rectangle of the backdrop: cover-fit, centred, overscanned. Defaults to the plaza
 * art's aspect; pass another for the alternate backdrops (the duck-pond booth). */
export const backgroundCover = ({ width, height }: CanvasSizes, aspect = BACKGROUND_ASPECT) => {
	const cover =
		width / height > aspect
			? { width, height: width / aspect }
			: { width: height * aspect, height };

	const drawnWidth = cover.width * BACKGROUND_OVERSCAN;
	const drawnHeight = cover.height * BACKGROUND_OVERSCAN;

	return {
		width: drawnWidth,
		height: drawnHeight,
		left: width * 0.5 - drawnWidth * 0.5,
		top: height * 0.5 - drawnHeight * 0.5,
	};
};
