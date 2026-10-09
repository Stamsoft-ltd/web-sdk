// Splash-card sauce, drawn in code (SauceCorner.svelte). Outlines traced from the original painted
// drip art (marching squares on its alpha, with the wood-frame pixels baked into the corner removed
// and a 3 px morphological opening to drop thin slivers, then smoothed + simplified), in the card
// art's 470x690 px space. Every blob is shifted so its top-left overhangs the frame corner by the
// same amount (-5, -6); SauceCorner clips it to the frame's rounded outline, so all three cards' sauce
// starts exactly at the wood edge (the painted drips were each placed differently).
// Tendrils = the two drips per card that animate (centre x, tip y, width).
export type SauceTendril = { cx: number; tip: number; w: number; reach: number; run: number; period: number; phase: number };
// `more` = extra closed outlines of the same sauce; `discs` = [x, y, r] circles unioned into the blob
// (a generated shape — see makeTurnSauce).
export type SauceSpec = {
	body: [number, number, number];
	poly: number[];
	tendrils: SauceTendril[];
	more?: number[][];
	discs?: [number, number, number][];
	/** extra shine capsules [x, y, rx, ry, rotation] (generated puddles) */
	gloss?: [number, number, number, number, number][];
	/** shrinks this blob's random size band (the green one is the widest and reached the title) */
	size?: number;
};

