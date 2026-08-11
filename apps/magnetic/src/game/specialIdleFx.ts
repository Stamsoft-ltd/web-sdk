// Idle life for the two SPECIAL symbols. Both are static art and sat completely still between
// spins — the first thing a reviewer looks for on a slot, and the cheapest thing to fix in-engine.
//
// Procedural rather than a flipbook: there is no source video for either symbol, and a sheet would
// add texture memory on top of art already resident on the board. Everything here is a pure
// function of a clock and the cell's own phase, drawn imperatively into one shared Graphics from
// Board's existing frame loop — no reactivity in the render path, nothing accumulating per frame.
//
//   WILD (horseshoe magnet) — the field between its poles: an arc that snaps across with a
//                             stutter, plus a charge glow at each tip.
//   SCATTER (vortex core)   — a ring that breathes and a counter-rotating inner spin, so the core
//                             reads as spooling up rather than merely lit.

export type SpecialIdleG = {
	destroyed: boolean;
	clear: () => void;
	circle: (x: number, y: number, r: number) => unknown;
	ellipse: (x: number, y: number, rx: number, ry: number) => unknown;
	moveTo: (x: number, y: number) => void;
	lineTo: (x: number, y: number) => void;
	stroke: (s: object) => void;
	fill: (s: object) => void;
};

type Opts = {
	x: number;
	y: number;
	w: number;
	h: number;
	/** Seconds. */
	t: number;
	/** 0..1 per-cell hash so two specials never pulse in lockstep. */
	phase: number;
};

const WILD_COLOR = 0x7fd4ff;
const WILD_HOT = 0xffffff;
const SCATTER_COLOR = 0xc06bff;

// Poles of the horseshoe, as fractions of the symbol box measured off wild.webp: the two tips sit
// low and about a third of the width apart either side of centre.
const POLE_DX = 0.19;
const POLE_DY = 0.2;

export const drawWildIdle = (g: SpecialIdleG, o: Opts) => {
	const p = o.phase * 6.28;
	const lx = o.x - o.w * POLE_DX;
	const rx = o.x + o.w * POLE_DX;
	const py = o.y + o.h * POLE_DY;

	// Charge at the tips — always on, breathing slowly.
	const charge = 0.55 + 0.45 * Math.sin(o.t * 2.1 + p);
	for (const tx of [lx, rx]) {
		for (let k = 0; k < 3; k++) {
			const r = o.w * (0.035 + 0.045 * k);
			g.circle(tx, py, r);
			g.fill({ color: k === 0 ? WILD_HOT : WILD_COLOR, alpha: (0.3 - 0.09 * k) * charge });
		}
	}

	// The arc itself only fires in bursts — a continuous bolt reads as a decal, a stuttering one
	// reads as a field trying to close. `fire` is a short window on a ~2.2s cycle.
	const cycle = (o.t * 0.45 + o.phase) % 1;
	const fire = cycle < 0.22 ? Math.sin((cycle / 0.22) * Math.PI) : 0;
	if (fire <= 0.02) return;
	const SEGS = 7;
	for (let pass = 0; pass < 2; pass++) {
		g.moveTo(lx, py);
		for (let i = 1; i <= SEGS; i++) {
			const f = i / SEGS;
			const bx = lx + (rx - lx) * f;
			// Sag in the middle, jitter re-rolled every frame from the clock so the arc crackles.
			const sag = Math.sin(f * Math.PI) * o.h * 0.12;
			const jit = Math.sin(o.t * 41 + i * 2.7 + p) * o.h * 0.035 * Math.sin(f * Math.PI);
			g.lineTo(bx, py - sag + jit);
		}
		g.stroke({
			width: o.w * (pass === 0 ? 0.028 : 0.012),
			color: pass === 0 ? WILD_COLOR : WILD_HOT,
			alpha: (pass === 0 ? 0.5 : 0.85) * fire,
			cap: 'round',
			join: 'round',
		});
	}
};

// RING MAGNET (L2, nut.webp — the orange C with a grey block at each end of its gap). Replaces the
// `ringmag_stack` flipbook, which read as a generic shimmer over the whole tile. The C's OPENING is
// the interesting part of the art, so the field arcs straight across it, terminal to terminal.
//
// The two terminals were located by keying the low-saturation grey against the orange body and
// taking the surviving blobs' centroids (scratchpad/ringmag): the block at (0.6875, 0.2008) and the
// wedge at (0.8460, 0.3125) of the sprite box. The third grey blob the key finds — the big block at
// the lower left — is decoration sitting ON the ring, not a terminal, so it is not an endpoint.
const RING_POLE_A = { x: 0.6875, y: 0.2008 };
const RING_POLE_B = { x: 0.846, y: 0.3125 };
const RING_COLOR = 0xffb066;
const RING_HOT = 0xffffff;

