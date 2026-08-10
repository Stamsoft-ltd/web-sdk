// Version2 big-win sign tiers (WinSign.svelte). Each design ships the sign as loose parts —
// plate, two pillars, magnet, title — and the values here are the parts' TRIMMED-art rects in
// the design's 1200x670 frame, centre-relative (x/y = part centre, w/h = art size, design px).
// They are printed by the asset-cutting scripts (scratchpad {sweetwin,epicwin}/build_parts.py)
// when the webp parts are generated — measure, don't hand-tune.
// A lit element inside a part's art (the pillars' glass cylinders, the plate's neon edge strip).
// The arts paint them FLAT, so WinSign lays an additive glow over them — the same treatment the
// congratulations frame gets in WonPanel. Boxes are fractions of the part's own art (so they
// track it at any scale) and were colour-keyed off the webp by scratchpad/tubes/measure_*.py.
export type TubeLight = { cx: number; cy: number; w: number; h: number; color: number };
export type SignPart = { key: string; x: number; y: number; w: number; h: number; tubes?: TubeLight[] };
export type WinSignTier = {
	plate: SignPart;
	pillarL: SignPart;
	pillarR: SignPart;
	magnet: SignPart;
	title: SignPart;
	// Amount plaque centre-y (the plaque itself is identical across tiers: 373x99 r10).
	amountY: number;
	// Tier accent for the glow / spark bursts.
	glow: number;
	// Portrait is width-limited, so the scale fits this instead of the full 1200 frame width —
	// the sign's visible extent plus a small margin (the frame's side margins are empty air).
	portraitFit: number;
};

