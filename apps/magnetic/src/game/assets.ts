export default {
	loader: {
		type: 'spine',
		src: {
			atlas: './assets/spines/loader/loader.atlas',
			skeleton: './assets/spines/loader/loader.json',
			scale: 2,
		},
		preload: true,
	},



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
	capsuleTubeMobile: {
		type: 'sprite',
		src: './assets/components/ui/capsule_tube_mobile.png?v=20260709',
		preload: true,
	},
	smallPadMobile: {
		type: 'sprite',
		src: './assets/components/ui/small_pad_mobile.png?v=20260709',
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
	capsuleMagnet: {
		type: 'sprite',
		src: './assets/components/ui/capsule_magnet.png?v=20260708',
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
	// Transparent horizontal capsule tube (black/empty inside) — framed around the win amount on the
	// win-tier screens, with custom animated lightning added on top (like the desktop CapsulePanel).
	winTube: {
		type: 'sprite',
		src: './assets/components/ui/tube_black.png?v=20260710',
		preload: true,
	},
	// Fully transparent horizontal tube (metal caps + blue rails, see-through interior) — the always-on
	// portrait capsule bar; live lightning is drawn inside the clear window.
	capsuleTubeGlass: {
		type: 'sprite',
		src: './assets/components/ui/magnetic_tube.png?v=20260710',
		preload: true,
	},
	// Frameless premium elements designed to sit INSIDE the capsule tube (no square symbol frame).
	tubeMagnet: {
		type: 'sprite',
		src: './assets/components/ui/tube_magnet.png?v=20260708',
		preload: true,
	},
	tubeDrill: {
		type: 'sprite',
		src: './assets/components/ui/tube_drill.png?v=20260708',
		preload: true,
	},
	tubeCube: {
		type: 'sprite',
		src: './assets/components/ui/tube_cube.png?v=20260708',
		preload: true,
	},
	tubeMachine: {
		type: 'sprite',
		src: './assets/components/ui/tube_machine.png?v=20260708',
		preload: true,
	},
	// Free-spins intro popup: dark-blue tech panel + win-state horseshoe magnet (baked electric FX).
	fsPanel: {
		type: 'sprite',
		src: './assets/components/ui/fs_panel.png?v=20260708',
		preload: true,
	},
	magnetWin: {
		type: 'sprite',
		src: './assets/components/ui/magnet_win.png?v=20260708',
		preload: true,
	},
	// Free-spins intro: full magnet element (magnet + base + blue/orange energy) and the press arrow.
	popupMagnet: {
		type: 'sprite',
		src: './assets/components/ui/popup_magnet.png?v=20260708',
		preload: true,
	},
	pressArrow: {
		type: 'sprite',
		src: './assets/components/ui/press_arrow.png?v=20260708',
		preload: true,
	},
	reelsFrame: {
		type: 'sprite',
		src: './assets/components/frames/reels_frame.png?v=20260623',
		preload: true,
	},
	splash: {
		type: 'sprite',
		src: './assets/components/backgrounds/splash.jpg?v=20260622',
		preload: true,
	},
	logoFrame: {
		type: 'sprite',
		src: './assets/components/frames/logo_frame.png?v=20260611',
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
	scatterPanelImage: {
		type: 'sprite',
		src: './assets/components/ui/scatter-panel-image.png?v=20260611',
		preload: true,
	},
	// 16-frame rotation flipbook for the washer — played while the washer is locked in a cluster
	// (the "being screwed in" animation). Packed 4x4, 420px frames, pivot centred.
	washerLockSheet: { type: 'spriteSheet', src: './assets/components/symbols/magnetic/low/washer_lock_sheet.json', preload: true },
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
	jTile: { type: 'sprite', src: './assets/components/symbols/card_j.png?v=20260626', preload: true },
	jWinTile: { type: 'sprite', src: './assets/components/symbols/card_j_win.png?v=20260625', preload: true },
	squirrelJAnim: {
		type: 'spine',
		src: {
			atlas: './assets/new_assets/slots_replacement/standard/squirrel_J_anim.atlas',
			skeleton: './assets/new_assets/slots_replacement/standard/squirrel_J_anim.json',
			scale: 1,
		},
		preload: true,
	},
	rabbitExpAnimTest: {
		type: 'spine',
		src: {
			atlas: './assets/new_assets/slots_replacement/standard_expanded/rabbit_10_anim/rabbit_10_anim.atlas',
			skeleton: './assets/new_assets/slots_replacement/standard_expanded/rabbit_10_anim/rabbit_10_anim.json',
			scale: 1,
		},
		preload: true,
	},
	rabbitExpAnimTestSheet: {
		type: 'spriteSheet',
		src: './assets/new_assets/slots_replacement/standard_expanded/rabbit_10_anim/rabbit_10_anim_sheet.json',
		preload: true,
	},
	tTile: { type: 'sprite', src: './assets/components/symbols/card_t.png?v=20260626', preload: true },
	tWinTile: { type: 'sprite', src: './assets/components/symbols/card_t_win.png?v=20260626', preload: true },
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
	foxBonusTile: { type: 'sprite', src: './assets/new_assets/slots_replacement/premium/fox_n.png?v=20260629', preload: true },
	foxWinTile: { type: 'sprite', src: './assets/components/symbols/magnetic/premium/horseshoe_win.png?v=20260709', preload: true },
	wolfBonusTile: { type: 'sprite', src: './assets/new_assets/slots_replacement/premium/wolf_n.png?v=20260629', preload: true },
	wolfWinTile: { type: 'sprite', src: './assets/components/symbols/magnetic/premium/plasma_drill_win.png?v=20260709', preload: true },
	bearBonusTile: { type: 'sprite', src: './assets/new_assets/slots_replacement/premium/bear_n.png?v=20260629', preload: true },
	bearWinTile: { type: 'sprite', src: './assets/components/symbols/magnetic/premium/magnetic_core_cube_win.png?v=20260709', preload: true },
	rabbitBonusTile: { type: 'sprite', src: './assets/new_assets/slots_replacement/premium/rabbit_n.png?v=20260629', preload: true },
	rabbitWinTile: { type: 'sprite', src: './assets/components/symbols/magnetic/premium/electromagnetic_device_win.png?v=20260709', preload: true },
	magnetWinTile: { type: 'sprite', src: './assets/components/ui/magnet_win.png?v=20260709', preload: true },
	squirrelBonusTile: { type: 'sprite', src: './assets/new_assets/slots_replacement/premium/squirrel_n.png?v=20260629', preload: true },
	squirrelWinTile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/bolt_win.png?v=20260709', preload: true },
	aExpTile: { type: 'sprite', src: './assets/components/symbols/card_a.png?v=20260626', preload: true },
	aWinExpTile: { type: 'sprite', src: './assets/components/symbols/card_a_win.png?v=20260626', preload: true },
	kExpTile: { type: 'sprite', src: './assets/components/symbols/card_k.png?v=20260626', preload: true },
	kWinExpTile: { type: 'sprite', src: './assets/components/symbols/card_k_win.png?v=20260626', preload: true },
	qExpTile: { type: 'sprite', src: './assets/components/symbols/card_q.png?v=20260626', preload: true },
	qWinExpTile: { type: 'sprite', src: './assets/components/symbols/card_q_win.png?v=20260626', preload: true },
	jExpTile: { type: 'sprite', src: './assets/components/symbols/card_j.png?v=20260626', preload: true },
	jWinExpTile: { type: 'sprite', src: './assets/components/symbols/card_j_win.png?v=20260625', preload: true },
	tExpTile: { type: 'sprite', src: './assets/components/symbols/card_t.png?v=20260626', preload: true },
	tWinExpTile: { type: 'sprite', src: './assets/components/symbols/card_t_win.png?v=20260626', preload: true },
	foxExpTile: { type: 'sprite', src: './assets/components/symbols/fox_expand.png?v=20260625', preload: true },
	foxExpWinTile: { type: 'sprite', src: './assets/new_assets/slots_replacement/premium_expanded/fox_exp_w.png?v=20260629', preload: true },
	wolfExpTile: { type: 'sprite', src: './assets/components/symbols/wolf_expand.png?v=20260625', preload: true },
	wolfExpWinTile: { type: 'sprite', src: './assets/new_assets/slots_replacement/premium_expanded/wolf_exp_w.png?v=20260629', preload: true },
	bearExpTile: { type: 'sprite', src: './assets/components/symbols/bear_expand.png?v=20260625', preload: true },
	bearExpWinTile: { type: 'sprite', src: './assets/new_assets/slots_replacement/premium_expanded/bear_exp_w.png?v=20260629', preload: true },
	rabbitExpTile: { type: 'sprite', src: './assets/components/symbols/rabbit_expand.png?v=20260625', preload: true },
	rabbitExpWinTile: { type: 'sprite', src: './assets/new_assets/slots_replacement/premium_expanded/rabbit_exp_w.png?v=20260629', preload: true },
	squirrelExpTile: { type: 'sprite', src: './assets/components/symbols/squirrel_expand.png?v=20260625', preload: true },
	squirrelExpWinTile: { type: 'sprite', src: './assets/new_assets/slots_replacement/premium_expanded/squirrel_exp_w.png?v=20260629', preload: true },
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
	explosion: {
		type: 'spine',
		src: {
			atlas: './assets/spines/symbols3/symbols3.atlas',
			skeleton: './assets/spines/symbols3/explosion.json',
			scale: 2,
		},
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
	globalMultiplier: {
		type: 'spine',
		src: {
			atlas: './assets/spines/globalMultiplier/multiframe.atlas',
			skeleton: './assets/spines/globalMultiplier/multiframe.json',
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
	bonusBuyButtonFrame: {
		type: 'sprite',
		src: './assets/components/frames/bonus_buy_button_frame.png?v=20260623',
		preload: true,
	},
	fsBoardBg: {
		type: 'sprite',
		src: './assets/sprites/fsBoardBg/fsBoardBg.png',
	},
	fsMedallion: {
		type: 'sprite',
		src: './assets/sprites/fsMedallion/fsMedallion.png',
	},
	progressBar: {
		type: 'sprites',
		src: './assets/sprites/progressBar/progressBar.json?v=20260611',
		preload: true,
	},
	freeSpins: {
		type: 'sprites',
		src: './assets/sprites/freeSpins/freeSpins.json?v=20260624',
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
		src: './assets/audio/sounds.json?v=20260611',
		preload: true,
	},
} as const;
