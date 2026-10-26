// The 7×7 board drawn in Pixi (WebGL) instead of 49 SVG blobs: pads, cracks, blobs and their
// live faces, plus every board motion (falls, trap-door exit, pops, cell division, fright,
// relief, win bounce). It reproduces Blob.svelte, Crack.svelte, LiveEyes.svelte and the board
// rules in style.css frame for frame; App drives it with a snapshot of its board state and
// keeps cluster pops and sweat drops in the DOM over it.
import { Assets, Container, Graphics, GraphicsContext, Matrix, Sprite, Texture } from 'pixi.js';
import EYES from '../lib/eyes.json';
import FACES from '../lib/face-layers.json';
import { bezier, keyframes, progress, EASE, EASE_IN_OUT, EASE_OUT, LINEAR, GRAVITY, SURPRISE_MS, type Frame } from './anim';
import { crackPlan, prefix, sliver, type Pt } from './crackGeom';
import { Overlays, type ClusterPop, type Tease } from './overlays';

import { CELL_W, CELL_H, MARGIN, VIEW_W, VIEW_H, cellX, cellY } from './geometry';
import { DISPOSE, PixiApp, SharedGraphics, textureLookup, watchReducedMotion } from './pixiApp';
const N = 7;
// Blob art box: 74.08px, centred across the pad and hung from its top border (measured on the
// DOM board: the box overflows its grid track, which starts at the top). Blob's 100-unit space
// maps onto it, and so does the crack's.
const BOX = 74.08;
const U = BOX / 100;
const BORDER = 1.074;
const BOX_X = (CELL_W - BOX) / 2;
const BOX_Y = BORDER;
// The pad inside its border, in blob space: cracks are cut where the cell would clip them.
const CLIP = {
	x0: (BORDER - BOX_X) / U,
	x1: (CELL_W - BORDER - BOX_X) / U,
	y0: (BORDER - BOX_Y) / U,
	y1: (CELL_H - BORDER - BOX_Y) / U,
};

export type Drop = { rows: number; delay: number; dur: number };
export type GhostCell = { col: number; row: number; symbol: string; units: number; rows: number; delay: number; dur: number };
export type BoardSnap = {
	symbols: string[][];
	units: number[][];
	lit: string[];
	/** tease: columns held back while the eggs could still add up (the scatter tease). */
	wave: { id: number; drops: Drop[][]; impact: number; tease?: Tease[] };
	ghost: { id: number; cells: GhostCell[] } | null;
	awaiting: boolean;
	scared: boolean;
	/** Nervous while tiles split: the fright face and a small tremble, winners excepted. */
	nervous: boolean;
	relieved: boolean;
	popping: Record<string, number>;
	divideMs: number;
	/** Bumped when the player skips a split: running divisions and tears jump to their end. */
	rush: number;
	reliefMs: number;
	removeMs: number;
	pops: ClusterPop[];
	/** Cells whose blob breaks a sweat during the relief sigh. */
	sweat: string[];
	/** Trigger eggs hatching (components/EggHatch.svelte draws them): the board's own egg hides. */
	hatched: string[];
	/** The scatter tease's moods (App's `mood`): the column being wondered about, and the
	 *  performance.now() of the latest happy surprise (0: none). */
	mood: { wonder: number | null; surprise: number };
};

// ---- Blob data (Blob.svelte) ------------------------------------------------------------

const ART: Record<string, [number, number, number, number]> = {
	WATERMELON: [0, 0, 100, 100],
	CHERRIES: [0, 0, 100, 100],
	GRAPES: [0, -0.7, 100, 101.4],
	STRAWBERRY: [0, 0, 100, 100],
	BLUEBERRY: [0, -0.7, 100, 101.4],
	ORANGE: [0, 0, 100, 100],
	LEMON: [0, -0.7, 100, 101.4],
	KIWI: [0, -0.7, 100, 101.4],
	PLUM: [0.7, -6.5, 98.6, 113],
	APPLE: [0, 0, 100, 100],
	BASKET: [0, 0, 100, 100],
};
const MOOD: Record<string, [boolean, number, number]> = {
	WATERMELON: [true, 16, -1.5],
	CHERRIES: [true, 40, -3],
	BLUEBERRY: [true, -14, 0],
	ORANGE: [false, 18, 0],
	LEMON: [true, 16, 0],
	KIWI: [true, 16, 0],
	PLUM: [true, 16, 0],
};
type Eye = {
	hull: string;
	top: number;
	bottom: number;
	left: number;
	right: number;
	white: string;
	lid: string;
	px: number;
	py: number;
	pr: number;
	pupil: string;
};
type Part = { src: string; x: number; y: number; w: number; h: number; cx: number; cy: number };
type Cheek = { cx: number; cy: number; rx: number; ry: number };
type Face = { base: string; brows: Part[]; mouth: Part | null; cheeks: Cheek[]; closed?: Part[] };
const EYE_DATA = EYES as unknown as Record<string, Eye[]>;
const FACE_DATA = FACES as unknown as Record<string, Face>;

const layout = (units: number): number[][] =>
	units === 1
		? [[0, 0, 1]]
		: units === 2
			? [
					[-7.3, 22, 0.55],
					[52.6, 22, 0.55],
				]
			: units === 3
				? [
						[25.5, -4, 0.49],
						[-6, 50, 0.49],
						[57, 50, 0.49],
					]
				: // 4–6 sit closer and larger than the DOM board's (it left a late-bonus tile a scatter
					// of tiny blobs): they touch or overlap, the lower row in front.
					units === 4
					? [
							[-8, -3, 0.54],
							[54, -3, 0.54],
							[-8, 42, 0.54],
							[54, 42, 0.54],
						]
					: units === 5
						? [
								[-9, -2, 0.46],
								[63, -2, 0.46],
								[27, 22, 0.46],
								[-9, 47, 0.46],
								[63, 47, 0.46],
							]
						: [
								[-12, 2, 0.44],
								[26, 2, 0.44],
								[64, 2, 0.44],
								[-12, 50, 0.44],
								[26, 50, 0.44],
								[64, 50, 0.44],
							];
const centre = ([x, y, s]: number[]) => [x + 50 * s, y + 50 * s];
const dist = (a: number[], b: number[]) => {
	const [ax, ay] = centre(a);
	const [bx, by] = centre(b);
	return Math.hypot(bx - ax, by - ay);
};
function pairing(old: number[][], next: number[][]) {
	let best: number[] = [];
	let bestCost = Infinity;
	const walk = (i: number, used: number[], cost: number) => {
		if (cost >= bestCost) return;
		if (i === old.length) return void ((best = [...used]), (bestCost = cost));
		for (let j = 0; j < next.length; j++) if (!used.includes(j)) walk(i + 1, [...used, j], cost + dist(old[i], next[j]));
	};
	walk(0, [], 0);
	return best;
}
type Daughter = { dx: number; dy: number; s: number; axis: number; split: boolean };
type Divide = { start: number; ms: number; big: number; from: Daughter[]; pop: { x: number; y: number; r: number } };
// Blob.svelte's division plan for a units increase.
function planDivide(prev: number, next: number, start: number, ms: number): Divide {
	const old = layout(prev);
	const fresh = layout(next);
	const pair = pairing(old, fresh);
	const born = fresh.map((_, j) => j).filter((j) => !pair.includes(j));
	const [bx, by] = born
		.map((j) => centre(fresh[j]))
		.reduce(([sx, sy], [x, y]) => [sx + x / born.length, sy + y / born.length], [0, 0]);
	const parent = old.reduce((a, b) => {
		const [ax, ay] = centre(a);
		const [cx, cy] = centre(b);
		return Math.hypot(cx - bx, cy - by) < Math.hypot(ax - bx, ay - by) ? b : a;
	});
	const [qx, qy] = centre(parent);
	const born0 = fresh[born[0] ?? 0];
	return {
		start,
		ms,
		big: Math.min(1, Math.max(0, (parent[2] / born0[2] - 1) / 0.8)),
		pop: { x: qx, y: qy, r: 50 * parent[2] },
		from: fresh.map((p, j) => {
			const i = pair.indexOf(j);
			const from = i >= 0 ? old[i] : parent;
			const split = from === parent;
			const [cx, cy] = centre(p);
			const [px, py] = centre(from);
			const still = Math.hypot(cx - px, cy - py) < 1;
			return {
				dx: px - cx,
				dy: py - cy,
				s: from[2] / p[2],
				axis: Math.atan2(still ? py - by : cy - py, still ? px - bx : cx - px),
				split,
			};
		}),
	};
}
// FNV-1a + avalanche over the DOM blob's uid, so phases match the DOM board's.
function seedOf(uid: string) {
	let h = 2166136261;
	for (const c of uid) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
	h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
	h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
	return (h ^ (h >>> 16)) >>> 0;
}

// ---- Motion tables (style.css / Blob.svelte keyframes) --------------------------------------

