// The big-win card's two sauce splashes (mustard left, ketchup right), drawn in code — they replaced
// the flat splash-yellow / splash-red webps. They are SQUEEZED OUT by the title: nothing shows until
// the words slam onto the banner (WinPadArt's hit), then the sauce bursts from under each banner end —
// a lumpy core, fat round-ended tongues shooting outward, and teardrop drops flung further out
// (stretched while they fly, tails pointing back at the source). Once out, it keeps a slow wet wobble.
//
// Units: fractions of the pad width W, relative to the splash origin; `side` -1 = left (mirrored).

import type { SplatShape } from './wildSplat';

type Tongue = { a: number; len: number; w: number; head: number; curl: number };
type Drop = { a: number; d: number; r: number; delay: number };
export type SplashSpec = {
	ox: number; // origin (fraction of W) — x for the RIGHT side; the left mirrors it
	oy: number;
	core: { rx: number; ry: number };
	tongues: Tongue[]; // a = degrees off "straight outward" (+ = down), curl = degrees of bend along it
	drops: Drop[];
	palette: { edge: number; body: number; shade: number; light: number };
	/** Outline thickness (W units); the big-win card's default is a thin 0.0034. */
	edgeW?: number;
};

// Mustard (left of the banner) — taller, one long tongue thrown up over the banner's top corner.
export const SPLASH_YELLOW: SplashSpec = {
	ox: 0.335,
	oy: -0.02,
	core: { rx: 0.075, ry: 0.06 },
	tongues: [
		{ a: -70, len: 0.15, w: 0.03, head: 0.036, curl: 16 },
		{ a: -22, len: 0.085, w: 0.032, head: 0.034, curl: -8 },
		{ a: 18, len: 0.13, w: 0.034, head: 0.04, curl: 10 },
		{ a: 62, len: 0.08, w: 0.028, head: 0.032, curl: -12 },
	],
	drops: [
		{ a: -48, d: 0.21, r: 0.016, delay: 30 },
		{ a: -4, d: 0.2, r: 0.013, delay: 60 },
		{ a: 40, d: 0.19, r: 0.017, delay: 20 },
		{ a: -98, d: 0.16, r: 0.012, delay: 50 },
		{ a: 86, d: 0.13, r: 0.011, delay: 80 },
	],
	palette: { edge: 0x9a5a06, body: 0xf3ae0a, shade: 0xd08600, light: 0xffd860 },
};

// Ketchup (right) — flatter and wider, tongues fanned sideways.
export const SPLASH_RED: SplashSpec = {
	ox: 0.335,
	oy: -0.02,
	core: { rx: 0.08, ry: 0.052 },
	tongues: [
		{ a: -50, len: 0.12, w: 0.03, head: 0.036, curl: -12 },
		{ a: -8, len: 0.15, w: 0.034, head: 0.04, curl: 8 },
		{ a: 34, len: 0.1, w: 0.03, head: 0.034, curl: 14 },
		{ a: -96, len: 0.07, w: 0.026, head: 0.03, curl: 6 },
	],
	drops: [
		{ a: -30, d: 0.22, r: 0.016, delay: 40 },
		{ a: 12, d: 0.23, r: 0.014, delay: 20 },
		{ a: 58, d: 0.16, r: 0.015, delay: 60 },
		{ a: -74, d: 0.18, r: 0.013, delay: 70 },
		{ a: 92, d: 0.12, r: 0.011, delay: 90 },
	],
	palette: { edge: 0x5e0802, body: 0xdc240e, shade: 0xa81305, light: 0xf65a3c },
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOutBack = (u: number, c1 = 2) => {
	if (u <= 0) return 0;
	if (u >= 1) return 1;
	const c3 = c1 + 1;
	return 1 + c3 * (u - 1) ** 3 + c1 * (u - 1) ** 2;
};
const easeOutCubic = (u: number) => 1 - (1 - clamp01(u)) ** 3;
const rad = (d: number) => (d * Math.PI) / 180;

const GROW_MS = 300; // tongues shoot out
const FLY_MS = 420; // drops fly to their spots

/** Ellipse rotated by `rot`, as a polygon. */
function rotEllipse(cx: number, cy: number, rx: number, ry: number, rot: number) {
	const pts: number[] = [];
	for (let i = 0; i < 20; i++) {
		const a = (i / 20) * Math.PI * 2;
		const x = Math.cos(a) * rx;
		const y = Math.sin(a) * ry;
		pts.push(cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot));
	}
	return pts;
}

