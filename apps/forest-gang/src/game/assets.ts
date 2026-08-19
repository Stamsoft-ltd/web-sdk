const assets = {



	// Base background for EVERY layout (static forest; replaced the looping video). The dedicated
	// portrait / mobile-landscape scenes are gone: bg_mobile_portrait still had the old FOREST
	// CASINO house in it, and both were ~546KB of art for scenes this one already covers. The
	// static files are still on disk if either is ever wanted back.
	baseBackground: {
		type: 'sprite',
		src: './assets/components/backgrounds/base_bg.webp?v=20260723c',
	},
	// Portrait-only scenes. The 16:9 art above is `cover`-cropped to ~26% of its width on a phone,
	// so portrait gets its own tall paintings of the same three scenes (base / Deal It / All In).
	// Sources were RGBA with a feathered transparent border — cropped to the opaque region before
	// conversion, or the see-through edge would have shown as a black rim on a full-bleed sprite.
	portraitBase: {
		type: 'sprite',
		src: './assets/components/backgrounds/bg_portrait_base.webp?v=20260727',
	},
	portraitDealIt: {
		type: 'sprite',
		src: './assets/components/backgrounds/bg_portrait_dealit.webp?v=20260727',
	},
	portraitAllIn: {
		type: 'sprite',
		src: './assets/components/backgrounds/bg_portrait_allin.webp?v=20260727',
	},
	// Figma top+bottom shadow (node 2792-4133) layered on top of the portrait bg ONLY —
	// rendered below the board/symbols/logo so it darkens the scene, never the UI.
	portraitShadow: {
		type: 'sprite',
		src: './assets/components/backgrounds/portrait_shadow.webp?v=20260722',
	},
	// New-design bonus backgrounds (static art replaced the looping videos in the redesign).
	bonusNormalBackground: {
		type: 'sprite',
		src: './assets/components/backgrounds/dealit_bg.webp?v=20260723c',
	},
	bonusSuperBackground: {
		type: 'sprite',
		src: './assets/components/backgrounds/allin_bg.webp?v=20260723c',
	},
	logoFrame: {
		type: 'sprite',
		src: './assets/components/frames/logo_frame.webp?v=20260722',
	},
	// New-design desktop board frame (rounded log frame + dark wood interior).
	boardFrameDesktop: {
		type: 'sprite',
		src: './assets/components/frames/board_frame_desktop.webp?v=20260723',
	},
	slotPadMobile: {
		type: 'sprite',
		src: './assets/components/frames/board_frame_mobile.webp?v=20260722',
	},
	badgeFrame: {
		type: 'sprite',
		src: './assets/components/frames/badge_frame.webp?v=20260722',
	},
	symbolPad: {
		type: 'sprite',
		src: './assets/components/frames/symbol_pad.webp?v=20260722',
	},
	counterFrame: {
		type: 'sprite',
		src: './assets/components/ui/confirm_frame.webp?v=20260722',
	},
	deerPresenter: {
		type: 'sprite',
		src: './assets/components/characters/deer_presenter.webp?v=20260722',
	},
	deerPresenterMobile: {
		type: 'sprite',
		src: './assets/components/characters/deer_presenter_mobile.webp?v=20260722',
	},
	// Bear paw holding the global-multiplier board (944×708; the board region is 592px wide,
	// centred at 368,324). DESKTOP ONLY — the paw needs the horizontal room of the right strip;
	// on portrait/landscape it crowded the stacked column, which is why every layout was switched
	// to the flat leaf-corner board. Desktop keeps the paw and its slide (see GlobalMultiplier).
	multiplierHand: {
		type: 'sprite',
		src: './assets/components/ui/multiplier_hand.webp?v=20260722',
	},
	multiplierXRed: {
		type: 'sprite',
		src: './assets/components/ui/multiplier_x_red.webp?v=20260722',
	},
	forestGangLogo: {
		type: 'sprite',
		src: './assets/components/ui/forest_gang_logo.webp?v=20260722',
	},
	earnedCoin: {
		type: 'sprite',
		src: './assets/components/ui/earned_coin.webp?v=20260722',
	},
	scatterPanelImage: {
		type: 'sprite',
		src: './assets/components/ui/scatter-panel-image.webp?v=20260722',
	},
	reelDivider: { type: 'sprite', src: './assets/components/frames/reel_divider.webp?v=20260722' },
	aTile: { type: 'sprite', src: './assets/components/symbols/card_a.webp?v=20260723' },
	kTile: { type: 'sprite', src: './assets/components/symbols/card_k.webp?v=20260723' },
	qTile: { type: 'sprite', src: './assets/components/symbols/card_q.webp?v=20260723' },
	jTile: { type: 'sprite', src: './assets/components/symbols/card_j.webp?v=20260723' },
	tTile: { type: 'sprite', src: './assets/components/symbols/card_t.webp?v=20260723' },
	wildTile: { type: 'sprite', src: './assets/components/symbols/wild_v2.webp?v=20260723' },
	wildWinTile: { type: 'sprite', src: './assets/components/symbols/wild_v2.webp?v=20260723' },
	scatterCustom: { type: 'sprite', src: './assets/components/symbols/scatter_v2.webp?v=20260723' },
	scatterWin: { type: 'sprite', src: './assets/components/symbols/scatter_v2.webp?v=20260723' },
	foxTile:      { type: 'sprite', src: './assets/components/symbols/fox.webp?v=20260722' },
	wolfTile:     { type: 'sprite', src: './assets/components/symbols/wolf.webp?v=20260722' },
	bearTile:     { type: 'sprite', src: './assets/components/symbols/bear.webp?v=20260722' },
	rabbitTile:   { type: 'sprite', src: './assets/components/symbols/rabbit.webp?v=20260722' },
	squirrelTile: { type: 'sprite', src: './assets/components/symbols/squirrel.webp?v=20260722' },
	// Vertically motion-blurred spin variants of the board tiles (R7), generated from the statics
	// above by tools/assets/sprites/generate_spin_blur.py. Drawn instead of the normal symbol art
	// while a reel moves faster than MOTION_BLUR_VELOCITY (see Board.svelte).
	aSpinTile:        { type: 'sprite', src: './assets/components/symbols/card_a_spin.webp' },
	kSpinTile:        { type: 'sprite', src: './assets/components/symbols/card_k_spin.webp' },
	qSpinTile:        { type: 'sprite', src: './assets/components/symbols/card_q_spin.webp' },
	jSpinTile:        { type: 'sprite', src: './assets/components/symbols/card_j_spin.webp' },
	tSpinTile:        { type: 'sprite', src: './assets/components/symbols/card_t_spin.webp' },
	foxSpinTile:      { type: 'sprite', src: './assets/components/symbols/fox_spin.webp' },
	wolfSpinTile:     { type: 'sprite', src: './assets/components/symbols/wolf_spin.webp' },
	bearSpinTile:     { type: 'sprite', src: './assets/components/symbols/bear_spin.webp' },
	rabbitSpinTile:   { type: 'sprite', src: './assets/components/symbols/rabbit_spin.webp' },
	squirrelSpinTile: { type: 'sprite', src: './assets/components/symbols/squirrel_spin.webp' },
	wildSpinTile:     { type: 'sprite', src: './assets/components/symbols/wild_v2_spin.webp' },
	scatterSpinTile:  { type: 'sprite', src: './assets/components/symbols/scatter_v2_spin.webp' },
	// Mobile-landscape spins blur the landscape tile set, not the desktop art.
	aSpinTileLs:        { type: 'sprite', src: './assets/components/symbols/landscape/card_a_spin.webp' },
	kSpinTileLs:        { type: 'sprite', src: './assets/components/symbols/landscape/card_k_spin.webp' },
	qSpinTileLs:        { type: 'sprite', src: './assets/components/symbols/landscape/card_q_spin.webp' },
	jSpinTileLs:        { type: 'sprite', src: './assets/components/symbols/landscape/card_j_spin.webp' },
	tSpinTileLs:        { type: 'sprite', src: './assets/components/symbols/landscape/card_t_spin.webp' },
	foxSpinTileLs:      { type: 'sprite', src: './assets/components/symbols/landscape/fox_spin.webp' },
	wolfSpinTileLs:     { type: 'sprite', src: './assets/components/symbols/landscape/wolf_spin.webp' },
	bearSpinTileLs:     { type: 'sprite', src: './assets/components/symbols/landscape/bear_spin.webp' },
	rabbitSpinTileLs:   { type: 'sprite', src: './assets/components/symbols/landscape/rabbit_spin.webp' },
	squirrelSpinTileLs: { type: 'sprite', src: './assets/components/symbols/landscape/squirrel_spin.webp' },
	wildSpinTileLs:     { type: 'sprite', src: './assets/components/symbols/landscape/wild_spin.webp' },
	scatterSpinTileLs:  { type: 'sprite', src: './assets/components/symbols/landscape/scatter_spin.webp' },
	// Win-state stills for the animals: the held final frame of each *WinNew clip, so a win whose
	// sheets have not loaded shows the celebration pose instead of the idle bust. Landscape has had
	// its own set all along (*WinTileLs below); these are the desktop/portrait counterparts.
	foxWinTile:      { type: 'sprite', src: './assets/components/symbols/fox_win.webp?v=20260728' },
	wolfWinTile:     { type: 'sprite', src: './assets/components/symbols/wolf_win.webp?v=20260728' },
	bearWinTile:     { type: 'sprite', src: './assets/components/symbols/bear_win.webp?v=20260728' },
	rabbitWinTile:   { type: 'sprite', src: './assets/components/symbols/rabbit_win.webp?v=20260728' },
	squirrelWinTile: { type: 'sprite', src: './assets/components/symbols/squirrel_win.webp?v=20260728' },
	aExpTile: { type: 'sprite', src: './assets/components/symbols/card_a.webp?v=20260723' },
	kExpTile: { type: 'sprite', src: './assets/components/symbols/card_k.webp?v=20260723' },
	qExpTile: { type: 'sprite', src: './assets/components/symbols/card_q.webp?v=20260723' },
	jExpTile: { type: 'sprite', src: './assets/components/symbols/card_j.webp?v=20260723' },
	tExpTile: { type: 'sprite', src: './assets/components/symbols/card_t.webp?v=20260723' },
	foxExpTile: { type: 'sprite', src: './assets/components/symbols/fox_expand.webp?v=20260722' },
	wolfExpTile: { type: 'sprite', src: './assets/components/symbols/wolf_expand.webp?v=20260722' },
	bearExpTile: { type: 'sprite', src: './assets/components/symbols/bear_expand.webp?v=20260722' },
	rabbitExpTile: { type: 'sprite', src: './assets/components/symbols/rabbit_expand.webp?v=20260722' },
	squirrelExpTile: { type: 'sprite', src: './assets/components/symbols/squirrel_expand.webp?v=20260722' },
	// --- Mobile-landscape symbol art (used only when layoutType() === 'landscape') ---
	aTileLs:  { type: 'sprite', src: './assets/components/symbols/landscape/card_a.webp?v=20260723' },
	kTileLs:  { type: 'sprite', src: './assets/components/symbols/landscape/card_k.webp?v=20260723' },
	qTileLs:  { type: 'sprite', src: './assets/components/symbols/landscape/card_q.webp?v=20260723' },
	jTileLs:  { type: 'sprite', src: './assets/components/symbols/landscape/card_j.webp?v=20260723' },
	tTileLs:  { type: 'sprite', src: './assets/components/symbols/landscape/card_t.webp?v=20260723' },
	foxTileLs:      { type: 'sprite', src: './assets/components/symbols/landscape/fox.webp?v=20260722' },
	wolfTileLs:     { type: 'sprite', src: './assets/components/symbols/landscape/wolf.webp?v=20260722' },
	bearTileLs:     { type: 'sprite', src: './assets/components/symbols/landscape/bear.webp?v=20260722' },
	rabbitTileLs:   { type: 'sprite', src: './assets/components/symbols/landscape/rabbit.webp?v=20260722' },
	squirrelTileLs: { type: 'sprite', src: './assets/components/symbols/landscape/squirrel.webp?v=20260722' },
	foxWinTileLs:      { type: 'sprite', src: './assets/components/symbols/landscape/fox_win.webp?v=20260722' },
	wolfWinTileLs:     { type: 'sprite', src: './assets/components/symbols/landscape/wolf_win.webp?v=20260722' },
	bearWinTileLs:     { type: 'sprite', src: './assets/components/symbols/landscape/bear_win.webp?v=20260722' },
	rabbitWinTileLs:   { type: 'sprite', src: './assets/components/symbols/landscape/rabbit_win.webp?v=20260722' },
	squirrelWinTileLs: { type: 'sprite', src: './assets/components/symbols/landscape/squirrel_win.webp?v=20260722' },
	wildTileLs:    { type: 'sprite', src: './assets/components/symbols/landscape/wild.webp?v=20260722' },
	scatterCustomLs: { type: 'sprite', src: './assets/components/symbols/landscape/scatter.webp?v=20260722' },
	cardPadLs:     { type: 'sprite', src: './assets/components/symbols/landscape/card_pad.webp?v=20260722' },
	stepperPadLs:  { type: 'sprite', src: './assets/components/symbols/landscape/stepper_pad.webp?v=20260722' },
	navBarLs:      { type: 'sprite', src: './assets/components/symbols/landscape/right_bar.webp?v=20260722' },
	buyBonusLs:    { type: 'sprite', src: './assets/components/symbols/landscape/buy_bonus.webp?v=20260722' },
	// Win boards — preloaded so board escalation during count-up doesn't stall
	sweetWinBoard:     { type: 'sprite', src: './assets/components/win_boards/sweet_win_fig.webp?v=20260724' },
	wildWinBoard:      { type: 'sprite', src: './assets/components/win_boards/big_win_fig.webp?v=20260724' },
	epicWinBoard:      { type: 'sprite', src: './assets/components/win_boards/epic_win_fig.webp?v=20260724' },
	mythicWinBoard:    { type: 'sprite', src: './assets/components/win_boards/mega_win_fig.webp?v=20260724' },
	legendaryWinBoard: { type: 'sprite', src: './assets/components/win_boards/max_win_fig.webp?v=20260724' },
	maxWinScreen:      { type: 'sprite', src: './assets/components/win_boards/max_win_screen.webp?v=20260722' },
	// Golden P mark pulsing on the win boards' gem medallion (Figma 3205-2090).
	winEmblemP:        { type: 'sprite', src: './assets/components/win_boards/win_emblem_p.webp?v=20260722' },
	goldFont: {
		type: 'font',
		src: './assets/fonts/goldFont/mm_gold.xml?v=20260722',
	},
	silverFont: {
		type: 'font',
		src: './assets/fonts/silverFont/mm_silver.xml?v=20260722',
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
		src: './assets/components/frames/bonus_buy_button_frame.webp?v=20260722',
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
		src: './assets/sprites/fsMedallion/medallion_anim_v2.json',
	},
	// Opaque black silhouette of the medallion, drawn BEHIND fsMedallionAnim.
	//
	// That sheet is luma-keyed: its alpha channel is a greyscale copy of the artwork, so the
	// emblem's dark interior is not dark paint, it is LOW ALPHA. Over black it composites into
	// exactly the intended design; over the popup's brown wood the grain reads straight through it
	// and the emblem looks washed out. This silhouette restores the black it was authored against.
	//
	// Generated FROM medallion_anim_v2 itself (per-pixel median alpha over the 40 frames,
	// thresholded, holes filled, eroded 1px so it can never poke past the art, 0.8px soft edge) —
	// so it tracks that sheet's shape exactly and shares no lineage with the older static
	// fsMedallion.webp. Regenerate it if the animation is ever re-exported.
	fsMedallionShadow: {
		type: 'sprite',
		src: './assets/sprites/fsMedallion/medallion_shadow.webp',
	},
	// Animated deer presenter (background-removed video frames; 41-frame loop) — replaces the
	// static desktop deer on the expanded-symbol reveal.
	deerPresenterAnim: {
		type: 'spriteSheet',
		src: './assets/sprites/deerPresenterAnim/deer_anim_v2.json',
	},
	// ── Board-symbol sheets ship at SOURCE resolution. Do NOT rescale them by a flat factor. ──
	// The twelve reel sheets (wildAnim, scatterAnim, the 5 *IdleAnim and the 5 *WinAnim below) are
	// sized from the device pixels each sprite is actually drawn at — 1920×1080 at DPR 2, the
	// largest layout we support well — not from a fraction of whatever the source happened to be.
	// A uniform ×0.5 was applied to every sheet once before and left board symbols drawn 2.3–3.4×
	// magnified; that is what this sizing replaced.
	// Every one of those targets is LARGER than the best art that exists (the generators consume
	// source videos that aren't in the repo — see generate_emblem_anim.py's usage line), so each
	// sheet is capped at source and a 1.03–1.72× shortfall remains. Upsampling past source would
	// spend bytes for no detail. `static/assets/sprites/check_sheet_sizes.py` re-derives the whole
	// chain, prints the per-sheet ratios and asserts every atlas stays ≤ 4096 — run it after any
	// change to the sheets or to the Board/stateGame sizing constants it mirrors.
	// NB: bump ?v= whenever a sheet is regenerated. pixi copies the JSON's search params onto
	// meta.image (spritesheetAsset.js), so the .json's ?v= is what busts the .webp as well; without
	// it a client pairs a cached old atlas with new frame rects and draws garbage.
	// Animated WILD symbol (black-background video, luma-keyed + un-premultiplied; 40-frame
	// clip, ping-ponged at runtime — generate_emblem_anim.py) — plays on the reels.
	wildAnim: {
		type: 'spriteSheet',
		src: './assets/sprites/wildAnim/wild_anim_v3.json?v=20260726',
	},
	// Animated SCATTER emblem (same pipeline as the WILD; 40-frame clip, ping-ponged). The
	// free-spin popups keep their own fsMedallionAnim loop — this sheet is only for the reels.
	scatterAnim: {
		type: 'spriteSheet',
		src: './assets/sprites/scatterAnim/scatter_anim.json?v=20260726',
	},
	// Shared wooden frame w/ forest scene, drawn behind every animal symbol (fox/wolf/bear/rabbit/squirrel).
	animalBorder: {
		type: 'sprite',
		src: './assets/components/symbols/animal_border.webp?v=20260723',
	},
	// Golden light column glow (2 KB) for the reel anticipation — smooth vertical plateau, feathered
	// ends, thin god-ray streaks. Rendered additive. Small enough to keep in the main load tier.
	anticipationGlow: {
		type: 'sprite',
		src: './assets/components/frames/anticipation_glow.webp?v=20260722',
	},
	// Bamboo/vine column frame (Figma 2145-328) drawn around the expanded symbol reel.
	expandedFrame: {
		type: 'sprite',
		src: './assets/components/frames/expanded_frame.webp?v=20260722',
	},
	// Animated base-state (idle blink) animals — background-removed video frames, loop on the reels.
	wolfIdleAnim: {
		type: 'spriteSheet',
		src: './assets/sprites/wolfIdleAnim/wolf_idle.json?v=20260726',
	},
	foxIdleAnim: {
		type: 'spriteSheet',
		src: './assets/sprites/foxIdleAnim/fox_idle.json?v=20260726',
	},
	squirrelIdleAnim: {
		type: 'spriteSheet',
		src: './assets/sprites/squirrelIdleAnim/squirrel_idle.json?v=20260726',
	},
	bearIdleAnim: {
		type: 'spriteSheet',
		src: './assets/sprites/bearIdleAnim/bear_idle.json?v=20260726',
	},
	rabbitIdleAnim: {
		type: 'spriteSheet',
		src: './assets/sprites/rabbitIdleAnim/rabbit_idle.json?v=20260726',
	},
	// Animated loading bar (49-frame 0→100% fill, white bar/text on transparency). This is the ONLY
	// preloaded asset: it must be ready before the loading screen paints so the bar can show first
	// while every other asset (splash art, symbols, backgrounds, videos, spines) streams in during
	// the tracked post-load phase and drives the bar's fill via stateApp.loadingProgress.
	loadingBarAnim: {
		type: 'spriteSheet',
		src: './assets/sprites/loadingBarAnim/loading_bar.json?v=20260722',
		preload: true,
	},
	// Studio "Press Play" branding shown ON the loading screen — preloaded alongside the bar so it
	// paints immediately, before the rest of the assets stream in (a non-preload logo would be blank
	// during loading). White mark on transparency; native 548×228.
	pressPlayLogo: {
		type: 'sprite',
		src: './assets/components/ui/press_play_logo.webp?v=20260722',
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
		src: './assets/sprites/rabbitMoney/rabbit_money.json?v=20260722',
	},
	bearMoney: {
		type: 'spriteSheet',
		src: './assets/sprites/bearMoney/bear_money.json',
	},
	foxMoney: {
		type: 'spriteSheet',
		src: './assets/sprites/foxMoney/fox_money.json?v=20260722',
	},
	wolfMoney: {
		type: 'spriteSheet',
		src: './assets/sprites/wolfMoney/wolf_money.json?v=20260722',
	},
	squirrelMoney: {
		type: 'spriteSheet',
		src: './assets/sprites/squirrelMoney/squirrel_money.json?v=20260722',
	},
	// Board win-state card animations (upper-body window of the same videos, card border baked).
	rabbitWinAnim:   { type: 'spriteSheet', src: './assets/sprites/rabbitWinNew/rabbit_win_v2.json?v=20260726' },
	bearWinAnim:     { type: 'spriteSheet', src: './assets/sprites/bearWinNew/bear_win_v2.json?v=20260726' },
	foxWinAnim:      { type: 'spriteSheet', src: './assets/sprites/foxWinNew/fox_win_v2.json?v=20260726' },
	wolfWinAnim:     { type: 'spriteSheet', src: './assets/sprites/wolfWinNew/wolf_win_v2.json?v=20260726' },
	squirrelWinAnim: { type: 'spriteSheet', src: './assets/sprites/squirrelWinNew/squirrel_win_v2.json?v=20260726' },
	// NOTE: there are deliberately no letter (T/A/J/K/Q) win-animation sheets. A winning letter
	// renders its CLEAN base tile with a continuous ±10% pulse (Board.svelte) — the sheets existed,
	// were loaded, trimmed and ping-ponged, and were drawn by nothing. Don't re-add them.
	// Must stay preloaded: EnableSound reads loadedAssets['sound'] in onMount (as soon as the tree
	// mounts) and crashes if it isn't ready yet, which would hang the whole loading screen.
	sound: {
		type: 'audio',
		src: './assets/audio/sounds.json?v=20260722',
		preload: true,
	},
} as const;

