// The McSchmutzo logo = the Figma wordmark (McShmutzo node 8870:33545, "Glossy Mc Schmutzo Cartoon
// Logo", logo-word-v2.webp, scripts/build-logo.py). Until 2026-10-06 it was the 8779:1698 wordmark +
// two ketchup splats drawn in code behind its ends, squeezed out when the splash logo HITS (see
// SplashIntro) and drawn at rest on the board (FeatureOverlay). The new logo has no splats, so they are
// switched off (SPLATS_ON) — the code stays, so they can come back. Units: fractions of the logo box
// WIDTH, origin at the box centre, y down.

import { splashShapes, type SplashSpec } from './winSplash';
import type { SplatShape } from './wildSplat';

/** The logo box (wordmark + splats) — the same footprint the old baked logo-v3 had. */
export const LOGO_ASPECT = 3.97;
/** The wordmark inside the box (centre + width; its own art is 2140×575 — it fills the box's height). */
export const LOGO_WORD = { x: 0, y: 0, w: 0.93, aspect: 2140 / 575 };
/** The old logo's ketchup splats (off: the 8870:33545 logo has none). */
const SPLATS_ON = false;
// The burst plays at 0.7× the big-win card's pace — a slower, heavier squeeze for the logo.
const PACE = 0.7;
// …and each splat POPS out as a whole on top of that: from a quarter size to ~1.2× and a damped
// wobble back (a spring), so the squeeze reads even though its core sits behind the letters.
const pop = (ms: number) => {
	if (ms <= 0) return 0.25;
	if (ms >= LOGO_REST_MS) return 1;
	const t = ms / 1000;
	return 1 - 0.75 * Math.exp(-4.5 * t) * Math.cos(10 * t);
};
/** The splats are fully out and settled by now; the board (and the splash, once landed) shows this frame. */
export const LOGO_REST_MS = 1500;

// Drawn like the reel symbols' sauce (the pot's drips): dark-red outline, flat ketchup, shade band, pale gloss.
const SPLAT: SplashSpec = {
	ox: 0,
	oy: 0,
	core: { rx: 0.085, ry: 0.07 },
	tongues: [
		{ a: -82, len: 0.13, w: 0.026, head: 0.034, curl: -14 },
		{ a: -42, len: 0.15, w: 0.028, head: 0.036, curl: 10 },
		{ a: -6, len: 0.11, w: 0.026, head: 0.032, curl: -8 },
		{ a: 34, len: 0.07, w: 0.022, head: 0.028, curl: 12 },
	],
	drops: [
		{ a: -62, d: 0.22, r: 0.016, delay: 30 },
		{ a: -18, d: 0.21, r: 0.013, delay: 60 },
		{ a: 18, d: 0.17, r: 0.012, delay: 20 },
		{ a: -112, d: 0.16, r: 0.011, delay: 50 },
	],
	// the reel symbols' sauce style: a dark-red outline (not the wordmark's brown), pale gloss
	palette: { edge: 0x5a0d07, body: 0xe2271a, shade: 0xa8150b, light: 0xffb3a3 },
	edgeW: 0.009,
	item: true,
};
const SIDES = [
	{ side: -1 as const, x: -0.36, y: -0.01, k: 0.68, seed: 0.7, delay: 0 },
	{ side: 1 as const, x: 0.37, y: 0, k: 0.68, seed: 2.3, delay: 50 },
];

/** Both splats `ms` after the hit (negative = not out yet), in logo-box units. */
export function logoSplashShapes(ms: number): SplatShape[] {
	const out: SplatShape[] = [];
	if (!SPLATS_ON) return out;
	for (const s of SIDES) {
		const t = Math.min(ms - s.delay, LOGO_REST_MS);
		const k = s.k * pop(t);
		const X = (v: number) => s.x + v * k;
		const Y = (v: number) => s.y + v * k;
		for (const sh of splashShapes(SPLAT, s.side, t * PACE, s.seed)) {
			if (sh.kind === 'poly') out.push({ ...sh, pts: sh.pts.map((v, i) => (i % 2 === 0 ? X(v) : Y(v))) });
			else if (sh.kind === 'circle') out.push({ ...sh, x: X(sh.x), y: Y(sh.y), r: sh.r * k });
			else out.push({ ...sh, x: X(sh.x), y: Y(sh.y), rx: sh.rx * k, ry: sh.ry * k });
		}
	}
	return out;
}