/** Lumpy blob outline around (cx, cy). */
function blob(cx: number, cy: number, rx: number, ry: number, inflate: number, seed: number) {
	const pts: number[] = [];
	const N = 40;
	for (let i = 0; i < N; i++) {
		const a = (i / N) * Math.PI * 2;
		const k = 1 + 0.08 * Math.sin(3 * a + seed) + 0.05 * Math.sin(5 * a + seed * 1.7);
		pts.push(cx + Math.cos(a) * (rx * k + inflate), cy + Math.sin(a) * (ry * k + inflate));
	}
	return pts;
}

/** A tongue: a curling, gently tapering neck from the origin out to a round head. */
function tongue(ox: number, oy: number, dir: number, len: number, w: number, head: number, curl: number, inflate: number) {
	const N = 12;
	const L: number[] = [];
	const R: number[] = [];
	let x = ox;
	let y = oy;
	const seg = len / N;
	for (let i = 0; i <= N; i++) {
		const s = i / N;
		const a = dir + rad(curl) * s * s;
		const nx = -Math.sin(a);
		const ny = Math.cos(a);
		// neck narrows to ~70% midway, then swells into the head
		const width = Math.max(0.001, w * (1 - 0.2 * Math.sin(Math.PI * Math.min(1, s * 1.15))) + inflate);
		L.push(x + nx * width, y + ny * width);
		R.push(x - nx * width, y - ny * width);
		if (i < N) {
			x += Math.cos(a) * seg;
			y += Math.sin(a) * seg;
		}
	}
	const pts = [...L];
	for (let i = R.length - 2; i >= 0; i -= 2) pts.push(R[i], R[i + 1]);
	return { pts, hx: x, hy: y, hr: head + inflate };
}

/** Teardrop at (x, y), round end radius r, tail pointing along angle `back` with length `tail`. */
function tear(x: number, y: number, r: number, back: number, tail: number) {
	const pts: number[] = [];
	const N = 22;
	const tx = x + Math.cos(back) * (r + tail);
	const ty = y + Math.sin(back) * (r + tail);
	// round end: the half circle facing away from the tail, then two curves into the tail point
	for (let i = 0; i <= N; i++) {
		const a = back + Math.PI / 2 + (i / N) * Math.PI;
		pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r);
	}
	const sx = x + Math.cos(back - Math.PI / 2) * r;
	const sy = y + Math.sin(back - Math.PI / 2) * r;
	for (let i = 1; i <= 6; i++) {
		const q = i / 6;
		const k = Math.sin((q * Math.PI) / 2);
		pts.push(sx + (tx - sx) * q + Math.cos(back + Math.PI / 2) * r * 0.25 * Math.sin(Math.PI * q) * (1 - k), sy + (ty - sy) * q + Math.sin(back + Math.PI / 2) * r * 0.25 * Math.sin(Math.PI * q) * (1 - k));
	}
	const ex = x + Math.cos(back + Math.PI / 2) * r;
	const ey = y + Math.sin(back + Math.PI / 2) * r;
	for (let i = 1; i < 6; i++) {
		const q = i / 6;
		pts.push(tx + (ex - tx) * q, ty + (ey - ty) * q);
	}
	return pts;
}

/**
 * One splash at `ms` after the title hit (negative = not yet squeezed out). `side` -1 mirrors it to
 * the left of the banner. Returned shapes are in pad-width units around the pad centre. `place`
 * re-seats it for tight screens: a different origin x and a uniform scale about that origin (portrait,
 * where the pad is nearly screen-wide and the full reach would run off the edges).
 */
