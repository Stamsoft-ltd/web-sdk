const assets = {
	loader: {
		type: 'spine',
		src: {
			atlas: './assets/spines/loader/loader.atlas',
			skeleton: './assets/spines/loader/loader.json',
			scale: 2,
		},
	},



	visualV2: {
		type: 'sprite',
		// 1920×1080 — the 4800×2680 PNG exceeded the WebGL max texture size on some GPUs
		// and rendered black. Matches the bonus backgrounds' resolution.
		src: './assets/components/backgrounds/visual_v2.jpg?v=20260706light2',
	},
	// Dedicated portrait forest scene (360×800) — used in the base game on portrait phones
	// instead of the cropped landscape visualV2.
	visualPortrait: {
		type: 'sprite',
		src: './assets/components/backgrounds/bg_mobile_portrait.jpg?v=20260703',
	},
	// Figma top+bottom shadow (node 2792-4133) layered on top of the portrait bg ONLY —
	// rendered below the board/symbols/logo so it darkens the scene, never the UI.
	portraitShadow: {
		type: 'sprite',
		src: './assets/components/backgrounds/portrait_shadow.webp?v=20260703',
	},
	bonusNormalBackground: {
		type: 'sprite',
		src: './assets/components/backgrounds/bonus_normal_bg.webp?v=20260630',
	},
	bonusSuperBackground: {
		type: 'sprite',
		src: './assets/components/backgrounds/bonus_super_bg.webp?v=20260630',
	},
	// Animated bonus backgrounds (video textures; looped/played on demand in Background.svelte).
	bonusSuperBgVideo: {
		type: 'sprite',
		src: './assets/components/backgrounds/superbonus_background.mp4',
	},
	bonusNormalBgVideo: {
		type: 'sprite',
		src: './assets/components/backgrounds/normalbonus_background.mp4',
	},
	baseBgVideo: {
		type: 'sprite',
		src: './assets/components/backgrounds/basegame_background.mp4',
	},
	reelsFrame: {
		type: 'sprite',
		src: './assets/components/frames/reels_frame.webp?v=20260623',
	},
	splash: {
		type: 'sprite',
		src: './assets/components/backgrounds/splash.jpg?v=20260622',
	},
	logoFrame: {
		type: 'sprite',
		src: './assets/components/frames/logo_frame.webp?v=20260611',
	},
	slotPad: {
		type: 'sprite',
		src: './assets/components/frames/slot_pad.webp?v=20260629',
	},
	slotPadMobile: {
		type: 'sprite',
		src: './assets/components/frames/board_frame_mobile.webp?v=20260703',
	},
	badgeFrame: {
		type: 'sprite',
		src: './assets/components/frames/badge_frame.webp?v=20260701',
	},
	symbolPad: {
		type: 'sprite',
		src: './assets/components/frames/symbol_pad.webp?v=20260625',
	},
	counterFrame: {
		type: 'sprite',
		src: './assets/components/ui/confirm_frame.webp?v=20260625',
	},
	deerPresenter: {
		type: 'sprite',
		src: './assets/components/characters/deer_presenter.webp?v=20260701b',
	},
	deerPresenterMobile: {
		type: 'sprite',
		src: './assets/components/characters/deer_presenter_mobile.webp?v=20260701',
	},
	multiplierHand: {
		type: 'sprite',
		src: './assets/components/ui/multiplier_hand.webp?v=20260624',
	},
	multiplierXRed: {
		type: 'sprite',
		src: './assets/components/ui/multiplier_x_red.webp?v=20260703',
	},
	forestGangLogo: {
		type: 'sprite',
		src: './assets/components/ui/forest_gang_logo.webp?v=20260611',
	},
	pressPlayLogo: {
		type: 'sprite',
		src: './assets/components/ui/press_play_logo.webp?v=20260630',
	},
	earnedCoin: {
		type: 'sprite',
		src: './assets/components/ui/earned_coin.webp?v=20260701b',
	},
	scatterPanelImage: {
		type: 'sprite',
		src: './assets/components/ui/scatter-panel-image.webp?v=20260611',
	},
	reelDivider: { type: 'sprite', src: './assets/components/frames/reel_divider.webp?v=20260706' },
	aTile: { type: 'sprite', src: './assets/components/symbols/card_a.webp?v=20260701c' },
	aWinTile: { type: 'sprite', src: './assets/components/symbols/card_a_win.webp?v=20260701c' },
	kTile: { type: 'sprite', src: './assets/components/symbols/card_k.webp?v=20260701c' },
	kWinTile: { type: 'sprite', src: './assets/components/symbols/card_k_win.webp?v=20260701c' },
	qTile: { type: 'sprite', src: './assets/components/symbols/card_q.webp?v=20260701c' },
	qWinTile: { type: 'sprite', src: './assets/components/symbols/card_q_win.webp?v=20260701c' },
	jTile: { type: 'sprite', src: './assets/components/symbols/card_j.webp?v=20260701c' },
	jWinTile: { type: 'sprite', src: './assets/components/symbols/card_j_win.webp?v=20260701c' },
	squirrelJAnim: {
		type: 'spine',
		src: {
			atlas: './assets/new_assets/slots_replacement/standard/squirrel_J_anim.atlas',
			skeleton: './assets/new_assets/slots_replacement/standard/squirrel_J_anim.json',
			scale: 1,
		},
	},
	rabbitExpAnimTest: {
		type: 'spine',
		src: {
			atlas: './assets/new_assets/slots_replacement/standard_expanded/rabbit_10_anim/rabbit_10_anim.atlas',
			skeleton: './assets/new_assets/slots_replacement/standard_expanded/rabbit_10_anim/rabbit_10_anim.json',
			scale: 1,
		},
	},
	rabbitExpAnimTestSheet: {
		type: 'spriteSheet',
		src: './assets/new_assets/slots_replacement/standard_expanded/rabbit_10_anim/rabbit_10_anim_sheet.json',
	},
	tTile: { type: 'sprite', src: './assets/components/symbols/card_t.webp?v=20260701c' },
	tWinTile: { type: 'sprite', src: './assets/components/symbols/card_t_win.webp?v=20260701c' },
	wildTile: { type: 'sprite', src: './assets/components/symbols/wild.webp?v=20260630c' },
	wildWinTile: { type: 'sprite', src: './assets/components/symbols/wild.webp?v=20260630c' },
	scatterCustom: { type: 'sprite', src: './assets/components/symbols/scatter.webp?v=20260630c' },
	scatterWin: { type: 'sprite', src: './assets/components/symbols/scatter.webp?v=20260630c' },
	foxTile:      { type: 'sprite', src: './assets/components/symbols/fox.webp?v=20260630b' },
	wolfTile:     { type: 'sprite', src: './assets/components/symbols/wolf.webp?v=20260630b' },
	bearTile:     { type: 'sprite', src: './assets/components/symbols/bear.webp?v=20260630b' },
	rabbitTile:   { type: 'sprite', src: './assets/components/symbols/rabbit.webp?v=20260630b' },
	squirrelTile: { type: 'sprite', src: './assets/components/symbols/squirrel.webp?v=20260630b' },
	foxBonusTile: { type: 'sprite', src: './assets/components/symbols/fox.webp?v=20260625' },
	foxWinTile: { type: 'sprite', src: './assets/components/symbols/fox.webp?v=20260626' },
	wolfBonusTile: { type: 'sprite', src: './assets/components/symbols/wolf.webp?v=20260625' },
	wolfWinTile: { type: 'sprite', src: './assets/components/symbols/wolf.webp?v=20260626' },
	bearBonusTile: { type: 'sprite', src: './assets/components/symbols/bear.webp?v=20260625' },
	bearWinTile: { type: 'sprite', src: './assets/components/symbols/bear.webp?v=20260626' },
	rabbitBonusTile: { type: 'sprite', src: './assets/components/symbols/rabbit.webp?v=20260625' },
	rabbitWinTile: { type: 'sprite', src: './assets/components/symbols/rabbit.webp?v=20260626' },
	squirrelBonusTile: { type: 'sprite', src: './assets/components/symbols/squirrel.webp?v=20260625' },
	squirrelWinTile: { type: 'sprite', src: './assets/components/symbols/squirrel.webp?v=20260626' },
	aExpTile: { type: 'sprite', src: './assets/components/symbols/card_a.webp?v=20260625' },
	aWinExpTile: { type: 'sprite', src: './assets/components/symbols/card_a_win.webp?v=20260625' },
	kExpTile: { type: 'sprite', src: './assets/components/symbols/card_k.webp?v=20260625' },
	kWinExpTile: { type: 'sprite', src: './assets/components/symbols/card_k_win.webp?v=20260625' },
	qExpTile: { type: 'sprite', src: './assets/components/symbols/card_q.webp?v=20260625' },
	qWinExpTile: { type: 'sprite', src: './assets/components/symbols/card_q_win.webp?v=20260625' },
	jExpTile: { type: 'sprite', src: './assets/components/symbols/card_j.webp?v=20260625' },
	jWinExpTile: { type: 'sprite', src: './assets/components/symbols/card_j_win.webp?v=20260625' },
	tExpTile: { type: 'sprite', src: './assets/components/symbols/card_t.webp?v=20260625' },
	tWinExpTile: { type: 'sprite', src: './assets/components/symbols/card_t_win.webp?v=20260625' },
	foxExpTile: { type: 'sprite', src: './assets/components/symbols/fox_expand.webp?v=20260629' },
	foxExpWinTile: { type: 'sprite', src: './assets/components/symbols/fox_expand.webp?v=20260625' },
	wolfExpTile: { type: 'sprite', src: './assets/components/symbols/wolf_expand.webp?v=20260629' },
	wolfExpWinTile: { type: 'sprite', src: './assets/components/symbols/wolf_expand.webp?v=20260625' },
	bearExpTile: { type: 'sprite', src: './assets/components/symbols/bear_expand.webp?v=20260629' },
	bearExpWinTile: { type: 'sprite', src: './assets/components/symbols/bear_expand.webp?v=20260625' },
	rabbitExpTile: { type: 'sprite', src: './assets/components/symbols/rabbit_expand.webp?v=20260629' },
	rabbitExpWinTile: { type: 'sprite', src: './assets/components/symbols/rabbit_expand.webp?v=20260625' },
	squirrelExpTile: { type: 'sprite', src: './assets/components/symbols/squirrel_expand.webp?v=20260629' },
	squirrelExpWinTile: { type: 'sprite', src: './assets/components/symbols/squirrel_expand.webp?v=20260625' },
	// --- Mobile-landscape symbol art (used only when layoutType() === 'landscape') ---
	aTileLs:  { type: 'sprite', src: './assets/components/symbols/landscape/card_a.webp?v=20260701' },
	kTileLs:  { type: 'sprite', src: './assets/components/symbols/landscape/card_k.webp?v=20260701' },
	qTileLs:  { type: 'sprite', src: './assets/components/symbols/landscape/card_q.webp?v=20260701' },
	jTileLs:  { type: 'sprite', src: './assets/components/symbols/landscape/card_j.webp?v=20260701' },
	tTileLs:  { type: 'sprite', src: './assets/components/symbols/landscape/card_t.webp?v=20260701' },
	aWinTileLs: { type: 'sprite', src: './assets/components/symbols/landscape/card_a_win.webp?v=20260701' },
	kWinTileLs: { type: 'sprite', src: './assets/components/symbols/landscape/card_k_win.webp?v=20260701' },
	qWinTileLs: { type: 'sprite', src: './assets/components/symbols/landscape/card_q_win.webp?v=20260701' },
	jWinTileLs: { type: 'sprite', src: './assets/components/symbols/landscape/card_j_win.webp?v=20260701' },
	tWinTileLs: { type: 'sprite', src: './assets/components/symbols/landscape/card_t_win.webp?v=20260701' },
	foxTileLs:      { type: 'sprite', src: './assets/components/symbols/landscape/fox.webp?v=20260701' },
	wolfTileLs:     { type: 'sprite', src: './assets/components/symbols/landscape/wolf.webp?v=20260701' },
	bearTileLs:     { type: 'sprite', src: './assets/components/symbols/landscape/bear.webp?v=20260701' },
	rabbitTileLs:   { type: 'sprite', src: './assets/components/symbols/landscape/rabbit.webp?v=20260701' },
	squirrelTileLs: { type: 'sprite', src: './assets/components/symbols/landscape/squirrel.webp?v=20260701' },
	foxWinTileLs:      { type: 'sprite', src: './assets/components/symbols/landscape/fox_win.webp?v=20260701' },
	wolfWinTileLs:     { type: 'sprite', src: './assets/components/symbols/landscape/wolf_win.webp?v=20260701' },
	bearWinTileLs:     { type: 'sprite', src: './assets/components/symbols/landscape/bear_win.webp?v=20260701' },
	rabbitWinTileLs:   { type: 'sprite', src: './assets/components/symbols/landscape/rabbit_win.webp?v=20260701' },
	squirrelWinTileLs: { type: 'sprite', src: './assets/components/symbols/landscape/squirrel_win.webp?v=20260701' },
	wildTileLs:    { type: 'sprite', src: './assets/components/symbols/landscape/wild.webp?v=20260701' },
	scatterCustomLs: { type: 'sprite', src: './assets/components/symbols/landscape/scatter.webp?v=20260701' },
	cardPadLs:     { type: 'sprite', src: './assets/components/symbols/landscape/card_pad.webp?v=20260701' },
	reelFrameLs:   { type: 'sprite', src: './assets/components/symbols/landscape/reel_frame.webp?v=20260701b' },
	stepperPadLs:  { type: 'sprite', src: './assets/components/symbols/landscape/stepper_pad.webp?v=20260701' },
	navBarLs:      { type: 'sprite', src: './assets/components/symbols/landscape/right_bar.webp?v=20260701' },
	buyBonusLs:    { type: 'sprite', src: './assets/components/symbols/landscape/buy_bonus.webp?v=20260701' },
	// Win boards — preloaded so board escalation during count-up doesn't stall
	sweetWinBoard:     { type: 'sprite', src: './assets/components/win_boards/sweet_win_fig.webp?v=20260716d' },
	wildWinBoard:      { type: 'sprite', src: './assets/components/win_boards/big_win_fig.webp?v=20260716d' },
	epicWinBoard:      { type: 'sprite', src: './assets/components/win_boards/epic_win_fig.webp?v=20260716d' },
	mythicWinBoard:    { type: 'sprite', src: './assets/components/win_boards/mega_win_fig.webp?v=20260716d' },
	legendaryWinBoard: { type: 'sprite', src: './assets/components/win_boards/max_win_fig.webp?v=20260716d' },
	maxWinScreen:      { type: 'sprite', src: './assets/components/win_boards/max_win_screen.webp?v=20260701' },
	// Golden P mark pulsing on the win boards' gem medallion (Figma 3205-2090).
	winEmblemP:        { type: 'sprite', src: './assets/components/win_boards/win_emblem_p.webp?v=20260716' },
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
	// The fsIntro glow layers only (frame stripped) — reused behind the big-win boards.
	winGlow: {
		type: 'spine',
		src: {
			atlas: './assets/spines/fsIntro/fs_screen.atlas',
			skeleton: './assets/spines/fsIntro/fs_glow.json',
			scale: 2,
		},
	},
	bonusBuyButtonFrame: {
		type: 'sprite',
		src: './assets/components/frames/bonus_buy_button_frame.webp?v=20260623',
	},
	fsBoardBg: {
		type: 'sprite',
		src: './assets/sprites/fsBoardBg/fsBoardBg.webp',
	},
	fsMedallion: {
		type: 'sprite',
		src: './assets/sprites/fsMedallion/fsMedallion.webp',
	},
	// Animated scatter medallion (Magnific webm with real alpha; seamless 40-frame loop) —
	// replaces the static fsMedallion on the free-spin intro/outro popups.
	fsMedallionAnim: {
		type: 'spriteSheet',
		src: './assets/sprites/fsMedallion/medallion_anim.json',
	},
	// Animated deer presenter (background-removed video frames; 41-frame loop) — replaces the
	// static desktop deer on the expanded-symbol reveal.
	deerPresenterAnim: {
		type: 'spriteSheet',
		src: './assets/sprites/deerPresenterAnim/deer_anim.json',
	},
	// Animated WILD symbol (background-removed video frames; 40-frame loop) — plays on the reels.
	wildAnim: {
		type: 'spriteSheet',
		src: './assets/sprites/wildAnim/wild_anim.json',
	},
	// Shared brown frame drawn behind every animal symbol (fox/wolf/bear/rabbit/squirrel).
	animalBorder: {
		type: 'sprite',
		src: './assets/components/symbols/animal_border.webp?v=20260720b',
	},
	// Bamboo/vine column frame (Figma 2145-328) drawn around the expanded symbol reel.
	expandedFrame: {
		type: 'sprite',
		src: './assets/components/frames/expanded_frame.webp?v=20260720',
	},
	// Animated base-state (idle blink) animals — background-removed video frames, loop on the reels.
	wolfIdleAnim: {
		type: 'spriteSheet',
		src: './assets/sprites/wolfIdleAnim/wolf_idle.json?v=20260720',
	},
	foxIdleAnim: {
		type: 'spriteSheet',
		src: './assets/sprites/foxIdleAnim/fox_idle.json?v=20260720',
	},
	squirrelIdleAnim: {
		type: 'spriteSheet',
		src: './assets/sprites/squirrelIdleAnim/squirrel_idle.json?v=20260720',
	},
	bearIdleAnim: {
		type: 'spriteSheet',
		src: './assets/sprites/bearIdleAnim/bear_idle.json?v=20260720',
	},
	rabbitIdleAnim: {
		type: 'spriteSheet',
		src: './assets/sprites/rabbitIdleAnim/rabbit_idle.json?v=20260720',
	},
	// Animated loading bar (49-frame 0→100% fill, white bar/text on transparency). This is the ONLY
	// preloaded asset: it must be ready before the loading screen paints so the bar can show first
	// while every other asset (splash art, symbols, backgrounds, videos, spines) streams in during
	// the tracked post-load phase and drives the bar's fill via stateApp.loadingProgress.
	loadingBarAnim: {
		type: 'spriteSheet',
		src: './assets/sprites/loadingBarAnim/loading_bar.json?v=20260720',
		preload: true,
	},
	// Studio "Press Play" branding shown ON the loading screen — preloaded alongside the bar so it
	// paints immediately, before the rest of the assets stream in (a non-preload logo would be blank
	// during loading). White mark on transparency; native 548×228.
	pressPlayLogo: {
		type: 'sprite',
		src: './assets/components/ui/press_play_logo.webp?v=20260720',
		preload: true,
	},
	progressBar: {
		type: 'sprites',
		src: './assets/sprites/progressBar/progressBar.json?v=20260611',
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
	// Single tumbling P-coin cycle (12 angles cut out of the coin-rain video) — the particle
	// fountain's per-coin animation, so density can scale with the win tier again.
	pCoins: {
		type: 'spriteSheet',
		src: './assets/sprites/coinRain/p_coin.json',
	},
	// 40-frame rabbit "raising money" animation, built from the Magnific video (5s source;
	// does NOT loop seamlessly — play once or ping-pong). Frames: rabbit_money_1..40.
	rabbitMoney: {
		type: 'spriteSheet',
		src: './assets/sprites/rabbitMoney/rabbit_money.json?v=20260716b',
	},
	bearMoney: {
		type: 'spriteSheet',
		src: './assets/sprites/bearMoney/bear_money.json',
	},
	foxMoney: {
		type: 'spriteSheet',
		src: './assets/sprites/foxMoney/fox_money.json',
	},
	wolfMoney: {
		type: 'spriteSheet',
		src: './assets/sprites/wolfMoney/wolf_money.json',
	},
	squirrelMoney: {
		type: 'spriteSheet',
		src: './assets/sprites/squirrelMoney/squirrel_money.json',
	},
	// Board win-state card animations (upper-body window of the same videos, card border baked).
	rabbitWinAnim:   { type: 'spriteSheet', src: './assets/sprites/rabbitWinNew/rabbit_win.json?v=20260720b' },
	bearWinAnim:     { type: 'spriteSheet', src: './assets/sprites/bearWinNew/bear_win.json?v=20260720b' },
	foxWinAnim:      { type: 'spriteSheet', src: './assets/sprites/foxWinNew/fox_win.json?v=20260720b' },
	wolfWinAnim:     { type: 'spriteSheet', src: './assets/sprites/wolfWinNew/wolf_win.json?v=20260720b' },
	squirrelWinAnim: { type: 'spriteSheet', src: './assets/sprites/squirrelWinNew/squirrel_win.json?v=20260720b' },
	// Cache-busted (?v=…) like the animal win anims — a stale/broken cached copy silently fails to
	// load (AssetsLoader swallows the error), dropping the key so winning letters fall back to the
	// old cracked static win tile instead of animating. The version query forces a fresh fetch.
	tenWinAnim:      { type: 'spriteSheet', src: './assets/sprites/tenWinAnim/ten_win_anim.json?v=20260720c' },
	aWinAnim:        { type: 'spriteSheet', src: './assets/sprites/aWinAnim/a_win_anim.json?v=20260720c' },
	jWinAnim:        { type: 'spriteSheet', src: './assets/sprites/jWinAnim/j_win_anim.json?v=20260720c' },
	kWinAnim:        { type: 'spriteSheet', src: './assets/sprites/kWinAnim/k_win_anim.json?v=20260720c' },
	qWinAnim:        { type: 'spriteSheet', src: './assets/sprites/qWinAnim/q_win_anim.json?v=20260720c' },
	// Must stay preloaded: EnableSound reads loadedAssets['sound'] in onMount (as soon as the tree
	// mounts) and crashes if it isn't ready yet, which would hang the whole loading screen.
	sound: {
		type: 'audio',
		src: './assets/audio/sounds.json?v=20260717d',
		preload: true,
	},
} as const;

export default assets;
