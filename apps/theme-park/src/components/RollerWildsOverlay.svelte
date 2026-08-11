<script lang="ts" module>
	import type { RollerReel } from '../game/types';

	export type EmitterEventRollerWilds =
		| { type: 'rollerWildsShow'; reels: RollerReel[] }
		| { type: 'rollerWildsHide' };
</script>

<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut, linear } from 'svelte/easing';
	import { onMount, tick } from 'svelte';
	import { Container, Graphics, PIXI, Sprite } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';
	import { waitForTimeout } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import {
		CELL_W,
		SYMBOL_W,
		SYMBOL_H,
		BOARD_DIMENSIONS,
		BOARD_SIZES,
		BOARD_GRID_OFFSET_Y,
		BOARD_SIDE_CONTENT_INSET,
		ROLLER_CAR_H,
		ROLLER_CAR_W,
		getBoardCellCenterX,
	} from '../game/constants';
	import CoasterWildBackground from './CoasterWildBackground.svelte';
	import LoopingSpineSprite from './LoopingSpineSprite.svelte';
	import RollerMultiplierCell from './RollerMultiplierCell.svelte';

	type RollerPhase =
		| 'hidden'
		| 'ready'
		| 'dropping'
		| 'contributions'
		| 'summing'
		| 'spreading'
		| 'settled';

	const context = getContext();
	const layout = $derived(context.stateGameDerived.boardLayout());

	let triggerReels = $state<RollerReel[]>([]);
	let phase = $state<RollerPhase>('hidden');
	let carYs = $state<Record<number, Tween<number>>>({});
	let revealedRows = $state<Record<number, number[]>>({});
	let finalizedRows = $state<Record<number, number[]>>({});
	let rowScales = $state<Record<string, Tween<number>>>({});
	let combineTweens = $state<Record<number, Tween<number>>>({});
	let totalAlphas = $state<Record<number, Tween<number>>>({});
	let totalScales = $state<Record<number, Tween<number>>>({});

	const ROWS = Array.from({ length: BOARD_DIMENSIONS.y }, (_, row) => row);
	const SPREAD_ORDER = [2, 1, 3, 0, 4];
	const CAR_START_Y = -ROLLER_CAR_H * 0.22;
	const CAR_END_Y = BOARD_SIZES.height + ROLLER_CAR_H * 0.46;
	const RIDE_CLIP_MS = 480;
	const CART_READY_MS = 180;
	const CAR_DESCENT_MS = 650;
	const RIDE_TIME_SCALE = RIDE_CLIP_MS / CAR_DESCENT_MS;
	const REEL_CENTER_Y = (SYMBOL_H * BOARD_DIMENSIONS.y) / 2;
	const GRID_LINE_CLEARANCE = 1.4;
	// BoardFrame is behind the reel stage. These outer clearances reserve the visible bulb/glow area
	// so the cart and rails appear to pass behind that frame instead of painting over it.
	const FRAME_LIGHT_CLEARANCE_X = 31;
	const FRAME_LIGHT_CLEARANCE_Y = 16;

	let sequenceActive = $state(false);
	let skipRequested = false;
	let resolveSkip: () => void = () => {};
	let skipSignal: Promise<void> = Promise.resolve();

	const resetSkip = () => {
		skipRequested = false;
		skipSignal = new Promise<void>((resolve) => (resolveSkip = resolve));
	};

	const requestSkip = () => {
		if (!sequenceActive || skipRequested) return;
		skipRequested = true;
		resolveSkip();
	};

	const runOrSkip = async (task: Promise<unknown>) => {
		const completed = await Promise.race([task.then(() => true), skipSignal.then(() => false)]);
		return completed && !skipRequested;
	};

	const contributionFor = (roller: RollerReel, row: number) => {
		const explicit = roller.multipliers.find((entry) => entry.row === row)?.multiplier;
		// Empty rows are neutral multipliers, not zero multipliers. The final applied reel value still
		// comes from the math event; 1X communicates that an empty row does not erase the combination.
		return explicit ?? 1;
	};

	const showFinalPresentation = () => {
		phase = 'settled';
		revealedRows = Object.fromEntries(triggerReels.map(({ reel }) => [reel, [...ROWS]]));
		finalizedRows = Object.fromEntries(triggerReels.map(({ reel }) => [reel, [...ROWS]]));
		rowScales = Object.fromEntries(
			triggerReels.flatMap(({ reel }) => ROWS.map((row) => [`${reel},${row}`, new Tween(1)])),
		);
		combineTweens = Object.fromEntries(triggerReels.map(({ reel }) => [reel, new Tween(1)]));
		totalAlphas = Object.fromEntries(triggerReels.map(({ reel }) => [reel, new Tween(1)]));
		totalScales = Object.fromEntries(triggerReels.map(({ reel }) => [reel, new Tween(1)]));
		context.stateGame.rollerClearedCells = triggerReels.flatMap(({ reel }) =>
			ROWS.map((row) => `${reel},${row}`),
		);
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

	context.eventEmitter.subscribeOnMount({
		rollerWildsShow: async (event) => {
			resetSkip();
			sequenceActive = true;
			triggerReels = event.reels;
			phase = 'ready';
			carYs = Object.fromEntries(event.reels.map(({ reel }) => [reel, new Tween(CAR_START_Y)]));
			revealedRows = {};
			finalizedRows = {};
			rowScales = {};
			combineTweens = {};
			totalAlphas = {};
			totalScales = {};
			// Leave the one landed Mega Wild visible. It is replaced only when the cart reaches its row.
			context.stateGame.rollerClearedCells = [];

			// All affected reels spawn a cart at the exact same top position and wave together.
			await tick();
			if (!(await runOrSkip(waitForTimeout(CART_READY_MS)))) {
				showFinalPresentation();
				return;
			}

			phase = 'dropping';
			const descents = event.reels.map(({ reel }) =>
				carYs[reel].set(CAR_END_Y, { duration: CAR_DESCENT_MS, easing: linear }),
			);
			let previousRevealMs = 0;

			// Every cart descends in lockstep. Each passed symbol becomes a visible row contribution.
			for (const row of ROWS) {
				const revealMs = ((cellY(row) - CAR_START_Y) / (CAR_END_Y - CAR_START_Y)) * CAR_DESCENT_MS;
				if (!(await runOrSkip(waitForTimeout(Math.max(0, revealMs - previousRevealMs))))) {
					showFinalPresentation();
					return;
				}
				previousRevealMs = revealMs;

				context.stateGame.rollerClearedCells = [
					...context.stateGame.rollerClearedCells,
					...event.reels.map(({ reel }) => `${reel},${row}`),
				];
				for (const roller of event.reels) {
					const rowKey = `${roller.reel},${row}`;
					const scale = new Tween(0.72);
					rowScales = { ...rowScales, [rowKey]: scale };
					revealedRows = {
						...revealedRows,
						[roller.reel]: [...(revealedRows[roller.reel] ?? []), row],
					};
					void (async () => {
						await scale.set(1.05, { duration: 120, easing: cubicOut });
						await scale.set(1, { duration: 90, easing: cubicOut });
					})();
				}
				context.eventEmitter.broadcast({
					type: 'soundOnce',
					name: 'sfx_reel_stop_2',
					forcePlay: true,
				});
			}

			if (!(await runOrSkip(Promise.all(descents)))) {
				showFinalPresentation();
				return;
			}
			phase = 'contributions';
			if (!(await runOrSkip(waitForTimeout(480)))) {
				showFinalPresentation();
				return;
			}

			// Sum all five row contributions into one value per reel, in parallel.
			combineTweens = Object.fromEntries(event.reels.map(({ reel }) => [reel, new Tween(0)]));
			totalAlphas = Object.fromEntries(event.reels.map(({ reel }) => [reel, new Tween(0)]));
			totalScales = Object.fromEntries(event.reels.map(({ reel }) => [reel, new Tween(0.68)]));
			phase = 'summing';
			context.eventEmitter.broadcast({
				type: 'soundOnce',
				name: 'sfx_scatter_win',
				forcePlay: true,
			});
			if (
				!(await runOrSkip(
					Promise.all([
						...event.reels.map(({ reel }) =>
							combineTweens[reel].set(1, { duration: 420, easing: cubicOut }),
						),
						...event.reels.map(({ reel }) =>
							totalAlphas[reel].set(1, { duration: 260, easing: cubicOut }),
						),
						...event.reels.map(({ reel }) =>
							totalScales[reel].set(1.14, { duration: 320, easing: cubicOut }),
						),
					]),
				))
			) {
				showFinalPresentation();
				return;
			}
			await Promise.all(
				event.reels.map(({ reel }) =>
					totalScales[reel].set(1, { duration: 130, easing: cubicOut }),
				),
			);
			if (!(await runOrSkip(waitForTimeout(320)))) {
				showFinalPresentation();
				return;
			}

			// Spread the summed value from the centre to all five cells on every affected reel.
			phase = 'spreading';
			for (const row of SPREAD_ORDER) {
				for (const roller of event.reels) {
					const rowKey = `${roller.reel},${row}`;
					const scale = new Tween(0.68);
					rowScales = { ...rowScales, [rowKey]: scale };
					finalizedRows = {
						...finalizedRows,
						[roller.reel]: [...(finalizedRows[roller.reel] ?? []), row],
					};
					void (async () => {
						await scale.set(1.08, { duration: 120, easing: cubicOut });
						await scale.set(1, { duration: 90, easing: cubicOut });
					})();
				}
				if (!(await runOrSkip(waitForTimeout(105)))) {
					showFinalPresentation();
					return;
				}
			}

			phase = 'settled';
			await runOrSkip(waitForTimeout(220));
			sequenceActive = false;
		},
		rollerWildsHide: () => {
			sequenceActive = false;
			resolveSkip();
			triggerReels = [];
			phase = 'hidden';
			carYs = {};
			revealedRows = {};
			finalizedRows = {};
			rowScales = {};
			combineTweens = {};
			totalAlphas = {};
			totalScales = {};
			context.stateGame.rollerClearedCells = [];
		},
	});

	const cellX = getBoardCellCenterX;
	const cellY = (row: number) => SYMBOL_H * (row + 0.5);
	const drawReelMask = (reel: number) => (graphics: PIXI.Graphics) => {
		const edgeShift = BOARD_SIDE_CONTENT_INSET * 0.5;
		const leftInset = reel === 0 ? FRAME_LIGHT_CLEARANCE_X - edgeShift : GRID_LINE_CLEARANCE;
		const rightInset =
			reel === BOARD_DIMENSIONS.x - 1 ? FRAME_LIGHT_CLEARANCE_X - edgeShift : GRID_LINE_CLEARANCE;
		for (const row of ROWS) {
			const topInset = row === 0 ? FRAME_LIGHT_CLEARANCE_Y : GRID_LINE_CLEARANCE;
			const bottomInset =
				row === BOARD_DIMENSIONS.y - 1 ? FRAME_LIGHT_CLEARANCE_Y : GRID_LINE_CLEARANCE;
			graphics.rect(
				-CELL_W * 0.5 + leftInset,
				SYMBOL_H * row + topInset,
				CELL_W - leftInset - rightInset,
				SYMBOL_H - topInset - bottomInset,
			);
		}
		graphics.fill(0xffffff);
	};
	const drawBoardContentMask = (graphics: PIXI.Graphics) => {
		for (let reel = 0; reel < BOARD_DIMENSIONS.x; reel += 1) {
			const leftInset = reel === 0 ? FRAME_LIGHT_CLEARANCE_X : GRID_LINE_CLEARANCE;
			const rightInset =
				reel === BOARD_DIMENSIONS.x - 1 ? FRAME_LIGHT_CLEARANCE_X : GRID_LINE_CLEARANCE;
			for (const row of ROWS) {
				const topInset = row === 0 ? FRAME_LIGHT_CLEARANCE_Y : GRID_LINE_CLEARANCE;
				const bottomInset =
					row === BOARD_DIMENSIONS.y - 1 ? FRAME_LIGHT_CLEARANCE_Y : GRID_LINE_CLEARANCE;
				graphics.rect(
					CELL_W * reel + leftInset,
					SYMBOL_H * row + topInset,
					CELL_W - leftInset - rightInset,
					SYMBOL_H - topInset - bottomInset,
				);
			}
		}
		graphics.fill(0xffffff);
	};
</script>

{#if triggerReels.length > 0}
	<MainContainer>
		<Container
			x={layout.x}
			y={layout.y + BOARD_GRID_OFFSET_Y}
			pivot={layout.pivot}
			scale={layout.boardScale}
			sortableChildren
		>
			<!-- Cell-cut mask exposes the one board-art grid beneath this feature. It also reserves the
			     outer bulb frame, so carts and multipliers cannot cross either side border. -->
			<Graphics isMask draw={drawBoardContentMask} />

			<!-- Rails exist only while a cart is on-screen. Passed cells repaint through their edges,
			     so no rail seam can remain beneath multiplier tiles. -->
			{#if phase === 'ready' || phase === 'dropping'}
				{#each triggerReels as roller (`track-${roller.reel}`)}
					<Container x={cellX(roller.reel)} zIndex={6}>
						<Graphics isMask draw={drawReelMask(roller.reel)} />
						{#each [-0.34, 0.34] as railOffset (railOffset)}
							<Sprite
								key="rollerWildRail"
								x={SYMBOL_W * railOffset}
								y={BOARD_SIZES.height * 0.5}
								anchor={0.5}
								width={SYMBOL_W * 0.12}
								height={BOARD_SIZES.height * 1.08}
							/>
						{/each}
					</Container>
				{/each}
			{/if}

			<!-- Every affected cart spawns on the same approved frontal art, then all 48 registered
			     release-to-vertical perspective frames play while the carts drop in lockstep. -->
			{#if phase === 'ready' || phase === 'dropping'}
				{#each triggerReels as roller (`cart-${roller.reel}`)}
					<Container x={cellX(roller.reel)} zIndex={30}>
						<!-- Fixed reel mask: cart stays behind outer lights and every slot border. -->
						<Graphics isMask draw={drawReelMask(roller.reel)} />
						<Container y={carYs[roller.reel]?.current ?? CAR_START_Y}>
							<LoopingSpineSprite
								assetKey="rollerWildCarSpine"
								animationName={phase === 'dropping' ? 'ride' : 'idle'}
								fallbackKey="rollerWildCarStill"
								width={ROLLER_CAR_W}
								height={ROLLER_CAR_H}
								timeScale={phase === 'dropping' ? RIDE_TIME_SCALE : 1}
								loop={false}
								restartKey={`${roller.reel}:${phase}`}
							/>
						</Container>
					</Container>
				{/each}
			{/if}

			{#each triggerReels as roller (roller.reel)}
				{@const ct = combineTweens[roller.reel]?.current ?? 0}

				<!-- Cart trail: every passed symbol is replaced with its row contribution. -->
				{#each ROWS as row (row)}
					{#if revealedRows[roller.reel]?.includes(row) && !finalizedRows[roller.reel]?.includes(row)}
						<Container
							x={cellX(roller.reel)}
							y={cellY(row)}
							zIndex={10}
							scale={rowScales[`${roller.reel},${row}`]?.current ?? 1}
						>
							<CoasterWildBackground reel={roller.reel} />
						</Container>
						<RollerMultiplierCell
							x={cellX(roller.reel)}
							y={cellY(row)}
							zIndex={22}
							contentOffsetY={(REEL_CENTER_Y - cellY(row)) * ct}
							contentScale={(rowScales[`${roller.reel},${row}`]?.current ?? 1) * 0.9}
							alpha={1 - ct}
							text={`${contributionFor(roller, row)}X`}
						/>
					{/if}
				{/each}

				<!-- The summed value appears once in the centre before spreading across the reel. -->
				{#if phase === 'summing' || phase === 'spreading'}
					<RollerMultiplierCell
						x={cellX(roller.reel)}
						y={REEL_CENTER_Y}
						zIndex={24}
						contentScale={totalScales[roller.reel]?.current ?? 1}
						alpha={totalAlphas[roller.reel]?.current ?? 0}
						text={`${roller.multiplier}X`}
					/>
				{/if}

				<!-- Final state: the summed multiplier itself fills the reel. Do not put Mega Wild art
				     behind it; Board takes over the same plaques so they can roll out unchanged. -->
				{#each ROWS as row (row)}
					{#if finalizedRows[roller.reel]?.includes(row)}
						<Container
							x={cellX(roller.reel)}
							y={cellY(row)}
							zIndex={18}
							scale={rowScales[`${roller.reel},${row}`]?.current ?? 1}
						>
							<CoasterWildBackground reel={roller.reel} />
							<RollerMultiplierCell text={`${roller.multiplier}X`} contentScale={0.9} />
						</Container>
					{/if}
				{/each}
			{/each}
		</Container>
	</MainContainer>
{/if}
