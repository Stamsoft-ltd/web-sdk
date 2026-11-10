/** Concept-only clock. One canonical visor texture throughout; no independent pose swap. */
export const PALACE_MS = 1800;
const clamp = (v) => Math.max(0, Math.min(1, v));
const ease = (v) => {
	v = clamp(v);
	return v * v * (3 - 2 * v);
};
const ramp = (p, a, b) => ease((p - a) / (b - a));
export function palaceFrame(ms, { speed = 1, reduced = false } = {}) {
	const p = reduced ? 0 : clamp((Math.max(0, ms) * Math.max(0.1, speed)) / PALACE_MS);
	const active = ramp(p, 0.04, 0.19) * (1 - ramp(p, 0.79, 0.98));
	const splash = ramp(p, 0.18, 0.3) * (1 - ramp(p, 0.64, 0.83));
	const closed = ramp(p, 0.14, 0.39) * (1 - ramp(p, 0.65, 0.91));
	// Small damped settle only on the moving plate, never the whole helmet.
	const impact =
		p <= 0.39 || p >= 0.57
			? 0
			: Math.sin(((p - 0.39) / 0.18) * Math.PI * 4) * Math.exp(-(p - 0.39) * 24);
	return {
		p,
		active,
		closed,
		impact,
		spirit: active * (0.86 + 0.14 * Math.sin(p * Math.PI * 5)),
		liquidAngle: Math.PI * 1.7 * ramp(p, 0.08, 0.9),
		liquidLift: active ? Math.sin(p * Math.PI * 4) * active * 1.5 : 0,
		liquidGlow: active * (0.84 + 0.16 * Math.sin(p * Math.PI * 5)),
		splash,
		cupAngle: active ? Math.sin(p * Math.PI * 7) * active * 0.025 : 0,
		cupX: active ? Math.sin(p * Math.PI * 9) * active * 1.5 : 0,
		cupY: active ? Math.sin(p * Math.PI * 6) * active * 0.7 : 0,
		droplets: Array.from({ length: 7 }, (_, i) => {
			const t = clamp((p - (0.25 + i * 0.055)) / 0.25),
				flight = t > 0 && t < 1;
			return {
				x: 150 + (i - 3) * 8 + (i - 3) * 9 * t,
				y: 53 - Math.sin(t * Math.PI) * (34 + (i % 3) * 12),
				radius: flight ? (2 + (i % 2)) * (1 - 0.35 * t) : 0,
				alpha: flight ? splash * Math.sin(t * Math.PI) : 0,
			};
		}),
	};
}
/** Visible corner pins define the actual axis, in the same plane as the source art.
 * The faceplate has short curved-in-depth side cheeks, not hidden offset pivots.
 */
export const VISOR_HINGES = Object.freeze([
	{ x: 53, y: 120, z: 0 },
	{ x: 215, y: 126, z: 0 },
]);
export const VISOR_AXIS_LENGTH = Math.hypot(162, 6);
export function visorUV(u, v) {
	const [a, b] = VISOR_HINGES,
		ux = (b.x - a.x) / VISOR_AXIS_LENGTH,
		uy = (b.y - a.y) / VISOR_AXIS_LENGTH;
	return { x: (a.x + b.x) / 2 + u * ux - v * uy, y: (a.y + b.y) / 2 + u * uy + v * ux };
}
export function visorWorldPoint(x, y, sourceZ, closed, impact = 0) {
	const [a, b] = VISOR_HINGES,
		length = VISOR_AXIS_LENGTH;
	const ux = (b.x - a.x) / length,
		uy = (b.y - a.y) / length,
		cx = (a.x + b.x) / 2,
		cy = (a.y + b.y) / 2;
	const u = (x - cx) * ux + (y - cy) * uy,
		v = -(x - cx) * uy + (y - cy) * ux;
	const depth = sourceZ,
		angle = ((1 - clamp(closed)) * Math.PI) / 3 + impact * 0.012;
	const across = v * Math.cos(angle) - depth * Math.sin(angle);
	const wz = v * Math.sin(angle) + depth * Math.cos(angle),
		z = wz - sourceZ;
	const wx = cx + u * ux - across * uy,
		wy = cy + u * uy + across * ux,
		perspective = 900 / (900 - z);
	return {
		x: cx + (wx - cx) * perspective,
		y: cy + (wy - cy) * perspective,
		z,
		wx,
		wy,
		wz,
		depth,
		angle,
	};
}
export function visorPoint(x, y, closed, impact = 0) {
	const [a, b] = VISOR_HINGES,
		length = VISOR_AXIS_LENGTH,
		cx = (a.x + b.x) / 2,
		cy = (a.y + b.y) / 2;
	const u = ((x - cx) * (b.x - a.x)) / length + ((y - cy) * (b.y - a.y)) / length,
		t = (u + length / 2) / length;
	// Broad front stays uniform; only the short side cheeks return to the visible pins.
	const depth = 70 * ease(Math.min(t / 0.14, (1 - t) / 0.14));
	return visorWorldPoint(x, y, depth, closed, impact);
}
export const PALACE_TIMELINE = {
	name: 'Palace replacement approval studies',
	states: ['rest', 'paying'],
	events: ['play', 'finish', 'reset'],
	transitions: [
		{ from: 'rest', event: 'play', to: 'paying' },
		{ from: 'paying', event: 'finish', to: 'rest' },
		{ from: 'paying', event: 'reset', to: 'rest' },
	],
	timelines: [
		{
			event: 'play',
			fromState: 'rest',
			toState: 'paying',
			steps: [
				{
					id: 'charge',
					target: 'spirit + pink basin',
					startMs: 72,
					durationMs: 270,
					easing: 'easeInOut',
					curve: 'cubic smoothstep 3t²-2t³',
				},
				{
					id: 'visor-close',
					target: 'one visor plate',
					startMs: 252,
					durationMs: 450,
					easing: 'easeInOut',
					curve: 'cubic smoothstep 3t²-2t³',
				},
				{
					id: 'liquid-swirl',
					target: 'masked pink basin',
					startMs: 144,
					durationMs: 1476,
					easing: 'easeInOut',
					curve: 'cubic smoothstep 3t²-2t³',
				},
				{
					id: 'splash-and-wobble',
					target: 'pink liquid + gold cup',
					startMs: 324,
					durationMs: 1170,
					easing: 'easeInOut',
					curve: 'ballistic droplets; 0.025rad damped cup wobble',
				},
			].sort((a, b) => a.startMs - b.startMs),
		},
		{
			event: 'finish',
			fromState: 'paying',
			toState: 'rest',
			steps: [
				{
					id: 'visor-reopen',
					target: 'one visor plate',
					startMs: 1170,
					durationMs: 468,
					easing: 'easeInOut',
					curve: 'cubic smoothstep 3t²-2t³',
				},
				{
					id: 'glow-settle',
					target: 'spirit + pink basin',
					startMs: 1422,
					durationMs: 342,
					easing: 'easeInOut',
					curve: 'cubic smoothstep 3t²-2t³',
				},
			],
		},
		{
			event: 'reset',
			fromState: 'paying',
			toState: 'rest',
			steps: [
				{
					id: 'neutral-pose',
					target: 'both symbols',
					startMs: 0,
					durationMs: 1,
					easing: 'linear',
				},
			],
		},
	],
};
