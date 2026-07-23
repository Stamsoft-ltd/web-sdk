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
	import { Tween } from 'svelte/motion';
	import { cubicOut, linear } from 'svelte/easing';
	import { BitmapText, Container, Sprite } from 'pixi-svelte';
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { waitForTimeout } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import {
		SYMBOL_W,
		SYMBOL_H,
		BOARD_DIMENSIONS,
		BOARD_SIZES,
		BOARD_GRID_OFFSET_Y,
	} from '../game/constants';
	import CoasterWildBackground from './CoasterWildBackground.svelte';

	type CoasterImpact = { reel: number; row: number; multiplier: number };
	type CoasterRoute = { impacts: CoasterImpact[]; lastTrackIndex: number };
	type CartState = 'happy' | 'vomit' | 'sick';
	type CoasterCart = {
		id: number;
		x: Tween<number>;
		y: Tween<number>;
		state: CartState;
		direction: -1 | 1;
		visible: boolean;
	};

	const context = getContext();
	const layout = $derived(context.stateGameDerived.boardLayout());
	let show = $state(false);
	let tilesMap = $state<Record<string, number>>({});
	let tileScales = $state<Record<string, Tween<number>>>({});
	let carts = $state<CoasterCart[]>([]);
	let tileMultiplierSteps: Record<string, number[]> = {};
	let tileHitCounts: Record<string, number> = {};
	let animationRun = 0;

	const cellX = (reel: number) => SYMBOL_W * (reel + 0.5);
	const cellY = (row: number) => SYMBOL_H * (row + 0.5);
	const RAIL_OFFSET_CELLS = 0.6;
	const CELL_TRAVEL_MS = 420;
	const CURVE_ENTRY_MS = 240;
	const CURVE_TRAVEL_MS = 900;
	const CURVE_STEPS = 16;
	const CART_STAGGER_MS = 1500;
	const railY = (row: number) => cellY(row) - SYMBOL_H * RAIL_OFFSET_CELLS;
	const rowDirection = (row: number): -1 | 1 => (row % 2 === 0 ? 1 : -1);
	const entryX = -SYMBOL_W * 0.72;
	const curveX = (direction: -1 | 1) =>
		direction === -1 ? -SYMBOL_W * 0.18 : BOARD_SIZES.width + SYMBOL_W * 0.18;
	const trackY = BOARD_SIZES.height * 0.5 - SYMBOL_H * 0.44;
	const TRACK_SOURCE_WIDTH = 795;
	const TRACK_FIRST_RAIL_X = 60;
	const TRACK_LAST_RAIL_X = 688;
	const TRACK_HORIZONTAL_OVERSCAN = 1.1;
	const trackScaleX =
		BOARD_SIZES.width / (TRACK_LAST_RAIL_X - TRACK_FIRST_RAIL_X);
	const baseTrackWidth = TRACK_SOURCE_WIDTH * trackScaleX;
	const baseTrackX = baseTrackWidth * 0.5 - TRACK_FIRST_RAIL_X * trackScaleX;
	const trackWidth = baseTrackWidth * TRACK_HORIZONTAL_OVERSCAN;
	const trackX =
		BOARD_SIZES.width * 0.5 +
		(baseTrackX - BOARD_SIZES.width * 0.5) * TRACK_HORIZONTAL_OVERSCAN;
	const trackOverscanX = (trackWidth - baseTrackWidth) * 0.5;
	const trackCells = Array.from({ length: BOARD_DIMENSIONS.y }, (_, row) => {
		const reels = Array.from({ length: BOARD_DIMENSIONS.x }, (_, reel) => reel);
		if (rowDirection(row) === -1) reels.reverse();
		return reels.map((reel) => ({ reel, row }));
	}).flat();
	const trackIndexOf = (impact: CoasterImpact) =>
		trackCells.findIndex((cell) => cell.reel === impact.reel && cell.row === impact.row);

	// One route per math-provided puke: every duck vomits exactly once.
	const buildRoutes = (pukes: CoasterImpact[]) => {
		return pukes
			.map((impact, order) => ({ impact, order, trackIndex: trackIndexOf(impact) }))
			.filter(({ trackIndex }) => trackIndex >= 0)
			.sort((a, b) => a.trackIndex - b.trackIndex || a.order - b.order)
			.map(
				({ impact, trackIndex }): CoasterRoute => ({
					impacts: [impact],
					lastTrackIndex: trackIndex,
				}),
			);
	};

	const drive = async ({
		cart,
		x,
		y,
		duration,
		run,
	}: {
		cart: CoasterCart;
		x: number;
		y: number;
		duration: number;
		run: number;
	}) => {
		if (run !== animationRun) return false;
		await Promise.all([
			cart.x.set(x, { duration, easing: linear }),
			cart.y.set(y, { duration, easing: linear }),
		]);
		return run === animationRun;
	};

	const pulseWild = (impact: CoasterImpact, run: number) => {
		if (run !== animationRun) return;
		const key = `${impact.reel},${impact.row}`;
		const values = tileMultiplierSteps[key] ?? [impact.multiplier];
		const hitIndex = tileHitCounts[key] ?? 0;
		const multiplier = values[Math.min(hitIndex, values.length - 1)];
		tileHitCounts[key] = hitIndex + 1;
		tilesMap = { ...tilesMap, [key]: multiplier };
		const tileScale = tileScales[key] ?? new Tween(1);
		tileScales = { ...tileScales, [key]: tileScale };
		tileScale.set(0.72, { duration: 0 });
		context.eventEmitter.broadcast({
			type: 'soundOnce',
			name: 'sfx_reel_stop_3',
			forcePlay: true,
		});
		void (async () => {
			await tileScale.set(1.24, { duration: 220, easing: cubicOut });
			await tileScale.set(1, { duration: 170, easing: cubicOut });
		})();
	};

	const followRailBend = async (cart: CoasterCart, row: number, run: number) => {
		const direction = rowDirection(row);
		const centerX = direction === 1 ? BOARD_SIZES.width : 0;
		const centerY = railY(row) + SYMBOL_H * 0.5;
		const radiusX =
			SYMBOL_W * (direction === 1 ? 0.28 : 0.12) + trackOverscanX;
		if (
			!(await drive({
				cart,
				x: centerX,
				y: railY(row),
				duration: CURVE_ENTRY_MS,
				run,
			}))
		) {
			return false;
		}

		for (let step = 1; step <= CURVE_STEPS; step += 1) {
			const progress = step / CURVE_STEPS;
			const previousProgress = (step - 1) / CURVE_STEPS;
			const x = centerX + direction * Math.sin(Math.PI * progress) * radiusX;
			const y = railY(row) + SYMBOL_H * progress;
			const previousX =
				centerX + direction * Math.sin(Math.PI * previousProgress) * radiusX;
			const previousY = railY(row) + SYMBOL_H * previousProgress;
			const dx = x - previousX;
			const dy = y - previousY;

			cart.direction = dx < 0 ? -1 : 1;
			if (
				!(await drive({
					cart,
					x,
					y,
					duration: CURVE_TRAVEL_MS / CURVE_STEPS,
					run,
				}))
			) {
				return false;
			}
			if (Math.abs(dx) < Math.abs(dy) * 0.3) {
				cart.direction = direction === 1 ? -1 : 1;
			}
		}

		cart.y.set(centerY + SYMBOL_H * 0.5, { duration: 0 });
		return run === animationRun;
	};

	// A cart can own several ordered math placements. It never parks: each duck
	// turns green 2-5 cells early, drive-by vomits, and completes the full track.
	const driveDuckTo = async (cart: CoasterCart, impacts: CoasterImpact[], run: number) => {
		const impactsByTrackIndex = new Map(
			impacts.map((impact) => [trackIndexOf(impact), impact] as const),
		);
		const firstTargetIndex = Math.min(...impactsByTrackIndex.keys());
		const firstImpact = impactsByTrackIndex.get(firstTargetIndex);
		if (!firstImpact || firstTargetIndex < 0) return false;
		const greenTriggerIndexes = new Set<number>();
		let previousTargetIndex = -Infinity;
		for (const [targetIndex, impact] of impactsByTrackIndex) {
			const desiredLead = 2 + ((impact.reel + impact.row + cart.id + targetIndex) % 4);
			const availableLead = Number.isFinite(previousTargetIndex)
				? Math.max(2, targetIndex - previousTargetIndex - 2)
				: desiredLead;
			greenTriggerIndexes.add(targetIndex - Math.min(desiredLead, availableLead));
			previousTargetIndex = targetIndex;
		}
		const firstGreenIndex = Math.min(...greenTriggerIndexes);
		let returnYellowAtIndex = -1;

		cart.visible = true;
		cart.state = firstGreenIndex <= 0 ? 'sick' : 'happy';
		cart.direction = 1;
		cart.x.set(entryX, { duration: 0 });
		cart.y.set(railY(0), { duration: 0 });
		if (run !== animationRun) return false;

		for (let index = 0; index < trackCells.length; index += 1) {
			const cell = trackCells[index];
			const previous = trackCells[index - 1];

			if (previous && previous.row !== cell.row) {
				if (!(await followRailBend(cart, previous.row, run))) return false;
			}

			cart.direction = rowDirection(cell.row);
			if (index === returnYellowAtIndex) cart.state = 'happy';
			if (greenTriggerIndexes.has(index)) cart.state = 'sick';

			const impact = impactsByTrackIndex.get(index);
			const movement = drive({
				cart,
				x: cellX(cell.reel),
				y: railY(cell.row),
				duration: CELL_TRAVEL_MS,
				run,
			});

			if (impact) {
				cart.state = 'vomit';
				returnYellowAtIndex = index + 1;
				await waitForTimeout(Math.round(CELL_TRAVEL_MS * 0.78));
				if (run !== animationRun) return false;
				pulseWild(impact, run);
			}

			if (!(await movement)) return false;
		}

		// Full-route exit: every cart clears the bottom-right end of the rail.
		if (cart.state === 'vomit') cart.state = 'happy';
		cart.direction = 1;
		if (
			!(await drive({
				cart,
				x: BOARD_SIZES.width + SYMBOL_W,
				y: railY(BOARD_DIMENSIONS.y - 1),
				duration: CELL_TRAVEL_MS * 1.5,
				run,
			}))
		) {
			return false;
		}
		cart.visible = false;
		return run === animationRun;
	};

	context.eventEmitter.subscribeOnMount({
		coasterSetupShow: async (event) => {
			const run = ++animationRun;
			show = true;
			tilesMap = {};
			tileScales = {};
			tileMultiplierSteps = event.pukes.reduce<Record<string, number[]>>((steps, impact) => {
				const key = `${impact.reel},${impact.row}`;
				steps[key] = [...(steps[key] ?? []), impact.multiplier];
				return steps;
			}, {});
			Object.values(tileMultiplierSteps).forEach((values) => values.sort((a, b) => a - b));
			tileHitCounts = {};
			const routes = buildRoutes(event.pukes);
			carts = routes.map((_, id) => ({
				id,
				x: new Tween(entryX),
				y: new Tween(railY(0)),
				state: 'happy',
				direction: 1,
				visible: false,
			}));
			await waitForTimeout(320);

			await Promise.all(
				routes.map(async (route, index) => {
					await waitForTimeout(index * CART_STAGGER_MS);
					const cart = carts[index];
					if (!cart) return;
					await driveDuckTo(cart, route.impacts, run);
				}),
			);

			carts.forEach((cart) => (cart.visible = false));
			await waitForTimeout(550);
		},
		coasterSetupHide: () => {
			animationRun += 1;
			show = false;
			tilesMap = {};
			tileScales = {};
			tileMultiplierSteps = {};
			tileHitCounts = {};
			carts = [];
		},
	});

	const parseKey = (key: string) => {
		const [reel, row] = key.split(',').map(Number);
		return { reel, row };
	};
	const carAsset = (state: CartState) =>
		state === 'vomit'
			? 'coasterCarVomit'
			: state === 'sick'
				? 'coasterCarSick'
				: 'coasterCarHappy';
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
			{#each Object.entries(tilesMap) as [key, multiplier] (key)}
				{@const position = parseKey(key)}
				<Container
					x={cellX(position.reel)}
					y={cellY(position.row)}
					scale={tileScales[key]?.current ?? 1}
					zIndex={10}
				>
					<CoasterWildBackground reel={position.reel} row={position.row} />
					<Sprite
						key="tpCoasterWild"
						anchor={0.5}
						width={SYMBOL_W * 0.82}
						height={SYMBOL_H * 0.82}
					/>
					<Container y={SYMBOL_H * 0.18}>
						<BitmapText
							anchor={{ x: 0.5, y: 0.5 }}
							text={`${multiplier}X`}
							style={{ fontFamily: 'gold', fontSize: SYMBOL_H * 0.22 }}
						/>
					</Container>
				</Container>
			{/each}

			<Sprite
				key="coasterTrack"
				x={trackX}
				y={trackY}
				zIndex={20}
				anchor={0.5}
				width={trackWidth}
				height={BOARD_SIZES.height * 1.2}
				alpha={0.96}
			/>

			{#each carts as cart (cart.id)}
				{#if cart.visible}
					<Container
						x={cart.x.current}
						y={cart.y.current}
						scale={{ x: cart.direction, y: 1 }}
						zIndex={30 + cart.id}
					>
						<Sprite
							key={carAsset(cart.state)}
							anchor={0.5}
							width={SYMBOL_W * 1.08}
							height={SYMBOL_H * 1.27}
						/>
					</Container>
				{/if}
			{/each}
		</Container>
	</MainContainer>
</FadeContainer>
