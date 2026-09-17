// Layered "come alive" symbols. A symbol listed here is reassembled from its part sprites and plays
// a one-shot animation when it wins/locks (see AnimatedSymbol.svelte). Each layer is placed by its
// normalized centre (nx, ny) and size (nw, nh) inside the assembled tight bounding box (aspect =
// width/height), drawn back-to-front. On the one-shot each layer travels out along (dx, dy) —
// fractions of the symbol width/height (dy>0 = down) — and rotates by `rot` radians, then returns.
// Layouts baked from the source parts — see scratchpad/assemble.py, soup_assemble.py, etc.

export type SymbolPartLayer = {
	key: string;
	nx: number;
	ny: number;
	nw: number;
	nh: number;
	dx?: number; // horizontal travel at peak (fraction of symbol width)
	dy?: number; // vertical travel at peak (fraction of symbol height; +down)
	rot?: number; // in-plane tilt swing at peak (radians)
	spin?: number; // horizontal squeeze at peak — reads as turning about the vertical axis (unscrew)
	orbit?: number; // radius of a circular path (fraction of symbol size) — e.g. a spoon stirring
	pop?: number; // uniform scale pulse at peak — e.g. a bubble popping
	// Rising smoke/steam: the layer escapes upward off its base, wafting + growing + fading, looping.
	rise?: number; // how far up it rises (fraction of symbol height)
	sway?: number; // horizontal waft amplitude as it rises (fraction of width)
	grow?: number; // how much it grows by the top (default 0.4)
	landDelay?: number; // land one-shot: fraction of the drop-in to wait before this layer scales in
	tilt?: number; // small signed rock (radians, sin-driven) about `pivotY` — e.g. a cap rocking
	pivotY?: number; // rotation pivot offset from the sprite centre (fraction of h; negative = up)
};

export type SymbolPartsConfig = {
	aspect: number;
	fit: number; // fraction of the symbol cell to fill (art has no built-in padding)
	squash?: number; // whole-symbol squash-stretch at peak (for one-piece symbols)
	// When set, the symbol plays a one-shot on landing: each layer scales in (0 → overshoot → 1) at
	// its own `landDelay`, so e.g. the wild's red splat splashes in first, then the WILD text pops.
	landAnim?: boolean;
	layers: SymbolPartLayer[];
};

// Symbols that aren't split into parts yet still come alive when locked, via a whole-sprite
// wiggle (bob + squash + slight tilt) using the flat symbol sprite as a single layer.
export const fallbackConfig = (assetKey: string): SymbolPartsConfig => ({
	aspect: 131 / 120, // SYMBOL_WIDTH / SYMBOL_SIZE, so it renders at the normal sprite footprint
	fit: 1,
	squash: 0.13,
	layers: [{ key: assetKey, nx: 0.5, ny: 0.5, nw: 1, nh: 1, dx: 0, dy: -0.05, rot: 0.08 }],
});

// The bottle is reassembled from its body + cap parts (complementary halves cut at the neck, so they
// stack back into the exact flat sprite — no seam at rest). While active the whole bottle gives a
// gentle squash and the CAP twists about its vertical axis (spin = horizontal squeeze), reading as
// the cap turning like it's being screwed on. Spin is symmetric about the cap centre and never lifts
// the cap's bottom edge, so the neck underneath is never exposed (the old whole-sprite reason for not
// splitting it). Body raster 318×291 (content is the lower neck+body); cap raster 318×168 (content is
// the top 84px) seated at the top so its base meets the body neck.
const bottle = (n: string): SymbolPartsConfig => ({
	aspect: 131 / 120, // the flat sprite's footprint (both parts share the 360×360 sprite canvas)
	fit: 1,
	squash: 0.06,
	layers: [
		// Body (neck + bottle) and cap (tip + collar) are the splash-free flat sprite cut at the neck,
		// each kept in the full 360×360 canvas so they stack back into the exact bottle at rest. They
		// overlap ~15px at the neck so the cap's spin never exposes the background behind it.
		{ key: `bottle${n}Body`, nx: 0.5, ny: 0.5, nw: 1, nh: 1 },
		// Cap rocks very slightly about its base (the neck) — realistic little wobble, not a slide.
		{ key: `bottle${n}Cap`, nx: 0.5, ny: 0.5, nw: 1, nh: 1, tilt: 0.06, pivotY: -0.15 },
	],
});

