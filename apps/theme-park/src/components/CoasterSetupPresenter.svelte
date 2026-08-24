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
		BOARD_SIDE_CONTENT_INSET,
		COASTER_WILD_GRID_INSET,
		getBoardCellCenterX,
	} from '../game/constants';
	import CoasterWildTile from './CoasterWildTile.svelte';
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
	const DUCK_PLAYBACK_SPEED = 4.5 * SETUP_SPEED_BOOST;
	const VOMIT_SOURCE_MS = 4500;
	const VOMIT_CLIP_MS = Math.round(VOMIT_SOURCE_MS / DUCK_PLAYBACK_SPEED);
	const CART_SIZE = SYMBOL_H * 1.7;
	const TRACK_HEIGHT = SYMBOL_H * 0.18;
	const SCREEN_OVERSCAN = CART_SIZE * 0.72;

	const cellX = getBoardCellCenterX;
	const cellY = (row: number) => CELL_H * (row + 0.5);
	const railY = (row: number) => cellY(row) + CELL_H * 0.42;
	const cartY = (row: number) => railY(row) - SYMBOL_H * 0.62;
	const rowDirection = (row: number): -1 | 1 => (row % 2 === 0 ? 1 : -1);
	const boardScale = $derived(layout.boardScale || 1);
	const trackLeft = $derived((0 - layout.x) / boardScale + layout.pivot.x - SCREEN_OVERSCAN);
	const trackRight = $derived(
		(mainLayout.width - layout.x) / boardScale + layout.pivot.x + SCREEN_OVERSCAN,
	);
	const trackWidth = $derived(trackRight - trackLeft);
	const trackCenterX = $derived((trackLeft + trackRight) * 0.5);
	// Clip only the added Wild tiles, using the same cell-cut approach as Mega Wilds. Rails and carts
	// stay screen-wide while the authored BoardFrame grid and both side rails remain above the fill.
	const drawWildContentMask = (graphics: PIXI.Graphics) => {
		for (let reel = 0; reel < BOARD_DIMENSIONS.x; reel += 1) {
			const leftInset = reel === 0 ? BOARD_SIDE_CONTENT_INSET : COASTER_WILD_GRID_INSET;
			const rightInset =
				reel === BOARD_DIMENSIONS.x - 1 ? BOARD_SIDE_CONTENT_INSET : COASTER_WILD_GRID_INSET;
			for (const row of ROWS) {
				graphics.rect(
					CELL_W * reel + leftInset,
					CELL_H * row + COASTER_WILD_GRID_INSET,
					CELL_W - leftInset - rightInset,
					CELL_H - COASTER_WILD_GRID_INSET * 2,
				);
			}
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
				vomitStartAt: route.impact ? Math.max(0, impactAt - clipPlaybackMs * 0.5) : 0,
				vomitEndAt: route.impact
					? Math.max(0, impactAt - clipPlaybackMs * 0.5) + clipPlaybackMs
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

	const parseKey = (key: string) => {
		const [reel, row] = key.split(',').map(Number);
		return { reel, row };
	};
	const rigFallback = (state: CartState) =>
		state === 'vomit' ? 'coasterRigVomit' : 'coasterRigHappy';
</script>

<FadeContainer {show} zIndex={COASTER_SETUP_Z}>
	<CanvasSizeRectangle backgroundColor={0x11021b} backgroundAlpha={0.72} />
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
					y={railY(row)}
					zIndex={20}
					anchor={0.5}
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
							{multiplier}
							contentScale={tileScales[key]?.current ?? 1}
						/>
					</Container>
				{/each}
			</Container>

			{#each carts as cart (cart.id)}
				{#if cart.visible}
					<Container
						x={cart.x}
						y={cart.y}
						scale={{ x: cart.direction, y: 1 }}
						zIndex={30 + cart.id}
					>
						<!-- One rig: immutable cart back/front slots, moving duck between them. -->
						<LoopingSpineSprite
							assetKey="coasterVomitSpine"
							animationName={cart.state === 'vomit' ? 'vomit' : 'idle'}
							fallbackKey={rigFallback(cart.state)}
							width={CART_SIZE}
							height={CART_SIZE}
							timeScale={cart.state === 'vomit' ? cart.vomitTimeScale : 0}
							loop={true}
						/>
					</Container>
				{/if}
			{/each}
		</Container>
	</MainContainer>
</FadeContainer>
