<script lang="ts" module>
	import type { RawSymbol, Position } from '../game/types';

	export type EmitterEventBoard =
		| { type: 'boardSettle'; board: RawSymbol[][] }
		| { type: 'boardShow' }
		| { type: 'boardHide' }
		| { type: 'boardWithAnimateSymbols'; symbolPositions: Position[] }
		| { type: 'skipToAnticipation' };
</script>

<script lang="ts">
	import { Container, Graphics, PIXI, Sprite } from 'pixi-svelte';
	import { OnPressFullScreen } from 'components-layout';
	import { stateBet } from 'state-shared';
	import { onMount } from 'svelte';

	import { boardShake } from '../game/boardShake.svelte';
	import { showsReelImpact } from '../game/reelImpact';
	import { getContext } from '../game/context';
	import {
		CELL_W,
		CELL_H,
		SYMBOL_W,
		SYMBOL_H,
		BOARD_DIMENSIONS,
		BOARD_GRID_OFFSET_Y,
		BOARD_SIDE_CONTENT_INSET,
		REEL_SKIP_GAP_MS,
		getBoardCellCenterX,
	} from '../game/constants';
	import {
		spriteKeyByName,
		bonusSpriteKeyByName,
		winSpriteKeyByName,
		getSpecialSymbolKey,
	} from '../game/utils';
	import { duckLookForPosition, duckVariantForPosition } from '../game/duckVisual';
	import type { RawSymbol, SymbolName } from '../game/types';
	import DuckPondDuck from './DuckPondDuck.svelte';
	import LandingSquish from './LandingSquish.svelte';
	import LoopingAssetSprite from './LoopingAssetSprite.svelte';
	import MegaWildFullReel from './MegaWildFullReel.svelte';
	import BalloonBunch from './BalloonBunch.svelte';
	import DuckSign from './DuckSign.svelte';
	import RollerWilds from './RollerWilds.svelte';
	import MegaCoaster from './MegaCoaster.svelte';
	import CoasterCar from './CoasterCar.svelte';
	import DuckSymbol from './DuckSymbol.svelte';
	import FerrisWheel from './FerrisWheel.svelte';
	import PopcornBurst from './PopcornBurst.svelte';
	import SymbolBulbs from './SymbolBulbs.svelte';
	import SymbolSparks from './SymbolSparks.svelte';
	import SymbolSteam from './SymbolSteam.svelte';
	import WildLetter from './WildLetter.svelte';
	import { MEGA_WILD_BULBS } from '../game/megaWildBulbs';
	import { SYMBOL_BULBS } from '../game/symbolBulbs';
	import { WHEEL_BULBS } from '../game/wheelParts';

	const LOW_SYMBOLS_SET = new Set<SymbolName>(['L1', 'L2', 'L3', 'L4', 'L5']);
	/**
	 * The symbols that animate at rest under their own steam, and so sit out the board's idle rattle.
	 *
	 * Kept as the symbols that MOVE rather than as the symbols that shake, so that giving a sixth
	 * symbol an idle animation is one entry here instead of a rule that quietly stops being true.
	 */
	const SELF_MOVING = new Set<SymbolName>([
		'H1',
		'H2',
		'H3',
		'H4',
		'H5',
		'S_ROLLER',
		'S_COASTER',
	]);
	/**
	 * The Duck Collect cell, as a share of the shorter side of a symbol. The rig is square and
	 * <SpineProvider height> scales it by the skeleton's declared 384, so this is the side of the
	 * square the whole duck-in-a-ring is drawn into; its ink fills 372x324 of that in all sixteen
	 * variants.
	 *
	 * TRIMMED FROM 1.04 (2026-08-24). At 1.04 the duck measured 103.8 x 90.4 board units, which made
	 * it the widest ink on the board — the rest of the set runs 63 to 93 wide (10 royal 92.7, ferris
	 * 82.7, the paying duck 69.8) — inside a cell only 128 across. It is also the one symbol drawn
	 * wider than it is tall, so it was the only thing on the reel reaching for the dividers, and
	 * next to a column of portrait symbols it read as a sticker laid on the cell rather than as a
	 * symbol standing in it. Nothing about the drawing was off: its outline weight and the flatness
	 * of its fills both measure mid-pack against the set. It was only ever too big.
	 *
	 * 0.932 puts it at 93.0 x 81.0 — the 10 royal's width and the A royal's height, so it is joint
	 * widest rather than outright widest, which is the room a feature symbol is entitled to.
	 */
	const DUCK_SYMBOL_SIZE = Math.min(SYMBOL_W, SYMBOL_H) * 0.932;
	// The grid the board is drawn on runs UNDER its contents. It used to be the other way about: the
	// mask below carved a rect per cell and left a hair of clearance around each, so the authored
	// dividers showed through and no symbol pixel ever crossed one. That reads as a table with
	// pictures set into it rather than as a lit playfield — every symbol boxed in by a line it is
	// not allowed to touch. The mask is now one rect for the whole playfield, so a symbol, a win
	// pulse or a full-reel feature crosses the dividers and the grid sits behind the lot.

	// Nothing wins by video any more. The whole symbol set was redrawn as flat cartoons, which left
	// every *-win.webm animating art that is no longer on the board — a win would have snapped the
	// symbol from cartoon back to the old photoreal render. Wins are now <SymbolBulbs> lighting the
	// bulbs drawn into the art, plus the board's own win pulse. Kept as a map, empty, because the
	// branch below is the seam where a per-symbol win animation would go back in.
	const WIN_ANIMATION_KEY_BY_NAME: Partial<Record<SymbolName, string>> = {};

	const context = getContext();
	const board = $derived(context.stateGame.board);
	const layout = $derived(context.stateGameDerived.boardLayout());
	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const isAnyReelSpinning = $derived(board.some((reel) => reel.reelState.motion !== 'stopped'));
	let show = $state(true);

	const activeMap = $derived(context.stateGame.bonusMode ? bonusSpriteKeyByName : spriteKeyByName);
	const getX = getBoardCellCenterX;
	const drawBoardContentMask = (graphics: PIXI.Graphics) => {
		// The outer inset stays: that edge is the board's own opening, and a symbol running past it
		// would be trimmed by the rail instead of by the mask, which is a harder edge and a worse one.
		graphics
			.rect(
				BOARD_SIDE_CONTENT_INSET,
				0,
				CELL_W * BOARD_DIMENSIONS.x - BOARD_SIDE_CONTENT_INSET * 2,
				CELL_H * BOARD_DIMENSIONS.y,
			)
			.fill(0xffffff);
	};
	const coasterCellSet = $derived(
		new Set(context.stateGame.coasterTiles.map(({ reel, row }) => `${reel},${row}`)),
	);
	const duckCollectPrizeByCell = $derived(
		new Map(
			(context.stateGame.duckCollect?.revealed ?? []).map((prize) => [
				`${prize.position.reel},${prize.position.row}`,
				prize,
			]),
		),
	);
	const duckRevealCellSet = $derived(
		new Set(context.stateGame.duckRevealPositions.map(({ reel, row }) => `${reel},${row}`)),
	);
	const duckTurnedCellSet = $derived(
		new Set(context.stateGame.duckTurnedPositions.map(({ reel, row }) => `${reel},${row}`)),
	);
	const boardPosition = (reel: number, row: number): Position => ({ reel, row });
	const getDuckCollectPrize = (reel: number, row: number) =>
		duckCollectPrizeByCell.get(`${reel},${row}`) ?? null;
	const duckStyleSeed = (rawSymbol: RawSymbol) => rawSymbol.duckStyleSeed ?? 0;
	const duckVariant = (rawSymbol: RawSymbol, position: Position) =>
		rawSymbol.duckVariant ?? duckVariantForPosition(position, duckStyleSeed(rawSymbol));
	const duckLook = (rawSymbol: RawSymbol, position: Position) =>
		rawSymbol.duckLook ?? duckLookForPosition(position, duckStyleSeed(rawSymbol));
	const isDuckCollectRevealing = (reel: number, row: number) =>
		duckRevealCellSet.has(`${reel},${row}`);
	const isDuckCollectTurned = (reel: number, row: number) =>
		duckTurnedCellSet.has(`${reel},${row}`);
	const finishDuckCollectReveal = (position: Position) =>
		context.eventEmitter.broadcast({ type: 'duckCollectRevealComplete', position });
	// Cells the roller-wilds carts have passed. Board hides each old symbol in the same render that
	// the overlay replaces it with that row's multiplier contribution.
	const rollerClearedSet = $derived(new Set(context.stateGame.rollerClearedCells));
	const isInitialRollerTriggerCell = (
		rawSymbol: RawSymbol,
		_reelIndex: number,
		rowIndex: number,
	) => {
		if (rawSymbol.name !== 'W') return false;
		if (rawSymbol.rollerTrigger) return true;
		// Legacy books mark the centre trigger with `multiplier`. The settled reel uses the distinct
		// `reelMultiplier` field so it can remain a plaque while it physically rolls out next spin.
		return (
			rowIndex === Math.floor(BOARD_DIMENSIONS.y / 2) &&
			Boolean(rawSymbol.multiplier) &&
			!rawSymbol.reelMultiplier
		);
	};
	const isRollerMultiplierCell = (rawSymbol: RawSymbol, reelIndex: number, rowIndex: number) =>
		rawSymbol.name === 'W' &&
		Boolean(rawSymbol.reelMultiplier) &&
		rowIndex >= 0 &&
		rowIndex < BOARD_DIMENSIONS.y &&
		!rawSymbol.persistent &&
		!coasterCellSet.has(`${reelIndex},${rowIndex}`);
	const isRollerReelWinning = (reelIndex: number, reelMultiplier: number) =>
		board[reelIndex]?.reelState.symbols.some(
			(symbol) =>
				symbol.symbolState === 'win' && symbol.rawSymbol.reelMultiplier === reelMultiplier,
		) ?? false;
	const reelBounceDurationMs = (reelIndex: number) => {
		const options = board[reelIndex].reelState.spinOptions();
		return (CELL_H * options.reelBounceSizeMulti) / options.reelBounceBackSpeed;
	};
	const getSpriteKey = (
		rawSymbol: RawSymbol,
		state: string | undefined,
		reelIndex: number,
		rowIndex: number,
	) => {
		const { name } = rawSymbol;
		if (name === 'W') {
			if (rawSymbol.persistent || coasterCellSet.has(`${reelIndex},${rowIndex}`))
				return 'tpCoasterWild';
			if (isInitialRollerTriggerCell(rawSymbol, reelIndex, rowIndex))
				return getSpecialSymbolKey('megaWild', layoutType);
			return getSpecialSymbolKey('wild', layoutType);
		}
		if (name === 'DC')
			return `duckPondDuck${duckVariant(rawSymbol, { reel: reelIndex, row: rowIndex })}`;
		if (name === 'S_DUCK') return getSpecialSymbolKey('duckScatter', layoutType);
		if (name === 'S_ROLLER') return getSpecialSymbolKey('rollerScatter', layoutType);
		if (name === 'S_COASTER') return getSpecialSymbolKey('coasterScatter', layoutType);
		if (state === 'win') return winSpriteKeyByName[name] ?? activeMap[name] ?? 'tpH1';
		return activeMap[name] ?? 'tpH1';
	};
	/**
	 * The bulb pattern to light over `spriteKey`, if there is one.
	 *
	 * Gated on the SPRITE and not just the symbol, because 'W' is drawn three different ways — the
	 * wild plate, the Mega Wild plaque on a roller trigger, and the Coaster Wild tile — and only the
	 * plaque has anything to light: its two headlamps. The plate wins by popping its letter instead
	 * (<WildLetter>) and the tile does nothing, so keying on the symbol alone would put the plaque's
	 * two lamps on all three.
	 */
	const bulbsFor = (name: SymbolName, spriteKey: string) => {
		// The wheel's bulbs come from its own table rather than SYMBOL_BULBS, because the wheel is the
		// one sign here that is not a flat drawing: build-symbol-bulbs.py cannot see it, and the six
		// live on the legs, which are the only part of the rig that stands still.
		if (name === 'H5') return WHEEL_BULBS;
		if (name !== 'W') return SYMBOL_BULBS[name];
		return spriteKey.startsWith('tpMegaWild') ? MEGA_WILD_BULBS : undefined;
	};
	const getAnimationKey = (
		rawSymbol: RawSymbol,
		state: string | undefined,
		reelIndex: number,
		rowIndex: number,
	) => {
		if (rawSymbol.persistent || coasterCellSet.has(`${reelIndex},${rowIndex}`)) return undefined;
		if (rawSymbol.name === 'DC' || rawSymbol.name === 'S_DUCK') return undefined;
		// W, S_ROLLER and S_COASTER used to animate here and no longer do. Each was redrawn as a flat
		// marquee sign, which left its webms animating a building, a badge and a wild that are not on
		// the board any more. It mattered more for these three than for the royals, because their idle
		// key was returned unconditionally: the new still was only ever a load-time fallback, so
		// swapping the PNG alone would have changed nothing on screen. Dropping the key is what lets
		// them reach the static branch below, where <SymbolBulbs> lights the bulbs drawn into the art.
		return state === 'win' ? WIN_ANIMATION_KEY_BY_NAME[rawSymbol.name] : undefined;
	};
	// True while any symbol is in 'win' state — used to dim non-winning symbols
	const hasWinState = $derived(
		context.stateGame.board.some((reel) =>
			reel.reelState.symbols.some((s) => s.symbolState === 'win'),
		),
	);
	let winPulse = $state(1);
	/** Seconds since the current win started, and 0 whenever there is none. Drives <SymbolBulbs>. */
	let winClock = $state(0);

	// --- Ambient life ---------------------------------------------------------------------------
	// Between spins the grid used to be completely still: two frames 1.2s apart differed by 0.00% of
	// pixels inside the board, while the park behind it changed on 17% — the scenery was livelier
	// than the game. Every settled symbol now breathes in brightness, each on its own phase so the
	// board reads as a field that is alive rather than as one metronome.
	//
	// It is a TINT and deliberately not any kind of movement. Drifting or scaling the symbols meant
	// pixi resampled them every frame, and these are marquee signs: their rings of small bright bulbs
	// twinkled as the sampling phase shifted, which is what read as flicker along the bottom of the
	// letters. Back-to-back frames differed by a mean of 8.9 with a drift, against 0.37 with none —
	// individual pixels flipping outright, not a gentle change. Rounding the drift to whole device
	// pixels was tried and is a dead end here: the sprite sits under boardScale, <MainContainer>'s
	// responsive scale AND the renderer resolution, and any error in that chain puts it back on a
	// fraction. Tint touches no geometry, so there is nothing to resample.
	const TAU = Math.PI * 2;
	/** How far the dimmest point of the breath drops below full brightness. */
	const IDLE_TINT = 0.09;
	const IDLE_TINT_HZ = 0.17;
	const NO_IDLE = 0xffffff;

	// Spinning symbols are stretched, narrowed and faded rather than blurred with a real filter: a
	// filter costs a render-target pass per reel, which this game cannot afford. The stretch is
	// sized to roughly match how far a symbol travels between two frames, which is what makes the
	// strip read as motion instead of as the slideshow it was (edge energy fell only 18% mid-spin).
	const SPIN_STRETCH = 0.26;
	const SPIN_SQUEEZE = 0.08;
	const SPIN_FADE = 0.15;
	// Stretching alone leaves the symbol razor-sharp — it reads as a squashed symbol, not a fast one.
	// Two faint copies trailing above and below smear it along the direction of travel, which is the
	// actual look of a blurred reel, and costs two extra batched sprites per cell instead of a
	// filter's render target. Drawn before the symbol so it stays the sharpest thing in the cell.
	const SPIN_GHOSTS = [
		{ offset: -0.5, alpha: 0.3 },
		{ offset: 0.5, alpha: 0.3 },
	];

	// Every so often a small clump of symbols stirs, like signs rocking on their hooks as a ride goes
	// past. Each one turns ABOUT ITS OWN MIDDLE rather than sliding sideways (design ask, 2026-08-18):
	// a sideways slide moves the sign off its hook, and with a clump of neighbours doing it together it
	// read as the grid itself jolting. A rock about the centre is the motion a hanging sign actually
	// has, and it stays inside the cell however hard it is driven.
	//
	// This IS geometric, which the constant breath deliberately is not, so it carries the same
	// resampling risk the breath avoids: a sub-pixel drift twinkles. What keeps it clear of that is
	// that the corners still travel a few whole pixels — the amplitude below is small in degrees, not
	// in pixels — and that it is over in under a second.
	const SHAKE_GAP = { min: 4, max: 9 };
	const SHAKE_SECONDS = 0.8;
	/**
	 * Peak swing, in radians. 0.045 is ~2.6°, which throws a corner of a desktop symbol about three
	 * board units — a quarter of what the old sideways rattle moved the whole sprite, and the "very
	 * gentle" the design asked for.
	 */
	const SHAKE_RADIANS = 0.045;
	/** Slower than the old rattle: a sign on a hook swings, it does not buzz. */
	const SHAKE_HZ = 3.4;
	const SHAKE_STAGGER = 0.09; // per cell, so the clump ripples instead of moving as a block

	// The reels hitting their stop. Every landing adds an impulse to one shared damped oscillator, so
	// five reels stopping in sequence keep knocking the board rather than each starting a new shake;
	// the last reel hits hardest, which is what gives the round a full stop.
	const LAND_SHAKE = { impulse: 4.2, lastImpulse: 7.5, hz: 15, decay: 9 };

	let idleClock = $state(0);
	/**
	 * How often the RESTING bulb shimmer is allowed to redraw, in steps per second.
	 *
	 * A winning royal is one of a handful on screen; a resting one is one of fifteen or so, and each
	 * redraw rebuilds every bulb's geometry. The shimmer runs at 0.21Hz, so ten steps a second is
	 * already far finer than the eye can follow there, and quantising the clock this way means the
	 * <Graphics> effect wakes ten times a second instead of sixty — a `$derived` that lands on the same
	 * number does not notify.
	 */
	const IDLE_BULB_STEPS = 10;
	const idleBulbClock = $derived(Math.round(idleClock * IDLE_BULB_STEPS) / IDLE_BULB_STEPS);
	let idleAmount = $state(0);
	let spinBlur = $state<number[]>(new Array(BOARD_DIMENSIONS.x).fill(0));
	/** Cell key -> its delay into the current rattle. Empty between events. */
	let shakeCells = $state(new Map<string, number>());
	let shakeStartedAt = $state(-Infinity);
	let nextShakeAt = SHAKE_GAP.min;

	let landShakeEnergy = 0;
	let landShakePhase = 0;
	const seenLandingSequence = new Array<number>(BOARD_DIMENSIONS.x).fill(-1);

	/**
	 * Whether a cell is one the rattle is allowed to pick up.
	 *
	 * The shake was written when every symbol on this board was a still drawing, and it is the only
	 * thing that made a settled board look inhabited. Five of them animate on their own now — the
	 * coaster car's riders wave, the duck glances and breathes, the balloons sway, the bucket drops
	 * popcorn, the wheel turns — and rocking those as well reads as two unrelated motions fighting
	 * over one sprite rather than as a sign swinging on its hook. So the rattle is now for the
	 * symbols that have nothing else: the five royals, the wilds and the scatters.
	 */
	const rattles = (reel: number, row: number) => {
		const name = board[reel]?.reelState.symbols[row + 1]?.rawSymbol.name;
		return name !== undefined && !SELF_MOVING.has(name);
	};

	const pickShakeGroup = () => {
		// Seeded from a cell that qualifies, rather than from anywhere and filtered afterwards: on a
		// board with a wheel and a duck on it, most random seeds would grow a clump that was mostly
		// holes, and a good few would come back empty and skip the rattle entirely.
		const eligible: [number, number][] = [];
		for (let r = 0; r < BOARD_DIMENSIONS.x; r += 1) {
			for (let w = 0; w < BOARD_DIMENSIONS.y; w += 1) {
				if (rattles(r, w)) eligible.push([r, w]);
			}
		}
		const group = new Map<string, number>();
		if (eligible.length === 0) return group;
		const [reel, row] = eligible[Math.floor(Math.random() * eligible.length)];
		const wanted = 3 + Math.floor(Math.random() * 3);
		// Ordered so the clump grows outward from the chosen cell and stays contiguous.
		for (const [dReel, dRow] of [
			[0, 0],
			[1, 0],
			[0, 1],
			[1, 1],
			[-1, 0],
			[0, -1],
		]) {
			if (group.size >= wanted) break;
			const r = reel + dReel;
			const w = row + dRow;
			if (r < 0 || r >= BOARD_DIMENSIONS.x || w < 0 || w >= BOARD_DIMENSIONS.y) continue;
			if (!rattles(r, w)) continue;
			group.set(`${r},${w}`, group.size * SHAKE_STAGGER);
		}
		return group;
	};

	/** Eases `value` toward `target`, snapping the tail so a settled reel ends exactly sharp. */
	const approach = (value: number, target: number, rate: number, delta: number) => {
		const next = value + (target - value) * Math.min(1, delta * rate);
		return Math.abs(next - target) < 0.004 ? target : next;
	};

	onMount(() => {
		let frame = 0;
		const started = performance.now();
		let previous = started;
		const tick = (now: number) => {
			// Clamped so a backgrounded tab does not resume with a jump.
			const delta = Math.min((now - previous) / 1000, 0.1);
			previous = now;

			winPulse = hasWinState ? 1.05 + Math.sin((now - started) * 0.012) * 0.06 : 1;
			winClock = hasWinState ? winClock + delta : 0;

			idleClock += delta;
			// Held at zero while anything is moving and eased back slowly, so the breathing never
			// fights the landing bounce; dropped fast when a spin starts.
			idleAmount = approach(
				idleAmount,
				isAnyReelSpinning ? 0 : 1,
				isAnyReelSpinning ? 16 : 2.4,
				delta,
			);

			for (let reel = 0; reel < spinBlur.length; reel += 1) {
				const spinning = board[reel]?.reelState.motion === 'spinning';
				spinBlur[reel] = approach(spinBlur[reel], spinning ? 1 : 0, spinning ? 12 : 18, delta);

				const sequence = board[reel]?.reelState.landingSequence ?? 0;
				if (sequence !== seenLandingSequence[reel]) {
					const first = seenLandingSequence[reel] === -1;
					seenLandingSequence[reel] = sequence;
					// Skipped on the very first render, where every reel reports its starting sequence,
					// and in the fast modes, which do not get the impact at all (game/reelImpact.ts).
					if (!first && showsReelImpact()) {
						const last = reel === BOARD_DIMENSIONS.x - 1;
						landShakeEnergy += last ? LAND_SHAKE.lastImpulse : LAND_SHAKE.impulse;
						// Restart the swing on every hit so each impulse begins by driving downward.
						landShakePhase = 0;
					}
				}
			}

			if (landShakeEnergy > 0.05) {
				landShakePhase += delta * LAND_SHAKE.hz * TAU;
				landShakeEnergy *= Math.exp(-LAND_SHAKE.decay * delta);
				boardShake.y = Math.sin(landShakePhase) * landShakeEnergy;
				// A little sideways sway, off the vertical rhythm, so it reads as a knock rather than
				// as a lift.
				boardShake.x = Math.sin(landShakePhase * 0.63) * landShakeEnergy * 0.35;
			} else if (landShakeEnergy !== 0) {
				landShakeEnergy = 0;
				boardShake.x = 0;
				boardShake.y = 0;
			}

			// Only once the board is fully settled, and never over a win — the win presentation owns
			// the symbols then.
			if (idleAmount > 0.99 && !hasWinState && idleClock >= nextShakeAt) {
				shakeCells = pickShakeGroup();
				shakeStartedAt = idleClock;
				nextShakeAt = idleClock + SHAKE_GAP.min + Math.random() * (SHAKE_GAP.max - SHAKE_GAP.min);
			} else if (shakeCells.size > 0 && idleClock - shakeStartedAt > SHAKE_SECONDS + 0.4) {
				shakeCells = new Map();
			}

			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	});

	/** This cell's rock about its own centre, in radians. Zero for everything not in the clump. */
	const shakeRotation = (reel: number, row: number) => {
		if (shakeCells.size === 0) return 0;
		const delay = shakeCells.get(`${reel},${row}`);
		if (delay === undefined) return 0;
		const elapsed = idleClock - shakeStartedAt - delay;
		if (elapsed < 0 || elapsed > SHAKE_SECONDS) return 0;
		const progress = elapsed / SHAKE_SECONDS;
		// Squared decay: a first swing that dies away, rather than an even wobble. Alternating the
		// direction by cell keeps a clump from leaning as one piece.
		const damping = (1 - progress) ** 2;
		const direction = (reel + row) % 2 ? -1 : 1;
		return Math.sin(progress * SHAKE_HZ * TAU) * SHAKE_RADIANS * damping * direction;
	};

	/** Grey tint for this cell's point in the breath. Tint multiplies, so it can only darken. */
	const idleTint = (reel: number, row: number) => {
		if (idleAmount < 0.002) return NO_IDLE;
		// A rattling symbol comes up to full brightness — the bulbs flare as it is jolted.
		if (shakeCells.has(`${reel},${row}`)) return NO_IDLE;
		const phase = reel * 0.83 + row * 1.37;
		const dip = 0.5 + 0.5 * Math.cos(idleClock * IDLE_TINT_HZ * TAU + phase);
		const level = Math.round(255 * (1 - dip * IDLE_TINT * idleAmount));
		return (level << 16) | (level << 8) | level;
	};

	// Reels whose symbols should be hidden behind the low-symbol expanded overlay.
	// Added one-by-one with a small delay so the overlay sprite starts drawing first.
	let hiddenReels = $state(new Set<number>());

	$effect(() => {
		const expanded = context.stateGame.expandedSymbol;
		// Reset when no expansion, non-low symbol, OR reels cleared for next spin
		if (!expanded || !LOW_SYMBOLS_SET.has(expanded.symbol) || expanded.reels.length === 0) {
			if (hiddenReels.size > 0) hiddenReels = new Set<number>();
			return;
		}
		const lastReel = expanded.reels[expanded.reels.length - 1];
		if (hiddenReels.has(lastReel)) return;
		const t = setTimeout(() => {
			hiddenReels = new Set([...hiddenReels, lastReel]);
		}, 80);
		return () => clearTimeout(t);
	});

	const hasActiveAnticipation = () => board.some((reel) => reel.reelState.anticipating);
	const reelSkipGap = () =>
		stateBet.isSuperTurbo
			? REEL_SKIP_GAP_MS.turbo
			: stateBet.isTurbo
				? REEL_SKIP_GAP_MS.fast
				: REEL_SKIP_GAP_MS.normal;
	const stopReelsForSkip = () => {
		// Keep the force-stop decision sticky for the rest of this reveal. The anticipation overlay
		// fades before the ordered reel-stop timers have all fired; deriving `force` only from the
		// overlay state let a repeated/forwarded stop downgrade the remaining noStop reels to a plain
		// stop, which cannot release them and left the final reel spinning forever.
		const forceAnticipationStop =
			context.stateGame.anticipationSkipped || hasActiveAnticipation();
		if (forceAnticipationStop) context.stateGame.anticipationSkipped = true;
		context.stateGameDerived.enhancedBoard.stopSequentially({
			force: forceAnticipationStop,
			delayMs: reelSkipGap(),
		});
	};
	const requestSpinSkip = () => {
		if (context.stateGame.awaitingFirstReveal) {
			context.stateGame.pendingStop = true;
			return;
		}
		if (context.stateGame.hasAnticipationPending && !hasActiveAnticipation()) {
			context.stateGame.hasAnticipationPending = false;
			context.eventEmitter.broadcast({ type: 'skipToAnticipation' });
			return;
		}
		context.eventEmitter.broadcast({ type: 'stopButtonClick' });
	};

	// A reveal can arrive while the staggered pre-spin is still aligning. End only that padding loop
	// as soon as a buffered click exists; the prepared final targets then stop in ordered sequence.
	$effect(() => {
		if (!context.stateGame.revealPreparing || !context.stateGame.pendingStop) return;
		board.forEach((reel) => reel.finishPreSpin());
	});

	context.eventEmitter.subscribeOnMount({
		stopButtonClick: () => stopReelsForSkip(),
		skipToAnticipation: () =>
			context.stateGameDerived.enhancedBoard.stopSequentially({ delayMs: reelSkipGap() }),
		boardSettle: ({ board }) => context.stateGameDerived.enhancedBoard.settle(board),
		boardShow: () => (show = true),
		boardHide: () => (show = false),
		boardWithAnimateSymbols: async ({ symbolPositions }) => {
			// Event positions use VISIBLE coordinates (row 0-4); the settled reel
			// symbols include 1 padding row on top (contract ROW_OFFSET = 1).
			const ROW_OFFSET = 1;
			for (const position of symbolPositions) {
				const reelSymbol =
					context.stateGame.board[position.reel].reelState.symbols[position.row + ROW_OFFSET];
				if (reelSymbol) reelSymbol.symbolState = 'win';
			}
		},
	});

	context.stateGameDerived.enhancedBoard.readyToSpinEffect();
</script>

{#if isAnyReelSpinning}
	<OnPressFullScreen onpress={requestSpinSkip} />
{/if}

{#if show}
	<Container
		x={layout.x + boardShake.x}
		y={layout.y + BOARD_GRID_OFFSET_Y + boardShake.y}
		pivot={layout.pivot}
		scale={layout.boardScale}
	>
		<Graphics isMask draw={drawBoardContentMask} />
		<!-- The 5x5 grid exists only in the board's own art (board/frame-grid.webp). The cell mask above
		     leaves its exact dividers and outer edges unobstructed instead of repainting a second grid
		     at a higher layer. -->
		{#each board as reel, reelIndex (reelIndex)}
			{#if !hiddenReels.has(reelIndex)}
				{#each reel.reelState.symbols as reelSymbol, symbolIndex (symbolIndex)}
					{@const y = reelSymbol.symbolY()}
					{@const isWin = reelSymbol.symbolState === 'win'}
					{#if !rollerClearedSet.has(`${reelIndex},${symbolIndex - 1}`) && !coasterCellSet.has(`${reelIndex},${symbolIndex - 1}`)}
						{@const position = boardPosition(reelIndex, symbolIndex - 1)}
						{@const duckPrize = getDuckCollectPrize(reelIndex, symbolIndex - 1)}
						{@const idle = isWin ? NO_IDLE : idleTint(reelIndex, symbolIndex - 1)}
						{@const blur = spinBlur[reelIndex] ?? 0}
						{@const shake = isWin ? 0 : shakeRotation(reelIndex, symbolIndex - 1)}
						{@const fallbackKey = getSpriteKey(
							reelSymbol.rawSymbol,
							reelSymbol.symbolState,
							reelIndex,
							symbolIndex - 1,
						)}
						{@const animationKey = getAnimationKey(
							reelSymbol.rawSymbol,
							reelSymbol.symbolState,
							reelIndex,
							symbolIndex - 1,
						)}
						<!-- Keep one DC component mounted for front idle -> turn -> rear idle. No
						     Board/presenter swap, so variant, scale and timeline stay continuous. -->
						<!-- Settled Roller cells are the multiplier itself, not a Mega Wild symbol with a
						     badge over it. This lives inside the moving reel symbol loop, so the unchanged
						     plaques roll out naturally on the following spin. -->
						<!-- Trigger 0 is <LandingSquish>'s own "do not play": the fast modes drop the
						     squash along with the rest of the landing impact (game/reelImpact.ts). -->
						<LandingSquish
							trigger={showsReelImpact() ? reel.reelState.landingSequence : 0}
							x={getX(reelIndex)}
							{y}
							durationMs={reelBounceDurationMs(reelIndex)}
						>
							{#if isRollerMultiplierCell(reelSymbol.rawSymbol, reelIndex, symbolIndex - 1)}
								{#if symbolIndex - 1 === Math.floor(BOARD_DIMENSIONS.y / 2)}
									<MegaWildFullReel
										x={getX(reelIndex)}
										{y}
										fakeMultiplier={reelSymbol.rawSymbol.reelMultiplier ?? 1}
										multiplier={reelSymbol.rawSymbol.reelMultiplier ?? 1}
										animationName={!reelSymbol.rawSymbol.rollerExpanded
											? 'intro'
											: isRollerReelWinning(reelIndex, reelSymbol.rawSymbol.reelMultiplier ?? 1)
												? 'win'
												: 'idle'}
										alpha={hasWinState &&
										!isRollerReelWinning(reelIndex, reelSymbol.rawSymbol.reelMultiplier ?? 1)
											? 0.35
											: 1}
									/>
								{/if}
							{:else if reelSymbol.rawSymbol.name === 'S_ROLLER' && !(hasWinState && !isWin) && blur < 0.02}
								<!-- Assembled live rather than drawn, because this sign TALKS: its star turns
								     while the board idles and its two words pop against each other when it
								     wins. Dimmed it falls back to the still, for the reason given at the H3
								     branch above. -->
								<RollerWilds
									x={getX(reelIndex)}
									{y}
									rotation={shake}
									tint={idle}
									width={SYMBOL_W * (isWin ? winPulse : 1) * (1 - SPIN_SQUEEZE * blur)}
									height={SYMBOL_H * (isWin ? winPulse : 1) * (1 + SPIN_STRETCH * blur)}
									alpha={1 - SPIN_FADE * blur}
									signKey={getSpecialSymbolKey('rollerSign', layoutType)}
									baseKey={fallbackKey}
									clock={winClock}
									{idleClock}
									{blur}
									phase={reelIndex * 0.71 + (symbolIndex - 1) * 1.13}
									win={isWin}
								/>
							{:else if reelSymbol.rawSymbol.name === 'S_COASTER' && !(hasWinState && !isWin) && blur < 0.02}
								<!-- Assembled live rather than drawn, because a building cannot do anything
								     else: the marquee bolted to its face rocks while the board idles and its
								     two words zoom when it wins. Dimmed it falls back to the still, for the
								     reason given at the H3 branch above. -->
								<MegaCoaster
									x={getX(reelIndex)}
									{y}
									rotation={shake}
									tint={idle}
									width={SYMBOL_W * (isWin ? winPulse : 1) * (1 - SPIN_SQUEEZE * blur)}
									height={SYMBOL_H * (isWin ? winPulse : 1) * (1 + SPIN_STRETCH * blur)}
									alpha={1 - SPIN_FADE * blur}
									houseKey={getSpecialSymbolKey('coasterHouse', layoutType)}
									baseKey={fallbackKey}
									clock={winClock}
									{idleClock}
									{blur}
									phase={reelIndex * 1.09 + (symbolIndex - 1) * 0.67}
									win={isWin}
								/>
							{:else if reelSymbol.rawSymbol.name === 'S_DUCK'}
								<!-- Its own component, because it is the one symbol on this board that MOVES
								     when it wins: the duck beats the two wings that ship apart from the rest
								     of its art, and rocks the sign it is holding. -->
								<DuckSign
									x={getX(reelIndex)}
									{y}
									rotation={shake}
									width={SYMBOL_W * (isWin ? winPulse : 1)}
									height={SYMBOL_H * (isWin ? winPulse : 1)}
									baseKey={fallbackKey}
									clock={winClock}
									win={isWin}
									alpha={hasWinState && !isWin ? 0.35 : 1}
								/>
							{:else if reelSymbol.rawSymbol.name === 'DC'}
								<DuckPondDuck
									x={getX(reelIndex)}
									{y}
									size={DUCK_SYMBOL_SIZE}
									variant={duckVariant(reelSymbol.rawSymbol, position)}
									look={duckLook(reelSymbol.rawSymbol, position)}
									prize={duckPrize ? { kind: duckPrize.kind, value: duckPrize.value } : null}
									revealing={isDuckCollectRevealing(reelIndex, symbolIndex - 1)}
									turned={isDuckCollectTurned(reelIndex, symbolIndex - 1)}
									batch={context.stateGame.duckRevealBatch}
									alpha={hasWinState && !isWin ? 0.35 : 1}
									onrevealcomplete={() => finishDuckCollectReveal(position)}
								/>
							{:else if animationKey}
								<LoopingAssetSprite
									{animationKey}
									{fallbackKey}
									restartKey={`${reelSymbol.rawSymbol.name}:${reelSymbol.symbolState}`}
									x={getX(reelIndex)}
									{y}
									anchor={{ x: 0.5, y: 0.5 }}
									width={SYMBOL_W * (isWin ? winPulse : 1) * (1 - SPIN_SQUEEZE * blur)}
									height={SYMBOL_H * (isWin ? winPulse : 1) * (1 + SPIN_STRETCH * blur)}
									alpha={(hasWinState && !isWin ? 0.35 : 1) * (1 - SPIN_FADE * blur)}
								/>
							{:else}
								<!-- The static base symbols: the ones that were dead on the board, so these carry
								     the idle breath, the rattle and the spin trail. -->
								{#if blur > 0.02}
									{#each SPIN_GHOSTS as ghost, ghostIndex (ghostIndex)}
										<Sprite
											key={fallbackKey}
											x={getX(reelIndex)}
											y={y + ghost.offset * SYMBOL_H * blur}
											anchor={{ x: 0.5, y: 0.5 }}
											width={SYMBOL_W * (1 - SPIN_SQUEEZE * blur)}
											height={SYMBOL_H * (1 + SPIN_STRETCH * blur)}
											alpha={ghost.alpha * blur}
										/>
									{/each}
								{/if}
								<!--
									DIMMED SYMBOLS FALL BACK TO THEIR ONE-PIECE STILL, and it is not an optimisation.

									A symbol assembled from parts is a container of overlapping sprites, and pixi
									fades a container by fading each CHILD — it does not render the group and fade
									that. So at 35% the duck's wing showed through its body at 58%, a bright patch
									exactly the shape of the tuck; the balloons did it wherever two of them crossed
									and the wheel wherever a gondola lay over the rim. Compositing the group to a
									texture would fix it and costs a filter per dimmed cell, which is not worth
									paying to animate something the player is being told to ignore. The still is the
									same picture, and it fades like every other dimmed symbol on the board.
								-->
								{@const dimmed = hasWinState && !isWin}
								<!--
									AND MID-SPIN FALLS BACK TO THE STILL FOR THE SAME REASON THE DIMMED ONE DOES.

									A blurred symbol is drawn squeezed, stretched, faded and trailing ghosts, so
									none of what a loose-part symbol is FOR survives the trip: the balloons cannot
									be seen nodding and the wheel cannot be seen turning at reel speed. What it
									costs is the whole reason the board freezes when a spin starts. A spinning reel
									carries its padding as well as its five cells, so the strip is about a hundred
									and thirty symbols; assembling every one of them from parts built ~2,450 display
									objects and their components in a single frame, measured as two back-to-back
									240ms frames on desktop Chrome at the moment of the click. As stills the same
									strip is one sprite a symbol, and the parts are assembled per reel as it lands.
								-->
								{@const assembled = !dimmed && blur < 0.02}
								{#if reelSymbol.rawSymbol.name === 'H3' && assembled}
									<!-- Assembled live rather than drawn, because these are BALLOONS: they nod on
									     their strings while the board idles and fly when the symbol wins. Same box
									     as the sprite it stands in for, so it ghosts, squeezes and breathes with
									     the rest of the board. -->
									<BalloonBunch
										x={getX(reelIndex)}
										{y}
										rotation={shake}
										tint={idle}
										width={SYMBOL_W * (isWin ? winPulse : 1) * (1 - SPIN_SQUEEZE * blur)}
										height={SYMBOL_H * (isWin ? winPulse : 1) * (1 + SPIN_STRETCH * blur)}
										alpha={(hasWinState && !isWin ? 0.35 : 1) * (1 - SPIN_FADE * blur)}
										baseKey={fallbackKey}
										clock={winClock}
										{idleClock}
										{blur}
										win={isWin}
									/>
								{:else if reelSymbol.rawSymbol.name === 'H1' && assembled}
									<!-- Assembled live rather than drawn, because there are PEOPLE in it: the two
									     riders in the back row wave, slowly at rest and harder when it wins. The
									     art it stands in for had both arms frozen up mid-cheer, which is the pose
									     a photograph of a wave has. Same box as the sprite, so it ghosts, squeezes
									     and breathes with the rest of the board. -->
									<CoasterCar
										x={getX(reelIndex)}
										{y}
										rotation={shake}
										tint={idle}
										width={SYMBOL_W * (isWin ? winPulse : 1) * (1 - SPIN_SQUEEZE * blur)}
										height={SYMBOL_H * (isWin ? winPulse : 1) * (1 + SPIN_STRETCH * blur)}
										alpha={(hasWinState && !isWin ? 0.35 : 1) * (1 - SPIN_FADE * blur)}
										carKey="tpCoasterCar"
										baseKey={fallbackKey}
										clock={winClock}
										{idleClock}
										{blur}
										phase={reelIndex * 0.83 + (symbolIndex - 1) * 1.27}
										win={isWin}
									/>
								{:else if reelSymbol.rawSymbol.name === 'H2' && assembled}
									<!-- Assembled live rather than drawn, because this one is a BIRD: its eyes
									     glance about while it sits there and its wing beats when it wins. Same
									     box as the sprite it stands in for, so it ghosts, squeezes and breathes
									     with the rest of the board. -->
									<DuckSymbol
										x={getX(reelIndex)}
										{y}
										rotation={shake}
										tint={idle}
										width={SYMBOL_W * (isWin ? winPulse : 1) * (1 - SPIN_SQUEEZE * blur)}
										height={SYMBOL_H * (isWin ? winPulse : 1) * (1 + SPIN_STRETCH * blur)}
										alpha={(hasWinState && !isWin ? 0.35 : 1) * (1 - SPIN_FADE * blur)}
										baseKey={fallbackKey}
										clock={winClock}
										{idleClock}
										{blur}
										win={isWin}
									/>
								{:else if reelSymbol.rawSymbol.name === 'H5' && assembled}
									<!-- Assembled live rather than drawn, because this one TURNS: slowly all the
									     time, and fast while it wins. Same box as the sprite it stands in for, so
									     it ghosts, squeezes and breathes with the rest of the board. -->
									<FerrisWheel
										x={getX(reelIndex)}
										{y}
										rotation={shake}
										tint={idle}
										width={SYMBOL_W * (isWin ? winPulse : 1) * (1 - SPIN_SQUEEZE * blur)}
										height={SYMBOL_H * (isWin ? winPulse : 1) * (1 + SPIN_STRETCH * blur)}
										alpha={(hasWinState && !isWin ? 0.35 : 1) * (1 - SPIN_FADE * blur)}
										clock={winClock}
										{idleClock}
										win={isWin}
									/>
								{:else}
									<Sprite
										key={fallbackKey}
										x={getX(reelIndex)}
										{y}
										anchor={{ x: 0.5, y: 0.5 }}
										rotation={shake}
										tint={idle}
										width={SYMBOL_W * (isWin ? winPulse : 1) * (1 - SPIN_SQUEEZE * blur)}
										height={SYMBOL_H * (isWin ? winPulse : 1) * (1 + SPIN_STRETCH * blur)}
										alpha={(hasWinState && !isWin ? 0.35 : 1) * (1 - SPIN_FADE * blur)}
									/>
								{/if}
								{#if fallbackKey.startsWith('tpWild')}
									<!-- The wild's letter, which its plate art deliberately does not carry: it is a
									     sprite of its own so that a win can pop it up from nothing. Sized and faded
									     exactly like the plate underneath, so it rides the same spin trail. -->
									<WildLetter
										x={getX(reelIndex)}
										{y}
										rotation={shake}
										width={SYMBOL_W * (isWin ? winPulse : 1) * (1 - SPIN_SQUEEZE * blur)}
										height={SYMBOL_H * (isWin ? winPulse : 1) * (1 + SPIN_STRETCH * blur)}
										clock={winClock}
										win={isWin}
										alpha={(hasWinState && !isWin ? 0.35 : 1) * (1 - SPIN_FADE * blur)}
									/>
								{/if}
								{#if reelSymbol.rawSymbol.name === 'H4' && (isWin || (blur < 0.02 && !hasWinState))}
									<!-- The one loose-part effect that also runs at rest: winning it pops the
									     whole heap, and a settled board drops a single kernel over the side of
									     the bucket every few seconds. Skipped mid-spin, where the bucket is a
									     ghost, and while another symbol is winning, where it would compete with
									     the presentation. -->
									<PopcornBurst
										x={getX(reelIndex)}
										{y}
										rotation={shake}
										width={SYMBOL_W * (isWin ? winPulse : 1)}
										height={SYMBOL_H * (isWin ? winPulse : 1)}
										clock={winClock}
										win={isWin}
										{idleClock}
										phase={reelIndex * 0.23 + (symbolIndex - 1) * 0.41}
									/>
								{/if}
								{#if isWin && reelSymbol.rawSymbol.name === 'H1'}
									<!-- What the coaster car does instead of lighting a marquee run: sparks off
									     the rail under its back wheels. Behind the bulbs and in front of the
									     art. Win-only — a board of idling engines would be noise, and unlike
									     the Mega Wild below there can be a dozen of these on screen at once. -->
									<SymbolSparks
										x={getX(reelIndex)}
										{y}
										rotation={shake}
										width={SYMBOL_W * winPulse}
										height={SYMBOL_H * winPulse}
										clock={winClock}
										phase={reelIndex * 0.17 + (symbolIndex - 1) * 0.29}
									/>
								{/if}
								{#if fallbackKey.startsWith('tpMegaWild') && (isWin || blur < 0.02)}
									<!-- The locomotive plaque steams out of its funnel, WINNING OR NOT. It is
									     the rarest thing the base game puts on the reels — one cell, on a roller
									     trigger — so there is never a row of them to turn into noise, and a
									     stopped engine is the one thing on this board that reads as broken
									     rather than as still. <SymbolSteam> thins the resting plume itself.
									     Skipped mid-spin, where the plaque is a ghost the puffs cannot follow. -->
									<SymbolSteam
										x={getX(reelIndex)}
										{y}
										rotation={shake}
										width={SYMBOL_W * (isWin ? winPulse : 1)}
										height={SYMBOL_H * (isWin ? winPulse : 1)}
										clock={isWin ? winClock : idleClock}
										idle={!isWin}
										alpha={hasWinState && !isWin ? 0.35 : 1}
									/>
								{/if}
								{#if isWin || blur < 0.02}
									{@const bulbs = bulbsFor(reelSymbol.rawSymbol.name, fallbackKey)}
									<!-- Over the symbol, so the lit bulbs sit on the unlit ones drawn into it. A
									     winning sign chases hard; every other SETTLED one keeps a faint shimmer,
									     which is what stops a grid of marquee signs reading as unlit artwork. The
									     blur gate is why it does not run mid-spin: the symbols are stretched and
									     faded there, so a glow pinned to their still positions would come off the
									     bulbs it is meant to be lighting. -->
									{#if bulbs}
										<SymbolBulbs
											{bulbs}
											x={getX(reelIndex)}
											{y}
											rotation={shake}
											width={SYMBOL_W * (isWin ? winPulse : 1)}
											height={SYMBOL_H * (isWin ? winPulse : 1)}
											win={isWin}
											clock={isWin ? winClock : idleBulbClock}
											phase={reelIndex * 0.83 + (symbolIndex - 1) * 1.37}
											alpha={hasWinState && !isWin ? 0.35 : 1}
										/>
									{/if}
								{/if}
							{/if}
						</LandingSquish>
					{/if}
				{/each}
			{/if}
		{/each}
	</Container>
{/if}