export const SAUCE: Record<'red' | 'yellow' | 'green', SauceSpec> = {
	red: {
		body: [225, 17, 5],
		tendrils: [
			{ cx: 26.2, tip: 141.2, w: 33, reach: 30, run: 230, period: 6300, phase: 0 },
			{ cx: 74.7, tip: 93.2, w: 32, reach: 24, run: 170, period: 8700, phase: 3900 },
		],
		poly: [
			131.2, -6.0, 145.2, -5.9, 146.8, -5.1, 150.2, -4.9, 151.4, -4.2, 153.6, -3.8, 157.6, -1.8, 159.1, -0.4, 160.8, 0.4, 162.6, 2.1,
			163.4, 3.9, 164.8, 5.4, 165.1, 8.2, 165.7, 9.8, 165.7, 15.6, 165.1, 16.8, 164.8, 18.6, 163.6, 20.8, 160.4, 24.1, 159.8, 25.6,
			158.8, 26.6, 154.6, 28.8, 152.4, 29.2, 151.2, 29.9, 141.8, 29.9, 140.6, 29.2, 138.4, 28.8, 137.6, 28.2, 135.4, 27.8, 132.6, 26.2,
			131.2, 26.0, 124.8, 26.1, 120.4, 28.2, 118.4, 30.1, 117.1, 32.8, 116.9, 46.7, 116.1, 48.8, 115.8, 50.6, 110.6, 55.8, 108.7, 56.0,
			98.8, 55.9, 96.6, 54.2, 95.1, 53.6, 93.6, 52.2, 92.2, 52.0, 91.1, 52.4, 88.2, 56.4, 88.0, 58.2, 88.0, 66.7, 89.8, 70.4,
			90.1, 73.2, 90.9, 74.8, 90.9, 82.2, 90.2, 83.4, 89.8, 85.6, 86.8, 90.5, 85.1, 91.4, 82.6, 93.8, 68.2, 93.9, 65.1, 92.6,
			62.2, 89.6, 60.2, 85.6, 59.8, 83.4, 59.1, 82.2, 59.1, 76.3, 60.0, 73.2, 59.8, 66.4, 57.8, 64.4, 56.7, 64.0, 51.8, 64.1,
			49.1, 65.4, 43.2, 71.4, 40.2, 77.4, 39.8, 79.6, 39.1, 80.8, 38.9, 84.2, 38.0, 86.3, 38.1, 95.2, 38.9, 96.8, 39.1, 100.2,
			39.8, 101.4, 40.1, 104.2, 40.9, 105.8, 41.1, 108.2, 41.8, 109.4, 42.1, 111.2, 42.9, 113.3, 43.0, 127.7, 42.8, 129.6, 40.8, 133.6,
			39.6, 134.9, 36.8, 137.6, 35.4, 138.2, 33.8, 139.6, 31.6, 140.8, 27.8, 141.1, 25.7, 141.9, 16.7, 142.0, 15.5, 141.7, 15.1, 141.2,
			14.8, 138.4, 11.2, 133.6, 10.0, 130.7, 10.0, 118.3, 10.9, 116.2, 11.2, 114.4, 11.8, 113.6, 12.2, 111.4, 12.9, 110.2, 12.7, 108.5,
			11.2, 108.0, -2.2, 107.9, -2.8, 107.5, -3.3, 105.5, -4.5, 104.8, -5.0, 103.7, -5.0, 89.7, -4.0, 86.7, -4.0, 75.7, -4.1, 73.8,
			-4.8, 72.6, -5.0, 71.2, -5.0, 50.3, -4.0, 47.7, -3.9, 39.8, -2.2, 37.6, 0.2, 29.4, 2.4, 25.1, 6.1, 21.4, 7.6, 20.8,
			10.1, 18.4, 11.8, 17.6, 12.2, 14.4, 13.2, 12.4, 14.1, 11.4, 15.8, 10.6, 20.4, 7.2, 30.4, 2.2, 32.5, 1.8, 33.2, 0.5,
			33.8, 0.1, 39.7, 0.0, 41.8, -0.9, 46.7, -1.0, 49.7, -2.0, 97.2, -2.0, 100.7, -3.0, 115.7, -3.0, 117.8, -3.9, 123.2, -4.1,
			124.8, -4.9, 128.2, -5.1, 129.4, -5.8,
		],
	},
	yellow: {
		body: [251, 203, 7],
		tendrils: [
			{ cx: 16.7, tip: 122.2, w: 36, reach: 30, run: 230, period: 6900, phase: 2850 },
			{ cx: 64.7, tip: 79.2, w: 28, reach: 24, run: 170, period: 9500, phase: 6100 },
		],
		poly: [
			85.2, -6.0, 86.6, -5.8, 87.8, -5.1, 89.2, -5.0, 125.7, -5.2, 136.2, -4.9, 141.6, -2.8, 143.1, -1.4, 144.8, -0.6, 147.6, 2.1,
			149.9, 6.8, 149.8, 14.6, 148.3, 17.1, 141.6, 23.9, 140.2, 24.9, 125.2, 24.9, 121.2, 23.1, 117.7, 23.0, 116.4, 23.2, 114.6, 24.8,
			112.1, 25.4, 107.2, 30.4, 106.9, 38.2, 104.8, 43.6, 101.8, 46.6, 99.6, 47.8, 91.2, 48.0, 88.4, 47.8, 84.4, 43.8, 83.5, 41.2,
			81.7, 41.0, 80.1, 41.4, 78.2, 43.4, 77.0, 47.7, 77.1, 50.2, 77.9, 51.8, 78.1, 54.2, 78.9, 56.2, 79.2, 65.7, 78.9, 70.2,
			76.6, 74.8, 71.6, 79.8, 59.2, 80.0, 57.1, 79.6, 52.4, 74.8, 51.1, 72.2, 51.0, 57.7, 50.6, 56.1, 48.6, 54.2, 46.7, 54.0,
			45.4, 54.2, 43.8, 55.6, 42.1, 56.4, 38.2, 60.4, 37.8, 62.6, 36.2, 64.4, 34.2, 68.4, 33.8, 70.6, 33.2, 71.4, 32.9, 73.2,
			32.0, 75.2, 32.0, 85.7, 32.9, 87.8, 33.1, 92.2, 33.9, 93.8, 34.1, 98.2, 34.8, 99.4, 35.0, 100.7, 35.0, 111.2, 33.8, 115.6,
			30.6, 119.9, 29.6, 120.8, 28.1, 121.4, 26.6, 122.8, 23.7, 123.0, 14.4, 122.8, 10.4, 120.8, 8.4, 118.8, 7.6, 117.1, 6.2, 115.6,
			5.9, 112.8, 5.5, 112.2, 0.2, 111.9, -0.8, 111.5, -1.0, 110.2, -1.1, 94.8, -1.4, 94.1, -4.6, 90.8, -5.0, 89.7, -5.0, 72.7,
			-4.8, 71.4, -4.1, 70.2, -4.0, 66.2, -4.1, 63.8, -4.8, 62.6, -5.0, 61.2, -5.0, 40.2, -4.1, 37.7, -3.9, 31.8, -3.1, 30.2,
			-2.8, 27.4, -2.2, 26.6, -1.8, 24.4, -0.2, 21.6, 0.2, 19.4, 1.4, 18.2, 3.8, 17.6, 5.4, 14.1, 12.6, 6.9, 12.9, 6.2,
			13.1, 3.8, 13.4, 3.2, 14.8, 2.6, 16.4, 1.2, 22.4, -1.8, 24.6, -2.2, 25.4, -2.8, 27.6, -3.2, 28.8, -3.9, 31.2, -4.1,
			33.2, -5.0, 65.2, -5.0, 66.6, -5.2, 67.4, -5.8,
		],
	},
	green: {
		body: [140, 204, 24],
		size: 0.78,
		tendrils: [
			{ cx: 28.1, tip: 149.1, w: 35, reach: 30, run: 230, period: 6600, phase: 4650 },
			{ cx: 91.1, tip: 105.1, w: 33, reach: 24, run: 160, period: 9100, phase: 1200 },
		],
		poly: [
			172.0, -6.0, 172.6, -5.7, 173.3, -4.3, 175.2, -3.3, 177.4, -2.9, 178.9, -1.5, 180.3, -0.9, 181.2, 0.7, 183.6, 3.3, 184.0, 5.5,
			185.6, 8.3, 185.9, 10.1, 186.5, 11.3, 186.5, 17.5, 185.9, 18.7, 185.6, 21.5, 184.2, 23.0, 183.4, 24.7, 177.7, 30.5, 173.4, 32.7,
			167.1, 33.1, 158.1, 32.8, 156.0, 32.0, 154.2, 31.7, 151.0, 30.0, 145.1, 29.9, 143.6, 30.0, 142.4, 30.7, 140.2, 31.1, 138.7, 32.5,
			136.9, 33.3, 135.0, 35.3, 132.9, 39.7, 132.6, 54.5, 132.0, 55.3, 131.4, 57.7, 128.4, 60.7, 117.1, 60.8, 116.0, 60.5, 112.4, 57.1,
			110.6, 57.0, 109.2, 58.0, 108.0, 59.3, 106.0, 63.3, 105.7, 66.1, 105.0, 67.3, 104.8, 68.6, 104.9, 71.1, 105.7, 72.7, 105.9, 76.1,
			106.7, 77.7, 106.9, 80.1, 107.8, 82.1, 107.7, 93.1, 107.0, 94.3, 106.6, 96.4, 105.2, 98.0, 104.4, 99.7, 100.7, 103.5, 96.4, 105.7,
			88.6, 105.9, 85.2, 105.7, 81.0, 103.5, 78.2, 100.7, 77.4, 99.0, 76.2, 97.7, 74.8, 93.1, 74.8, 84.6, 75.8, 81.6, 75.7, 74.7,
			73.6, 69.3, 69.7, 65.3, 65.0, 63.0, 61.1, 62.9, 56.2, 65.1, 54.7, 66.5, 52.9, 67.3, 52.0, 68.3, 51.4, 69.7, 49.0, 72.3,
			46.0, 78.3, 45.6, 80.5, 45.0, 81.3, 44.6, 83.5, 43.9, 84.7, 43.7, 88.1, 42.8, 90.1, 42.8, 105.6, 43.7, 107.7, 43.9, 112.1,
			44.6, 113.3, 44.9, 116.1, 45.7, 117.7, 45.9, 122.1, 46.6, 123.3, 46.8, 124.6, 46.8, 132.6, 45.9, 134.7, 45.6, 137.5, 42.2, 144.0,
			38.7, 147.5, 34.4, 149.7, 21.6, 149.9, 18.6, 148.9, 12.6, 148.8, 12.1, 148.4, 11.9, 147.6, 11.7, 141.7, 10.9, 140.1, 10.7, 137.7,
			9.9, 135.6, 9.8, 124.6, 9.9, 122.7, 10.7, 121.1, 10.9, 117.7, 11.7, 116.1, 11.9, 110.7, 12.8, 108.6, 12.8, 100.1, 11.9, 98.5,
			11.8, 97.1, 11.9, 89.1, 12.7, 87.1, 12.7, 84.7, 11.0, 82.4, 10.4, 80.0, 7.4, 77.1, 5.0, 76.0, -1.7, 75.6, -2.1, 74.6,
			-2.4, 70.3, -3.3, 69.3, -4.9, 68.4, -5.0, 43.1, -3.8, 36.6, -2.8, 32.6, -0.9, 27.9, 0.0, 26.3, 1.1, 25.9, 4.0, 25.8,
			4.7, 25.5, 5.6, 24.5, 6.2, 23.0, 8.6, 20.5, 9.2, 19.0, 11.6, 16.5, 12.2, 15.0, 13.9, 13.3, 15.7, 12.5, 20.2, 8.1,
			21.4, 7.7, 23.2, 6.1, 26.4, 4.7, 26.8, 4.1, 26.9, 0.7, 27.3, -0.4, 32.9, -2.8, 36.4, -3.8, 46.2, -5.9,
		],
	},
};

