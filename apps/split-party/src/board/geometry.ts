// Board geometry (style.css .board/.grid): 88.04×70.86 pads at a 2.147 gap inside the
// board's padding box. The Pixi canvas reaches MARGIN past that box so win glows and bounces
// can spill over the rim; the board's own overflow clips it while blobs are in the air.
// Kept apart from BoardView so the Svelte wrapper can size the canvas without loading pixi.
export const CELL_W = 88.04;
export const CELL_H = 70.86;
export const GAP = 2.147;
export const PAD_L = 6.56;
export const PAD_T = 6.44;
const INNER_W = 656 - 2 * 6.442;
const INNER_H = 535.75 - 2 * 6.442;
export const MARGIN = 30;
export const VIEW_W = INNER_W + 2 * MARGIN;
export const VIEW_H = INNER_H + 2 * MARGIN;
// Relative to the grid's top-left (the canvas sits in .grid-stack).
export const VIEW_LEFT = -(PAD_L + MARGIN);
export const VIEW_TOP = -(PAD_T + MARGIN);
// A pad's top-left in canvas space.
export const cellX = (col: number) => MARGIN + PAD_L + col * (CELL_W + GAP);
export const cellY = (row: number) => MARGIN + PAD_T + row * (CELL_H + GAP);
// The grid's own box (cluster pops are placed in fractions of it).
export const GRID_X = MARGIN + PAD_L;
export const GRID_Y = MARGIN + PAD_T;
export const GRID_W = 7 * CELL_W + 6 * GAP;
export const GRID_H = 7 * CELL_H + 6 * GAP;
export const BORDER = 1.074;
