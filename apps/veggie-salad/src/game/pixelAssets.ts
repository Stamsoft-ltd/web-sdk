import type { Assets } from 'pixi-svelte';

const root = './assets/veggie-salad/pixel';
const wins = `${root}/wins`;

// Loader-only art is preloaded. Everything else loads after the loader mounts and therefore drives
// stateApp.loadingProgress instead of delaying first paint behind a blank screen.
const assets: Assets = {
	// Design 9200:148971's own garden — a flat sky and grass, the hill/lake band, the fence run
	// and the corner daisies, composited once at 2x. The gameplay background is a different
	// painting, so the loader cannot borrow it.
	loadingGarden: {
		type: 'sprite',
		src: `${root}/loading/garden.webp`,
		preload: true,
	},
	// The Press Play mark's two white parts (9298:295160 and 9298:295105). The badge itself is
	// drawn, because its red has to fill across it as assets land.
	pressPlayP: {
		type: 'sprite',
		src: `${root}/loading/press_play_p.webp`,
		preload: true,
	},
	pressPlayWordmark: {
		type: 'sprite',
		src: `${root}/loading/press_play_wordmark.webp`,
		preload: true,
	},

	/* The win screens' vegetables are the BOARD's own sprites (pixel/board/, the set design
	   9242:184876 draws round the banner), so a win never shows symbols the reels do not have.
	   The premiums keep their shades, as on the board. Each has three beat frames beside it:
	   blink / glance for the crowd; for the premiums a shout (-wide), the shades lifted (-lift)
	   and a glint glance — see build-board-crop.py and build-board-premium.py. */
	winVeggieCabbage: { type: 'sprite', src: `${root}/board/cabbage-shades.webp` },
	winVeggieCabbageBlink: { type: 'sprite', src: `${root}/board/cabbage-shades-wide.webp` },
	winVeggieCabbageLookL: { type: 'sprite', src: `${root}/board/cabbage-shades-lift.webp` },
	winVeggieCabbageLookR: { type: 'sprite', src: `${root}/board/cabbage-shades-look-r.webp` },
	winVeggiePepper: { type: 'sprite', src: `${root}/board/pepper-shades.webp` },
	winVeggiePepperBlink: { type: 'sprite', src: `${root}/board/pepper-shades-wide.webp` },
	winVeggiePepperLookL: { type: 'sprite', src: `${root}/board/pepper-shades-lift.webp` },
	winVeggiePepperLookR: { type: 'sprite', src: `${root}/board/pepper-shades-look-r.webp` },
	winVeggieTomato: { type: 'sprite', src: `${root}/board/tomato-shades.webp` },
	winVeggieTomatoBlink: { type: 'sprite', src: `${root}/board/tomato-shades-wide.webp` },
	winVeggieTomatoLookL: { type: 'sprite', src: `${root}/board/tomato-shades-lift.webp` },
	winVeggieTomatoLookR: { type: 'sprite', src: `${root}/board/tomato-shades-look-r.webp` },
	winVeggieEggplant: { type: 'sprite', src: `${root}/board/eggplant.webp` },
	winVeggieEggplantBlink: { type: 'sprite', src: `${root}/board/eggplant-blink.webp` },
	winVeggieEggplantLookL: { type: 'sprite', src: `${root}/board/eggplant-look-l.webp` },
	winVeggieEggplantLookR: { type: 'sprite', src: `${root}/board/eggplant-look-r.webp` },
	winVeggiePotato: { type: 'sprite', src: `${root}/board/potato.webp` },
	winVeggiePotatoBlink: { type: 'sprite', src: `${root}/board/potato-blink.webp` },
	winVeggiePotatoLookL: { type: 'sprite', src: `${root}/board/potato-look-l.webp` },
	winVeggiePotatoLookR: { type: 'sprite', src: `${root}/board/potato-look-r.webp` },
	winVeggieRadish: { type: 'sprite', src: `${root}/board/radish.webp` },
	winVeggieRadishBlink: { type: 'sprite', src: `${root}/board/radish-blink.webp` },
	winVeggieRadishLookL: { type: 'sprite', src: `${root}/board/radish-look-l.webp` },
	winVeggieRadishLookR: { type: 'sprite', src: `${root}/board/radish-look-r.webp` },
	winVeggieGarlic: { type: 'sprite', src: `${root}/board/garlic.webp` },
	winVeggieGarlicBlink: { type: 'sprite', src: `${root}/board/garlic-blink.webp` },
	winVeggieGarlicLookL: { type: 'sprite', src: `${root}/board/garlic-look-l.webp` },
	winVeggieGarlicLookR: { type: 'sprite', src: `${root}/board/garlic-look-r.webp` },
	// Scatter king: `scatter` is the closed-eyed frame, `scatter_open` the resting open-eyed one.
	// The splash swaps them on a random timer and the bonus-intro card does the same.
	pixelScatter: { type: 'sprite', src: `${root}/scatter.webp` },
	pixelScatterOpen: { type: 'sprite', src: `${root}/scatter_open.webp` },
	pixelCoinSheet: { type: 'spriteSheet', src: `${root}/coin.json` },
	// Design 9050:17100's wooden plank card (node 9313:295187, 453x598 in the 1200-wide frame).
	// New filename rather than a query string so the previous card cannot be served from cache.
	bonusStartCardV5: { type: 'sprite', src: `${root}/overlays/v2/bonus-start-card-v5.webp` },
	bonusEndPlaqueV2: { type: 'sprite', src: `${root}/overlays/v2/bonus-end-plaque-px.webp` },
	/* The splash king's rig (scripts/build-splash-king.py): one 451px canvas per moving part, so
	   they stack centred. The bonus intro card animates it with the splash's own keyframes
	   (PixelEventOverlay KING_RIG) — "on congrats screen lets use same animation as splash". */
	kingSprout: { type: 'sprite', src: `${root}/splash/king/sprout.webp` },
	kingBody: { type: 'sprite', src: `${root}/splash/king/body.webp` },
	kingBodyOpen: { type: 'sprite', src: `${root}/splash/king/body-open.webp` },
	kingCrown: { type: 'sprite', src: `${root}/splash/king/crown.webp` },
	kingFeetL: { type: 'sprite', src: `${root}/splash/king/feet-l.webp` },
	kingFeetR: { type: 'sprite', src: `${root}/splash/king/feet-r.webp` },
	kingCapeL: { type: 'sprite', src: `${root}/splash/king/cape-l.webp` },
	kingCapeR: { type: 'sprite', src: `${root}/splash/king/cape-r.webp` },

	/* Word art and the bonus-end plaque load the grid-snapped -px copies from
	   scripts/build-crisp-art.py; the sources were blurred pixel art (softness 0.13-0.23). */
	winStarSweetV2: { type: 'sprite', src: `${wins}/v2/sweet-star.webp` },
	/* Design 9242:190479 (WILD WIN). The sign is one riveted banner (9242:190694, 989x374 in the
	   1200-wide frame); Figma ships its master blue and tints it, so the per-tier files are that
	   master recoloured to the tier hue. WILD's word art is the design's own (9242:190797); the other
	   tiers stack their existing tier word over the cream WIN in the same box. The amount sits on the
	   design's orange plaque (9251:194932) for every tier. */
	winBannerSweetV3: { type: 'sprite', src: `${wins}/v2/banner-sweet.webp` },
	winBannerWildV3: { type: 'sprite', src: `${wins}/v2/banner-wild.webp` },
	winBannerEpicV3: { type: 'sprite', src: `${wins}/v2/banner-epic.webp` },
	winBannerMythicV3: { type: 'sprite', src: `${wins}/v2/banner-mythic.webp` },
	winBannerLegendaryV3: { type: 'sprite', src: `${wins}/v2/banner-legendary.webp` },
	winWordArtWildV3: { type: 'sprite', src: `${wins}/v2/wild-wordart-px.webp` },
	// MAX WIN, design 9428:64173: the word art's own transparent master (9428:64660).
	winWordArtMaxV1: { type: 'sprite', src: `${wins}/v2/max-wordart-px.webp` },
	winAmountPlaqueV3: { type: 'sprite', src: `${wins}/v2/amount-plaque.webp` },
	winTitleSweetTopV2: { type: 'sprite', src: `${wins}/v2/sweet-sweet-px.webp` },
	winTitleSweetBottomV2: { type: 'sprite', src: `${wins}/v2/sweet-win-px.webp` },
	winTitleEpicV2: { type: 'sprite', src: `${wins}/v2/epic-title-px.webp` },
	winTitleMythicV2: { type: 'sprite', src: `${wins}/v2/mythic-title-px.webp` },
	winTitleLegendaryV2: { type: 'sprite', src: `${wins}/v2/legendary-title-px.webp` },
	// Still used by the bonus outro's total plaque.
	winAmountLegendaryV2: { type: 'sprite', src: `${wins}/v2/legendary-amount.webp` },

	/* The Howler sprite of the delivered sounds (audio-src/README.txt), rebuilt by
	   scripts/build-sounds.mjs. Loaded through the same manifest so the loading screen counts it
	   and EnableSound finds it in loadedAssets once play starts. */
	sound: { type: 'audio', src: './assets/veggie-salad/audio/sounds.json?v=20260921' },
};

export default assets;