type TS = { tx: number; ty: number; sx: number; sy: number; r: number };
const ID: TS = { tx: 0, ty: 0, sx: 1, sy: 1, r: 0 };
const DEG = Math.PI / 180;
const C_SWELL0 = bezier(0.2, 0.8, 0.3, 1);
const C_SWELL70 = bezier(0.4, 0, 0.6, 1);
const C_APART0 = bezier(0.3, 0.6, 0.4, 1);
const C_APART26 = bezier(0.5, 0, 0.7, 0.4);
const C_APART46 = bezier(0.2, 0.8, 0.3, 1);
const C_SLIDE = bezier(0.45, 0, 0.3, 1);
const C_POP = bezier(0.3, 0, 0.6, 1);
const C_TEAR = bezier(0.2, 0.6, 0.35, 1);
const C_CHIP = bezier(0.25, 0.6, 0.5, 1);
const C_BURST = bezier(0.2, 0.7, 0.4, 1);
const IMPACT: Frame<TS>[] = [
	[0, ID],
	[0.16, { ...ID, sx: 1.22, sy: 0.76 }],
	[0.38, { ...ID, ty: -0.07 * CELL_H, sx: 0.9, sy: 1.12 }],
	[0.58, { ...ID, sx: 1.08, sy: 0.93 }],
	[0.76, { ...ID, ty: -0.015 * CELL_H, sx: 0.98, sy: 1.03 }],
	[1, ID],
];
const POP: Frame<{ s: number; r: number; a: number }>[] = [
	[0, { s: 1, r: 0, a: 1 }],
	[0.32, { s: 1.24, r: 0, a: 1 }],
	[1, { s: 0, r: 12 * DEG, a: 0 }],
];
const SHIVER: Frame<TS>[] = [
	[0, { tx: -0.8, ty: -3, sx: 1, sy: 1, r: -1.2 * DEG }],
	[0.5, { tx: 0.8, ty: -3.4, sx: 1, sy: 1, r: 1.2 * DEG }],
	[1, { tx: -0.8, ty: -3, sx: 1, sy: 1, r: -1.2 * DEG }],
];
const SIGH: Frame<TS>[] = [
	[0, ID],
	[0.22, { ...ID, ty: -0.04 * BOX, sx: 0.95, sy: 1.07 }],
	[0.3, { ...ID, ty: -0.04 * BOX, sx: 0.95, sy: 1.07 }],
	[0.6, { ...ID, ty: 0.01 * BOX, sx: 1.09, sy: 0.89 }],
	[0.78, { ...ID, sx: 0.98, sy: 1.03 }],
	[1, ID],
];
// The scatter tease's moods (App's `mood`): while a column is held back the blobs wonder if an
// egg is coming, their eyes on the spinning column; an egg landing there gets a happy surprise: a
// startled hop with wide eyes and brows up, then a squinting grin (the joy arcs) as it settles.
// The watched spot runs down the teased column with the passing blobs and flicks back up
// (WATCH_MS a sweep), so every eye on the board follows the reel together.
const WATCH_MS = 760;
function wonderGaze(col: number, fromCol: number, fromRow: number, el: number) {
	const p = (el % WATCH_MS) / WATCH_MS;
	const top = cellY(0) + CELL_H * 0.4;
	const bottom = cellY(N - 1) + CELL_H * 0.6;
	const k = p < 0.78 ? EASE_IN_OUT(p / 0.78) : 1 - EASE_IN_OUT((p - 0.78) / 0.22);
	const dx = cellX(col) - cellX(fromCol);
	// Mostly sideways at the reel: the sweep only nods the gaze (a full-height vector would
	// read as looking up or down).
	const dy = (top + (bottom - top) * k - (cellY(fromRow) + CELL_H / 2)) * 0.3;
	const len = Math.hypot(dx, dy) || 1;
	return { x: dx / len, y: dy / len };
}
const SURPRISE_HOP: Frame<TS>[] = [
	[0, ID],
	[0.12, { ...ID, ty: -0.13 * BOX, sx: 0.92, sy: 1.1 }],
	[0.3, { ...ID, sx: 1.1, sy: 0.9 }],
	[0.45, { ...ID, ty: -0.05 * BOX, sx: 0.97, sy: 1.04 }],
	[0.6, { ...ID, sx: 1.04, sy: 0.97 }],
	[1, ID],
];
// Surprise (wide eyes, brows up, mouth open) peaks fast; the grin takes over from 45%.
const SURPRISE_FACE: Frame<{ wide: number; grin: number }>[] = [
	[0, { wide: 0, grin: 0 }],
	[0.08, { wide: 1, grin: 0 }],
	[0.42, { wide: 1, grin: 0 }],
	[0.55, { wide: 0.35, grin: 1 }],
	[0.85, { wide: 0.2, grin: 1 }],
	[1, { wide: 0, grin: 0 }],
];
// Idle breath (Blob.svelte's blob-breathe): a slow inhale, taller and narrower with the chest
// up off the feet, a short hold, a sigh out that settles a touch wide, then rest.
const BREATH: Frame<TS>[] = [
	[0, ID],
	[0.4, { ...ID, ty: -0.012 * BOX, sx: 0.972, sy: 1.04 }],
	[0.5, { ...ID, ty: -0.012 * BOX, sx: 0.972, sy: 1.04 }],
	[0.78, { ...ID, sx: 1.015, sy: 0.988 }],
	[1, ID],
];
const BLINK: Frame<{ v: number }>[] = [
	[0, { v: 0 }],
	[0.91, { v: 0 }],
	[0.94, { v: 1 }],
	[0.955, { v: 1 }],
	[1, { v: 0 }],
];
const RELIEF_LID: Frame<{ v: number }>[] = [
	[0, { v: 0 }],
	[0.24, { v: 0 }],
	[0.34, { v: 1 }],
	[0.82, { v: 1 }],
	[0.92, { v: 0 }],
	[1, { v: 0 }],
];
const LOOK: Frame<{ x: number; y: number }>[] = [
	[0, { x: 0, y: 0 }],
	[0.24, { x: 0, y: 0 }],
	[0.3, { x: -1, y: 1 }],
	[0.46, { x: -1, y: 1 }],
	[0.54, { x: 1, y: -0.5 }],
	[0.72, { x: 1, y: -0.5 }],
	[0.8, { x: 0, y: 0 }],
	[1, { x: 0, y: 0 }],
];
// tilt = -1 for the left brow, +1 for the right; r is multiplied by it.
const RELIEF_BROW: Frame<{ ty: number; r: number }>[] = [
	[0, { ty: 0, r: 0 }],
	[0.22, { ty: -2, r: 0 }],
	[0.5, { ty: 1, r: -6 * DEG }],
	[0.8, { ty: 1, r: -6 * DEG }],
	[1, { ty: 0, r: 0 }],
];
const RELIEF_MOUTH: Frame<{ sx: number; sy: number }>[] = [
	[0, { sx: 1, sy: 1 }],
	[0.22, { sx: 0.8, sy: 1.3 }],
	[0.3, { sx: 0.8, sy: 1.3 }],
	[0.56, { sx: 1.18, sy: 0.78 }],
	[0.72, { sx: 1.18, sy: 0.78 }],
	[1, { sx: 1, sy: 1 }],
];
const swellFrames = (B: number): Frame<{ sx: number; sy: number }>[] => [
	[0, { sx: 1, sy: 1 }, C_SWELL0],
	[0.3, { sx: 1.24 - 0.04 * B, sy: 1.18 + 0.02 * B }],
	[0.45, { sx: 1.2, sy: 1.22 - 0.02 * B }],
	[0.7, { sx: 1.18 + 0.02 * B, sy: 1.18 + 0.02 * B }, C_SWELL70],
	[0.84, { sx: 0.93 + 0.04 * B, sy: 1.05 - 0.08 * B }],
	[0.93, { sx: 1.03 - 0.02 * B, sy: 0.98 + 0.03 * B }],
	[1, { sx: 1, sy: 1 }],
];
// Daughter keyframes: t = share of (dx, dy), s = uniform scale, k = how much of the split
// axis the stretch has turned to (CSS interpolates the rotate() itself), a/b = the stretch.
type DK = { t: number; s: number; k: number; a: number; b: number };
const apartFrames = (B: number, ds: number): Frame<DK>[] => [
	[0, { t: 1, s: ds, k: 0, a: 1, b: 1 }, C_APART0],
	[0.26, { t: 1, s: ds, k: 1, a: 1.22 - 0.16 * B, b: 0.84 + 0.13 * B }, C_APART26],
	[0.46, { t: 0.62 - 0.07 * B, s: ds * (0.92 - 0.12 * B), k: 1, a: 1.5 - 0.5 * B, b: 0.7 + 0.3 * B }, C_APART46],
	[0.62, { t: -0.14 + 0.08 * B, s: 1 + 0.04 * B, k: 1, a: 0.78 + 0.22 * B, b: 1.2 - 0.2 * B }],
	[0.76, { t: 0.05, s: 1 - 0.02 * B, k: 1, a: 1.08 - 0.08 * B, b: 0.94 + 0.06 * B }],
	[0.88, { t: 0, s: 1, k: 1, a: 0.97 + 0.03 * B, b: 1.03 - 0.03 * B }],
	[1, { t: 0, s: 1, k: 0, a: 1, b: 1 }],
];
const slideFrames = (ds: number): Frame<DK>[] => [
	[0, { t: 1, s: ds, k: 0, a: 1, b: 1 }, C_SLIDE],
	[0.3, { t: 1, s: ds, k: 0, a: 1, b: 1 }, C_SLIDE],
	[0.7, { t: -0.04, s: 1, k: 0, a: 1, b: 1 }],
	[1, { t: 0, s: 1, k: 0, a: 1, b: 1 }],
];
const RING_OP: Frame<{ v: number }>[] = [
	[0, { v: 0 }],
	[0.44, { v: 0 }],
	[0.5, { v: 0.95 }],
	[0.8, { v: 0 }],
	[1, { v: 0 }],
];
const RING_S: Frame<{ v: number }>[] = [
	[0, { v: 0.4 }],
	[0.44, { v: 0.4 }],
	[0.8, { v: 1.9 }],
	[1, { v: 1.9 }],
];
const DROP_OP: Frame<{ v: number }>[] = [
	[0, { v: 0 }],
	[0.46, { v: 0 }],
	[0.52, { v: 1 }],
	[0.82, { v: 0 }],
	[1, { v: 0 }],
];
const DROP_T: Frame<{ x: number; s: number }>[] = [
	[0, { x: 0, s: 0.5 }],
	[0.46, { x: 0, s: 0.5 }],
	[0.82, { x: 1, s: 1 }],
	[1, { x: 1, s: 1 }],
];
const CHARGE: Frame<{ a: number; s: number }>[] = [
	[0, { a: 0, s: 0.2 }],
	[0.06, { a: 0, s: 0.2 }],
	[0.18, { a: 0.7, s: 0.7 }],
	[0.22, { a: 0.45, s: 0.75 }],
	[0.27, { a: 1, s: 1.05 }],
	[0.31, { a: 1, s: 1.5 }],
	[0.42, { a: 0, s: 0.6 }],
	[1, { a: 0, s: 0.6 }],
];
const BURST: Frame<{ a: number; s: number; w: number }>[] = [
	[0, { a: 0, s: 0.3, w: 2.4 }],
	[0.29, { a: 0, s: 0.3, w: 2.4 }],
	[0.31, { a: 1, s: 0.6, w: 2.4 }],
	[0.58, { a: 0, s: 7, w: 0.4 }],
	[1, { a: 0, s: 7, w: 0.4 }],
];
const SEAM: [number, number][] = [
	[0, 0xffffff],
	[0.32, 0xffffff],
	[0.7, 0xffd2f7],
	[1, 0xff6ef0],
];

const lerpColor = (a: number, b: number, k: number) => {
	const ch = (s: number) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * k);
	return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};
// Phase 0..1 of an infinite CSS animation with a (negative) delay.
const cycle = (now: number, periodMs: number, delayMs: number) => {
	const t = (now - delayMs) / periodMs;
	return t - Math.floor(t);
};

// ---- Shapes -------------------------------------------------------------------------------

