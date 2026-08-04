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
	// The autoplay pad: same rect and same grid lines, but a clean neon outline in place of the
	// bulbs, so the lights running round that outline are the only thing moving on the border.
	themeBoardAuto: { type: 'sprite', src: './assets/theme-park/v2/board-auto.webp' },
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
	tpMegaWildAnim: {
		type: 'sprite',
		src: './assets/theme-park/v2/animations/symbols/mega-wild.webm',
		defer: true,
	},
	tpMegaWildWinAnim: {
		type: 'sprite',
		src: './assets/theme-park/v2/animations/symbols/mega-wild-win.webm',
		defer: true,
	},
	tpCoasterWild: {
		type: 'sprite',
		src: './assets/theme-park/v2/symbols/wild-slime.png',
	},

	// === FEATURE PRESENTERS ===
	coasterTrack: {
		type: 'sprite',
		src: './assets/theme-park/v2/features/coaster-track.png',
	},
	coasterCarHappy: {
		type: 'sprite',
		src: './assets/theme-park/v2/features/coaster-car-happy.png',
	},
	coasterCarVomit: {
		type: 'sprite',
		src: './assets/theme-park/v2/features/coaster-car-vomit.png',
	},
	coasterCarSick: {
		type: 'sprite',
		src: './assets/theme-park/v2/features/coaster-car-sick.png',
	},
	rollerWildCar: {
		type: 'sprite',
		src: './assets/theme-park/v2/features/roller-wild-car.png',
	},
	rollerWildCarAnim: {
		type: 'sprite',
		src: './assets/theme-park/v2/animations/features/roller-wild-car.webm',
		defer: true,
	},
	// Drop-state car (duck excited, both wings up). Placeholder = the waving clip until the real
	// "both hands in the air" animation is provided; the overlay switches to this once the car starts
	// rolling down the reel.
	rollerWildCarDropAnim: {
		type: 'sprite',
		src: './assets/theme-park/v2/animations/features/roller-wild-car-drop.webm',
		defer: true,
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
	rollerWildRail: {
		type: 'sprite',
		src: './assets/theme-park/v2/features/roller-wild-rail.png',
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
	tpDuckScatterAnim: {
		type: 'sprite',
		src: './assets/theme-park/v2/animations/symbols/duck-your-luck.webm',
		defer: true,
	},
	tpDuckScatterWinAnim: {
		type: 'sprite',
		src: './assets/theme-park/v2/animations/symbols/duck-your-luck-win.webm',
		defer: true,
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
	// Bonus-complete screen (Figma 6094:4022): the square neon panel and the prize pile on it.
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
	// Win-card animations as alpha-keyed sprite sheets (36 frames, 6×6 of 512px), generated from
	// the yuv420p win-card MP4s — the source videos carry NO alpha, so the old webm route composited
	// their black background into the scene. The card silhouette is flood-fill masked opaque and
	// the outside glows are un-premultiplied from black. Regenerate with the pipeline script if the
	// source videos change, and RENAME the outputs to bust caches.
	winSweetAnim: {
		type: 'spriteSheet',
		src: './assets/sprites/winCards/sweet_card.json',
		defer: true,
	},
	winWildAnim: {
		type: 'spriteSheet',
		src: './assets/sprites/winCards/wild_card.json',
		defer: true,
	},
	winEpicAnim: {
		type: 'spriteSheet',
		src: './assets/sprites/winCards/epic_card.json',
		defer: true,
	},
	winLegendaryAnim: {
		type: 'spriteSheet',
		src: './assets/sprites/winCards/legendary_card.json',
		defer: true,
	},
	winMythicAnim: {
		type: 'spriteSheet',
		src: './assets/sprites/winCards/mythic_card.json',
		defer: true,
	},

	// === FRAMES / UI ===
	symbolPad: { type: 'sprite', src: './assets/components/frames/symbol_pad.png' },
	forestBonusBadge: {
		type: 'sprite',
		src: './assets/components/frames/forest/badge_frame.png',
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
	// Marquee bulb strip: a pair of these frames the anticipating reel and blinks (Anticipation).
	// Built FROM the board pad's own right-hand bulb rail (mirrored about the bulb column to
	// restore the edge-clipped halos, tiled to 12 bulbs) so the strip matches the frame's bulbs
	// exactly — the previous light_strip.webp art read as a different fixture.
	anticipationStrip: {
		type: 'sprite',
		src: './assets/theme-park/v2/features/rail_strip.webp',
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
