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

	pixelBroccoli: { type: 'sprite', src: `${root}/broccoli.webp` },
	pixelCorn: { type: 'sprite', src: `${root}/corn.webp` },
	pixelTomato: { type: 'sprite', src: `${root}/tomato.webp` },
	pixelEggplant: { type: 'sprite', src: `${root}/eggplant.webp` },
	pixelCarrot: { type: 'sprite', src: `${root}/carrot.webp` },
	pixelCauliflower: { type: 'sprite', src: `${root}/cauliflower.webp` },
	pixelRadish: { type: 'sprite', src: `${root}/radish.webp` },
	// Eye frames for the same seven sprites, cut pixel-for-pixel from them by
	// scripts/build-splash-eyes.py (splash/<file>-blink|look-l|look-r.webp). The win banner's
	// symbols blink and glance with them, keyed off the FILE so the swapped cauliflower/radish art
	// stays true.
	pixelBroccoliBlink: { type: 'sprite', src: `${root}/splash/broccoli-blink.webp` },
	pixelBroccoliLookL: { type: 'sprite', src: `${root}/splash/broccoli-look-l.webp` },
	pixelBroccoliLookR: { type: 'sprite', src: `${root}/splash/broccoli-look-r.webp` },
	pixelCornBlink: { type: 'sprite', src: `${root}/splash/corn-blink.webp` },
	pixelCornLookL: { type: 'sprite', src: `${root}/splash/corn-look-l.webp` },
	pixelCornLookR: { type: 'sprite', src: `${root}/splash/corn-look-r.webp` },
	pixelTomatoBlink: { type: 'sprite', src: `${root}/splash/tomato-blink.webp` },
	pixelTomatoLookL: { type: 'sprite', src: `${root}/splash/tomato-look-l.webp` },
	pixelTomatoLookR: { type: 'sprite', src: `${root}/splash/tomato-look-r.webp` },
	pixelEggplantBlink: { type: 'sprite', src: `${root}/splash/eggplant-blink.webp` },
	pixelEggplantLookL: { type: 'sprite', src: `${root}/splash/eggplant-look-l.webp` },
	pixelEggplantLookR: { type: 'sprite', src: `${root}/splash/eggplant-look-r.webp` },
	pixelCarrotBlink: { type: 'sprite', src: `${root}/splash/carrot-blink.webp` },
	pixelCarrotLookL: { type: 'sprite', src: `${root}/splash/carrot-look-l.webp` },
	pixelCarrotLookR: { type: 'sprite', src: `${root}/splash/carrot-look-r.webp` },
	pixelCauliflowerBlink: { type: 'sprite', src: `${root}/splash/cauliflower-blink.webp` },
	pixelCauliflowerLookL: { type: 'sprite', src: `${root}/splash/cauliflower-look-l.webp` },
	pixelCauliflowerLookR: { type: 'sprite', src: `${root}/splash/cauliflower-look-r.webp` },
	pixelRadishBlink: { type: 'sprite', src: `${root}/splash/radish-blink.webp` },
	pixelRadishLookL: { type: 'sprite', src: `${root}/splash/radish-look-l.webp` },
	pixelRadishLookR: { type: 'sprite', src: `${root}/splash/radish-look-r.webp` },
	// Scatter king: `scatter` is the closed-eyed frame, `scatter_open` the resting open-eyed one.
	// The splash swaps them on a random timer and the bonus-intro card does the same.
	pixelScatter: { type: 'sprite', src: `${root}/scatter.webp` },
	pixelScatterOpen: { type: 'sprite', src: `${root}/scatter_open.webp` },
	pixelCoinSheet: { type: 'spriteSheet', src: `${root}/coin.json` },
	// Design 9050:17100's wooden plank card (node 9313:295187, 453x598 in the 1200-wide frame).
	// New filename rather than a query string so the previous card cannot be served from cache.
	bonusStartCardV5: { type: 'sprite', src: `${root}/overlays/v2/bonus-start-card-v5.webp` },
	bonusEndPlaqueV2: { type: 'sprite', src: `${root}/overlays/v2/bonus-end-plaque.webp` },
	/* Design 9044:16622's veggie basket (node 9243:192637), cut out of the one flat image the
	   design ships so each vegetable can move on its own. `bed` is the leafy backdrop with the
	   vegetables' footprints filled in from their neighbours, so lifting one exposes leaves rather
	   than a hole. The cut's third layer, the `crate` bowl, is deliberately NOT loaded: the design's
	   congrats sign has no crate — its own top edge is what crops the bunch — so that file stays on
	   disk only as a master for the info panel's recomposed still. */
	/* The congrats sign's king, design 9050:17100 (its `potato` frame is a 119px VECTOR of the
	   scatter, closed-eyed). Rendered from that SVG at 4x by scripts/build-congrats-king.py, so
	   the sign no longer blows the 89px board sprite up four times over ("the scatter image is
	   bad quality", user 2026-09-18). `king-open` is the same render with scatter_open's eyes
	   painted on at the art's own pitch — the closed frame is the design's, the blink swaps to it. */
	congratsKing: { type: 'sprite', src: `${root}/overlays/v2/congrats/king.webp` },
	congratsKingOpen: { type: 'sprite', src: `${root}/overlays/v2/congrats/king-open.webp` },
	congratsBed: { type: 'sprite', src: `${root}/overlays/v2/congrats/bed.webp` },
	congratsTomato: { type: 'sprite', src: `${root}/overlays/v2/congrats/tomato.webp` },
	congratsEggplant: { type: 'sprite', src: `${root}/overlays/v2/congrats/eggplant.webp` },
	congratsCauliflower: { type: 'sprite', src: `${root}/overlays/v2/congrats/cauliflower.webp` },
	congratsCarrot: { type: 'sprite', src: `${root}/overlays/v2/congrats/carrot.webp` },
	congratsCorn: { type: 'sprite', src: `${root}/overlays/v2/congrats/corn.webp` },
	congratsBroccoli: { type: 'sprite', src: `${root}/overlays/v2/congrats/broccoli.webp` },
	// Closed-eye frames of the same six cut-outs (eyes painted over with the skin colour plus a
	// shut arc, same idea as scatter vs scatter_open) so the bunch can blink on the outro sign.
	congratsTomatoBlink: { type: 'sprite', src: `${root}/overlays/v2/congrats/tomato-blink.webp` },
	congratsEggplantBlink: {
		type: 'sprite',
		src: `${root}/overlays/v2/congrats/eggplant-blink.webp`,
	},
	congratsCauliflowerBlink: {
		type: 'sprite',
		src: `${root}/overlays/v2/congrats/cauliflower-blink.webp`,
	},
	congratsCarrotBlink: { type: 'sprite', src: `${root}/overlays/v2/congrats/carrot-blink.webp` },
	congratsCornBlink: { type: 'sprite', src: `${root}/overlays/v2/congrats/corn-blink.webp` },
	congratsBroccoliBlink: {
		type: 'sprite',
		src: `${root}/overlays/v2/congrats/broccoli-blink.webp`,
	},

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
	winWordArtWildV3: { type: 'sprite', src: `${wins}/v2/wild-wordart.webp` },
	winAmountPlaqueV3: { type: 'sprite', src: `${wins}/v2/amount-plaque.webp` },
	winTitleSweetTopV2: { type: 'sprite', src: `${wins}/v2/sweet-sweet.webp` },
	winTitleSweetBottomV2: { type: 'sprite', src: `${wins}/v2/sweet-win.webp` },
	winTitleEpicV2: { type: 'sprite', src: `${wins}/v2/epic-title.webp` },
	winTitleMythicV2: { type: 'sprite', src: `${wins}/v2/mythic-title.webp` },
	winTitleLegendaryV2: { type: 'sprite', src: `${wins}/v2/legendary-title.webp` },
	// Still used by the bonus outro's total plaque.
	winAmountLegendaryV2: { type: 'sprite', src: `${wins}/v2/legendary-amount.webp` },

	/* The Howler sprite of the delivered sounds (audio-src/README.txt), rebuilt by
	   scripts/build-sounds.mjs. Loaded through the same manifest so the loading screen counts it
	   and EnableSound finds it in loadedAssets once play starts. */
	sound: { type: 'audio', src: './assets/veggie-salad/audio/sounds.json?v=20260918' },
};

export default assets;
