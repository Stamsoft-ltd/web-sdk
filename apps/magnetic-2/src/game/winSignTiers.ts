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
	// SWEET WIN — Figma 7170:6254 (redesign 2026-08-12). The frame is messy: plate, left pillar and
	// magnet live in a NESTED duplicate "Epic Win" frame whose own Frame 97 is offset (1,0), while
	// the right pillar and the title are frame-level siblings at (0,0). The right pillar is the left
	// one mirrored, placed in its own slightly-asymmetric box.
	//
	// Tube boxes on the four tiers redesigned that day were measured afterwards (2026-08-12) by
	// re-running scratchpad/tubes/measure_tubes.py against the re-cut pillars — the glass cylinders
	// were sitting dead while every other tier's pulsed. Each tier's tubes are the largest saturated
	// blobs in its pillar art, and the colours are those blobs' measured means.
	sweetWinBoard: {
		plate: { key: 'winSignPlate', x: 1.33, y: -48.83, w: 649.3, h: 231.7 },
		pillarL: {
			key: 'winSignPillarL',
			x: -324.33,
			y: -98.5,
			w: 234,
			h: 290.3,
			// One cyan cylinder per pillar; the second blob in this art is the violet PIPE, which is
			// painted, not lit, so it stays dark.
			tubes: [{ cx: 0.703, cy: 0.4957, w: 0.2949, h: 0.358, color: 0x3bddf6 }],
		},
		pillarR: {
			key: 'winSignPillarR',
			x: 328.33,
			y: -84.5,
			w: 234,
			h: 290.3,
			tubes: [{ cx: 0.297, cy: 0.4957, w: 0.2949, h: 0.358, color: 0x3bddf6 }],
		},
		magnet: { key: 'winSignMagnet', x: -0.33, y: -179, w: 135.3, h: 108.7 },
		title: { key: 'winSignTextSweet', x: 6.83, y: -53.5, w: 361, h: 76.3 },
		amountY: 139.5,
		glow: 0x2fb4ff,
		portraitFit: 920, // pillars span x158.7..1045.3 = 887 visible
	},
	// MYTHIC WIN — Figma 7174:7719 (redesign 2026-08-12). Parts sit at FRAME level here, including
	// inside a `contents` Group 89 whose children carry root coords — so no group offset, unlike the
	// tiers whose parts live in a Frame 97.
	mythicWinBoard: {
		plate: { key: 'winSignMythicPlate', x: -7.33, y: -66.67, w: 563.3, h: 251.3 },
		pillarL: {
			key: 'winSignMythicPillarL',
			x: -291.33,
			y: -92.33,
			w: 166.7,
			h: 248.7,
			// Wide inner cylinder + the narrower outer strip beside it, both magenta.
			tubes: [
				{ cx: 0.5811, cy: 0.5372, w: 0.3153, h: 0.4386, color: 0xc755f7 },
				{ cx: 0.1997, cy: 0.5483, w: 0.1532, h: 0.3521, color: 0xc75df6 },
			],
		},
		pillarR: {
			key: 'winSignMythicPillarR',
			x: 291.33,
			y: -92.33,
			w: 166.7,
			h: 248.7,
			tubes: [
				{ cx: 0.4204, cy: 0.5372, w: 0.3183, h: 0.4386, color: 0xc755f7 },
				{ cx: 0.8003, cy: 0.5483, w: 0.1532, h: 0.3521, color: 0xc85df6 },
			],
		},
		magnet: { key: 'winSignMythicMagnet', x: -0.33, y: -206.17, w: 145.3, h: 101.7 },
		title: { key: 'winSignTextMythic', x: -2.83, y: -55.67, w: 444.3, h: 72.7 },
		amountY: 139.5,
		glow: 0xe04dff,
		portraitFit: 775, // pillars span x225.3..974.7 = 749 visible
	},
	// WILD WIN — Figma 7174:7394 (redesign 2026-08-12). Green neon, and it now has its OWN pillar
	// art instead of reusing the sweet strip. plate + pillars are in the nested frame's Frame 97
	// (offset 1,0); title and magnet are frame-level.
	wildWinBoard: {
		plate: { key: 'winSignWildPlate', x: -1.33, y: -50, w: 586, h: 265 },
		pillarL: {
			key: 'winSignWildPillarL',
			x: -270.17,
			y: -62.22,
			w: 141.7,
			h: 212,
			tubes: [
				{ cx: 0.5724, cy: 0.5389, w: 0.2191, h: 0.4175, color: 0x72dd25 },
				{ cx: 0.2014, cy: 0.5578, w: 0.0919, h: 0.3184, color: 0x80dc29 },
			],
		},
		pillarR: {
			key: 'winSignWildPillarR',
			x: 279.27,
			y: -62.22,
			w: 141.7,
			h: 212,
			tubes: [
				{ cx: 0.4276, cy: 0.5377, w: 0.2191, h: 0.4198, color: 0x72dd25 },
				{ cx: 0.8004, cy: 0.5578, w: 0.0954, h: 0.3184, color: 0x7fdb29 },
			],
		},
		magnet: { key: 'winSignWildMagnet', x: -1.33, y: -206, w: 135.3, h: 108.7 },
		title: { key: 'winSignTextWild', x: -0.67, y: -42.33, w: 404.7, h: 82 },
		amountY: 139.5,
		glow: 0x46e04b,
		portraitFit: 760, // pillars span x259..950.1 = 691 visible, plus margin
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
	// EPIC WIN — Figma 7167:5096, sign group 7167:5180 (redesign 2026-08-12: red neon on a violet
	// plate, replacing the violet looping-pipe version). NOTE the frame is misnamed "Mythic Win" in
	// the file — the render is the red EPIC sign; trust the render, not the layer name.
	// Both pillars are ONE source image; the right one is the design's mirrored copy in its own box
	// at x 770 (get_design_context), NOT the 998 the frame metadata reports for the transformed node.
	epicWinBoard: {
		plate: { key: 'winSignEpicPlate', x: -5.17, y: -57.17, w: 554.3, h: 247.7 },
		pillarL: {
			key: 'winSignEpicPillarL',
			x: -290.17,
			y: -89,
			w: 164.3,
			h: 244.7,
			tubes: [
				{ cx: 0.579, cy: 0.5348, w: 0.1915, h: 0.4274, color: 0xdb1a15 },
				{ cx: 0.2021, cy: 0.5593, w: 0.0821, h: 0.317, color: 0xdc211e },
			],
		},
		pillarR: {
			key: 'winSignEpicPillarR',
			x: 282.17,
			y: -89,
			w: 164.3,
			h: 244.7,
			tubes: [
				{ cx: 0.421, cy: 0.5348, w: 0.1915, h: 0.4274, color: 0xdb1a15 },
				{ cx: 0.7994, cy: 0.5593, w: 0.0851, h: 0.317, color: 0xdb211d },
			],
		},
		magnet: { key: 'winSignEpicMagnet', x: -4.33, y: -197, w: 135.3, h: 108.7 },
		title: { key: 'winSignTextEpic', x: 2.17, y: -48.83, w: 367, h: 81.7 },
		amountY: 139.5,
		glow: 0xff2f3a,
		portraitFit: 810, // pillars span x227.7..972.3 = 745 visible, plus margin
	},
	// MAX WIN — Figma 7103:5231. The 25000x cap, and the last tier to leave the single baked
	// max_win_screen.webp board. Two notes on reading the design file:
	//   * the sign group (7103:5315) is offset 1px right of the frame, so the rects below are
	//     measured in ROOT space, not group space;
	//   * both pillars come from ONE source image which the design crops to its right third
	//     (inner img scaled 314.86%, offset -214.78%) and mirrors for the left side — so the two
	//     pillar assets here are a mirrored pair cut from that same crop.
	// The design parks the amount plaque 18.5px right of centre; that is left at 0 like every other
	// tier (WinSign centres it), since the plate itself is centred and the offset reads as a slip.
	maxWinBoard: {
		plate: {
			key: 'winSignMaxPlate',
			x: 1,
			y: -47.9,
			w: 654.1,
			h: 333.9,
			tubes: [
				{ cx: 0.934, cy: 0.5075, w: 0.0423, h: 0.3648, color: 0x34f6ff },
				{ cx: 0.0664, cy: 0.5075, w: 0.0415, h: 0.3648, color: 0x38f5ff },
				{ cx: 0.4992, cy: 0.9055, w: 0.181, h: 0.0232, color: 0x22f6ff },
				{ cx: 0.6849, cy: 0.0655, w: 0.1007, h: 0.0149, color: 0x24f3ff },
				{ cx: 0.3143, cy: 0.0655, w: 0.1007, h: 0.0149, color: 0x23f3ff },
			],
		},
		pillarL: {
			key: 'winSignMaxPillarL',
			x: -259.56,
			y: -81.27,
			w: 222,
			h: 382.7,
			tubes: [{ cx: 0.3896, cy: 0.5044, w: 0.2716, h: 0.3245, color: 0x46e1ff }],
		},
		pillarR: {
			key: 'winSignMaxPillarR',
			x: 260.56,
			y: -81.27,
			w: 222,
			h: 382.7,
			tubes: [{ cx: 0.6104, cy: 0.5044, w: 0.2716, h: 0.3245, color: 0x46e1ff }],
		},
		magnet: { key: 'winSignMaxMagnet', x: 1, y: -231.85, w: 150.2, h: 131.7 },
		title: { key: 'winSignTextMax', x: -2, y: -51.9, w: 337.8, h: 205.3 },
		amountY: 180.5,
		glow: 0xffb428,
		portraitFit: 770, // pillars span x229.4..971.6 = 742 visible
	},
};
