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
	/** The shared lockup. The plate art carries the saucer's belly baked into its top edge, so the
	    saucer must render BEHIND it (dome above, belly hidden) or the two read as stickers. */
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
 * `plate` above is the sprite's bounding box, and that box carries the saucer's belly baked into
 * its top — so its top edge sits ~100 design units ABOVE the purple slab you can see. Anything that
 * has to land ON the plate's border (the slime) needs the slab, not the box. Measured off
 * winCardPlate.webp's alpha: rows with >=70% horizontal coverage, columns with >=25% vertical.
 */
export const WIN_CARD_PLATE_SLAB = { left: 0.035, right: 0.99, top: 0.248, bottom: 0.874 };

/** The plaque's lilac, and the frame the rects above are measured in. */
export const WIN_CARD_INK = 0xafb1fb;
export const WIN_CARD_FRAME = { w: 1200, h: 670 };

export const WIN_CARD_TIERS: Record<string, WinCardTier> = {
	sweet: {
		glow: 0x2ab8ff,
		word: { key: 'winWordSweet', cx: -1.2, cy: -11.5, w: 512.5, h: 284.0 },
		plate: { cx: -1.5, cy: -22.0, w: 665.0, h: 313.0 },
		saucer: { cx: -4.8, cy: -220.8, w: 260.5, h: 183.5 },
		alien: { cx: -5.0, cy: -192.0, w: 95.0, h: 145.0 },
		plaque: { cx: -11.5, cy: 213.0, w: 399.0, h: 120.1 },
		blobs: [{ key: 'winBlobA15', cx: 298.3, cy: -80.2, w: 142.8, h: 126.8 }],
	},
	wild: {
		glow: 0x94ff2a,
		word: { key: 'winWordWild', cx: -8.2, cy: -15.5, w: 484.5, h: 312.0 },
		plate: { cx: -1.5, cy: -22.0, w: 665.0, h: 313.0 },
		saucer: { cx: -4.8, cy: -220.8, w: 260.5, h: 183.5 },
		alien: { cx: -5.0, cy: -202.0, w: 95.0, h: 145.0 },
		plaque: { cx: -11.5, cy: 213.0, w: 399.0, h: 120.1 },
		blobs: [{ key: 'winBlobA30', cx: 281.4, cy: -66.4, w: 140.3, h: 142.5 }],
	},
	epic: {
		glow: 0xff2a2a,
		word: { key: 'winWordEpic', cx: -8.8, cy: -23.0, w: 435.5, h: 279.0 },
		plate: { cx: -1.5, cy: -22.0, w: 665.0, h: 313.0 },
		saucer: { cx: -4.8, cy: -220.8, w: 260.5, h: 183.5 },
		alien: { cx: -5.0, cy: -192.0, w: 95.0, h: 145.0 },
		plaque: { cx: -11.5, cy: 213.0, w: 399.0, h: 120.1 },
		blobs: [{ key: 'winBlobA15', cx: 279.3, cy: -80.2, w: 142.8, h: 126.8 }],
	},
	mythic: {
		glow: 0xff7fe9,
		word: { key: 'winWordMythic', cx: 3.5, cy: -12.5, w: 520.0, h: 248.0 },
		plate: { cx: -1.5, cy: -22.0, w: 665.0, h: 313.0 },
		saucer: { cx: -4.8, cy: -220.8, w: 260.5, h: 183.5 },
		alien: { cx: -5.0, cy: -192.0, w: 95.0, h: 145.0 },
		plaque: { cx: -11.5, cy: 213.0, w: 399.0, h: 120.1 },
		blobs: [{ key: 'winBlobA15', cx: 293.3, cy: -80.2, w: 142.8, h: 126.8 }],
	},
	legendary: {
		glow: 0xffd400,
		word: { key: 'winWordLegendary', cx: -9.0, cy: -19.2, w: 577.0, h: 275.5 },
		plate: { cx: -1.5, cy: -22.0, w: 665.0, h: 313.0 },
		saucer: { cx: -4.8, cy: -220.8, w: 260.5, h: 183.5 },
		alien: { cx: -5.0, cy: -192.0, w: 95.0, h: 145.0 },
		plaque: { cx: -11.5, cy: 213.0, w: 399.0, h: 120.1 },
		blobs: [{ key: 'winBlobA30', cx: 305.3, cy: -76.4, w: 140.3, h: 142.5 }],
	},
	max: {
		glow: 0xaaff00,
		ink: 0x9bf715,
		word: { key: 'winWordMax', cx: 0.2, cy: -2.8, w: 565.5, h: 380.5 },
		plate: { cx: -0.8, cy: -15.1, w: 797.6, h: 375.7 },
		saucer: { cx: 0.2, cy: -244.8, w: 260.5, h: 183.5 },
		alien: { cx: 1.0, cy: -216.0, w: 95.0, h: 145.0 },
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