export const parsePts = (s: string): Pt[] => s.split(/\s+/).map((p) => p.split(',').map(Number) as Pt);
// Monotone-chain convex hull, counter-clockwise in y-down screen terms (positive cross).
export function convex(pts: Pt[]): Pt[] {
	const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
	const lower: Pt[] = [];
	for (const q of p) {
		while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
		lower.push(q);
	}
	const upper: Pt[] = [];
	for (const q of [...p].reverse()) {
		while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
		upper.push(q);
	}
	return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
// Sutherland–Hodgman against a convex clip polygon (as built by convex()).
export function clipConvex(subject: Pt[], clip: Pt[]): Pt[] {
	let out = subject;
	for (let i = 0; i < clip.length && out.length; i++) {
		const a = clip[i];
		const b = clip[(i + 1) % clip.length];
		const inside = (p: Pt) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0;
		const cut = (p: Pt, q: Pt): Pt => {
			const d1 = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
			const d2 = (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]);
			const k = d1 / (d1 - d2);
			return [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
		};
		const input = out;
		out = [];
		for (let j = 0; j < input.length; j++) {
			const p = input[j];
			const q = input[(j + 1) % input.length];
			if (inside(p)) {
				out.push(p);
				if (!inside(q)) out.push(cut(p, q));
			} else if (inside(q)) out.push(cut(p, q));
		}
	}
	return out;
}
export const circlePts = (cx: number, cy: number, r: number, n = 28): Pt[] =>
	Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * r, cy + Math.sin((i / n) * Math.PI * 2) * r]);
// A polyline cut where it first leaves the pad (the DOM cell clips the crack the same way).
function clipToCell(pts: Pt[]): Pt[] {
	const inside = ([x, y]: Pt) => x >= CLIP.x0 && x <= CLIP.x1 && y >= CLIP.y0 && y <= CLIP.y1;
	const out: Pt[] = [pts[0]];
	for (let i = 1; i < pts.length; i++) {
		const p = pts[i - 1];
		const q = pts[i];
		if (inside(q)) {
			out.push(q);
			continue;
		}
		let k = 1;
		const [dx, dy] = [q[0] - p[0], q[1] - p[1]];
		if (dx > 0 && q[0] > CLIP.x1) k = Math.min(k, (CLIP.x1 - p[0]) / dx);
		if (dx < 0 && q[0] < CLIP.x0) k = Math.min(k, (CLIP.x0 - p[0]) / dx);
		if (dy > 0 && q[1] > CLIP.y1) k = Math.min(k, (CLIP.y1 - p[1]) / dy);
		if (dy < 0 && q[1] < CLIP.y0) k = Math.min(k, (CLIP.y0 - p[1]) / dy);
		out.push([p[0] + dx * k, p[1] + dy * k]);
		break;
	}
	return out;
}
export const flat = (pts: Pt[]) => pts.flatMap(([x, y]) => [x, y]);

// ---- Canvas-drawn textures ----------------------------------------------------------------

const TEX_RES = 3;
function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
	const c = document.createElement('canvas');
	c.width = Math.ceil(w * TEX_RES);
	c.height = Math.ceil(h * TEX_RES);
	const ctx = c.getContext('2d')!;
	ctx.scale(TEX_RES, TEX_RES);
	draw(ctx);
	return Texture.from(c);
}
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	ctx.beginPath();
	ctx.roundRect(x, y, w, h, r);
}
// Pad textures, the CSS cells: #4b3981 (#5a4596 split) with the depth gradient and a top
// highlight, the scatter's inset gold glow, and the lit pad with its pink outer glow.
const GLOW = 26;
// The veil over the pads a win passes by: enough to lift the winners, light enough that the
// rest of the board stays in colour (0.5 turned a busy bonus board grey).
const VEIL = 0.32;
type PadKind = 'pad' | 'split' | 'scatter' | 'split-scatter' | 'lit';
function padTexture(kind: PadKind) {
	const lit = kind === 'lit';
	const m = lit ? GLOW : 0;
	return canvasTexture(CELL_W + 2 * m, CELL_H + 2 * m, (ctx) => {
		ctx.translate(m, m);
		const B = 1.074;
		const R = 8;
		if (lit) {
			// box-shadow 0 0 16px 3px #f782fe: the spread rect, blurred, drawn off-canvas so only
			// its shadow lands. Shadow blur and offset ignore the context's scale: device pixels.
			ctx.save();
			ctx.shadowColor = '#f782fe';
			ctx.shadowBlur = 16 * TEX_RES;
			ctx.shadowOffsetX = 4000 * TEX_RES;
			rrect(ctx, -3 - 4000, -3, CELL_W + 6, CELL_H + 6, R + 3);
			ctx.fill();
			ctx.restore();
		}
		rrect(ctx, 0, 0, CELL_W, CELL_H, R);
		ctx.fillStyle = lit ? '#6a4cc0' : kind.startsWith('split') ? '#5a4596' : '#4b3981';
		ctx.fill();
		if (!lit) {
			const g = ctx.createLinearGradient(0, 0, 0, CELL_H);
			g.addColorStop(0, '#ffffff1f');
			g.addColorStop(0.4, '#ffffff00');
			g.addColorStop(1, '#00000033');
			ctx.fillStyle = g;
			ctx.fill();
		}
		// Border.
		rrect(ctx, B / 2, B / 2, CELL_W - B, CELL_H - B, R - B / 2);
		ctx.lineWidth = B;
		ctx.strokeStyle = '#22257c';
		ctx.stroke();
		// Inside the border (the CSS padding box).
		ctx.save();
		rrect(ctx, B, B, CELL_W - 2 * B, CELL_H - 2 * B, R - B);
		ctx.clip();
		if (lit) {
			rrect(ctx, B + 1, B + 1, CELL_W - 2 * B - 2, CELL_H - 2 * B - 2, R - B - 1);
			ctx.lineWidth = 2;
			ctx.strokeStyle = '#fece06';
			ctx.stroke();
		} else if (kind.endsWith('scatter')) {
			// inset 0 0 9px #fece06: a frame round the hole casts its shadow inward.
			ctx.shadowColor = '#fece06';
			ctx.shadowBlur = 9 * TEX_RES;
			ctx.beginPath();
			ctx.rect(-50, -50, CELL_W + 100, CELL_H + 100);
			ctx.roundRect(B, B, CELL_W - 2 * B, CELL_H - 2 * B, R - B);
			ctx.fillStyle = '#fece06';
			ctx.fill('evenodd');
		} else {
			// A lit top lip and a shaded foot: the pad reads as a socket, not a flat tile.
			ctx.fillStyle = '#ffffff2e';
			ctx.fillRect(0, B, CELL_W, 1.5);
			ctx.fillStyle = '#00000030';
			ctx.fillRect(0, CELL_H - B - 2, CELL_W, 2);
		}
		ctx.restore();
	});
}
// A split tile wears its fruit's colour over the pad, deeper the more it has split, so a
// late-bonus board reads as patches of colour rather than 49 crowds of small blobs. Sampled
// from the symbol art (mean of its saturated pixels; APPLE and PLUM by eye, being pale).
const TINT: Record<string, string> = {
	WATERMELON: '#5ee357',
	CHERRIES: '#f62d30',
	GRAPES: '#c457f5',
	STRAWBERRY: '#f96db2',
	BLUEBERRY: '#2ca6f8',
	ORANGE: '#fb9e24',
	LEMON: '#faca36',
	KIWI: '#24d8cc',
	PLUM: '#a9a6e6',
	APPLE: '#f2d58c',
};
const tintAlpha = (units: number) => 0.14 + 0.035 * (units - 2);
/** The pad's inside, white, lighter towards the foot: tinted per cell. */
function tintTexture() {
	return canvasTexture(CELL_W, CELL_H, (ctx) => {
		const B = 1.074;
		rrect(ctx, B, B, CELL_W - 2 * B, CELL_H - 2 * B, 8 - B);
		const g = ctx.createLinearGradient(0, 0, 0, CELL_H);
		g.addColorStop(0, '#fff');
		g.addColorStop(1, 'rgba(255,255,255,.55)');
		ctx.fillStyle = g;
		ctx.fill();
	});
}
// The board's rim (style.css .board.moving clips there while blobs are in the air): blobs
// falling in fade up through it instead of being cut by it, and the old board's copy fades
// out through the bottom one. An opaque black→white strip: the mask filter reads red × alpha.
function rimTexture(from: number, to: number, top: number, bottom: number) {
	const c = document.createElement('canvas');
	c.width = 1;
	c.height = Math.ceil(bottom - top);
	const ctx = c.getContext('2d')!;
	const g = ctx.createLinearGradient(0, from - top, 0, to - top);
	g.addColorStop(0, '#000');
	g.addColorStop(1, '#fff');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, 1, c.height);
	return Texture.from(c);
}
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
function radialTexture(stops: [number, string][]) {
	return canvasTexture(64 / TEX_RES, 64 / TEX_RES, (ctx) => {
		const r = 32 / TEX_RES;
		const g = ctx.createRadialGradient(r, r, 0, r, r, r);
		for (const [o, c] of stops) g.addColorStop(o, c);
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 2 * r, 2 * r);
	});
}

// ---- Blob view ------------------------------------------------------------------------------

/** Every blob texture (symbols + face parts), mipmapped so small blobs stay clean. Shared by
 *  the board and the scene's peeking blobs (Assets caches them, so a second call is free). */
export async function loadBlobTextures() {
	const srcs = new Set<string>();
	for (const s of Object.keys(ART)) srcs.add(`./symbols/${s}.webp`);
	for (const f of Object.values(FACE_DATA)) {
		srcs.add(f.base);
		for (const p of [...f.brows, ...(f.closed ?? []), ...(f.mouth ? [f.mouth] : [])]) srcs.add(p.src);
	}
	const out = new Map<string, Texture>();
	await Promise.all(
		[...srcs].map(async (src) => {
			out.set(src, await Assets.load<Texture>({ src, data: { autoGenerateMipmaps: true, scaleMode: 'linear' } }));
		}),
	);
	return out;
}
export const blushTexture = () =>
	radialTexture([
		[0, 'rgba(255,255,255,.8)'],
		[0.45, 'rgba(255,255,255,.45)'],
		[1, 'rgba(255,255,255,0)'],
	]);

/** Where a BlobView's 100-unit art box sits relative to its root (the pad's centre-bottom). */
export const BLOB_BOX = { x: -BOX / 2, y: BOX_Y - CELL_H, size: BOX };
export type BlobMode = {
	now: number;
	scared: number | null;
	mild?: boolean;
	relief: { start: number; ms: number } | null;
	lit: number | null;
	reduced: boolean;
	/** Wondering about the teased column: the unit vector from this blob to the spot it is
	 *  watching in that column (wonderGaze), and since when. */
	wonder?: { x: number; y: number; since: number } | null;
	/** A happy surprise (an egg landed in the teased column) started at this time. */
	surprise?: number | null;
};
type EyeView = { e: Eye; clip: Pt[]; pupil: SharedGraphics; lid: Container; joy: Container; lx: number; ly: number; last: number };