// Randomly placed sauce (the spin disc + the BONUS plaque): laid out afresh each time the game loads.
// A piece is a puddle of discs along a RIM (a closed path through the art, in art px, walked by
// arc length) with one or two drips hanging straight down from its lowest point(s). Rendered by
// SauceCorner (`discs` + `tendrils`).
type Disc = [number, number, number];
type Gloss = [number, number, number, number, number];
type Piece = { discs: Disc[]; tendrils: SauceTendril[]; gloss: Gloss[] };
type Rim = {
	/** total length (art px) */
	len: number;
	/** the point `s` px along the rim */
	at: (s: number) => [number, number];
	/** how far a drip from (x, y) may run (0 = no drip there) */
	run: (x: number, y: number, rnd: () => number) => number;
	/** widest drip (art px) */
	maxDrip: number;
	/** where a piece may be centred (default: anywhere) */
	ok?: (x: number, y: number) => boolean;
};
const rimPiece = (rim: Rim, s0: number, span: number, th: number, rnd: () => number): Piece => {
	// A puddle, not a tube: one off-centre pool (where it was squeezed out) tapering to thin smears
	// either side, with a couple of lumps — and it bulges OUTWARD as it thickens, spilling over the
	// rim's outer edge the way real sauce slumps off a ledge.
	const pool = 0.3 + 0.4 * rnd();
	const bumps = [0, 1].map(() => ({ c: rnd(), amp: (rnd() - 0.3) * 0.5 }));
	const discs: Disc[] = [];
	const n = Math.max(8, Math.round(span / 2.4));
	for (let i = 0; i <= n; i++) {
		const f = i / n;
		const bell = Math.exp(-(((f - pool) / 0.26) ** 2));
		const w = th * (0.28 + 0.72 * bell) * (1 + bumps.reduce((v, b) => v + b.amp * Math.exp(-(((f - b.c) / 0.12) ** 2)), 0));
		const s = s0 + span * (f - 0.5);
		const [x, y] = rim.at(s);
		const [xa, ya] = rim.at(s - 1);
		const [xb, yb] = rim.at(s + 1);
		const tl = Math.hypot(xb - xa, yb - ya) || 1;
		// outward normal (both rims run clockwise on screen)
		const out = (w - th * 0.28) * 0.45;
		discs.push([x + ((yb - ya) / tl) * out, y - ((xb - xa) / tl) * out, w]);
	}
	// shine: a capsule along the pool's top, tilted with the rim, inset toward the upper side
	const gloss: Gloss[] = [];
	{
		const k = Math.round(pool * n);
		const [x, y, w] = discs[k];
		const [xa, ya] = discs[Math.max(0, k - 1)];
		const [xb, yb] = discs[Math.min(n, k + 1)];
		let rot = Math.atan2(yb - ya, xb - xa);
		if (rot > Math.PI / 2) rot -= Math.PI;
		if (rot < -Math.PI / 2) rot += Math.PI;
		gloss.push([x - w * 0.2, y - w * 0.42, w * 0.42, w * 0.13, rot]);
		const k2 = Math.round(((pool + (rnd() < 0.5 ? -0.28 : 0.28)) * n));
		if (k2 > 0 && k2 < n) {
			const [x2, y2, w2] = discs[k2];
			gloss.push([x2 - w2 * 0.15, y2 - w2 * 0.4, w2 * 0.16, w2 * 0.12, rot]);
		}
	}
	// drips: from the lowest point of the run, and maybe a second one further along it
	const lowest = discs.reduce((m, d, i) => (d[1] + d[2] > discs[m][1] + discs[m][2] ? i : m), 0);
	const at = [lowest];
	if (rnd() < 0.55) {
		const j = lowest + Math.round((rnd() < 0.5 ? -1 : 1) * n * (0.3 + 0.15 * rnd()));
		if (j > 1 && j < n - 1) at.push(j);
	}
	const tendrils: SauceTendril[] = [];
	for (const i of at) {
		const [x, y, r] = discs[i];
		const run = rim.run(x, y, rnd);
		if (run <= 0) continue;
		const w = Math.min(rim.maxDrip, Math.max(rim.maxDrip * 0.6, r * (1.2 + 0.35 * rnd())));
		// the drip's round end must sit below everything of the run within its column (its stub is
		// redrawn from there down, so nothing of the run may be cut)
		const half = w / 2 + 14;
		const floor = discs.filter((d) => Math.abs(d[0] - x) < half + d[2]).reduce((m, d) => Math.max(m, d[1] + d[2]), y + r);
		const tip = Math.max(y + r + 6 + rnd() * 26, floor + w / 2 + 4);
		for (let yy = y; yy < tip - w / 2; yy += 2) discs.push([x, yy, w / 2]);
		tendrils.push({
			cx: Math.round(x * 10) / 10,
			tip: Math.round(tip * 10) / 10,
			w: Math.round(w * 10) / 10,
			reach: 8 + 3 * rnd(),
			run,
			period: 5000 + 2600 * rnd(),
			phase: 7600 * rnd(),
		});
	}
	return { discs, tendrils, gloss };
};
type SauceLayout = {
	ketchup: { span: [number, number]; th: [number, number] };
	mustard: { count: [number, number]; span: [number, number]; th: [number, number] };
	/** clear rim between pieces (art px) */
	gap: number;
};
const layOut = (rim: Rim, L: SauceLayout, rnd: () => number): { ketchup: SauceSpec; mustard: SauceSpec } => {
	const between = (r: [number, number]) => r[0] + (r[1] - r[0]) * rnd();
	const taken: [number, number][] = [];
	const place = (span: number) => {
		for (let tries = 0; tries < 60; tries++) {
			const c = rnd() * rim.len;
			if (rim.ok && !rim.ok(...rim.at(c))) continue;
			const clear = taken.every(([b, w]) => {
				const d = Math.abs(((c - b + rim.len * 1.5) % rim.len) - rim.len / 2);
				return d > (span + w) / 2 + L.gap;
			});
			if (clear) {
				taken.push([c, span]);
				return c;
			}
		}
		return null;
	};
	const kSpan = between(L.ketchup.span);
	const k = rimPiece(rim, place(kSpan) ?? 0, kSpan, between(L.ketchup.th), rnd);
	const mustard: Piece = { discs: [], tendrils: [], gloss: [] };
	const count = Math.round(between(L.mustard.count));
	for (let i = 0; i < count; i++) {
		const span = between(L.mustard.span);
		const c = place(span);
		if (c === null) continue;
		const p = rimPiece(rim, c, span, between(L.mustard.th), rnd);
		mustard.discs.push(...p.discs);
		mustard.tendrils.push(...p.tendrils);
		mustard.gloss.push(...p.gloss);
	}
	return {
		ketchup: { body: [226, 39, 26], poly: [], discs: k.discs, tendrils: k.tendrils, gloss: k.gloss },
		mustard: { body: [244, 170, 30], poly: [], discs: mustard.discs, tendrils: mustard.tendrils, gloss: mustard.gloss },
	};
};

