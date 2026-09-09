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
	rot?: number; // rotation swing at peak (radians)
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

export const SYMBOL_PARTS: Record<string, SymbolPartsConfig> = {
	// Burger — the stack separates (bun up, bottom down, fillings fan out) then reassembles.
	H1: {
		aspect: 1.077,
		fit: 0.82,
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
	// Soup pot — the spoon stirs (big rotation), blobs swirl, steam wafts up.
	H2: {
		aspect: 1.162,
		fit: 0.95,
		squash: 0.02,
		layers: [
			{ key: 'soupSteam', nx: 0.5103, ny: 0.2084, nw: 0.5041, nh: 0.5796, dy: -0.2, dx: 0.06, rot: 0.14 },
			{ key: 'soupPot', nx: 0.5, ny: 0.6275, nw: 1.0072, nh: 0.8228, dy: 0, dx: 0, rot: 0 },
			{ key: 'soupBlobs', nx: 0.5309, ny: 0.412, nw: 0.3979, nh: 0.4431, dy: -0.05, dx: 0.06, rot: 0.3 },
			{ key: 'soupDrips', nx: 0.4845, ny: 0.5796, nw: 0.6454, nh: 0.7329, dy: 0.03, dx: 0, rot: 0.06 },
			{ key: 'soupLabel', nx: 0.5103, ny: 0.7293, nw: 0.5052, nh: 0.5401, dy: 0, dx: 0, rot: 0 },
			{ key: 'soupSpoon', nx: 0.8639, ny: 0.3904, nw: 0.2113, nh: 0.279, dy: -0.04, dx: 0.04, rot: 0.6 },
		],
	},
	// Sausage — smoke wafts up, banger sizzles.
	H3: {
		aspect: 0.906,
		fit: 0.92,
		squash: 0.05,
		layers: [
			{ key: 'sausageSmoke', nx: 0.6156, ny: 0.2706, nw: 0.1455, nh: 0.5412, dy: -0.24, dx: 0.1, rot: 0.2 },
			{ key: 'sausageBody', nx: 0.4987, ny: 0.6118, nw: 1.0, nh: 0.8871, dy: 0.02, dx: 0.02, rot: 0.14 },
		],
	},
	// Onion rings — the two rings tumble/rotate apart then settle.
	H5: {
		aspect: 1.377,
		fit: 0.86,
		squash: 0.03,
		layers: [
			{ key: 'onionRing2', nx: 0.4265, ny: 0.4379, nw: 0.8537, nh: 0.8758, dy: -0.05, dx: -0.06, rot: 0.35 },
			{ key: 'onionRing1', nx: 0.5648, ny: 0.6082, nw: 0.8697, nh: 0.7826, dy: 0.06, dx: 0.06, rot: -0.4 },
		],
	},
	// Cheese — one melty slice, so it comes alive with a squash-stretch + tilt.
	H4: {
		aspect: 1.259,
		fit: 0.84,
		squash: 0.16,
		layers: [
			{ key: 'cheeseSlice', nx: 0.5, ny: 0.5, nw: 1.0, nh: 1.0, dy: -0.03, dx: 0, rot: 0.16 },
		],
	},
};