// A winner cheers on its bounce (the lit body hops every 960ms, top of the hop at 480ms): the
// eyes squeeze into happy ^^ arcs over the top and open wide, looking up, on the ground.
const HOP_MS = 480;
const cheer = (now: number, lit: number) => {
	const c = ((now - lit) / HOP_MS) % 2;
	return EASE_IN_OUT(Math.min(1, Math.max(0, (0.45 - Math.abs(c - 1)) / 0.2)));
};

// A pupil's clipped circle + highlight at each offset, built once per eye shape and shared by
// every blob wearing that eye: a glance swaps contexts instead of re-clipping two circles per
// eye per frame. Offsets snap to 0.1 eye units (~0.08 CSS px on the board); the LOOK paths
// reach ~250 offsets an eye, so the cap is only a backstop.
// One cache per view (keyed by its texture lookup): pixi builds a context's GPU batches only in
// the first renderer that draws it after a change, so a context shared between the board's and
// the scene's renderers would draw empty in the second one.
const PUPIL_Q = 10;
const PUPIL_CAP = 600;
const pupilCaches = new WeakMap<object, WeakMap<Eye, Map<number, GraphicsContext>>>();
function drawPupil(g: GraphicsContext, e: Eye, clip: Pt[], cx: number, cy: number, s: number) {
	const body = clipConvex(circlePts(cx, cy, e.pr * 1.3 * s), clip);
	if (body.length > 2) g.poly(flat(body), true).fill(e.pupil);
	const hi = clipConvex(circlePts(cx + e.pr * 0.42 * s, cy - e.pr * 0.42 * s, e.pr * 0.34 * s, 14), clip);
	if (hi.length > 2) g.poly(flat(hi), true).fill('#fff');
}
type FacePart = { outer: Container; tilt: number; part: Part };
type DaughterView = { anim: Container; parts: DaughterParts };
type DaughterParts = {
	eyes: EyeView[];
	blush: Sprite[];
	brows: FacePart[];
	mouth: FacePart | null;
	closed: Sprite[];
	open: { c: Container; pupil: Container; part: Part }[];
};

export class BlobView {
	root = new Container();
	private body = new Container();
	private divBody = new Container();
	private daughters: DaughterView[] = [];
	private ring: Graphics | null = null;
	private drops: Graphics[] = [];
	private divide: Divide | null = null;
	get dividing() {
		return this.divide != null;
	}
	/** Skip to the end of the division (the next tick lands it). */
	rushDivide(now: number) {
		if (this.divide) this.divide.start = Math.min(this.divide.start, now - this.divide.ms);
	}
	readonly breathe: number;
	readonly breatheDelay: number;
	readonly lookDelay: number;
	readonly blinkDelay: number;
	readonly reliefDelay: number;

	constructor(
		private tex: (src: string) => Texture,
		private blushTex: Texture,
		readonly symbol: string,
		readonly units: number,
		uid: string,
		divide: Divide | null = null,
	) {
		const seed = seedOf(uid);
		this.lookDelay = -((seed % 97) / 97) * 5600;
		this.blinkDelay = -(((seed >>> 7) % 89) / 89) * 4400;
		this.breathe = (2.8 + ((seed >>> 3) % 10) * 0.1) * 1000;
		this.breatheDelay = Math.round(-((seed >>> 11) % 997) / 997 * 370) * 10;
		this.reliefDelay = Math.round(((seed >>> 17) % 101) * 2.2);
		// The sym origin is the pad's centre-bottom; the art box is centred in the pad.
		this.body.pivot.set(50, 92);
		this.body.position.set(-BOX / 2 + 50 * U, BOX_Y - CELL_H + 92 * U);
		this.body.scale.set(U);
		this.divBody.pivot.set(50, 60);
		this.divBody.position.set(50, 60);
		this.root.addChild(this.body);
		this.body.addChild(this.divBody);
		this.build(divide);
	}

	private build(divide: Divide | null) {
		const { symbol, units } = this;
		const art = ART[symbol] ?? ART.ORANGE;
		const face = units <= 2 ? FACE_DATA[symbol] : undefined;
		const eyes = units <= 2 ? (EYE_DATA[symbol] ?? []) : [];
		const mood = MOOD[symbol];
		this.divide = divide;
		for (const [x, y, s] of layout(units)) {
			const anim = new Container();
			const place = new Container();
			place.position.set(x, y);
			place.scale.set(s);
			const a = new Container();
			a.position.set(art[0], art[1]);
			a.scale.set(art[2] / 100, art[3] / 100);
			anim.addChild(place);
			place.addChild(a);
			this.divBody.addChild(anim);
			const base = new Sprite(this.tex(face?.base ?? `./symbols/${symbol}.webp`));
			base.width = 100;
			base.height = 100;
			a.addChild(base);
			const parts: DaughterParts = { eyes: [], blush: [], brows: [], mouth: null, closed: [], open: [] };
			for (const c of face?.cheeks ?? []) {
				const b = new Sprite(this.blushTex);
				b.anchor.set(0.5);
				b.position.set(c.cx, c.cy);
				b.width = c.rx * 3;
				b.height = c.ry * 2.5;
				a.addChild(b);
				parts.blush.push(b);
			}
			for (const e of eyes) {
				const hull = parsePts(e.hull);
				const unit = (e.right - e.left) / 16;
				const white = new Graphics().poly(flat(hull), true).fill(e.white);
				const pupil = new SharedGraphics();
				const lid = new Container();
				const lidG = new Graphics()
					.poly(flat(hull), true)
					.fill(e.lid)
					.stroke({ width: 3.2 * unit, color: e.lid, join: 'round' })
					.moveTo(e.left + 0.5 * unit, (e.top + e.bottom) / 2)
					.quadraticCurveTo((e.left + e.right) / 2, e.bottom + 1.5 * unit, e.right - 0.5 * unit, (e.top + e.bottom) / 2)
					.stroke({ width: 1.5 * unit, color: e.pupil, cap: 'round' });
				// transform-origin 50% 0 of the lid's box: the top of the eye.
				const hx = (e.left + e.right) / 2;
				lid.pivot.set(hx, e.top);
				lid.position.set(hx, e.top);
				lid.addChild(lidG);
				// The ^^ squint: a body-coloured cover with an arc bowed up, squeezed from the eye's middle.
				const my = (e.top + e.bottom) / 2;
				const joy = new Container();
				joy.pivot.set(hx, my);
				joy.position.set(hx, my);
				joy.visible = false;
				joy.addChild(
					new Graphics()
						.poly(flat(hull), true)
						.fill(e.lid)
						.stroke({ width: 3.2 * unit, color: e.lid, join: 'round' })
						.moveTo(e.left + 0.8 * unit, my + 1.4 * unit)
						.quadraticCurveTo(hx, e.top - 1.8 * unit, e.right - 0.8 * unit, my + 1.4 * unit)
						.stroke({ width: 1.6 * unit, color: e.pupil, cap: 'round' }),
				);
				a.addChild(white, pupil, lid, joy);
				parts.eyes.push({
					e,
					clip: convex(hull),
					pupil,
					lid,
					joy,
					lx: ((e.right - e.left) / 2 - e.pr * 1.3) * 0.5,
					ly: ((e.bottom - e.top) / 2 - e.pr * 1.3) * 0.3,
					last: NaN,
				});
			}
			if (face) {
				// GRAPES' painted-shut eyes, with open eyes drawn over them.
				for (const c of face.closed ?? []) {
					const sp = new Sprite(this.tex(c.src));
					sp.position.set(c.x, c.y);
					sp.width = c.w;
					sp.height = c.h;
					a.addChild(sp);
					parts.closed.push(sp);
					const o = new Container();
					const ox = c.x + c.w / 2;
					const oy = c.y + c.h * 0.7;
					o.pivot.set(ox, oy);
					o.position.set(ox, oy);
					o.addChild(
						new Graphics()
							.ellipse(ox, oy, c.w * 0.42, c.w * 0.47)
							.fill('#fff')
							.stroke({ width: 0.8, color: '#6d27a8', alpha: 0.35 }),
					);
					const pu = new Container();
					const pcx = c.x + c.w / 2;
					const pcy = c.y + c.h * 0.78;
					pu.pivot.set(pcx, pcy);
					pu.position.set(pcx, pcy);
					pu.addChild(
						new Graphics()
							.circle(pcx, pcy, c.w * 0.21)
							.fill('#2b1140')
							.circle(c.x + c.w * 0.56, c.y + c.h * 0.66, c.w * 0.07)
							.fill('#fff'),
					);
					o.addChild(pu);
					a.addChild(o);
					parts.open.push({ c: o, pupil: pu, part: c });
				}
				face.brows.forEach((b, j) => {
					const outer = new Container();
					outer.pivot.set(b.cx, b.cy);
					outer.position.set(b.cx, b.cy);
					const m = new Container();
					if (mood) {
						m.pivot.set(b.cx, b.cy);
						m.position.set(b.cx, b.cy + mood[2]);
						m.rotation = (j ? 1 : -1) * mood[1] * DEG;
					}
					const sp = new Sprite(this.tex(b.src));
					sp.position.set(b.x, b.y);
					sp.width = b.w;
					sp.height = b.h;
					m.addChild(sp);
					outer.addChild(m);
					a.addChild(outer);
					parts.brows.push({ outer, tilt: j ? 1 : -1, part: b });
				});
				if (face.mouth) {
					const mo = face.mouth;
					const outer = new Container();
					outer.pivot.set(mo.cx, mo.y);
					outer.position.set(mo.cx, mo.y);
					const m = new Container();
					if (mood?.[0]) {
						m.position.set(0, 2 * mo.y + mo.h);
						m.scale.set(1, -1);
					}
					const sp = new Sprite(this.tex(mo.src));
					sp.position.set(mo.x, mo.y);
					sp.width = mo.w;
					sp.height = mo.h;
					m.addChild(sp);
					outer.addChild(m);
					a.addChild(outer);
					parts.mouth = { outer, tilt: 0, part: mo };
				}
				// GRAPES' drawn-open eyes go over the mouth: its sprite's top corner reaches under
				// the right eye's white (the painted ^^ it was cut for sat clear of it).
				for (const o of parts.open) a.addChild(o.c);
			}
			this.daughters.push({ anim, parts });
		}
		if (divide) {
			const q = divide.pop;
			this.ring = new Graphics().circle(0, 0, q.r * 0.55).stroke({ width: 3, color: '#fff' });
			this.ring.position.set(q.x, q.y);
			this.divBody.addChild(this.ring);
			for (let k = 0; k < 6; k++) {
				const d = new Graphics().circle(0, 0, 2.4).fill('#fff');
				this.divBody.addChild(d);
				this.drops.push(d);
			}
		}
	}