// The spin disc: its rim in the disc art's 701×548 px space (ui-icons/turn-button-bg.svg at half
// scale; the bare disc has the full ring of rivets). Over the button face a drop only runs a little
// way (it reads as sliding on the button); off the rim it falls further.
const DISC = { x: 336.3, y: 268, rim: 228, face: 190 };
const DISC_RIM: Rim = {
	len: 2 * Math.PI * DISC.rim,
	at: (s) => [DISC.x + DISC.rim * Math.cos(s / DISC.rim), DISC.y + DISC.rim * Math.sin(s / DISC.rim)],
	run: (x, y, rnd) => (Math.abs(x - DISC.x) < DISC.face && y < DISC.y ? 60 : 130 + 30 * rnd()),
	maxDrip: 28,
};
/** A fresh random spin-disc layout: { ketchup, mustard } specs for SauceCorner. */
export const makeTurnSauce = (rnd: () => number = Math.random) =>
	layOut(
		DISC_RIM,
		{
			ketchup: { span: [95, 160], th: [20, 25] },
			mustard: { count: [1.5, 3.4], span: [70, 135], th: [18, 23] },
			gap: 104,
		},
		rnd,
	);
/** This game's layout (module scope: the same for every spin-button layout until the next load). */
export const turnSauce = makeTurnSauce();

