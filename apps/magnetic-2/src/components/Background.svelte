<script lang="ts">
	import { Container, Graphics, Sprite } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut, cubicOut } from 'svelte/easing';

	import SkyClouds from './SkyClouds.svelte';
	import BeamSymbol from './BeamSymbol.svelte';
	import { drawUfoLamps } from '../game/ufoLamps';
	import { getContext } from '../game/context';
	import { BACKGROUND_LIGHTS } from '../game/backgroundLights';
	import { PORTRAIT_BACKGROUND_RATIO, SYMBOL_H, SYMBOL_W } from '../game/constants';
	import { BOARD_SIZES } from '../game/constants';
	import { PORTRAIT_SHIP_ART_ASPECT, PORTRAIT_SHIP_W_OF_LOGO } from '../game/stateGame.svelte';
	import type { PaySymbolName } from '../game/types';

	const props: {
		/** True once the splash is out of the way and the player is actually looking at the room —
		 *  the cue for the ship's arrival flight. */
		revealed?: boolean;
	} = $props();

	const context = getContext();
	const DESKTOP_ASPECT = 1920 / 1080;
	// Must match the art scripts/build-room-art.py emits (1242x2208), because `aspect` below sizes
	// the SPRITE — art of any other shape is stretched to it, not letterboxed. This read 1440/3200
	// while the portrait art was already 1242x2208, which squeezed every portrait room to 80% width.
	const MOBILE_ASPECT = PORTRAIT_BACKGROUND_RATIO;
	// Portrait uses the mobile (tall) backgrounds. Four rooms: the base terrace plus one sky per
	// bought bonus — Gravity Breach, Core Overload and Zero Point Protocol, which is what
	// stateGame.bonusRoom names (bonusMode cannot: the math folds the last two into 'superspin').
	// A Feature Spin leaves bonusRoom null and therefore stays outside in the base sky, which is
	// right — it is one spin of the base game, not a trip somewhere else.
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');
	const ROOM_KEY = {
		bonus: ['bgBonus', 'bgMobileBonus'],
		super: ['bgSuper', 'bgMobileSuper'],
		zero: ['bgZero', 'bgMobileZero'],
	} as const;
	const bgKey = $derived(
		context.stateGame.bonusRoom
			? ROOM_KEY[context.stateGame.bonusRoom][isPortrait ? 1 : 0]
			: isPortrait
				? 'bgMobileBase'
				: 'bgBase',
	);
	const aspect = $derived(isPortrait ? MOBILE_ASPECT : DESKTOP_ASPECT);

	// ── Room change cross-fade ──
	// bgKey flips the instant bonusMode is set, which used to swap the whole room in one frame —
	// the buy-bonus hand-off read as a glitch rather than as walking into another part of the lab.
	// The outgoing room is held underneath and the incoming one dissolves over it.
	//
	// Orientation changes are exempt: the two layouts use different art at a different aspect, so
	// cross-fading them would dissolve a portrait corridor into a landscape room mid-rotate.
	//
	// So is the way OUT of a bonus. freeSpinEnd resets bonusMode BEFORE it plays the wipe, so a
	// fade there leaves the bonus room's sky visibly hanging under the wipe for the better part of
	// a second — it read as a coloured flash after the total-win panel. Entering a bonus has
	// the opposite order (bonusMode is set after the wipe finishes), which is exactly where the
	// dissolve belongs. Hence: fade INTO a bonus room, snap back to base.
	const CROSSFADE_MS = 900;
	const isLoaded = (key: string) => !!context.stateApp.loadedAssets?.[key];
	const isBonusRoom = (key: string) => key !== 'bgBase' && key !== 'bgMobileBase';
	// '' until the first background resolves, so the initial paint is not treated as a change.
	let displayedKey = $state('');
	let outgoingKey = $state<string | null>(null);
	let lastPortrait = false;
	const fade = new Tween(1, { duration: CROSSFADE_MS, easing: cubicInOut });
	let fadeTimer = 0;

	$effect(() => {
		const next = bgKey;
		const nextPortrait = isPortrait;
		if (next === displayedKey) return;
		const first = displayedKey === '';
		const previous = displayedKey;
		const rotated = !first && nextPortrait !== lastPortrait;
		lastPortrait = nextPortrait;
		displayedKey = next;
		clearTimeout(fadeTimer);
		// Only cross-fade between rooms we can actually paint: a deferred background that has not
		// landed yet would dissolve in from an empty texture.
		if (first || rotated || !isBonusRoom(next) || !isLoaded(previous) || !isLoaded(next)) {
			outgoingKey = null;
			fade.set(1, { duration: 0 });
			return;
		}
		outgoingKey = previous;
		fade.set(0, { duration: 0 });
		fade.set(1);
		fadeTimer = setTimeout(() => (outgoingKey = null), CROSSFADE_MS + 60) as unknown as number;
	});

	$effect(() => () => clearTimeout(fadeTimer));
	// This component mounts before the gating asset pass finishes (it sits outside the loading-screen
	// branch in Game.svelte), and the portrait/landscape backgrounds are additionally deferred on the
	// layout the session did not start in. Drawing a key that isn't in loadedAssets yet logs an error
	// and paints an empty texture, so wait for it — the loading screen covers the stage meanwhile,
	// and after a rotate the previous background simply holds until the deferred one lands.
	const hasBg = $derived(!!displayedKey && isLoaded(displayedKey));
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const cover = $derived.by(() => {
		const width = canvas.width;
		const height = canvas.height;
		const canvasAspect = width / height;

		if (canvasAspect > aspect) {
			return { width, height: width / aspect };
		}

		return { width: height * aspect, height };
	});

	// Clouds drift in the DAYLIT rooms. Core Overload is the exception: its sky is a clear starlit
	// night, and these sprites are pale — lit cloud against a dark sky reads as a smear, not as
	// weather. The other three are all open sky with nothing painted in it (Zero Point has a few
	// wisps of its own, which these join). They ride the same cross-fade as the art, so entering a
	// bonus takes the weather with it.
	const skyKeys = ['bgBase', 'bgMobileBase', 'bgBonus', 'bgMobileBonus', 'bgZero', 'bgMobileZero'];
	const cloudsShown = $derived(
		hasBg && skyKeys.includes(displayedKey) && !!context.stateApp.loadedAssets?.skyCloudA,
	);

	// ── Room life ──
	// The room art is a still photograph, which is most of why the game reads as dead between spins.
	// Two things move now, both free of new assets:
	//   * a very slow BREATH on the sprite itself (a fraction of a percent of scale over ~24s), which
	//     the eye reads as air/heat rather than as a zoom;
	//   * the machines' own lamps, lit with the recipe the congratulations frame and the win-sign
	//     tubes use — a stacked-falloff halo, an irregular ballast flicker, and a hotspot drifting
	//     inside each lamp. Positions are MEASURED off the art (game/backgroundLights.ts).
	// One persistent rAF drives both, and the lamps are drawn imperatively into a captured Graphics
	// so a 60fps glow never re-renders the scene graph.
	const lights = $derived(BACKGROUND_LIGHTS[displayedKey] ?? []);
	const outgoingLights = $derived(outgoingKey ? (BACKGROUND_LIGHTS[outgoingKey] ?? []) : []);
	let clock = $state(0);
	type G = {
		destroyed: boolean;
		clear: () => void;
		roundRect: (x: number, y: number, w: number, h: number, r: number) => unknown;
		ellipse: (x: number, y: number, rx: number, ry: number) => unknown;
		poly: (points: number[]) => unknown;
		fill: (s: object) => void;
		stroke: (s: object) => void;
	};
	let lampG: G | null = null;
	// The ship runs on its own clock. The room's is deliberately throttled to ~10fps (see below),
	// which is fine for a breath but turns a tremble into a stutter.
	let shipClock = $state(0);

	const BREATH_S = 24;
	const breath = $derived(1 + 0.006 * Math.sin((clock / BREATH_S) * Math.PI * 2));

	// ── The ship ──
	// The MOTHERSHIP saucer (Figma 9148:31504), ONE sprite: glass dome, antenna ball, magenta rim
	// lamps and the emitter oval on its underside, with its own neon halo painted in. It replaced the
	// loose hull + antenna pair that scripts/build-ufo-art.py assembled; scripts/build-ufo-ship.py
	// prepares it and prints every constant below. The tractor beam is still DRAWN rather than a
	// sprite, so it can switch on, breathe, sweep and haul motes up into the hull.
	//
	// The design hangs it top-right, running off the frame edge — that column used to hold the magnet
	// capsule, which is gone with the redesign, so the ship gets it back at full size. Note WHERE
	// that is: dead centre of the room's right window, i.e. the ship is outside, in the sky.
	//
	// Everything is sized off the sprite box's WIDTH and its own aspect; the opaque saucer spans
	// 0.9984 of that box, so `w` is the saucer's width to within a pixel.
	const UFO_LANDSCAPE = {
		cx: 0.888,
		// 0.1635 hung the old hull-only box here; this sprite is taller (dome and antenna are in it),
		// so at the same centre the ball grazed the top of a 16:9 canvas. Dropped by 2% of the height.
		cy: 0.185,
		/** Ship width, as a fraction of the background. */
		w: 0.2143,
		hullAspect: 1.4112,
	};
	// PORTRAIT does not draw a ship at all — GameLogoFrame draws the whole lockup, saucer included,
	// and this box only says WHERE that saucer is so the tractor beam can hang off it.
	//
	// Two rounds got it here. The ship was first hung as a flat cover fraction and drifted away from
	// the logo across the portrait range, reading as a SECOND saucer stacked on the lockup's own one;
	// quoting it against the logo's live rect fixed that. Then the ship had to STOP MOVING: the
	// saucer portrait needs is the lockup's own (it is the only one with the alien in the dome), and
	// a saucer that flies in again and then hovers cannot also be a part of a static mark. So the
	// splash hands the assembled lockup over and it stays put (user, 2026-09-11) — which leaves this
	// as pure geometry, and the sprite, the running lights and the beacon all skipped below.
	//
	// The numbers are measured off the lockup itself by scripts/build-room-art.py and live in
	// stateGame.svelte.ts, next to the plate they are quoted against.
	const UFO_PORTRAIT = $derived.by(() => {
		const main = context.stateLayoutDerived.mainLayout();
		const scale = main.scale || 1;
		const canvasTopMain = main.height * 0.5 - canvas.height / (2 * scale);
		// The logo, in canvas px — the same main-coords → canvas conversion SplashIntro's handoff uses.
		const logoW = context.stateGameDerived.portraitLogoWidth() * scale;
		const shipCY = (context.stateGameDerived.portraitShipCY() - canvasTopMain) * scale;
		return {
			cx: 0.5,
			// Back into the fractions the arrival maths below is written in.
			cy: 0.5 + (shipCY - canvas.height * 0.5) / Math.max(1, cover.height),
			w: (PORTRAIT_SHIP_W_OF_LOGO * logoW) / Math.max(1, cover.width),
			hullAspect: PORTRAIT_SHIP_ART_ASPECT,
		};
	});
	// MOBILE LANDSCAPE (popout L and S) draws NO ship and NO beam. The design (4161:22199) has
	// neither, and there is nowhere left to put one: the board now fills 0.965 of the height and runs
	// from the rail across to the nav bar, so the sky the desktop ship hangs in is not on screen. It
	// was briefly parked in the gutter between the board and the nav; the user took that gutter away
	// with the board's new size and asked for the ship to go with it (2026-09-11).
	//
	// NOTE: this also takes the beam-delivered magnet symbol out of mobile landscape. The symbol
	// still arrives on the board — <BeamSymbol> is a child of the ship's own container, so there is
	// simply no cone to fly it in down.
	const isLandscapeMobile = $derived(context.stateLayoutDerived.layoutType() === 'landscape');
	const UFO = $derived(isPortrait ? UFO_PORTRAIT : UFO_LANDSCAPE);
	/** The emitter oval on the saucer's underside, in sprite-box fractions — the beam hangs off this. */
	// `cy`/`ry` are the oval itself, read off the sprite's centre column (ufo_ship.webp, 640x454):
	// outline 0.858-0.958 of the box height, fill 0.863-0.952. The cone leaves the oval's CENTRE,
	// drawn over the hull's underside — it used to start at the hull's edge, behind it, which read
	// as a light coming from behind the ship rather than out of its emitter (2026-09-08).
	const EMITTER_LANDSCAPE = { cx: 0.5008, cy: 0.908, w: 0.3875, ry: 0.05, bottom: 0.9669 };
	// PORTRAIT's saucer is the lockup's own (splash/logo_saucer.webp, 664x404), which paints its
	// mouth as a flat magenta trapezoid rather than a washed-out oval — different art, so its own
	// measurement. scripts/build-room-art.py prints these.
	const EMITTER_PORTRAIT = { cx: 0.4992, cy: 0.9196, w: 0.253, ry: 0.0569, bottom: 0.9777 };
	const EMITTER = $derived(isPortrait ? EMITTER_PORTRAIT : EMITTER_LANDSCAPE);
	/** The antenna ball, centre-relative box fractions — the beacon glow sits on it. */
	const BEACON = { x: -0.0012, y: -0.4074, r: 0.0488 };
	// Beam reach, in HULL widths: the design's OWN spread, its art running from the emitter's 0.0439
	// to 0.2022 of the background over 0.4757 of its height — which, against the landscape hull, is
	// 0.94 hull widths across and 1.25 hull widths long.
	//
	// Quoting it against the HULL rather than against the background is what lets portrait use the
	// same numbers: the beam then scales with the ship instead of with the canvas, so the cone keeps
	// the art's own proportions in both orientations. It was cut back to 0.132 x 0.256 of the
	// background at one point so the cone stopped at the old lab window's inner sill; restored to the
	// design's figures on request.
	const BEAM = { wOfHull: 0.9435, lenOfHull: 1.2487 };
	// PORTRAIT cannot use a hull-width reach. Its ship is the lockup's saucer, pinned to the top of
	// the screen at roughly a fifth of the landscape ship's size, while the board sits ~290 canvas px
	// below it whatever the phone — so 0.78 hull widths (~40px) ended the cone BEHIND the logo plate,
	// which is why there was no beam to see (user: "start the beam from the alien ship"). Portrait
	// therefore measures the reach to the BOARD and keeps the art's own spread, so the cone still has
	// the design's proportions; only its length is answerable to the layout.
	// 0.93 of the way from the beam mouth to the grid's top edge, which lands the pool ~10 canvas px
	// above the board — the design's own figure, measured on 4336:15793 (360x800: the pool's lower
	// edge at y 212, the board plate's top at 221). The spread that comes out of it matches too: at
	// 390x844 the cone's mouth is 0.92 of the lockup's width against the design's 0.95.
	const PORTRAIT_BEAM_REACH = 0.93;
	const boardTopY = $derived.by(() => {
		const main = context.stateLayoutDerived.mainLayout();
		const scale = main.scale || 1;
		const canvasTopMain = main.height * 0.5 - canvas.height / (2 * scale);
		const board = context.stateGameDerived.boardLayout();
		return (board.y - board.height * 0.5 * board.boardScale - canvasTopMain) * scale;
	});

	const shipLoaded = $derived(!!context.stateApp.loadedAssets?.ufoShip);
	// Both orientations now. It used to be landscape-only, back when portrait cropped into an
	// interior room with no window for the ship to hang in; the mobile design (4336:15793) puts it
	// top-centre over the logo, which is where UFO_PORTRAIT hangs it.
	const shipShown = $derived(shipLoaded && hasBg && !isLandscapeMobile);

	const hullW = $derived(UFO.w * cover.width);
	const hullH = $derived(hullW / UFO.hullAspect);
	// Local coordinates inside the ship container, whose origin is the sprite's own centre.
	const hullY = 0;

	// ── Arrival ──
	// The room's first impression: the ship comes in from deep in the window's sky, tiny, growing as
	// it closes, brakes over its spot and settles into a tremble. Scale is PROJECTIVE —
	// 1/(1 + k·distance) — so it barely grows over the first half of the run and then rushes the
	// camera, which is what sells "far away"; a linear ramp just reads as a zoom. Screen position is
	// interpolated by that same growth rather than by time, so the whole thing tracks one object
	// moving in a straight line towards the viewer.
	const FAR_LANDSCAPE = { cx: 0.845, cy: 0.315, scale: 0.05 };
	// Portrait has no right-hand window to come in from: the ship parks dead centre, so it flies in
	// from further UP the same column. Coming in sideways there crosses the whole sky and reads as
	// a fly-past rather than as something arriving over the pad.
	const FAR_PORTRAIT = { cx: 0.5, cy: 0.2, scale: 0.05 };
	const FAR = $derived(isPortrait ? FAR_PORTRAIT : FAR_LANDSCAPE);
	const FLIGHT_MS = 2300;
	const FLIGHT_DELAY_MS = 220;
	const approach = new Tween(0, { duration: FLIGHT_MS, easing: cubicOut });
	let arriveTimer = 0;
	$effect(() => {
		if (!props.revealed || !shipShown) return;
		// PORTRAIT never flies. The splash has just translated the assembled lockup — saucer and all
		// — onto this exact spot, so a second arrival would be the same ship arriving twice (user,
		// 2026-09-11). It is parked the instant the hand-off lets go, and the beam takes it from
		// there.
		if (isPortrait) {
			if (!context.stateGame.logoHandoffActive) approach.set(1, { duration: 0 });
			return;
		}
		clearTimeout(arriveTimer);
		arriveTimer = setTimeout(() => approach.set(1), FLIGHT_DELAY_MS) as unknown as number;
		return () => clearTimeout(arriveTimer);
	});

	const K = $derived(1 / FAR.scale - 1);
	const shipScale = $derived(1 / (1 + K * (1 - approach.current)));
	/** 0 while it is a speck in the sky, 1 once it is parked. */
	const near = $derived((shipScale - FAR.scale) / (1 - FAR.scale));

	// Tremble. It starts as a shudder the moment the ship stops — the brake — and decays into the
	// idle vibration it keeps for the rest of the session. Frequencies are deliberately not
	// harmonically related, so the jitter never settles into a visible loop.
	//
	// Amplitudes AND frequencies were both cut hard (idle 0.0026 -> 0.0007 of the hull width, and
	// roughly a third of the old rates) because the ship read as distracting on screen. Amplitude
	// alone was not the problem: a small displacement at 37 rad/s is a buzz, and the eye catches
	// the rate long before it judges the distance. Slower and smaller together reads as a hover.
	/** 0 in portrait: the ship is part of a static mark there, so every one of the living-ship
	 *  motions below — brake, tremble, hover drift, bank — is switched off rather than scaled down.
	 *  A lockup whose saucer breathes against its own plate reads as a printing error. */
	const alive = $derived(isPortrait ? 0 : 1);
	let arrivedAt = $state<number | null>(null);
	$effect(() => {
		if (near > 0.985 && arrivedAt === null) arrivedAt = shipClock;
	});
	const brake = $derived(arrivedAt === null ? 0 : Math.exp(-(shipClock - arrivedAt) * 2.4));
	const shake = $derived(hullW * (0.0007 + 0.009 * brake) * near * alive);
	/** Where it parks. The background COVERS the canvas, so on a viewport squarer than the art the
	 *  cover is wider than the canvas and the design's column runs off the right edge — a 3:2
	 *  window lost a third of the saucer behind the win card. Keep the whole ship in shot. */
	const parkX = $derived(
		Math.min(
			canvas.width * 0.5 + (UFO.cx - 0.5) * cover.width,
			canvas.width - hullW * 0.5 - canvas.width * 0.012,
		),
	);
	const farX = $derived(canvas.width * 0.5 + (FAR.cx - 0.5) * cover.width);
	const shipX = $derived(
		farX +
			(parkX - farX) * near +
			(Math.sin(shipClock * 13.9) + 0.6 * Math.sin(shipClock * 8.9 + 2.1)) * shake +
			// A lazy sideways drift to go with the hover: a ship that only moves up and down is a lift.
			Math.sin(shipClock * 0.31 + 0.9) * cover.width * 0.006 * near * alive,
	);
	const shipY = $derived(
		canvas.height * 0.5 +
			(FAR.cy + (UFO.cy - FAR.cy) * near - 0.5) * cover.height +
			// A shallow rise over the run, so the approach curves instead of sliding up a wire.
			-Math.sin(Math.PI * near) * cover.height * 0.035 +
			Math.sin(shipClock * 11.3 + 1.7) * shake * 0.8 +
			// Idle hover, once it is parked. Two slow sines that do not divide into each other, so the
			// ship never repeats a path — one sine alone reads as a sprite on a spring.
			(Math.sin(shipClock * 0.52) * 0.011 + Math.sin(shipClock * 0.23 + 2.2) * 0.005) *
				canvas.height *
				near *
				alive,
	);
	// Banked while it closes, level once it parks, then a hair of roll in the tremble.
	const shipRotation = $derived(
		alive *
			(-0.16 * (1 - near) +
				Math.sin(shipClock * 7.2) * 0.0011 * (1 + brake * 5) * near +
				// The hover has to bank, or the saucer slides sideways dead level like a cursor.
				Math.sin(shipClock * 0.31 + 0.9 + Math.PI / 2) * 0.02 * near),
	);

	/** Seconds between grabs — the beam flares and whatever it is holding is hauled up the cone. */
	const GRAB_PERIOD = 8.5;

	// ── The symbol in the beam ──
	// While a cluster is on the board, its symbol hangs in the tractor beam: the ship is holding the
	// thing the magnet is collecting. The mobile design draws exactly this (Figma 4336:15793 puts one
	// symbol pad in the cone, under the ship), and it gives the beam something to be FOR — before
	// this it was a light with nothing in it but motes.
	//
	// `magnetTargetSymbol` is the magnet chain's symbol and is null whenever there is no chain, so
	// this appears and clears with the chain rather than needing its own bookkeeping.
	//
	// A NATURAL chain — one that formed on its own, without the magnet — locks and respins exactly
	// the same way, but the math sends `magnetTargetSymbol: null` on every one of its series updates
	// (mock-rgs resolveNaturalSequence does; the beam was empty for exactly those rounds, three
	// screenshots' worth). The ship holds the biggest chain's own symbol then.
	const beamSymbol = $derived.by((): PaySymbolName | null => {
		const target = context.stateGame.magnetTargetSymbol;
		if (target) return target;
		const series = context.stateGame.activeSeries;
		if (!series.length) return null;
		return series.reduce((a, b) => (b.lockedPositions.length > a.lockedPositions.length ? b : a))
			.symbol;
	});
	/**
	 * `enter` / `top` are positions down the cone (0 = the emitter, 1 = the cone's mouth), and
	 * `min`/`max` are the size it grows through on the way up, in BOARD CELLS.
	 *
	 * SUCTION IS A LOOP, not an arrival. The symbol enters at the cone's mouth at the size it left
	 * the board, is drawn up the beam getting BIGGER as it closes on the ship, and vanishes into the
	 * hull — and the next one is already at the mouth by then, so the beam is never empty. Two
	 * earlier cuts got this wrong: the first parked it half way down the cone at a fixed size (a
	 * thing in a light, not a thing being taken), the second let it climb once and then hold.
	 * Growing is what sells the depth — it is coming towards the ship.
	 *
	 * `fill` is the box as a fraction of the cone's width at its MOUTH — the one beam measure the
	 * saucer swap did not move (the new emitter is nearly twice as wide as the old one, so anything
	 * measured near the top doubled with it). A board-cell-sized cut was tried and thrown out: at
	 * that size it read as a symbol parked in front of the beam, not a thing being taken.
	 *
	 * It used to fade out for the first 8% and last 14% of every trip, so one screenshot in five
	 * caught an empty beam (measured across three symbols in a headless run, 2026-09-08).
	 */
	const BEAM_SYMBOL = { enter: 0.95, top: 0.16, fill: 0.176, min: 0.42, max: 1.2 };
	/** The last fraction of a trip, during which the next symbol rides in at the mouth. */
	const NEXT_IN = 0.06;
	const BEAM_SYMBOL_MS = 900;
	/** The one-off flight out of the board cell into the cone's mouth. */
	const lift = new Tween(0, { duration: BEAM_SYMBOL_MS, easing: cubicOut });
	/** Seconds per trip up the cone. */
	const SUCK_CYCLE = 3.4;
	/** `shipClock` when the loop took over from the flight — null while the flight is still running. */
	let suckT0 = $state<number | null>(null);
	$effect(() => {
		// Wait for the ship to actually be mounted: capturing against shipX/shipY/shipScale from an
		// unmounted ship locks in bad ship-relative coordinates that never get recomputed once the
		// ship does mount (flightArmed only re-arms on the null -> symbol edge, not on shipShown).
		if (beamSymbol && !flightArmed && shipShown) {
			// Board -> ship-local, because <BeamSymbol> is a child of the ship's own container.
			// The ship's rotation is a fraction of a degree of hover tilt, so it is ignored here;
			// including it would rotate the launch point by less than a pixel.
			const board = context.stateGameDerived.boardLayout();
			const at = firstTargetCell();
			if (at) {
				// Only arm once the source cell actually resolves — arming on a miss (board not yet
				// settled) would lock out every later retry for this activation and either skip the
				// flight entirely or reuse a stale `flightFrom` from a previous round.
				flightArmed = true;
				const scale = board.boardScale || 1;
				const worldX = board.x + (SYMBOL_W * (at.reel + 0.5) - BOARD_SIZES.width / 2) * scale;
				const worldY = board.y + (SYMBOL_H * (at.row + 0.5) - BOARD_SIZES.height / 2) * scale;
				const ship = shipScale || 1;
				flightFrom = {
					x: (worldX - shipX) / ship,
					y: (worldY - shipY) / ship,
					cell: (SYMBOL_W * scale) / ship,
				};
			}
		}
		if (!beamSymbol) {
			flightArmed = false;
			flightFrom = null;
		}
		lift.set(beamSymbol ? 1 : 0, beamSymbol ? undefined : { duration: 260 });
		if (!beamSymbol) {
			suckT0 = null;
			return;
		}
		// The loop takes over the moment the flight lands. `shipClock` is read inside the timer, not
		// in the effect body, so this does not re-subscribe the effect to every frame.
		suckT0 = null;
		const timer = setTimeout(() => (suckT0 = shipClock), BEAM_SYMBOL_MS);
		return () => clearTimeout(timer);
	});

	// ── Where it flies FROM ────────────────────────────────────────────────────────────────────
	// The symbol is not conjured in the beam any more: it LEAVES ITS CELL and is hauled up the cone.
	// The source is captured once, when the target symbol appears, and held for the whole flight —
	// read live it would jump between cells the moment the board re-settles under it (every cell of
	// the target symbol carries `target`, and which one comes first changes on every reveal).
	const firstTargetCell = () => {
		const name = beamSymbol;
		if (!name) return null;
		const board = context.stateGame.board;
		for (let reel = 0; reel < board.length; reel += 1) {
			const column = board[reel];
			for (let row = 0; row < column.length; row += 1) {
				// Locked cluster cells COUNT: once the chain is complete every copy of the symbol is
				// locked, and the beam still has to be seen lifting one out of the cluster.
				if (column[row]?.name === name) return { reel, row };
			}
		}
		return null;
	};
	let flightFrom = $state<{ x: number; y: number; cell: number } | null>(null);
	/** Only the null -> symbol EDGE launches a flight. The effect below reads the board, so it also
	 *  re-runs on every settle; without this the launch point would be recaptured mid-flight and the
	 *  symbol would jump back down to a cell it had already left. */
	let flightArmed = false;

	const beamAxisX = $derived((EMITTER.cx - 0.5) * hullW);
	const beamTopY = $derived(hullY - hullH / 2 + EMITTER.cy * hullH);
	const beamLen = $derived(
		isPortrait
			? Math.max(hullW, (boardTopY - (shipY + beamTopY)) * PORTRAIT_BEAM_REACH)
			: BEAM.lenOfHull * hullW,
	);
	/** How far the portrait cone spreads, as mouth width over length. The art's own is
	 *  wOfHull/lenOfHull = 0.756, and at portrait's reach that drew a cone two thirds as wide as the
	 *  lockup itself — right for the landscape ship hanging in open sky, too heavy under a mark at
	 *  the top of a phone screen (user: "a bit less wider", 2026-09-11). */
	const PORTRAIT_BEAM_SPREAD = 0.6;
	/** The cone's radius at its MOUTH. Landscape quotes it off the hull; portrait off its measured
	 *  reach, so the cone's shape is a fixed thing and only its length answers to the layout. */
	const beamMouthR = $derived(
		isPortrait ? (beamLen * PORTRAIT_BEAM_SPREAD) / 2 : (BEAM.wOfHull * hullW) / 2,
	);
	/** The cone's radius where it LEAVES the ship. Landscape takes the painted emitter oval's own
	 *  half-width; portrait cannot — its cone is short and steep, and a cone that narrow at the top
	 *  emerges from under the lockup as a thin spike where the design has a broad shaft (measured on
	 *  4336:15793: 0.405 lockup widths across at the mouth, which is 0.44 hull widths of radius).
	 *  Nothing is lost by widening it there: the mouth sits behind the plate, so the only part ever
	 *  seen is the cone below it. Taken back to 0.35 with the spread above, so the cone narrows
	 *  along its whole length rather than only at the bottom, which would have flattened its taper. */
	const beamTopR = $derived(isPortrait ? 0.35 * hullW : (EMITTER.w * hullW) / 2);
	const beamRadAt = (s: number) => beamTopR + (beamMouthR - beamTopR) * s;
	/** 0..1 through the current trip up the cone. */
	const suckU = $derived(
		suckT0 === null
			? 0
			: ((((shipClock - suckT0) % SUCK_CYCLE) + SUCK_CYCLE) % SUCK_CYCLE) / SUCK_CYCLE,
	);
	/** Where it is down the cone right now. The exponent makes it slow at the mouth and quick at the
	 *  end — a beam that has hold of something pulls harder the closer it gets. */
	const beamSymbolS = $derived(
		suckT0 === null
			? BEAM_SYMBOL.enter
			: BEAM_SYMBOL.enter + (BEAM_SYMBOL.top - BEAM_SYMBOL.enter) * suckU ** 1.5,
	);
	/** Its box is measured off the cone's mouth, once — the live growth is a scale (see
	 *  `bodyScale`), so the artwork is rasterised at one size instead of being re-fitted every
	 *  frame. */
	const beamSymbolCell = $derived(2 * beamRadAt(1) * BEAM_SYMBOL.fill);
	// Held, not parked: it sways across the cone, bobs, turns a little, and swells on the same grab
	// pulse the beam flares on — all off the ship's own clock, so nothing here keeps its own state.
	const beamGrab = $derived(
		Math.max(0, Math.sin(((shipClock % GRAB_PERIOD) / GRAB_PERIOD) * Math.PI * 1.6)) ** 8,
	);
	/** Where a symbol at position `S` down the cone is held: on the beam's own axis with a gentle
	 *  sway across it, and lifted by the ratchet and the grab flare below. */
	const holdAt = (S: number) => ({
		x: beamAxisX + Math.sin(shipClock * 0.62 + 1.1) * beamRadAt(S) * 0.12,
		y: beamTopY + beamLen * S - suck * beamSymbolCell * 0.12 - beamGrab * beamSymbolCell * 0.2,
	});
	// The RATCHET, riding on top of the long climb: hauled up quickly over the first 40% of the
	// cycle, then slipping back a little over the remaining 60% while the beam takes another bite.
	// A symmetric sine bob here would read as a hover. The grab flare adds a harder tug on top, so
	// the two pulses reinforce each other. Both are pure Y offsets: nothing here scales an axis, so
	// the artwork's shape never changes.
	const SUCK_PERIOD = 2.4;
	/** 0..1 — how far up the tug currently has it. */
	const suck = $derived.by(() => {
		const phase = (shipClock % SUCK_PERIOD) / SUCK_PERIOD;
		return phase < 0.4 ? 1 - (1 - phase / 0.4) ** 3 : (1 - (phase - 0.4) / 0.6) ** 2;
	});
	const hold = $derived(holdAt(beamSymbolS));

	// ── The flight ─────────────────────────────────────────────────────────────────────────────
	// `lift` (900ms, cubicOut) carries it from its cell to the cone's mouth. The path is not a
	// straight line: the beam BENDS it — it is pulled sideways onto the cone's axis faster than it
	// rises, so it arrives travelling up the beam rather than sliding in diagonally. That is the
	// whole read of "the ship is taking it".
	const flightT = $derived(lift.current);
	/** X snaps onto the beam axis first (t^0.65), Y trails it (t^1.35). */
	const beamSymbolX = $derived(
		flightFrom ? flightFrom.x + (hold.x - flightFrom.x) * flightT ** 0.65 : hold.x,
	);
	const beamSymbolY = $derived(
		flightFrom ? flightFrom.y + (hold.y - flightFrom.y) * flightT ** 1.35 : hold.y,
	);
	/** Size. During the flight it goes from its board cell to the loop's STARTING size, so the
	 *  hand-off is seamless; after that the loop owns it and it grows all the way up the cone. */
	const startRatio = $derived(
		flightFrom && beamSymbolCell > 0 ? flightFrom.cell / beamSymbolCell : BEAM_SYMBOL.min,
	);
	const suckScale = $derived(BEAM_SYMBOL.min + (BEAM_SYMBOL.max - BEAM_SYMBOL.min) * suckU ** 0.85);
	const bodyScale = $derived(
		suckT0 === null ? startRatio + (BEAM_SYMBOL.min - startRatio) * flightT : suckScale,
	);
	/** It dissolves into the hull over the last `NEXT_IN` of each trip. There is deliberately NO
	 *  fade-in: after the flight it is already there at full alpha, and on every later trip the
	 *  `next` copy below has already brought it in at the mouth. */
	const suckAlpha = $derived(suckT0 === null ? lift.current : Math.min(1, (1 - suckU) / NEXT_IN));
	/** The NEXT one, riding in at the cone's mouth while the current one dissolves — at the wrap it
	 *  is exactly where (and how big) the loop's symbol restarts, so the hand-over is seamless. */
	const nextAlpha = $derived(suckT0 === null ? 0 : Math.max(0, (suckU - (1 - NEXT_IN)) / NEXT_IN));
	const nextHold = $derived(holdAt(BEAM_SYMBOL.enter));
	const restSway = $derived(Math.sin(shipClock * 0.45) * 0.07);
	// Tumbles a little on the way up and settles into the resting sway.
	const beamSymbolRotation = $derived(
		restSway + (1 - flightT) * Math.sin(flightT * Math.PI * 2) * 0.3,
	);

	// ── The tractor beam ──
	// Switches on once the ship has stopped: it is the punchline of the arrival, and a beam dragged
	// across the sky during the flight would read as a searchlight rather than an abduction.
	const beamOn = new Tween(0, { duration: 620, easing: cubicOut });
	$effect(() => {
		if (arrivedAt !== null) beamOn.set(1);
	});
	// Colours sampled from the design's own beam art. BEAM_CORE is NOT from the art: the art's
	// lilac at any workable alpha lands around rgb(215,196,239) over the room's pale interior wall,
	// which is a white haze rather than a beam. Sampled down the axis of the reference the user
	// matched this against, the cone interior is rgb(148,122,216) -- a mid violet -- so the main
	// slab is filled with a colour chosen to composite TO that, and the lilac stays on the halo
	// and the rim where it belongs.
	const BEAM_CORE = 0x7d5ecb;
	const BEAM_FILL = 0xd7a1fa;
	const BEAM_RIM = 0xf1a8fa;
	const BEAM_POOL = 0xf7c0fc;
	/** The shadow shafts: the cone's own violet, deeper, so a dark shaft reads as less light rather
	 *  than as a stripe of some other colour. */
	const BEAM_SHADE = 0x4c2f9a;
	const MOTES = 16;
	// Light is not uniform in a dusty cone. SHAFTS are brighter (and a couple of darker) wedges that
	// converge on the emitter, each sliding across the cone and fading in and out on its own
	// unrelated period; BANDS roll down its length, the slowest and widest of them being the field
	// itself descending. Together with the pool's swells and the motes' spiral they are what the
	// user asked for after "too static, only lines": a beam that has volume and is doing something,
	// instead of three flat trapezoids (2026-09-08). None of them is an OUTLINE — every one is a
	// soft-edged body of light, because an outline over a beam reads as a line drawn on it.
	const SHAFTS = 8;
	/** The field's own descent — one of the BANDS now, not a row of hoops. */
	const RING_SPEED = 0.23; // cone lengths per second
	const RIPPLES = 3;
	/** The cone is drawn in two Graphics: the part BELOW the hull sprite's bottom edge behind the
	 *  hull (so a symbol riding up passes under the saucer), and the CAP above it — the mouth,
	 *  from the emitter oval down to that edge — in front, over the underside. Same geometry in
	 *  both, so the join is invisible. */
	let beamG: G | null = null;
	let beamCapG: G | null = null;

	/** A cheap deterministic 0..1 per index — the same trick the motes have always used, so every
	 *  layer here stays a pure function of the clock and survives any re-mount unchanged. */
	const hash = (i: number, salt = 0) => {
		const seed = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
		return seed - Math.floor(seed);
	};
	const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
	/** Channel-wise blend of two packed RGB colours — the pool's core burns out to white by shifting
	 *  its COLOUR through the stack rather than by laying a white disc over it, which would put an
	 *  edge back where the disc ends. */
	const mix = (a: number, b: number, k: number) => {
		const t = clamp01(k);
		const ch = (shift: number) => {
			const va = (a >> shift) & 0xff;
			const vb = (b >> shift) & 0xff;
			return Math.round(va + (vb - va) * t) << shift;
		};
		return ch(16) | ch(8) | ch(0);
	};

	const drawBeam = (g: G, t: number, part: 'back' | 'cap') => {
		g.clear();
		const on = beamOn.current;
		if (on <= 0.004 || hullW <= 0) return;
		const x0 = (EMITTER.cx - 0.5) * hullW;
		// The cone leaves the emitter oval's centre (see EMITTER).
		const y0 = hullY - hullH / 2 + EMITTER.cy * hullH;
		const rTop = beamTopR;
		const rBot = beamMouthR;
		const len = beamLen * on;
		const radAt = (s: number) => rTop + (rBot - rTop) * s;
		// Where the hull sprite's bottom edge cuts the cone. The cap owns [0, S0] and is drawn in
		// front of the hull; the back owns [S0, 1] behind it. Nothing is drawn twice.
		const S0 = clamp01((hullY + hullH / 2 - y0) / Math.max(len, 1e-6));
		const sA = part === 'cap' ? 0 : S0;
		const sB = part === 'cap' ? S0 : 1;
		if (sB - sA <= 0.0005) return;
		/** A slice of the cone between two fractions of its length, widened by `k`, clipped to this
		 *  part's range. Returns false (and draws nothing) when the slice lies outside it. */
		const slab = (a: number, b: number, k: number) => {
			a = Math.max(a, sA);
			b = Math.min(b, sB);
			if (b <= a) return false;
			const ya = y0 + len * a;
			const yb = y0 + len * b;
			const ra = radAt(a) * k;
			const rb = radAt(b) * k;
			g.poly([x0 - ra, ya, x0 + ra, ya, x0 + rb, yb, x0 - rb, yb]);
			return true;
		};
		const slabFill = (a: number, b: number, k: number, style: object) => {
			if (slab(a, b, k)) g.fill(style);
		};
		/** A wedge of the cone between two fractions of its RADIUS (-1..1), over `sStart`..`sEnd` of
		 *  its length — it converges on the emitter with the cone, which is what makes it a shaft of
		 *  the light rather than a stripe painted over it. */
		const wedgeFill = (u0: number, u1: number, style: object, sStart = 0, sEnd = 1) => {
			const a = Math.max(sA, sStart);
			const b = Math.min(sB, sEnd);
			if (b <= a) return;
			const ra = radAt(a);
			const rb = radAt(b);
			const ya = y0 + len * a;
			const yb = y0 + len * b;
			g.poly([x0 + u0 * ra, ya, x0 + u1 * ra, ya, x0 + u1 * rb, yb, x0 + u0 * rb, yb]);
			g.fill(style);
		};
		const inPart = (s: number) => s >= sA && s < sB;

		/**
		 * ── The cone must not START OR END on a straight edge ──
		 *
		 * Everything that runs the cone's length used to stop dead at s = 1 — the body slabs, the
		 * shafts, the Fresnel edges and the two rim lines — and because they all stopped at the same
		 * y, that was ONE STRAIGHT LINE right across the beam, reported three times now
		 * (2026-09-10: "still very unrealistic with these solid lines"). It is the last hard edge in
		 * here.
		 *
		 * A filled shape cannot fade along itself, so anything length-spanning is laid down as a
		 * STACK of progressively shorter, brighter copies instead: the composite is the full alpha
		 * everywhere above TAIL_FROM and ramps to nothing by the bottom, so the light dies into the
		 * pool rather than being cut off. Same trick as the pool's own falloff, along the cone
		 * instead of across it.
		 */
		const TAIL_FROM = 0.66;
		/** ...and it must not START on one either. The mouth is a straight chord across the emitter,
		 *  drawn in FRONT of the hull, so it showed as a line laid over the saucer's underside
		 *  (2026-09-10). The light ramps up out of the emitter over this much of the length instead,
		 *  which puts it at full strength just below the hull's bottom edge. */
		const HEAD_TO = 0.14;
		/**
		 * A BODY OF LIGHT, as a gradient: `steps` coaxial ellipses whose cumulative alpha follows
		 * `peak * exp(-(u/edge)^5)` — near-uniform inside, rolling off over its last quarter, all
		 * but gone at the rim. Each ring adds exactly what lifts the composite from the previous
		 * one's total to its own, and the core burns out to white by shifting the fill COLOUR
		 * through the stack rather than by laying a white disc on top, which would put an edge back
		 * where the disc ends.
		 *
		 * Both ends of the beam are this: the emitter the light leaves through and the pool it
		 * lands in. They were three and four nested flat discs, each ending in a hard rim and each
		 * flatter than the one under it, which is what kept reading as "a line in the circle"
		 * (2026-09-10).
		 */
		const lightPool = (o: {
			cx: number;
			cy: number;
			/** Radius of the OUTERMOST ring; every ring inside keeps the same rx:ry, because a body
			 *  of light seen from one angle has one foreshortening all the way through. */
			rx: number;
			ry: number;
			peak: number;
			edge: number;
			steps: number;
			/** How far the core wanders off centre; the rim does not move, or the whole thing slides. */
			drift: number;
			rim: number;
			core: number;
			/** Fraction of the radius inside which the colour starts turning towards `core`. */
			coreFrom: number;
			/** Extra alpha per ring — the pool's travelling swells ride in on this. */
			add?: (u: number) => number;
		}) => {
			let have = 0;
			for (let i = 0; i < o.steps; i++) {
				const u = 1 - i / o.steps; // 1 at the rim, down to just above 0 at the centre
				const want = o.peak * Math.exp(-((u / o.edge) ** 5));
				const step = (want - have) / Math.max(1e-3, 1 - have);
				have = want;
				const extra = o.add?.(u) ?? 0;
				if (step + extra <= 0.001) continue;
				const k = clamp01((o.coreFrom - u) / o.coreFrom) ** 1.4;
				g.ellipse(o.cx + o.drift * (1 - u), o.cy, o.rx * u, o.ry * u);
				g.fill({ color: mix(o.rim, o.core, k), alpha: (step + extra) * flare });
			}
		};
		const feathered = (
			alpha: number,
			steps: number,
			piece: (sStart: number, sEnd: number, a: number) => void,
		) => {
			if (alpha <= 0.002) return;
			// A part that lies entirely in the flat middle is one draw, not a stack of identical
			// clipped ones.
			if (sA >= HEAD_TO && sB <= TAIL_FROM) {
				piece(0, 1, alpha);
				return;
			}
			let have = 0;
			for (let i = 0; i <= steps; i++) {
				const f = i / steps;
				const want = alpha * f ** 1.4;
				const a = (want - have) / Math.max(1e-3, 1 - have);
				have = want;
				// The layers NEST — each is shorter than the last at both ends — so one stack ramps
				// the head and the tail at once for the price of one.
				if (a > 0.0015) piece(HEAD_TO * f, 1 - (1 - TAIL_FROM) * f, a);
			}
		};

		const grabPhase = (t % GRAB_PERIOD) / GRAB_PERIOD;
		const grab = Math.max(0, Math.sin(grabPhase * Math.PI * 1.6)) ** 8;
		// The source itself is never dead steady: a slow swell, plus two fast shimmers on unrelated
		// rates that are small enough to be felt rather than seen — a lamp, not a painted shape.
		const flicker = 1 + 0.03 * Math.sin(t * 23.1) + 0.02 * Math.sin(t * 37.7 + 1.3);
		const flare = (0.86 + 0.14 * Math.sin(t * 1.7) + 0.45 * grab) * on * flicker;

		// ── Body ──
		// Haze outside the cone, two soft steps, then the slab, then the axis lifted towards the
		// pool colour in nested steps so the cross-section falls off from a bright centre to the
		// edges instead of being one flat tint. The lift is split down the cone's length and
		// weakened towards the pool, so the light is strongest where it leaves the emitter.
		for (const [k, color, alpha] of [
			[1.45 + 0.06 * grab, BEAM_FILL, 0.05],
			[1.2 + 0.05 * grab, BEAM_FILL, 0.09],
			[1, BEAM_CORE, 0.58],
		] as const) {
			feathered(alpha * flare, 9, (sStart, sEnd, a) =>
				slabFill(sStart, sEnd, k, { color, alpha: a }),
			);
		}
		// Ten segments rather than six: the lift's own falloff now has to reach zero inside the
		// tail, and six made that ramp coarse enough to see as steps.
		const SEGMENTS = 10;
		for (const [k, a] of [
			[0.78, 0.06],
			[0.55, 0.07],
			[0.32, 0.08],
		] as const) {
			for (let i = 0; i < SEGMENTS; i++) {
				const s0 = i / SEGMENTS;
				const mid = s0 + 0.5 / SEGMENTS;
				const falloff =
					(1 - 0.5 * mid) *
					clamp01((1 - mid) / (1 - TAIL_FROM)) ** 1.2 *
					clamp01(mid / HEAD_TO) ** 1.2;
				if (falloff <= 0.002) continue;
				slabFill(s0, (i + 1) / SEGMENTS, k, { color: BEAM_POOL, alpha: a * falloff * flare });
			}
		}
		// Just inside each edge the light bunches up — the Fresnel brightening a glass cone shows —
		// which is what gives the rim lines a body to sit on instead of floating over the tint.
		for (const side of [-1, 1]) {
			for (const [u, alpha] of [
				[0.84, 0.1],
				[0.93, 0.12],
			] as const) {
				feathered(alpha * flare, 3, (sStart, sEnd, a) =>
					wedgeFill(side * u, side * 1.0, { color: BEAM_FILL, alpha: a }, sStart, sEnd),
				);
			}
		}

		// ── Shafts ──
		// Each one is a wedge that slides across the cone and breathes in and out on periods that do
		// not divide into each other. Two of them are darker: a beam through dust has shadows in it.
		for (let i = 0; i < SHAFTS; i++) {
			const j = hash(i, 1);
			const shade = i % 4 === 3;
			const u = Math.sin(t * (0.09 + 0.08 * j) + i * 1.9) * 0.72;
			const w = shade ? 0.05 + 0.05 * j : 0.03 + 0.06 * j;
			const glow = (0.5 + 0.5 * Math.sin(t * (0.45 + 0.55 * j) + i * 2.3)) ** 2;
			feathered((shade ? 0.14 : 0.11) * glow * flare, 3, (sStart, sEnd, a) =>
				wedgeFill(u - w, u + w, { color: shade ? BEAM_SHADE : BEAM_POOL, alpha: a }, sStart, sEnd),
			);
		}

		// ── Rim ──
		// Bright edges. The art has them, and without them the cone has no shape against a lit wall.
		// Each side flickers on its own phase, so the two never pulse as a pair.
		const rim = Math.max(2, hullW * 0.015);
		/** The rim over `sStart`..`sEnd`; `out` widens it outward for the bloom. */
		const rimPoly = (side: number, sStart: number, sEnd: number, inset: number, out: number) => {
			const a = Math.max(sA, sStart);
			const b = Math.min(sB, sEnd);
			if (b <= a) return false;
			const rA2 = radAt(a);
			const rB = radAt(b);
			const yA = y0 + len * a;
			const yB = y0 + len * b;
			g.poly([
				x0 + side * rA2 + side * inset,
				yA,
				x0 + side * rA2 + side * out,
				yA,
				x0 + side * rB + side * out,
				yB,
				x0 + side * rB + side * inset,
				yB,
			]);
			return true;
		};
		for (const side of [-1, 1]) {
			const rimLevel = 0.9 + 0.1 * Math.sin(t * 5.3 + side * 1.2) * Math.sin(t * 2.1);
			// The brightest thing in the whole cone, and it used to start and stop dead — the two
			// pink lines beginning on the saucer's underside and ending mid-air were half of what
			// read as the straight cuts at either end.
			feathered(0.9 * rimLevel * flare, 7, (sStart, sEnd, a) => {
				if (rimPoly(side, sStart, sEnd, -rim / 2, rim / 2)) {
					g.fill({ color: BEAM_RIM, alpha: a });
				}
			});
			// A soft glow outside the line, so the edge has a bloom rather than a hard cut-off.
			feathered(0.2 * rimLevel * flare, 5, (sStart, sEnd, a) => {
				if (rimPoly(side, sStart, sEnd, -rim * 0.5, rim * 2.2)) {
					g.fill({ color: BEAM_RIM, alpha: a });
				}
			});
		}

		// ── Bands ──
		// Light rolling down the cone: three pulses on different speeds and widths, each with a soft
		// leading and trailing edge, so they overtake each other rather than ticking past in step.
		// The last of them is the FIELD: what used to be three horizontal hoops running down the cone.
		// A hoop is an ellipse OUTLINE, and an outline over a soft beam is a drawn line however
		// gently it is stroked — reported twice (2026-09-10). The same descent reads correctly as a
		// wide, faint swell of light travelling down, which is what the slab bands already are.
		for (const [speed, width, alpha, cycle, offset] of [
			[0.33, 0.16, 0.14, 1.35, 0],
			[0.19, 0.07, 0.1, 1.2, 0.5],
			[0.55, 0.045, 0.13, 1.7, 0.25],
			[RING_SPEED, 0.3, 0.1, 1, 0.15],
		] as const) {
			const scan = (t * speed + offset) % cycle;
			if (scan >= 1) continue;
			// FEATHERED, not two steps. A slab has a straight top and bottom, and a straight edge
			// across a soft beam is another drawn line; four nested slabs, none of them anywhere
			// near opaque, ramp the band's brightness up and back down instead of stepping it.
			// A band dies out with the rest of the cone as it reaches the bottom, or its own clamped
			// trailing edge would land on the tail as a straight line of its own.
			const depth = clamp01((1 - scan) / (1 - TAIL_FROM)) ** 1.2 * clamp01(scan / HEAD_TO) ** 1.2;
			for (const [k, a] of [
				[2.6, 0.16],
				[1.9, 0.2],
				[1.4, 0.24],
				[1, 0.28],
			] as const) {
				slabFill(clamp01(scan - width * 0.6 * k), clamp01(scan + width * 1.6 * k), 0.98, {
					color: BEAM_POOL,
					alpha: alpha * a * depth * on,
				});
			}
		}

		if (part === 'cap') {
			// ── The emitter ──
			// The oval on the underside is what the light comes out of, so it is lit — and it is the
			// SAME kind of thing as the pool at the other end, so it is drawn the same way. It used
			// to be three nested discs (a bloom at 1.3x1.6, the oval at 1x1, a hot centre at
			// 0.62x0.6): three hard rims, and three different foreshortenings, so the hot centre sat
			// on the oval like a separate flatter blob instead of being its middle.
			const ry = EMITTER.ry * hullH;
			lightPool({
				cx: x0,
				cy: y0,
				rx: rTop * 1.4,
				ry: ry * 1.4,
				peak: 0.62, // what the three discs composited to at the centre
				edge: 0.66,
				steps: 24,
				drift: Math.sin(t * 0.9) * rTop * 0.05,
				rim: BEAM_FILL,
				core: 0xffffff,
				coreFrom: 0.5,
			});
			return;
		}

		// ── Pool ──
		// The pool it throws on whatever is under it, breathing with the source, with ripples
		// spreading out across the ground from where the axis lands.
		//
		// ONE pool with a smooth falloff, not four nested discs. The four each ended in a hard
		// edge, and the bright one's edge read as a LINE DRAWN INSIDE THE CIRCLE (reported
		// 2026-09-10) — worse because each disc was flatter than the one under it (0.33 -> 0.26 ->
		// 0.17 -> 0.075), so the middle looked like a separate squashed blob instead of the centre
		// of the same pool. Light on a flat floor keeps ONE foreshortening (the hoops' 0.26) all
		// the way in; only its brightness changes.
		//
		// A flat fill cannot carry a gradient, so the falloff is stacked out of POOL_STEPS coaxial
		// ellipses. Their alphas are not guessed: `want` is the cumulative alpha the pool should
		// have at that radius, and each step contributes exactly what lifts the composite from the
		// previous ring's total to its own.
		//
		// The profile is a FLAT TOP with a penumbra, not a dome. A dome (the first cut) has no
		// radius you can point at, so the pool stopped reading as a pool at all — "the circle was
		// ok just it should have been more realistic" (2026-09-10) — and it also stopped covering
		// the cone's own flat bottom cut, which then showed as a straight edge across the beam.
		// A real pool of light is near-uniform inside and rolls off over its last quarter, which is
		// what exp(-(u/POOL_EDGE)^5) is: 0.85 of full at half radius, 0.37 at POOL_EDGE, and all
		// but gone by the rim — a pool with a definite size whose edge is still soft everywhere.
		const POOL_STEPS = 44;
		const POOL_PEAK = 0.76; // what the four discs composited to at the centre
		/** Where the penumbra sits, as a fraction of the drawn radius. */
		const POOL_EDGE = 0.72;
		const poolBreath = 1 + 0.025 * Math.sin(t * 2.1) + 0.04 * grab;
		const poolR = rBot * 1.25 * poolBreath;
		/** The core wanders a little; the rim does not, or the whole pool would slide. */
		const poolDrift = Math.sin(t * 0.9) * rBot * 0.04;
		/**
		 * Swells running out across the floor. They are not rings LYING on the pool — that is what
		 * they were, and a stroked ellipse is a wire whatever its alpha. Each one is a little extra
		 * light ADDED to the rings of the pool's own falloff near its radius, so it is made of the
		 * same feathered steps the pool is and has no more of an edge than the pool does. Each fades
		 * in as it leaves the centre and out as it reaches the rim, so none starts or ends abruptly.
		 */
		const rippleAt = (u: number) => {
			let sum = 0;
			for (let i = 0; i < RIPPLES; i++) {
				const p = (t * 0.42 + i / RIPPLES) % 1;
				const d = (u - (0.3 + 0.7 * p)) / 0.17;
				sum += Math.exp(-d * d) * 0.025 * Math.sin(Math.PI * p) ** 0.7;
			}
			return sum;
		};
		lightPool({
			cx: x0,
			cy: y0 + len,
			rx: poolR,
			ry: poolR * 0.26,
			peak: POOL_PEAK,
			edge: POOL_EDGE,
			steps: POOL_STEPS,
			drift: poolDrift,
			rim: BEAM_POOL,
			core: 0xffffff,
			coreFrom: 0.55,
			add: rippleAt,
		});

		// ── Motes ──
		// Dust drifting UP the cone — the abduction. Each one spirals about the axis as it rises
		// (a tractor field turns what it lifts), carries a soft halo, and stretches into a streak
		// when the grab hauls it faster. Phases are derived from the index rather than stored.
		// They stay in the back part: by the time one reaches the mouth it has faded into the hull.
		for (let i = 0; i < MOTES; i++) {
			const jitter = hash(i);
			const soft = hash(i, 2) > 0.55;
			// ONE SPEED, and a slow one (user, 2026-09-14: the beam must not change gear).
			// This used to be `0.14 + 0.13 * jitter + 0.5 * grab`: a near-2x spread between the
			// slowest and fastest mote, and on every grab the whole field jumped to ~0.77 — nearly
			// four times the resting speed — for about a second, then dropped back. Read as the beam
			// changing speed rather than as dust in a light.
			// The 0.03 that remains is only enough to stop sixteen motes rising in visible lockstep;
			// the fastest one is now 0.16 against the old peak of 0.77.
			const speed = 0.13 + 0.03 * jitter;
			const rise = (t * speed + i / MOTES) % 1;
			const s = 1 - rise;
			if (!inPart(s)) continue;
			const r = radAt(s);
			const orbit = Math.sin(rise * Math.PI * 2 * (1.2 + jitter * 0.8) + i * 2.4);
			const x = x0 + (jitter * 1.3 - 0.65) * r * 0.6 + orbit * r * 0.5;
			const y = y0 + len * s;
			const size = hullW * (soft ? 0.012 + 0.008 * jitter : 0.006 + 0.006 * jitter);
			const grow = 0.6 + 0.4 * (1 - s);
			// A streak is motion blur, so it has to follow the speed: with the grab no longer hauling
			// the motes, a 3.5x stretch would be drawing speed that is not there. What is left is a
			// hint of a tug, in step with the flare the grab still puts through the cone's light.
			const streak = 1 + 0.15 * grab;
			// Fade in off the ground and out into the hull, so nothing pops at either end; the
			// spiral also takes them "behind" the axis on half of each turn, where they dim.
			const depth = 0.65 + 0.35 * Math.cos(rise * Math.PI * 2 * (1.2 + jitter * 0.8) + i * 2.4);
			const alpha = Math.sin(Math.PI * rise) ** 0.7 * depth * on;
			if (soft) {
				g.ellipse(x, y, size * grow * 2.4, size * grow * 2.4 * streak);
				g.fill({ color: BEAM_POOL, alpha: 0.16 * alpha });
			}
			g.ellipse(x, y, size * grow, size * grow * streak);
			g.fill({ color: 0xffffff, alpha: (soft ? 0.55 : 0.75) * alpha });
		}
	};

	// `master` rides the room cross-fade so the outgoing room's lamps dim out with its art instead
	// of blinking off the instant bonusMode flips.
	const paintLamps = (g: G, t: number, set: typeof lights, master: number) => {
		if (!set.length || master <= 0.002) return;
		const W = cover.width;
		const H = cover.height;
		const ox = canvas.width * 0.5;
		const oy = canvas.height * 0.5;
		for (let i = 0; i < set.length; i++) {
			const l = set[i];
			const x = ox + (l.cx - 0.5) * W;
			const y = oy + (l.cy - 0.5) * H;
			const w = l.w * W;
			const h = l.h * H;
			const p = i * 1.7;
			// Slow breathe with sparse, sharp dips — a lamp stuttering, not a smooth fade.
			const base = 0.82 + 0.18 * Math.sin(t * 0.9 + p);
			const dip =
				0.2 * Math.max(0, Math.sin(t * 17.3 + p * 3)) ** 12 +
				0.12 * Math.max(0, Math.sin(t * 5.1 + p * 1.7)) ** 8;
			const level = Math.max(0.3, base - dip);
			const cr = (l.color >> 16) & 0xff;
			const cg = (l.color >> 8) & 0xff;
			const cb = l.color & 0xff;
			const LAYERS = 5;
			for (let k = 0; k < LAYERS; k++) {
				const f = k / (LAYERS - 1);
				const grow = f ** 1.5;
				const gw = w * (1 + 1.7 * grow);
				const gh = h * (1 + 1.7 * grow);
				const m = 1 - f;
				// Only part-way to white at the core: these sit BEHIND a dim room, and a white core
				// turns every lamp into the same grey blob.
				const mix = (c: number) => Math.round(c + (255 - c) * 0.35 * m ** 1.8);
				g.roundRect(x - gw / 2, y - gh / 2, gw, gh, Math.min(gw, gh) / 2);
				g.fill({
					color: (mix(cr) << 16) | (mix(cg) << 8) | mix(cb),
					alpha: (0.012 + 0.05 * m ** 2.2) * level * master,
				});
			}
		}
	};

	const drawLamps = (g: G, t: number) => {
		g.clear();
		paintLamps(g, t, outgoingLights, 1 - fade.current);
		paintLamps(g, t, lights, fade.current);
	};

	$effect(() => {
		let raf = 0;
		const t0 = performance.now();
		const tick = (now: number) => {
			raf = requestAnimationFrame(tick);
			const t = (now - t0) / 1000;
			// The breath is reactive (it scales a Sprite); throttle it to ~10fps so the whole scene
			// graph is not diffed 60 times a second for a 0.6% drift nobody can see move.
			if (Math.abs(t - clock) > 0.1) clock = t;
			// The ship's transform is reactive too, but it is ONE container — the hull, the antenna
			// and the beam are its children and ride along untouched — so it can afford ~30fps.
			if (t - shipClock > 0.032) shipClock = t;
			if (lampG?.destroyed) lampG = null;
			if (lampG) drawLamps(lampG, t);
			if (beamG?.destroyed) beamG = null;
			// The beam is drawn imperatively at the full frame rate: its motes and sweep are the only
			// things here fast enough to show 30fps, and drawing into a captured Graphics never
			// re-renders the scene graph.
			if (beamG) drawBeam(beamG, t, 'back');
			if (beamCapG?.destroyed) beamCapG = null;
			if (beamCapG) drawBeam(beamCapG, t, 'cap');
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
</script>

{#if hasBg}
	<!-- Outgoing room, held at full strength underneath while the new one dissolves over it.
	     BOTH sprites stay mounted for the life of the component, and that is load-bearing: stage
	     layering in this game is MOUNT ORDER (see Game.svelte), so a sprite mounted on demand is
	     appended to the TOP of the stage. Gating this one on `outgoingKey` put the old room above
	     the bonus hand-off veil for the length of the fade, and it read as the base game flashing
	     back on right as the congratulations arrived. With no outgoing room this simply holds a
	     second copy of the current one, invisible under the sprite below it. -->
	<Sprite
		key={outgoingKey ?? displayedKey}
		x={canvas.width * 0.5}
		y={canvas.height * 0.5}
		anchor={0.5}
		width={cover.width * breath}
		height={cover.height * breath}
		alpha={0.96}
	/>
	<Sprite
		key={displayedKey}
		x={canvas.width * 0.5}
		y={canvas.height * 0.5}
		anchor={0.5}
		width={cover.width * breath}
		height={cover.height * breath}
		alpha={0.96 * fade.current}
	/>
	<!-- Weather, over the sky and under everything else in the scene. -->
	{#if cloudsShown}
		<SkyClouds
			coverW={cover.width * breath}
			coverH={cover.height * breath}
			canvasW={canvas.width}
			canvasH={canvas.height}
			alpha={0.96 * fade.current}
		/>
	{/if}

	<!-- Lamp glow rides ON the room art. -->
	<Graphics blendMode="add" draw={(gr) => (lampG = gr as unknown as G)} />

	<!-- The ship, hanging in the room's right-hand window. ONE container carries the whole assembly
	     so the arrival flight, the hover and the tremble are a single transform: the hull, the
	     lamps and the beam are children in local coordinates and never move against each other.
	     Mount order inside it is the stacking order — beam first so the hull covers its mouth. -->
	{#if shipShown}
		<Container x={shipX} y={shipY} scale={shipScale} rotation={shipRotation}>
			<Graphics draw={(gr) => (beamG = gr as unknown as G)} />
			<!-- In FRONT of the cone and BEHIND the hull, so a symbol riding all the way up passes
			     under the saucer rather than over it. -->
			{#if beamSymbol && suckAlpha > 0.002}
				<Container
					x={beamSymbolX}
					y={beamSymbolY}
					rotation={beamSymbolRotation}
					scale={bodyScale * (1 + 0.06 * beamGrab)}
				>
					<BeamSymbol name={beamSymbol} x={0} y={0} cell={beamSymbolCell} alpha={suckAlpha} />
				</Container>
			{/if}
			{#if beamSymbol && nextAlpha > 0.002}
				<Container
					x={nextHold.x}
					y={nextHold.y}
					rotation={restSway}
					scale={BEAM_SYMBOL.min * (1 + 0.06 * beamGrab)}
				>
					<BeamSymbol
						name={beamSymbol}
						x={0}
						y={0}
						cell={beamSymbolCell}
						alpha={nextAlpha}
						phase={0.71}
					/>
				</Container>
			{/if}
			<!-- LANDSCAPE only. Portrait's saucer is drawn by GameLogoFrame as part of the lockup,
			     in front of this container, so a sprite here would be the same saucer twice — and
			     the lamp table below is measured on ufo_ship.webp, which is not that drawing. -->
			{#if !isPortrait}
				<Sprite key="ufoShip" anchor={0.5} x={0} y={hullY} width={hullW} height={hullH} />
			{/if}
			<!-- The beam's mouth, over the hull's underside: the light leaves the emitter oval. -->
			<Graphics draw={(gr) => (beamCapG = gr as unknown as G)} />
			<!-- Running lights over the hull's own painted lamps (game/ufoLamps.ts). The art paints
			     them flat; this is the light. -->
			{#if !isPortrait}
				<Graphics
					blendMode="add"
					draw={(gr) => {
						gr.clear();
						drawUfoLamps(gr, {
							hullX: 0,
							hullY,
							hullW,
							hullH,
							clock: shipClock,
							level: near,
						});
						// The antenna's ball is a beacon: a slow blink, off-phase from the rim chase.
						const beacon = 0.5 + 0.5 * Math.sin(shipClock * 1.15);
						for (let i = 0; i < 7; i += 1) {
							const u = i / 6;
							gr.circle(
								BEACON.x * hullW,
								hullY + BEACON.y * hullH,
								BEACON.r * hullW * (0.4 + u * 1.6),
							);
							gr.fill({ color: 0xff6be0, alpha: 0.1 * (1 - u) ** 2.2 * beacon * near });
						}
					}}
				/>
			{/if}
		</Container>
	{/if}
{/if}
