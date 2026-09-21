// MOTHERSHIP win-card geometry (WinCard.svelte).
//
// Every number below is MEASURED, not designed here. The six assembled win screens exist in
// Figma under SECTION 4013:920 "Types of wins" (EPIC 9034:25341 · SWEET 9034:25584 ·
// MYTHIC 9034:25101 · LEGENDARY 9041:26358 · WILD 9034:25823 · MAX 7103:5231) — each one a full
// 1200x670 game screen with the card composited on it — so the lockup is read off the design
// rather than invented. scripts/build-win-card.py trims each piece to its own ink, maps that ink
// back into frame coordinates and prints this table; it is regenerated, never hand-edited.
//
// Rects are `cx`/`cy` from the SCREEN CENTRE in those 1200x670 design units, with `w`/`h` the
// trimmed art's own box — WinCard scales the whole set by one factor to fit the viewport.
//
// The composition is the same on five of the six screens: a wide plate, a saucer poking out of
// its top edge with the alien's head in the dome, a huge wordmark straddling the plate, one slime
// blob beside it and the amount on a plaque below. MAX draws the same lockup 1.2x and 24px
// higher (its wordmark is stacked on two lines) and throws slime across the whole screen.
//
// This replaces a first attempt that treated the plate as a banner with the wordmark INSIDE it —
// wrong composition, not wrong tuning. The wordmark is the hero and it overflows the plate.

export type WinCardRect = { cx: number; cy: number; w: number; h: number };
export type WinCardPart = WinCardRect & { key: string };

export type WinCardTier = {
	/** Tier wordmark. Art, so it needs no translation — and it is the only thing that names the tier. */
	word: WinCardPart;
	/** The shared lockup. The plate is the design's belly-less drawing (Figma 9148:31503), so the
	    saucer — which carries its own belly — renders OVER it at its design box, alien in the dome.
	    (The retired plate had the belly baked in and forced the reverse order, which put the alien
	    on top of a piece of the background.) */
	plate: WinCardRect;
	saucer: WinCardRect;
	alien: WinCardRect;
	/** The amount plaque, drawn (fill #3A3981, 4px stroke, radius 17.8) — there is no art for it. */
	plaque: WinCardRect;
	/** Slime splats. One drawing, exported at the rotations the design uses (0/15/30/45°) so the
	    component never has to rotate a sprite about anything but its own centre. */
	blobs: WinCardPart[];
	/** Tier accent, sampled from the wordmark's own dominant colour — halo and landing sparks. */
	glow: number;
	/** Plaque stroke + amount colour. Lilac everywhere except MAX, which goes acid green. */
	ink?: number;
};

/**
 * The slab inside the plate ART, as fractions of the sprite's own box.
 *
 * `plate` above is the sprite's bounding box, which includes the notch tabs on its corners.
 * Anything that has to land ON the plate's border (the slime) needs the slab, not the box.
 * Measured off winCardPlate.webp's alpha by scripts/build-win-card.py: rows with >=70% horizontal
 * coverage, columns with >=25% vertical — and the plate itself is PLACED by this slab (the
 * belly-less drawing has no node box in a win screen), see the script.
 */
export const WIN_CARD_PLATE_SLAB = { left: 0.02, right: 0.988, top: 0.121, bottom: 0.857 };

/**
 * The plate's SILHOUETTE, as fractions of the sprite's box (`plate` above) — what the slime
 * catches on. The slab rectangle is fine for placing the plate, but slime placed round a rectangle
 * ended up inside the face or hanging under the diagonals with nothing behind it: the plate is a
 * boat, its lower half cut back by two long diagonals to a narrow foot with a medallion on it.
 * Traced off winCardPlate.webp's alpha by scripts/measure-win-plate-outline.py (rays from the
 * centroid, simplified to 4px), clockwise in screen coordinates. Re-run the script if the art
 * changes; never hand-edit.
 */
