import type { Assets } from 'pixi-svelte';

// Theme Park asset manifest. Board symbols use atlas regions from the approved
// concept sheet, keeping source art intact while avoiding template-game assets.

const assets: Assets = {
	// === THEME PARK UI ATLAS ===
	themeUi: { type: 'sprites', src: './assets/theme-park/ui.json', preload: true },

	// === BACKGROUND ===
	background: { type: 'sprite', src: './assets/theme-park/v2/background.png', preload: true },
	splash: { type: 'sprite', src: './assets/theme-park/v2/background.png', preload: true },
	themeBoard: { type: 'sprite', src: './assets/theme-park/v2/board.png', preload: true },
	themeLogo: { type: 'sprite', src: './assets/theme-park/v2/logo.png', preload: true },

	// === FINAL HIGH SYMBOL ART ===
	tpH1: { type: 'sprite', src: './assets/theme-park/v2/symbols/h1-coaster.png', preload: true },
	tpH1Win: {
		type: 'sprite',
		src: './assets/theme-park/v2/symbols/h1-coaster-win.png',
		preload: true,
	},
	tpH2: { type: 'sprite', src: './assets/theme-park/v2/symbols/h2-duck.png', preload: true },
	tpH2Win: {
		type: 'sprite',
		src: './assets/theme-park/v2/symbols/h2-duck-win.png',
		preload: true,
	},
	tpH3: { type: 'sprite', src: './assets/theme-park/v2/symbols/h3-balloons.png', preload: true },
	tpH3Win: {
		type: 'sprite',
		src: './assets/theme-park/v2/symbols/h3-balloons-win.png',
		preload: true,
	},
	tpH4: { type: 'sprite', src: './assets/theme-park/v2/symbols/h4-popcorn.png', preload: true },
	tpH4Win: {
		type: 'sprite',
		src: './assets/theme-park/v2/symbols/h4-popcorn-win.png',
		preload: true,
	},
	tpH5: { type: 'sprite', src: './assets/theme-park/v2/symbols/h5-ferris.png', preload: true },
	tpH5Win: {
		type: 'sprite',
		src: './assets/theme-park/v2/symbols/h5-ferris-win.png',
		preload: true,
	},
	tpL1: { type: 'sprite', src: './assets/theme-park/v2/symbols/l1-a.png', preload: true },
	tpL1Win: {
		type: 'sprite',
		src: './assets/theme-park/v2/symbols/l1-a-win.png',
		preload: true,
	},
	tpL2: { type: 'sprite', src: './assets/theme-park/v2/symbols/l2-k.png', preload: true },
	tpL2Win: {
		type: 'sprite',
		src: './assets/theme-park/v2/symbols/l2-k-win.png',
		preload: true,
	},
	tpL3: { type: 'sprite', src: './assets/theme-park/v2/symbols/l3-q.png', preload: true },
	tpL3Win: {
		type: 'sprite',
		src: './assets/theme-park/v2/symbols/l3-q-win.png',
		preload: true,
	},
	tpL4: { type: 'sprite', src: './assets/theme-park/v2/symbols/l4-j.png', preload: true },
	tpL4Win: {
		type: 'sprite',
		src: './assets/theme-park/v2/symbols/l4-j-win.png',
		preload: true,
	},
	tpL5: { type: 'sprite', src: './assets/theme-park/v2/symbols/l5-10.png', preload: true },
	tpL5Win: {
		type: 'sprite',
		src: './assets/theme-park/v2/symbols/l5-10-win.png',
		preload: true,
	},
	tpWildDesktop: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/wild-desktop.png',
		preload: true,
	},
	tpWildMobile: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/wild-mobile.png',
		preload: true,
	},
	tpWildLandscape: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/wild-mobile-landscape.png',
		preload: true,
	},
	tpMegaWildDesktop: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/mega-wild-desktop.png',
		preload: true,
	},
	tpMegaWildMobile: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/mega-wild-mobile.png',
		preload: true,
	},
	tpMegaWildLandscape: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/mega-wild-mobile-landscape.png',
		preload: true,
	},
	tpCoasterWild: {
		type: 'sprite',
		src: './assets/theme-park/v2/symbols/wild-slime.png',
		preload: true,
	},

	// === FEATURE PRESENTERS ===
	coasterTrack: {
		type: 'sprite',
		src: './assets/theme-park/v2/features/coaster-track.png',
		preload: true,
	},
	coasterCarHappy: {
		type: 'sprite',
		src: './assets/theme-park/v2/features/coaster-car-happy.png',
		preload: true,
	},
	coasterCarVomit: {
		type: 'sprite',
		src: './assets/theme-park/v2/features/coaster-car-vomit.png',
		preload: true,
	},
	coasterCarSick: {
		type: 'sprite',
		src: './assets/theme-park/v2/features/coaster-car-sick.png',
		preload: true,
	},
	rollerWildCar: {
		type: 'sprite',
		src: './assets/theme-park/v2/features/roller-wild-car.png',
		preload: true,
	},
	rollerWildRail: {
		type: 'sprite',
		src: './assets/theme-park/v2/features/roller-wild-rail.png',
		preload: true,
	},
	tpDuckScatterDesktop: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/duck-your-luck-desktop.png',
		preload: true,
	},
	tpDuckScatterMobile: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/duck-your-luck-mobile.png',
		preload: true,
	},
	tpDuckScatterLandscape: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/duck-your-luck-mobile-landscape.png',
		preload: true,
	},
	tpRollerScatterDesktop: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/roller-wilds-desktop.png',
		preload: true,
	},
	tpRollerScatterMobile: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/roller-wilds-mobile.png',
		preload: true,
	},
	tpRollerScatterLandscape: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/roller-wilds-mobile-landscape.png',
		preload: true,
	},
	tpCoasterScatterDesktop: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/mega-coaster-desktop.png',
		preload: true,
	},
	tpCoasterScatterMobile: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/mega-coaster-mobile.png',
		preload: true,
	},
	tpCoasterScatterLandscape: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/mega-coaster-mobile-landscape.png',
		preload: true,
	},

	// === WIN BOARDS ===
	winSweet: { type: 'sprite', src: './assets/theme-park/v2/wins/sweet.png', preload: true },
	winWild: { type: 'sprite', src: './assets/theme-park/v2/wins/wild.png', preload: true },
	winEpic: { type: 'sprite', src: './assets/theme-park/v2/wins/epic.png', preload: true },
	winLegendary: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/legendary.png',
		preload: true,
	},
	winMythic: { type: 'sprite', src: './assets/theme-park/v2/wins/mythic.png', preload: true },

	// === FRAMES / UI ===
	symbolPad: { type: 'sprite', src: './assets/components/frames/symbol_pad.png', preload: false },
	// Temporary production boards: Forest desktop frame + Magnetic mobile frames.
	// Asset-backed frames replace the old procedural rounded rectangles.
	forestBoardPad: {
		type: 'sprite',
		src: './assets/components/frames/slot_pad.png',
		preload: true,
	},
	magneticBoardPadMobile: {
		type: 'sprite',
		src: './assets/components/frames/magnetic/board_pad_mobile.png',
		preload: true,
	},
	magneticBoardPadLand: {
		type: 'sprite',
		src: './assets/components/frames/magnetic/board_pad_land.png',
		preload: true,
	},
	forestBonusBadge: {
		type: 'sprite',
		src: './assets/components/frames/forest/badge_frame.png',
		preload: true,
	},
	// Temporary production placeholders copied from Magnetic. Replace with final
	// Theme Park lock art without changing the component contract.
	lockedCell: {
		type: 'sprite',
		src: './assets/components/frames/magnetic/cell_box.png',
		preload: true,
	},
	lockedCellWin: {
		type: 'sprite',
		src: './assets/components/frames/magnetic/cell_box_win.png',
		preload: true,
	},
	// Temporary anticipation Spine copied from Forest Gang. The intro/loop/out
	// state machine is shared; only the art will be replaced later.
	anticipation: {
		type: 'spine',
		src: {
			atlas: './assets/spines/anticipation/anticipation.atlas',
			skeleton: './assets/spines/anticipation/anticipation.json',
			scale: 2,
		},
		preload: true,
	},
	// Forest Gang's production intro/idle panel. Reused for free-spin intro/outro
	// instead of drawing three rounded Pixi rectangles.
	fsIntro: {
		type: 'spine',
		src: {
			atlas: './assets/spines/fsIntro/fs_screen.atlas',
			skeleton: './assets/spines/fsIntro/fs_screen.json',
			scale: 2,
		},
		preload: true,
	},

	// === FONTS ===
	goldFont: { type: 'font', src: './assets/fonts/goldFont/mm_gold.xml', preload: true },
	silverFont: { type: 'font', src: './assets/fonts/silverFont/mm_silver.xml', preload: true },
};

export default assets;
