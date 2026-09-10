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
};

export type SymbolPartsConfig = {
	aspect: number;
	fit: number; // fraction of the symbol cell to fill (art has no built-in padding)
	squash?: number; // whole-symbol squash-stretch at peak (for one-piece symbols)
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

// The bottle animates as ONE whole sprite (squeeze) — splitting the cap off left a visible seam and
// showed the background through the gap, so it stays a single piece that narrows + rises.
const bottle = (n: string): SymbolPartsConfig => ({
	aspect: 131 / 120, // the flat sprite's footprint
	fit: 1,
	squash: 0.1,
	layers: [{ key: `mc${n}`, nx: 0.5, ny: 0.5, nw: 1, nh: 1, dy: -0.02 }],
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
		fit: 0.72,
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
	// Soup pot — steam escapes upward off the pot; the spoon (dipped in, mostly submerged) stirs a
	// small circle; bubbles pop on the surface. Draw order: steam, pot, spoon, blobs (over the bowl),
	// drips, label.
	H2: {
		aspect: 1.162,
		fit: 0.95,
		squash: 0,
		layers: [
			{ key: 'soupSteam', nx: 0.5103, ny: 0.2084, nw: 0.5041, nh: 0.5796, rise: 0.26, sway: 0.05, grow: 0.5 },
			{ key: 'soupPot', nx: 0.5, ny: 0.6275, nw: 1.0072, nh: 0.8228 },
			{ key: 'soupSpoon', nx: 0.5753, ny: 0.424, nw: 0.1773, nh: 0.2347, orbit: 0.03, rot: 0.1 },
			{ key: 'soupBlobs', nx: 0.5309, ny: 0.412, nw: 0.3979, nh: 0.4431, pop: 0.4, rot: 0.12 },
			{ key: 'soupDrips', nx: 0.4845, ny: 0.5796, nw: 0.6454, nh: 0.7329, dy: 0.015, rot: 0.03 },
			{ key: 'soupLabel', nx: 0.5103, ny: 0.7293, nw: 0.5052, nh: 0.5401 },
		],
	},
	// Sausage — the banger stays put in its box; the smoke curls and wafts up like it's burning.
	H3: {
		aspect: 0.906,
		fit: 0.88,
		squash: 0,
		layers: [
			{ key: 'sausageSmoke', nx: 0.6156, ny: 0.2706, nw: 0.1455, nh: 0.5412, rise: 0.28, sway: 0.06, grow: 0.5 },
			// Sizzles in place — a small jiggle + pulse, kept small so it never leaves the box.
			{ key: 'sausageBody', nx: 0.4987, ny: 0.6118, nw: 1.0, nh: 0.8871, dy: 0.012, dx: 0.01, rot: 0.03, pop: 0.03 },
		],
	},
	// Onion rings — the two rings bounce apart and jostle (small tumble), not a flat in-plane spin.
	H5: {
		aspect: 1.377,
		fit: 0.86,
		squash: 0.05,
		layers: [
			{ key: 'onionRing2', nx: 0.4265, ny: 0.4379, nw: 0.8537, nh: 0.8758, dy: -0.06, dx: -0.035, rot: 0.1, pop: 0.05 },
			{ key: 'onionRing1', nx: 0.5648, ny: 0.6082, nw: 0.8697, nh: 0.7826, dy: 0.07, dx: 0.04, rot: -0.12, pop: 0.05 },
		],
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
