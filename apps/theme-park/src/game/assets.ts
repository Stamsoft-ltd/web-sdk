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
	// One of these drifts up through the sky between spins — see <EscapedBalloon>. Only ever one is
	// on screen, but the colour is re-rolled per flight, so all five have to be here; they total
	// ~12 kB. Cut from the h3 symbol by scripts/build-escaped-balloon.py.
	balloonPink: { type: 'sprite', src: './assets/theme-park/v2/balloon/pink.webp' },
	balloonOrange: { type: 'sprite', src: './assets/theme-park/v2/balloon/orange.webp' },
	balloonYellow: { type: 'sprite', src: './assets/theme-park/v2/balloon/yellow.webp' },
	balloonGreen: { type: 'sprite', src: './assets/theme-park/v2/balloon/green.webp' },
	balloonBlue: { type: 'sprite', src: './assets/theme-park/v2/balloon/blue.webp' },
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
	// Every high symbol has ONE state. These are the flat cartoon redraws, and there is no lit second
	// still authored for them — the wheel and the royals win by <SymbolBulbs> lighting the bulbs drawn
	// into the art, the duck/balloons/popcorn by the board's own win pulse. `-marquee` rather than
	// `-win`: the filename is the cache key on Stake's CDN, and these replaced art that shipped under
	// the old names.
	tpH1: { type: 'sprite', src: './assets/theme-park/v2/symbols/h1-coaster-marquee.png' },
	tpH2: { type: 'sprite', src: './assets/theme-park/v2/symbols/h2-duck-marquee.png' },
	tpH3: { type: 'sprite', src: './assets/theme-park/v2/symbols/h3-balloons-marquee.png' },
	tpH4: { type: 'sprite', src: './assets/theme-park/v2/symbols/h4-popcorn-marquee.png' },
	tpH5: { type: 'sprite', src: './assets/theme-park/v2/symbols/h5-ferris-marquee.png' },
	// The gold marquee frame a small win's amount is drawn inside — see <Win>. Same plaque art the
	// Mega Wild reel carries, so the two read as the same furniture rather than two gold frames.
	tpSmallWinPlaque: { type: 'sprite', src: './assets/theme-park/v2/wins/small-win-plaque.png' },
	tpL1: { type: 'sprite', src: './assets/theme-park/v2/symbols/l1-a-marquee.png' },
	tpL2: { type: 'sprite', src: './assets/theme-park/v2/symbols/l2-k-marquee.png' },
	tpL3: { type: 'sprite', src: './assets/theme-park/v2/symbols/l3-q-marquee.png' },
	tpL4: { type: 'sprite', src: './assets/theme-park/v2/symbols/l4-j-marquee.png' },
	tpL5: { type: 'sprite', src: './assets/theme-park/v2/symbols/l5-10-marquee.png' },
	tpWildDesktop: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/wild-desktop-marquee.png',
	},
	tpWildMobile: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/wild-mobile-marquee.png',
	},
	tpWildLandscape: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/wild-mobile-landscape-marquee.png',
	},
	tpMegaWildDesktop: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/mega-wild-desktop-marquee.png',
	},
	tpMegaWildMobile: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/mega-wild-mobile-marquee.png',
	},
	tpMegaWildLandscape: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/mega-wild-mobile-landscape-marquee.png',
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
		src: './assets/theme-park/v2/modes/duck-your-luck-desktop-marquee.png',
	},
	tpDuckScatterMobile: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/duck-your-luck-mobile-marquee.png',
	},
	tpDuckScatterLandscape: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/duck-your-luck-mobile-landscape-marquee.png',
	},
	tpRollerScatterDesktop: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/roller-wilds-desktop-marquee.png',
	},
	tpRollerScatterMobile: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/roller-wilds-mobile-marquee.png',
	},
	tpRollerScatterLandscape: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/roller-wilds-mobile-landscape-marquee.png',
	},
	tpCoasterScatterDesktop: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/mega-coaster-desktop-marquee.png',
	},
	tpCoasterScatterMobile: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/mega-coaster-mobile-marquee.png',
	},
	tpCoasterScatterLandscape: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/mega-coaster-mobile-landscape-marquee.png',
	},

	// === WIN BOARDS ===
	// The congratulations screens' marquees: the TALL one for bonus won (Figma 7033:24761) and the
	// WIDE cloud for bonus complete (7032:19821). Just the frames — the amount well, the medallion
	// and the gold P that used to be built into this art are gone; <CongratsPanel> draws the well and
	// puts the bonus's own scatter symbol where the medallion was. Deferred, because these only show
	// once a bonus has run; until they land the flat `bonusPanel` below holds the place.
	congratsMarqueeTall: {
		type: 'sprite',
		src: './assets/theme-park/v2/popup/congrats/marquee-tall.webp',
		defer: true,
	},
	congratsMarqueeWide: {
		type: 'sprite',
		src: './assets/theme-park/v2/popup/congrats/marquee-wide.webp',
		defer: true,
	},
	// Bonus-complete screen (Figma 6094:4022): the square neon panel, still drawn by the duck pond's
	// PICK / TOTAL WIN plates and used as the congratulations panel's fallback.
	bonusPanel: { type: 'sprite', src: './assets/theme-park/v2/popup/square_panel_neon.webp' },
	// Figma 6682:5285 — the gift, popcorn and coin pile, without the coaster car the first pass used.
	bonusPrize: { type: 'sprite', src: './assets/theme-park/v2/wins/bonus-prize-gift.webp' },
	// The marquee win card (Figma 7013:9117), shipped as the loose pieces <WinCard> animates apart:
	// the bulb-lit tent plate, one wordmark per tier, the gold star that flies onto each shoulder, and
	// the confetti fan cut into its fifteen scraps. The scraps are the card's burst AND the falling
	// rain behind it (<WinConfettiRain>), so the screen has one vocabulary of paper.
	//
	// This replaced the previous card entirely — five flat 1 MB tier cards plus panel/ring/badge/coin
	// parts for each, 9.5 MB in all, against 1.0 MB here.
	//
	// Deferred at priority 0, so they are the first thing to stream in once the game is interactive:
	// there is no flat fallback card any more, and a big win can land within a couple of spins. The
	// amount plate is drawn rather than loaded, so even a card whose art has not arrived still shows
	// the number. Placement lives in game/winCardMarquee.ts.
	winMarqueePlate: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/marquee/plate.webp',
		defer: true,
		deferPriority: 0,
	},
	winMarqueeStar: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/marquee/star.webp',
		defer: true,
		deferPriority: 0,
	},
	winMarqueeTextSweet: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/marquee/text-sweet.webp',
		defer: true,
		deferPriority: 0,
	},
	winMarqueeTextWild: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/marquee/text-wild.webp',
		defer: true,
		deferPriority: 0,
	},
	winMarqueeTextEpic: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/marquee/text-epic.webp',
		defer: true,
		deferPriority: 0,
	},
	winMarqueeTextMythic: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/marquee/text-mythic.webp',
		defer: true,
		deferPriority: 0,
	},
	winMarqueeTextLegendary: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/marquee/text-legendary.webp',
		defer: true,
		deferPriority: 0,
	},
	winMarqueeConfetti0: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/marquee/confetti/p00.webp',
		defer: true,
		deferPriority: 0,
	},
	winMarqueeConfetti1: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/marquee/confetti/p01.webp',
		defer: true,
		deferPriority: 0,
	},
	winMarqueeConfetti2: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/marquee/confetti/p02.webp',
		defer: true,
		deferPriority: 0,
	},
	winMarqueeConfetti3: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/marquee/confetti/p03.webp',
		defer: true,
		deferPriority: 0,
	},
	winMarqueeConfetti4: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/marquee/confetti/p04.webp',
		defer: true,
		deferPriority: 0,
	},
	winMarqueeConfetti5: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/marquee/confetti/p05.webp',
		defer: true,
		deferPriority: 0,
	},
	winMarqueeConfetti6: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/marquee/confetti/p06.webp',
		defer: true,
		deferPriority: 0,
	},
	winMarqueeConfetti7: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/marquee/confetti/p07.webp',
		defer: true,
		deferPriority: 0,
	},
	winMarqueeConfetti8: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/marquee/confetti/p08.webp',
		defer: true,
		deferPriority: 0,
	},
	winMarqueeConfetti9: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/marquee/confetti/p09.webp',
		defer: true,
		deferPriority: 0,
	},
	winMarqueeConfetti10: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/marquee/confetti/p10.webp',
		defer: true,
		deferPriority: 0,
	},
	winMarqueeConfetti11: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/marquee/confetti/p11.webp',
		defer: true,
		deferPriority: 0,
	},
	winMarqueeConfetti12: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/marquee/confetti/p12.webp',
		defer: true,
		deferPriority: 0,
	},
	winMarqueeConfetti13: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/marquee/confetti/p13.webp',
		defer: true,
		deferPriority: 0,
	},
	winMarqueeConfetti14: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/marquee/confetti/p14.webp',
		defer: true,
		deferPriority: 0,
	},

	// The MAX WIN card (Figma 6090:4147) — its own lockup rather than a sixth tier of the marquee,
	// because the design glues a duck, a coaster loop, a ferris wheel, balloons, tents, stars and the
	// game's logo onto one bulb-framed plate. Shipped as the eleven loose pieces <MaxWinCard> flies in
	// from off screen; placement lives in game/maxWinCard.ts.
	//
	// Deferred at priority 1 — BEHIND the marquee's parts. Every big win shows the marquee; a max win
	// is 25,000x, so its 1.3MB has no business competing with art the next spin might need. The card
	// checks its own plate before it draws anything.
	maxWinPlate: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/maxwin/plate.webp',
		defer: true,
		deferPriority: 1,
	},
	maxWinWord: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/maxwin/word.webp',
		defer: true,
		deferPriority: 1,
	},
	maxWinDuck: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/maxwin/duck.webp',
		defer: true,
		deferPriority: 1,
	},
	maxWinCoaster: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/maxwin/coaster.webp',
		defer: true,
		deferPriority: 1,
	},
	maxWinWheel: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/maxwin/wheel.webp',
		defer: true,
		deferPriority: 1,
	},
	maxWinBalloonL: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/maxwin/balloonL.webp',
		defer: true,
		deferPriority: 1,
	},
	maxWinBalloonR: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/maxwin/balloonR.webp',
		defer: true,
		deferPriority: 1,
	},
	maxWinTentL: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/maxwin/tentL.webp',
		defer: true,
		deferPriority: 1,
	},
	maxWinTentR: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/maxwin/tentR.webp',
		defer: true,
		deferPriority: 1,
	},
	maxWinStarL: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/maxwin/starL.webp',
		defer: true,
		deferPriority: 1,
	},
	maxWinStarR: {
		type: 'sprite',
		src: './assets/theme-park/v2/wins/maxwin/starR.webp',
		defer: true,
		deferPriority: 1,
	},
	// The SAME file the splash overlay loads in CSS — the design's THEME PARK lockup is this logo, so
	// re-cutting it from the max-win frame would ship a second copy of it for no visible difference.
	maxWinLogo: {
		type: 'sprite',
		src: './assets/theme-park/v2/splash/logo.webp',
		defer: true,
		deferPriority: 1,
	},

	// === FRAMES / UI ===
	symbolPad: { type: 'sprite', src: './assets/components/frames/symbol_pad.png' },
	// Backs the in-board bonus banners. The HUD's own navigation bar art, sparkle-free: a plain neon
	// tube, uniform along its length, which is what lets <NeonPlaque> 3-slice it to any width — the
	// painted sparkles it used to carry stretched with the slice. It replaces a 1.73MB
	// lossless carve-wood sign left over from Forest Gang — wrong game, wrong theme, and 150x the
	// bytes for something drawn 500x96.
	bonusBannerPlate: {
		type: 'sprite',
		src: './assets/theme-park/v2/hud/bar_plate-clean.webp',
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
	// The only entries in the `preload` tier, so they are on screen before the counted download this
	// screen is measuring even starts. Figma 7003:4499 — the studio mark fills red as loading runs and
	// the wordmark joins it at 100%; see LoadingScreen.svelte and scripts/loading/build_press_play.py.
	//
	// The fill is a horizontal wipe between the two marks rather than the design's twelve baked
	// states: 4 kB for a continuous fill instead of 12 files for a stepped one.
	loadingMarkEmpty: {
		type: 'sprite',
		src: './assets/theme-park/v2/loading/mark-empty.webp',
		preload: true,
	},
	loadingMarkFull: {
		type: 'sprite',
		src: './assets/theme-park/v2/loading/mark-full.webp',
		preload: true,
	},
	loadingWordmark: {
		type: 'sprite',
		src: './assets/theme-park/v2/loading/wordmark.webp',
		preload: true,
	},
	// The splash art, so the loader can sit on the darkened park the splash is about to reveal and
	// the two can cross-fade. It is the SAME file the splash overlay uses in CSS, so the second
	// request comes out of the browser cache — this costs one download, not two.
	loadingBackdrop: {
		type: 'sprite',
		src: './assets/theme-park/v2/splash/background.webp',
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
