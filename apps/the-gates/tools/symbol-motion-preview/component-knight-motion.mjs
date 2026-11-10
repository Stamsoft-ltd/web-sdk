/** Coordinates in the shared 300px authoring space, not independent pose images. */
export const KNIGHT_PLACEMENT = Object.freeze({ x: -5, y: 109, width: 279.9, spiritY: -7 });
const sourceScale = KNIGHT_PLACEMENT.width / 2172;
export const KNIGHT_PINS = Object.freeze([
	Object.freeze({
		x: KNIGHT_PLACEMENT.x + 211 * sourceScale,
		y: KNIGHT_PLACEMENT.y + 315.5 * sourceScale,
	}),
	Object.freeze({
		x: KNIGHT_PLACEMENT.x + 1961 * sourceScale,
		y: KNIGHT_PLACEMENT.y + 282.5 * sourceScale,
	}),
]);
export const KNIGHT_MS = 2600;
export const KNIGHT_MAX_ANGLE = (44 * Math.PI) / 180;
const clamp = (v) => Math.max(0, Math.min(1, v));
const ease = (v) => {
	v = clamp(v);
	return v * v * (3 - 2 * v);
};
export function knightOpen(ms, { reduced = false } = {}) {
	if (reduced) return 0;
	return ease((ms - 240) / 720) * (1 - ease((ms - 1660) / 700));
}
export const KNIGHT_AXIS_LENGTH = Math.hypot(
	KNIGHT_PINS[1].x - KNIGHT_PINS[0].x,
	KNIGHT_PINS[1].y - KNIGHT_PINS[0].y,
);
// The helmet faces left: its front ridge is not halfway between the two hinges.
export const KNIGHT_ARC_CENTER = 0.4;
export const KNIGHT_ARC_APEX_U = (KNIGHT_ARC_CENTER - 0.5) * KNIGHT_AXIS_LENGTH;
export function knightUV(u, v) {
	const [a, b] = KNIGHT_PINS,
		L = KNIGHT_AXIS_LENGTH,
		ux = (b.x - a.x) / L,
		uy = (b.y - a.y) / L;
	return { x: (a.x + b.x) / 2 + u * ux - v * uy, y: (a.y + b.y) / 2 + u * uy + v * ux };
}
/** A rigid rotation of a pre-curved 3D plate around the line through BOTH end points. */
export function knightPoint(x, y, open) {
	const [a, b] = KNIGHT_PINS,
		L = KNIGHT_AXIS_LENGTH,
		ux = (b.x - a.x) / L,
		uy = (b.y - a.y) / L;
	const cx = (a.x + b.x) / 2,
		cy = (a.y + b.y) / 2,
		u = (x - cx) * ux + (y - cy) * uy,
		v = -(x - cx) * uy + (y - cy) * ux;
	const t = clamp((u + L / 2) / L),
		arcT =
			t <= KNIGHT_ARC_CENTER
				? (t / KNIGHT_ARC_CENTER) * 0.5
				: 0.5 + ((t - KNIGHT_ARC_CENTER) / (1 - KNIGHT_ARC_CENTER)) * 0.5,
		depth = 110 * Math.sin(arcT * Math.PI),
		angle = clamp(open) * KNIGHT_MAX_ANGLE;
	const across = v * Math.cos(angle) - depth * Math.sin(angle),
		wz = v * Math.sin(angle) + depth * Math.cos(angle),
		z = wz - depth;
	const wx = cx + u * ux - across * uy,
		wy = cy + u * uy + across * ux,
		k = 900 / (900 - z);
	return { x: cx + (wx - cx) * k, y: cy + (wy - cy) * k, z, wx, wy, wz, depth, angle };
}
// Dense, evenly spaced arc samples remove the coarse faceting during lift.
export const KNIGHT_ARC_SEGMENTS = 64;
export const KNIGHT_GRID_U = Array.from(
	{ length: KNIGHT_ARC_SEGMENTS + 1 },
	(_, i) => (i / KNIGHT_ARC_SEGMENTS - 0.5) * KNIGHT_AXIS_LENGTH,
);
KNIGHT_GRID_U.unshift(-KNIGHT_AXIS_LENGTH / 2 - 5);
KNIGHT_GRID_U.push(KNIGHT_AXIS_LENGTH / 2 + 5);
KNIGHT_GRID_U.push(KNIGHT_ARC_APEX_U);
KNIGHT_GRID_U.sort((a, b) => a - b);
export const KNIGHT_GRID_V = [-60, -40, -20, 0, 15, 30, 45, 65];