export const WIN_SIGN_TIERS: Record<string, WinSignTier> = {
	// SWEET WIN — Figma 7022:7751
	sweetWinBoard: {
		plate: {
			key: 'winSignPlate',
			x: 0.75,
			y: -41.25,
			w: 788.5,
			h: 291.5,
			tubes: [{ cx: 0.501, cy: 0.1415, w: 0.7077, h: 0.0189, color: 0x19e0ec }],
		},
		pillarL: {
			key: 'winSignPillarL',
			x: -329.85,
			y: -84.8,
			w: 181.1,
			h: 309,
			tubes: [{ cx: 0.3978, cy: 0.5057, w: 0.2707, h: 0.3252, color: 0x53e1fa }],
		},
		pillarR: {
			key: 'winSignPillarR',
			x: 333.6,
			y: -84.8,
			w: 179.8,
			h: 309,
			tubes: [{ cx: 0.6111, cy: 0.5049, w: 0.2722, h: 0.3236, color: 0x55e1fa }],
		},
		magnet: { key: 'winSignMagnet', x: -0.15, y: -187.5, w: 395.3, h: 271 },
		title: { key: 'winSignTextSweet', x: -0.35, y: -43.05, w: 557.9, h: 118.3 },
		amountY: 172.5,
		glow: 0x2fb4ff,
		portraitFit: 920,
	},
	// MYTHIC WIN — Figma 4007:1743 (neon-tube pillars, two-line magenta neon title; the design
	// parks the plate 7px left of centre — measured, not a bug)
	mythicWinBoard: {
		plate: {
			key: 'winSignMythicPlate',
			x: -7.27,
			y: -92.58,
			w: 563,
			h: 250.8,
			tubes: [{ cx: 0.5, cy: 0.1939, w: 0.8017, h: 0.0233, color: 0xee6cf2 }],
		},
		pillarL: {
			key: 'winSignMythicPillarL',
			x: -292.43,
			y: -118.45,
			w: 166.9,
			h: 249,
			tubes: [
				{ cx: 0.5808, cy: 0.5382, w: 0.3174, h: 0.4378, color: 0xc755f8 },
				{ cx: 0.2021, cy: 0.5492, w: 0.1527, h: 0.3514, color: 0xc85df6 },
			],
		},
		pillarR: {
			key: 'winSignMythicPillarR',
			x: 290.43,
			y: -118.45,
			w: 166.9,
			h: 249,
			tubes: [
				{ cx: 0.4192, cy: 0.5382, w: 0.3174, h: 0.4378, color: 0xc755f8 },
				{ cx: 0.7979, cy: 0.5492, w: 0.1527, h: 0.3514, color: 0xc85df6 },
			],
		},
		magnet: { key: 'winSignMythicMagnet', x: -0.42, y: -229.01, w: 145.3, h: 101.4 },
		title: { key: 'winSignTextMythic', x: 2.92, y: -78.89, w: 286.6, h: 158.7 },
		amountY: 139.5,
		glow: 0xe04dff,
		portraitFit: 775, // pillars span x224.1..973.9 = 750 visible
	},
	// WILD WIN — Figma 7022:7925 (green title; the pillars REUSE the sweet strip art in smaller
	// boxes, so pillarL/pillarR point at the sweet assets with wild's own rects)
	wildWinBoard: {
		plate: {
			key: 'winSignWildPlate',
			x: 0,
			y: -80.5,
			w: 733.3,
			h: 286.4,
			tubes: [{ cx: 0.5, cy: 0.1828, w: 0.7181, h: 0.0115, color: 0x96e0f2 }],
		},
		pillarL: {
			key: 'winSignPillarL',
			x: -300.93,
			y: -109.93,
			w: 155.8,
			h: 265.3,
			tubes: [{ cx: 0.3978, cy: 0.5057, w: 0.2707, h: 0.3252, color: 0x53e1fa }],
		},
		pillarR: {
			key: 'winSignPillarR',
			x: 312.57,
			y: -109.39,
			w: 154.7,
			h: 264.7,
			tubes: [{ cx: 0.6111, cy: 0.5049, w: 0.2722, h: 0.3236, color: 0x55e1fa }],
		},
		magnet: { key: 'winSignWildMagnet', x: 0, y: -218.12, w: 217.2, h: 111.1 },
		title: { key: 'winSignTextWild', x: -1.95, y: -77.19, w: 491.1, h: 106 },
		amountY: 139.5,
		glow: 0x46e04b,
		portraitFit: 995, // plate spans x233.4..966.6, pillars to x989.9 = 969 visible
	},
	// LEGENDARY WIN — Figma 7022:8095 (twin-capsule pillars, gold flame title)
	legendaryWinBoard: {
		plate: {
			key: 'winSignLegendPlate',
			x: 0.82,
			y: -54.76,
			w: 713.8,
			h: 251.5,
			tubes: [{ cx: 0.4995, cy: 0.1462, w: 0.7154, h: 0.0256, color: 0xf5d142 }],
		},
		pillarL: {
			key: 'winSignLegendPillarL',
			x: -354.02,
			y: -85.9,
			w: 189.3,
			h: 225,
			tubes: [
				{ cx: 0.7137, cy: 0.5133, w: 0.3245, h: 0.3556, color: 0x30d6e3 },
				{ cx: 0.1623, cy: 0.5422, w: 0.1346, h: 0.2, color: 0x3ad7e5 },
			],
		},
		pillarR: {
			key: 'winSignLegendPillarR',
			x: 351.02,
			y: -85.9,
			w: 189.3,
			h: 225,
			tubes: [
				{ cx: 0.2863, cy: 0.5133, w: 0.3245, h: 0.3556, color: 0x30d6e3 },
				{ cx: 0.8377, cy: 0.5422, w: 0.1346, h: 0.2, color: 0x3ad7e5 },
			],
		},
		magnet: { key: 'winSignLegendMagnet', x: 4.32, y: -215.7, w: 271.1, h: 133.1 },
		title: { key: 'winSignTextLegend', x: -1.77, y: -53.05, w: 507.5, h: 95.7 },
		amountY: 139.5,
		glow: 0xffb428,
		portraitFit: 920, // pillars span x151.3..1045.7 = 894 visible
	},
	// EPIC WIN — Figma 7022:8274 (looping-pipe pillars, violet title)
	epicWinBoard: {
		plate: { key: 'winSignEpicPlate', x: 0, y: -49.14, w: 649.5, h: 231.4 },
		pillarL: { key: 'winSignEpicPillarL', x: -339.59, y: -96.5, w: 305.2, h: 407 },
		pillarR: { key: 'winSignEpicPillarR', x: 348.59, y: -96.5, w: 305.2, h: 407 },
		magnet: { key: 'winSignEpicMagnet', x: 0.27, y: -204.24, w: 199.1, h: 160 },
		title: { key: 'winSignTextEpic', x: -0.22, y: -54.39, w: 416, h: 86.2 },
		amountY: 139.5,
		glow: 0xb84dff,
		portraitFit: 1020, // pillars span x107.8..1101.2 = 993 visible
	},
};
