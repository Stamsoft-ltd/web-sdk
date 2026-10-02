// GPU budget: every pixi texture here is shipped at no more than ~1.15x its largest measured on-screen
// size (1920x1080 @ DPR 2, the biggest supported canvas; symbol parts get a further 1.4x for their
// pop/grow peaks). Downscaled files carry pixi's resolution suffix (`name@0.4x.webp`) so their logical
// size stays the original; every sprite also sets an explicit width/height. Chef layers (`_c`) are
// cropped to their opaque box — see GUY_CROPS in AnimatedGuy.svelte. Re-measure before swapping art.
export default {
	// Separated win-pad layers (banner / title / splashes / star / burger) so the pad can be
	// re-assembled and animated: banner + title pop in first, then the sauce splashes swoosh in
	// behind, the stars twinkle and the burger wiggles.
	// BIG-WIN ONLY art (winLevelMap levels >= 6, plus winBoxAmountCut/winBoxDrips) is `defer`red: streamed in the
	// background right after the loading screen instead of gating it. It is first drawn only after
	// a spin has resolved into a big win, by which point the deferred wave has long finished; until
	// it arrives <Sprite> falls back to an empty texture rather than failing.
	winBannerSweet: { type: 'sprite', src: new URL('../../assets/mcschmutzo/win/parts/banner-sweet.webp', import.meta.url).href, defer: true },
	winBannerLegendary: { type: 'sprite', src: new URL('../../assets/mcschmutzo/win/parts/banner-legendary.webp', import.meta.url).href, defer: true },
	winBannerEpic: { type: 'sprite', src: new URL('../../assets/mcschmutzo/win/parts/banner-epic.webp', import.meta.url).href, defer: true },
	winBannerWild: { type: 'sprite', src: new URL('../../assets/mcschmutzo/win/parts/banner-wild.webp', import.meta.url).href, defer: true },
	winBannerMythic: { type: 'sprite', src: new URL('../../assets/mcschmutzo/win/parts/banner-mythic.webp', import.meta.url).href, defer: true },
	// Split title words (tier word on top + the shared WIN below) so each can fly in from its own edge.
	winWordSweet: { type: 'sprite', src: new URL('../../assets/mcschmutzo/win/parts/word-sweet@0.642x.webp', import.meta.url).href, defer: true },
	winWordLegendary: { type: 'sprite', src: new URL('../../assets/mcschmutzo/win/parts/word-legendary@0.691x.webp', import.meta.url).href, defer: true },
	winWordEpic: { type: 'sprite', src: new URL('../../assets/mcschmutzo/win/parts/word-epic@0.591x.webp', import.meta.url).href, defer: true },
	winWordWild: { type: 'sprite', src: new URL('../../assets/mcschmutzo/win/parts/word-wild@0.597x.webp', import.meta.url).href, defer: true },
	winWordMythic: { type: 'sprite', src: new URL('../../assets/mcschmutzo/win/parts/word-mythic@0.613x.webp', import.meta.url).href, defer: true },
	winWordWin: { type: 'sprite', src: new URL('../../assets/mcschmutzo/win/parts/word-win@0.482x.webp', import.meta.url).href, defer: true },
	winStar: { type: 'sprite', src: new URL('../../assets/mcschmutzo/win/parts/win-star.webp', import.meta.url).href, defer: true },
	// Dedicated small-win value plaque (red panel + cream ornate frame + rivets, no splashes).
	winBoxSmall: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/win/small-win-box.webp', import.meta.url).href,
	},
	// The amount plaque with its five sauce-tendril ends cut out (they're redrawn live from
	// winBoxDrips — see game/paintedDrip.ts), and the sauce-only source for those ends.
	winBoxAmountCut: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/win/win-box-amount-cut.webp', import.meta.url).href,
		defer: true,
	},
	winBoxDrips: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/win/win-box-drips.webp', import.meta.url).href,
		defer: true,
	},
	boardBg: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/board.webp', import.meta.url).href,
	},
	closeButton: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/win/x-button.webp', import.meta.url).href,
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
	// The connected diner panorama (splash = left end, base game = right end; see game/panorama.ts).
	backgroundPanorama: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/background-panorama.webp', import.meta.url).href,
		preload: true,
	},
	// The same panorama pre-blurred (Gaussian r8 at full size, stored at half size): faded in over the
	// sharp one once the splash's camera pan has handed over, so the board reads in front. A baked
	// texture instead of a BlurFilter, which would re-blur the whole screen every frame.
	backgroundPanoramaBlur: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/background-panorama-blur@0.5x.webp', import.meta.url).href,
		preload: true,
	},
	// Mobile-landscape SPECIAL (free-games) grey kitchen — wide crop matching the base landscape bg.
	backgroundLandscapeBonus: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/special-bg-landscape.webp', import.meta.url).href,
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
		src: new URL('../../assets/mcschmutzo/special-lamp@0.37x.webp', import.meta.url).href,
		preload: true,
	},
	lampGlow: {
		// Soft radial glow (baked warm gradient, transparent edge) for the pendant bulbs — a smooth
		// falloff with no hard circle edge, blended additively behind the shade.
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/lamp-glow.webp', import.meta.url).href,
		preload: true,
	},
	specialPot: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/special-pot@0.888x.webp', import.meta.url).href,
		preload: true,
	},
	// Layered chefs (base with the pupils cut out + the pupils as their own sprites) so the eyes can
	// glance + blink while the figure stands. See AnimatedGuy.svelte.
	mascotBase: {
		// The Figma chef with the relaxed arm (McShmutzo node 8779:1769, "One-Armed Retro Diner
		// Worker") on the old 1304×1699 frame, with the old base's eye whites + brows pasted in (the
		// Figma face has none). The bottle arm is overlaid separately (mascotBottle) so it can shake.
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/guys/mascot_base_v7_c@0.882x.webp', import.meta.url).href,
		preload: true,
	},
	mascotBottle: {
		// The extracted ketchup bottle + gripping hand (full-frame canvas), overlaid on mascotBase and
		// shaken about the wrist.
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/guys/mascot_bottle_v5_c@0.882x.webp', import.meta.url).href,
		preload: true,
	},
	mascotBrows: {
		// Both eyebrows lifted off the base (full-frame layer), drawn above the blink lids so a blink
		// closes UNDER the brow instead of painting skin over it.
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/guys/mascot_brows_v5_c@0.882x.webp', import.meta.url).href,
		preload: true,
	},
	mascotLabel: {
		// The "McSchmutzo" nametag, cut out of the base (patched behind) so it can jiggle on its pin.
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/guys/mascot_label_v5_c@0.882x.webp', import.meta.url).href,
		preload: true,
	},
	specialBase: {
		// Real designer chef WITHOUT the salting arm (body fully drawn underneath) on the shared
		// 358x425 frame — the arm overlays and flicks with nothing duplicated behind it, and the
		// eyes are the intact art (animated pupils overlay the baked ones slightly larger).
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/guys/special_base_v11r_c@0.798x.webp', import.meta.url).href,
		preload: true,
	},
	specialArm: {
		// The salt-shaker forearm on the same frame, overlaid + flicked about the shoulder.
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/guys/special_arm_v3_c@0.798x.webp', import.meta.url).href,
		preload: true,
	},
	specialHand: {
		// His pointing hand, cut from the base (patched beneath), gesturing about the wrist.
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/guys/special_hand_v1_c@0.798x.webp', import.meta.url).href,
		preload: true,
	},
	specialBrows: {
		// Both eyebrows lifted off the special base (full-frame), drawn ABOVE the blink lids.
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/guys/special_brows_v1_c@0.798x.webp', import.meta.url).href,
		preload: true,
	},
	specialLabel: {
		// The "McSchmutzo" nametag (extracted), overlaid a touch larger over the baked one so it can
		// jiggle on its pin without exposing the one underneath.
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/guys/special_label_v2@0.862x.webp', import.meta.url).href,
		preload: true,
	},
	// The Figma wordmark only (node 8779:1698); the board logo's ketchup splats are drawn in code
	// (game/logoSplash, FeatureOverlay).
	mcschmutzoWord: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/logo-word@0.5x.webp', import.meta.url).href,
		preload: true,
	},
	mcH1: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/H1.webp', import.meta.url).href,
	},
	mcH2: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/H2.webp', import.meta.url).href,
	},
	mcH3: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/H3.webp', import.meta.url).href,
	},
	mcH4: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/H4.webp', import.meta.url).href,
	},
	mcH5: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/H5.webp', import.meta.url).href,
	},
	mcL1: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/L1.webp', import.meta.url).href,
	},
	mcL2: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/L2.webp', import.meta.url).href,
	},
	mcL3: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/L3.webp', import.meta.url).href,
	},
	mcL4: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/L4.webp', import.meta.url).href,
	},
	mcL5: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/L5.webp', import.meta.url).href,
	},
	mcW: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/W.webp', import.meta.url).href,
	},
	mcS: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/S.webp', import.meta.url).href,
	},
	mcM: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/M.webp', import.meta.url).href,
	},
	// Burger (H1) split into layers so it can be reassembled and animated part-by-part.
	burgerBunBottom: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/burger/bun_bottom@0.405x.webp', import.meta.url)
			.href,
	},
	burgerPatty: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/burger/patty@0.391x.webp', import.meta.url).href,
	},
	burgerCheese: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/burger/cheese@0.34x.webp', import.meta.url).href,
	},
	burgerOnion: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/burger/onion@0.305x.webp', import.meta.url).href,
	},
	burgerTomato: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/burger/tomato@0.313x.webp', import.meta.url).href,
	},
	burgerLettuce: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/burger/lettuce@0.336x.webp', import.meta.url).href,
	},
	burgerBunTop: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/burger/bun_top@0.471x.webp', import.meta.url).href,
	},
	// Soup pot (H2) split into layers (pot + soup / blobs / steam / drips / spoon / label).
	soupPot: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/soup/pot@0.455x.webp', import.meta.url).href,
	},
	// The green liquid surface, extracted from pot.webp so it can be drawn OVER the spoon — the spoon
	// then stirs submerged (bowl under the liquid, only the handle poking out).
	soupLiquid: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/soup/liquid@0.455x.webp', import.meta.url).href,
	},
	soupBlobs: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/soup/blobs@0.208x.webp', import.meta.url).href,
	},
	soupSteam: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/soup/steam@0.195x.webp', import.meta.url).href,
	},
	soupDrips: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/soup/drips@0.338x.webp', import.meta.url).href,
	},
	soupSpoon: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/soup/spoon@0.12x.webp', import.meta.url).href,
	},
	soupLabel: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/soup/label@0.26x.webp', import.meta.url).href,
	},
	// Wild (W) = WILD text; its ketchup splat is drawn in code (game/wildSplat.ts).
	wildText: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/wild/text@0.359x.webp', import.meta.url).href,
	},
	// Scatter (S) = stand + SCATTER banner.
	scatterStand: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/scatter/stand@0.517x.webp', import.meta.url).href,
	},
	scatterBanner: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/scatter/banner@0.362x.webp', import.meta.url).href,
	},
	// Sausage (H3) = banger + rising smoke.
	sausageBody: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/sausage/body.webp', import.meta.url).href,
	},
	sausageSmoke: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/sausage/smoke@0.158x.webp', import.meta.url).href,
	},
	// Onion rings (H5) = three leaning rings (ring3 is ring1 mirrored, for the third ring in the pile).
	onionRing1: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/onion/ring1@0.319x.webp', import.meta.url).href,
	},
	onionRing2: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/onion/ring2@0.305x.webp', import.meta.url).href,
	},
	onionRing3: {
		type: 'sprite',
		src: new URL('../../assets/mcschmutzo/symbols/parts/onion/ring3@0.287x.webp', import.meta.url).href,
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
	sound: {
		type: 'audio',
		src: new URL('../../assets/audio/sounds.json', import.meta.url).href,
		preload: true,
	},
} as const;
