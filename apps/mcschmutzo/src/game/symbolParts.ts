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
	landDrop?: number; // per-layer override of config.landDrop (e.g. only the scatter sign falls in)
	tilt?: number; // small signed rock (radians, sin-driven) about `pivotY` — e.g. a cap rocking
	pivotY?: number; // rotation pivot offset from the sprite centre (fraction of h; negative = up)
	jitter?: number; // fast tiny shake (radians) while active — a sizzling twitch
	// Toss: the layer hops up (hop = height, fraction of symbol h) on a gravity arc, flips `flip`
	// times in the air (coin-turn = horizontal squeeze), lands with a squash + small rebound. `phase`
	// (0..1 of the loop) staggers layers so they're tossed one after another.
	hop?: number;
	flip?: number;
	phase?: number;
	// Ketchup slam (wild): `slam` = the layer hops up (fraction of symbol h) and SLAMS back down,
	// squashing on impact; `ripple` = the layer is the sauce it lands in — it ripples out from each
	// impact like liquid (amplitude as a scale fraction) and wobbles gently in between.
	slam?: number;
	ripple?: number;
	// Liquid pulse: the layer slowly swells and shrinks (fraction of its size), its width and height
	// slightly out of step like a wobbling puddle; `pulseLag` delays it (radians) behind the others.
	pulse?: number;
	pulseLag?: number;
	// Stamp landing (wild letters): the layer pops in on the splat as the drop hits (wildSplat
	// dropEnd): 0 → 125% at textHit (the impact) → 92% → 100%.
	landStamp?: boolean;
	// Sword swing (scatter): the layer rotates about (px, py) — its handle end, fractions of the
	// sprite — by up to `open` radians (signed) away from its rest pose, then slams back into it.
	swing?: { px: number; py: number; open: number };
	// Clash pop (scatter lettering): stamps in at the landing's first clash (AnimatedSymbol
	// SWORD_LAND_HITS) and gives a bump of this size (fraction of its size) at every clash after.
	clashPop?: number;
};

