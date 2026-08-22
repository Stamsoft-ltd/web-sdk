import type { Assets } from 'pixi-svelte';

// Theme Park runtime asset manifest.

const assets: Assets = {
	// === BACKGROUND ===
	// The daylight park plaza (Figma 7051:2111), drawn flat to match the symbol set. It ships SHARP,
	// where the dusk art it replaces had to be blurred to stop its detail fighting the reels: the
	// middle of this scene is an empty orange path, so there is nothing behind the board to read
	// through. Cut by scripts/background/build_background.py.
	background: { type: 'sprite', src: './assets/theme-park/v2/park/plaza.webp' },
	// The house is its own node in the design and its own sprite here, laid over the smaller one the
	// plaza has painted into that corner, so <ParkHouse> can light its bulbs and its windows.
	parkHouse: { type: 'sprite', src: './assets/theme-park/v2/park/house.webp' },
	// Drifting sky, drawn by <Clouds>. A random subset renders per page load, so all five have to be
	// loaded — they total ~23 kB, less than a single symbol.
	cloud1: { type: 'sprite', src: './assets/theme-park/v2/clouds/cloud1.webp' },
	cloud2: { type: 'sprite', src: './assets/theme-park/v2/clouds/cloud2.webp' },
	cloud3: { type: 'sprite', src: './assets/theme-park/v2/clouds/cloud3.webp' },
	cloud4: { type: 'sprite', src: './assets/theme-park/v2/clouds/cloud4.webp' },
	cloud5: { type: 'sprite', src: './assets/theme-park/v2/clouds/cloud5.webp' },
	// These drift up through the sky between spins — see <EscapedBalloon>. The colour is re-rolled per
	// flight, so all five have to be here; they total ~30 kB. Cut from the h3 symbol, ribbon and all,
	// by scripts/build-escaped-balloon.py. `-flat` is a new filename rather than a ?v= on the old one:
	// these used to be rendered art carrying a baked blur, and a cached copy of that survives the swap
	// and flies a soft blob over a sharp plaza.
	balloonPink: { type: 'sprite', src: './assets/theme-park/v2/balloon/pink-flat.webp' },
	balloonOrange: { type: 'sprite', src: './assets/theme-park/v2/balloon/orange-flat.webp' },
	balloonYellow: { type: 'sprite', src: './assets/theme-park/v2/balloon/yellow-flat.webp' },
	balloonGreen: { type: 'sprite', src: './assets/theme-park/v2/balloon/green-flat.webp' },
	balloonBlue: { type: 'sprite', src: './assets/theme-park/v2/balloon/blue-flat.webp' },
	// The board, cut from one drawing by scripts/board/build_board_frame.py. The reels are drawn
	// between these two: the grid goes down under them and the rail goes over them, so no part of the
	// frame can trim an edge reel or the top of a full-reel feature symbol.
	//
	// It replaces a rail of 60 painted bulbs and the table of their centres that drove a chase round
	// them; this drawing has a continuous neon line instead, and nothing on it is a bulb.
	themeBoardGrid: {
		type: 'sprite',
		src: './assets/theme-park/v2/board/frame-grid.webp',
	},
	themeBoardRail: {
		type: 'sprite',
		src: './assets/theme-park/v2/board/frame-rail.webp',
	},
	// The lit part of the rail on its own, added back over it to pulse. Keyed off brightness, so it
	// is the neon line and the lip of the bevel — the dark inner face of the frame stays put.
	themeBoardRailGlow: {
		type: 'sprite',
		src: './assets/theme-park/v2/board/frame-glow.webp',
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
	// The car assembled and flattened, for the spin trail — and for anywhere the symbol is dimmed,
	// where drawing it in pieces would be wrong: pixi applies a container's alpha per child, so two
	// overlapping sprites at alpha 0.35 composite to about 0.58 and the arms would darken where they
	// cross the car. Built by scripts/coaster/build_coaster.py FROM the same table <CoasterCar>
	// draws from, so the still and the live symbol cannot drift apart.
	tpH1: { type: 'sprite', src: './assets/theme-park/v2/symbols/h1-coaster-still.png' },
	// ...and the pieces (Figma 7093:25555 car, 7093:24248/24249 arms). The car ships with both arms
	// DOWN and the arms come loose, so the two riders in the back row can wave while the board
	// idles — the symbol used to be one drawing of a car with its arms already up, which meant a
	// ride that never moved. The speed arcs are baked into the car: they are not attached to
	// anything that turns.
	tpCoasterCar: { type: 'sprite', src: './assets/theme-park/v2/symbols/coaster-car.png' },
	tpCoasterArmFather: {
		type: 'sprite',
		src: './assets/theme-park/v2/symbols/coaster-arm-father.png',
	},
	tpCoasterArmMother: {
		type: 'sprite',
		src: './assets/theme-park/v2/symbols/coaster-arm-mother.png',
	},
	// The duck assembled and flattened. Nothing draws it as the settled symbol — <DuckSymbol> builds
	// the live one out of the pieces below — but the board's spin trail needs a single sprite to
	// ghost, and a duck streaking past is not glancing about, so at that moment the two are the same
	// picture.
	tpH2: { type: 'sprite', src: './assets/theme-park/v2/symbols/h2-duck-marquee.png' },
	// ...and the pieces (Figma 7063:17957 body, 7057:8004 wing, 7063:17959 and 7063:17960 irises).
	// They ship apart because this symbol is a BIRD: the irises sit in eye sockets the body art
	// leaves empty, so they can glance about while the board is idle, and the left wing beats when
	// the duck wins. The right wing is drawn into the body and does not come apart.
	tpDuckBody: { type: 'sprite', src: './assets/theme-park/v2/symbols/duck-body.webp' },
	tpDuckWing: { type: 'sprite', src: './assets/theme-park/v2/symbols/duck-wing-flank.webp' },
	tpDuckIrisLeft: { type: 'sprite', src: './assets/theme-park/v2/symbols/duck-iris-left.webp' },
	tpDuckIrisRight: { type: 'sprite', src: './assets/theme-park/v2/symbols/duck-iris-right.webp' },
	// The bunch assembled and flattened. Nothing draws it as the settled symbol — <BalloonBunch>
	// builds the live one out of the four balloons below — but the board's spin trail needs a single
	// sprite to ghost, and balloons streaking past are not bobbing, so the two are the same picture
	// at that moment.
	tpH3: { type: 'sprite', src: './assets/theme-park/v2/symbols/h3-balloons-marquee.png' },
	// ...and the balloons (Figma 7080:21571 orange, 7080:21572 pink, 7080:21573 blue, 7080:21574
	// green). Four drawings, six balloons in the bunch: the blue and the orange each hang twice, at
	// different sizes and angles. They ship apart because they MOVE — nodding on their strings while
	// the board idles, and letting go and flying when the symbol wins.
	tpBalloonOrange: { type: 'sprite', src: './assets/theme-park/v2/symbols/balloon-orange.webp' },
	tpBalloonPink: { type: 'sprite', src: './assets/theme-park/v2/symbols/balloon-pink.webp' },
	tpBalloonBlue: { type: 'sprite', src: './assets/theme-park/v2/symbols/balloon-blue.webp' },
	tpBalloonGreen: { type: 'sprite', src: './assets/theme-park/v2/symbols/balloon-green.webp' },
	tpH4: { type: 'sprite', src: './assets/theme-park/v2/symbols/h4-popcorn-marquee.png' },
	// The popcorn's loose kernels, apart from the bucket (Figma 7052:7943, 7052:7945 and 7052:7941
	// next to 7063:17848). They ship separately because they are the part that moves: on a win
	// <PopcornBurst> throws them out of the heap and lets them fall. Three drawings rather than one,
	// because the design draws three sizes and a burst of identical kernels reads as a pattern.
	tpPopcornKernelA: { type: 'sprite', src: './assets/theme-park/v2/symbols/popcorn-kernel-a.webp' },
	tpPopcornKernelB: { type: 'sprite', src: './assets/theme-park/v2/symbols/popcorn-kernel-b.webp' },
	tpPopcornKernelC: { type: 'sprite', src: './assets/theme-park/v2/symbols/popcorn-kernel-c.webp' },
	// The wheel assembled and flattened. Nothing draws it as the symbol — <FerrisWheel> builds the
	// live one out of the pieces below — but the board's spin trail needs a single sprite to ghost,
	// and the wheel does not turn mid-spin, so at that moment the two are the same picture.
	tpH5: { type: 'sprite', src: './assets/theme-park/v2/symbols/h5-ferris-marquee.png' },
	// ...and the pieces (Figma 7052:7902 rim, 7052:7895 hub, 7052:7904 legs, and the four gondola
	// colours). They ship apart because the wheel TURNS on a win: the rim spins about the hub and the
	// gondolas ride round it staying upright, which one flat drawing cannot do.
	tpWheelRim: { type: 'sprite', src: './assets/theme-park/v2/symbols/wheel-rim.webp' },
	tpWheelHub: { type: 'sprite', src: './assets/theme-park/v2/symbols/wheel-hub.webp' },
	tpWheelLegs: { type: 'sprite', src: './assets/theme-park/v2/symbols/wheel-legs.webp' },
	tpWheelCarBlue: { type: 'sprite', src: './assets/theme-park/v2/symbols/wheel-car-blue.webp' },
	tpWheelCarPurple: { type: 'sprite', src: './assets/theme-park/v2/symbols/wheel-car-purple.webp' },
	tpWheelCarGreen: { type: 'sprite', src: './assets/theme-park/v2/symbols/wheel-car-green.webp' },
	tpWheelCarOrange: { type: 'sprite', src: './assets/theme-park/v2/symbols/wheel-car-orange.webp' },
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
	// The wild's letter, apart from its plate (Figma 7052:7927 next to 7052:7925). It ships separately
	// because it is the part that moves: on a win <WildLetter> pops it up from nothing. One asset for
	// all three layouts — it is drawn at a fraction of whatever size the plate is, so it needs no
	// per-mode variant the way the plate itself does.
	tpWildW: { type: 'sprite', src: './assets/theme-park/v2/symbols/wild-w.webp' },
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
	// One cartoon steam cloud (Figma 7057:7989), the companion piece to the Mega Wild's locomotive
	// plaque: <SymbolSteam> puffs a run of these out of the funnel while the plaque is winning. One
	// asset rather than a strip, because the puffs differ by scale, drift and fade, not by drawing.
	tpSteamPuff: { type: 'sprite', src: './assets/theme-park/v2/symbols/steam-puff.webp' },

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
	// The scatter's two loose wings (Figma 7115:27451 / 7115:27449). They ship apart from the rest of
	// the symbol so <DuckSign> can beat them on a win; the mode art above them is the same lockup with
	// these two cut out of it. One size each rather than a set per layout: at 180x159 they are two
	// fifths of the frame across and about 23KB apiece, so the phone builds would be saving a few
	// kilobytes for a second pair of files to keep in step. See `duckSignParts.ts` for where they go.
	//
	// `-fan` is not decoration: it is what makes a shipped build fetch these at all. The wings these
	// replace lived at the un-suffixed names, and a cached copy of a blurry gold blob would otherwise
	// outlive the redraw.
	tpDuckSignWingLeft: {
		type: 'sprite',
		src: './assets/theme-park/v2/symbols/duck-sign-wing-left-fan.png',
	},
	tpDuckSignWingRight: {
		type: 'sprite',
		src: './assets/theme-park/v2/symbols/duck-sign-wing-right-fan.png',
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
	// ROLLER WILDS ships in two forms and both are needed. `Scatter` is the STILL — every layer
	// baked into one picture — which is what the board's spin trail ghosts and what a dimmed symbol
	// falls back to, because pixi fades a container by fading each CHILD and an assembly of
	// overlapping sprites brightens wherever two of them cross once it is faded. `Sign` is the same
	// picture with the star and the two words left out, for <RollerWilds> to draw them on live.
	//
	// The filenames changed from -marquee to -still with this rebuild, and deliberately: a browser
	// that had fetched the old art went on serving it, which is how the duck kept a wing it no
	// longer had through three rebuilds. Renaming is what actually retires a piece of art here.
	tpRollerScatterDesktop: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/roller-wilds-desktop-still.png',
	},
	tpRollerScatterMobile: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/roller-wilds-mobile-still.png',
	},
	tpRollerScatterLandscape: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/roller-wilds-mobile-landscape-still.png',
	},
	tpRollerSignDesktop: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/roller-wilds-desktop-sign.png',
	},
	tpRollerSignMobile: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/roller-wilds-mobile-sign.png',
	},
	tpRollerSignLandscape: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/roller-wilds-mobile-landscape-sign.png',
	},
	// The three loose parts. One size each rather than a set per layout: between them they are a
	// fifth of the frame, so a second pair of files to keep in step would be saving a few kilobytes.
	tpRollerStar: {
		type: 'sprite',
		src: './assets/theme-park/v2/symbols/roller-wilds-star.png',
	},
	tpRollerWordRoller: {
		type: 'sprite',
		src: './assets/theme-park/v2/symbols/roller-wilds-word-roller.png',
	},
	tpRollerWordWilds: {
		type: 'sprite',
		src: './assets/theme-park/v2/symbols/roller-wilds-word-wilds.png',
	},
	// MEGA COASTER, the same way round as ROLLER WILDS above: `Scatter` is the whole symbol in one
	// piece, for the spin trail and for a dimmed cell, and `House` is the pavilion with no sign on
	// it, for <MegaCoaster> to bolt the live marquee to. New filenames rather than a ?v= on the old
	// ones, for the reason given up there.
	tpCoasterScatterDesktop: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/mega-coaster-desktop-still.png',
	},
	tpCoasterScatterMobile: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/mega-coaster-mobile-still.png',
	},
	tpCoasterScatterLandscape: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/mega-coaster-mobile-landscape-still.png',
	},
	tpCoasterHouseDesktop: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/mega-coaster-desktop-house.png',
	},
	tpCoasterHouseMobile: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/mega-coaster-mobile-house.png',
	},
	tpCoasterHouseLandscape: {
		type: 'sprite',
		src: './assets/theme-park/v2/modes/mega-coaster-mobile-landscape-house.png',
	},
	tpCoasterSign: {
		type: 'sprite',
		src: './assets/theme-park/v2/symbols/mega-coaster-sign.png',
	},
	tpCoasterWordMega: {
		type: 'sprite',
		src: './assets/theme-park/v2/symbols/mega-coaster-word-mega.png',
	},
	tpCoasterWordCoaster: {
		type: 'sprite',
		src: './assets/theme-park/v2/symbols/mega-coaster-word-coaster.png',
	},

	// === WIN BOARDS ===
	// The congratulations screens' signs: the TALL marquee for bonus won (Figma 7033:24761, cut by
	// scripts/congrats/) and, for bonus complete, the shared marquee PAD the big-win cards sit on
	// (scripts/pad/). Just the frames — the amount well, the medallion and the gold P that used to be
	// built into this art are gone; <CongratsPanel> draws the well and puts the bonus's own scatter
	// symbol where the medallion was. Deferred, because these only show once a bonus has run; until
	// they land the flat `bonusPanel` below holds the place.
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
	// the marquee pad, one wordmark per tier, the gold star that flies onto each shoulder, and the
	// confetti fan cut into its fifteen scraps. The scraps are the card's burst AND the falling
	// rain behind it (<WinConfettiRain>), so the screen has one vocabulary of paper.
	//
	// This replaced the previous card entirely — five flat 1 MB tier cards plus panel/ring/badge/coin
	// parts for each, 9.5 MB in all, against 1.0 MB here.
	//
	// Deferred at priority 0, so they are the first thing to stream in once the game is interactive:
	// there is no flat fallback card any more, and a big win can land within a couple of spins. The
	// amount plate is drawn rather than loaded, so even a card whose art has not arrived still shows
	// the number. Placement lives in game/winCardMarquee.ts, and the pad's own in game/padMarquee.ts.
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
