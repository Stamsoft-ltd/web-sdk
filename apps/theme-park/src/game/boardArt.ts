/**
 * How the pad art sits over the reel grid.
 *
 * board-lines.webp is 1462x972 and paints its own 5x5 grid; those lines put the playable rect at
 * 15.5..1435.5 x 41.5..941.5, i.e. a 1420x900 grid. Sizing the art off THAT rect rather than off
 * the whole image is what lands the painted lines exactly on the cell boundaries <Board> spins
 * symbols through — the two agree because both are fifths of the same rect.
 *
 * Shared, not local to <BoardFrame>: <CoasterWildBackground> repaints a crop of the same art behind
 * each persistent wild, and it has to use the same numbers. It used to carry its own hardcoded 1.08
 * for both axes — right for the old art, and 4.9% too wide for this one, which showed up as a
 * mis-registered dark box around every wild.
 */
export const ART = { width: 1462, height: 972 };
export const ART_GRID = { left: 15.5, top: 41.5, right: 1435.5, bottom: 941.5 };

export const FRAME_OVER_GRID_X = ART.width / (ART_GRID.right - ART_GRID.left);
export const FRAME_OVER_GRID_Y = ART.height / (ART_GRID.bottom - ART_GRID.top);

/**
 * The grid is not quite centred in the image, so the art is nudged by the difference. Without it
 * the painted lines sit a couple of pixels off the symbols.
 */
export const GRID_OFFSET_X = 0.5 - (ART_GRID.left + ART_GRID.right) / 2 / ART.width;
export const GRID_OFFSET_Y = 0.5 - (ART_GRID.top + ART_GRID.bottom) / 2 / ART.height;
