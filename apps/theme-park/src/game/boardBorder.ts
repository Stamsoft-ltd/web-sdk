/**
 * The neon border painted into board-auto.webp, reduced to the two things the running lights need:
 * the rounded rect the line follows, and the colour it is painted at each point round that rect.
 *
 * All geometry is a fraction of the art (1462x972), so it survives any board scale. RAMP runs
 * clockwise from the middle of the top edge, one entry per 1/96 of the perimeter, sampled beside
 * the blown-out core (which is white) and smoothed round the ring.
 *
 * Regenerate only if the pad art changes.
 */
import type { BorderGeometry } from '../lib/roundedRectPath';
import { rampColour, roundedRectPoint } from '../lib/roundedRectPath';

export const BORDER: BorderGeometry = {
	left: 0.00342,
	top: 0.00103,
	right: 0.99590,
	bottom: 0.99794,
	rx: 0.03830,
	ry: 0.04321,
};

export const BORDER_RAMP = [
	0x9006ff, 0x9d06ff, 0xa705ff, 0xb205ff, 0xbc06ff, 0xc907ff,
	0xd607ff, 0xea09ff, 0xff0bfe, 0xff1cec, 0xff30d6, 0xff3ab5,
	0xff519e, 0xff6385, 0xff6a71, 0xff7165, 0xff7f6a, 0xff7f6a,
	0xff8270, 0xff8572, 0xff8173, 0xff8272, 0xff8573, 0xff8574,
	0xff8372, 0xff8171, 0xff8073, 0xff8273, 0xff8273, 0xff8073,
	0xff8172, 0xff7266, 0xff5959, 0xff4c53, 0xff3d53, 0xff2a5b,
	0xff2474, 0xff2493, 0xff1db0, 0xff27cb, 0xff33df, 0xff33f0,
	0xff32fe, 0xf632ff, 0xec23ff, 0xe014ff, 0xd414ff, 0xc615ff,
	0xb716ff, 0xa715ff, 0x9917ff, 0x8b18ff, 0x7d19ff, 0x6e1aff,
	0x611eff, 0x5222ff, 0x4329ff, 0x3632ff, 0x2a3bff, 0x1f45ff,
	0x154fff, 0x0e58ff, 0x106bff, 0x167eff, 0x1c8cff, 0x269aff,
	0x2fa5ff, 0x31a2ff, 0x329eff, 0x349cff, 0x3599ff, 0x3898ff,
	0x3a99ff, 0x3b9aff, 0x3e9aff, 0x3f9aff, 0x3f9aff, 0x3e9bff,
	0x3e9bff, 0x3993ff, 0x358aff, 0x2e7aff, 0x2564ff, 0x1d4dff,
	0x1a3dff, 0x192bff, 0x1d21ff, 0x2719ff, 0x3312ff, 0x410fff,
	0x500cff, 0x5c0bff, 0x670aff, 0x7109ff, 0x7b08ff, 0x8507ff,
];

/** A point on the pad's border, relative to its centre — where <BoardFrame> anchors the sprite. */
export const borderPoint = (t: number, width: number, height: number) =>
	roundedRectPoint(BORDER, t, width, height, -width / 2, -height / 2);

/** The colour the pad's border is painted at `t`. */
export const borderColour = (t: number) => rampColour(BORDER_RAMP, t);
