const assets = {
	bgBase: {
		type: 'sprite',
		src: './assets/components/backgrounds/bg_base.webp?v=20260806'
	},
	// Version2 bonus rooms (Figma 7022:7043 DROP-O-MAGNET / 7022:7044 ALL IN): the same workshop as
	// the base background, lit purple and green. Blur is BAKED IN like bg_base so the board reads
	// against them, and the old 483KB/635KB jpgs are gone (34KB/39KB now).
	bgBonus: {
		type: 'sprite',
		src: './assets/components/backgrounds/bg_bonus.webp?v=20260807b'
	},
	bgSuper: {
		type: 'sprite',
		src: './assets/components/backgrounds/bg_super.webp?v=20260807b'
	},
	// Portrait (mobile) backgrounds — tall corridor art, swapped in when layoutType is 'portrait'.
	bgMobileBase: {
		type: 'sprite',
		src: './assets/components/backgrounds/bg_mobile_base.webp?v=20260806'
	},
	bgMobileBonus: {
		type: 'sprite',
		src: './assets/components/backgrounds/bg_mobile_bonus.webp?v=20260807b'
	},
	bgMobileSuper: {
		type: 'sprite',
		src: './assets/components/backgrounds/bg_mobile_super.webp?v=20260807b'
	},
	// Portrait board frame + horizontal capsule tube + small pad (ALL WINS / FREE SPINS boxes).
	boardPadMobile: {
		type: 'sprite',
		src: './assets/components/frames/board_pad.webp?v=20260806'
	},
	// Landscape (mobile horizontal) board frame.
	boardPadLand: {
		type: 'sprite',
		src: './assets/components/frames/board_pad.webp?v=20260806'
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
	// Version2 left-rail info box (RESPIN / FREE SPINS / TOTAL WIN) — steel frame with chamfered
	// corners over a navy gradient — the REAL design art, extracted from Figma node 7002:11384.
	infoBox: {
		type: 'sprite',
		src: './assets/components/frames/info_box.webp?v=20260807e'
	},
	// Desktop tesla capsule housing. This is the per-pixel MEDIAN of the original 30-frame baked
	// flipbook: the source video has sub-pixel camera wobble, so playing the whole capsule as a
	// flipbook drifted the metal ~1px frame to frame, while the median rejects the moving lightning
	// and leaves the housing perfectly still. The lightning itself is drawn procedurally by
	// CapsuleBolts.svelte, so no animation sheet ships for desktop at all (804KB -> 29KB).
	// Regenerate with scripts/split-capsule-shell.py, which needs the original flipbook — deleted
	// from the tree once the bolts went procedural, but recoverable via
	// `git show <rev>:apps/magnetic/static/assets/sprites/capsuleTube/capsule_tube_anim.webp`.
	// Version2 redesign: the desktop tube shell is now the splash pillar machine (Figma 2503:7839
	// right rail) — same slot in CapsulePanel/LandscapeCapsule, new art.
	capsuleTubeShell: {
		type: 'sprite',
		src: './assets/components/splash/pillar.webp?v=20260806'
	},
	// Fine branching filaments extracted from the tube's original baked art — drawn additively
	// inside the glass and flickered for a live crackle web around the central bolt.
	capsuleCrackle: {
		type: 'sprite',
		src: './assets/components/ui/capsule_crackle.webp?v=20260709b'
	},
	// Horizontal capsule bar for the portrait top row — the always-on tube the combining symbol sits
	// in, with live lightning drawn over its glass. Version2 art (2026-08-10): the painted cartoon
	// tube that matches the rest of the game, replacing the photoreal black drums; keyed off its
	// black background by scratchpad/tube_v2/build_tube.py and shipped TRIMMED (1400x553), so its
	// aspect IS the visible art's — see TUBE_ASPECT in PortraitTopBar.
	capsuleTubeGlass: {
		type: 'sprite',
		src: './assets/components/ui/magnetic_tube_v2.webp'
	},
	// Backdrop for BOTH congratulations screens (Version2, Figma 7022-6844 / 7069-9311). Cropped
	// straight out of the artist's source PNG, which already carries real alpha — no keying, and
	// no purple arcs: the design mock composites those from a separate layer and the user asked for
	// the clean frame. 2048x1162.
	fsWonFrame: {
		type: 'sprite',
		src: './assets/components/ui/fs_won_frame.webp?v=20260807b'
	},
	boardPad: {
		type: 'sprite',
		src: './assets/components/frames/board_pad.webp?v=20260806'
	},
	// Per-cell boxes: a stationary 7x7 grid of these sits behind the rolling symbols. Winning cells
	// swap to the win-state box.
	cellBox: {
		type: 'sprite',
		src: './assets/components/frames/cell_box.webp?v=20260811'
	},
	cellBoxWin: {
		type: 'sprite',
		src: './assets/components/frames/cell_box_win.webp?v=20260807'
	},
	symbolPad: {
		type: 'sprite',
		src: './assets/components/frames/symbol_pad.webp?v=20260625'
	},
	counterFrame: {
		type: 'sprite',
		src: './assets/components/ui/confirm_frame.webp?v=20260625'
	},
	magneticLogo: {
		type: 'sprite',
		src: './assets/components/splash/logo_plate.webp?v=20260806'
	},
	pressPlayLogo: {
		type: 'sprite',
		src: './assets/components/ui/press_play_logo.webp?v=20260709'
	},
	// Win-state flipbook sheets are gone: winning cells now play the procedural <SymbolWinFx>
	// choreography over the hi-res static win art. The 9–10 frame sheets looped at ~14fps with no
	// real object motion — the Stake review's "poor animations".
	aTile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/nut.webp?v=20260806' },
	aWinTile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/nut.webp?v=20260806' },
	aTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/nut_mobile.webp?v=20260806' },
	aWinTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/nut_mobile.webp?v=20260806' },
	kTile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/coil.webp?v=20260812' },
	kWinTile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/coil.webp?v=20260812' },
	kTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/coil_mobile.webp?v=20260812' },
	kWinTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/coil_mobile.webp?v=20260812' },
	qTile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/energy_screw.webp?v=20260806' },
	qWinTile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/energy_screw.webp?v=20260806' },
	qTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/energy_screw_mobile.webp?v=20260806' },
	qWinTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/energy_screw_mobile.webp?v=20260806' },
	wildTile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild.webp?v=20260806' },
	wildWinTile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild.webp?v=20260806' },
	wildTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_mobile.webp?v=20260806' },
	wildWinTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_mobile.webp?v=20260806' },
	wild2xTile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x2.webp?v=20260806' },
	wild3xTile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x3.webp?v=20260806' },
	wild4xTile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x4.webp?v=20260806' },
	wild5xTile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x5.webp?v=20260806' },
	wild7xTile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x7.webp?v=20260806' },
	wild9xTile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x9.webp?v=20260806' },
	wild10xTile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x10.webp?v=20260806' },
	wild2xTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x2_mobile.webp?v=20260806' },
	wild3xTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x3_mobile.webp?v=20260806' },
	wild4xTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x4_mobile.webp?v=20260806' },
	wild5xTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x5_mobile.webp?v=20260806' },
	wild7xTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x7_mobile.webp?v=20260806' },
	wild9xTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x9_mobile.webp?v=20260806' },
	wild10xTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x10_mobile.webp?v=20260806' },
	// Radial electric burst played BEHIND every stacked (locked) symbol. 10 independent bursts
	// rather than a rendered animation, so the cycle is a crackle, not motion — order carries no
	// meaning. Regenerate with scripts/build-stack-zap-sheet.py <src-dir>.
	scatterCustom: { type: 'sprite', src: './assets/components/symbols/magnetic/special/scatter.webp?v=20260806' },
	scatterWin: { type: 'sprite', src: './assets/components/symbols/magnetic/special/scatter.webp?v=20260806' },
	scatterCustomMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/scatter_mobile.webp?v=20260806' },
	scatterWinMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/special/scatter_mobile.webp?v=20260806' },
	foxTile:      { type: 'sprite', src: './assets/components/symbols/magnetic/premium/horseshoe.webp?v=20260806' },
	wolfTile:     { type: 'sprite', src: './assets/components/symbols/magnetic/premium/lightning.webp?v=20260812' },
	bearTile:     { type: 'sprite', src: './assets/components/symbols/magnetic/premium/magnetic_core_cube.webp?v=20260806' },
	rabbitTile:   { type: 'sprite', src: './assets/components/symbols/magnetic/premium/electromagnetic_device.webp?v=20260806' },
	magnetTile:   { type: 'sprite', src: './assets/components/ui/magnet_win.webp?v=20260709' },
	squirrelTile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/bolt.webp?v=20260806' },
	squirrelTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/bolt_mobile.webp?v=20260806' },
	// The battery's WIN variant on the mobile sheet. It was the one hole in the base/Mobile/Land
	// matrix: utils.ts SYMBOL_WIN_ASSET_MOBILE maps L1 -> 'squirrelWinTileMobile', so in portrait a
	// winning battery resolved to an undefined key and the cell simply drew nothing.
	squirrelWinTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/bolt_mobile.webp?v=20260806' },
	// Premium mobile (portrait) symbol art.
	foxTileMobile:       { type: 'sprite', src: './assets/components/symbols/magnetic/premium/horseshoe_mobile.webp?v=20260806' },
	foxWinTileMobile:    { type: 'sprite', src: './assets/components/symbols/magnetic/premium/horseshoe_mobile.webp?v=20260806' },
	wolfTileMobile:      { type: 'sprite', src: './assets/components/symbols/magnetic/premium/lightning_mobile.webp?v=20260812' },
	wolfWinTileMobile:   { type: 'sprite', src: './assets/components/symbols/magnetic/premium/lightning_mobile.webp?v=20260812' },
	bearTileMobile:      { type: 'sprite', src: './assets/components/symbols/magnetic/premium/magnetic_core_cube_mobile.webp?v=20260806' },
	bearWinTileMobile:   { type: 'sprite', src: './assets/components/symbols/magnetic/premium/magnetic_core_cube_mobile.webp?v=20260806' },
	rabbitTileMobile:    { type: 'sprite', src: './assets/components/symbols/magnetic/premium/electromagnetic_device_mobile.webp?v=20260806' },
	rabbitWinTileMobile: { type: 'sprite', src: './assets/components/symbols/magnetic/premium/electromagnetic_device_mobile.webp?v=20260806' },
	// Landscape (mobile horizontal) symbol art.
	foxTileLand:       { type: 'sprite', src: './assets/components/symbols/magnetic/premium/horseshoe.webp?v=20260806' },
	foxWinTileLand:    { type: 'sprite', src: './assets/components/symbols/magnetic/premium/horseshoe.webp?v=20260806' },
	wolfTileLand:      { type: 'sprite', src: './assets/components/symbols/magnetic/premium/lightning.webp?v=20260812' },
	wolfWinTileLand:   { type: 'sprite', src: './assets/components/symbols/magnetic/premium/lightning.webp?v=20260812' },
	bearTileLand:      { type: 'sprite', src: './assets/components/symbols/magnetic/premium/magnetic_core_cube.webp?v=20260806' },
	bearWinTileLand:   { type: 'sprite', src: './assets/components/symbols/magnetic/premium/magnetic_core_cube.webp?v=20260806' },
	rabbitTileLand:    { type: 'sprite', src: './assets/components/symbols/magnetic/premium/electromagnetic_device.webp?v=20260806' },
	rabbitWinTileLand: { type: 'sprite', src: './assets/components/symbols/magnetic/premium/electromagnetic_device.webp?v=20260806' },
	squirrelTileLand:    { type: 'sprite', src: './assets/components/symbols/magnetic/low/bolt.webp?v=20260806' },
	squirrelWinTileLand: { type: 'sprite', src: './assets/components/symbols/magnetic/low/bolt.webp?v=20260806' },
	aTileLand:    { type: 'sprite', src: './assets/components/symbols/magnetic/low/nut.webp?v=20260806' },
	aWinTileLand: { type: 'sprite', src: './assets/components/symbols/magnetic/low/nut.webp?v=20260806' },
	kTileLand:    { type: 'sprite', src: './assets/components/symbols/magnetic/low/coil.webp?v=20260812' },
	kWinTileLand: { type: 'sprite', src: './assets/components/symbols/magnetic/low/coil.webp?v=20260812' },
	qTileLand:    { type: 'sprite', src: './assets/components/symbols/magnetic/low/energy_screw.webp?v=20260806' },
	qWinTileLand: { type: 'sprite', src: './assets/components/symbols/magnetic/low/energy_screw.webp?v=20260806' },
	wildTileLand:    { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild.webp?v=20260806' },
	scatterTileLand: { type: 'sprite', src: './assets/components/symbols/magnetic/special/scatter.webp?v=20260806' },
	wild2xTileLand:  { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x2.webp?v=20260806' },
	wild3xTileLand:  { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x3.webp?v=20260806' },
	wild4xTileLand:  { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x4.webp?v=20260806' },
	wild5xTileLand:  { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x5.webp?v=20260806' },
	wild7xTileLand:  { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x7.webp?v=20260806' },
	wild9xTileLand:  { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x9.webp?v=20260806' },
	wild10xTileLand: { type: 'sprite', src: './assets/components/symbols/magnetic/special/wild_x10.webp?v=20260806' },
	foxWinTile: { type: 'sprite', src: './assets/components/symbols/magnetic/premium/horseshoe.webp?v=20260806' },
	wolfWinTile: { type: 'sprite', src: './assets/components/symbols/magnetic/premium/lightning.webp?v=20260812' },
	bearWinTile: { type: 'sprite', src: './assets/components/symbols/magnetic/premium/magnetic_core_cube.webp?v=20260806' },
	rabbitWinTile: { type: 'sprite', src: './assets/components/symbols/magnetic/premium/electromagnetic_device.webp?v=20260806' },
	magnetWinTile: { type: 'sprite', src: './assets/components/ui/magnet_win.webp?v=20260709' },
	squirrelWinTile: { type: 'sprite', src: './assets/components/symbols/magnetic/low/bolt.webp?v=20260806' },
	// Win boards — preloaded so board escalation during count-up doesn't stall
	// Version2 SWEET WIN sign (Figma 7022:7751) — ships as parts; WinSign.svelte assembles them
	// (pillars fly in from the sides, magnet drops, title rises) with landing impacts.
	winSignPlate:     { type: 'sprite', src: './assets/components/win_boards/sign_plate.webp?v=20260812' },
	winSignPillarL:   { type: 'sprite', src: './assets/components/win_boards/sign_pillar_left.webp?v=20260812' },
	winSignPillarR:   { type: 'sprite', src: './assets/components/win_boards/sign_pillar_right.webp?v=20260812' },
	winSignMagnet:    { type: 'sprite', src: './assets/components/win_boards/sign_magnet.webp?v=20260812' },
	winSignTextSweet: { type: 'sprite', src: './assets/components/win_boards/sign_text_sweet.webp?v=20260812' },
	// EPIC WIN parts (Figma 7022:8274) — its own plate/pillar/magnet art (looping pipes).
	winSignEpicPlate:   { type: 'sprite', src: './assets/components/win_boards/sign_epic_plate.webp?v=20260812' },
	winSignEpicPillarL: { type: 'sprite', src: './assets/components/win_boards/sign_epic_pillar_left.webp?v=20260812' },
	winSignEpicPillarR: { type: 'sprite', src: './assets/components/win_boards/sign_epic_pillar_right.webp?v=20260812' },
	winSignEpicMagnet:  { type: 'sprite', src: './assets/components/win_boards/sign_epic_magnet.webp?v=20260812' },
	winSignTextEpic:    { type: 'sprite', src: './assets/components/win_boards/sign_text_epic.webp?v=20260812' },
	// MYTHIC WIN parts (Figma 4007:1743) — neon-tube pillars, two-line magenta neon title.
	winSignMythicPlate:   { type: 'sprite', src: './assets/components/win_boards/sign_mythic_plate.webp?v=20260812' },
	winSignMythicPillarL: { type: 'sprite', src: './assets/components/win_boards/sign_mythic_pillar_left.webp?v=20260812' },
	winSignMythicPillarR: { type: 'sprite', src: './assets/components/win_boards/sign_mythic_pillar_right.webp?v=20260812' },
	winSignMythicMagnet:  { type: 'sprite', src: './assets/components/win_boards/sign_mythic_magnet.webp?v=20260812' },
	winSignTextMythic:    { type: 'sprite', src: './assets/components/win_boards/sign_text_mythic.webp?v=20260812' },
	// LEGENDARY WIN parts (Figma 7022:8095) — twin-capsule pillars, gold flame title.
	winSignLegendPlate:   { type: 'sprite', src: './assets/components/win_boards/sign_legend_plate.webp?v=20260810' },
	winSignLegendPillarL: { type: 'sprite', src: './assets/components/win_boards/sign_legend_pillar_left.webp?v=20260810' },
	winSignLegendPillarR: { type: 'sprite', src: './assets/components/win_boards/sign_legend_pillar_right.webp?v=20260810' },
	winSignLegendMagnet:  { type: 'sprite', src: './assets/components/win_boards/sign_legend_magnet.webp?v=20260810' },
	winSignTextLegend:    { type: 'sprite', src: './assets/components/win_boards/sign_text_legend.webp?v=20260810' },
	// WILD WIN parts (Figma 7022:7925) — green title; pillars reuse the sweet strip assets.
	winSignWildPlate:  { type: 'sprite', src: './assets/components/win_boards/sign_wild_plate.webp?v=20260812' },
	winSignWildPillarL: { type: 'sprite', src: './assets/components/win_boards/sign_wild_pillar_left.webp?v=20260812' },
	winSignWildPillarR: { type: 'sprite', src: './assets/components/win_boards/sign_wild_pillar_right.webp?v=20260812' },
	winSignWildMagnet: { type: 'sprite', src: './assets/components/win_boards/sign_wild_magnet.webp?v=20260812' },
	winSignTextWild:   { type: 'sprite', src: './assets/components/win_boards/sign_text_wild.webp?v=20260812' },
	// MAX WIN parts (Figma 7103:5231) — hazard-base pillars with a cyan neon column and a purple
	// pipe elbow, red/blue horseshoe, gold+cyan two-line title. Replaces the single baked
	// max_win_screen.webp board, which was the last tier still on the pre-Version2 art.
	winSignMaxPlate:   { type: 'sprite', src: './assets/components/win_boards/sign_max_plate.webp?v=20260811' },
	winSignMaxPillarL: { type: 'sprite', src: './assets/components/win_boards/sign_max_pillar_left.webp?v=20260811' },
	winSignMaxPillarR: { type: 'sprite', src: './assets/components/win_boards/sign_max_pillar_right.webp?v=20260811' },
	winSignMaxMagnet:  { type: 'sprite', src: './assets/components/win_boards/sign_max_magnet.webp?v=20260811' },
	winSignTextMax:    { type: 'sprite', src: './assets/components/win_boards/sign_text_max.webp?v=20260811' },
	// Stacked-cluster idle animations (Kling black-bg videos -> 36-frame/12fps looping sheets via
	// scratchpad build_stack_anims.py): a locked cell of these symbols plays its charging loop
	// instead of freezing on the static art. Frames share the static symbol's 328x264 canvas
	// geometry (at 0.75), so the AnimatedSprite is a drop-in at the static Sprite's size props.
	stackAnimH1: { type: 'spriteSheet', src: './assets/sprites/stackAnims/compass_stack.json' },
	stackAnimH2: { type: 'spriteSheet', src: './assets/sprites/stackAnims/lightning_stack.json' },
	stackAnimH3: { type: 'spriteSheet', src: './assets/sprites/stackAnims/vortex_stack.json' },
	stackAnimH4: { type: 'spriteSheet', src: './assets/sprites/stackAnims/device_stack.json' },
	stackAnimL1: { type: 'spriteSheet', src: './assets/sprites/stackAnims/battery_stack.json' },
	stackAnimL3: { type: 'spriteSheet', src: './assets/sprites/stackAnims/coil_stack_v2.json' },
	stackAnimL4: { type: 'spriteSheet', src: './assets/sprites/stackAnims/chip_stack.json' },
	silverFont: {
		type: 'font',
		src: './assets/fonts/silverFont/mm_silver.xml?v=20260611',
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

// Bonus-only art. game/utils.ts gates the drawing events (freeSpinTrigger / freeSpinEnd /
// createBonusSnapshot) on loadDemandAssets(), which covers every entry path — natural scatter, a
// bought DROP-O-MAGNET / MEGA CHAIN round, an activated FEATURE round, and a resumed round.
//
// Flagged BOTH: it streams in the background wave AND stays behind the demand gate. It used to be
// demand-only, which meant the first bonus of a session — the thing a reviewer goes looking for
// almost immediately — paid a ~720KB download before it could be drawn. Streaming it costs the
// loading screen nothing (the gating pass does not wait on it) and by the time anyone reaches a
// bonus it is already resident, so the gate resolves against the cache. The gate stays because it
// is the only hard guarantee for a player who buys a bonus before the stream finishes.
//
// Priority 2: behind the stack anims, which a cluster can need on the very first spin.
flag(
	[
		'bgBonus', 'bgSuper', 'bgMobileBonus', 'bgMobileSuper',
		'fsWonFrame',
		'transition', 'counterFrame',
	],
	'deferDemand',
);
flag(
	[
		'bgBonus', 'bgSuper', 'bgMobileBonus', 'bgMobileSuper',
		'fsWonFrame',
		'transition', 'counterFrame',
	],
	'defer',
);
for (const key of ['bgBonus', 'bgSuper', 'bgMobileBonus', 'bgMobileSuper', 'fsWonFrame', 'transition', 'counterFrame']) {
	const entry = (assets as Record<string, { deferPriority?: number } | undefined>)[key];
	if (entry) entry.deferPriority = 2;
}

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
	'capsuleTubeGlass', 'capsuleCrackle',
	// Portrait symbol art
	'aTileMobile', 'aWinTileMobile', 'kTileMobile', 'kWinTileMobile',
	'qTileMobile', 'qWinTileMobile', 'squirrelTileMobile', 'squirrelWinTileMobile',
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

// Stack anims stream in the background pass: a cluster cannot be locked before the first spin
// resolves, so they never gate playability.
flag(
	// L2 (ring magnet) has no sheet: its cluster idle is drawn procedurally (specialIdleFx).
	['stackAnimH1', 'stackAnimH2', 'stackAnimH3', 'stackAnimH4',
	 'stackAnimL1', 'stackAnimL3', 'stackAnimL4'],
	'defer',
);

if (typeof window !== 'undefined') {
	const w = window.innerWidth;
	const h = window.innerHeight;
	const isMobileLayout = w / (h || 1) <= 0.8 || Math.min(w, h) <= 480;
	flag(isMobileLayout ? DESKTOP_ONLY_KEYS : MOBILE_ONLY_KEYS, 'defer');
}

export default assets;
