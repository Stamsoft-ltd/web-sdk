<script lang="ts" module>
	export type EmitterEventCoasterSetup =
		| {
				type: 'coasterSetupShow';
				pukes: { reel: number; row: number; multiplier: number }[];
				tiles: { reel: number; row: number; multiplier: number }[];
		  }
		| { type: 'coasterSetupHide' };
</script>

<script lang="ts">
	import { stateBet } from 'state-shared';
	import { onMount } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut, linear } from 'svelte/easing';
	import { Container, Graphics, PIXI, Sprite } from 'pixi-svelte';
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { waitForTimeout } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import {
		CELL_W,
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
		impact: CoasterImpact;
	};
	type CartState = 'happy' | 'vomit';
	type CoasterCart = {
		id: number;
		x: Tween<number>;
		y: number;
		state: CartState;
		direction: -1 | 1;
		visible: boolean;
		vomitTimeScale: number;
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
	let skipRequested = false;
	let skipAllowedAt = 0;
	let resolveSkip: () => void = () => {};
	let skipSignal: Promise<void> = Promise.resolve();
	let finalTiles: CoasterImpact[] = [];

	const ROWS = Array.from({ length: BOARD_DIMENSIONS.y }, (_, row) => row);
	const MIN_CART_GAP_UNITS = 1.35;
	const CART_GAP_VARIANCE_UNITS = 0.35;
	// Initial setup reveal only. Free-spin reel timing is owned elsewhere and remains unchanged.
	// Previous setup boost was 1.3; apply the requested further 1.3x increase (1.3 * 1.3).
	const SETUP_SPEED_BOOST = 1.69;
	const SEQUENCE_SPEED = 0.9 * SETUP_SPEED_BOOST;
	const DUCK_PLAYBACK_SPEED = 4.5 * SETUP_SPEED_BOOST;
	const VOMIT_SOURCE_MS = 4500;
	const VOMIT_CLIP_MS = Math.round(VOMIT_SOURCE_MS / DUCK_PLAYBACK_SPEED);
	const CART_SIZE = SYMBOL_H * 1.7;
	const TRACK_HEIGHT = SYMBOL_H * 0.18;
	const SCREEN_OVERSCAN = CART_SIZE * 0.72;

	const cellX = getBoardCellCenterX;
	const cellY = (row: number) => SYMBOL_H * (row + 0.5);
	const railY = (row: number) => cellY(row) + SYMBOL_H * 0.42;
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
				reel === BOARD_DIMENSIONS.x - 1
					? BOARD_SIDE_CONTENT_INSET
					: COASTER_WILD_GRID_INSET;
			for (const row of ROWS) {
				graphics.rect(
					CELL_W * reel + leftInset,
					SYMBOL_H * row + COASTER_WILD_GRID_INSET,
					CELL_W - leftInset - rightInset,
					SYMBOL_H - COASTER_WILD_GRID_INSET * 2,
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

	const resetSkip = () => {
		skipRequested = false;
		skipSignal = new Promise<void>((resolve) => (resolveSkip = resolve));
	};

	const finalTileMap = () =>
		Object.fromEntries(
			finalTiles.map(({ reel, row, multiplier }) => [`${reel},${row}`, multiplier]),
		);

	const requestSkip = () => {
		if (!sequenceActive || skipRequested || performance.now() < skipAllowedAt) return;
		skipRequested = true;
		animationRun += 1;
		tilesMap = finalTileMap();
		carts.forEach((cart) => {
			cart.visible = false;
			cart.x.set(cart.x.current, { duration: 0 });
		});
		resolveSkip();
	};

	const runOrSkip = async (task: Promise<unknown>) => {
		const completed = await Promise.race([task.then(() => true), skipSignal.then(() => false)]);
		return completed && !skipRequested;
	};

	const finishSkippedSequence = () => {
		tilesMap = finalTileMap();
		carts.forEach((cart) => (cart.visible = false));
		sequenceActive = false;
	};

	onMount(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.code !== 'Space' || !sequenceActive) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			requestSkip();
		};
		const onClick = (event: MouseEvent) => {
			if (!sequenceActive) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			requestSkip();
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
	const buildRoutes = (pukes: CoasterImpact[]): CoasterRoute[] =>
		ROWS.flatMap((row) => {
			const direction = rowDirection(row);
			const impacts = pukes
				.filter((impact) => impact.row === row)
				.sort((a, b) => direction * (a.reel - b.reel) || a.multiplier - b.multiplier);
			let launchDelayUnits = 0;
			return impacts.map((impact, lane) => {
				if (lane > 0) {
					launchDelayUnits += MIN_CART_GAP_UNITS + Math.random() * CART_GAP_VARIANCE_UNITS;
				}
				return { row, launchDelayUnits, impact };
			});
		});

	const drive = async ({
		cart,
		x,
		duration,
		run,
	}: {
		cart: CoasterCart;
		x: number;
		duration: number;
		run: number;
	}) => {
		if (run !== animationRun) return false;
		await cart.x.set(x, { duration, easing: linear });
		return run === animationRun;
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
			name: 'sfx_reel_stop_3',
			forcePlay: true,
		});
		void (async () => {
			await tileScale.set(1.24, { duration: timing.pulseUp, easing: cubicOut });
			await tileScale.set(1, { duration: timing.pulseDown, easing: cubicOut });
		})();
	};

	const durationForDistance = (fromX: number, toX: number, timing: CoasterTiming) =>
		Math.round((Math.abs(toX - fromX) / CELL_W) * timing.cell);

	const waitForRouteTime = async (startedAt: number, targetMs: number, run: number) => {
		const remaining = Math.round(targetMs - (performance.now() - startedAt));
		if (remaining > 0 && !(await runOrSkip(waitForTimeout(remaining)))) return false;
		return run === animationRun;
	};

	const driveRoute = async (
		cart: CoasterCart,
		route: CoasterRoute,
		run: number,
		timing: CoasterTiming,
	) => {
		const direction = rowDirection(route.row);
		const startX = direction === 1 ? trackLeft : trackRight;
		const endX = direction === 1 ? trackRight : trackLeft;
		const clipPlaybackMs = Math.round(VOMIT_CLIP_MS * timing.factor);
		const impactAt = durationForDistance(startX, cellX(route.impact.reel), timing);
		const vomitStartAt = Math.max(0, impactAt - clipPlaybackMs * 0.5);
		const vomitEndAt = vomitStartAt + clipPlaybackMs;

		cart.visible = true;
		cart.direction = direction;
		cart.state = 'happy';
		cart.x.set(startX, { duration: 0 });
		if (run !== animationRun) return false;
		// One screen-edge-to-screen-edge linear tween. Vomiting is timed over the motion;
		// the cart never brakes at a reel, then accelerates again.
		const startedAt = performance.now();
		const movement = drive({
			cart,
			x: endX,
			duration: durationForDistance(startX, endX, timing),
			run,
		});
		if (!(await waitForRouteTime(startedAt, vomitStartAt, run))) return false;
		cart.state = 'vomit';
		if (!(await waitForRouteTime(startedAt, impactAt, run))) return false;
		pulseWild(route.impact, run, timing);
		if (!(await waitForRouteTime(startedAt, vomitEndAt, run))) return false;
		cart.state = 'happy';
		if (!(await movement)) return false;
		cart.visible = false;
		return run === animationRun;
	};

	context.eventEmitter.subscribeOnMount({
		coasterSetupShow: async (event) => {
			resetSkip();
			sequenceActive = true;
			skipAllowedAt = performance.now() + 140;
			finalTiles = event.tiles;
			const run = ++animationRun;
			const timing = timingForCurrentSpeed();
			show = true;
			tilesMap = {};
			tileScales = {};
			const routes = buildRoutes(event.pukes);
			carts = routes.map((route, id) => ({
				id,
				x: new Tween(rowDirection(route.row) === 1 ? trackLeft : trackRight),
				y: cartY(route.row),
				state: 'happy',
				direction: rowDirection(route.row),
				visible: false,
				vomitTimeScale: DUCK_PLAYBACK_SPEED / timing.factor,
			}));
			if (!(await runOrSkip(waitForTimeout(timing.intro)))) {
				finishSkippedSequence();
				return;
			}

			if (
				!(await runOrSkip(
					Promise.all(
						routes.map(async (route, index) => {
							if (!(await runOrSkip(waitForTimeout(route.launchDelayUnits * timing.stagger))))
								return;
							const cart = carts[index];
							if (!cart) return;
							await driveRoute(cart, route, run, timing);
						}),
					),
				))
			) {
				finishSkippedSequence();
				return;
			}

			carts.forEach((cart) => (cart.visible = false));
			if (!(await runOrSkip(waitForTimeout(timing.outro)))) {
				finishSkippedSequence();
				return;
			}
			sequenceActive = false;
		},
		coasterSetupHide: () => {
			animationRun += 1;
			sequenceActive = false;
			resolveSkip();
			show = false;
			tilesMap = {};
			tileScales = {};
			finalTiles = [];
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

<FadeContainer {show}>
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
						x={cart.x.current}
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