export const drawRingMagIdle = (g: SpecialIdleG, o: Opts) => {
	const p = o.phase * 6.28;
	const ax = o.x + (RING_POLE_A.x - 0.5) * o.w;
	const ay = o.y + (RING_POLE_A.y - 0.5) * o.h;
	const bx = o.x + (RING_POLE_B.x - 0.5) * o.w;
	const by = o.y + (RING_POLE_B.y - 0.5) * o.h;

	// Charge sitting on both terminals — always on, so the gap reads as live even between strikes.
	const charge = 0.5 + 0.5 * Math.sin(o.t * 2.6 + p);
	for (const [tx, ty] of [
		[ax, ay],
		[bx, by],
	]) {
		for (let k = 0; k < 3; k++) {
			g.circle(tx, ty, o.w * (0.03 + 0.04 * k));
			g.fill({ color: k === 0 ? RING_HOT : RING_COLOR, alpha: (0.32 - 0.09 * k) * charge });
		}
	}

	// The strike itself is intermittent: a continuous bolt across a gap this short reads as a
	// painted-on decal. ~1.7s cycle, lit for the first third of it.
	const cycle = (o.t * 0.58 + o.phase) % 1;
	const fire = cycle < 0.34 ? Math.sin((cycle / 0.34) * Math.PI) : 0;
	if (fire <= 0.02) return;

	// The gap is narrow, so the bolt is jittered PERPENDICULAR to the terminal-to-terminal line
	// rather than along a fixed axis — a vertical-only jitter would collapse to a straight line
	// whenever the two terminals happen to sit near-vertical of each other.
	const dx = bx - ax;
	const dy = by - ay;
	const len = Math.hypot(dx, dy) || 1;
	const nx = -dy / len;
	const ny = dx / len;
	const SEGS = 6;
	for (let pass = 0; pass < 2; pass++) {
		g.moveTo(ax, ay);
		for (let i = 1; i <= SEGS; i++) {
			const f = i / SEGS;
			const spread = Math.sin(f * Math.PI); // pinned at both terminals, loosest mid-gap
			const jit = Math.sin(o.t * 47 + i * 2.3 + p) * len * 0.3 * spread;
			g.lineTo(ax + dx * f + nx * jit, ay + dy * f + ny * jit);
		}
		g.stroke({
			width: o.w * (pass === 0 ? 0.032 : 0.013),
			color: pass === 0 ? RING_COLOR : RING_HOT,
			alpha: (pass === 0 ? 0.55 : 0.9) * fire,
			cap: 'round',
			join: 'round',
		});
	}
};

export const drawScatterIdle = (g: SpecialIdleG, o: Opts) => {
	const p = o.phase * 6.28;
	const r0 = Math.min(o.w, o.h) * 0.26;

	// Breathing ring.
	const pulse = 0.5 + 0.5 * Math.sin(o.t * 1.6 + p);
	for (let k = 0; k < 3; k++) {
		const r = r0 * (1 + 0.12 * k + 0.06 * pulse);
		g.circle(o.x, o.y, r);
		g.stroke({
			width: o.w * (0.02 - 0.005 * k),
			color: SCATTER_COLOR,
			alpha: (0.34 - 0.1 * k) * (0.45 + 0.55 * pulse),
		});
	}

	// Counter-rotating motes: the core spooling. Two rings turning opposite ways.
	for (let ring = 0; ring < 2; ring++) {
		const dir = ring === 0 ? 1 : -1;
		const rr = r0 * (ring === 0 ? 0.62 : 0.92);
		const count = ring === 0 ? 3 : 5;
		for (let i = 0; i < count; i++) {
			const a = dir * o.t * (ring === 0 ? 1.7 : 1.05) + (i / count) * 6.28 + p;
			const mx = o.x + Math.cos(a) * rr;
			const my = o.y + Math.sin(a) * rr * 0.82;
			g.circle(mx, my, o.w * 0.016);
			g.fill({ color: ring === 0 ? WILD_HOT : SCATTER_COLOR, alpha: 0.5 + 0.3 * pulse });
		}
	}
};
