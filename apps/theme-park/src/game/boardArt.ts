/**
 * How the pad art sits over the reel grid.
 *
 * board-lines.webp is 1462x972. Its internal vertical dividers are exactly 284px apart at
 * x=300/584/868/1152, so the true equal-cell grid runs x=16..1436. The border therefore owns
 * 16px outside the first/last cells instead of consuming their width. Vertical bounds remain
 * y=41.5..941.5.
 *
 * BoardFrame alone needs these values. Wild covers now use a local opaque cell fill; cloning and
 * masking this full board texture for every persistent Wild was a major GPU cost.
 */
export const ART = { width: 1462, height: 972 };
export const ART_GRID = { left: 16, top: 41.5, right: 1436, bottom: 941.5 };
// Exact non-transparent bounds of the separated authored light rail, including bulb glow.
export const ART_RAIL = { left: 21, top: 16, right: 1425, bottom: 958 };

export const FRAME_OVER_GRID_X = ART.width / (ART_GRID.right - ART_GRID.left);
export const FRAME_OVER_GRID_Y = ART.height / (ART_GRID.bottom - ART_GRID.top);

/**
 * The grid is not quite centred in the image, so the art is nudged by the difference. Without it
 * the painted lines sit a couple of pixels off the symbols.
 */
export const GRID_OFFSET_X = 0.5 - (ART_GRID.left + ART_GRID.right) / 2 / ART.width;
export const GRID_OFFSET_Y = 0.5 - (ART_GRID.top + ART_GRID.bottom) / 2 / ART.height;