export const WIN_CARD_PLATE_OUTLINE = [
	{ x: 0.9834, y: 0.472 },
	{ x: 0.9835, y: 0.5979 },
	{ x: 0.9786, y: 0.6195 },
	{ x: 0.9727, y: 0.6289 },
	{ x: 0.926, y: 0.6337 },
	{ x: 0.8262, y: 0.9002 },
	{ x: 0.6702, y: 0.9008 },
	{ x: 0.6542, y: 0.9414 },
	{ x: 0.5367, y: 0.9417 },
	{ x: 0.5164, y: 0.9869 },
	{ x: 0.493, y: 0.998 },
	{ x: 0.4719, y: 0.9827 },
	{ x: 0.4539, y: 0.9416 },
	{ x: 0.3386, y: 0.9422 },
	{ x: 0.3211, y: 0.9007 },
	{ x: 0.1681, y: 0.9009 },
	{ x: 0.1589, y: 0.8927 },
	{ x: 0.0642, y: 0.6305 },
	{ x: 0.0384, y: 0.6059 },
	{ x: 0.0363, y: 0.3713 },
	{ x: 0.0009, y: 0.2662 },
	{ x: 0.0007, y: 0.1414 },
	{ x: 0.0403, y: 0.0226 },
	{ x: 0.0521, y: 0.0096 },
	{ x: 0.1061, y: 0.0096 },
	{ x: 0.1704, y: 0.0747 },
	{ x: 0.2863, y: 0.0768 },
	{ x: 0.3155, y: 0.1232 },
	{ x: 0.6741, y: 0.1235 },
	{ x: 0.6805, y: 0.1234 },
	{ x: 0.7221, y: 0.0486 },
	{ x: 0.8091, y: 0.0484 },
	{ x: 0.8486, y: 0.0038 },
	{ x: 0.9528, y: 0.0022 },
	{ x: 0.9978, y: 0.1237 },
	{ x: 0.9984, y: 0.3064 },
	{ x: 0.9699, y: 0.3943 },
	{ x: 0.9835, y: 0.4378 },
];

/**
 * Where the saucer sprite's glass dome ends and its purple belly begins, as a fraction of the
 * sprite's height (build-win-card.py: first lower-half row whose opaque pixels average purple for
 * four rows running). WinCard clips the alien here so it sits IN the dome with its body behind
 * the hull — the retired plate's baked belly used to do that hiding.
 */
export const WIN_CARD_SAUCER_BELT = 0.595;

/** The plaque's lilac, and the frame the rects above are measured in. */
export const WIN_CARD_INK = 0xafb1fb;
export const WIN_CARD_FRAME = { w: 1200, h: 670 };

