// The wild's ketchup splat, drawn in code (it replaced the flat splat@…webp layer). The WILD lettering
// stays a sprite on top; this module only produces the sauce.
//
// Landing: a fat drop of ketchup falls into the cell, hits, and SPLATS — the core spreads wide and
// flat, arms shoot out (each ending in a round bulb), loose droplets fly to their spots — then
// the WILD letters are stamped on top (see the `landStamp` layer in AnimatedSymbol), which sends a
// smaller ripple through the sauce. On the board it breathes a little (idle) and, while it wins, it
// wobbles like liquid and thick drops ooze off the bottom bulbs, pinch and fall.
//
// Geometry is in units of the symbol box HEIGHT, centred: the box is 1.361 h wide, but the splat may
// reach past it into the cell (about ±0.8 x, ±0.7 y), +y down. Everything is a list of flat shapes so the same
// frame can be drawn by Pixi Graphics (AnimatedSymbol) or a Canvas2D preview.

export type SplatShape =
	| { kind: 'poly'; pts: number[]; color: number; alpha: number }
	| { kind: 'circle'; x: number; y: number; r: number; color: number; alpha: number }
	| { kind: 'ellipse'; x: number; y: number; rx: number; ry: number; color: number; alpha: number };

export type SplatFrame = {
	/** Land one-shot progress 0..1, or null when not landing (rest / loop). */
	land: number | null;
	/** ms since the idle/win loop started (0 when at rest). */
	t: number;
	/** Loop amplitude: 0 at rest, the config's idle fraction on the board, 1 while winning. */
	amp: number;
};

const SHADOW = 0x000000;
const RIM = 0x5e0603; // dark ketchup edge (reads as the comic outline the lettering has)
const BODY = 0xcf160e; // ketchup red
const MID = 0xe8301a; // lit middle of the puddle
const GLOSS = 0xffffff;

const RIM_W = 0.022; // outline thickness
const CORE = { x: 0, y: 0.02, rx: 0.5, ry: 0.35 };

// Arms: angle (deg, 0 = right, +90 = down), reach of the bulb centre beyond the core edge, neck
// half-width where it leaves the core, bulb radius. A few FAT lobes (sauce that slopped out) mixed
// with thin splash spikes ending in a bead — irregular on purpose, never evenly spaced. The two
// bottom lobes are where the win drips hang.
type Arm = { a: number; len: number; neck: number; bulb: number };
const ARMS: Arm[] = [
	{ a: 198, len: 0.11, neck: 0.095, bulb: 0.085 }, // lobe, left
	{ a: 338, len: 0.12, neck: 0.09, bulb: 0.08 }, // lobe, right
	{ a: 118, len: 0.07, neck: 0.09, bulb: 0.078 }, // lobe, bottom-left (drips)
	{ a: 63, len: 0.065, neck: 0.085, bulb: 0.074 }, // lobe, bottom-right (drips)
	{ a: 268, len: 0.05, neck: 0.08, bulb: 0.068 }, // lobe, top
	{ a: 226, len: 0.12, neck: 0.034, bulb: 0.032 }, // spikes ↓
	{ a: 306, len: 0.11, neck: 0.03, bulb: 0.03 },
	{ a: 163, len: 0.15, neck: 0.036, bulb: 0.035 },
	{ a: 17, len: 0.16, neck: 0.035, bulb: 0.034 },
	{ a: 91, len: 0.1, neck: 0.03, bulb: 0.03 },
	{ a: 247, len: 0.1, neck: 0.028, bulb: 0.026 },
];
/** Indices of the arms whose bulbs drip while winning. */
const DRIP_ARMS = [2, 3];

// Loose droplets: angle (deg), distance from the centre (in core radii), radius.
const DROPS = [
	{ a: 210, d: 1.4, r: 0.028 },
	{ a: 236, d: 1.52, r: 0.018 },
	{ a: 322, d: 1.42, r: 0.024 },
	{ a: 0, d: 1.42, r: 0.02 },
	{ a: 40, d: 1.38, r: 0.022 },
	{ a: 145, d: 1.36, r: 0.026 },
	{ a: 284, d: 1.55, r: 0.016 },
	{ a: 103, d: 1.52, r: 0.016 },
];

