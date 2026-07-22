import type { Assets } from 'pixi-svelte';

// Theme Park asset manifest. Board symbols use atlas regions from the approved
// concept sheet, keeping source art intact while avoiding template-game assets.

const assets: Assets = {
	// === THEME PARK ATLASES ===
	themeSymbols: { type: 'sprites', src: './assets/theme-park/symbols.json', preload: true },
	themeUi: { type: 'sprites', src: './assets/theme-park/ui.json', preload: true },

	// === BACKGROUND ===
	background: { type: 'sprite', src: './assets/theme-park/background-v1.png', preload: true },
	splash: { type: 'sprite', src: './assets/theme-park/background-v1.png', preload: true },

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
	cellBox: {
		type: 'sprite',
		src: './assets/components/frames/magnetic/cell_box.png',
		preload: true,
	},
	cellBoxWin: {
		type: 'sprite',
		src: './assets/components/frames/magnetic/cell_box_win.png',
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
	magneticWildLightning: {
		type: 'spriteSheet',
		src: './assets/components/symbols/magnetic/special/wild_lightning_sheet.json',
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
