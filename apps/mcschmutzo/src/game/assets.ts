export default {
	loader: {
		type: 'spine',
		src: {
			atlas: new URL('../../assets/spines/loader/loader.atlas', import.meta.url).href,
			skeleton: new URL('../../assets/spines/loader/loader.json', import.meta.url).href,
			scale: 2,
		},
		preload: true,
	},
	pressToContinueText: {
		type: 'sprites',
		src: new URL('../../assets/sprites/pressToContinueText/MM_pressanywhere.json', import.meta.url)
			.href,
		preload: true,
	},
	H1: {
		type: 'spine',
		src: {
			atlas: new URL('../../assets/spines/symbols/symbols.atlas', import.meta.url).href,
			skeleton: new URL('../../assets/spines/symbols/h1.json', import.meta.url).href,
			scale: 2,
		},
	},
	H2: {
		type: 'spine',
		src: {
			atlas: new URL('../../assets/spines/symbols/symbols.atlas', import.meta.url).href,
			skeleton: new URL('../../assets/spines/symbols/h2.json', import.meta.url).href,
			scale: 2,
		},
	},
	H3: {
		type: 'spine',
		src: {
			atlas: new URL('../../assets/spines/symbols/symbols.atlas', import.meta.url).href,
			skeleton: new URL('../../assets/spines/symbols/h3.json', import.meta.url).href,
			scale: 2,
		},
	},
	H4: {
		type: 'spine',
		src: {
			atlas: new URL('../../assets/spines/symbols/symbols.atlas', import.meta.url).href,
			skeleton: new URL('../../assets/spines/symbols/h4.json', import.meta.url).href,
			scale: 2,
		},
	},
	H5: {
		type: 'spine',
		src: {
			atlas: new URL('../../assets/spines/symbols/symbols.atlas', import.meta.url).href,
			skeleton: new URL('../../assets/spines/symbols/h5.json', import.meta.url).href,
			scale: 2,
		},
	},
	L1: {
		type: 'spine',
		src: {
			atlas: new URL('../../assets/spines/symbols/symbols.atlas', import.meta.url).href,
			skeleton: new URL('../../assets/spines/symbols/l1.json', import.meta.url).href,
			scale: 2,
		},
	},
	L2: {
		type: 'spine',
		src: {
			atlas: new URL('../../assets/spines/symbols/symbols.atlas', import.meta.url).href,
			skeleton: new URL('../../assets/spines/symbols/l2.json', import.meta.url).href,
			scale: 2,
		},
	},
	L3: {
		type: 'spine',
		src: {
			atlas: new URL('../../assets/spines/symbols/symbols.atlas', import.meta.url).href,
			skeleton: new URL('../../assets/spines/symbols/l3.json', import.meta.url).href,
			scale: 2,
		},
	},
	L4: {
		type: 'spine',
		src: {
			atlas: new URL('../../assets/spines/symbols/symbols.atlas', import.meta.url).href,
			skeleton: new URL('../../assets/spines/symbols/l4.json', import.meta.url).href,
			scale: 2,
		},
	},
	M: {
		type: 'spine',
		src: {
			atlas: new URL('../../assets/spines/symbols2/symbols2.atlas', import.meta.url).href,
			skeleton: new URL('../../assets/spines/symbols2/M.json', import.meta.url).href,
			scale: 2,
		},
	},
	S: {
		type: 'spine',
		src: {
			atlas: new URL('../../assets/spines/symbols2/symbols2.atlas', import.meta.url).href,
			skeleton: new URL('../../assets/spines/symbols2/S.json', import.meta.url).href,
			scale: 2,
		},
	},
	explosion: {
		type: 'spine',
		src: {
			atlas: new URL('../../assets/spines/symbols3/symbols3.atlas', import.meta.url).href,
			skeleton: new URL('../../assets/spines/symbols3/explosion.json', import.meta.url).href,
			scale: 2,
		},
	},
	W: {
		type: 'spine',
		src: {
			atlas: new URL('../../assets/spines/symbols3/symbols3.atlas', import.meta.url).href,
			skeleton: new URL('../../assets/spines/symbols3/W.json', import.meta.url).href,
			scale: 2,
		},
	},
	reelsFrame: {
		type: 'sprites',
		src: new URL('../../assets/sprites/reelsFrame/reels_frame.json', import.meta.url).href,
	},
	payFrame: {
		type: 'sprite',
		src: new URL('../../assets/sprites/payFrame/payFrame.png', import.meta.url).href,
	},
	anticipation: {
		type: 'spine',
		src: {
			atlas: new URL('../../assets/spines/anticipation/anticipation.atlas', import.meta.url).href,
			skeleton: new URL('../../assets/spines/anticipation/anticipation.json', import.meta.url).href,
			scale: 2,
		},
	},
	goldFont: {
		type: 'font',
		src: new URL('../../assets/fonts/goldFont/mm_gold.xml', import.meta.url).href,
	},
	goldBlur: {
		type: 'font',
		src: new URL('../../assets/fonts/goldBlur/miningfont_gold_blur.xml', import.meta.url).href,
	},
	silverFont: {
		type: 'font',
		src: new URL('../../assets/fonts/silverFont/mm_silver.xml', import.meta.url).href,
	},
	purpleFont: {
		type: 'font',
		src: new URL('../../assets/fonts/purpleFont/mm_purple.xml', import.meta.url).href,
	},
	bigwin: {
		type: 'spine',
		src: {
			atlas: new URL('../../assets/spines/bigwin/big_wins.atlas', import.meta.url).href,
			skeleton: new URL('../../assets/spines/bigwin/mm_bigwin.json', import.meta.url).href,
			scale: 2,
		},
	},
	winPadSweet: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/win/pad-sweet.webp', import.meta.url).href,
	},
	winPadLegendary: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/win/pad-legendary.webp', import.meta.url).href,
	},
	winPadEpic: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/win/pad-epic.webp', import.meta.url).href,
	},
	winPadWild: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/win/pad-wild.webp', import.meta.url).href,
	},
	winPadMythic: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/win/pad-mythic.webp', import.meta.url).href,
	},
	// Separated win-pad layers (banner / title / splashes / star / burger) so the pad can be
	// re-assembled and animated: banner + title pop in first, then the sauce splashes swoosh in
	// behind, the stars twinkle and the burger wiggles.
	winBannerSweet: { type: 'sprite', src: new URL('../../assets/mcschmutzo/win/parts/banner-sweet.webp', import.meta.url).href },
	winBannerLegendary: { type: 'sprite', src: new URL('../../assets/mcschmutzo/win/parts/banner-legendary.webp', import.meta.url).href },
	winBannerEpic: { type: 'sprite', src: new URL('../../assets/mcschmutzo/win/parts/banner-epic.webp', import.meta.url).href },
	winBannerWild: { type: 'sprite', src: new URL('../../assets/mcschmutzo/win/parts/banner-wild.webp', import.meta.url).href },
	winBannerMythic: { type: 'sprite', src: new URL('../../assets/mcschmutzo/win/parts/banner-mythic.webp', import.meta.url).href },
	winTitleSweet: { type: 'sprite', src: new URL('../../assets/mcschmutzo/win/parts/title-sweet.webp', import.meta.url).href },
	winTitleLegendary: { type: 'sprite', src: new URL('../../assets/mcschmutzo/win/parts/title-legendary.webp', import.meta.url).href },
	winTitleEpic: { type: 'sprite', src: new URL('../../assets/mcschmutzo/win/parts/title-epic.webp', import.meta.url).href },
	winTitleWild: { type: 'sprite', src: new URL('../../assets/mcschmutzo/win/parts/title-wild.webp', import.meta.url).href },
	winTitleMythic: { type: 'sprite', src: new URL('../../assets/mcschmutzo/win/parts/title-mythic.webp', import.meta.url).href },
	// Split title words (tier word on top + the shared WIN below) so each can fly in from its own edge.
	winWordSweet: { type: 'sprite', src: new URL('../../assets/mcschmutzo/win/parts/word-sweet.webp', import.meta.url).href },
	winWordLegendary: { type: 'sprite', src: new URL('../../assets/mcschmutzo/win/parts/word-legendary.webp', import.meta.url).href },
	winWordEpic: { type: 'sprite', src: new URL('../../assets/mcschmutzo/win/parts/word-epic.webp', import.meta.url).href },
	winWordWild: { type: 'sprite', src: new URL('../../assets/mcschmutzo/win/parts/word-wild.webp', import.meta.url).href },
	winWordMythic: { type: 'sprite', src: new URL('../../assets/mcschmutzo/win/parts/word-mythic.webp', import.meta.url).href },
	winWordWin: { type: 'sprite', src: new URL('../../assets/mcschmutzo/win/parts/word-win.webp', import.meta.url).href },
	winSplashYellow: { type: 'sprite', src: new URL('../../assets/mcschmutzo/win/parts/splash-yellow.webp', import.meta.url).href },
	winSplashRed: { type: 'sprite', src: new URL('../../assets/mcschmutzo/win/parts/splash-red.webp', import.meta.url).href },
	winStar: { type: 'sprite', src: new URL('../../assets/mcschmutzo/win/parts/win-star.webp', import.meta.url).href },
	winBox: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/win/wooden-board.webp', import.meta.url).href,
	},
	// Dedicated small-win value plaque (red panel + cream ornate frame + rivets, no splashes).
	winBoxSmall: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/win/small-win-box.webp', import.meta.url).href,
	},
	// Red plaque frame (shared with the congrats popups) used for the win amount box.
	winBoxRed: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/congrats-cover-sm.webp', import.meta.url).href,
	},
	// The dedicated win-amount plaque (red panel + gold frame + ketchup/mustard splashes).
	winBoxAmount: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/win/win-box-amount.png', import.meta.url).href,
	},
	boardBg: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/board.webp', import.meta.url).href,
	},
	closeButton: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/win/x-button.webp', import.meta.url).href,
	},
	globalMultiplier: {
		type: 'spine',
		src: {
			atlas: new URL('../../assets/spines/globalMultiplier/multiframe.atlas', import.meta.url).href,
			skeleton: new URL('../../assets/spines/globalMultiplier/multiframe.json', import.meta.url)
				.href,
			scale: 2,
		},
	},
	fsIntro: {
		type: 'spine',
		src: {
			atlas: new URL('../../assets/spines/fsIntro/fs_screen.atlas', import.meta.url).href,
			skeleton: new URL('../../assets/spines/fsIntro/fs_screen.json', import.meta.url).href,
			scale: 2,
		},
	},
	fsIntroNumber: {
		type: 'spine',
		src: {
			atlas: new URL('../../assets/spines/fsIntro/fs_screen.atlas', import.meta.url).href,
			skeleton: new URL('../../assets/spines/fsIntro/fs_screen_number.json', import.meta.url).href,
			scale: 2,
		},
	},
	fsOutroNumber: {
		type: 'spine',
		src: {
			atlas: new URL('../../assets/spines/fsIntro/fs_screen.atlas', import.meta.url).href,
			skeleton: new URL('../../assets/spines/fsIntro/fs_total_number.json', import.meta.url).href,
			scale: 2,
		},
	},
	foregroundAnimation: {
		type: 'spine',
		src: {
			atlas: new URL('../../assets/spines/foregroundAnimation/mm_bg.atlas', import.meta.url).href,
			skeleton: new URL('../../assets/spines/foregroundAnimation/mm_bg.json', import.meta.url).href,
			scale: 2,
		},
		preload: true,
	},
	foregroundFeatureAnimation: {
		type: 'spine',
		src: {
			atlas: new URL(
				'../../assets/spines/foregroundFeatureAnimation/mm_bg_feature.atlas',
				import.meta.url,
			).href,
			skeleton: new URL(
				'../../assets/spines/foregroundFeatureAnimation/mm_bg_feature.json',
				import.meta.url,
			).href,
			scale: 2,
		},
		preload: true,
	},
	tumble_multiplier: {
		type: 'spine',
		src: {
			atlas: new URL('../../assets/spines/tumbleWin/tumble_win.atlas', import.meta.url).href,
			skeleton: new URL('../../assets/spines/tumbleWin/tumble_multiplier.json', import.meta.url)
				.href,
			scale: 2,
		},
	},
	tumble_win: {
		type: 'spine',
		src: {
			atlas: new URL('../../assets/spines/tumbleWin/tumble_win.atlas', import.meta.url).href,
			skeleton: new URL('../../assets/spines/tumbleWin/tumble_win.json', import.meta.url).href,
			scale: 2,
		},
	},
	reelhouse: {
		type: 'spine',
		src: {
			atlas: new URL('../../assets/spines/reelhouse/reelhouse_glow.atlas', import.meta.url).href,
			skeleton: new URL('../../assets/spines/reelhouse/reelhouse_glow.json', import.meta.url).href,
			scale: 2,
		},
	},
	// Loader mark: the Press Play "P" (white on transparent) — tinted grey for the empty shell and
	// red for the fill that rises bottom-to-top with the load progress. Replaces the old purple
	// progress bar (mining-template leftover). Preloaded so it's ready first.
	loaderP: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/loader-p.webp', import.meta.url).href,
		preload: true,
	},
	// Press Play "P" loader — 10 discrete fill states (red sweeps left→right across the P inside its
	// rounded tile) selected by load progress. Tiny (~1.4KB each) and preloaded so they're ready first.
	loaderP0: { type: 'sprite', src: new URL('../../assets/mcschmutzo/loader/p00.webp', import.meta.url).href, preload: true },
	loaderP1: { type: 'sprite', src: new URL('../../assets/mcschmutzo/loader/p01.webp', import.meta.url).href, preload: true },
	loaderP2: { type: 'sprite', src: new URL('../../assets/mcschmutzo/loader/p02.webp', import.meta.url).href, preload: true },
	loaderP3: { type: 'sprite', src: new URL('../../assets/mcschmutzo/loader/p03.webp', import.meta.url).href, preload: true },
	loaderP4: { type: 'sprite', src: new URL('../../assets/mcschmutzo/loader/p04.webp', import.meta.url).href, preload: true },
	loaderP5: { type: 'sprite', src: new URL('../../assets/mcschmutzo/loader/p05.webp', import.meta.url).href, preload: true },
	loaderP6: { type: 'sprite', src: new URL('../../assets/mcschmutzo/loader/p06.webp', import.meta.url).href, preload: true },
	loaderP7: { type: 'sprite', src: new URL('../../assets/mcschmutzo/loader/p07.webp', import.meta.url).href, preload: true },
	loaderP8: { type: 'sprite', src: new URL('../../assets/mcschmutzo/loader/p08.webp', import.meta.url).href, preload: true },
	loaderP9: { type: 'sprite', src: new URL('../../assets/mcschmutzo/loader/p09.webp', import.meta.url).href, preload: true },
	freeSpins: {
		type: 'sprites',
		src: new URL('../../assets/sprites/freeSpins/freeSpins.json', import.meta.url).href,
	},
	winSmall: {
		type: 'sprites',
		src: new URL('../../assets/sprites/winSmall/MM_Localisation_winsmall.json', import.meta.url)
			.href,
	},
	clusterWin: {
		type: 'spine',
		src: {
			atlas: new URL('../../assets/spines/clusterWin/clusterpay.atlas', import.meta.url).href,
			skeleton: new URL('../../assets/spines/clusterWin/clusterpay.json', import.meta.url).href,
			scale: 2,
		},
	},
	transition: {
		type: 'spine',
		src: {
			atlas: new URL('../../assets/spines/transition/transition.atlas', import.meta.url).href,
			skeleton: new URL('../../assets/spines/transition/transition.json', import.meta.url).href,
			scale: 2,
		},
	},
	symbolsStatic: {
		type: 'sprites',
		src: new URL('../../assets/sprites/symbolsStatic/symbolsStatic.json', import.meta.url).href,
	},
	coins: {
		type: 'spriteSheet',
		src: new URL('../../assets/sprites/coin/SD2_Coin.json', import.meta.url).href,
	},
	backgroundBase: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/background-base.png', import.meta.url).href,
		preload: true,
	},
	// Desktop-only base diner (new art). Mobile-landscape still uses backgroundBase until the mobile
	// backgrounds are supplied.
	backgroundDesktop: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/background-desktop.webp', import.meta.url).href,
		preload: true,
	},
	// Mobile-landscape diner (a wide crop of the base diner — lamp + shelf, no floor, no chef).
	backgroundLandscape: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/background-landscape.webp', import.meta.url).href,
		preload: true,
	},
	// Mobile-landscape SPECIAL (free-games) grey kitchen — wide crop matching the base landscape bg.
	backgroundLandscapeBonus: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/special-bg-landscape.webp', import.meta.url).href,
		preload: true,
	},
	backgroundBonus: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/background-bonus.png', import.meta.url).href,
		preload: true,
	},
	backgroundPortrait: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/background-portrait.webp', import.meta.url).href,
		preload: true,
	},
	// Special bonus-game (free games) backgrounds — the cool grey kitchen.
	backgroundPortraitBonus: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/special-bg-mobile.webp', import.meta.url).href,
		preload: true,
	},
	backgroundWideBonus: {
		// New special (free-games) kitchen bg — lamps are overlaid + animated separately.
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/special-bg-wide.webp', import.meta.url).href,
		preload: true,
	},
	specialLamp: {
		// Hanging pendant lamp for the special bg (two overlaid top-left, blinking).
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/special-lamp.webp', import.meta.url).href,
		preload: true,
	},
	lampGlow: {
		// Soft radial glow (baked warm gradient, transparent edge) for the pendant bulbs — a smooth
		// falloff with no hard circle edge, blended additively behind the shade.
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/lamp-glow.webp', import.meta.url).href,
		preload: true,
	},
	bonusWheel: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/bonus-wheel.png', import.meta.url).href,
	},
	bonusWheelDisc: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/bonus-wheel-disc.png', import.meta.url).href,
	},
	bonusWheelPointer: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/bonus-wheel-pointer.png', import.meta.url).href,
	},
	mascot: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/mascot.png', import.meta.url).href,
		preload: true,
	},
	specialPot: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/special-pot.webp', import.meta.url).href,
		preload: true,
	},
	// Layered chefs (base with the pupils cut out + the pupils as their own sprites) so the eyes can
	// glance + blink while the figure stands. See AnimatedGuy.svelte.
	mascotBase: {
		// The base with the eyes AND the held ketchup bottle+hand cut out — the bottle is overlaid
		// separately (mascotBottle) so it can shake like the splash chef's.
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/guys/mascot_base_v3.webp', import.meta.url).href,
		preload: true,
	},
	mascotBottle: {
		// The extracted ketchup bottle + gripping hand (full-frame canvas), overlaid on mascotBase and
		// shaken about the wrist.
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/guys/mascot_bottle_v3.webp', import.meta.url).href,
		preload: true,
	},
	mascotLabel: {
		// The "McSchmutzo" nametag, cut out of the base (patched behind) so it can jiggle on its pin.
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/guys/mascot_label_v3.webp', import.meta.url).href,
		preload: true,
	},
	mascotPupilL: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/guys/mascot_pupilL.webp', import.meta.url).href,
		preload: true,
	},
	mascotPupilR: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/guys/mascot_pupilR.webp', import.meta.url).href,
		preload: true,
	},
	specialBase: {
		// Real designer chef WITHOUT the salting arm (body fully drawn underneath) on the shared
		// 358x425 frame — the arm overlays and flicks with nothing duplicated behind it, and the
		// eyes are the intact art (animated pupils overlay the baked ones slightly larger).
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/guys/special_base_v9.webp', import.meta.url).href,
		preload: true,
	},
	specialArm: {
		// The salt-shaker forearm on the same frame, overlaid + flicked about the shoulder.
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/guys/special_arm_v3.webp', import.meta.url).href,
		preload: true,
	},
	specialLabel: {
		// The "McSchmutzo" nametag (extracted), overlaid a touch larger over the baked one so it can
		// jiggle on its pin without exposing the one underneath.
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/guys/special_label_v2.webp', import.meta.url).href,
		preload: true,
	},
	mcschmutzoLogo: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/logo.png', import.meta.url).href,
		preload: true,
	},
	mcH1: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/H1.png', import.meta.url).href,
	},
	mcH2: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/H2.png', import.meta.url).href,
	},
	mcH3: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/H3.png', import.meta.url).href,
	},
	mcH4: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/H4.png', import.meta.url).href,
	},
	mcH5: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/H5.png', import.meta.url).href,
	},
	mcL1: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/L1.png', import.meta.url).href,
	},
	mcL2: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/L2.png', import.meta.url).href,
	},
	mcL3: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/L3.png', import.meta.url).href,
	},
	mcL4: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/L4.png', import.meta.url).href,
	},
	mcL5: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/L5.png', import.meta.url).href,
	},
	mcW: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/W.png', import.meta.url).href,
	},
	mcS: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/S.png', import.meta.url).href,
	},
	mcM: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/M.png', import.meta.url).href,
	},
	// Burger (H1) split into layers so it can be reassembled and animated part-by-part.
	burgerBunBottom: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/burger/bun_bottom.webp', import.meta.url)
			.href,
	},
	burgerPatty: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/burger/patty.webp', import.meta.url).href,
	},
	burgerCheese: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/burger/cheese.webp', import.meta.url).href,
	},
	burgerOnion: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/burger/onion.webp', import.meta.url).href,
	},
	burgerTomato: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/burger/tomato.webp', import.meta.url).href,
	},
	burgerLettuce: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/burger/lettuce.webp', import.meta.url).href,
	},
	burgerBunTop: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/burger/bun_top.webp', import.meta.url).href,
	},
	// Soup pot (H2) split into layers (pot + soup / blobs / steam / drips / spoon / label).
	soupPot: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/soup/pot.webp', import.meta.url).href,
	},
	// The green liquid surface, extracted from pot.webp so it can be drawn OVER the spoon — the spoon
	// then stirs submerged (bowl under the liquid, only the handle poking out).
	soupLiquid: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/soup/liquid.webp', import.meta.url).href,
	},
	soupBlobs: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/soup/blobs.webp', import.meta.url).href,
	},
	soupSteam: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/soup/steam.webp', import.meta.url).href,
	},
	soupDrips: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/soup/drips.webp', import.meta.url).href,
	},
	soupSpoon: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/soup/spoon.webp', import.meta.url).href,
	},
	soupLabel: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/soup/label.webp', import.meta.url).href,
	},
	// Wild (W) = red splat + WILD text.
	wildSplat: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/wild/splat.webp', import.meta.url).href,
	},
	wildText: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/wild/text.webp', import.meta.url).href,
	},
	// Scatter (S) = stand + SCATTER banner.
	scatterStand: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/scatter/stand.webp', import.meta.url).href,
	},
	scatterBanner: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/scatter/banner.webp', import.meta.url).href,
	},
	// Smutz cup (M) = cup + straw.
	cupBody: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/cup/body.webp', import.meta.url).href,
	},
	cupStraw: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/cup/straw.webp', import.meta.url).href,
	},
	// Sausage (H3) = banger + rising smoke.
	sausageBody: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/sausage/body.webp', import.meta.url).href,
	},
	sausageSmoke: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/sausage/smoke.webp', import.meta.url).href,
	},
	// Onion rings (H5) = three leaning rings (ring3 is ring1 mirrored, for the third ring in the pile).
	onionRing1: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/onion/ring1.webp', import.meta.url).href,
	},
	onionRing2: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/onion/ring2.webp', import.meta.url).href,
	},
	onionRing3: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/onion/ring3.webp', import.meta.url).href,
	},
	// Cheese (H4) = slab + melty drips.
	cheeseSlice: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/cheese/slice.webp', import.meta.url).href,
	},
	cheeseDrips: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/cheese/drips.webp', import.meta.url).href,
	},
	// Sauce bottles (L1-L5) = body (+ splat + label) with the cap split off so it can rotate.
	bottleL1Body: { type: 'sprite', src: new URL('../../assets/mcschmutzo/symbols/parts/bottle/L1_body.webp', import.meta.url).href },
	bottleL1Cap: { type: 'sprite', src: new URL('../../assets/mcschmutzo/symbols/parts/bottle/L1_cap.webp', import.meta.url).href },
	bottleL2Body: { type: 'sprite', src: new URL('../../assets/mcschmutzo/symbols/parts/bottle/L2_body.webp', import.meta.url).href },
	bottleL2Cap: { type: 'sprite', src: new URL('../../assets/mcschmutzo/symbols/parts/bottle/L2_cap.webp', import.meta.url).href },
	bottleL3Body: { type: 'sprite', src: new URL('../../assets/mcschmutzo/symbols/parts/bottle/L3_body.webp', import.meta.url).href },
	bottleL3Cap: { type: 'sprite', src: new URL('../../assets/mcschmutzo/symbols/parts/bottle/L3_cap.webp', import.meta.url).href },
	bottleL4Body: { type: 'sprite', src: new URL('../../assets/mcschmutzo/symbols/parts/bottle/L4_body.webp', import.meta.url).href },
	bottleL4Cap: { type: 'sprite', src: new URL('../../assets/mcschmutzo/symbols/parts/bottle/L4_cap.webp', import.meta.url).href },
	bottleL5Body: { type: 'sprite', src: new URL('../../assets/mcschmutzo/symbols/parts/bottle/L5_body.webp', import.meta.url).href },
	bottleL5Cap: { type: 'sprite', src: new URL('../../assets/mcschmutzo/symbols/parts/bottle/L5_cap.webp', import.meta.url).href },
	// Lock badge shown over active/locked symbols during free games.
	lockBadge: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/lock.webp', import.meta.url).href,
	},
	sound: {
		type: 'audio',
		src: new URL('../../assets/audio/sounds.json', import.meta.url).href,
		preload: true,
	},
} as const;