export const WIN_CARD_TIERS: Record<string, WinCardTier> = {
	sweet: {
		glow: 0x2ab8ff,
		word: { key: 'winWordSweet', cx: -1.2, cy: -11.5, w: 512.5, h: 284.0 },
		plate: { cx: 4.1, cy: -0.1, w: 657.1, h: 240.5 },
		saucer: { cx: -4.8, cy: -220.9, w: 260.5, h: 184.8 },
		alien: { cx: -4.8, cy: -214.4, w: 54.3, h: 82.8 },
		plaque: { cx: -11.5, cy: 213.0, w: 399.0, h: 120.1 },
		blobs: [{ key: 'winBlobA15', cx: 298.3, cy: -80.2, w: 142.8, h: 126.8 }],
	},
	wild: {
		glow: 0x94ff2a,
		word: { key: 'winWordWild', cx: -8.2, cy: -15.5, w: 484.5, h: 312.0 },
		plate: { cx: 4.1, cy: -0.1, w: 657.1, h: 240.5 },
		saucer: { cx: -4.8, cy: -220.9, w: 260.5, h: 184.8 },
		alien: { cx: -4.8, cy: -214.4, w: 54.3, h: 82.8 },
		plaque: { cx: -11.5, cy: 213.0, w: 399.0, h: 120.1 },
		blobs: [{ key: 'winBlobA30', cx: 281.4, cy: -66.4, w: 140.3, h: 142.5 }],
	},
	epic: {
		glow: 0xff2a2a,
		word: { key: 'winWordEpic', cx: -8.8, cy: -23.0, w: 435.5, h: 279.0 },
		plate: { cx: 4.1, cy: -0.1, w: 657.1, h: 240.5 },
		saucer: { cx: -4.8, cy: -220.9, w: 260.5, h: 184.8 },
		alien: { cx: -4.8, cy: -214.4, w: 54.3, h: 82.8 },
		plaque: { cx: -11.5, cy: 213.0, w: 399.0, h: 120.1 },
		blobs: [{ key: 'winBlobA15', cx: 279.3, cy: -80.2, w: 142.8, h: 126.8 }],
	},
	mythic: {
		glow: 0xff7fe9,
		word: { key: 'winWordMythic', cx: 3.5, cy: -12.5, w: 520.0, h: 248.0 },
		plate: { cx: 4.1, cy: -0.1, w: 657.1, h: 240.5 },
		saucer: { cx: -4.8, cy: -220.9, w: 260.5, h: 184.8 },
		alien: { cx: -4.8, cy: -214.4, w: 54.3, h: 82.8 },
		plaque: { cx: -11.5, cy: 213.0, w: 399.0, h: 120.1 },
		blobs: [{ key: 'winBlobA15', cx: 293.3, cy: -80.2, w: 142.8, h: 126.8 }],
	},
	legendary: {
		glow: 0xffd400,
		word: { key: 'winWordLegendary', cx: -9.0, cy: -19.2, w: 577.0, h: 275.5 },
		plate: { cx: 4.1, cy: -0.1, w: 657.1, h: 240.5 },
		saucer: { cx: -4.8, cy: -220.9, w: 260.5, h: 184.8 },
		alien: { cx: -4.8, cy: -214.4, w: 54.3, h: 82.8 },
		plaque: { cx: -11.5, cy: 213.0, w: 399.0, h: 120.1 },
		blobs: [{ key: 'winBlobA30', cx: 305.3, cy: -76.4, w: 140.3, h: 142.5 }],
	},
	max: {
		glow: 0xaaff00,
		ink: 0x9bf715,
		word: { key: 'winWordMax', cx: 0.2, cy: -2.8, w: 565.5, h: 380.5 },
		plate: { cx: 5.9, cy: 11.0, w: 788.1, h: 288.5 },
		saucer: { cx: 0.2, cy: -244.9, w: 260.5, h: 184.8 },
		alien: { cx: 0.2, cy: -238.4, w: 54.3, h: 82.8 },
		plaque: { cx: 0.5, cy: 226.0, w: 399.0, h: 120.1 },
		blobs: [
			{ key: 'winBlobA30', cx: 341.9, cy: -43.8, w: 208.7, h: 212.5 },
			{ key: 'winBlobB0', cx: -371.8, cy: -60.2, w: 125.5, h: 133.5 },
			{ key: 'winBlobB0', cx: 321.6, cy: 70.9, w: 82.6, h: 87.3 },
			{ key: 'winBlobB0', cx: 429.6, cy: 116.9, w: 82.6, h: 87.3 },
			{ key: 'winBlobB0', cx: -414.2, cy: -152.8, w: 70.9, h: 75.3 },
			{ key: 'winBlobB45', cx: -317.9, cy: -210.7, w: 76.3, h: 70.8 },
			{ key: 'winBlobB45', cx: -456.9, cy: -245.7, w: 76.3, h: 70.8 },
			{ key: 'winBlobB45', cx: 510.1, cy: 26.3, w: 76.3, h: 70.8 },
			{ key: 'winBlobB45', cx: 534.9, cy: 127.0, w: 55.2, h: 51.3 },
		],
	},
};
