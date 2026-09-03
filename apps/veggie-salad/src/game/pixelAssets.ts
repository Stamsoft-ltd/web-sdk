import type { Assets } from 'pixi-svelte';

const root = './assets/veggie-salad/pixel';

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
};

export default assets;