	tick(m: BlobMode) {
		const { now } = m;
		// Body: surprise hop > relief sigh > win bounce > fright shiver > idle breath (the CSS
		// cascade). Wondering only moves the eyes (tickFace).
		const sp = m.surprise != null && !m.reduced ? (now - m.surprise) / SURPRISE_MS : -1;
		const surprised = sp >= 0 && sp < 1 && m.lit == null;
		let t: TS = ID;
		if (m.reduced) t = ID;
		else if (surprised) t = keyframes(SURPRISE_HOP, sp, EASE_IN_OUT);
		else if (m.relief && m.lit == null) {
			const p = progress(now, m.relief.start, this.reliefDelay, m.relief.ms);
			t = p < 0 ? ID : keyframes(SIGH, p, EASE_IN_OUT);
		} else if (m.lit != null) {
			const c = (now - m.lit) / 480;
			const n = Math.floor(c);
			const f = EASE_IN_OUT(n % 2 ? 1 - (c - n) : c - n);
			t = { tx: 0, ty: 1 - 10 * f, sx: 1.04 - 0.07 * f, sy: 0.95 + 0.1 * f, r: 0 };
		} else if (m.scared != null) {
			const v = keyframes(SHIVER, cycle(now, m.mild ? 170 : 110, 0), LINEAR);
			// Nervous: a third of the fright's shiver.
			t = m.mild ? { tx: v.tx * 0.35, ty: v.ty * 0.33, sx: 1, sy: 1, r: v.r * 0.33 } : v;
		} else t = keyframes(BREATH, cycle(now, this.breathe, this.breatheDelay), EASE_IN_OUT);
		this.body.position.set(-BOX / 2 + 50 * U + t.tx, BOX_Y - CELL_H + 92 * U + t.ty);
		this.body.scale.set(U * t.sx, U * t.sy);
		this.body.rotation = t.r;

		this.tickDivide(now, m.reduced);
		const relief = m.relief && m.lit == null && !surprised ? m.relief : null;
		const rp = relief ? progress(now, relief.start, this.reliefDelay, relief.ms) : -1;
		const scaredMs = m.scared != null ? now - m.scared : 0;
		for (const d of this.daughters) this.tickFace(d.parts, now, m, rp, scaredMs);
	}

	private tickDivide(now: number, reduced: boolean) {
		const dv = this.divide;
		if (!dv) return;
		const p = reduced ? 1 : Math.min(1, Math.max(0, (now - dv.start) / dv.ms));
		const sw = keyframes(swellFrames(dv.big), p);
		this.divBody.scale.set(sw.sx, sw.sy);
		const lay = layout(this.units);
		this.daughters.forEach((d, j) => {
			const f = dv.from[j];
			const [cx, cy] = centre(lay[j]);
			const v = keyframes(f.split ? apartFrames(dv.big, f.s) : slideFrames(f.s), p);
			const rot = f.axis * v.k;
			const mx = new Matrix()
				.translate(-cx, -cy)
				.rotate(-rot)
				.scale(v.a, v.b)
				.rotate(rot)
				.scale(v.s, v.s)
				.translate(cx + f.dx * v.t, cy + f.dy * v.t);
			d.anim.setFromMatrix(mx);
		});
		if (this.ring) {
			this.ring.alpha = keyframes(RING_OP, p).v;
			this.ring.scale.set(keyframes(RING_S, p).v);
			this.drops.forEach((g, k) => {
				const a = ((k * 60 + 30) * Math.PI) / 180;
				const v = keyframes(DROP_T, p);
				g.alpha = keyframes(DROP_OP, p).v;
				g.position.set(dv.pop.x + Math.cos(a) * dv.pop.r * v.x, dv.pop.y + Math.sin(a) * dv.pop.r * v.x);
				g.scale.set(v.s);
			});
		}
		if (p >= 1) {
			this.divide = null;
			this.divBody.scale.set(1);
			for (const d of this.daughters) d.anim.setFromMatrix(new Matrix());
			this.ring?.destroy();
			this.ring = null;
			for (const g of this.drops) g.destroy();
			this.drops = [];
		}
	}

	private tickFace(f: DaughterParts, now: number, m: BlobMode, rp: number, scaredMs: number) {
		const scared = m.scared != null && !m.reduced;
		const relieving = rp >= 0;
		const cheering = m.lit != null && !m.reduced && !relieving;
		const sp = m.surprise != null && !m.reduced && m.lit == null ? (now - m.surprise) / SURPRISE_MS : -1;
		const sf = sp >= 0 && sp < 1 ? keyframes(SURPRISE_FACE, sp, EASE_IN_OUT) : null;
		const wonder = !sf && !scared && !cheering && !relieving && !m.reduced && m.wonder ? m.wonder : null;
		const wk = wonder ? EASE_OUT(Math.min(1, (now - wonder.since) / 350)) : 0;
		const joy = cheering ? cheer(now, m.lit!) : sf ? sf.grin : 0;
		for (const b of f.blush) b.alpha = scared ? 0 : 1;
		// Pupils: glance about, or a frightened dart (steps(2) over 160ms, shrunk to 70%).
		for (const ev of f.eyes) {
			let ox = 0;
			let oy = 0;
			let s = 1;
			if (scared) {
				s = 0.7;
				if (cycle(now, 160, 0) < 0.5) ox = -0.7;
				else oy = -0.2;
			} else if (cheering) {
				// Wide and looking up between the squints.
				s = 1.15;
				oy = -ev.ly;
			} else if (sf) {
				s = 1 + 0.25 * sf.wide;
				oy = -0.6 * ev.ly * sf.wide;
			} else if (wonder) {
				s = 1 + 0.15 * wk;
				// Following the spinning column (wonderGaze), out to the edge of the white: lx/ly
				// are only the idle glance's reach (half the room across, 30% down).
				ox = wonder.x * 1.9 * ev.lx * wk;
				// The art rests the pupils high in the white (by how much varies by blob): centre
				// them first, so the look reads as across at the reel rather than up.
				const level = (ev.e.top + ev.e.bottom) / 2 - ev.e.py;
				oy = (level + wonder.y * 1.6 * ev.ly) * wk;
			} else if (!m.reduced) {
				const k = keyframes(LOOK, cycle(now, 5600, this.lookDelay), EASE_IN_OUT);
				ox = k.x * ev.lx;
				oy = k.y * ev.ly;
			}
			const qx = Math.round(ox * PUPIL_Q);
			const qy = Math.round(oy * PUPIL_Q);
			const key = Math.round(s * 20) * 1e6 + (qx + 500) * 1000 + (qy + 500);
			if (key !== ev.last) {
				ev.last = key;
				const { e } = ev;
				let byEye = pupilCaches.get(this.tex);
				if (!byEye) pupilCaches.set(this.tex, (byEye = new WeakMap()));
				let cache = byEye.get(e);
				if (!cache) byEye.set(e, (cache = new Map()));
				let g = cache.get(key);
				if (!g) {
					const full = cache.size >= PUPIL_CAP;
					g = full ? ev.pupil.own.clear() : new GraphicsContext();
					drawPupil(g, e, ev.clip, e.px + qx / PUPIL_Q, e.py + qy / PUPIL_Q, s);
					if (!full) cache.set(key, g);
				}
				ev.pupil.context = g;
			}
			ev.joy.visible = joy > 0.001;
			ev.joy.scale.y = joy;
			if (scared || cheering || (sf && (sf.wide > 0.05 || sf.grin > 0.05))) ev.lid.alpha = 0;
			else {
				ev.lid.alpha = 1;
				const v = relieving
					? keyframes(RELIEF_LID, rp, EASE_IN_OUT).v
					: m.reduced || wonder
						? 0
						: keyframes(BLINK, cycle(now, 4400, this.blinkDelay), EASE_IN_OUT).v;
				ev.lid.scale.y = v;
				ev.lid.visible = v > 0.001;
			}
		}
		// GRAPES' drawn-open eyes over its painted ^^: they glance about like the others, and
		// shutting them shows the painted ^^ (a blink, a giggle every ~9s, the win squint).
		const shut = m.reduced
			? false
			: relieving ||
				(cheering && joy > 0.5) ||
				(sf != null && sf.grin > 0.5) ||
				(!scared &&
					!cheering &&
					!sf &&
					!wonder &&
					(keyframes(BLINK, cycle(now, 4400, this.blinkDelay), EASE_IN_OUT).v > 0.5 ||
						cycle(now, 9000, this.lookDelay) > 0.9));
		// The painted ^^ only while shut: its arc ends peek past the drawn whites otherwise.
		for (const sp of f.closed) sp.alpha = shut ? 1 : 0;
		for (const o of f.open) {
			o.c.alpha = shut ? 0 : 1;
			o.c.scale.y = scared ? 1.1 : 1;
			const { x, y, w, h } = o.part;
			let px = 0;
			let py = 0;
			let ps = 1;
			if (scared) {
				ps = 0.7;
				if (cycle(now, 160, 0) < 0.5) px = -0.7;
				else py = -0.2;
			} else if (cheering || (sf && sf.wide > 0.05)) {
				ps = 1.12;
				py = -0.12 * h;
			} else if (wonder) {
				px = wonder.x * 0.2 * w * wk;
				py = (wonder.y * 0.12 + 0.06) * h * wk;
			} else if (!m.reduced) {
				const g = keyframes(LOOK, cycle(now, 5600, this.lookDelay), EASE_IN_OUT);
				px = g.x * 0.11 * w;
				py = g.y * 0.08 * h;
			}
			o.pupil.scale.set(ps);
			o.pupil.position.set(x + w / 2 + px, y + h * 0.78 + py);
		}
		const fp = scared ? scaredMs : 0;
		for (const b of f.brows) {
			let ty = 0;
			let r = 0;
			if (relieving) {
				const v = keyframes(RELIEF_BROW, rp, EASE_IN_OUT);
				ty = v.ty;
				r = v.r * b.tilt;
			} else if (scared) {
				const k = EASE_OUT(Math.min(1, fp / 220));
				ty = -3.2 * k;
				r = b.tilt * 10 * DEG * k;
			} else if (sf) {
				ty = -3.6 * sf.wide - 1.2 * sf.grin;
			}
			b.outer.position.set(b.part.cx, b.part.cy + ty);
			b.outer.rotation = r;
		}
		if (f.mouth) {
			let sx = 1;
			let sy = 1;
			if (relieving) ({ sx, sy } = keyframes(RELIEF_MOUTH, rp, EASE_IN_OUT));
			else if (scared) {
				const k = EASE_OUT(Math.min(1, fp / 260));
				sx = 1 - 0.1 * k;
				sy = 1 + 0.6 * k;
			} else if (sf) {
				sx = 1 + 0.12 * sf.wide + 0.2 * sf.grin;
				sy = 1 + 0.7 * sf.wide + 0.15 * sf.grin;
			}
			f.mouth.outer.scale.set(sx, sy);
		}
	}

