// Crack geometry for the Pixi board, ported from components/Crack.svelte (same seeds, same
// plans): tapered tears out of the junctions where the new blobs meet, a side twig per
// branch, and chips that jump off as the tear passes. Coordinates are Blob's 0–100 space.

export type Pt = [number, number];
// [from, to, start, duration, base width]: start/duration are fractions of the divide beat.
type Branch = [Pt, Pt, number, number, number];

const out = (from: Pt, to: Pt, delay = 0, w = 4.8): Branch => [from, to, 0.3 + delay, 0.32, w];
const RING: Pt = [50, 50];
const RING_R = 22;
const PLANS: Record<number, Branch[]> = {
	2: [out([50, 50], [50, -8]), out([50, 50], [50, 108])],
	3: [out([50, 48], [50, 108]), out([50, 48], [-14, 48]), out([50, 48], [114, 48])],
	4: [out([50, 49], [50, -8]), out([50, 49], [50, 108]), out([50, 49], [-14, 49]), out([50, 49], [114, 49])],
	5: ([[0, -1], [0, 1], [-1, 0], [1, 0]] as Pt[]).map(([sx, sy]) =>
		out([RING[0] + sx * RING_R, RING[1] + sy * RING_R], [RING[0] + sx * 64, RING[1] + sy * 58], 0.08, 3.8),
	),
	6: [
		out([29, 50], [71, 50], 0, 3.8),
		out([29, 50], [-14, 50], 0, 3.8),
		out([71, 50], [114, 50], 0, 3.8),
		out([29, 50], [29, -8], 0, 3.8),
		out([29, 50], [29, 108], 0, 3.8),
		out([71, 50], [71, -8], 0, 3.8),
		out([71, 50], [71, 108], 0, 3.8),
	],
};
export const JUNCTIONS: Record<number, Pt[]> = {
	2: [[50, 50]],
	3: [[50, 48]],
	4: [[50, 49]],
	5: [RING],
	6: [
		[29, 50],
		[71, 50],
	],
};

// mulberry32: the same cell always cracks the same way, neighbours differently.
function rng(s: number) {
	return () => {
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
function jag(a: Pt, b: Pt, rand: () => number, amp = 3): Pt[] {
	const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
	const len = Math.hypot(dx, dy);
	const [nx, ny] = [-dy / len, dx / len];
	const n = Math.max(3, Math.round(len / 6));
	const pts: Pt[] = [a];
	let side = rand() < 0.5 ? -1 : 1;
	for (let i = 1; i < n; i++) {
		if (rand() < 0.75) side = -side;
		const o = side * amp * (0.3 + rand() * 0.7);
		const t = (i + (rand() - 0.5) * 0.5) / n;
		pts.push([a[0] + dx * t + nx * o, a[1] + dy * t + ny * o]);
	}
	pts.push(b);
	return pts;
}

export type Tear = { pts: Pt[]; closed: boolean; s: number; t: number; w: number };
export type Chip = { x: number; y: number; dx: number; dy: number; r: number; size: number; d: number; light: boolean };

export function crackPlan(units: number, seed: number) {
	const rand = rng(seed * 2654435761 + units);
	const tears: Tear[] = [];
	const chips: Chip[] = [];
	if (units === 5) {
		const pts: Pt[] = [];
		for (let i = 0; i <= 18; i++) {
			const a = (i / 18) * Math.PI * 2 - Math.PI / 2;
			const r = i % 18 === 0 ? RING_R : RING_R + (rand() - 0.5) * 3.5;
			pts.push([RING[0] + Math.cos(a) * r, RING[1] + Math.sin(a) * r]);
		}
		tears.push({ pts, closed: true, s: 0.28, t: 0.2, w: 3.4 });
	}
	for (const [a, b, s, t, w] of PLANS[Math.min(units, 6)] ?? []) {
		const pts = jag(a, b, rand);
		tears.push({ pts, closed: false, s, t, w });
		const k = 1 + Math.floor(rand() * (pts.length - 2));
		const [px, py] = pts[k];
		const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + (rand() < 0.5 ? -1 : 1) * (0.5 + rand() * 0.45);
		const len = 6 + rand() * 7;
		const twig = jag([px, py], [px + Math.cos(ang) * len, py + Math.sin(ang) * len], rand, 1.3);
		tears.push({ pts: twig, closed: false, s: s + (t * k) / (pts.length - 1), t: 0.1, w: w * 0.55 });
		for (let c = 0; c < 2; c++) {
			const i = 1 + Math.floor(rand() * Math.min(4, pts.length - 2));
			const [x, y] = pts[i];
			const dir = Math.atan2(b[1] - a[1], b[0] - a[0]) + (rand() < 0.5 ? -1 : 1) * Math.PI * (0.35 + rand() * 0.3);
			const dist = 7 + rand() * 9;
			chips.push({
				x,
				y,
				dx: Math.cos(dir) * dist,
				dy: Math.sin(dir) * dist,
				r: (rand() - 0.5) * 540,
				size: 1.2 + rand() * 1.6,
				d: s + (t * i) / (pts.length - 1),
				light: rand() < 0.5,
			});
		}
	}
	return { tears, chips, junctions: JUNCTIONS[Math.min(units, 6)] ?? [] };
}

// The first `p` (0..1, by length) of a polyline, ending on an interpolated point. Returns the
// points and, per point, its fraction of the FULL length (the taper follows the whole tear).
export function prefix(pts: Pt[], p: number): { pts: Pt[]; at: number[] } {
	const seg = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
	const total = seg.reduce((a, b) => a + b, 0) || 1;
	const want = total * Math.min(1, Math.max(0, p));
	const outPts: Pt[] = [pts[0]];
	const at = [0];
	let run = 0;
	for (let i = 0; i < seg.length; i++) {
		if (run + seg[i] >= want) {
			const k = seg[i] ? (want - run) / seg[i] : 0;
			outPts.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k]);
			at.push(want / total);
			return { pts: outPts, at };
		}
		run += seg[i];
		outPts.push(pts[i + 1]);
		at.push(run / total);
	}
	return { pts: outPts, at };
}

// A crack is a sliver: full width where it starts, a hairline at the tip. Flat [x0,y0,x1,…].
export function sliver(pts: Pt[], at: number[], w0: number, w1: number, shift = 0): number[] {
	const left: number[] = [];
	const right: number[] = [];
	pts.forEach((p, i) => {
		const a = pts[Math.max(0, i - 1)];
		const b = pts[Math.min(pts.length - 1, i + 1)];
		const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
		const [nx, ny] = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
		const w = (w0 + (w1 - w0) * at[i]) / 2;
		const cx = p[0] + nx * shift;
		const cy = p[1] + ny * shift;
		left.push(cx + nx * w, cy + ny * w);
		// unshift(x, y) keeps each pair in order while reversing the pairs: the far side runs back.
		right.unshift(cx - nx * w, cy - ny * w);
	});
	return [...left, ...right];
}
