const assets = {



	bgBase: {
		type: 'sprite',
		src: './assets/components/backgrounds/bg_base.jpg?v=20260707'
	},
	bgBonus: {
		type: 'sprite',
		src: './assets/components/backgrounds/bg_bonus.jpg?v=20260708'
	},
	bgSuper: {
		type: 'sprite',
		src: './assets/components/backgrounds/bg_super.jpg?v=20260708'
	},
	// Portrait (mobile) backgrounds — tall corridor art, swapped in when layoutType is 'portrait'.
	bgMobileBase: {
		type: 'sprite',
		src: './assets/components/backgrounds/bg_mobile_base.jpg?v=20260709'
	},
	bgMobileBonus: {
		type: 'sprite',
		src: './assets/components/backgrounds/bg_mobile_bonus.webp?v=20260709'
	},
	bgMobileSuper: {
		type: 'sprite',
		src: './assets/components/backgrounds/bg_mobile_super.webp?v=20260709'
	},
	// Portrait board frame + horizontal capsule tube + small pad (ALL WINS / FREE SPINS boxes).
	boardPadMobile: {
		type: 'sprite',
		src: './assets/components/frames/board_pad_mobile.webp?v=20260709'
	},
	// Landscape (mobile horizontal) board frame.
	boardPadLand: {
		type: 'sprite',
		src: './assets/components/frames/board_pad_land.webp?v=20260713'
	},
	smallPadMobile: {
		type: 'sprite',
		src: './assets/components/ui/small_pad_mobile.webp?v=20260709'
	},
	// Circular-arrow icon for the RESPIN indicator panel (left rail, Figma 4504-3588).
	respinIcon: {
		type: 'sprite',
		src: './assets/components/ui/respin_icon.webp?v=20260713'
	},
	panelBorder: {
		type: 'sprite',
		src: './assets/components/ui/panel_border.webp?v=20260708'
	},
	// Desktop tesla capsule housing. This is the per-pixel MEDIAN of the original 30-frame baked
	// flipbook: the source video has sub-pixel camera wobble, so playing the whole capsule as a
	// flipbook drifted the metal ~1px frame to frame, while the median rejects the moving lightning
	// and leaves the housing perfectly still. The lightning itself is drawn procedurally by
	// CapsuleBolts.svelte, so no animation sheet ships for desktop at all (804KB -> 29KB).
	// Regenerate with scripts/split-capsule-shell.py, which needs the original flipbook — deleted
	// from the tree once the bolts went procedural, but recoverable via
	// `git show <rev>:apps/magnetic/static/assets/sprites/capsuleTube/capsule_tube_anim.webp`.
	capsuleTubeShell: {
		type: 'sprite',
		src: './assets/sprites/capsuleTube/capsule_tube_shell.webp?v=20260729'
	},
	// Mobile/portrait+landscape tube: the same tesla animation exported HORIZONTALLY (mp4 → keyed,
	// trimmed 30-frame flipbook, visible-tube aspect ~3.23). Portrait uses it as-is; mobile-landscape
	// rotates it 90° to run vertically.
	capsuleTubeAnimMobile: {
		type: 'spriteSheet',
		src: './assets/sprites/capsuleTube/capsule_tube_mobile_anim.json'
	},
	capsuleLightning: {
		type: 'sprite',
		src: './assets/components/ui/capsule_lightning.webp?v=20260708'
	},
	// Fine branching filaments extracted from the tube's original baked art — drawn additively
	// inside the glass and flickered for a live crackle web around the central bolt.
	capsuleCrackle: {
		type: 'sprite',
		src: './assets/components/ui/capsule_crackle.webp?v=20260709b'
	},
	// Fully transparent horizontal tube (metal caps + blue rails, see-through interior) — the always-on
	// portrait capsule bar; live lightning is drawn inside the clear window.
	capsuleTubeGlass: {
		type: 'sprite',
		src: './assets/components/ui/magnetic_tube.webp?v=20260710'
	},
	// Free-spins intro popup: dark-blue tech panel + win-state horseshoe magnet (baked electric FX).
	fsPanel: {
		type: 'sprite',
		src: './assets/components/ui/fs_panel.webp?v=20260708'
	},
	// Free-spins intro: full magnet element (magnet + base + blue/orange energy) and the press arrow.
	popupMagnet: {
		type: 'sprite',
		src: './assets/components/ui/popup_magnet.webp?v=20260708'
	},
	// Animated medallion for both congratulations popups (Magnific "lightning flicker" video,
	// black keyed to alpha). 30-frame near-seamless loop.
	popupMagnetAnim: {
		type: 'spriteSheet',
		src: './assets/sprites/popupMagnet/popup_magnet_anim.json'
	},
	pressArrow: {
		type: 'sprite',
		src: './assets/components/ui/press_arrow.webp?v=20260708'
	},
	boardPad: {
		type: 'sprite',
		src: './assets/components/frames/board_pad.webp?v=20260707'
	},
	// Per-cell boxes: a stationary 7x7 grid of these sits behind the rolling symbols. Winning cells
	// swap to the win-state box.
	cellBox: {
		type: 'sprite',
		src: './assets/components/frames/cell_box.webp?v=20260708'
	},
	cellBoxWin: {
		type: 'sprite',
		src: './assets/components/frames/cell_box_win.webp?v=20260708'
	},
	symbolPad: {
		type: 'sprite',
		src: './assets/components/frames/symbol_pad.webp?v=20260625'
	},
	counterFrame: {
		type: 'sprite',
		src: './assets/components/ui/confirm_frame.webp?v=20260625'
	},
	deerPresenter: {
		type: 'sprite',
		src: './assets/components/characters/deer_presenter.webp?v=20260625'
	},
	multiplierHand: {
		type: 'sprite',
		src: './assets/components/ui/multiplier_hand.webp?v=20260624'
	},
	magneticLogo: {
		type: 'sprite',
		src: './assets/components/ui/magnetic_logo.webp?v=20260707'
	},
	pressPlayLogo: {
		type: 'sprite',
		src: './assets/components/ui/press_play_logo.webp?v=20260709'
	},
	// Win-state flipbook sheets are gone: winning cells now play the procedural <SymbolWinFx>
	// choreography over the hi-res static win art. The 9–10 frame sheets looped at ~14fps with no
	// real object motion — the Stake review's "poor animations".
	aTile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/nut.webp?v=20260709' },
	aWinTile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/nut_win.webp?v=20260709' },
	aTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/nut_mobile.webp?v=20260709' },
	aWinTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/nut_mobile_win.webp?v=20260709' },
	kTile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/washer.webp?v=20260709' },
	kWinTile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/washer_win.webp?v=20260709' },
	kTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/washer_mobile.webp?v=20260709' },
	kWinTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/washer_mobile_win.webp?v=20260709' },
	qTile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/energy_screw.webp?v=20260709' },
	qWinTile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/energy_screw_win.webp?v=20260709' },
	qTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/energy_screw_mobile.webp?v=20260709' },
	qWinTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/energy_screw_mobile_win.webp?v=20260709' },
	wildTile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild.webp?v=20260709' },
	wildWinTile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild.webp?v=20260709' },
	wildTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_mobile.webp?v=20260709' },
	wildWinTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_mobile.webp?v=20260709' },
	wild2xTile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x2.webp?v=20260709' },
	wild3xTile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x3.webp?v=20260709' },
	wild4xTile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x4.webp?v=20260709' },
	wild5xTile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x5.webp?v=20260709' },
	wild7xTile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x7.webp?v=20260709' },
	wild9xTile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x9.webp?v=20260709' },
	wild10xTile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x10.webp?v=20260709' },
	wild2xTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x2_mobile.webp?v=20260709' },
	wild3xTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x3_mobile.webp?v=20260709' },
	wild4xTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x4_mobile.webp?v=20260709' },
	wild5xTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x5_mobile.webp?v=20260709' },
	wild7xTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x7_mobile.webp?v=20260709' },
	wild9xTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x9_mobile.webp?v=20260709' },
	wild10xTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x10_mobile.webp?v=20260709' },
	// Radial electric burst played BEHIND every stacked (locked) symbol. 10 independent bursts
	// rather than a rendered animation, so the cycle is a crackle, not motion — order carries no
	// meaning. Regenerate with scripts/build-stack-zap-sheet.py <src-dir>.
	stackZapAnim: {
		type: 'spriteSheet',
		src: './assets/sprites/stackZap/stack_zap.json'
	},
	scatterCustom: { type: 'sprite', src: './assets/components/symbols/magnetic/special/scatter.webp?v=20260709' },
	scatterWin: { type: 'sprite', src: './assets/components/symbols/magnetic/special/scatter.webp?v=20260709' },
	scatterCustomMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/scatter_mobile.webp?v=20260709' },
	scatterWinMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/scatter_mobile.webp?v=20260709' },
	foxTile:      { type: 'sprite', src: './assets/components/symbols/magnetic/premium/horseshoe.webp?v=20260709' },
	wolfTile:     { type: 'sprite', src: './assets/components/symbols/magnetic/premium/plasma_drill.webp?v=20260709' },
	bearTile:     { type: 'sprite', src: './assets/components/symbols/magnetic/premium/magnetic_core_cube.webp?v=20260709' },
	rabbitTile:   { type: 'sprite', src: './assets/components/symbols/magnetic/premium/electromagnetic_device.webp?v=20260709' },
	magnetTile:   { type: 'sprite', src: './assets/components/ui/magnet_win.webp?v=20260709' },
	squirrelTile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/bolt.webp?v=20260709' },
	squirrelTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/bolt_mobile.webp?v=20260709' },
	// Premium mobile (portrait) symbol art.
	foxTileMobile:       { type: 'sprite', src: './assets/components/symbols/magnetic/premium/horseshoe_mobile.webp?v=20260709' },
	foxWinTileMobile:    { type: 'sprite', src: './assets/components/symbols/magnetic/premium/horseshoe_mobile_win.webp?v=20260709' },
	wolfTileMobile:      { type: 'sprite', src: './assets/components/symbols/magnetic/premium/plasma_drill_mobile.webp?v=20260709' },
	wolfWinTileMobile:   { type: 'sprite', src: './assets/components/symbols/magnetic/premium/plasma_drill_mobile_win.webp?v=20260709' },
	bearTileMobile:      { type: 'sprite', src: './assets/components/symbols/magnetic/premium/magnetic_core_cube_mobile.webp?v=20260709' },
	bearWinTileMobile:   { type: 'sprite', src: './assets/components/symbols/magnetic/premium/magnetic_core_cube_mobile_win.webp?v=20260709' },
	rabbitTileMobile:    { type: 'sprite', src: './assets/components/symbols/magnetic/premium/electromagnetic_device_mobile.webp?v=20260709' },
	rabbitWinTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/premium/electromagnetic_device_mobile_win.webp?v=20260709' },
	// Landscape (mobile horizontal) symbol art.
	foxTileLand:       { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/horseshoe_land.webp?v=20260713' },
	foxWinTileLand:    { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/horseshoe_land_win.webp?v=20260713' },
	wolfTileLand:      { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/plasma_land.webp?v=20260713' },
	wolfWinTileLand:   { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/plasma_land_win.webp?v=20260713' },
	bearTileLand:      { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/cube_land.webp?v=20260713' },
	bearWinTileLand:   { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/cube_land_win.webp?v=20260713' },
	rabbitTileLand:    { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/emag_land.webp?v=20260713' },
	rabbitWinTileLand: { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/emag_land_win.webp?v=20260713' },
	squirrelTileLand:    { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/bolt_land.webp?v=20260713' },
	squirrelWinTileLand: { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/bolt_land_win.webp?v=20260713' },
	aTileLand:    { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/nut_land.webp?v=20260713' },
	aWinTileLand: { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/nut_land_win.webp?v=20260713' },
	kTileLand:    { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/washer_land.webp?v=20260713' },
	kWinTileLand: { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/washer_land_win.webp?v=20260713' },
	qTileLand:    { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/energy_screw_land.webp?v=20260713' },
	qWinTileLand: { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/energy_screw_land_win.webp?v=20260713' },
	wildTileLand:    { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/wild_land.webp?v=20260713' },
	scatterTileLand: { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/scatter_land.webp?v=20260713' },
	wild2xTileLand:  { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/wild2x_land.webp?v=20260713' },
	wild3xTileLand:  { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/wild3x_land.webp?v=20260713' },
	wild4xTileLand:  { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/wild4x_land.webp?v=20260713' },
	wild5xTileLand:  { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/wild5x_land.webp?v=20260713' },
	wild7xTileLand:  { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/wild7x_land.webp?v=20260713' },
	wild9xTileLand:  { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/wild9x_land.webp?v=20260713' },
	wild10xTileLand: { type: 'sprite', src: './assets/components/symbols/magnetic/landscape/wild10x_land.webp?v=20260713' },
	foxWinTile: { type: 'sprite', src: './assets/components/symbols/magnetic/premium/horseshoe_win.webp?v=20260709' },
	wolfWinTile: { type: 'sprite', src: './assets/components/symbols/magnetic/premium/plasma_drill_win.webp?v=20260709' },
	bearWinTile: { type: 'sprite', src: './assets/components/symbols/magnetic/premium/magnetic_core_cube_win.webp?v=20260709' },
	rabbitWinTile: { type: 'sprite', src: './assets/components/symbols/magnetic/premium/electromagnetic_device_win.webp?v=20260709' },
	magnetWinTile: { type: 'sprite', src: './assets/components/ui/magnet_win.webp?v=20260709' },
	squirrelWinTile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/bolt_win.webp?v=20260709' },
	// Win boards — preloaded so board escalation during count-up doesn't stall
	sweetWinBoard:     { type: 'sprite', src: './assets/components/win_boards/sweet_win.webp?v=20260730' },
	wildWinBoard:      { type: 'sprite', src: './assets/components/win_boards/big_win.webp?v=20260730' },
	epicWinBoard:      { type: 'sprite', src: './assets/components/win_boards/epic_win.webp?v=20260730' },
	mythicWinBoard:    { type: 'sprite', src: './assets/components/win_boards/mega_win.webp?v=20260730' },
	legendaryWinBoard: { type: 'sprite', src: './assets/components/win_boards/max_win.webp?v=20260730' },
	// Special wide board for the 20000x max-win cap (Figma 4143-16513), 1535×1025
	maxWinBoard:       { type: 'sprite', src: './assets/components/win_boards/max_win_screen.webp?v=20260709' },
	goldFont: {
		type: 'font',
		src: './assets/fonts/goldFont/mm_gold.xml?v=20260611',
	},
	silverFont: {
		type: 'font',
		src: './assets/fonts/silverFont/mm_silver.xml?v=20260611',
	},
	bigwin: {
		type: 'spine',
		src: {
			atlas: './assets/spines/bigwin/big_wins.atlas',
			skeleton: './assets/spines/bigwin/mm_bigwin.json',
			scale: 2,
		},
	},
	fsIntro: {
		type: 'spine',
		src: {
			atlas: './assets/spines/fsIntro/fs_screen.atlas',
			skeleton: './assets/spines/fsIntro/fs_screen.json',
			scale: 2,
		},
	},
	// Animated loading bar (49-frame 0→100% fill, white bar/text on transparency). Replaces the old
	// two-frame `progressBar` sheet, whose slot was filled by hand-drawn Rectangles. Preloaded with
	// the studio logo so the loading screen can paint before anything else streams in, and stepped
	// by real download progress rather than autoplayed — see LoadingScreen.svelte.
	loadingBarAnim: {
		type: 'spriteSheet',
		src: './assets/sprites/loadingBarAnim/loading_bar.json?v=20260730',
	},
	transition: {
		type: 'spine',
		src: {
			atlas: './assets/spines/transition/transition.atlas',
			skeleton: './assets/spines/transition/transition.json',
			scale: 2,
		},
	},
	coins: {
		type: 'spriteSheet',
		src: './assets/sprites/coin/SD2_Coin.json?v=20260624',
	},
	sound: {
		type: 'audio',
		src: './assets/audio/sounds.json?v=20260730n',
	},
} as const;

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Load tiers. Every entry above is UNFLAGGED by default, which means it belongs to the gating
// pass: it downloads on the loading screen and the progress bar counts it. That default is the
// point — previously all 136 entries carried `preload: true`, which is a different tier entirely
// (it blocks before the game tree mounts AND before the progress bar starts counting), so players
// watched a frozen 0% bar through ~62MB and only saw motion over the last few files.
//
//   preload      – needed to DRAW the loading screen itself. Keep this list tiny.
//   (unflagged)  – base-game art. Gates `loaded`; the bar reflects it honestly.
//   defer        – loads in the background after `loaded`; safe only for art that cannot be
//                  drawn immediately (here: the layout the player did not start in).
//   deferDemand  – withheld until game code calls loadDemandAssets(); see game/utils.ts.
// ─────────────────────────────────────────────────────────────────────────────────────────────

type AssetFlags = { preload?: boolean; defer?: boolean; deferDemand?: boolean };
const flag = (keys: readonly string[], prop: keyof AssetFlags) => {
	for (const key of keys) {
		const entry = (assets as Record<string, AssetFlags | undefined>)[key];
		if (entry) entry[prop] = true;
	}
};

// The loading screen draws exactly these two, so they must exist before it renders.
flag(['loadingBarAnim', 'pressPlayLogo'], 'preload');

// Bonus-only art: a session that never enters a bonus never draws any of it, so it is withheld
// from the gating pass and from the background stream, and loaded when a book that will draw it
// arrives. game/utils.ts gates the drawing events (freeSpinTrigger / freeSpinEnd /
// createBonusSnapshot) on loadDemandAssets(), which covers every entry path — natural scatter, a
// bought DROP-O-MAGNET / MEGA CHAIN round, an activated FEATURE round, and a resumed round.
flag(
	[
		'bgBonus', 'bgSuper', 'bgMobileBonus', 'bgMobileSuper',
		'fsPanel', 'popupMagnet', 'popupMagnetAnim', 'pressArrow',
		'fsIntro', 'transition', 'counterFrame',
	],
	'deferDemand',
);

// Layout-specific art: only the set matching the INITIAL viewport gates playability; the other
// layout's set is demoted to the background pass, so a later rotate/resize still works — worst
// case the alternate art streams in a moment after the rotate. Mirrors layoutType() in
// utils-layout/createLayout.svelte.ts (portrait = ratio <= 0.8; landscape = short side <= 480).
//
// NOTE: the desktop symbol tiles are deliberately NOT in DESKTOP_ONLY_KEYS. MOBILE_STATIC_KEYS /
// MOBILE_WIN_KEYS in game/utils.ts are Partial records that fall back to the desktop key, so the
// desktop set has to be present in every layout.
const MOBILE_ONLY_KEYS: readonly string[] = [
	'bgMobileBase', 'boardPadMobile', 'boardPadLand', 'smallPadMobile',
	'capsuleTubeAnimMobile', 'capsuleTubeGlass', 'capsuleCrackle',
	// Portrait symbol art
	'aTileMobile', 'aWinTileMobile', 'kTileMobile', 'kWinTileMobile',
	'qTileMobile', 'qWinTileMobile', 'squirrelTileMobile',
	'foxTileMobile', 'foxWinTileMobile', 'wolfTileMobile', 'wolfWinTileMobile',
	'bearTileMobile', 'bearWinTileMobile', 'rabbitTileMobile', 'rabbitWinTileMobile',
	'wildTileMobile', 'wildWinTileMobile',
	'wild2xTileMobile', 'wild3xTileMobile', 'wild4xTileMobile', 'wild5xTileMobile',
	'wild7xTileMobile', 'wild9xTileMobile', 'wild10xTileMobile',
	'scatterCustomMobile', 'scatterWinMobile',
	// Mobile-landscape symbol art
	'foxTileLand', 'foxWinTileLand', 'wolfTileLand', 'wolfWinTileLand',
	'bearTileLand', 'bearWinTileLand', 'rabbitTileLand', 'rabbitWinTileLand',
	'squirrelTileLand', 'squirrelWinTileLand',
	'aTileLand', 'aWinTileLand', 'kTileLand', 'kWinTileLand', 'qTileLand', 'qWinTileLand',
	'wildTileLand', 'scatterTileLand',
	'wild2xTileLand', 'wild3xTileLand', 'wild4xTileLand', 'wild5xTileLand',
	'wild7xTileLand', 'wild9xTileLand', 'wild10xTileLand',
];
// CapsulePanel renders only when layoutType is neither portrait nor landscape, and BoardFrame
// picks boardPad only on desktop — so these three are genuinely unreachable on a phone.
const DESKTOP_ONLY_KEYS: readonly string[] = [
	// capsuleTubeShell is NOT here any more: LandscapeCapsule now draws the same static shell plus
	// procedural bolts as the desktop capsule, so deferring it on mobile would leave that tube empty.
	'boardPad',
];

if (typeof window !== 'undefined') {
	const w = window.innerWidth;
	const h = window.innerHeight;
	const isMobileLayout = w / (h || 1) <= 0.8 || Math.min(w, h) <= 480;
	flag(isMobileLayout ? DESKTOP_ONLY_KEYS : MOBILE_ONLY_KEYS, 'defer');
}

export default assets;