export function splashShapes(spec: SplashSpec, side: 1 | -1, ms: number, seed = 0, place?: { ox: number; k: number }): SplatShape[] {
	if (ms < 0) return [];
	if (place) {
		const ox0 = spec.ox * side;
		const ox1 = place.ox * side;
		const k = place.k;
		const X = (x: number) => ox1 + (x - ox0) * k;
		const Y = (y: number) => spec.oy + (y - spec.oy) * k;
		return splashShapes(spec, side, ms, seed).map((s) => {
			if (s.kind === 'poly') return { ...s, pts: s.pts.map((v, i) => (i % 2 === 0 ? X(v) : Y(v))) };
			if (s.kind === 'circle') return { ...s, x: X(s.x), y: Y(s.y), r: s.r * k };
			return { ...s, x: X(s.x), y: Y(s.y), rx: s.rx * k, ry: s.ry * k };
		});
	}
	const out: SplatShape[] = [];
	const ox = spec.ox * side;
	const oy = spec.oy;
	const outward = side > 0 ? 0 : Math.PI;
	const ang = (a: number) => outward + rad(a) * side; // + = down on both sides
	const coreS = 0.35 + 0.65 * easeOutBack(clamp01(ms / 200), 1.6);
	const wob = (i: number) => 1 + 0.035 * Math.sin(ms / 310 + i * 1.9 + seed) * clamp01((ms - GROW_MS) / 400);

	const tongues = spec.tongues.map((t, i) => {
		const g = easeOutBack(clamp01((ms - i * 14) / GROW_MS), 2.2) * wob(i);
		return { t, g, dir: ang(t.a) };
	});
	const drops = spec.drops.map((d) => {
		const u = clamp01((ms - d.delay) / FLY_MS);
		const p = easeOutCubic(u);
		const speed = 3 * (1 - u) ** 2; // derivative of easeOutCubic, 0 when landed
		const a = ang(d.a);
		return {
			x: ox + Math.cos(a) * d.d * p,
			y: oy + Math.sin(a) * d.d * p,
			r: d.r * (0.6 + 0.4 * p),
			back: a + Math.PI,
			tail: d.r * (0.9 + 2.4 * speed),
			alpha: clamp01((ms - d.delay) / 60),
		};
	});

	const P = spec.palette;
	const pass = (color: number, inflate: number, alpha = 1, dx = 0, dy = 0) => {
		out.push({ kind: 'poly', pts: blob(ox + dx, oy + dy, spec.core.rx * coreS, spec.core.ry * coreS, inflate, 1.3 + seed), color, alpha });
		for (const { t, g, dir } of tongues) {
			if (g <= 0.01) continue;
			const tg = tongue(ox + dx, oy + dy, dir, t.len * g, t.w, t.head * Math.min(1, g * 1.3), t.curl * side, inflate);
			out.push({ kind: 'poly', pts: tg.pts, color, alpha });
			out.push({ kind: 'circle', x: tg.hx, y: tg.hy, r: Math.max(0.001, tg.hr), color, alpha });
		}
		for (const d of drops) {
			if (d.alpha <= 0) continue;
			out.push({ kind: 'poly', pts: tear(d.x + dx, d.y + dy, Math.max(0.002, d.r + inflate), d.back, d.tail), color, alpha: alpha * d.alpha });
		}
	};
	// Outline, then the shade colour, then the body pulled in + nudged up-left: a darker inner rim
	// along the lower-right (thick wet sauce), then a softer lit band up-left.
	const E = spec.edgeW ?? 0.0034;
	pass(0x000000, E, 0.22, 0.002, 0.004); // contact shadow
	pass(P.edge, E);
	pass(P.shade, 0);
	pass(P.body, -0.0045, 1, -0.0015, -0.002);
	pass(P.light, -0.012, 0.4, -0.004, -0.005);
	// gloss: a streak along each tongue near its head, a dot on each drop, a sheen on the core
	for (const { t, g, dir } of tongues) {
		if (g < 0.5) continue;
		const tg = tongue(ox, oy, dir, t.len * g, t.w, t.head * Math.min(1, g * 1.3), t.curl * side, 0);
		const r = tg.hr;
		const nx = Math.sin(dir);
		const ny = -Math.cos(dir);
		const up = ny < 0 ? 1 : -1; // put the streak on the upper side of the tongue
		out.push({ kind: 'poly', pts: rotEllipse(tg.hx - Math.cos(dir) * r * 0.5 + nx * up * r * 0.45, tg.hy - Math.sin(dir) * r * 0.5 + ny * up * r * 0.45, r * 0.62, r * 0.2, dir), color: 0xffffff, alpha: 0.75 });
	}
	out.push({ kind: 'poly', pts: rotEllipse(ox - spec.core.rx * 0.3 * coreS, oy - spec.core.ry * 0.5 * coreS, spec.core.rx * 0.38 * coreS, spec.core.ry * 0.13 * coreS, -0.15 * side), color: 0xffffff, alpha: 0.6 });
	for (const d of drops) {
		if (d.alpha <= 0) continue;
		out.push({ kind: 'circle', x: d.x - d.r * 0.35, y: d.y - d.r * 0.35, r: d.r * 0.3, color: 0xffffff, alpha: 0.8 * d.alpha });
	}
	return out;
}
