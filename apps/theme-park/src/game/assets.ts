import type { Assets } from 'pixi-svelte';

// Theme Park runtime asset manifest.

const assets: Assets = {
	// === BACKGROUND ===
	// Depth-of-field plaza art: the same scene as the old background.webp, blurred so the reels read
	// against it. It replaces both that still and the animations/background/base.mp4 loop, which was
	// the sharp cut and would have painted straight over this one once its deferred load landed.
	background: { type: 'sprite', src: './assets/theme-park/v2/background-blur.webp' },
	// Drifting sky, drawn by <Clouds>. A random subset renders per page load, so all five have to be
	// loaded — they total ~23 kB, less than a single symbol.
	cloud1: { type: 'sprite', src: './assets/theme-park/v2/clouds/cloud1.webp' },
	cloud2: { type: 'sprite', src: './assets/theme-park/v2/clouds/cloud2.webp' },
	cloud3: { type: 'sprite', src: './assets/theme-park/v2/clouds/cloud3.webp' },
	cloud4: { type: 'sprite', src: './assets/theme-park/v2/clouds/cloud4.webp' },
	cloud5: { type: 'sprite', src: './assets/theme-park/v2/clouds/cloud5.webp' },
	// The pad carries its own 5x5 grid lines, so <Board> no longer strokes them. New filename rather
	// than a ?v= on the old one, so a cached board.png cannot survive the swap.
	themeBoard: { type: 'sprite', src: './assets/theme-park/v2/board-lines.webp' },
	// Borderless runtime board. Grid and opaque board background stay; all light rails are removed.
	themeBoardBorderless: {
		type: 'sprite',
		src: './assets/theme-park/v2/board-lines-borderless.webp',
	},
	themeBoardGrid: {
		type: 'sprite',
		src: './assets/theme-park/v2/board-grid-backboard.webp',
	},
	// Opaque purple rail/shadow stays below reel content. The matching expanded asset is lights-only
	// and stays above it, so neither layer changes or visually trims the equal-cell gameplay rect.
	themeBoardBorderBackdrop: {
		type: 'sprite',
		src: './assets/theme-park/v2/board-border-backdrop.png',
	},
	themeBoardBorderExpanded: {
		type: 'sprite',
		src: './assets/theme-park/v2/board-border-expanded.png',
	},
	// The autoplay pad: same rect and same grid lines, but a clean neon outline in place of the
	// bulbs, so the lights running round that outline are the only thing moving on the border.
	themeBoardAuto: { type: 'sprite', src: './assets/theme-park/v2/board-auto.webp' },
	themeBoardAutoBorderless: {
		type: 'sprite',
		src: './assets/theme-park/v2/board-auto-borderless.webp',
	},
	// One white radial glow, tinted per light. Drawing the lights as sprites rather than as a
	// Graphics rebuilt every frame is what keeps autoplay at 60fps — the geometry rebuild cost 7ms a
	// frame, moving sprites costs nothing.
	spark: { type: 'sprite', src: './assets/theme-park/v2/spark.webp' },

	// === FINAL HIGH SYMBOL ART ===
	tpH1: { type: 'sprite', src: './assets/theme-park/v2/symbols/h1-coaster.png' },
	tpH1Win: {
		type: 'sprite',
		src: './assets/theme-park/v2/symbols/h1-coaster-win.png',
	},
	tpH2: { type: 'sprite', src: './assets/theme-park/v2/symbols/h2-duck.png' },
	tpH2Win: {
		type: 'sprite',
		src: './assets/theme-park/v2/symbols/h2-duck-win.png',
	},
	tpH3: { type: 'sprite', src: './assets/theme-park/v2/symbols/h3-balloons.png' },
	tpH3Win: {
		type: 'sprite',
		src: './assets/theme-park/v2/symbols/h3-balloons-win.png',
	},
	tpH4: { type: 'sprite', src: './assets/theme-park/v2/symbols/h4-popcorn.png' },
	tpH4Win: {
		type: 'sprite',
		src: './assets/theme-park/v2/symbols/h4-popcorn-win.png',
	},
	tpH5: { type: 'sprite', src: './assets/theme-park/v2/symbols/h5-ferris.png' },
	tpH5Win: {
		type: 'sprite',
		src: './assets/theme-park/v2/symbols/h5-ferris-win.png',
	},
	tpL1: { type: 'sprite', src: './assets/theme-park/v2/symbols/l1-a.png' },
	tpL1Win: {
		type: 'sprite',
		src: './assets/theme-park/v2/symbols/l1-a-win.png',
	},
	tpL2: { type: 'sprite', src: './assets/theme-park/v2/symbols/l2-k.png' },
	tpL2Win: {
		type: 'sprite',
		src: './assets/theme-park/v2/symbols/l2-k-win.png',
	},
	tpL3: { type: 'sprite', src: './assets/theme-park/v2/symbols/l3-q.png' },
	tpL3Win: {
		type: 'sprite',
		src: './assets/theme-park/v2/symbols/l3-q-win.png',
	},
	tpL4: { type: 'sprite', src: './assets/theme-park/v2/symbols/l4-j.png' },
	tpL4Win: {
		type: 'sprite',
		src: './assets/theme-park/v2/symbols/l4-j-win.png',
	},
	tpL5: { type: 'sprite', src: './assets/theme-park/v2/symbols/l5-10.png' },
	tpL5Win: {
		type: 'sprite',
		src: './assets/theme-park/v2/symbols/l5-10-win.png',
	},
	tpH1WinAnim: {
		type: 'sprite',
		src: './assets/theme-park/v2/animations/symbols/h1-coaster-win.webm',
		defer: true,
	},
	tpH2WinAnim: {
		type: 'sprite',
		src: './assets/theme-park/v2/animations/symbols/h2-duck-win.webm',
		defer: true,
	},
	tpH3WinAnim: {
		type: 'sprite',
		src: './assets/theme-park/v2/animations/symbols/h3-balloons-win.webm',
		defer: true,
	},
	tpH4WinAnim: {
		type: 'sprite',
		src: './assets/theme-park/v2/animations/symbols/h4-popcorn-win.webm',
		defer: true,
	},
	tpH5WinAnim: {
		type: 'sprite',
		src: './assets/theme-park/v2/animations/symbols/h5-ferris-win.webm',
		defer: true,
	},
	tpL1WinAnim: {
		type: 'sprite',
		src: './assets/theme-park/v2/animations/symbols/l1-a-win.webm',
		defer: true,
	},
	tpL2WinAnim: {
		type: 'sprite',
		src: './assets/theme-park/v2/animations/symbols/l2-k-win.webm',
		defer: true,
	},
	tpL3WinAnim: {
		type: 'sprite',
		src: './assets/theme-park/v2/animations/symbols/l3-q-win.webm',
		defer: true,
	},
	tpL4WinAnim: {
		type: 'sprite',
		src: './assets/theme-park/v2/animations/symbols/l4-j-win.webm',
		defer: true,
	},
	tpL5WinAnim: {
		type: 'sprite',
		src: './assets/theme-park/v2/animations/symbols/l5-10-win.webm',
		defer: true,
	},
	tpWildDesktop: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/wild-desktop.png',
	},
	tpWildMobile: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/wild-mobile.png',
	},
	tpWildLandscape: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/wild-mobile-landscape.png',
	},
	tpMegaWildDesktop: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/mega-wild-desktop.png',
	},
	tpMegaWildMobile: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/mega-wild-mobile.png',
	},
	tpMegaWildLandscape: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/mega-wild-mobile-landscape.png',
	},
	tpWildAnim: {
		type: 'sprite',
		src: './assets/theme-park/v2/animations/symbols/wild.webm',
		defer: true,
	},
	tpCoasterWild: {
		type: 'sprite',
		src: './assets/theme-park/v2/symbols/wild-slime.png',
	},

	// === FEATURE PRESENTERS ===
	// Full-scene backdrop for the whole Mega Coaster bonus: the blurred night-time coaster POV
	// (Figma 6824:5157, built by scripts/coaster-bg/build_coaster_bg.py). Drawn by <Background> over
	// the plaza art for as long as the bonus runs, the same way the pond swaps in its booth.
	coasterBackground: {
		type: 'sprite',
		src: './assets/theme-park/v2/features/coaster-bg.webp',
		defer: true,
	},
	coasterTrack: {
		type: 'sprite',
		src: './assets/theme-park/v2/features/coaster-track.png',
	},
	coasterRigHappy: {
		type: 'sprite',
		src: './assets/theme-park/v2/features/coaster-rig-happy.png',
	},
	coasterRigVomit: {
		type: 'sprite',
		src: './assets/theme-park/v2/features/coaster-rig-vomit.png',
	},
	// Startup-gated: one layered rig owns the immutable cart and looping duck motion.
	coasterVomitSpine: {
		type: 'spine',
		src: {
			atlas: './assets/spines/coasterVomit/coaster_vomit.atlas',
			skeleton: './assets/spines/coasterVomit/coaster_vomit.json',
			scale: 1,
		},
	},
	megaWildFullReelFallback: {
		type: 'sprite',
		src: './assets/spines/megaWildFullReel/mega_wild_full_reel_fallback.png',
	},
	// Combined Mega Wild: empty rails, then one duck/cart/plaque slide and multiplier roll.
	megaWildFullReelSpine: {
		type: 'spine',
		src: {
			atlas: './assets/spines/megaWildFullReel/mega_wild_full_reel.atlas',
			skeleton: './assets/spines/megaWildFullReel/mega_wild_full_reel.json',
			scale: 1,
		},
	},
	coasterCarSickAnim: {
		type: 'sprite',
		src: './assets/theme-park/v2/animations/features/coaster-car-sick.webm',
		defer: true,
	},
	coasterCarVomitAnim: {
		type: 'sprite',
		src: './assets/theme-park/v2/animations/features/coaster-car-vomit.webm',
		defer: true,
	},
	tpDuckScatterDesktop: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/duck-your-luck-desktop.png',
	},
	tpDuckScatterMobile: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/duck-your-luck-mobile.png',
	},
	tpDuckScatterLandscape: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/duck-your-luck-mobile-landscape.png',
	},
	tpRollerScatterDesktop: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/roller-wilds-desktop.png',
	},
	tpRollerScatterMobile: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/roller-wilds-mobile.png',
	},
	tpRollerScatterLandscape: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/roller-wilds-mobile-landscape.png',
	},
	tpCoasterScatterDesktop: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/mega-coaster-desktop.png',
	},
	tpCoasterScatterMobile: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/mega-coaster-mobile.png',
	},
	tpCoasterScatterLandscape: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/mega-coaster-mobile-landscape.png',
	},
	tpRollerScatterAnim: {
		type: 'sprite',
		src: './assets/theme-park/v2/animations/symbols/roller-wilds.webm',
		defer: true,
	},
	tpRollerScatterWinAnim: {
		type: 'sprite',
		src: './assets/theme-park/v2/animations/symbols/roller-wilds-win.webm',
		defer: true,
	},
	tpCoasterScatterAnim: {
		type: 'sprite',
		src: './assets/theme-park/v2/animations/symbols/mega-coaster.webm',
		defer: true,
	},
	tpCoasterScatterWinAnim: {
		type: 'sprite',
		src: './assets/theme-park/v2/animations/symbols/mega-coaster-win.webm',
		defer: true,
	},

	// === WIN BOARDS ===
	// The congratulations screens' panel (Figma 6909:9366), in the separate pieces <CongratsPanel>
	// animates apart: the marquee frame with its amount well built in, the medallion ring, and the
	// gold P that punches in inside it. Deferred, because these only show once a bonus has run;
	// until they land the flat `bonusPanel` below holds the place.
	congratsPanel: {
		type: 'sprite',
		src: './assets/theme-park/v2/popup/congrats/panel.webp',
		defer: true,
	},
	congratsRing: {
		type: 'sprite',
		src: './assets/theme-park/v2/popup/congrats/ring.webp',
		defer: true,
	},
	congratsP: { type: 'sprite', src: './assets/theme-park/v2/popup/congrats/p.webp', defer: true },
	// Bonus-complete screen (Figma 6094:4022): the square neon panel, still drawn by the duck pond's
	// PICK / TOTAL WIN plates and used as the congratulations panel's fallback.
	bonusPanel: { type: 'sprite', src: './assets/theme-park/v2/popup/square_panel_neon.webp' },
	// Figma 6682:5285 — the gift, popcorn and coin pile, without the coaster car the first pass used.
	bonusPrize: { type: 'sprite', src: './assets/theme-park/v2/wins/bonus-prize-gift.webp' },
	winSweet: { type: 'sprite', src: './assets/theme-park/v2/wins/sweet.webp' },
	winWild: { type: 'sprite', src: './assets/theme-park/v2/wins/wild.webp' },
	winEpic: { type: 'sprite', src: './assets/theme-park/v2/wins/epic.webp' },
	winLegendary: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/legendary.webp',
	},
	winMythic: { type: 'sprite', src: './assets/theme-park/v2/wins/mythic.webp' },
	winMax: { type: 'sprite', src: './assets/theme-park/v2/wins/max.webp' },
	// The win cards' separate parts (Figma 6089:434 and the four tier frames beside it), which
	// <ThemeWinBoard> assembles and animates apart — the wordmark drops in, the coins fly in
	// spinning, the badge punches in, the bulbs light. This replaced five 36-frame sprite sheets
	// that carried the same motion pre-baked: 3.9 MB of parts against 16 MB of sheets, and the
	// choreography is now editable.
	//
	// Deferred, with the flat one-piece `winSweet`/`winMythic`/... cards above as the immediate
	// fallback: same art, so a card that lands before the parts do just shows without choreography.
	// Placement and bulb positions live in game/winCardParts.ts.
	winCardCoin: { type: 'sprite', src: './assets/theme-park/v2/wins/parts/coin.webp', defer: true },
	// The falling coin for <WinCoinRain> — the P coin, Figma 6449:8830. Deliberately NOT the card's
	// `winCardCoin`: that one is the balloon medallion symbol, and raining the symbol instead of
	// money read as wrong. It has to be the FACE-ON art too, because the rain tumbles it by
	// squashing its width; an already-tilted coin squashed further just looks permanently skewed.
	winRainCoin: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/parts/rain_coin.webp',
		defer: true,
	},
	// The same coin's FAR face — its silhouette filled with a plain metal gradient, no P and no
	// bevel. Drawn behind the near face and offset, it is what gives the tumbling coin its
	// thickness; see <WinCoinRain> for why the edge cannot be drawn beside the face instead.
	winRainCoinRim: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/parts/rain_coin_rim.webp',
		defer: true,
	},
	winCardSweetPanel: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/parts/sweet/panel.webp',
		defer: true,
	},
	winCardSweetText: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/parts/sweet/text.webp',
		defer: true,
	},
	winCardSweetRing: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/parts/sweet/ring.webp',
		defer: true,
	},
	winCardSweetBadge: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/parts/sweet/badge.webp',
		defer: true,
	},
	winCardWildPanel: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/parts/wild/panel.webp',
		defer: true,
	},
	winCardWildText: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/parts/wild/text.webp',
		defer: true,
	},
	winCardWildRing: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/parts/wild/ring.webp',
		defer: true,
	},
	winCardWildBadge: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/parts/wild/badge.webp',
		defer: true,
	},
	winCardEpicPanel: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/parts/epic/panel.webp',
		defer: true,
	},
	winCardEpicText: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/parts/epic/text.webp',
		defer: true,
	},
	winCardEpicRing: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/parts/epic/ring.webp',
		defer: true,
	},
	winCardEpicBadge: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/parts/epic/badge.webp',
		defer: true,
	},
	winCardMythicPanel: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/parts/mythic/panel.webp',
		defer: true,
	},
	winCardMythicText: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/parts/mythic/text.webp',
		defer: true,
	},
	winCardMythicRing: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/parts/mythic/ring.webp',
		defer: true,
	},
	winCardMythicBadge: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/parts/mythic/badge.webp',
		defer: true,
	},
	winCardLegendaryPanel: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/parts/legendary/panel.webp',
		defer: true,
	},
	winCardLegendaryText: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/parts/legendary/text.webp',
		defer: true,
	},
	winCardLegendaryRing: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/parts/legendary/ring.webp',
		defer: true,
	},
	winCardLegendaryBadge: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/parts/legendary/badge.webp',
		defer: true,
	},

	// === FRAMES / UI ===
	symbolPad: { type: 'sprite', src: './assets/components/frames/symbol_pad.png' },
	// Backs the in-board bonus banners. The HUD's own navigation bar art: plain neon tube, uniform
	// along its length, which is what lets <NeonPlaque> 3-slice it to any width. It replaces a 1.73MB
	// lossless carve-wood sign left over from Forest Gang — wrong game, wrong theme, and 150x the
	// bytes for something drawn 500x96.
	bonusBannerPlate: {
		type: 'sprite',
		src: './assets/theme-park/v2/hud/bar_plate.webp',
	},
	// Temporary production placeholders copied from Magnetic. Replace with final
	// Theme Park lock art without changing the component contract.
	lockedCell: {
		type: 'sprite',
		src: './assets/components/frames/magnetic/cell_box.png',
	},
	lockedCellWin: {
		type: 'sprite',
		src: './assets/components/frames/magnetic/cell_box_win.png',
	},
	// === DUCK YOUR LUCK POND (Figma 6471:6288 desktop / 6692:4403 portrait / 6449:3212 landscape) ===
	// The pick screen dresses the reel area as a pool: water fills the grid, the 25 picks are rubber
	// ducks on swim rings (8 art variants, randomised per pond), and the chrome around the board is
	// the logo, the pick counter strip and the PICK/TOTAL WIN neon panels. All processed from the
	// Figma raws into trimmed webps (scratchpad duckpond/process.py).
	// The pool water is the Figma node EXPORT (6471:6310), not the raw source image — the raw is a
	// far more saturated blue than the design actually shows. Rounded corners are baked in.
	duckPondWater: {
		type: 'sprite',
		src: './assets/theme-park/v2/duckpond/pond_water.webp',
		defer: true,
	},
	// Full-scene backdrop while the pond is up: the blurred duck-fishing booth (supplied art).
	// Drawn by <Background> in place of the plaza art for the duration of the bonus.
	duckPondBackground: {
		type: 'sprite',
		src: './assets/theme-park/v2/duckpond/duck_booth.webp',
		defer: true,
	},
	// Splash pool disc drawn under every pond duck (the mock's per-cell tile).
	duckPondSplash: {
		type: 'sprite',
		src: './assets/theme-park/v2/duckpond/splash.webp',
		defer: true,
	},
	// Shared Duck Your Luck rig for pond picks, FSPIN1 Duck Collect cells and trigger symbols.
	// Eight front/rear variants swap at the turn silhouette; the prize slot tracks the rump.
	// Startup-gated: Duck Collect can land on the first base spin, so its turn must never race defer.
	duckPondTurn: {
		type: 'spine',
		src: {
			atlas: './assets/spines/duckTurn/duck_turn.atlas',
			skeleton: './assets/spines/duckTurn/duck_turn.json',
		},
	},
	duckPondLogo: { type: 'sprite', src: './assets/theme-park/v2/duckpond/logo.webp', defer: true },
	duckPondMiniYellow: {
		type: 'sprite',
		src: './assets/theme-park/v2/duckpond/duck_mini_yellow.webp',
		defer: true,
	},
	duckPondMiniGray: {
		type: 'sprite',
		src: './assets/theme-park/v2/duckpond/duck_mini_gray.webp',
		defer: true,
	},
	// The PICK / TOTAL WIN plates draw the shared `bonusPanel` art with <PanelBorderLights> instead
	// of the mock's static panel exports, so the pond chrome animates like the confirm dialogs.
	duckPondDuck1: {
		type: 'sprite',
		src: './assets/theme-park/v2/duckpond/duck_1.webp',
	},
	duckPondDuck2: {
		type: 'sprite',
		src: './assets/theme-park/v2/duckpond/duck_2.webp',
	},
	duckPondDuck3: {
		type: 'sprite',
		src: './assets/theme-park/v2/duckpond/duck_3.webp',
	},
	duckPondDuck4: {
		type: 'sprite',
		src: './assets/theme-park/v2/duckpond/duck_4.webp',
	},
	duckPondDuck5: {
		type: 'sprite',
		src: './assets/theme-park/v2/duckpond/duck_5.webp',
	},
	duckPondDuck6: {
		type: 'sprite',
		src: './assets/theme-park/v2/duckpond/duck_6.webp',
	},
	duckPondDuck7: {
		type: 'sprite',
		src: './assets/theme-park/v2/duckpond/duck_7.webp',
	},
	duckPondDuck8: {
		type: 'sprite',
		src: './assets/theme-park/v2/duckpond/duck_8.webp',
	},
	// Full-reel Theme Park marquee. The clear centre leaves live symbols visible while its separate
	// Pixi light chase/glow layers animate the generated frame around all four sides.
	anticipationFrame: {
		type: 'sprite',
		src: './assets/theme-park/v2/features/anticipation-frame-v2.webp',
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
	},

	// === FONTS ===
	goldFont: { type: 'font', src: './assets/fonts/goldFont/mm_gold.xml' },
	silverFont: { type: 'font', src: './assets/fonts/silverFont/mm_silver.xml' },

	// === LOADING SCREEN ===
	// The only two entries in the `preload` tier. Animated loading bar (49-frame 0→100% fill, white
	// bar/text on transparency) plus the studio mark above it. Stepped by real download progress
	// rather than autoplayed — the shared pixi ticker isn't running while the loader is up, so an
	// AnimatedSprite would never advance. See LoadingScreen.svelte.
	loadingBarAnim: {
		type: 'spriteSheet',
		src: './assets/sprites/loadingBarAnim/loading_bar.json?v=20260731',
		preload: true,
	},
	pressPlayLogo: {
		type: 'sprite',
		src: './assets/components/ui/press_play_logo.webp',
		preload: true,
	},
};

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Load tiers. Everything above except the two LOADING SCREEN entries is UNFLAGGED, which puts it
// in the gating pass: it downloads while the loading screen is up and the progress bar counts it.
// That default is the point — every entry used to carry `preload: true`, which is a different tier
// entirely (it blocks before the game tree mounts AND before the progress counter starts), so the
// bar sat frozen at 0% through the whole download and only moved over the last few files.
//
//   preload      – needed to DRAW the loading screen itself. Keep this list tiny.
//   (unflagged)  – base-game art. Gates `loaded`; the bar reflects it honestly.
//   defer        – streams in the background after `loaded`; already used for the video/webm art.
// ─────────────────────────────────────────────────────────────────────────────────────────────

export default assets;
