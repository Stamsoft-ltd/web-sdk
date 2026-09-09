// Layered "come alive" symbols. A symbol listed here is reassembled from its part sprites and plays
// a one-shot animation when it wins/locks (see AnimatedSymbol.svelte). Each layer is placed by its
// normalized centre (nx, ny) and size (nw, nh) inside the assembled tight bounding box (aspect =
// width/height), drawn back-to-front. The dy/dx/rot/freq/phase tune that layer's one-shot motion
// (dy/dx as fractions of the symbol height, rot in radians; freq = oscillations over the play).
// Layouts are baked from the source parts — see scratchpad/assemble.py (burger) and
// scratchpad/soup_assemble.py (soup pot).

export type SymbolPartLayer = {
	key: string;
	nx: number;
	ny: number;
	nw: number;
	nh: number;
	dy: number;
	dx: number;
	rot: number;
	freq: number;
	phase: number;
};

export type SymbolPartsConfig = {
	aspect: number;
	fit: number; // fraction of the symbol cell to fill (art has no built-in padding)
	squash?: number; // whole-symbol squash-stretch amount on the one-shot (for one-piece symbols)
	layers: SymbolPartLayer[];
};

export const SYMBOL_PARTS: Record<string, SymbolPartsConfig> = {
	// Burger — bun / lettuce / tomato / onion / cheese / patty / bottom bun.
	H1: {
		aspect: 1.077,
		fit: 0.82,
		layers: [
			{ key: 'burgerBunBottom', nx: 0.5, ny: 0.8587, nw: 0.9453, nh: 0.2826, dy: 0.004, dx: 0, rot: 0, freq: 1.0, phase: 0.0 },
			{ key: 'burgerPatty', nx: 0.5, ny: 0.7389, nw: 1.0, nh: 0.3694, dy: 0.008, dx: 0, rot: 0.004, freq: 1.15, phase: 0.6 },
			{ key: 'burgerCheese', nx: 0.5, ny: 0.662, nw: 0.9435, nh: 0.2786, dy: 0.012, dx: 0.005, rot: 0.008, freq: 1.35, phase: 1.1 },
			{ key: 'burgerOnion', nx: 0.5, ny: 0.6191, nw: 0.7322, nh: 0.1847, dy: 0.016, dx: 0.008, rot: 0.01, freq: 1.5, phase: 1.9 },
			{ key: 'burgerTomato', nx: 0.5, ny: 0.5921, nw: 0.8276, nh: 0.2327, dy: 0.018, dx: 0.006, rot: 0.01, freq: 1.7, phase: 2.6 },
			{ key: 'burgerLettuce', nx: 0.5, ny: 0.5092, nw: 0.8981, nh: 0.2197, dy: 0.024, dx: 0.016, rot: 0.016, freq: 2.1, phase: 3.4 },
			{ key: 'burgerBunTop', nx: 0.5, ny: 0.2396, nw: 0.9685, nh: 0.4793, dy: 0.03, dx: 0.003, rot: 0.008, freq: 1.2, phase: 4.2 },
		],
	},
	// Soup pot — steam wafts up, blobs bob, spoon stirs, drips + label barely move.
	H2: {
		aspect: 1.162,
		fit: 0.95,
		layers: [
			{ key: 'soupSteam', nx: 0.5103, ny: 0.2084, nw: 0.5041, nh: 0.5796, dy: 0.05, dx: 0.03, rot: 0.02, freq: 2.2, phase: 0.5 },
			{ key: 'soupPot', nx: 0.5, ny: 0.6275, nw: 1.0072, nh: 0.8228, dy: 0.006, dx: 0, rot: 0.003, freq: 1.0, phase: 0.0 },
			{ key: 'soupBlobs', nx: 0.5309, ny: 0.412, nw: 0.3979, nh: 0.4431, dy: 0.02, dx: 0.012, rot: 0.03, freq: 1.9, phase: 2.3 },
			{ key: 'soupDrips', nx: 0.4845, ny: 0.5796, nw: 0.6454, nh: 0.7329, dy: 0.01, dx: 0.006, rot: 0.008, freq: 1.5, phase: 1.4 },
			{ key: 'soupLabel', nx: 0.5103, ny: 0.7293, nw: 0.5052, nh: 0.5401, dy: 0.004, dx: 0, rot: 0.004, freq: 1.2, phase: 3.0 },
			{ key: 'soupSpoon', nx: 0.8639, ny: 0.3904, nw: 0.2113, nh: 0.279, dy: 0.012, dx: 0.012, rot: 0.06, freq: 1.4, phase: 4.0 },
		],
	},
	// Sausage — smoke wafts up off a sizzling banger.
	H3: {
		aspect: 0.906,
		fit: 0.92,
		squash: 0.04,
		layers: [
			{ key: 'sausageSmoke', nx: 0.6156, ny: 0.2706, nw: 0.1455, nh: 0.5412, dy: 0.06, dx: 0.03, rot: 0.03, freq: 2.4, phase: 0.5 },
			{ key: 'sausageBody', nx: 0.4987, ny: 0.6118, nw: 1.0, nh: 0.8871, dy: 0.012, dx: 0.008, rot: 0.02, freq: 1.6, phase: 2.0 },
		],
	},
	// Onion rings — two rings leaning together, jiggling on the one-shot.
	H5: {
		aspect: 1.377,
		fit: 0.86,
		squash: 0.03,
		layers: [
			{ key: 'onionRing2', nx: 0.4265, ny: 0.4379, nw: 0.8537, nh: 0.8758, dy: 0.02, dx: 0.012, rot: 0.03, freq: 1.6, phase: 0.5 },
			{ key: 'onionRing1', nx: 0.5648, ny: 0.6082, nw: 0.8697, nh: 0.7826, dy: 0.026, dx: 0.016, rot: 0.04, freq: 1.85, phase: 2.2 },
		],
	},
	// Cheese — one melty slice, so it comes alive with a squash-stretch jiggle.
	H4: {
		aspect: 1.259,
		fit: 0.84,
		squash: 0.1,
		layers: [
			{ key: 'cheeseSlice', nx: 0.5, ny: 0.5, nw: 1.0, nh: 1.0, dy: 0.02, dx: 0, rot: 0.018, freq: 1.6, phase: 0.0 },
		],
	},
};