export type SymbolPartsConfig = {
	aspect: number;
	fit: number; // fraction of the symbol cell to fill (art has no built-in padding)
	squash?: number; // whole-symbol squash-stretch at peak (for one-piece symbols)
	// When set, the symbol plays a one-shot on landing: each layer scales in (0 → overshoot → 1) at
	// its own `landDelay`, so e.g. the wild's red splat splashes in first, then the WILD text pops.
	landAnim?: boolean;
	// Land one-shot tuning: `landMs` overrides the 800ms default (a multi-piece assemble needs longer),
	// and `landDrop` makes each piece FALL into place from this fraction of the symbol height above its
	// rest spot as it scales in — the burger stacks bottom-to-top, each slice splatting onto the last.
	landMs?: number;
	landDrop?: number;
	// Land as a real DROP: each layer falls in full-size from `landDrop` above (gravity, fading in),
	// SPLATS onto the stack (wide + flat squash at impact) and bounces once — instead of scaling in.
	// `landSlice` = each layer's own share of landMs (so the stagger doesn't speed up later slices).
	landFall?: boolean;
	landSlice?: number;
	// Alive at rest: keep the loop running (slower) whenever the symbol sits on the board, at this
	// fraction of the win/lock amplitude. Special symbols (wild, scatter) use it so they never read
	// as static tiles between spins.
	idle?: number;
	// Sauce squirt: while active, the bottle squeezes out a shot of sauce (this colour) each loop cycle —
	// the same squirt as the board chef's (ketchupSquirt.ts), scaled to the symbol. The nozzle defaults
	// to the bottle tip (top-centre); `dir` (+1 right / -1 left) leans the shot.
	squirt?: { color: number; nozzleNx?: number; nozzleNy?: number; dir?: number };
	// Melty cheese drip: while alive, slow gooey drops ooze from the tips of the painted drips (the
	// spots already stretched/hanging), swell into a teardrop, pinch off and fall a short way.
	// `points` are the drip origins (nx, ny within the symbol box) at the low points of the art's
	// bottom edge; each may carry its own `color` sampled from that painted drip (falls back to the
	// shared `color`).
	drip?: { color: number; points: { nx: number; ny: number; color?: number }[] };
	// Soda fizz: carbonation bubbles rise out of (nx, ny) — the straw/lid — wobbling, growing and
	// popping into a little ring at the top. `spread` = horizontal scatter (fraction of width).
	fizz?: { nx: number; ny: number; spread: number; color: number };
	// Sizzle: hot grease spits up off the food's surface at these points in short arcs and falls back,
	// with the odd bright spark — something frying on a hot grill.
	sizzle?: { color: number; points: { nx: number; ny: number }[] };
	// Splash: on each slam impact, ketchup droplets fly off the sauce's edge (an ellipse of radii
	// rx/ry, fractions of w/h) on short gravity arcs and fall away, while active.
	splash?: { color: number; rim: number; rx: number; ry: number };
	// Clash spark at (nx, ny) of the symbol box each time swinging layers slam closed.
	clash?: { nx: number; ny: number };
	// Painted drips (game/paintedDrip.ts) hanging off a layer's own art while active: `layer` = the
	// layer key (also its texture key), srcW / srcH = that art's size, tendrils in its pixels.
	paintedDrips?: {
		layer: string;
		srcW: number;
		srcH: number;
		tendrils: import('./paintedDrip').PaintedTendril[];
	};
	// The wild's ketchup splat, drawn in code under the layers (game/wildSplat.ts): drop → splat on
	// landing, breathing on the board, liquid wobble + drips while winning.
	splat?: boolean;
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
// capDy seats the cap a touch lower on the neck at rest (mayo keeps 0 — its cap is already seated).
const bottle = (n: string, sauce: number, capDy = 0.022): SymbolPartsConfig => ({
	aspect: 131 / 120, // the flat sprite's footprint (both parts share the 360×360 sprite canvas)
	fit: 1,
	squash: 0.06,
	squirt: { color: sauce },
	layers: [
		// Body (neck + bottle) and cap (tip + collar) are the splash-free flat sprite cut at the neck,
		// each kept in the full 360×360 canvas so they stack back into the exact bottle at rest. They
		// overlap ~15px at the neck so the cap's spin never exposes the background behind it.
		{ key: `bottle${n}Body`, nx: 0.5, ny: 0.5, nw: 1, nh: 1 },
		// Cap sits a touch lower (capDy) and rocks very slightly about its base — a realistic wobble.
		{ key: `bottle${n}Cap`, nx: 0.5, ny: 0.5 + capDy, nw: 1, nh: 1, tilt: 0.06, pivotY: -0.15 },
	],
});

export const SYMBOL_PARTS: Record<string, SymbolPartsConfig> = {
	L1: bottle('L1', 0xdb1812), // ketchup — tomato red (sampled from the sauce)
	L2: bottle('L2', 0xf7edcf, 0), // mayo — pale cream
	L3: bottle('L3', 0xdc9c02), // mustard — golden yellow
	L4: bottle('L4', 0xa62410), // BBQ — dark red-brown
	L5: bottle('L5', 0xaac14d), // avocado ranch — green
	// Burger — the stack separates (bun up, bottom down, fillings fan out) then reassembles.
	H1: {
		aspect: 1.077,
		fit: 0.64,
		squash: 0.03,
		layers: [
			{
				key: 'burgerBunBottom',
				nx: 0.5,
				ny: 0.8587,
				nw: 0.9453,
				nh: 0.2826,
				dy: 0.2,
				dx: 0,
				rot: 0,
			},
			{
				key: 'burgerPatty',
				nx: 0.5,
				ny: 0.7389,
				nw: 1.0,
				nh: 0.3694,
				dy: 0.1,
				dx: -0.02,
				rot: -0.05,
			},
			{
				key: 'burgerCheese',
				nx: 0.5,
				ny: 0.662,
				nw: 0.9435,
				nh: 0.2786,
				dy: 0.03,
				dx: 0.03,
				rot: 0.06,
			},
			{
				key: 'burgerOnion',
				nx: 0.5,
				ny: 0.6191,
				nw: 0.7322,
				nh: 0.1847,
				dy: -0.03,
				dx: -0.05,
				rot: -0.08,
			},
			{
				key: 'burgerTomato',
				nx: 0.5,
				ny: 0.5921,
				nw: 0.8276,
				nh: 0.2327,
				dy: -0.09,
				dx: 0.04,
				rot: 0.07,
			},
			{
				key: 'burgerLettuce',
				nx: 0.5,
				ny: 0.5092,
				nw: 0.8981,
				nh: 0.2197,
				dy: -0.16,
				dx: -0.04,
				rot: -0.1,
			},
			{
				key: 'burgerBunTop',
				nx: 0.5,
				ny: 0.2396,
				nw: 0.9685,
				nh: 0.4793,
				dy: -0.26,
				dx: 0,
				rot: 0.05,
			},
		],
	},
	// Soup pot (M — the rare multiplier symbol) — steam escapes upward off the pot; the spoon stirs a
	// small circle but sits UNDER the liquid (only the handle pokes out) because the extracted liquid
	// surface is redrawn over it.
	// Draw order: steam, pot, spoon, liquid (submerges the spoon bowl), blobs (surface), drips, label.
	M: {
		aspect: 1.2565,
		fit: 0.95,
		squash: 0,
		layers: [
			{
				key: 'soupSteam',
				nx: 0.5103,
				ny: 0.2021,
				nw: 0.3784,
				nh: 0.4702,
				rise: 0.24,
				sway: 0.05,
				grow: 0.4,
			},
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
			{
				key: 'sausageSmoke',
				nx: 0.6156,
				ny: 0.32,
				nw: 0.11,
				nh: 0.42,
				rise: 0.24,
				sway: 0.06,
				grow: 0.4,
			},
			// Sizzles in place — a small jiggle + pulse, kept small so it never leaves the box.
			{
				key: 'sausageBody',
				nx: 0.4987,
				ny: 0.55,
				nw: 1.0,
				nh: 0.8871,
				dy: 0.012,
				dx: 0.01,
				rot: 0.03,
				pop: 0.06, // juicy swell
				jitter: 0.018, // sizzling twitch
			},
		],
		// Grease spits off the top of the banger (points along its upper edge).
		sizzle: {
			color: 0xffc766,
			points: [
				{ nx: 0.3, ny: 0.34 },
				{ nx: 0.45, ny: 0.4 },
				{ nx: 0.6, ny: 0.5 },
				{ nx: 0.72, ny: 0.62 },
			],
		},
	},
	// Onion rings — tossed like they're being flipped in the fryer: one after another (back → middle →
	// front) each hops up, turns over in the air and lands with a squash, nudging the stack; the rest
	// of the stack gives a small sympathetic jiggle.
	H5: {
		aspect: 1.377,
		fit: 0.86,
		squash: 0.03,
		layers: [
			{ key: 'onionRing3', nx: 0.3, ny: 0.615, nw: 0.72, nh: 0.66, hop: 0.2, flip: 1, phase: 0, rot: 0.05, dx: -0.02 },
			{ key: 'onionRing2', nx: 0.475, ny: 0.415, nw: 0.8, nh: 0.82, hop: 0.24, flip: 1, phase: 0.33, rot: -0.04 },
			{ key: 'onionRing1', nx: 0.605, ny: 0.63, nw: 0.8, nh: 0.72, hop: 0.2, flip: 1, phase: 0.66, rot: 0.05, dx: 0.02 },
		],
	},
	// Wild — on landing a drop of ketchup falls into the cell and SPLATS (drawn in code, see
	// game/wildSplat.ts), the WILD letters pop on top of it (0 → 125% → 92% → 100%), the whole symbol
	// shakes a few px on their impact and a drip forms off the splat as it settles. Several wilds landing
	// on the same frame hit one after another (AnimatedSymbol WILD_STAGGER_MS). While part of a win the
	// puddle wobbles like liquid (the letters ride it a beat behind) and drops ooze off its bottom lobes.
	W: {
		aspect: 1.361,
		fit: 0.82,
		squash: 0,
		landAnim: true,
		landMs: 900,
		idle: 0.45,
		splat: true,
		layers: [
			{ key: 'wildText', nx: 0.5, ny: 0.5, nw: 0.7889, nh: 0.6704, pulse: 0.05, pulseLag: 0.7, landStamp: true },
		],
	},
	// Scatter — crossed spatula + chef's knife + the SCATTER lettering on top (Figma 8844:1585 + 8844:1704
	// in the design cell; the tools' 96×93 group is the box, the lettering hangs 3% past its right
	// edge and 1% past its bottom, over the handles). The tools
	// cross like swords: EVERY landing they pop in already swung apart, hang there a beat, then slam
	// together into the cross (clash + spark), spring apart and clash again, in time with the landing
	// sound (AnimatedSymbol swordLand); idle /
	// winning they keep swinging open and slamming shut. The swing opens ±0.3 rad about the handles
	// (it was ±0.19, too small to read as a sword clash); the blade tips still stay inside the cell
	// (checked in-game 2026-10-06). Crossed it's ≈ 88 × 85 px.
	S: {
		aspect: 96 / 93,
		fit: 0.66,
		squash: 0,
		idle: 0.6,
		landAnim: true,
		landMs: 1100, // = sfx_scatter_land's length (its accents drive AnimatedSymbol swordLand)
		clash: { nx: 0.5, ny: 0.5 },
		layers: [
			{
				key: 'scatterSpatula',
				nx: 0.4212,
				ny: 0.4886,
				nw: 0.8424,
				nh: 0.9772,
				swing: { px: 0.84, py: 0.92, open: -0.3 },
			},
			{
				key: 'scatterKnife',
				nx: 0.5833,
				ny: 0.5161,
				nw: 0.8333,
				nh: 0.9677,
				swing: { px: 0.11, py: 0.95, open: 0.3 },
			},
			// the lettering never swings: it stamps in on the first clash and bumps on every clash
			{ key: 'scatterText', nx: 0.5573, ny: 0.8172, nw: 1.0313, nh: 0.3871, clashPop: 0.08 },
		],
	},
	// Smutz cup (H2) — one whole sprite (straw included; splitting the straw off left it poking out
	// broken). Comes alive like an ice-cold soda: it rocks from its base and hops with a sip-squeeze,
	// while fizzy bubbles stream up out of the straw and pop.
	H2: {
		aspect: 131 / 120, // the flat sprite's padded footprint — matches the normal cup size exactly
		fit: 1,
		squash: 0.08,
		fizz: { nx: 0.53, ny: 0.2, spread: 0.2, color: 0x9fd8ff }, // rises from the lid, stays in its cell
		layers: [{ key: 'mcH2', nx: 0.5, ny: 0.5, nw: 1, nh: 1, dy: -0.06, tilt: 0.1, pivotY: 0.42 }],
	},
	// Cheese — one whole slice (drips included) that gently jiggles and dribbles gooey drops off its
	// painted drip tips, but ONLY while active (locked / part of a win) like the other symbols.
	H4: {
		aspect: 131 / 120,
		fit: 1,
		squash: 0.09,
		// Origins sit at the tips of the art's painted drips so each falling drop extends one; colors
		// sampled from those very tips (the right drip is a darker orange).
		drip: {
			color: 0xf69a0e,
			points: [
				{ nx: 0.205, ny: 0.66, color: 0xf69a16 },
				{ nx: 0.42, ny: 0.81, color: 0xf69a0e },
				{ nx: 0.6, ny: 0.74, color: 0xe67006 },
			],
		},
		layers: [{ key: 'mcH4', nx: 0.5, ny: 0.5, nw: 1, nh: 1, dy: -0.02 }],
	},
};

// Win-pad burger: the SAME burger parts as the board's H1, but it ASSEMBLES on show — each slice
// falls in and splats onto the one below (bottom bun → patty → cheese → onion → tomato → lettuce →
// top bun, staggered), then hands over to H1's normal separate-and-reassemble "dance" loop. Kept
// separate from H1 so the board symbol is unaffected.
const ASSEMBLE_DELAYS = [0, 0.12, 0.24, 0.36, 0.48, 0.6, 0.74];
export const H1_ASSEMBLE: SymbolPartsConfig = {
	...SYMBOL_PARTS.H1,
	landAnim: true,
	landMs: 1700,
	// Pieces fall in from the TOP (well above the pad) and splat onto each other, bottom bun first. Only
	// the settled burger has to stay on-screen; falling in past the top edge is the effect.
	landFall: true,
	landDrop: 1.6,
	landSlice: 0.28,
	// A touch more whole-stack squash so the settled burger has a bit of bounce.
	squash: 0.06,
	// The assemble (landDelay + scale) plays ONCE. After it, the idle loop uses these dx/dy/rot offsets
	// — damped WAY down from H1's full separate-and-reassemble so the built burger just gently bounces
	// (pieces jiggle a hair, no gaps) instead of flying apart and rebuilding over and over.
	layers: SYMBOL_PARTS.H1.layers.map((l, i) => ({
		...l,
		landDelay: ASSEMBLE_DELAYS[i] ?? 0.8,
		dx: (l.dx ?? 0) * 0.04,
		dy: (l.dy ?? 0) * 0.09,
		rot: (l.rot ?? 0) * 0.09,
	})),
};
