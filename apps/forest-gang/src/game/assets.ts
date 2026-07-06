// Portrait phones load a dedicated mobile symbol set (same aliases, different art).
// Decided once at boot from the viewport ratio (mirrors layoutType 'portrait' = ratio ≤ 0.8).
const _isPortraitViewport =
	typeof window !== 'undefined' && window.innerWidth / Math.max(1, window.innerHeight) <= 0.8;
const MOBILE_SYMBOLS = new Set([
	'card_a.png', 'card_a_win.png', 'card_k.png', 'card_k_win.png',
	'card_q.png', 'card_q_win.png', 'card_j.png', 'card_j_win.png',
	'card_t.png', 'card_t_win.png',
	'fox.png', 'wolf.png', 'bear.png', 'rabbit.png', 'squirrel.png',
	'wild.png', 'scatter.png',
	'card_a_bonus.png', 'card_k_bonus.png', 'card_q_bonus.png',
	'card_j_bonus.png', 'card_t_bonus.png',
]);

const assets = {
	loader: {
		type: 'spine',
		src: {
			atlas: './assets/spines/loader/loader.atlas',
			skeleton: './assets/spines/loader/loader.json',
			scale: 2,
		},
		preload: true,
	},



	visualV2: {
		type: 'sprite',
		// 1920×1080 — the 4800×2680 PNG exceeded the WebGL max texture size on some GPUs
		// and rendered black. Matches the bonus backgrounds' resolution.
		src: './assets/components/backgrounds/visual_v2.jpg?v=20260706light',
		preload: true,
	},
	// Dedicated portrait forest scene (360×800) — used in the base game on portrait phones
	// instead of the cropped landscape visualV2.
	visualPortrait: {
		type: 'sprite',
		src: './assets/components/backgrounds/bg_mobile_portrait.jpg?v=20260703',
		preload: true,
	},
	// Figma top+bottom shadow (node 2792-4133) layered on top of the portrait bg ONLY —
	// rendered below the board/symbols/logo so it darkens the scene, never the UI.
	portraitShadow: {
		type: 'sprite',
		src: './assets/components/backgrounds/portrait_shadow.png?v=20260703',
		preload: true,
	},
	bonusNormalBackground: {
		type: 'sprite',
		src: './assets/components/backgrounds/bonus_normal_bg.webp?v=20260630',
		preload: true,
	},
	bonusSuperBackground: {
		type: 'sprite',
		src: './assets/components/backgrounds/bonus_super_bg.webp?v=20260630',
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
	slotPad: {
		type: 'sprite',
		src: './assets/components/frames/slot_pad.png?v=20260629',
		preload: true,
	},
	slotPadMobile: {
		type: 'sprite',
		src: './assets/components/frames/board_frame_mobile.png?v=20260703',
		preload: true,
	},
	badgeFrame: {
		type: 'sprite',
		src: './assets/components/frames/badge_frame.png?v=20260701',
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
		src: './assets/components/characters/deer_presenter.png?v=20260701b',
		preload: true,
	},
	deerPresenterMobile: {
		type: 'sprite',
		src: './assets/components/characters/deer_presenter_mobile.png?v=20260701',
		preload: true,
	},
	multiplierHand: {
		type: 'sprite',
		src: './assets/components/ui/multiplier_hand.png?v=20260624',
		preload: true,
	},
	multiplierXRed: {
		type: 'sprite',
		src: './assets/components/ui/multiplier_x_red.png?v=20260703',
		preload: true,
	},
	forestGangLogo: {
		type: 'sprite',
		src: './assets/components/ui/forest_gang_logo.png?v=20260611',
		preload: true,
	},
	pressPlayLogo: {
		type: 'sprite',
		src: './assets/components/ui/press_play_logo.png?v=20260630',
		preload: true,
	},
	earnedCoin: {
		type: 'sprite',
		src: './assets/components/ui/earned_coin.png?v=20260701b',
		preload: true,
	},
	scatterPanelImage: {
		type: 'sprite',
		src: './assets/components/ui/scatter-panel-image.png?v=20260611',
		preload: true,
	},
	reelDivider: { type: 'sprite', src: './assets/components/frames/reel_divider.png?v=20260706', preload: true },
	aTile: { type: 'sprite', src: './assets/components/symbols/card_a.png?v=20260701c', preload: true },
	aWinTile: { type: 'sprite', src: './assets/components/symbols/card_a_win.png?v=20260701c', preload: true },
	kTile: { type: 'sprite', src: './assets/components/symbols/card_k.png?v=20260701c', preload: true },
	kWinTile: { type: 'sprite', src: './assets/components/symbols/card_k_win.png?v=20260701c', preload: true },
	qTile: { type: 'sprite', src: './assets/components/symbols/card_q.png?v=20260701c', preload: true },
	qWinTile: { type: 'sprite', src: './assets/components/symbols/card_q_win.png?v=20260701c', preload: true },
	jTile: { type: 'sprite', src: './assets/components/symbols/card_j.png?v=20260701c', preload: true },
	jWinTile: { type: 'sprite', src: './assets/components/symbols/card_j_win.png?v=20260701c', preload: true },
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
	tTile: { type: 'sprite', src: './assets/components/symbols/card_t.png?v=20260701c', preload: true },
	tWinTile: { type: 'sprite', src: './assets/components/symbols/card_t_win.png?v=20260701c', preload: true },
	wildTile: { type: 'sprite', src: './assets/components/symbols/wild.png?v=20260630c', preload: true },
	wildWinTile: { type: 'sprite', src: './assets/components/symbols/wild.png?v=20260630c', preload: true },
	scatterCustom: { type: 'sprite', src: './assets/components/symbols/scatter.png?v=20260630c', preload: true },
	scatterWin: { type: 'sprite', src: './assets/components/symbols/scatter.png?v=20260630c', preload: true },
	foxTile:      { type: 'sprite', src: './assets/components/symbols/fox.png?v=20260630b', preload: true },
	wolfTile:     { type: 'sprite', src: './assets/components/symbols/wolf.png?v=20260630b', preload: true },
	bearTile:     { type: 'sprite', src: './assets/components/symbols/bear.png?v=20260630b', preload: true },
	rabbitTile:   { type: 'sprite', src: './assets/components/symbols/rabbit.png?v=20260630b', preload: true },
	squirrelTile: { type: 'sprite', src: './assets/components/symbols/squirrel.png?v=20260630b', preload: true },
	foxBonusTile: { type: 'sprite', src: './assets/components/symbols/fox.png?v=20260625', preload: true },
	foxWinTile: { type: 'sprite', src: './assets/components/symbols/fox.png?v=20260626', preload: true },
	wolfBonusTile: { type: 'sprite', src: './assets/components/symbols/wolf.png?v=20260625', preload: true },
	wolfWinTile: { type: 'sprite', src: './assets/components/symbols/wolf.png?v=20260626', preload: true },
	bearBonusTile: { type: 'sprite', src: './assets/components/symbols/bear.png?v=20260625', preload: true },
	bearWinTile: { type: 'sprite', src: './assets/components/symbols/bear.png?v=20260626', preload: true },
	rabbitBonusTile: { type: 'sprite', src: './assets/components/symbols/rabbit.png?v=20260625', preload: true },
	rabbitWinTile: { type: 'sprite', src: './assets/components/symbols/rabbit.png?v=20260626', preload: true },
	squirrelBonusTile: { type: 'sprite', src: './assets/components/symbols/squirrel.png?v=20260625', preload: true },
	squirrelWinTile: { type: 'sprite', src: './assets/components/symbols/squirrel.png?v=20260626', preload: true },
	aExpTile: { type: 'sprite', src: './assets/components/symbols/card_a.png?v=20260625', preload: true },
	aWinExpTile: { type: 'sprite', src: './assets/components/symbols/card_a_win.png?v=20260625', preload: true },
	kExpTile: { type: 'sprite', src: './assets/components/symbols/card_k.png?v=20260625', preload: true },
	kWinExpTile: { type: 'sprite', src: './assets/components/symbols/card_k_win.png?v=20260625', preload: true },
	qExpTile: { type: 'sprite', src: './assets/components/symbols/card_q.png?v=20260625', preload: true },
	qWinExpTile: { type: 'sprite', src: './assets/components/symbols/card_q_win.png?v=20260625', preload: true },
	jExpTile: { type: 'sprite', src: './assets/components/symbols/card_j.png?v=20260625', preload: true },
	jWinExpTile: { type: 'sprite', src: './assets/components/symbols/card_j_win.png?v=20260625', preload: true },
	tExpTile: { type: 'sprite', src: './assets/components/symbols/card_t.png?v=20260625', preload: true },
	tWinExpTile: { type: 'sprite', src: './assets/components/symbols/card_t_win.png?v=20260625', preload: true },
	foxExpTile: { type: 'sprite', src: './assets/components/symbols/fox_expand.png?v=20260629', preload: true },
	foxExpWinTile: { type: 'sprite', src: './assets/components/symbols/fox_expand.png?v=20260625', preload: true },
	wolfExpTile: { type: 'sprite', src: './assets/components/symbols/wolf_expand.png?v=20260629', preload: true },
	wolfExpWinTile: { type: 'sprite', src: './assets/components/symbols/wolf_expand.png?v=20260625', preload: true },
	bearExpTile: { type: 'sprite', src: './assets/components/symbols/bear_expand.png?v=20260629', preload: true },
	bearExpWinTile: { type: 'sprite', src: './assets/components/symbols/bear_expand.png?v=20260625', preload: true },
	rabbitExpTile: { type: 'sprite', src: './assets/components/symbols/rabbit_expand.png?v=20260629', preload: true },
	rabbitExpWinTile: { type: 'sprite', src: './assets/components/symbols/rabbit_expand.png?v=20260625', preload: true },
	squirrelExpTile: { type: 'sprite', src: './assets/components/symbols/squirrel_expand.png?v=20260629', preload: true },
	squirrelExpWinTile: { type: 'sprite', src: './assets/components/symbols/squirrel_expand.png?v=20260625', preload: true },
	// --- Mobile-landscape symbol art (used only when layoutType() === 'landscape') ---
	aTileLs:  { type: 'sprite', src: './assets/components/symbols/landscape/card_a.png?v=20260701', preload: true },
	kTileLs:  { type: 'sprite', src: './assets/components/symbols/landscape/card_k.png?v=20260701', preload: true },
	qTileLs:  { type: 'sprite', src: './assets/components/symbols/landscape/card_q.png?v=20260701', preload: true },
	jTileLs:  { type: 'sprite', src: './assets/components/symbols/landscape/card_j.png?v=20260701', preload: true },
	tTileLs:  { type: 'sprite', src: './assets/components/symbols/landscape/card_t.png?v=20260701', preload: true },
	aWinTileLs: { type: 'sprite', src: './assets/components/symbols/landscape/card_a_win.png?v=20260701', preload: true },
	kWinTileLs: { type: 'sprite', src: './assets/components/symbols/landscape/card_k_win.png?v=20260701', preload: true },
	qWinTileLs: { type: 'sprite', src: './assets/components/symbols/landscape/card_q_win.png?v=20260701', preload: true },
	jWinTileLs: { type: 'sprite', src: './assets/components/symbols/landscape/card_j_win.png?v=20260701', preload: true },
	tWinTileLs: { type: 'sprite', src: './assets/components/symbols/landscape/card_t_win.png?v=20260701', preload: true },
	foxTileLs:      { type: 'sprite', src: './assets/components/symbols/landscape/fox.png?v=20260701', preload: true },
	wolfTileLs:     { type: 'sprite', src: './assets/components/symbols/landscape/wolf.png?v=20260701', preload: true },
	bearTileLs:     { type: 'sprite', src: './assets/components/symbols/landscape/bear.png?v=20260701', preload: true },
	rabbitTileLs:   { type: 'sprite', src: './assets/components/symbols/landscape/rabbit.png?v=20260701', preload: true },
	squirrelTileLs: { type: 'sprite', src: './assets/components/symbols/landscape/squirrel.png?v=20260701', preload: true },
	foxWinTileLs:      { type: 'sprite', src: './assets/components/symbols/landscape/fox_win.png?v=20260701', preload: true },
	wolfWinTileLs:     { type: 'sprite', src: './assets/components/symbols/landscape/wolf_win.png?v=20260701', preload: true },
	bearWinTileLs:     { type: 'sprite', src: './assets/components/symbols/landscape/bear_win.png?v=20260701', preload: true },
	rabbitWinTileLs:   { type: 'sprite', src: './assets/components/symbols/landscape/rabbit_win.png?v=20260701', preload: true },
	squirrelWinTileLs: { type: 'sprite', src: './assets/components/symbols/landscape/squirrel_win.png?v=20260701', preload: true },
	wildTileLs:    { type: 'sprite', src: './assets/components/symbols/landscape/wild.png?v=20260701', preload: true },
	scatterCustomLs: { type: 'sprite', src: './assets/components/symbols/landscape/scatter.png?v=20260701', preload: true },
	cardPadLs:     { type: 'sprite', src: './assets/components/symbols/landscape/card_pad.png?v=20260701', preload: true },
	reelFrameLs:   { type: 'sprite', src: './assets/components/symbols/landscape/reel_frame.png?v=20260701b', preload: true },
	stepperPadLs:  { type: 'sprite', src: './assets/components/symbols/landscape/stepper_pad.png?v=20260701', preload: true },
	navBarLs:      { type: 'sprite', src: './assets/components/symbols/landscape/right_bar.png?v=20260701', preload: true },
	buyBonusLs:    { type: 'sprite', src: './assets/components/symbols/landscape/buy_bonus.png?v=20260701', preload: true },
	// Win boards — preloaded so board escalation during count-up doesn't stall
	sweetWinBoard:     { type: 'sprite', src: './assets/components/win_boards/sweet_win.png?v=20260625', preload: true },
	wildWinBoard:      { type: 'sprite', src: './assets/components/win_boards/big_win.png?v=20260625', preload: true },
	epicWinBoard:      { type: 'sprite', src: './assets/components/win_boards/epic_win.png?v=20260625', preload: true },
	mythicWinBoard:    { type: 'sprite', src: './assets/components/win_boards/mega_win.png?v=20260625', preload: true },
	legendaryWinBoard: { type: 'sprite', src: './assets/components/win_boards/max_win.png?v=20260629', preload: true },
	maxWinScreen:      { type: 'sprite', src: './assets/components/win_boards/max_win_screen.png?v=20260701', preload: true },
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
	anticipation: {
		type: 'spine',
		src: {
			atlas: './assets/spines/anticipation/anticipation.atlas',
			skeleton: './assets/spines/anticipation/anticipation.json',
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
		src: './assets/sprites/coin/SD2_Coin.json?v=20260701d',
	},
	sound: {
		type: 'audio',
		src: './assets/audio/sounds.json?v=20260706n',
		preload: true,
	},
} as const;

// Portrait-only: redirect the reel symbol sprites to the mobile art at boot.
// Desktop/landscape keep the original './symbols/...' paths untouched.
if (_isPortraitViewport) {
	for (const entry of Object.values(assets as Record<string, { type?: string; src?: unknown }>)) {
		if (entry && entry.type === 'sprite' && typeof entry.src === 'string') {
			entry.src = entry.src.replace(
				/\/symbols\/([^?]+)/,
				(match: string, file: string) => (MOBILE_SYMBOLS.has(file) ? `/symbols_mobile/${file}` : match),
			);
		}
	}
}

export default assets;
