<script lang="ts" module>
	export type EmitterEventCoasterSetup =
		| {
				type: 'coasterSetupShow';
				pukes: { reel: number; row: number; multiplier: number }[];
				tiles: { reel: number; row: number; multiplier: number }[];
				seed: number;
		  }
		| { type: 'coasterSetupHide' };
</script>

<script lang="ts">
	import { stateBet } from 'state-shared';
	import { onMount } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { Container, Graphics, PIXI, Sprite } from 'pixi-svelte';
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { waitForTimeout } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import {
		CELL_W,
		CELL_H,
		SYMBOL_H,
		BOARD_DIMENSIONS,
		BOARD_GRID_OFFSET_Y,
		COASTER_SETUP_SCRIM,
		getBoardCellCenterX,
	} from '../game/constants';
	import { getCoasterWildRect, toCoasterCellKeys } from '../game/coasterWildCells';
	import CoasterWildTile from './CoasterWildTile.svelte';
	import CoasterDriver from './CoasterDriver.svelte';
	import LoopingSpineSprite from './LoopingSpineSprite.svelte';

	type CoasterImpact = { reel: number; row: number; multiplier: number };
	type CoasterRoute = {
		row: number;
		launchDelayUnits: number;
		impact: CoasterImpact | null;
	};
	type CartState = 'happy' | 'vomit';
	type CoasterCart = {
		id: number;
		x: number;
		y: number;
		state: CartState;
		direction: -1 | 1;
		visible: boolean;
		vomitTimeScale: number;
		/** How far it has come, which is what <CoasterDriver> rolls its wheels off. */
		travelled: number;
	};
	type TimedRoute = CoasterRoute & {
		startX: number;
		endX: number;
		launchAt: number;
		movementDuration: number;
		impactAt: number;
		vomitStartAt: number;
		vomitEndAt: number;
		impactIndex: number;
	};
	type CoasterTiming = {
		factor: number;
		cell: number;
		stagger: number;
		intro: number;
		outro: number;
		pulseUp: number;
		pulseDown: number;
	};

	const context = getContext();
	const layout = $derived(context.stateGameDerived.boardLayout());
	const mainLayout = $derived(context.stateLayoutDerived.mainLayout());
	let show = $state(false);
	let tilesMap = $state<Record<string, number>>({});
	let tileScales = $state<Record<string, Tween<number>>>({});
	let carts = $state<CoasterCart[]>([]);
	let animationRun = 0;
	let sequenceActive = $state(false);
	let skipAllowedAt = 0;
	let totalImpactCount = 0;
	let sequenceStartedAt = 0;
	let timelineOffsetMs = 0;
	let finishRequested = false;
	let impactTimeline: { index: number; dueAt: number }[] = [];
	const requestedImpactIndexes = new Set<number>();
	const completedImpactIndexes = new Set<number>();

	const ROWS = Array.from({ length: BOARD_DIMENSIONS.y }, (_, row) => row);
	const MIN_CART_GAP_UNITS = 1.35;
	const CART_GAP_VARIANCE_UNITS = 0.35;
	const MIN_CART_COUNT = 15;
	const MAX_EXTRA_CARTS = 7;
	// Above BoardFrame's z6 rail: this presenter's dimmer darkens the border/lights too, while its
	// rails, carts and impacts remain bright inside the same layer.
	const COASTER_SETUP_Z = 7;
	// Initial setup reveal only. Free-spin reel timing is owned elsewhere and remains unchanged.
	// Previous setup boost was 1.3; apply the requested further 1.3x increase (1.3 * 1.3).
	const SETUP_SPEED_BOOST = 1.69;
	// Keep duck playback readable, but ease cart travel by 15% versus the previous route speed.
	const SEQUENCE_SPEED = 0.9 * SETUP_SPEED_BOOST * 0.85;
	// The 128-frame clip tells a three-beat story: yellow duck, duck turning green, then the vomit
	// itself (the stream is out from about 41% to 65% of the clip). Playing it inside 0.6s gave each
	// beat ~130ms and the whole thing read as one green flicker, so the window is now timed off the
	// story instead of off the cart: 1.9s leaves every beat around 0.4s and still fits in the ~2.7
	// cells of track the cart covers while it plays.
	const VOMIT_SOURCE_MS = 4500;
	const VOMIT_CLIP_MS = 1900;
	const DUCK_PLAYBACK_SPEED = VOMIT_SOURCE_MS / VOMIT_CLIP_MS;
	/**
	 * THE CLIP'S DEAD LEAD-IN, skipped.
	 *
	 * Its first nine of 128 poses are one frame held: measured off the atlas, every pair inside that
	 * run differs by less than the encoder's own noise, and real motion starts at pose 9. Handing
	 * over at pose 0 therefore parked a frozen duck on screen for the first ~130ms of the clip — and
	 * it froze on the beat the cart stopped driving, so the one thing that had been moving stopped at
	 * the same moment. That is the stuck frame (reported 2026-08-31).
	 *
	 * So the swap waits out that hold and the clip starts at pose 9, already moving. `vomitStartAt`
	 * below is pushed back by exactly the same amount, which is what keeps the stream landing on the
	 * authored impact: the duck drives for longer, it does not vomit any sooner.
	 */
	const VOMIT_LEAD = 9 / 128;
	const VOMIT_LEAD_SECONDS = (VOMIT_SOURCE_MS / 1000) * VOMIT_LEAD;
	const CART_SIZE = SYMBOL_H * 1.7;
	/** How far above the gold rail the cart's own middle sits. */
	const CART_ABOVE_RAIL = SYMBOL_H * 0.62;
	/**
	 * THE RIDE, which the rig has none of: `idle` in coaster_vomit.json is one held frame — the
	 * duck's 128 poses all belong to the vomit clip. So a cart crossing the board on its way to a
	 * Wild was a photograph being slid sideways (reviewer, 2026-08-28).
	 *
	 * It is the WHEELS that carry the ride now, and nothing else. The cart used to hop over sleepers
	 * and rock about the rail as well, on the theory that a jostled cart reads as a moving one; on
	 * screen it read as a toy being shaken, because a car on a rail does not leave the rail. What is
	 * left is a car that glides — see <CoasterDriver> for the wheels that turn under it and for the
	 * only thing that still moves on top of it.
	 *
	 * One rail joint of track, which is the beat the driver feels through the floor. It stays a
	 * DISTANCE rather than a time: a cart that has slowed feels the joints slowly, because what it
	 * is passing over is the track. Run off a timer every cart would shudder at one rate no matter
	 * how fast it was going, which is the thing that reads as an animation played on a sprite.
	 */
	const RAIL_JOINT = SYMBOL_H * 0.62;
	/** A cart's own offset into that beat, so five of them on five rails are never in step. */
	const RIDE_STAGGER = 0.37;
	// MEASURED off what Figma 7033:20310 actually paints, not off the node box: the rail image's box
	// is 34 tall but the art inside only inks 19 of a 91.4 row — magenta bar 9, posts 7, gold rail 4.
	// Taking the box for the drawing is what made the rail read twice as heavy as the design's.
	// 0.232 of a symbol is that 19 plus the transparent rows the PNG carries above and below it.
	const TRACK_HEIGHT = SYMBOL_H * 0.232;
	/**
	 * Where the GOLD RAIL sits in that art, as a fraction of its height — rows 32..39 of 41.
	 *
	 * The design lands that rail on the row boundary and hangs everything else off it, so that is
	 * what the sprite is anchored on; `trackY` is the boundary. The magenta bar then floats where
	 * the design has it instead of being placed itself and dragging the rail below the cell.
	 */
	const TRACK_RAIL_ANCHOR_Y = 35.5 / 41;
	const SCREEN_OVERSCAN = CART_SIZE * 0.72;

	const cellX = getBoardCellCenterX;
	const cellY = (row: number) => CELL_H * (row + 0.5);
	const railY = (row: number) => cellY(row) + CELL_H * 0.42;
	/** The row boundary the design's gold rail sits on. */
	const trackY = (row: number) => cellY(row) + CELL_H * 0.5;
	const cartY = (row: number) => railY(row) - CART_ABOVE_RAIL;
	const rowDirection = (row: number): -1 | 1 => (row % 2 === 0 ? 1 : -1);
	const boardScale = $derived(layout.boardScale || 1);
	const trackLeft = $derived((0 - layout.x) / boardScale + layout.pivot.x - SCREEN_OVERSCAN);
	const trackRight = $derived(
		(mainLayout.width - layout.x) / boardScale + layout.pivot.x + SCREEN_OVERSCAN,
	);
	const trackWidth = $derived(trackRight - trackLeft);
	const trackCenterX = $derived((trackLeft + trackRight) * 0.5);
	const parseKey = (key: string) => {
		const [reel, row] = key.split(',').map(Number);
		return { reel, row };
	};

	const stampedCells = $derived(Object.keys(tilesMap).map(parseKey));
	const occupiedCells = $derived(toCoasterCellKeys(stampedCells));
	// Clip only the added Wild tiles, using the same cell-cut approach as Mega Wilds. Rails and carts
	// stay screen-wide while the authored BoardFrame grid and both side rails remain above the fill.
	// Neighbouring Wilds share one opening so the board never shows through the divider between them.
	const drawWildContentMask = (graphics: PIXI.Graphics) => {
		for (const { reel, row } of stampedCells) {
			const { x, y, width, height } = getCoasterWildRect(reel, row, occupiedCells);
			graphics.rect(x, y, width, height);
		}
		graphics.fill(0xffffff);
	};

	const timingForCurrentSpeed = (): CoasterTiming => {
		// Base remains readable. Fast is ~2.4x quicker; super turbo is 5x quicker.
		const factor = stateBet.isSuperTurbo ? 0.2 : stateBet.isTurbo ? 0.42 : 1;
		return {
			factor,
			cell: Math.round((900 / SEQUENCE_SPEED) * factor),
			stagger: Math.round((940 / SEQUENCE_SPEED) * factor),
			intro: Math.round((260 / SETUP_SPEED_BOOST) * factor),
			outro: Math.round((380 / SETUP_SPEED_BOOST) * factor),
			pulseUp: Math.round((220 / SETUP_SPEED_BOOST) * factor),
			pulseDown: Math.round((170 / SETUP_SPEED_BOOST) * factor),
		};
	};

	const requestNextVomit = () => {
		if (!sequenceActive || performance.now() < skipAllowedAt) return;
		// Advance the shared route clock, not one cart. Every active and pending cart therefore jumps
		// forward by the same amount while decorative happy ducks remain synchronized.
		for (const { index, dueAt } of impactTimeline) {
			if (requestedImpactIndexes.has(index) || completedImpactIndexes.has(index)) continue;
			requestedImpactIndexes.add(index);
			const timelineNow = sequenceStartedAt
				? performance.now() - sequenceStartedAt + timelineOffsetMs
				: timelineOffsetMs;
			timelineOffsetMs += Math.max(0, dueAt - timelineNow);
			return;
		}
		// One more press after the final vomit removes trailing decorative carts and the outro.
		if (completedImpactIndexes.size < totalImpactCount) return;
		finishRequested = true;
		carts.forEach((cart) => (cart.visible = false));
	};

	onMount(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.code !== 'Space' || !sequenceActive) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			requestNextVomit();
		};
		const onClick = (event: MouseEvent) => {
			if (!sequenceActive) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			requestNextVomit();
		};
		window.addEventListener('keydown', onKeyDown, { capture: true });
		window.addEventListener('click', onClick, { capture: true });
		return () => {
			window.removeEventListener('keydown', onKeyDown, { capture: true });
			window.removeEventListener('click', onClick, { capture: true });
		};
	});

	// One authored puke = one duck = one 2x step. Repeated impacts on the same cell therefore use
	// separate ducks and reveal the book's ordered 2x -> 4x -> 8x progression.
	const seededValue = (seed: number, index: number, salt: number) => {
		let value = (seed | 0) ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(salt, 0x85ebca6b);
		value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
		value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
		return ((value ^ (value >>> 16)) >>> 0) / 0x1_0000_0000;
	};

	const buildRoutes = (pukes: CoasterImpact[], seed: number): CoasterRoute[] => {
		const impactRoutes = ROWS.flatMap((row) => {
			const direction = rowDirection(row);
			const impacts = pukes
				.filter((impact) => impact.row === row)
				.sort((a, b) => direction * (a.reel - b.reel) || a.multiplier - b.multiplier);
			return impacts.map((impact, lane) => {
				const launchDelayUnits =
					lane * (MIN_CART_GAP_UNITS + CART_GAP_VARIANCE_UNITS) +
					seededValue(seed, lane + row * 7, 1) * CART_GAP_VARIANCE_UNITS;
				return { row, launchDelayUnits, impact };
			});
		});
		const extraCount = Math.max(
			1,
			MIN_CART_COUNT +
				Math.floor(seededValue(seed, pukes.length, 2) * (MAX_EXTRA_CARTS + 1)) -
				impactRoutes.length,
		);
		const decorative = Array.from({ length: extraCount }, (_, index): CoasterRoute => {
			const row = Math.floor(seededValue(seed, index, 3) * ROWS.length);
			const earlierDecorativeOnRow = Array.from({ length: index }).filter(
				(_, earlier) => Math.floor(seededValue(seed, earlier, 3) * ROWS.length) === row,
			).length;
			const lane =
				impactRoutes.filter((route) => route.row === row).length + earlierDecorativeOnRow;
			return {
				row,
				launchDelayUnits:
					lane * (MIN_CART_GAP_UNITS + CART_GAP_VARIANCE_UNITS) +
					seededValue(seed, index, 4) * CART_GAP_VARIANCE_UNITS,
				impact: null,
			};
		});
		return [...impactRoutes, ...decorative].sort(
			(a, b) => a.launchDelayUnits - b.launchDelayUnits || a.row - b.row,
		);
	};

	const pulseWild = (impact: CoasterImpact, run: number, timing: CoasterTiming) => {
		if (run !== animationRun) return;
		const key = `${impact.reel},${impact.row}`;
		tilesMap = { ...tilesMap, [key]: impact.multiplier };
		const tileScale = tileScales[key] ?? new Tween(1);
		tileScales = { ...tileScales, [key]: tileScale };
		tileScale.set(0.72, { duration: 0 });
		context.eventEmitter.broadcast({
			type: 'soundOnce',
			name: 'sfx_coaster_duck_splash',
			forcePlay: true,
		});
		void (async () => {
			await tileScale.set(1.24, { duration: timing.pulseUp, easing: cubicOut });
			await tileScale.set(1, { duration: timing.pulseDown, easing: cubicOut });
		})();
	};

	const durationForDistance = (fromX: number, toX: number, timing: CoasterTiming) =>
		Math.round((Math.abs(toX - fromX) / CELL_W) * timing.cell);

	const completeImpact = (impactIndex: number) => {
		completedImpactIndexes.add(impactIndex);
		requestedImpactIndexes.delete(impactIndex);
	};

	const buildTimedRoutes = (routes: CoasterRoute[], timing: CoasterTiming): TimedRoute[] => {
		const clipPlaybackMs = Math.round(VOMIT_CLIP_MS * timing.factor);
		const timedRoutes = routes.map((route): TimedRoute => {
			const direction = rowDirection(route.row);
			const startX = direction === 1 ? trackLeft : trackRight;
			const endX = direction === 1 ? trackRight : trackLeft;
			const movementDuration = durationForDistance(startX, endX, timing);
			const impactAt = route.impact
				? durationForDistance(startX, cellX(route.impact.reel), timing)
				: Number.POSITIVE_INFINITY;
			return {
				...route,
				startX,
				endX,
				launchAt: route.launchDelayUnits * timing.stagger,
				movementDuration,
				impactAt,
				vomitStartAt: route.impact
					? Math.max(0, impactAt - clipPlaybackMs * (0.5 - VOMIT_LEAD))
					: 0,
				vomitEndAt: route.impact
					? Math.max(0, impactAt - clipPlaybackMs * (0.5 - VOMIT_LEAD)) +
						clipPlaybackMs * (1 - VOMIT_LEAD)
					: 0,
				impactIndex: -1,
			};
		});
		const orderedImpacts = timedRoutes
			.filter((route) => route.impact)
			.sort((a, b) => a.launchAt + a.impactAt - (b.launchAt + b.impactAt));
		orderedImpacts.forEach((route, index) => (route.impactIndex = index));
		impactTimeline = orderedImpacts.map((route) => ({
			index: route.impactIndex,
			dueAt: route.launchAt + route.impactAt,
		}));
		totalImpactCount = orderedImpacts.length;
		return timedRoutes;
	};

	const playTimeline = async (routes: TimedRoute[], run: number, timing: CoasterTiming) => {
		const timelineEnd = Math.max(
			0,
			...routes.map((route) => route.launchAt + route.movementDuration),
		);
		sequenceStartedAt = performance.now();
		while (run === animationRun && !finishRequested) {
			const timelineNow = performance.now() - sequenceStartedAt + timelineOffsetMs;
			for (let index = 0; index < routes.length; index += 1) {
				const route = routes[index];
				const cart = carts[index];
				if (!route || !cart) continue;
				const routeTime = timelineNow - route.launchAt;
				if (
					route.impact &&
					routeTime >= route.impactAt &&
					!completedImpactIndexes.has(route.impactIndex)
				) {
					pulseWild(route.impact, run, timing);
					completeImpact(route.impactIndex);
				}
				if (routeTime < 0 || routeTime >= route.movementDuration) {
					cart.visible = false;
					continue;
				}
				cart.visible = true;
				cart.x = route.startX + (route.endX - route.startX) * (routeTime / route.movementDuration);
				cart.travelled = Math.abs(cart.x - route.startX);
				cart.state =
					route.impact && routeTime >= route.vomitStartAt && routeTime < route.vomitEndAt
						? 'vomit'
						: 'happy';
			}
			if (timelineNow >= timelineEnd) return;
			await waitForTimeout(16);
		}
	};

	context.eventEmitter.subscribeOnMount({
		coasterSetupShow: async (event) => {
			sequenceActive = true;
			skipAllowedAt = performance.now() + 140;
			sequenceStartedAt = 0;
			timelineOffsetMs = 0;
			finishRequested = false;
			impactTimeline = [];
			requestedImpactIndexes.clear();
			completedImpactIndexes.clear();
			const run = ++animationRun;
			const timing = timingForCurrentSpeed();
			show = true;
			tilesMap = {};
			tileScales = {};
			const routes = buildRoutes(event.pukes, event.seed);
			const timedRoutes = buildTimedRoutes(routes, timing);
			carts = routes.map((route, id) => ({
				id,
				x: rowDirection(route.row) === 1 ? trackLeft : trackRight,
				y: cartY(route.row),
				state: 'happy',
				direction: rowDirection(route.row),
				visible: false,
				vomitTimeScale: DUCK_PLAYBACK_SPEED / timing.factor,
				travelled: 0,
			}));
			await waitForTimeout(timing.intro);
			if (run !== animationRun) return;

			await playTimeline(timedRoutes, run, timing);
			if (run !== animationRun) return;

			carts.forEach((cart) => (cart.visible = false));
			if (!finishRequested) await waitForTimeout(timing.outro);
			if (run !== animationRun) return;
			sequenceActive = false;
		},
		coasterSetupHide: () => {
			animationRun += 1;
			sequenceActive = false;
			show = false;
			tilesMap = {};
			tileScales = {};
			totalImpactCount = 0;
			sequenceStartedAt = 0;
			timelineOffsetMs = 0;
			finishRequested = false;
			impactTimeline = [];
			requestedImpactIndexes.clear();
			completedImpactIndexes.clear();
			carts = [];
		},
	});

	const rigFallback = (state: CartState) =>
		state === 'vomit' ? 'coasterRigVomit' : 'coasterRigHappy';