export const SYMBOL_PARTS: Record<string, SymbolPartsConfig> = {
	L1: bottle('L1'),
	L2: bottle('L2'),
	L3: bottle('L3'),
	L4: bottle('L4'),
	L5: bottle('L5'),
	// Burger — the stack separates (bun up, bottom down, fillings fan out) then reassembles.
	H1: {
		aspect: 1.077,
		fit: 0.64,
		squash: 0.03,
		layers: [
			{ key: 'burgerBunBottom', nx: 0.5, ny: 0.8587, nw: 0.9453, nh: 0.2826, dy: 0.2, dx: 0, rot: 0 },
			{ key: 'burgerPatty', nx: 0.5, ny: 0.7389, nw: 1.0, nh: 0.3694, dy: 0.1, dx: -0.02, rot: -0.05 },
			{ key: 'burgerCheese', nx: 0.5, ny: 0.662, nw: 0.9435, nh: 0.2786, dy: 0.03, dx: 0.03, rot: 0.06 },
			{ key: 'burgerOnion', nx: 0.5, ny: 0.6191, nw: 0.7322, nh: 0.1847, dy: -0.03, dx: -0.05, rot: -0.08 },
			{ key: 'burgerTomato', nx: 0.5, ny: 0.5921, nw: 0.8276, nh: 0.2327, dy: -0.09, dx: 0.04, rot: 0.07 },
			{ key: 'burgerLettuce', nx: 0.5, ny: 0.5092, nw: 0.8981, nh: 0.2197, dy: -0.16, dx: -0.04, rot: -0.1 },
			{ key: 'burgerBunTop', nx: 0.5, ny: 0.2396, nw: 0.9685, nh: 0.4793, dy: -0.26, dx: 0, rot: 0.05 },
		],
	},
	// Soup pot — steam escapes upward off the pot; the spoon stirs a small circle but sits UNDER the
	// liquid (only the handle pokes out) because the extracted liquid surface is redrawn over it.
	// Draw order: steam, pot, spoon, liquid (submerges the spoon bowl), blobs (surface), drips, label.
	H2: {
		aspect: 1.2565,
		fit: 0.95,
		squash: 0,
		layers: [
			{ key: 'soupSteam', nx: 0.5103, ny: 0.2021, nw: 0.3784, nh: 0.4702, rise: 0.24, sway: 0.05, grow: 0.4 },
			{ key: 'soupPot', nx: 0.5, ny: 0.5972, nw: 1.0072, nh: 0.8899 },
			{ key: 'soupSpoon', nx: 0.5732, ny: 0.335, nw: 0.1773, nh: 0.2539, orbit: 0.025, rot: 0.08 },
			{ key: 'soupLiquid', nx: 0.5, ny: 0.5972, nw: 1.0072, nh: 0.8899 },
			{ key: 'soupBlobs', nx: 0.5309, ny: 0.364, nw: 0.3979, nh: 0.4793, pop: 0.4, rot: 0.12 },
			{ key: 'soupDrips', nx: 0.4845, ny: 0.5453, nw: 0.6454, nh: 0.7927, dy: 0.015, rot: 0.03 },
			{ key: 'soupLabel', nx: 0.5103, ny: 0.7073, nw: 0.5052, nh: 0.5842 },
		],
	},
	// Sausage — the banger stays put in its box; the smoke curls and wafts up like it's burning.
	H3: {
		aspect: 0.906,
		fit: 0.88,
		squash: 0,
		layers: [
			{ key: 'sausageSmoke', nx: 0.6156, ny: 0.32, nw: 0.11, nh: 0.42, rise: 0.24, sway: 0.06, grow: 0.4 },
			// Sizzles in place — a small jiggle + pulse, kept small so it never leaves the box.
			{ key: 'sausageBody', nx: 0.4987, ny: 0.6118, nw: 1.0, nh: 0.8871, dy: 0.012, dx: 0.01, rot: 0.03, pop: 0.03 },
		],
	},
	// Onion rings — three leaning rings that bounce apart and jostle (small tumble), not a flat spin.
	H5: {
		aspect: 1.377,
		fit: 0.86,
		squash: 0.05,
		layers: [
			{ key: 'onionRing3', nx: 0.3, ny: 0.615, nw: 0.72, nh: 0.66, dy: 0.055, dx: -0.075, rot: 0.16, pop: 0.05 },
			{ key: 'onionRing2', nx: 0.475, ny: 0.415, nw: 0.8, nh: 0.82, dy: -0.06, dx: -0.02, rot: 0.1, pop: 0.05 },
			{ key: 'onionRing1', nx: 0.605, ny: 0.63, nw: 0.8, nh: 0.72, dy: 0.07, dx: 0.055, rot: -0.12, pop: 0.05 },
		],
	},
	// Wild — on landing the red splat splashes in first, then the WILD text pops up→down once
	// (landAnim). Afterwards, while it wins/locks, the WILD text bounces while the splat pulses.
	W: {
		aspect: 1.361,
		fit: 0.82,
		squash: 0,
		landAnim: true,
		layers: [
			{ key: 'wildSplat', nx: 0.5, ny: 0.5, nw: 1.0, nh: 1.0, pop: 0.1, rot: 0.04, landDelay: 0 },
			{
				key: 'wildText',
				nx: 0.5,
				ny: 0.5,
				nw: 0.7889,
				nh: 0.6704,
				pop: 0.13,
				dy: -0.03,
				rot: 0.05,
				landDelay: 0.4,
			},
		],
	},
	// Scatter — the stand gives a gentle bob while its SCATTER sign sways like a hanging shingle.
	// (Real diner-stand art: base + the golden SCATTER sign that sits on the top plank.)
	S: {
		aspect: 0.999,
		fit: 0.86,
		squash: 0.03,
		layers: [
			{ key: 'scatterStand', nx: 0.5, ny: 0.5, nw: 1.0, nh: 1.0 },
			{ key: 'scatterBanner', nx: 0.485, ny: 0.132, nw: 0.68, nh: 0.232, rot: 0.07, dy: -0.01 },
		],
	},
	// Smutz cup — one whole sprite (straw included) that gives a soft squeeze + bob; splitting the
	// straw off left it poking out broken from behind the lid, so it stays a single piece.
	M: {
		aspect: 131 / 120, // the flat sprite's padded footprint — matches the normal cup size exactly
		fit: 1,
		squash: 0.09,
		layers: [{ key: 'mcM', nx: 0.5, ny: 0.5, nw: 1, nh: 1, dy: -0.02 }],
	},
	// Cheese — one whole slice (drips included) that gently jiggles; splitting the drips off left a
	// visible seam, so it stays a single piece.
	H4: {
		aspect: 131 / 120,
		fit: 1,
		squash: 0.09,
		layers: [{ key: 'mcH4', nx: 0.5, ny: 0.5, nw: 1, nh: 1, dy: -0.02 }],
	},
};