	destroy() {
		this.root.destroy(DISPOSE);
	}
}

// ---- Crack view -------------------------------------------------------------------------------

type TearDraw = { pts: Pt[]; at: number[]; full: number; s: number; t: number; w: number; closed: boolean };
class CrackView {
	root = new Container();
	fx = new Container();
	private halo = new Graphics();
	private body = new Graphics();
	private seam = new Graphics();
	private chips: { g: Graphics; c: ReturnType<typeof crackPlan>['chips'][number] }[] = [];
	private charges: Sprite[] = [];
	private bursts: Graphics[] = [];
	private tears: TearDraw[];
	private drawnDone = false;
	private fade = { from: 1, to: 1, start: 0, ms: 1 };
	private chargeSize: number;

	constructor(
		readonly units: number,
		seed: number,
		private start: number,
		private ms: number,
		chargeTex: Texture,
	) {
		this.chargeSize = chargeTex.width;
		const plan = crackPlan(units, seed);
		this.tears = plan.tears.map((c) => {
			// The cut keeps the taper of the whole tear: `at` is measured on the uncut line.
			const whole = prefix(c.pts, 1);
			const pts = c.closed ? c.pts : clipToCell(c.pts);
			const at = whole.at.slice(0, pts.length);
			if (!c.closed && pts.length > 1) {
				const last = pts[pts.length - 1];
				const orig = c.pts[pts.length - 1];
				if (last !== orig) {
					const a = whole.at[pts.length - 2];
					const b = whole.at[pts.length - 1];
					const p0 = pts[pts.length - 2];
					const seg = Math.hypot(orig[0] - p0[0], orig[1] - p0[1]) || 1;
					at[pts.length - 1] = a + ((b - a) * Math.hypot(last[0] - p0[0], last[1] - p0[1])) / seg;
				}
			}
			return { pts, at, full: at[at.length - 1], s: c.s, t: c.t, w: c.w, closed: c.closed };
		});
		this.root.addChild(this.halo, this.body, this.seam);
		for (const c of plan.chips) {
			const g = new Graphics().roundRect(-c.size / 2, -c.size * 0.375, c.size, c.size * 0.75, 0.3).fill(c.light ? '#8f78e0' : '#3a2a6e');
			g.position.set(c.x, c.y);
			g.visible = false;
			this.root.addChild(g);
			this.chips.push({ g, c });
		}
		for (const [x, y] of plan.junctions) {
			const ch = new Sprite(chargeTex);
			ch.anchor.set(0.5);
			ch.position.set(x, y);
			const bu = new Graphics();
			bu.position.set(x, y);
			this.fx.addChild(ch, bu);
			this.charges.push(ch);
			this.bursts.push(bu);
		}
	}

	// The tear's progress p (0..1 of the uncut length) as drawn geometry.
	private drawTears(ps: number[]) {
		this.halo.clear();
		this.body.clear();
		this.seam.clear();
		this.tears.forEach((c, i) => {
			const p = ps[i];
			if (p <= 0) return;
			let pts = c.pts;
			let at = c.at;
			if (p < c.full) {
				// Cut on the uncut line's length scale.
				const cut = prefix(c.pts, p / c.full);
				pts = cut.pts;
				at = cut.at.map((a) => a * c.full);
			}
			if (pts.length < 2) return;
			const end = c.closed ? c.w : c.w * 0.12;
			const W = (a: number, b: number) => [c.w * a, end * b] as const;
			this.halo.moveTo(pts[0][0], pts[0][1]);
			for (const q of pts.slice(1)) this.halo.lineTo(q[0], q[1]);
			if (c.closed && p >= c.full) this.halo.closePath();
			this.halo.stroke({ width: c.w * 2.4, color: '#f782fe', join: 'round', cap: 'butt' });
			const taper = (w0: number, w1: number, shift = 0) => sliver(pts, at, w0, w1, shift);
			const [g0, g1] = W(1, 1);
			this.body.poly(taper(g0, g1), true).fill('#12061f');
			const [l0, l1] = W(0.16, 0.25);
			this.body.poly(taper(l0, l1, -c.w * 0.6), true).fill({ color: '#c3b0ff', alpha: 0.55 });
			const [s0, s1] = W(0.5, 0.45);
			this.seam.poly(taper(s0, s1), true).fill('#fff');
		});
	}

	/** Skip to the end of the tear (the scar then settles as usual). */
	rush(now: number) {
		this.start = Math.min(this.start, now - this.ms);
	}

	tick(now: number, reduced: boolean, popped: boolean, removeMs: number, harvestDelay: number) {
		const D = this.ms;
		const el = reduced ? Infinity : now - this.start;
		if (!this.drawnDone) {
			const ps = this.tears.map((c) => {
				const p = progress(el, 0, c.s * D, c.t * D);
				return p < 0 ? 0 : C_TEAR(p) * c.full;
			});
			this.drawTears(ps);
			if (ps.every((p, i) => p >= this.tears[i].full)) this.drawnDone = true;
		}
		// Seam: white-hot as it tears, then pink.
		const sp = Math.min(1, Math.max(0, el / D));
		const k = EASE_OUT(sp);
		let col = SEAM[SEAM.length - 1][1];
		for (let i = 0; i < SEAM.length - 1; i++)
			if (k <= SEAM[i + 1][0]) {
				const [o0, c0] = SEAM[i];
				const [o1, c1] = SEAM[i + 1];
				col = lerpColor(c0, c1, o1 > o0 ? (k - o0) / (o1 - o0) : 1);
				break;
			}
		this.seam.tint = col;
		// Halo: .3, pulsing to .55 twice after the beat.
		const hp = (el - D) / 2600;
		this.halo.alpha = hp > 0 && hp < 2 ? 0.3 + 0.25 * EASE_IN_OUT(1 - Math.abs(1 - 2 * (hp - Math.floor(hp)))) : 0.3;
		// Settle to a faint scar after two beats; fade with the blobs when the tile is harvested.
		const settle = 1 - 0.65 * EASE_OUT(Math.min(1, Math.max(0, (el - 2 * D) / 900)));
		const target = popped ? 0 : 1;
		if (target !== this.fade.to) {
			const cur = this.popAlpha(now);
			this.fade = { from: cur, to: target, start: now + (popped ? harvestDelay : 0), ms: removeMs * 0.6 };
		}
		this.root.alpha = settle * this.popAlpha(now);
		// Chips jump out as the tear passes them.
		for (const { g, c } of this.chips) {
			const p = progress(el, 0, c.d * D, 0.42 * D);
			g.visible = p >= 0 && p < 1;
			if (!g.visible) continue;
			// translate 0 → (.7dx, .7dy − 5) at 55% → (dx, dy + 2); opacity holds to 55% then
			// fades; the spin has no 55% stop, so it runs the whole way.
			const v = keyframes(
				[
					[0, { x: 0, y: 0, a: 1 }],
					[0.55, { x: 0.7 * c.dx, y: 0.7 * c.dy - 5, a: 1 }],
					[1, { x: c.dx, y: c.dy + 2, a: 0 }],
				],
				p,
				C_CHIP,
			);
			g.position.set(c.x + v.x, c.y + v.y);
			g.rotation = c.r * DEG * C_CHIP(p);
			g.alpha = v.a;
		}
		const fp = Math.min(1, Math.max(0, el / D));
		this.charges.forEach((ch, i) => {
			const v = keyframes(CHARGE, fp, LINEAR);
			ch.alpha = v.a;
			ch.scale.set((18 / this.chargeSize) * v.s);
			const b = keyframes(BURST, fp, C_BURST);
			const bu = this.bursts[i];
			bu.alpha = b.a;
			if (b.a > 0.001) bu.clear().circle(0, 0, 5 * b.s).stroke({ width: b.w * b.s, color: '#fff' });
			else bu.clear();
		});
		this.fx.visible = fp < 1;
	}

	private popAlpha(now: number) {
		const f = this.fade;
		const p = Math.min(1, Math.max(0, (now - f.start) / f.ms));
		return f.from + (f.to - f.from) * EASE_OUT(p);
	}

	destroy() {
		this.root.destroy(DISPOSE);
		this.fx.destroy(DISPOSE);
	}
}

// ---- Board ----------------------------------------------------------------------------------

type CellView = {
	col: number;
	row: number;
	pad: Container;
	padCur: Sprite;
	padPrev: Sprite;
	padKind: PadKind;
	/** An egg still in the air: its pad keeps plain until it lands (no spoiling the tease). */
	eggPending: boolean;
	padFade: number;
	/** The split tile's fruit colour over the pad; it fades with the pad cross-fade. */
	tint: Sprite;
	tintFade: { from: number; to: number; at: number };
	tintSym: string;
	/** The scar and tint show only over a blob at rest: hidden while it falls in or pops. */
	restFade: { from: number; to: number; at: number };
	/** The crack's own fade: it stays through pops and falls (splits stay on the tile), so only the egg hatch hides it. */
	crackFade: { from: number; to: number; at: number };
	crackHolder: Container;
	sym: Container;
	/** The tile-sized mask a dividing blob wears (the DOM board's .cell overflow: hidden). */
	clip: Graphics | null;
	litBox: Container;
	blob: BlobView | null;
	crack: CrackView | null;
	key: number;
	fall: { start: number; drop: Drop; impact: number } | null;
	pop: { start: number; delay: number; ms: number } | null;
	lit: number | null;
};

const landsAt = (f: { start: number; drop: Drop }) => f.start + f.drop.delay + f.drop.dur;

export class BoardView {
	private pixi = new PixiApp();
	private app = this.pixi.app;
	private unwatchMotion: (() => void) | null = null;
	private readonly textures = new Map<string, Texture>();
	private pads = {} as Record<PadKind, Texture>;
	private blushTex!: Texture;
	private chargeTex!: Texture;
	private tintTex!: Texture;
	private rimTex: Texture[] = [];
	private layers = {
		pads: new Container(),
		cracks: new Container(),
		syms: new Container(),
		veil: new Graphics(),
		lit: new Container(),
		fx: new Container(),
		ghost: new Container(),
	};
	private overlays = new Overlays();
	/** Falling blobs near the top rim, and the old board's copy near the bottom one, are moved in
	 *  here while there: a mask over just that strip, not a filter pass over the whole board. */
	private rim = { top: new Container(), bottom: new Container() };
	private cells: CellView[] = [];
	private ghosts: { id: number; start: number; items: { blob: BlobView; g: GhostCell }[] } | null = null;
	private snap: BoardSnap | null = null;
	private scaredSince: number | null = null;
	private mild = false;
	private relief: { start: number; ms: number } | null = null;
	private veil = { from: 0, to: 0, start: 0 };
	private litKey = '';
	private rushed = 0;
	private hatched = new Set<string>();
	private wonder: { col: number; since: number } | null = null;
	private waveId = -1;
	private reduced = false;
	private host: HTMLElement | null = null;
	private res = 0;
	private frames = 0;
	private destroyed = false;
	/** Dev captures (CDP): a fixed clock to step an animation frame by frame; null = live. */
	frozen: number | null = null;

