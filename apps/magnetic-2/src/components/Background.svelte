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
	};
	let lampG: G | null = null;
	// The ship runs on its own clock. The room's is deliberately throttled to ~10fps (see below),
	// which is fine for a breath but turns a tremble into a stutter.
	let shipClock = $state(0);

	const BREATH_S = 24;
	const breath = $derived(1 + 0.006 * Math.sin((clock / BREATH_S) * Math.PI * 2));

	// ── The ship ──
	// Assembled from the designer's own loose parts (scripts/build-ufo-art.py prints every constant
	// below): the saucer, the antenna standing on it, and a tractor beam that is DRAWN rather than a
	// sprite, so it can switch on, breathe, sweep and haul motes up into the hull.
	//
	// The design hangs it top-right, running off the frame edge — that column used to hold the magnet
	// capsule, which is gone with the redesign, so the ship gets it back at full size. Note WHERE
	// that is: dead centre of the room's right window, i.e. the ship is outside, in the sky.
	//
	// Everything is sized off the HULL's width and its own art aspect. The parts were exported at
	// unrelated scales, so sizing them against each other's pixel dimensions draws the antenna 21%
	// too large — the antenna's size comes from the ratio measured in the designer's composite.
	const UFO_LANDSCAPE = {
		cx: 0.888,
		cy: 0.1635,
		/** Hull width, as a fraction of the background. */
		w: 0.2143,
		hullAspect: 1.9389,
		antennaAspect: 0.5,
		/** Antenna ball width as a fraction of the hull's width. */
		antennaOfHull: 0.1,
		/** How far the stem sinks into the dome, as a fraction of the antenna's height. */
		antennaOverlap: 0.06,
	};
	// PORTRAIT hangs the same ship top-CENTRE, over the logo, with its beam coming down into the gap
	// above the board (Figma 4336:15793, the mobile design: node 9126:19898 is this same composite at
	// 113x360 of the frame width, dead centre).
	//
	// It is not the design's own y. The design was composed inside a phone MOCK whose Stake header
	// covers the top 93px, and it hangs the ship half behind that header — in the real game there is
	// no header there, so the same y would hang half the saucer off the top of the canvas. The ship
	// is dropped until it is fully in shot instead, which is what the mock shows a player seeing.
	const UFO_PORTRAIT = {
		cx: 0.5,
		cy: 0.075,
		w: 0.26,
		hullAspect: 1.9389,
		antennaAspect: 0.5,
		antennaOfHull: 0.1,
		antennaOverlap: 0.06,
	};
	const UFO = $derived(isPortrait ? UFO_PORTRAIT : UFO_LANDSCAPE);
	/** The lit opening on the saucer's underside, in HULL fractions — the beam hangs off this. */
	const EMITTER = { cx: 0.498, w: 0.2047, bottom: 0.9237 };
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
	// Portrait shortens the reach: the board plate starts much closer to the ship there, and a beam
	// at full length runs behind it and loses its pool — the one part of the cone that says the light
	// is landing on something. The design stops it just above the board.
	const BEAM_LEN_OF_HULL = $derived(isPortrait ? 0.78 : BEAM.lenOfHull);

	const shipLoaded = $derived(
		!!context.stateApp.loadedAssets?.ufoHull && !!context.stateApp.loadedAssets?.ufoAntenna,
	);
	// Both orientations now. It used to be landscape-only, back when portrait cropped into an
	// interior room with no window for the ship to hang in; the mobile design (4336:15793) puts it
	// top-centre over the logo, which is where UFO_PORTRAIT hangs it.
	const shipShown = $derived(shipLoaded && hasBg);

	const hullW = $derived(UFO.w * cover.width);
	const hullH = $derived(hullW / UFO.hullAspect);
	const antennaW = $derived(hullW * UFO.antennaOfHull);
	const antennaH = $derived(antennaW / UFO.antennaAspect);
	// Local coordinates inside the ship container, whose origin is the whole assembly's centre.
	const assemblyH = $derived(hullH + antennaH * (1 - UFO.antennaOverlap));
	const hullY = $derived(assemblyH / 2 - hullH / 2);
	const antennaY = $derived(-assemblyH / 2 + antennaH / 2);

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
	let arrivedAt = $state<number | null>(null);
	$effect(() => {
		if (near > 0.985 && arrivedAt === null) arrivedAt = shipClock;
	});
	const brake = $derived(arrivedAt === null ? 0 : Math.exp(-(shipClock - arrivedAt) * 2.4));
	const shake = $derived(hullW * (0.0007 + 0.009 * brake) * near);
	const shipX = $derived(
		canvas.width * 0.5 +
			(FAR.cx + (UFO.cx - FAR.cx) * near - 0.5) * cover.width +
			(Math.sin(shipClock * 13.9) + 0.6 * Math.sin(shipClock * 8.9 + 2.1)) * shake +
			// A lazy sideways drift to go with the hover: a ship that only moves up and down is a lift.
			Math.sin(shipClock * 0.31 + 0.9) * cover.width * 0.006 * near,
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
				near,
	);
	// Banked while it closes, level once it parks, then a hair of roll in the tremble.
	const shipRotation = $derived(
		-0.16 * (1 - near) +
			Math.sin(shipClock * 7.2) * 0.0011 * (1 + brake * 5) * near +
			// The hover has to bank, or the saucer slides sideways dead level like a cursor.
			Math.sin(shipClock * 0.31 + 0.9 + Math.PI / 2) * 0.02 * near,
	);

	/** Seconds between grabs — the beam flares and whatever it is holding is hauled up the cone. */
	const GRAB_PERIOD = 8.5;

	// ── The symbol in the beam ──
	// While a cluster is on the board, its symbol hangs in the tractor beam: the ship is holding the
	// thing the magnet is collecting. The mobile design draws exactly this (Figma 4336:15793 puts one
	// symbol pad in the cone, under the ship), and it gives the beam something to be FOR — before
	// this it was a light with nothing in it but motes.
	//
	// `magnetTargetSymbol` is the cluster's own symbol and is null whenever there is no cluster, so
	// this appears and clears with the cluster rather than needing its own bookkeeping.
	const beamSymbol = $derived(context.stateGame.magnetTargetSymbol);
	/**
	 * `enter` / `top` are positions down the cone (0 = the emitter, 1 = the cone's mouth), `fill` is
	 * how much of the cone's width at `top` the artwork spans, and `min`/`max` are the size it grows
	 * through on the way up.
	 *
	 * SUCTION IS A LOOP, not an arrival. The symbol enters at the cone's mouth SMALL, is drawn up
	 * the beam getting BIGGER as it closes on the ship, and vanishes into the hull — then the next
	 * one starts at the bottom. Two earlier cuts got this wrong: the first parked it half way down
	 * the cone at a fixed size (a thing in a light, not a thing being taken), the second let it
	 * climb once and then hold. Growing is what sells the depth — it is coming towards the ship.
	 */
	const BEAM_SYMBOL = { enter: 0.95, top: 0.16, fill: 0.52, min: 0.42, max: 1.2 };
	const BEAM_SYMBOL_MS = 900;
	/** The one-off flight out of the board cell into the cone's mouth. */
	const lift = new Tween(0, { duration: BEAM_SYMBOL_MS, easing: cubicOut });
	/** Seconds per trip up the cone. */
	const SUCK_CYCLE = 3.4;
	/** `shipClock` when the loop took over from the flight — null while the flight is still running. */
	let suckT0 = $state<number | null>(null);
	$effect(() => {
		if (beamSymbol && !flightArmed) {
			flightArmed = true;
			// Board -> ship-local, because <BeamSymbol> is a child of the ship's own container.
			// The ship's rotation is a fraction of a degree of hover tilt, so it is ignored here;
			// including it would rotate the launch point by less than a pixel.
			const board = context.stateGameDerived.boardLayout();
			const at = firstTargetCell();
			if (at) {
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
		if (!beamSymbol) flightArmed = false;
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
		const name = context.stateGame.magnetTargetSymbol;
		if (!name) return null;
		const board = context.stateGame.board;
		for (let reel = 0; reel < board.length; reel += 1) {
			const column = board[reel];
			for (let row = 0; row < column.length; row += 1) {
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
	const beamTopY = $derived(hullY - hullH / 2 + (EMITTER.bottom - 0.04) * hullH);
	const beamLen = $derived(BEAM_LEN_OF_HULL * hullW);
	const beamRadAt = (s: number) => {
		const rTop = (EMITTER.w * hullW) / 2;
		return rTop + ((BEAM.wOfHull * hullW) / 2 - rTop) * s;
	};
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
	/** Its box is measured at `top`, once — the live growth is a scale (see `bodyScale`), so the
	 *  artwork is rasterised at one size instead of being re-fitted every frame. */
	const beamSymbolCell = $derived(2 * beamRadAt(BEAM_SYMBOL.top) * BEAM_SYMBOL.fill);
	// Held, not parked: it sways across the cone, bobs, turns a little, and swells on the same grab
	// pulse the beam flares on — all off the ship's own clock, so nothing here keeps its own state.
	const beamGrab = $derived(
		Math.max(0, Math.sin(((shipClock % GRAB_PERIOD) / GRAB_PERIOD) * Math.PI * 1.6)) ** 8,
	);
	/** The beam's own axis, with a gentle sway across it. */
	const holdX = $derived(
		beamAxisX + Math.sin(shipClock * 0.62 + 1.1) * beamRadAt(beamSymbolS) * 0.12,
	);
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
	const holdY = $derived(
		beamTopY +
			beamLen * beamSymbolS -
			suck * beamSymbolCell * 0.12 -
			beamGrab * beamSymbolCell * 0.2,
	);

	// ── The flight ─────────────────────────────────────────────────────────────────────────────
	// `lift` (900ms, cubicOut) carries it from its cell to the cone's mouth. The path is not a
	// straight line: the beam BENDS it — it is pulled sideways onto the cone's axis faster than it
	// rises, so it arrives travelling up the beam rather than sliding in diagonally. That is the
	// whole read of "the ship is taking it".
	const flightT = $derived(lift.current);
	/** X snaps onto the beam axis first (t^0.65), Y trails it (t^1.35). */
	const beamSymbolX = $derived(
		flightFrom ? flightFrom.x + (holdX - flightFrom.x) * flightT ** 0.65 : holdX,
	);
	const beamSymbolY = $derived(
		flightFrom ? flightFrom.y + (holdY - flightFrom.y) * flightT ** 1.35 : holdY,
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
	/** It fades up out of the cone's mouth and dissolves into the hull at the top of each trip. */
	const suckAlpha = $derived(
		suckT0 === null ? lift.current : Math.min(1, suckU / 0.08) * Math.min(1, (1 - suckU) / 0.14),
	);
	// Tumbles a little on the way up and settles into the resting sway.
	const beamSymbolRotation = $derived(
		Math.sin(shipClock * 0.45) * 0.07 + (1 - flightT) * Math.sin(flightT * Math.PI * 2) * 0.3,
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
	const MOTES = 11;
	let beamG: G | null = null;

	const drawBeam = (g: G, t: number) => {
		g.clear();
		const on = beamOn.current;
		if (on <= 0.004 || hullW <= 0) return;
		const x0 = (EMITTER.cx - 0.5) * hullW;
		// Start a touch inside the opening, so the hull always covers the beam's mouth.
		const y0 = hullY - hullH / 2 + (EMITTER.bottom - 0.04) * hullH;
		const rTop = (EMITTER.w * hullW) / 2;
		const rBot = (BEAM.wOfHull * hullW) / 2;
		const len = BEAM_LEN_OF_HULL * hullW * on;
		const radAt = (s: number) => rTop + (rBot - rTop) * s;
		/** A slice of the cone between two fractions of its length, widened by `k`. */
		const slab = (a: number, b: number, k: number) => {
			const ya = y0 + len * a;
			const yb = y0 + len * b;
			const ra = radAt(a) * k;
			const rb = radAt(b) * k;
			g.poly([x0 - ra, ya, x0 + ra, ya, x0 + rb, yb, x0 - rb, yb]);
		};

		const grabPhase = (t % GRAB_PERIOD) / GRAB_PERIOD;
		const grab = Math.max(0, Math.sin(grabPhase * Math.PI * 1.6)) ** 8;
		const flare = (0.86 + 0.14 * Math.sin(t * 1.7) + 0.45 * grab) * on;

		slab(0, 1, 1.15 + 0.05 * grab);
		g.fill({ color: BEAM_FILL, alpha: 0.16 * flare });
		slab(0, 1, 1);
		g.fill({ color: BEAM_CORE, alpha: 0.62 * flare });
		slab(0, 1, 0.55);
		g.fill({ color: BEAM_POOL, alpha: 0.14 * flare });

		// Bright edges. The art has them, and without them the cone has no shape against a lit wall.
		const rim = Math.max(2, hullW * 0.015);
		for (const side of [-1, 1]) {
			g.poly([
				x0 + side * rTop - rim / 2,
				y0,
				x0 + side * rTop + rim / 2,
				y0,
				x0 + side * rBot + rim / 2,
				y0 + len,
				x0 + side * rBot - rim / 2,
				y0 + len,
			]);
			g.fill({ color: BEAM_RIM, alpha: 0.9 * flare });
		}

		// A pulse of light running down the cone.
		const scan = (t * 0.33) % 1.35;
		if (scan < 1) {
			slab(scan, Math.min(1, scan + 0.16), 0.98);
			g.fill({ color: BEAM_POOL, alpha: 0.16 * on });
		}

		// The pool it throws on whatever is under it.
		g.ellipse(x0, y0 + len, rBot, rBot * 0.26);
		g.fill({ color: BEAM_POOL, alpha: 0.55 * flare });
		g.ellipse(x0, y0 + len, rBot * 0.66, rBot * 0.17);
		g.fill({ color: 0xffffff, alpha: 0.3 * flare });

		// Motes drifting UP the cone — the abduction. Phases are derived from the index rather than
		// stored, so this stays a pure function of the clock and survives any re-mount unchanged.
		for (let i = 0; i < MOTES; i++) {
			const seed = Math.sin(i * 12.9898) * 43758.5453;
			const jitter = seed - Math.floor(seed);
			const speed = 0.16 + 0.13 * jitter + 0.5 * grab;
			const rise = (t * speed + i / MOTES) % 1;
			const s = 1 - rise;
			const r = radAt(s);
			const drift = Math.sin(t * (0.7 + jitter) + i * 2.4) * 0.22;
			const size = hullW * (0.008 + 0.007 * jitter) * (0.6 + 0.4 * (1 - s));
			g.ellipse(x0 + (jitter * 1.4 - 0.7 + drift) * r, y0 + len * s, size, size);
			// Fade in off the ground and out into the hull, so nothing pops at either end.
			g.fill({ color: 0xffffff, alpha: Math.sin(Math.PI * rise) ** 0.7 * 0.7 * on });
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
			if (beamG) drawBeam(beamG, t);
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
	     antenna and the beam are children in local coordinates and never move against each other.
	     Mount order inside it is the stacking order — beam first so the hull covers its mouth, then
	     the antenna so the dome covers the stem's foot. -->
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
			<Sprite key="ufoAntenna" anchor={0.5} x={0} y={antennaY} width={antennaW} height={antennaH} />
			<Sprite key="ufoHull" anchor={0.5} x={0} y={hullY} width={hullW} height={hullH} />
			<!-- Running lights over the hull's own painted lamps (game/ufoLamps.ts). The art paints
			     them flat; this is the light. -->
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
						gr.circle(0, antennaY - antennaH * 0.34, antennaW * (0.18 + u * 0.75));
						gr.fill({ color: 0xff6be0, alpha: 0.1 * (1 - u) ** 2.2 * beacon * near });
					}
				}}
			/>
		</Container>
	{/if}
{/if}
