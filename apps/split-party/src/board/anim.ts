// CSS-equivalent animation helpers for the Pixi board: cubic-bezier easing and keyframe
// interpolation, so the board's motion is the same as the CSS keyframes it replaces.

export type Ease = (t: number) => number;

// cubic-bezier(x1, y1, x2, y2) solved for x like browsers do (Newton, then bisection).
export function bezier(x1: number, y1: number, x2: number, y2: number): Ease {
	const cx = 3 * x1,
		bx = 3 * (x2 - x1) - cx,
		ax = 1 - cx - bx;
	const cy = 3 * y1,
		by = 3 * (y2 - y1) - cy,
		ay = 1 - cy - by;
	const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
	const sy = (t: number) => ((ay * t + by) * t + cy) * t;
	const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
	return (x: number) => {
		if (x <= 0) return 0;
		if (x >= 1) return 1;
		let t = x;
		for (let i = 0; i < 8; i++) {
			const e = sx(t) - x;
			if (Math.abs(e) < 1e-5) return sy(t);
			const d = dx(t);
			if (Math.abs(d) < 1e-6) break;
			t -= e / d;
		}
		let lo = 0,
			hi = 1;
		t = x;
		for (let i = 0; i < 30; i++) {
			const v = sx(t);
			if (Math.abs(v - x) < 1e-5) break;
			if (v < x) lo = t;
			else hi = t;
			t = (lo + hi) / 2;
		}
		return sy(t);
	};
}

export const LINEAR: Ease = (t) => t;
export const EASE = bezier(0.25, 0.1, 0.25, 1);
export const EASE_IN_OUT = bezier(0.42, 0, 0.58, 1);
export const EASE_OUT = bezier(0, 0, 0.58, 1);
export const GRAVITY = bezier(0.11, 0, 0.5, 0);

// A keyframe: offset 0..1, the values there, and the easing of the segment that STARTS here
// (CSS animation-timing-function inside a keyframe), else the animation's own easing.
export type Frame<V extends Record<string, number>> = [number, V, Ease?];

export function keyframes<V extends Record<string, number>>(frames: Frame<V>[], t: number, base: Ease = EASE): V {
	if (t <= frames[0][0]) return frames[0][1];
	const last = frames[frames.length - 1];
	if (t >= last[0]) return last[1];
	let i = 0;
	while (i < frames.length - 2 && t >= frames[i + 1][0]) i++;
	const [o0, v0, e] = frames[i];
	const [o1, v1] = frames[i + 1];
	const k = (e ?? base)(o1 > o0 ? (t - o0) / (o1 - o0) : 1);
	const out = {} as Record<string, number>;
	for (const key in v0) out[key] = v0[key] + ((v1[key] ?? v0[key]) - v0[key]) * k;
	return out as V;
}

// Progress of a timed animation at `now`: 0..1 (clamped), or -1 before its delay.
export const progress = (now: number, start: number, delay: number, dur: number) => {
	const t = now - start - delay;
	if (t < 0) return -1;
	return dur > 0 ? Math.min(1, t / dur) : 1;
};

/** How long the tease's happy surprise plays (BoardView's blobs, App's `mood`, style.css). */
export const SURPRISE_MS = 1000;
