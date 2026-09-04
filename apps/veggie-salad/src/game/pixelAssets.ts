import type { Assets } from 'pixi-svelte';

const root = './assets/veggie-salad/pixel';
const wins = `${root}/wins`;

// Loader-only art is preloaded. Everything else loads after the loader mounts and therefore drives
// stateApp.loadingProgress instead of delaying first paint behind a blank screen.
const assets: Assets = {
	loadingBarAnim: {
		type: 'spriteSheet',
		src: `${root}/loading/loading_bar.json`,
		preload: true,
	},
	pressPlayLogo: {
		type: 'sprite',
		src: `${root}/loading/press_play_logo.webp`,
		preload: true,
	},
	loadingBackground: {
		type: 'sprite',
		src: `${root}/background.png`,
		preload: true,
	},

	pixelGameLogo: { type: 'sprite', src: `${root}/logo.png` },
	pixelBroccoli: { type: 'sprite', src: `${root}/broccoli.png` },
	pixelCorn: { type: 'sprite', src: `${root}/corn.png` },
	pixelTomato: { type: 'sprite', src: `${root}/tomato.png` },
	pixelEggplant: { type: 'sprite', src: `${root}/eggplant.png` },
	pixelCarrot: { type: 'sprite', src: `${root}/carrot.png` },
	pixelCauliflower: { type: 'sprite', src: `${root}/cauliflower.png` },
	pixelRadish: { type: 'sprite', src: `${root}/radish.png` },
	pixelOnion: { type: 'sprite', src: `${root}/onion.png` },
	pixelScatter: { type: 'sprite', src: `${root}/scatter.png` },
	pixelCoinSheet: { type: 'spriteSheet', src: `${root}/coin.json` },

	winStar: { type: 'sprite', src: `${wins}/star.png` },
	winPlaqueSweet: { type: 'sprite', src: `${wins}/plaque-sweet.png` },
	winPlaqueWild: { type: 'sprite', src: `${wins}/plaque-wild.png` },
	winPlaqueEpic: { type: 'sprite', src: `${wins}/plaque-epic.png` },
	winPlaqueMythic: { type: 'sprite', src: `${wins}/plaque-mythic.png` },
	winPlaqueLegendary: { type: 'sprite', src: `${wins}/plaque-legendary.png` },
	winTitleSweet: { type: 'sprite', src: `${wins}/title-sweet.png` },
	winTitleWild: { type: 'sprite', src: `${wins}/title-wild.png` },
	winTitleEpic: { type: 'sprite', src: `${wins}/title-epic.png` },
	winTitleMythic: { type: 'sprite', src: `${wins}/title-mythic.png` },
	winTitleLegendary: { type: 'sprite', src: `${wins}/title-legendary.png` },
};

export default assets;
