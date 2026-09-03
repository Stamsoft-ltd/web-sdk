// Idle life for symbols that are static art and otherwise sit completely still between spins — the
// first thing a reviewer looks for on a slot, and the cheapest thing to fix in-engine.
//
// Procedural rather than a flipbook: there is no source video for either symbol, and a sheet would
// add texture memory on top of art already resident on the board. Everything here is a pure
// function of a clock and the cell's own phase, drawn imperatively into one shared Graphics from
// Board's existing frame loop — no reactivity in the render path, nothing accumulating per frame.
//
//   WILD (horseshoe magnet) — the field between its poles: an arc that snaps across with a
//                             stutter, plus a charge glow at each tip.
//   RING MAGNET (L2)        — the charge across a locked cluster.
//
// The SCATTER is deliberately absent: the Version2 capsule is assembled from separate textures so
// its alien can move and its bubbles can pass behind it, which this shared front-of-everything
// Graphics cannot express. See ScatterSymbol.svelte.

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
	/**
	 * Master opacity, matching whatever the symbol SPRITE is currently drawn at (0..1, default 1).
	 *
	 * These effects are drawn into a shared Graphics from Board's frame loop, not parented to the
	 * sprite, so nothing ties them to it automatically. The magnet pull dims every non-target cell
	 * to 0.08 — a scatter caught in that pass vanished while its electricity kept arcing at full
	 * strength in the empty cell. Callers pass the cell's real alpha so the two can never separate.
	 */
	alpha?: number;
};

const WILD_COLOR = 0x7fd4ff;
const WILD_HOT = 0xffffff;

// Poles of the horseshoe, as fractions of the symbol box measured off wild.webp: the two tips sit
// low and about a third of the width apart either side of centre.
const POLE_DX = 0.19;
const POLE_DY = 0.2;

/**
 * UNUSED since <WildSymbol> landed (2026-09-02). It drew cyan arcs across the horseshoe's poles from
 * a board-wide additive Graphics in front of every symbol, which the MOTHERSHIP wild cannot use: its
 * eye, bolt and plaque have to layer among each other, and POLE_DX/POLE_DY below were measured off
 * the OLD wild.webp, whose caps sat lower than the redesign's. Kept only as the reference for what
 * that arc looked like; delete it once nothing wants it back.
 */
export const drawWildIdle = (g: SpecialIdleG, o: Opts) => {
	const A = o.alpha ?? 1;
	if (A <= 0.01) return;
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
			g.fill({ color: k === 0 ? WILD_HOT : WILD_COLOR, alpha: (0.3 - 0.09 * k) * charge * A });
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
			alpha: (pass === 0 ? 0.5 : 0.85) * fire * A,
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
	const A = o.alpha ?? 1;
	if (A <= 0.01) return;
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
			g.fill({ color: k === 0 ? RING_HOT : RING_COLOR, alpha: (0.32 - 0.09 * k) * charge * A });
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
			alpha: (pass === 0 ? 0.55 : 0.9) * fire * A,
			cap: 'round',
			join: 'round',
		});
	}
};
