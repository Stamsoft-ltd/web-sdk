/** One canonical short visor + body; the two poses are transforms, not generated states. */
export const SHORT_KNIGHT_PINS = [
	{ x: 42, y: 132 },
	{ x: 237, y: 147 },
];
const clamp = (v) => Math.max(0, Math.min(1, v));
const ease = (v) => {
	v = clamp(v);
	return v * v * (3 - 2 * v);
};
export function shortClosed(ms) {
	const p = clamp(ms / 1800);
	return ease((p - 0.14) / 0.25) * (1 - ease((p - 0.65) / 0.26));
}
export function shortUV(u, v) {
	const [a, b] = SHORT_KNIGHT_PINS,
		L = Math.hypot(b.x - a.x, b.y - a.y);
	return {
		x: (a.x + b.x) / 2 + (u * (b.x - a.x)) / L - (v * (b.y - a.y)) / L,
		y: (a.y + b.y) / 2 + (u * (b.y - a.y)) / L + (v * (b.x - a.x)) / L,
	};
}
export function shortVisorPoint(x, y, closed) {
	const [a, b] = SHORT_KNIGHT_PINS,
		L = Math.hypot(b.x - a.x, b.y - a.y),
		ux = (b.x - a.x) / L,
		uy = (b.y - a.y) / L,
		cx = (a.x + b.x) / 2,
		cy = (a.y + b.y) / 2;
	const u = (x - cx) * ux + (y - cy) * uy,
		v = -(x - cx) * uy + (y - cy) * ux,
		t = (u + L / 2) / L;
	const depth = 31 * ease(Math.min(t / 0.12, (1 - t) / 0.12)),
		angle = ((1 - clamp(closed)) * Math.PI * 68) / 180;
	const across = v * Math.cos(angle) - depth * Math.sin(angle),
		z = v * Math.sin(angle) + depth * Math.cos(angle) - depth,
		k = 1000 / (1000 - z);
	return {
		x: cx + (u * ux - across * uy) * k,
		y: cy + (u * uy + across * ux) * k,
		z,
		depth,
		angle,
	};
}
export function affine3(source, dest) {
	const [s0, s1, s2] = source,
		[p0, p1, p2] = dest,
		sx = s1.x - s0.x,
		sy = s1.y - s0.y,
		tx = s2.x - s0.x,
		ty = s2.y - s0.y,
		det = sx * ty - sy * tx;
	const a = ((p1.x - p0.x) * ty - (p2.x - p0.x) * sy) / det,
		b = ((p1.y - p0.y) * ty - (p2.y - p0.y) * sy) / det,
		c = ((p2.x - p0.x) * sx - (p1.x - p0.x) * tx) / det,
		d = ((p2.y - p0.y) * sx - (p1.y - p0.y) * tx) / det;
	return [a, b, c, d, p0.x - a * s0.x - c * s0.y, p0.y - b * s0.x - d * s0.y];
}
