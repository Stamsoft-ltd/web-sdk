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
