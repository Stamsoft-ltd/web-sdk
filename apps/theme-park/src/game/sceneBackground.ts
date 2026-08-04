/**
 * Geometry of the painted plaza backdrop, shared by <Background> (which draws it) and <Clouds>
 * (which has to place clouds in its sky rather than in the canvas's top strip — on a tall canvas
 * the art is cover-scaled and its sky sits well above the canvas top).
 */

/** Native size of background-blur.webp. */
export const BACKGROUND_ASPECT = 1188 / 664;

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
export const BACKGROUND_Z = -4;
export const CLOUDS_Z = -2;

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