	async init(host: HTMLElement) {
		this.host = host;
		if (import.meta.env.DEV) (globalThis as { __board?: BoardView }).__board = this;
		this.unwatchMotion = watchReducedMotion((r) => (this.reduced = r));
		if (!(await this.pixi.init({ width: VIEW_W, height: VIEW_H, antialias: true, resolution: this.measureRes() }))) return;
		for (const [src, t] of await loadBlobTextures()) this.textures.set(src, t);
		if (this.destroyed) return;
		for (const k of ['pad', 'split', 'scatter', 'split-scatter', 'lit'] as PadKind[]) this.pads[k] = padTexture(k);
		this.blushTex = blushTexture();
		this.chargeTex = radialTexture([
			[0, '#fff'],
			[0.35, 'rgba(255,138,242,.9)'],
			[1, 'rgba(247,130,254,0)'],
		]);
		// Upload everything now: pixi 8.8.1 never registers its PrepareSystem, and a first-use
		// upload mid-spin is a visible hitch.
		const gl = this.app.renderer.texture as unknown as { initSource?: (s: unknown) => void };
		for (const t of [...this.textures.values(), ...Object.values(this.pads), this.blushTex, this.chargeTex])
			gl.initSource?.(t.source);

		const stage = this.app.stage;
		for (const l of Object.values(this.layers)) stage.addChild(l);
		// The old board's copy falls under the wave dropping in after it (it used to cover it).
		stage.addChildAt(this.layers.ghost, stage.getChildIndex(this.layers.syms));
		stage.addChildAt(this.rim.bottom, stage.getChildIndex(this.layers.syms));
		stage.addChildAt(this.rim.top, stage.getChildIndex(this.layers.veil));
		const rimTop = MARGIN;
		const rimBottom = VIEW_H - MARGIN;
		const spans: [Container, number, number, number, number][] = [
			[this.rim.top, rimTop, cellY(0), -2 * VIEW_H, cellY(3)],
			[this.rim.bottom, rimBottom, rimBottom - 6, cellY(3), 3 * VIEW_H],
		];
		for (const [box, from, to, top, bottom] of spans) {
			const tex = rimTexture(from, to, top, bottom);
			this.rimTex.push(tex);
			const m = new Sprite(tex);
			m.position.set(-MARGIN, top);
			m.scale.x = VIEW_W + 2 * MARGIN;
			box.addChild(m);
			box.mask = m;
			box.visible = false;
		}
		// Over the pads, like the DOM cell's sweat bead (z 2); pops above all.
		stage.addChildAt(this.overlays.sweat, stage.getChildIndex(this.layers.lit));
		// The teased column glows over its empty pads, under the blobs dropping into it.
		stage.addChildAt(this.overlays.tease, stage.getChildIndex(this.layers.syms));
		stage.addChild(this.overlays.pops);
		this.tintTex = tintTexture();
		for (const t of [this.tintTex, ...this.rimTex]) gl.initSource?.(t.source);
		this.layers.syms.sortableChildren = true;
		this.layers.lit.sortableChildren = true;
		for (let col = 0; col < N; col++)
			for (let row = 0; row < N; row++) {
				const pad = new Container();
				const padPrev = new Sprite(this.pads.pad);
				const padCur = new Sprite(this.pads.pad);
				for (const s of [padPrev, padCur]) s.scale.set(1 / TEX_RES);
				padPrev.visible = false;
				const tint = new Sprite(this.tintTex);
				tint.scale.set(1 / TEX_RES);
				tint.alpha = 0;
				tint.visible = false;
				pad.addChild(padPrev, padCur, tint);
				pad.position.set(cellX(col), cellY(row));
				const crackHolder = new Container();
				crackHolder.position.set(cellX(col) + BOX_X, cellY(row) + BOX_Y);
				crackHolder.scale.set(U);
				const sym = new Container();
				sym.position.set(cellX(col) + CELL_W / 2, cellY(row) + CELL_H);
				sym.zIndex = row * N + col;
				const litBox = new Container();
				litBox.zIndex = row * N + col;
				this.layers.pads.addChild(pad);
				this.layers.cracks.addChild(crackHolder);
				this.layers.syms.addChild(sym);
				this.cells.push({
					col,
					row,
					pad,
					padCur,
					padPrev,
					padKind: 'pad',
					eggPending: false,
					padFade: 0,
					tint,
					tintFade: { from: 0, to: 0, at: 0 },
					tintSym: '',
					restFade: { from: 1, to: 1, at: 0 },
					crackFade: { from: 1, to: 1, at: 0 },
					crackHolder,
					sym,
					clip: null,
					litBox,
					blob: null,
					crack: null,
					key: -1,
					fall: null,
					pop: null,
					lit: null,
				});
			}
		host.appendChild(this.app.canvas);
		this.app.canvas.style.display = 'block';
		this.pixi.run(() => this.frame());
		addEventListener('resize', this.onResize);
		if (this.snap) this.apply(this.snap);
	}

	/** Called once if the view stops working after init (a throw in a frame, a lost context). */
	set onfail(fn: ((e: unknown) => void) | null) {
		this.pixi.onfail = fn;
	}

	private tex = (src: string) => this.lookup(src);
	private lookup = textureLookup('BoardView', this.textures);

	private measureRes() {
		const h = this.host;
		const dpr = devicePixelRatio || 1;
		if (!h) return dpr;
		const r = h.getBoundingClientRect();
		const scale = h.offsetWidth ? r.width / h.offsetWidth : 1;
		this.res = Math.min(3, Math.max(1, dpr * scale));
		return this.res;
	}
	private onResize = () => {
		const prev = this.res;
		const next = this.measureRes();
		if (Math.abs(next - prev) / prev > 0.04) this.app.renderer.resize(VIEW_W, VIEW_H, next);
		else this.res = prev;
	};

	update(snap: BoardSnap) {
		this.snap = snap;
		if (this.cells.length) this.apply(snap);
	}

	private apply(s: BoardSnap) {
		const now = performance.now();
		const fright = s.scared || s.nervous;
		if (fright && this.scaredSince == null) this.scaredSince = now;
		if (!fright) this.scaredSince = null;
		this.mild = s.nervous && !s.scared;
		if (s.relieved && !this.relief) this.relief = { start: now, ms: s.reliefMs };
		if (!s.relieved) this.relief = null;
		// Before the cells, so a wave arriving with the rush still falls.
		if (s.rush !== this.rushed) {
			this.rushed = s.rush;
			// A slam stop (App slamStop) also lands every fall and drops the tease column.
			this.overlays.setTease(now, []);
			for (const c of this.cells) {
				c.blob?.rushDivide(now);
				c.crack?.rush(now);
				c.fall = null;
			}
		}
		if (s.wave.id !== this.waveId) {
			this.waveId = s.wave.id;
			this.overlays.setTease(now, s.wave.tease ?? []);
		}
		this.hatched = new Set(s.hatched);
		const w = s.mood.wonder;
		if (w == null) this.wonder = null;
		else if (this.wonder?.col !== w) this.wonder = { col: w, since: now };
		const lit = new Set(s.lit);
		const litKey = s.lit.slice().sort().join('|');
		if (litKey !== this.litKey) {
			this.litKey = litKey;
			// Fading out keeps the old shape, so cells that were lit never darken on the way.
			this.veil = { from: this.veilAlpha(now), to: lit.size ? VEIL : 0, start: now };
			if (lit.size) this.drawVeil(lit);
		}
		for (const c of this.cells) {
			const k = `${c.col},${c.row}`;
			const symbol = s.symbols[c.col]?.[c.row] ?? 'ORANGE';
			const units = (s.units[c.col]?.[c.row] ?? 0) + 1;
			const drop = s.wave.drops[c.col]?.[c.row];
			const falls = !!drop?.rows;
			const key = falls ? s.wave.id : 0;
			// Blob: rebuilt when it falls in or changes; a units increase divides in place.
			let fresh = false;
			if (!c.blob || c.blob.symbol !== symbol || (falls && key !== c.key)) {
				this.setBlob(c, symbol, units, null);
				c.fall = falls ? { start: now, drop: drop!, impact: s.wave.impact } : null;
				c.pop = null;
				fresh = true;
			} else if (units !== c.blob.units) {
				this.setBlob(c, symbol, units, units > c.blob.units ? planDivide(c.blob.units, units, now, s.divideMs) : null);
			}
			c.key = key;
			// Crack: torn open anew whenever the tile's count changes. A blob arriving already split
			// tore before it got here: its scar starts settled (and shows once it lands, frame()).
			if (units > 1 && c.crack?.units !== units) {
				c.crack?.destroy();
				const start = fresh ? now - 3 * s.divideMs - 900 : now;
				c.crack = new CrackView(units, c.col * 7 + c.row + 1, start, s.divideMs, this.chargeTex);
				c.crackHolder.addChild(c.crack.root);

				c.crack.fx.position.copyFrom(c.crackHolder.position);
				c.crack.fx.scale.set(U);
				this.layers.fx.addChild(c.crack.fx);
			} else if (units <= 1 && c.crack) {
				c.crack.destroy();
				c.crack = null;
			}
			const pop = s.popping[k];
			if (pop !== undefined && !c.pop) c.pop = { start: now, delay: pop, ms: s.removeMs };
			if (pop === undefined) c.pop = null;
			// Pad.
			const isLit = lit.has(k);
			// An egg's gold pad would show where it lands before it gets there: it waits (frame()).
			c.eggPending = symbol === 'BASKET' && !!c.fall && !this.reduced && now < landsAt(c.fall);
			const egg = symbol === 'BASKET' && !c.eggPending;
			const kind: PadKind = isLit ? 'lit' : egg ? (units > 1 ? 'split-scatter' : 'scatter') : units > 1 ? 'split' : 'pad';
			if (kind !== c.padKind) this.setPad(c, kind, now);
			// Tint: split tiles only (the scatter and lit pads have their own colours).
			const tint = kind === 'split' ? tintAlpha(units) : 0;
			if (tint && c.tintSym !== symbol) {
				c.tintSym = symbol;
				c.tint.tint = TINT[symbol] ?? '#ffffff';
			}
			if (tint !== c.tintFade.to) {
				c.tintFade = { from: c.tint.alpha, to: tint, at: now };
				c.tint.visible = true;
			}
			if (isLit && c.lit == null) {
				c.lit = now;
				c.litBox.addChild(c.pad, c.crackHolder, c.sym);
				this.layers.lit.addChild(c.litBox);
			} else if (!isLit && c.lit != null) {
				c.lit = null;
				this.layers.pads.addChild(c.pad);
				this.layers.cracks.addChild(c.crackHolder);
				this.layers.syms.addChild(c.sym);
				c.litBox.removeFromParent();
			}
			c.sym.visible = !s.awaiting;
		}
		this.overlays.update(now, s.pops, s.sweat, s.reliefMs);
		// Ghost board: the trap-door copy falling out.
		if (s.ghost?.id !== this.ghosts?.id) {
			for (const g of this.ghosts?.items ?? []) g.blob.destroy();
			this.ghosts = null;
			if (s.ghost) {
				const items = s.ghost.cells.map((g) => {
					const blob = new BlobView(this.tex, this.blushTex, g.symbol, g.units, `g-${s.ghost!.id}-${g.col}-${g.row}`);
					blob.root.position.set(cellX(g.col) + CELL_W / 2, cellY(g.row) + CELL_H);
					this.layers.ghost.addChild(blob.root);
					return { blob, g };
				});
				this.ghosts = { id: s.ghost.id, start: now, items };
			}
		}
	}