// The BONUS plaque (buy-bonus-plaque.webp, 716×284, drawn in a 716×440 box so drips can leave its
// bottom): the rim is the centre line of its gold frame band. A drop on the top band runs only a
// short way down the red face, and never over the BONUS label in the middle.
const PLAQUE = { x0: 21, y0: 48, x1: 686, y1: 246, r: 26 };
const PLAQUE_RIM: Rim = (() => {
	const { x0, y0, x1, y1, r } = PLAQUE;
	const W = x1 - x0 - 2 * r;
	const H = y1 - y0 - 2 * r;
	const q = (Math.PI * r) / 2;
	// clockwise from the top-left corner's end: top, TR arc, right, BR arc, bottom, BL arc, left, TL arc
	const segs: [number, (u: number) => [number, number]][] = [
		[W, (u) => [x0 + r + u, y0]],
		[q, (u) => arc(x1 - r, y0 + r, -Math.PI / 2 + u / r)],
		[H, (u) => [x1, y0 + r + u]],
		[q, (u) => arc(x1 - r, y1 - r, u / r)],
		[W, (u) => [x1 - r - u, y1]],
		[q, (u) => arc(x0 + r, y1 - r, Math.PI / 2 + u / r)],
		[H, (u) => [x0, y1 - r - u]],
		[q, (u) => arc(x0 + r, y0 + r, Math.PI + u / r)],
	];
	function arc(cx: number, cy: number, a: number): [number, number] {
		return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
	}
	const len = segs.reduce((v, [l]) => v + l, 0);
	return {
		len,
		at: (s) => {
			let u = ((s % len) + len) % len;
			for (const [l, f] of segs) {
				if (u <= l) return f(u);
				u -= l;
			}
			return segs[0][1](0);
		},
		run: (x, y, rnd) => {
			if (y > y0 + r) return 60 + 40 * rnd(); // sides / bottom: off the plaque
			return x > 215 && x < 500 ? 0 : 26;
		},
		maxDrip: 22,
		// On the top or bottom band (corners included) — a run down a side edge read as a sausage —
		// and not across the top middle, where it couldn't drip (the label).
		ok: (x, y) => (y < y0 + r + 6 && (x < 190 || x > 525)) || y > y1 - r - 6,
	};
})();
/** A fresh random BONUS-plaque layout: { ketchup, mustard } specs for SauceCorner. */
export const makeBuySauce = (rnd: () => number = Math.random) =>
	layOut(
		PLAQUE_RIM,
		{
			ketchup: { span: [80, 130], th: [20, 25] },
			mustard: { count: [1, 2.4], span: [70, 115], th: [18, 23] },
			gap: 70,
		},
		rnd,
	);
/** This game's plaque layout (module scope, like turnSauce). */
export const buySauce = makeBuySauce();