</script>

<FadeContainer {show} zIndex={COASTER_SETUP_Z}>
	<CanvasSizeRectangle
		backgroundColor={COASTER_SETUP_SCRIM.color}
		backgroundAlpha={COASTER_SETUP_SCRIM.alpha}
	/>
	<MainContainer>
		<Container
			x={layout.x}
			y={layout.y + BOARD_GRID_OFFSET_Y}
			pivot={layout.pivot}
			scale={layout.boardScale}
			sortableChildren
		>
			<!-- Five independent rails span the complete screen, not just the 5x5 board. -->
			{#each ROWS as row (row)}
				<Sprite
					key="coasterTrack"
					x={trackCenterX}
					y={trackY(row)}
					zIndex={20}
					anchor={{ x: 0.5, y: TRACK_RAIL_ANCHOR_Y }}
					width={trackWidth}
					height={TRACK_HEIGHT}
					alpha={0.96}
				/>
			{/each}

			<Container zIndex={10}>
				<Graphics isMask draw={drawWildContentMask} />
				{#each Object.entries(tilesMap) as [key, multiplier] (key)}
					{@const position = parseKey(key)}
					<Container x={cellX(position.reel)} y={cellY(position.row)}>
						<CoasterWildTile
							reel={position.reel}
							row={position.row}
							underScrim
							occupied={occupiedCells}
							{multiplier}
							contentScale={tileScales[key]?.current ?? 1}
						/>
					</Container>
				{/each}
			</Container>

			{#each carts as cart (cart.id)}
				{#if cart.visible}
					<Container x={cart.x} y={cart.y} zIndex={30 + cart.id}>
						<Container scale={{ x: cart.direction, y: 1 }}>
							<!-- Being SICK is the Spine rig's: 128 authored poses, and the only ones it
							     has. DRIVING is <CoasterDriver>'s, because `idle` there is a single held
							     frame and a cart crossing the board on it was a photograph being slid
							     sideways. The two are built into the same 256 frame at the same width on
							     the same ground line, so the handover does not move the cart.
							     The rig stays mounted through both and is only hidden, rather than being
							     created at the moment a duck turns green — a Spine built mid-feature is a
							     hitch on the beat the feature is about.

							     IT IS PARKED ON `vomit`, NOT ON `idle`, and that is the whole trick. A
							     Spine only repose on its own update, so switching the animation and the
							     alpha in the same breath showed one frame of whatever it had been holding
							     — `idle`, the dead frame — full-strength, right on the beat the duck turns
							     green (reported 2026-08-31). Held at timeScale 0 on the vomit clip it is
							     already posed at pose 0 of it, which is the yellow duck the loose rig was
							     fitted to in the first place (see build-coaster-vomit-spine.py, where
							     coaster-rig-happy.webp IS pose 0). There is nothing stale left to show:
							     the clip simply starts moving. Each cart is sick once per route, so the
							     clip never needs rewinding. -->
							<LoopingSpineSprite
								assetKey="coasterVomitSpine"
								animationName="vomit"
								fallbackKey={rigFallback(cart.state)}
								width={CART_SIZE}
								height={CART_SIZE}
								alpha={cart.state === 'vomit' ? 1 : 0}
								startTime={VOMIT_LEAD_SECONDS}
								timeScale={cart.state === 'vomit' ? cart.vomitTimeScale : 0}
								loop={true}
							/>
							{#if cart.state !== 'vomit'}
								<CoasterDriver
									width={CART_SIZE}
									height={CART_SIZE}
									travel={cart.travelled}
									joint={RAIL_JOINT}
									phase={cart.id * RIDE_STAGGER}
								/>
							{/if}
						</Container>
					</Container>
				{/if}
			{/each}
		</Container>
	</MainContainer>
</FadeContainer>