	private setPad(c: CellView, kind: PadKind, now: number) {
		c.padPrev.texture = c.padCur.texture;
		c.padPrev.position.copyFrom(c.padCur.position);
		c.padPrev.visible = true;
		c.padCur.texture = this.pads[kind];
		const m = kind === 'lit' ? -GLOW : 0;
		c.padCur.position.set(m, m);
		c.padKind = kind;
		c.padFade = now;
	}

	private setBlob(c: CellView, symbol: string, units: number, divide: Divide | null) {
		c.blob?.destroy();
		c.blob = new BlobView(this.tex, this.blushTex, symbol, units, `b-${c.col}-${c.row}`, divide);
		c.sym.addChild(c.blob.root);
	}

	private drawVeil(lit: Set<string>) {
		const g = this.layers.veil.clear();
		for (const c of this.cells)
			if (!lit.has(`${c.col},${c.row}`)) g.roundRect(cellX(c.col) - 1, cellY(c.row) - 1, CELL_W + 2, CELL_H + 2, 9);
		g.fill('#120f33');
	}
	private restAlpha(f: { from: number; to: number; at: number }, now: number, reduced: boolean) {
		const p = reduced ? 1 : Math.min(1, Math.max(0, (now - f.at) / (f.to ? 240 : 120)));
		return f.from + (f.to - f.from) * EASE(p);
	}
	private veilAlpha(now: number) {
		const v = this.veil;
		return v.from + (v.to - v.from) * EASE(Math.min(1, (now - v.start) / 250));
	}

	private frame() {
		const s = this.snap;
		if (!s) return;
		const now = this.frozen ?? performance.now();
		const reduced = this.reduced;
		if (++this.frames % 30 === 0) this.onResize();
		this.layers.veil.alpha = this.veilAlpha(now);
		// While a column is teased, the eggs already down throb with it.
		const teasing = !reduced && this.overlays.teaseActive(now);
		const throb = teasing ? Math.abs(Math.sin((now / 520) * Math.PI)) : 0;
		for (const c of this.cells) {
			// Pad cross-fade (the CSS background/box-shadow transition).
			if (c.padPrev.visible) {
				const p = Math.min(1, (now - c.padFade) / 200);
				c.padCur.alpha = EASE(p);
				if (p >= 1) c.padPrev.visible = false;
			}
			if (c.tint.visible) {
				const f = c.tintFade;
				const p = reduced ? 1 : Math.min(1, Math.max(0, (now - f.at) / 200));
				c.tint.alpha = f.from + (f.to - f.from) * EASE(p);
				if (p >= 1 && !f.to) c.tint.visible = false;
				c.tint.alpha *= this.restAlpha(c.restFade, now, reduced);
			}
			// A falling egg lights its pad as it lands.
			if (c.eggPending && (!c.fall || reduced || now >= landsAt(c.fall))) {
				c.eggPending = false;
				if (c.padKind !== 'lit') this.setPad(c, (c.blob?.units ?? 1) > 1 ? 'split-scatter' : 'scatter', now);
			}
			// Sym: fall, then landing squash; or the harvest pop.
			let t: TS = ID;
			let alpha = 1;
			let inAir = false;
			if (c.pop && !reduced) {
				const p = progress(now, c.pop.start, c.pop.delay, c.pop.ms);
				const v = p < 0 ? POP[0][1] : keyframes(POP, p, C_POP);
				t = { tx: 0, ty: 0, sx: v.s, sy: v.s, r: v.r };
				alpha = v.a;
			} else if (c.pop) alpha = 0;
			else if (c.fall && !reduced) {
				const { start, drop, impact } = c.fall;
				const fp = progress(now, start, drop.delay, drop.dur);
				if (fp < 1) {
					inAir = true;
					const e = GRAVITY(Math.max(0, fp));
					t = { tx: 0, ty: -1.05 * drop.rows * CELL_H * (1 - e), sx: 0.97 + 0.03 * e, sy: 1.06 - 0.06 * e, r: 0 };
				} else {
					const ip = progress(now, start, drop.delay + drop.dur, impact);
					if (ip >= 1) c.fall = null;
					else t = keyframes(IMPACT, ip, LINEAR);
				}
			}
			c.sym.position.set(cellX(c.col) + CELL_W / 2 + t.tx, cellY(c.row) + CELL_H + t.ty);
			if (teasing && !c.fall && !c.pop && c.blob?.symbol === 'BASKET') c.sym.scale.set(t.sx * (1 + 0.06 * throb), t.sy * (1 + 0.11 * throb));
			else c.sym.scale.set(t.sx, t.sy);
			c.sym.rotation = t.r;
			const hatched = this.hatched.has(`${c.col},${c.row}`);
			// Falling in through the top rim: faded by how far in it is (row 0 lands fully opaque),
			// and masked along the rim itself in rim.top.
			const rimIn = inAir ? smooth((c.sym.y - CELL_H / 2 - MARGIN) / (cellY(0) + CELL_H / 2 - 6 - MARGIN)) : 1;
			c.sym.alpha = hatched ? 0 : alpha * rimIn;
			if (c.lit == null) {
				const box = inAir && c.sym.y - 1.1 * CELL_H < cellY(0) + 2 ? this.rim.top : this.layers.syms;
				if (c.sym.parent !== box) box.addChild(c.sym);
			}
			// A dividing blob's daughters swell and slide apart; on a full late-bonus board they
			// spilled over the next tiles. Clipped to the tile only while dividing (a stencil
			// mask per cell would cost every frame).
			const dividing = !!c.blob?.dividing;
			if (dividing && !c.clip) {
				c.clip = new Graphics().rect(-CELL_W / 2, -CELL_H, CELL_W, CELL_H).fill(0xffffff);
				c.sym.addChild(c.clip);
				c.sym.mask = c.clip;
			} else if (!dividing && c.clip) {
				c.sym.mask = null;
				c.clip.destroy(DISPOSE);
				c.clip = null;
			}
			if (c.sym.visible && alpha > 0)
				c.blob?.tick({
					now,
					// Nervous spares the winners (they're the ones splitting, and cheering).
					scared: this.mild && c.lit != null ? null : this.scaredSince,
					mild: this.mild,
					relief: this.relief,
					lit: c.lit,
					reduced,
					wonder: this.wonder && { ...wonderGaze(this.wonder.col, c.col, c.row, now - this.wonder.since), since: this.wonder.since },
					surprise: s.mood.surprise || null,
				});
			// No tint over an empty tile: gone as the blob pops, back once the next one lands. The
			// scar stays: the split belongs to the tile, not the blob.
			const bare =
				hatched || !c.sym.visible || (!!c.pop && now >= c.pop.start + c.pop.delay) || (!!c.fall && now < landsAt(c.fall));
			if (+!bare !== c.restFade.to) c.restFade = { from: this.restAlpha(c.restFade, now, reduced), to: +!bare, at: now };
			if (c.crack) {
				if (+!hatched !== c.crackFade.to) c.crackFade = { from: this.restAlpha(c.crackFade, now, reduced), to: +!hatched, at: now };
				c.crack.tick(now, reduced, false, s.removeMs, 0);
				const a = this.restAlpha(c.crackFade, now, reduced);
				c.crackHolder.alpha = a;
				c.crack.fx.alpha = a;
			}
		}
		this.rim.top.visible = this.rim.top.children.length > 1;
		this.overlays.tick(now, reduced);
		const gh = this.ghosts;
		if (gh) {
			this.layers.ghost.visible = !reduced;
			for (const { blob, g } of gh.items) {
				const p = progress(now, gh.start, g.delay, g.dur);
				const e = GRAVITY(Math.max(0, p));
				const y = cellY(g.row) + CELL_H + 1.05 * g.rows * CELL_H * e;
				blob.root.position.set(cellX(g.col) + CELL_W / 2, y);
				blob.root.scale.set(1 - 0.04 * e, 1 + 0.08 * e);
				// Out through the bottom rim: faded as it goes, masked along the rim in rim.bottom.
				const rimB = VIEW_H - MARGIN;
				blob.root.alpha = 1 - smooth((y - CELL_H / 2 - (rimB - CELL_H / 2 - 8)) / (CELL_H / 2 + 8));
				const box = y + 6 > rimB - 6 ? this.rim.bottom : this.layers.ghost;
				if (blob.root.parent !== box) box.addChild(blob.root);
				if (p < 1) blob.tick({ now, scared: gh.start, relief: null, lit: null, reduced });
				else blob.root.visible = false;
			}
		}
		this.rim.bottom.visible = !!gh && !reduced && this.rim.bottom.children.length > 1;
	}

	destroy() {
		this.destroyed = true;
		this.unwatchMotion?.();
		removeEventListener('resize', this.onResize);
		this.overlays.destroy();
		// A lit cell's pad, crack and blob sit in its litBox, off the stage the app destroys.
		for (const c of this.cells) c.litBox.destroy(DISPOSE);
		this.pixi.destroy();
		for (const t of [...Object.values(this.pads), this.blushTex, this.chargeTex, this.tintTex, ...this.rimTex])
			t?.destroy(true);
	}
}