const LAND = {
	dropEnd: 0.15, // the falling drop hits here
	spreadEnd: 0.5, // the splat is fully out by here
	textHit: 0.68, // the stamped letters land here (kept in step with the text layer)
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOutBack = (u: number, c1 = 1.5) => {
	if (u <= 0) return 0;
	const c3 = c1 + 1;
	return 1 + c3 * (u - 1) ** 3 + c1 * (u - 1) ** 2;
};
const easeOutQuart = (u: number) => 1 - (1 - clamp01(u)) ** 4;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Point on the core's rim (ellipse with a gentle two-harmonic wobble) at angle `a`. */
function coreRim(a: number, sx: number, sy: number, wob: number, inflate: number) {
	const k =
		1 + 0.05 * Math.sin(3 * a + 0.7) + 0.035 * Math.sin(5 * a + 2.1) + 0.02 * Math.sin(7 * a + 0.4) + wob * Math.sin(4 * a + 1.3);
	return {
		x: CORE.x + Math.cos(a) * (CORE.rx * k * sx + inflate),
		y: CORE.y + Math.sin(a) * (CORE.ry * k * sy + inflate),
	};
}

function corePoly(sx: number, sy: number, wob: number, inflate: number, scale = 1, dx = 0, dy = 0) {
	const pts: number[] = [];
	const N = 72;
	for (let i = 0; i < N; i++) {
		const p = coreRim((i / N) * Math.PI * 2, sx * scale, sy * scale, wob, inflate);
		pts.push(p.x + dx, p.y + dy);
	}
	return pts;
}

/** Arm `i` as a tapered neck polygon from inside the core out to its bulb centre. */
function armGeom(arm: Arm, grow: number, sx: number, sy: number, wob: number) {
	const a = rad(arm.a);
	const edge = coreRim(a, sx, sy, wob, 0);
	const ux = Math.cos(a);
	const uy = Math.sin(a);
	const len = arm.len * grow;
	const bx = edge.x + ux * len;
	const by = edge.y + uy * len;
	return { ux, uy, sx0: edge.x - ux * 0.08, sy0: edge.y - uy * 0.08, bx, by, len: len + 0.08 };
}

function armPoly(arm: Arm, g: ReturnType<typeof armGeom>, grow: number, inflate: number) {
	const px = -g.uy;
	const py = g.ux;
	const pts: number[] = [];
	const N = 10;
	const bulb = arm.bulb * Math.min(1, grow * 1.4);
	// width tapers from the neck to ~60% of the bulb, so the arm pinches before its round end
	const wAt = (s: number) => arm.neck * (1 - s) + bulb * 0.62 * s + inflate;
	for (let i = 0; i <= N; i++) {
		const s = i / N;
		pts.push(g.sx0 + g.ux * g.len * s + px * wAt(s), g.sy0 + g.uy * g.len * s + py * wAt(s));
	}
	for (let i = N; i >= 0; i--) {
		const s = i / N;
		pts.push(g.sx0 + g.ux * g.len * s - px * wAt(s), g.sy0 + g.uy * g.len * s - py * wAt(s));
	}
	return { pts, bulb };
}

/** The whole splat for one frame, in box-height units (multiply by the box height to draw). */
export function splatShapes(f: SplatFrame): SplatShape[] {
	const out: SplatShape[] = [];
	const lt = f.land;
	// ── Falling drop (before impact) ────────────────────────────────────────────────────────────
	if (lt !== null && lt < LAND.dropEnd) {
		const q = lt / LAND.dropEnd;
		const y = -0.55 + (CORE.y + 0.55) * q * q; // gravity: accelerating
		const r = 0.13;
		const st = 1 + 0.55 * q;
		const alpha = Math.min(1, q * 6);
		out.push({ kind: 'ellipse', x: 0, y, rx: r / Math.sqrt(st) + RIM_W, ry: r * st + RIM_W, color: RIM, alpha });
		out.push({ kind: 'ellipse', x: 0, y, rx: r / Math.sqrt(st), ry: r * st, color: BODY, alpha });
		out.push({ kind: 'ellipse', x: -0.03, y: y - r * st * 0.4, rx: 0.022, ry: 0.035, color: GLOSS, alpha: 0.55 * alpha });
		return out;
	}
	// ── Spread + loop pose ───────────────────────────────────────────────────────────────────────
	let core = 1;
	let sx = 1;
	let sy = 1;
	let wob = 0;
	let armGrow = (_i: number) => 1;
	let dropP = 1;
	if (lt !== null) {
		const u = clamp01((lt - LAND.dropEnd) / (LAND.spreadEnd - LAND.dropEnd));
		core = 0.32 + 0.68 * easeOutBack(clamp01(u * 1.3), 1.2);
		// impact: spreads wide + flat, then rebounds (jelly)
		const e = Math.exp(-4.5 * u) * Math.cos(u * Math.PI * 2.6);
		sx = 1 + 0.2 * e;
		sy = 1 - 0.24 * e;
		// the stamped letters land → a smaller ripple
		const v = lt - LAND.textHit;
		if (v > 0) {
			const r = Math.exp(-7 * v) * Math.sin(v * Math.PI * 9);
			sx += 0.05 * r;
			sy -= 0.06 * r;
			wob = 0.025 * r;
		}
		armGrow = (i) => easeOutBack(clamp01((u - ((i * 3) % 5) * 0.05) / 0.62), 1.8);
		dropP = easeOutQuart((u - 0.04) / 0.75);
	}
	// loop: liquid breathing, height a beat behind width (same 1900 ms as the WILD text pulse)
	const ph = (Math.PI * 2 * f.t) / 1900;
	sx *= 1 + 0.035 * f.amp * Math.sin(ph);
	sy *= 1 + 0.035 * f.amp * Math.sin(ph - 0.55);
	wob += 0.012 * f.amp * Math.sin(ph * 0.5);
	const csx = sx * core;
	const csy = sy * core;
	const armLoop = (i: number) => 1 + 0.08 * f.amp * Math.sin(ph + i * 1.37);

	const geoms = ARMS.map((arm, i) => {
		const grow = armGrow(i) * armLoop(i);
		return { arm, grow, g: armGeom(arm, grow, csx, csy, wob) };
	});
	const drops = DROPS.map((d, i) => {
		const a = rad(d.a);
		const bob = 0.006 * f.amp * Math.sin(ph * 1.3 + i);
		const dist = d.d * dropP;
		return {
			x: CORE.x + Math.cos(a) * CORE.rx * dist * sx,
			y: CORE.y + Math.sin(a) * CORE.ry * dist * sy + bob,
			r: d.r * (0.5 + 0.5 * dropP),
			alpha: lt === null ? 1 : clamp01(dropP * 4),
		};
	});

	// Pass 1 = soft shadow, 2 = rim (inflated), 3 = body. Same shapes each pass so the union reads as
	// one puddle with one outline.
	const pass = (color: number, alpha: number, inflate: number, dx: number, dy: number) => {
		out.push({ kind: 'poly', pts: corePoly(csx, csy, wob, inflate, 1, dx, dy), color, alpha });
		for (const { arm, grow, g } of geoms) {
			if (grow <= 0.001) continue;
			const { pts, bulb } = armPoly(arm, g, grow, inflate);
			for (let k = 0; k < pts.length; k += 2) {
				pts[k] += dx;
				pts[k + 1] += dy;
			}
			out.push({ kind: 'poly', pts, color, alpha });
			out.push({ kind: 'circle', x: g.bx + dx, y: g.by + dy, r: bulb + inflate, color, alpha });
		}
		for (const d of drops) out.push({ kind: 'circle', x: d.x + dx, y: d.y + dy, r: d.r + inflate, color, alpha: alpha * d.alpha });
	};
	pass(SHADOW, 0.28, RIM_W, 0.012, 0.024);
	pass(RIM, 1, RIM_W, 0, 0);
	pass(BODY, 1, 0, 0, 0);
	// lit middle + gloss, all on the core (where the letters sit)
	out.push({ kind: 'poly', pts: corePoly(csx, csy, wob, 0, 0.72, -0.015, -0.03), color: MID, alpha: 0.85 });
	out.push({ kind: 'ellipse', x: CORE.x - 0.16 * csx, y: CORE.y - 0.15 * csy, rx: 0.07 * csx, ry: 0.028 * csy, color: GLOSS, alpha: 0.38 });
	out.push({ kind: 'circle', x: CORE.x - 0.245 * csx, y: CORE.y - 0.1 * csy, r: 0.016 * core, color: GLOSS, alpha: 0.5 });
	for (const { arm, grow, g } of geoms) {
		if (grow < 0.6) continue;
		const b = arm.bulb * Math.min(1, grow);
		out.push({ kind: 'circle', x: g.bx - b * 0.35, y: g.by - b * 0.38, r: b * 0.3, color: GLOSS, alpha: 0.42 });
	}
	for (const d of drops) out.push({ kind: 'circle', x: d.x - d.r * 0.35, y: d.y - d.r * 0.38, r: d.r * 0.32, color: GLOSS, alpha: 0.45 * d.alpha });
	return out;
}

// Win drips: off each dripping bulb a drop swells and stretches down on a thinning neck, pinches off
// and falls a short way, fading — staggered so the bulbs never drip in unison.
const DRIP_PERIOD = 2300;
export function splatDrips(t: number, amp: number): SplatShape[] {
	if (amp <= 0) return [];
	const out: SplatShape[] = [];
	const ph = (Math.PI * 2 * t) / 1900;
	DRIP_ARMS.forEach((ai, j) => {
		const arm = ARMS[ai];
		const g = armGeom(arm, 1 + 0.08 * amp * Math.sin(ph + ai * 1.37), 1, 1, 0);
		const x = g.bx;
		const y0 = g.by + arm.bulb * 0.75;
		const p = (((t + j * DRIP_PERIOD * 0.55) % DRIP_PERIOD) + DRIP_PERIOD) % DRIP_PERIOD / DRIP_PERIOD;
		const PINCH = 0.62;
		let y: number;
		let r: number;
		let neck = 0;
		let alpha = 1;
		if (p < PINCH) {
			const q = p / PINCH;
			r = 0.012 + 0.022 * Math.sqrt(q); // swells
			y = y0 + 0.07 * q * q; // stretches down, slowly at first
			neck = 1 - 0.55 * q;
		} else {
			const q = (p - PINCH) / (1 - PINCH);
			r = 0.034 * (1 - 0.25 * q);
			y = y0 + 0.07 + 0.2 * q * q; // falls
			alpha = 1 - Math.max(0, (q - 0.5) / 0.5);
		}
		alpha *= amp;
		const st = 1.25;
		for (const [color, inflate] of [[RIM, RIM_W * 0.8], [BODY, 0]] as const) {
			if (neck > 0) {
				const nw = (arm.bulb * 0.55 * neck + inflate) * 1;
				out.push({ kind: 'poly', pts: [x - nw, y0 - 0.02, x + nw, y0 - 0.02, x + r * 0.45 + inflate, y, x - r * 0.45 - inflate, y], color, alpha });
			}
			out.push({ kind: 'ellipse', x, y, rx: r + inflate, ry: r * st + inflate, color, alpha });
		}
		out.push({ kind: 'circle', x: x - r * 0.35, y: y - r * 0.4, r: r * 0.3, color: GLOSS, alpha: 0.45 * alpha });
	});
	return out;
}

export const WILD_SPLAT_LAND = LAND;