// Everything the base game can DRAW now loads up front, on the loading screen (no deferred
// stream): deferred streaming caused visible pop-in (static tiles until the anim sheets arrived,
// win boards appearing late) and a stalled deferred pass took the art hostage for the whole
// session. The loading bar is the honest place to pay for it. Only the deferDemand bonus set
// below stays out of the gating pass: it is invisible until a bonus triggers, and that trigger
// awaits (and retries) its load.

// Bonus-only art: withheld from the background stream entirely and loaded on demand, because a
// session that never triggers a bonus never draws any of it — a sizeable share of the art pool
// that used to be paid by every player (run scripts/check-residency.py for the current figure).
// game/utils.ts requests it from the book (see BONUS_ART_EVENTS there), which covers all four
// entry paths: natural scatter, bought BONUS/SUPER, a one-spin FEATURE book, and a resumed round
// replayed through createBonusSnapshot.
const DEMAND_BONUS_ART: readonly string[] = [
	'transition',
	'bonusNormalBackground', 'bonusSuperBackground',
	'deerPresenter', 'deerPresenterMobile', 'deerPresenterAnim',
	'rabbitMoney', 'bearMoney', 'foxMoney', 'wolfMoney', 'squirrelMoney',
];
for (const key of DEMAND_BONUS_ART) {
	const entry = (assets as Record<string, { deferDemand?: boolean } | undefined>)[key];
	if (entry) entry.deferDemand = true;
}

