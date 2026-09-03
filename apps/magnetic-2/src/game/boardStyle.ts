// The MOTHERSHIP board: its plate and its 49 cell pads (Figma 9032:23056 / "Symbols pad").
//
// This board is DRAWN, not textured. The design specifies both pieces as plain rounded rectangles
// with a fill, a one- or seven-unit border and a corner radius — there is no artwork to export, and
// drawing them keeps the board crisp at every board scale instead of resampling board_pad.webp and
// cell_box.webp (which is what this replaced).
//
// Everything below is expressed as a fraction of the CELL PITCH so the board survives any change to
// SYMBOL_W/SYMBOL_H. The design's pitch is 84 x 68 with 82 x 66 pads, i.e. a 2-unit gap; its plate
// is 610 x 498 around a 588 x 476 grid, i.e. an 11-unit surround.

import { BOARD_DIMENSIONS, SYMBOL_H, SYMBOL_W } from './constants';

const DESIGN = {
	pitchX: 84,
	pitchY: 68,
	padW: 82,
	padH: 66,
	padRadius: 8,
	padBorder: 1,
	plateInset: 11,
	plateBorder: 7,
	plateRadius: 10,
} as const;

/** Cell pad. */
export const PAD_W = SYMBOL_W * (DESIGN.padW / DESIGN.pitchX);
export const PAD_H = SYMBOL_H * (DESIGN.padH / DESIGN.pitchY);
// Radii and border widths are single numbers, so they are taken off the SHORT axis; the two axes
// disagree by under 2% here, which is well inside a rounded corner's tolerance.
export const PAD_RADIUS = SYMBOL_H * (DESIGN.padRadius / DESIGN.pitchY);
export const PAD_BORDER = SYMBOL_H * (DESIGN.padBorder / DESIGN.pitchY);

/** Board plate, in the same local units as the grid (0..gridW, 0..gridH). */
export const GRID_W = SYMBOL_W * BOARD_DIMENSIONS.x;
export const GRID_H = SYMBOL_H * BOARD_DIMENSIONS.y;
export const PLATE_INSET_X = SYMBOL_W * (DESIGN.plateInset / DESIGN.pitchX);
export const PLATE_INSET_Y = SYMBOL_H * (DESIGN.plateInset / DESIGN.pitchY);
export const PLATE_BORDER = SYMBOL_H * (DESIGN.plateBorder / DESIGN.pitchY);
export const PLATE_RADIUS = SYMBOL_H * (DESIGN.plateRadius / DESIGN.pitchY);
export const PLATE_W = GRID_W + PLATE_INSET_X * 2;
export const PLATE_H = GRID_H + PLATE_INSET_Y * 2;

export const BOARD_COLORS = {
	plateFill: 0x8284d6,
	plateBorder: 0x3a3981,
	padFill: 0xb4b6ff,
	/** The design's pad is rgba(180,182,255,0.9) — the plate reads through it. */
	padAlpha: 0.9,
	padBorder: 0xa5a7ee,
	// Depth, which the design does not specify: it draws the pad as one flat rounded rect, and 49
	// flat rects side by side read as a sheet of paper rather than as a machine with wells in it.
	// A dark ring just inside the border plus a lighter one along the bottom is the cheapest thing
	// that reads as recessed — no gradients, no extra textures, two more strokes per pad.
	padRecess: 0x6f71bd,
	padBevel: 0xe4e5ff,
	/** The soft contact shadow a symbol casts on its own pad. */
	symbolShadow: 0x4a4b92,
	// The design has no win state for a cell, so this is derived rather than specified: the pad
	// lights toward the palette's accent (#A88EFF, the same violet as the spin button and the BONUS
	// pill) instead of inventing a colour the rest of the screen never uses.
	winFill: 0xd9caff,
	winBorder: 0xa88eff,
} as const;

/** How much wider the win pad's border is than a resting pad's. */
export const WIN_BORDER_SCALE = 3;

type Painter = {
	roundRect: (x: number, y: number, w: number, h: number, r: number) => unknown;
	fill: (style: object) => void;
	stroke: (style: object) => void;
};

/**
 * Draw the board plate, centred on (0,0).
 *
 * The path is inset by half the border so a CENTRED pixi stroke lands where the design's CSS border
 * does (CSS draws its border inside the box); stroking the outer path instead would grow the plate
 * by half a border on every side.
 */
export const drawPlate = (g: Painter, scale = 1) => {
	const b = PLATE_BORDER * scale;
	const w = PLATE_W * scale - b;
	const h = PLATE_H * scale - b;
	g.roundRect(-w / 2, -h / 2, w, h, Math.max(0, PLATE_RADIUS * scale - b / 2));
	g.fill({ color: BOARD_COLORS.plateFill });
	g.stroke({ width: b, color: BOARD_COLORS.plateBorder });
};

/** How deep the pad's inner shading reads, as a fraction of the pad's short side. */
const RECESS_INSET = 0.045;
const RECESS_ALPHA = 0.3;
const BEVEL_ALPHA = 0.4;

/**
 * Draw one cell pad, centred on (cx, cy) in the grid's local units.
 *
 * Three passes: the design's flat pad, then a dark ring just inside its border, then a lighter ring
 * offset DOWNWARD. The offset is what turns two concentric rings into a light direction — the dark
 * one shows most at the top, the light one most at the bottom, and the cell reads as a well lit
 * from above. Both are strokes rather than fills, so the pad's own colour is untouched and a win
 * pad still lights to exactly the specified violet.
 */
export const drawPad = (g: Painter, cx: number, cy: number, win: boolean) => {
	const b = PAD_BORDER * (win ? WIN_BORDER_SCALE : 1);
	const w = PAD_W - b;
	const h = PAD_H - b;
	g.roundRect(cx - w / 2, cy - h / 2, w, h, Math.max(0, PAD_RADIUS - b / 2));
	g.fill({
		color: win ? BOARD_COLORS.winFill : BOARD_COLORS.padFill,
		alpha: win ? 1 : BOARD_COLORS.padAlpha,
	});
	g.stroke({ width: b, color: win ? BOARD_COLORS.winBorder : BOARD_COLORS.padBorder });

	// A won pad is already carrying a triple-width lit border; shading it as well muddies the very
	// thing that is meant to read as "this cell paid".
	if (win) return;

	const inset = PAD_H * RECESS_INSET;
	const rw = w - inset * 2;
	const rh = h - inset * 2;
	const rr = Math.max(0, PAD_RADIUS - b / 2 - inset);
	g.roundRect(cx - rw / 2, cy - rh / 2, rw, rh, rr);
	g.stroke({ width: inset, color: BOARD_COLORS.padRecess, alpha: RECESS_ALPHA });
	g.roundRect(cx - rw / 2, cy - rh / 2 + inset, rw, rh, rr);
	g.stroke({ width: inset * 0.8, color: BOARD_COLORS.padBevel, alpha: BEVEL_ALPHA });
};
