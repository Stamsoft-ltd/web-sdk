export default {



	bgBase: {
		type: 'sprite',
		src: './assets/components/backgrounds/bg_base.jpg?v=20260707',
		preload: true,
	},
	bgBonus: {
		type: 'sprite',
		src: './assets/components/backgrounds/bg_bonus.jpg?v=20260708',
		preload: true,
	},
	bgSuper: {
		type: 'sprite',
		src: './assets/components/backgrounds/bg_super.jpg?v=20260708',
		preload: true,
	},
	// Portrait (mobile) backgrounds — tall corridor art, swapped in when layoutType is 'portrait'.
	bgMobileBase: {
		type: 'sprite',
		src: './assets/components/backgrounds/bg_mobile_base.jpg?v=20260709',
		preload: true,
	},
	bgMobileBonus: {
		type: 'sprite',
		src: './assets/components/backgrounds/bg_mobile_bonus.png?v=20260709',
		preload: true,
	},
	bgMobileSuper: {
		type: 'sprite',
		src: './assets/components/backgrounds/bg_mobile_super.png?v=20260709',
		preload: true,
	},
	// Portrait board frame + horizontal capsule tube + small pad (ALL WINS / FREE SPINS boxes).
	boardPadMobile: {
		type: 'sprite',
		src: './assets/components/frames/board_pad_mobile.png?v=20260709',
		preload: true,
	},
	// Landscape (mobile horizontal) board frame.
	boardPadLand: {
		type: 'sprite',
		src: './assets/components/frames/board_pad_land.png?v=20260713',
		preload: true,
	},
	smallPadMobile: {
		type: 'sprite',
		src: './assets/components/ui/small_pad_mobile.png?v=20260709',
		preload: true,
	},
	// Circular-arrow icon for the RESPIN indicator panel (left rail, Figma 4504-3588).
	respinIcon: {
		type: 'sprite',
		src: './assets/components/ui/respin_icon.png?v=20260713',
		preload: true,
	},
	panelBorder: {
		type: 'sprite',
		src: './assets/components/ui/panel_border.png?v=20260708',
		preload: true,
	},
	capsuleTube: {
		type: 'sprite',
		src: './assets/components/ui/capsule_tube.png?v=20260709b',
		preload: true,
	},
	// Animated tesla capsule (Magnific webm with real alpha, lightning baked in) — replaces the
	// static tube + procedural lightning overlays. Looping 30-frame flipbook.
	capsuleTubeAnim: {
		type: 'spriteSheet',
		src: './assets/sprites/capsuleTube/capsule_tube_anim.json',
		// Board-facing sheets must preload: the loader swallows fetch errors and still
		// reports loaded, and mounting a SpriteSheet whose key is missing crashes pixi.
		preload: true,
	},
	capsuleLightning: {
		type: 'sprite',
		src: './assets/components/ui/capsule_lightning.png?v=20260708',
		preload: true,
	},
	// Fine branching filaments extracted from the tube's original baked art — drawn additively
	// inside the glass and flickered for a live crackle web around the central bolt.
	capsuleCrackle: {
		type: 'sprite',
		src: './assets/components/ui/capsule_crackle.png?v=20260709b',
		preload: true,
	},
	// Fully transparent horizontal tube (metal caps + blue rails, see-through interior) — the always-on
	// portrait capsule bar; live lightning is drawn inside the clear window.
	capsuleTubeGlass: {
		type: 'sprite',
		src: './assets/components/ui/magnetic_tube.png?v=20260710',
		preload: true,
	},
	// Free-spins intro popup: dark-blue tech panel + win-state horseshoe magnet (baked electric FX).
	fsPanel: {
		type: 'sprite',
		src: './assets/components/ui/fs_panel.png?v=20260708',
		preload: true,
	},
	// Free-spins intro: full magnet element (magnet + base + blue/orange energy) and the press arrow.
	popupMagnet: {
		type: 'sprite',
		src: './assets/components/ui/popup_magnet.png?v=20260708',
		preload: true,
	},
	// Animated medallion for both congratulations popups (Magnific "lightning flicker" video,
	// black keyed to alpha). 30-frame near-seamless loop.
	popupMagnetAnim: {
		type: 'spriteSheet',
		src: './assets/sprites/popupMagnet/popup_magnet_anim.json',
		preload: true,
	},
	pressArrow: {
		type: 'sprite',
		src: './assets/components/ui/press_arrow.png?v=20260708',
		preload: true,
	},
	splash: {
		type: 'sprite',
		src: './assets/components/backgrounds/splash_intro.jpg?v=20260710',
		preload: true,
	},
	boardPad: {
		type: 'sprite',
		src: './assets/components/frames/board_pad.png?v=20260707',
		preload: true,
	},
	// Per-cell boxes: a stationary 7x7 grid of these sits behind the rolling symbols. Winning cells
	// swap to the win-state box.
	cellBox: {
		type: 'sprite',
		src: './assets/components/frames/cell_box.png?v=20260708',
		preload: true,
	},
	cellBoxWin: {
		type: 'sprite',
		src: './assets/components/frames/cell_box_win.png?v=20260708',
		preload: true,
	},
	symbolPad: {
		type: 'sprite',
		src: './assets/components/frames/symbol_pad.png?v=20260625',
		preload: true,
	},
	counterFrame: {
		type: 'sprite',
		src: './assets/components/ui/confirm_frame.png?v=20260625',
		preload: true,
	},
	deerPresenter: {
		type: 'sprite',
		src: './assets/components/characters/deer_presenter.png?v=20260625',
		preload: true,
	},
	multiplierHand: {
		type: 'sprite',
		src: './assets/components/ui/multiplier_hand.png?v=20260624',
		preload: true,
	},
	magneticLogo: {
		type: 'sprite',
		src: './assets/components/ui/magnetic_logo.png?v=20260707',
		preload: true,
	},
	pressPlayLogo: {
		type: 'sprite',
		src: './assets/components/ui/press_play_logo.png?v=20260709',
		preload: true,
	},
	// 10-frame rotation flipbook for the washer — played while the washer is locked in a cluster
	// (the "being screwed in" animation). Packed 4x3, 420px frames, pivot centred; alpha recovered
	// from the designer's checkerboard-background exports.
	washerLockSheet: { type: 'spriteSheet', src: './assets/components/symbols/magnetic/low/washer_lock_sheet.json?v=20260710b', preload: true },
	// 20-frame rotation flipbook for the green bolt (real-alpha designer frames), same treatment.
	boltLockSheet: { type: 'spriteSheet', src: './assets/components/symbols/magnetic/low/bolt_lock_sheet.json?v=20260710', preload: true },
	// 20-frame rotation flipbook for the purple screw (real-alpha designer frames), same treatment.
	purpleScrewLockSheet: { type: 'spriteSheet', src: './assets/components/symbols/magnetic/low/purple_screw_lock_sheet.json?v=20260714b', preload: true },
	// 10-frame WIN-state flipbook for the green bolt (bolt + electric arcs) — played when the
	// bolt is part of a winning cluster presentation.
	boltWinSheet: { type: 'spriteSheet', src: './assets/components/symbols/magnetic/low/bolt_win_sheet.json?v=20260714', preload: true },
	// 9-frame WIN-state flipbook for the gold washer (washer + electric aura), same treatment.
	washerWinSheet: { type: 'spriteSheet', src: './assets/components/symbols/magnetic/low/washer_win_sheet.json?v=20260713b', preload: true },
	// 10-frame WIN-state flipbook for the purple screw, same treatment.
	purpleScrewWinSheet: { type: 'spriteSheet', src: './assets/components/symbols/magnetic/low/purple_screw_win_sheet.json?v=20260714', preload: true },
	// 10-frame WIN-state flipbook for the blue nut, same treatment.
	blueNutWinSheet: { type: 'spriteSheet', src: './assets/components/symbols/magnetic/low/blue_nut_win_sheet.json?v=20260713b', preload: true },
	// 10-frame stacked-state flipbook for the plasma drill premium (drill-bit spinning).
	drillLockSheet: { type: 'spriteSheet', src: './assets/components/symbols/magnetic/premium/drill_lock_sheet.json?v=20260713', preload: true },
	// 14-frame stacked-state flipbook for the M core cube premium (energy shimmer).
	cubeLockSheet: { type: 'spriteSheet', src: './assets/components/symbols/magnetic/premium/cube_lock_sheet.json?v=20260713', preload: true },
	// 10-frame stacked-state flipbook for the electromagnetic generator premium.
	generatorLockSheet: { type: 'spriteSheet', src: './assets/components/symbols/magnetic/premium/generator_lock_sheet.json?v=20260713', preload: true },
	// 10-frame WIN-state flipbook for the electromagnetic generator premium.
	generatorWinSheet: { type: 'spriteSheet', src: './assets/components/symbols/magnetic/premium/generator_win_sheet.json?v=20260713', preload: true },
	// 10-frame WIN-state flipbook for the plasma drill premium.
	drillWinSheet: { type: 'spriteSheet', src: './assets/components/symbols/magnetic/premium/drill_win_sheet.json?v=20260714', preload: true },
	// 10-frame WIN-state flipbook for the horseshoe magnet (H1 premium AND the MAGNET special).
	magnetWinSheet: { type: 'spriteSheet', src: './assets/components/symbols/magnetic/premium/magnet_win_sheet.json?v=20260714', preload: true },
	// 10-frame WIN-state flipbook for the M core cube premium.
	cubeWinSheet: { type: 'spriteSheet', src: './assets/components/symbols/magnetic/premium/cube_win_sheet.json?v=20260714', preload: true },
	// 10-frame radial lightning burst — looping backdrop BEHIND the wild while stacked.
	wildLightningSheet: { type: 'spriteSheet', src: './assets/components/symbols/magnetic/special/wild_lightning_sheet.json?v=20260714', preload: true },
	// 10-frame rotation flipbook for the blue nut (real-alpha designer frames), same treatment.
	// 40-frame roll from the Magnific "nut roll" video (black keyed to alpha, framed to keep the
	// nut at ~63% of the canvas so the tuned 1.21 size factor still applies).
	blueNutLockSheet: { type: 'spriteSheet', src: './assets/components/symbols/magnetic/low/blue_nut_lock_sheet2.json?v=20260717', preload: true },
	aTile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/nut.png?v=20260709', preload: true },
	aWinTile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/nut_win.png?v=20260709', preload: true },
	aTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/nut_mobile.png?v=20260709', preload: true },
	aWinTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/nut_mobile_win.png?v=20260709', preload: true },
	kTile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/washer.png?v=20260709', preload: true },
	kWinTile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/washer_win.png?v=20260709', preload: true },
	kTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/washer_mobile.png?v=20260709', preload: true },
	kWinTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/washer_mobile_win.png?v=20260709', preload: true },
	qTile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/energy_screw.png?v=20260709', preload: true },
	qWinTile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/energy_screw_win.png?v=20260709', preload: true },
	qTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/energy_screw_mobile.png?v=20260709', preload: true },
	qWinTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/energy_screw_mobile_win.png?v=20260709', preload: true },
	wildTile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild.png?v=20260709', preload: true },
	wildWinTile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild.png?v=20260709', preload: true },
	wildTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_mobile.png?v=20260709', preload: true },
	wildWinTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_mobile.png?v=20260709', preload: true },
	wild2xTile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x2.png?v=20260709', preload: true },
	wild3xTile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x3.png?v=20260709', preload: true },
	wild4xTile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x4.png?v=20260709', preload: true },
	wild5xTile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x5.png?v=20260709', preload: true },
	wild7xTile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x7.png?v=20260709', preload: true },
	wild9xTile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x9.png?v=20260709', preload: true },
	wild10xTile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x10.png?v=20260709', preload: true },
	wild2xTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x2_mobile.png?v=20260709', preload: true },
	wild3xTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x3_mobile.png?v=20260709', preload: true },
	wild4xTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x4_mobile.png?v=20260709', preload: true },
	wild5xTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x5_mobile.png?v=20260709', preload: true },
	wild7xTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x7_mobile.png?v=20260709', preload: true },
	wild9xTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x9_mobile.png?v=20260709', preload: true },
	wild10xTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x10_mobile.png?v=20260709', preload: true },
	// Animated scatter win state (Magnific video: electric arcs around the toolbox, black keyed
	// to alpha with the static tile as opacity floor). Near-seamless 40-frame loop.
	scatterWinAnim: {
		type: 'spriteSheet',
		src: './assets/sprites/scatterAnim/scatter_win_anim.json',
		preload: true,
	},
	scatterCustom: { type: 'sprite', src: './assets/components/symbols/magnetic/special/scatter.png?v=20260709', preload: true },
	scatterWin: { type: 'sprite', src: './assets/components/symbols/magnetic/special/scatter.png?v=20260709', preload: true },
	scatterCustomMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/scatter_mobile.png?v=20260709', preload: true },
	scatterWinMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/scatter_mobile.png?v=20260709', preload: true },
	foxTile:      { type: 'sprite', src: './assets/components/symbols/magnetic/premium/horseshoe.png?v=20260709', preload: true },
	wolfTile:     { type: 'sprite', src: './assets/components/symbols/magnetic/premium/plasma_drill.png?v=20260709', preload: true },
	bearTile:     { type: 'sprite', src: './assets/components/symbols/magnetic/premium/magnetic_core_cube.png?v=20260709', preload: true },
	rabbitTile:   { type: 'sprite', src: './assets/components/symbols/magnetic/premium/electromagnetic_device.png?v=20260709', preload: true },
	magnetTile:   { type: 'sprite', src: './assets/components/ui/magnet_win.png?v=20260709', preload: true },
	squirrelTile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/bolt.png?v=20260709', preload: true },
	squirrelTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/bolt_mobile.png?v=20260709', preload: true },
	// Premium mobile (portrait) symbol art.
	foxTileMobile:       { type: 'sprite', src: './assets/components/symbols/magnetic/premium/horseshoe_mobile.png?v=20260709', preload: true },
	foxWinTileMobile:    { type: 'sprite', src: './assets/components/symbols/magnetic/premium/horseshoe_mobile_win.png?v=20260709', preload: true },
	wolfTileMobile:      { type: 'sprite', src: './assets/components/symbols/magnetic/premium/plasma_drill_mobile.png?v=20260709', preload: true },
	wolfWinTileMobile:   { type: 'sprite', src: './assets/components/symbols/magnetic/premium/plasma_drill_mobile_win.png?v=20260709', preload: true },
	bearTileMobile:      { type: 'sprite', src: './assets/components/symbols/magnetic/premium/magnetic_core_cube_mobile.png?v=20260709', preload: true },
	bearWinTileMobile:   { type: 'sprite', src: './assets/components/symbols/magnetic/premium/magnetic_core_cube_mobile_win.png?v=20260709', preload: true },
	rabbitTileMobile:    { type: 'sprite', src: './assets/components/symbols/magnetic/premium/electromagnetic_device_mobile.png?v=20260709', preload: true },
	rabbitWinTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/premium/electromagnetic_device_mobile_win.png?v=20260709', preload: true },
	// Landscape (mobile horizontal) symbol art.
	foxTileLand:       { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/horseshoe_land.png?v=20260713', preload: true },
	foxWinTileLand:    { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/horseshoe_land_win.png?v=20260713', preload: true },
	wolfTileLand:      { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/plasma_land.png?v=20260713', preload: true },
	wolfWinTileLand:   { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/plasma_land_win.png?v=20260713', preload: true },
	bearTileLand:      { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/cube_land.png?v=20260713', preload: true },
	bearWinTileLand:   { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/cube_land_win.png?v=20260713', preload: true },
	rabbitTileLand:    { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/emag_land.png?v=20260713', preload: true },
	rabbitWinTileLand: { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/emag_land_win.png?v=20260713', preload: true },
	squirrelTileLand:    { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/bolt_land.png?v=20260713', preload: true },
	squirrelWinTileLand: { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/bolt_land_win.png?v=20260713', preload: true },
	aTileLand:    { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/nut_land.png?v=20260713', preload: true },
	aWinTileLand: { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/nut_land_win.png?v=20260713', preload: true },
	kTileLand:    { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/washer_land.png?v=20260713', preload: true },
	kWinTileLand: { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/washer_land_win.png?v=20260713', preload: true },
	qTileLand:    { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/energy_screw_land.png?v=20260713', preload: true },
	qWinTileLand: { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/energy_screw_land_win.png?v=20260713', preload: true },
	wildTileLand:    { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/wild_land.png?v=20260713', preload: true },
	scatterTileLand: { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/scatter_land.png?v=20260713', preload: true },
	wild2xTileLand:  { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/wild2x_land.png?v=20260713', preload: true },
	wild3xTileLand:  { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/wild3x_land.png?v=20260713', preload: true },
	wild4xTileLand:  { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/wild4x_land.png?v=20260713', preload: true },
	wild5xTileLand:  { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/wild5x_land.png?v=20260713', preload: true },
	wild7xTileLand:  { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/wild7x_land.png?v=20260713', preload: true },
	wild9xTileLand:  { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/wild9x_land.png?v=20260713', preload: true },
	wild10xTileLand: { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/wild10x_land.png?v=20260713', preload: true },
	foxWinTile: { type: 'sprite', src: './assets/components/symbols/magnetic/premium/horseshoe_win.png?v=20260709', preload: true },
	wolfWinTile: { type: 'sprite', src: './assets/components/symbols/magnetic/premium/plasma_drill_win.png?v=20260709', preload: true },
	bearWinTile: { type: 'sprite', src: './assets/components/symbols/magnetic/premium/magnetic_core_cube_win.png?v=20260709', preload: true },
	rabbitWinTile: { type: 'sprite', src: './assets/components/symbols/magnetic/premium/electromagnetic_device_win.png?v=20260709', preload: true },
	magnetWinTile: { type: 'sprite', src: './assets/components/ui/magnet_win.png?v=20260709', preload: true },
	squirrelWinTile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/bolt_win.png?v=20260709', preload: true },
	foxExpTile: { type: 'sprite', src: './assets/components/symbols/fox_expand.png?v=20260625', preload: true },
	// Win boards — preloaded so board escalation during count-up doesn't stall
	sweetWinBoard:     { type: 'sprite', src: './assets/components/win_boards/sweet_win.png?v=20260709', preload: true },
	wildWinBoard:      { type: 'sprite', src: './assets/components/win_boards/big_win.png?v=20260709', preload: true },
	epicWinBoard:      { type: 'sprite', src: './assets/components/win_boards/epic_win.png?v=20260709', preload: true },
	mythicWinBoard:    { type: 'sprite', src: './assets/components/win_boards/mega_win.png?v=20260709', preload: true },
	legendaryWinBoard: { type: 'sprite', src: './assets/components/win_boards/max_win.png?v=20260709', preload: true },
	// Special wide board for the 20000x max-win cap (Figma 4143-16513), 1535×1025
	maxWinBoard:       { type: 'sprite', src: './assets/components/win_boards/max_win_screen.png?v=20260709', preload: true },
	pressToContinueText: {
		type: 'sprites',
		src: './assets/sprites/pressToContinueText/MM_pressanywhere.json?v=20260611',
		preload: true,
	},
	goldFont: {
		type: 'font',
		src: './assets/fonts/goldFont/mm_gold.xml?v=20260611',
	},
	silverFont: {
		type: 'font',
		src: './assets/fonts/silverFont/mm_silver.xml?v=20260611',
	},
	bigwin: {
		type: 'spine',
		src: {
			atlas: './assets/spines/bigwin/big_wins.atlas',
			skeleton: './assets/spines/bigwin/mm_bigwin.json',
			scale: 2,
		},
	},
	fsIntro: {
		type: 'spine',
		src: {
			atlas: './assets/spines/fsIntro/fs_screen.atlas',
			skeleton: './assets/spines/fsIntro/fs_screen.json',
			scale: 2,
		},
	},
	progressBar: {
		type: 'sprites',
		src: './assets/sprites/progressBar/progressBar.json?v=20260710',
		preload: true,
	},
	transition: {
		type: 'spine',
		src: {
			atlas: './assets/spines/transition/transition.atlas',
			skeleton: './assets/spines/transition/transition.json',
			scale: 2,
		},
	},
	coins: {
		type: 'spriteSheet',
		src: './assets/sprites/coin/SD2_Coin.json?v=20260624',
	},
	sound: {
		type: 'audio',
		src: './assets/audio/sounds.json?v=20260713',
		preload: true,
	},
} as const;