// Layout-specific art: only the set matching the INITIAL viewport blocks playability; the other
// layout's set is demoted to the deferred (background) pass, so rotating/resizing later still works —
// worst case the alternate art streams in a moment after the rotate. Mirrors layoutType() in
// utils-layout/createLayout.svelte.ts (portrait = ratio ≤ 0.8; landscape = short side ≤ 480).
const MOBILE_ONLY_KEYS: readonly string[] = [
	// Portrait art
	'portraitBase', 'portraitDealIt', 'portraitAllIn',
	'portraitShadow', 'slotPadMobile',
	// Mobile-landscape art
	'aTileLs', 'kTileLs', 'qTileLs', 'jTileLs', 'tTileLs',
	'foxTileLs', 'wolfTileLs', 'bearTileLs', 'rabbitTileLs', 'squirrelTileLs',
	'foxWinTileLs', 'wolfWinTileLs', 'bearWinTileLs', 'rabbitWinTileLs', 'squirrelWinTileLs',
	'wildTileLs', 'scatterCustomLs', 'cardPadLs', 'stepperPadLs', 'navBarLs',
	'buyBonusLs',
];
// Empty since the layouts were unified on one base background: `baseBackground` used to live here,
// but it is now the base art on phones too, so deferring it would ship them a bare stage until the
// background pass finished. NOTE: boardFrameDesktop was never here either — since the redesign
// BoardFrame draws it in every layout, so deferring it on mobile shipped a frameless board when the
// deferred stream stalled.
const DESKTOP_ONLY_KEYS: readonly string[] = [];
if (typeof window !== 'undefined') {
	const w = window.innerWidth;
	const h = window.innerHeight;
	const ratio = w / (h || 1);
	const shortSide = Math.min(w, h);
	const isMobileLayout = ratio <= 0.8 || shortSide <= 480;
	for (const key of isMobileLayout ? DESKTOP_ONLY_KEYS : MOBILE_ONLY_KEYS) {
		const entry = (assets as Record<string, { defer?: boolean } | undefined>)[key];
		if (entry) entry.defer = true;
	}
}

export default assets;
