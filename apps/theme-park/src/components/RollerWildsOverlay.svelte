<script lang="ts" module>
	import type { RollerReel } from '../game/types';

	export type EmitterEventRollerWilds =
		| { type: 'rollerWildsShow'; reels: RollerReel[] }
		| { type: 'rollerWildsHide' };
</script>

<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut, linear } from 'svelte/easing';
	import { Container } from 'pixi-svelte';
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
	} from '../game/constants';
	import { getSpecialSymbolKey } from '../game/utils';
	import CoasterWildBackground from './CoasterWildBackground.svelte';
	import LoopingAssetSprite from './LoopingAssetSprite.svelte';
	import RollerMultiplierText from './RollerMultiplierText.svelte';

	const context = getContext();
	const layout = $derived(context.stateGameDerived.boardLayout());
	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const megaWildKey = $derived(getSpecialSymbolKey('megaWild', layoutType));

	let transformed = $state<RollerReel[]>([]);
	let combinedReels = $state<number[]>([]);
	let combineTweens = $state<Record<number, Tween<number>>>({});
	let totalAlphas = $state<Record<number, Tween<number>>>({});
	let triggerReels = $state<RollerReel[]>([]);
	let expandedRows = $state<Record<number, number[]>>({});
	let displayedMultipliers = $state<Record<number, number>>({});
	let rowScales = $state<Record<string, Tween<number>>>({});
	let totalScales = $state<Record<number, Tween<number>>>({});
	let current = $state<RollerReel | null>(null);
	// false while the car sits stationary (waving), true once it starts rolling down (excited/both-up)
	let carDropping = $state(false);
	const carY = new Tween(-SYMBOL_H);
	const CAR_DROP_IN_MS = 260;
	const STATIONARY_HOLD_MS = 480;
	const CAR_DESCENT_MS = 760;

	const REEL_CENTER_Y = (SYMBOL_H * BOARD_DIMENSIONS.y) / 2;

	context.eventEmitter.subscribeOnMount({
		rollerWildsShow: async (event) => {
			transformed = [];
			combinedReels = [];
			combineTweens = {};
			totalAlphas = {};
			triggerReels = event.reels;
			expandedRows = {};
			displayedMultipliers = {};
			rowScales = {};
			totalScales = {};
			current = null;
			carDropping = false;
			for (const reel of event.reels) {
				current = reel;
				carDropping = false; // stationary: waving car
				transformed = [...transformed, reel];
				expandedRows = { ...expandedRows, [reel.reel]: [] };
				displayedMultipliers = { ...displayedMultipliers, [reel.reel]: 1 };
				const startY = -SYMBOL_H * 0.72;
				const restY = SYMBOL_H * 0.5; // top row — the car sits here (visible) before it rolls down
				const endY = BOARD_SIZES.height + SYMBOL_H * 0.72;
				// Drop the car in from above to a visible rest spot and hold, so the duck reads before it
				// rolls down — it used to start off-screen and shoot straight through too fast to see.
				carY.set(startY, { duration: 0 });
				await carY.set(restY, { duration: CAR_DROP_IN_MS, easing: cubicOut });
				await waitForTimeout(STATIONARY_HOLD_MS);
				carDropping = true; // the roll begins: switch to the excited / both-wings-up car
				const descent = carY.set(endY, {
					duration: CAR_DESCENT_MS,
					easing: linear,
				});
				let previousRevealMs = 0;

				for (let row = 0; row < BOARD_DIMENSIONS.y; row += 1) {
					const targetY = SYMBOL_H * (row + 0.5);
					const revealMs = ((targetY - restY) / (endY - restY)) * CAR_DESCENT_MS;
					await waitForTimeout(Math.max(0, revealMs - previousRevealMs));
					previousRevealMs = revealMs;
					const rowKey = `${reel.reel},${row}`;
					const scale = new Tween(0.58);
					rowScales = { ...rowScales, [rowKey]: scale };
					expandedRows = {
						...expandedRows,
						[reel.reel]: [...(expandedRows[reel.reel] ?? []), row],
					};
					context.eventEmitter.broadcast({
						type: 'soundOnce',
						name: 'sfx_reel_stop_2',
						forcePlay: true,
					});
					void (async () => {
						await scale.set(1.03, { duration: 120, easing: cubicOut });
						await scale.set(1, { duration: 90, easing: cubicOut });
					})();
				}

				await descent;
				current = null;
				// The car has left the reel: every cell's multiplier slides to the reel centre and fades
				// while a single combined total (the reel multiplier) pops in there, then disappears.
				await waitForTimeout(120);
				const combineT = new Tween(0);
				combineTweens = { ...combineTweens, [reel.reel]: combineT };
				const totalAlpha = new Tween(0);
				totalAlphas = { ...totalAlphas, [reel.reel]: totalAlpha };
				const totalScale = new Tween(0.65);
				totalScales = { ...totalScales, [reel.reel]: totalScale };
				combinedReels = [...combinedReels, reel.reel];
				context.eventEmitter.broadcast({
					type: 'soundOnce',
					name: 'sfx_reel_stop_2',
					forcePlay: true,
				});
				void totalAlpha.set(1, { duration: 240, easing: cubicOut });
				void (async () => {
					await totalScale.set(1.14, { duration: 260, easing: cubicOut });
					await totalScale.set(1, { duration: 130, easing: cubicOut });
				})();
				await combineT.set(1, { duration: 300, easing: cubicOut });
				await waitForTimeout(320);
				await Promise.all([
					totalAlpha.set(0, { duration: 240, easing: cubicOut }),
					totalScale.set(1.4, { duration: 240, easing: cubicOut }),
				]);
			}
			// Keep the animation layer intact until the handler commits the
			// transformed board and explicitly sends rollerWildsHide.
			await waitForTimeout(180);
		},
		rollerWildsHide: () => {
			transformed = [];
			combinedReels = [];
			combineTweens = {};
			totalAlphas = {};
			triggerReels = [];
			expandedRows = {};
			displayedMultipliers = {};
			rowScales = {};
			totalScales = {};
			current = null;
			carDropping = false;
		},
	});

	const cellX = (reel: number) => CELL_W * (reel + 0.5);
	const cellY = (row: number) => SYMBOL_H * (row + 0.5);
</script>

{#if current || transformed.length}
	<MainContainer>
		<Container
			x={layout.x}
			y={layout.y + BOARD_GRID_OFFSET_Y}
			pivot={layout.pivot}
			scale={layout.boardScale}
			sortableChildren
		>

			<!-- Initial landed trigger stays Mega Wild until the cart replaces its row. -->
			{#each triggerReels as roller (`trigger-${roller.reel}`)}
				{#if !expandedRows[roller.reel]?.includes(roller.triggerRow)}
					<Container x={cellX(roller.reel)} y={cellY(roller.triggerRow)} zIndex={9}>
						<CoasterWildBackground reel={roller.reel} row={roller.triggerRow} />
						<LoopingAssetSprite
							animationKey="tpMegaWildAnim"
							fallbackKey={megaWildKey}
							restartKey={roller.reel}
							anchor={0.5}
							width={SYMBOL_W}
							height={SYMBOL_H}
						/>
					</Container>
				{/if}
			{/each}

			{#if current}
				<Container x={cellX(current.reel)} y={carY.current} zIndex={30}>
					<LoopingAssetSprite
						animationKey={carDropping ? 'rollerWildCarDropAnim' : 'rollerWildCarAnim'}
						fallbackKey="rollerWildCar"
						restartKey={`${current.reel}-${carDropping ? 'drop' : 'idle'}`}
						anchor={0.5}
						width={SYMBOL_W * 1.55}
						height={SYMBOL_H * 1.65}
					/>
				</Container>
			{/if}

			{#each transformed as roller (roller.reel)}
				{@const combining = combinedReels.includes(roller.reel)}
				{@const ct = combineTweens[roller.reel]?.current ?? 0}

				<!-- Wild boxes: one per revealed row, fixed to the cell (fade in, never scale/spill). -->
				{#each Array.from({ length: BOARD_DIMENSIONS.y }, (_, row) => row) as row (row)}
					{#if expandedRows[roller.reel]?.includes(row)}
						<Container
							x={cellX(roller.reel)}
							y={cellY(row)}
							zIndex={10}
							alpha={rowScales[`${roller.reel},${row}`]?.current ?? 1}
						>
							<CoasterWildBackground reel={roller.reel} {row} />
						</Container>
					{/if}
				{/each}

				<!-- Per-cell multipliers (left behind the car's trail). While combining they slide to the
				     reel centre and fade out. -->
				{#if ct < 1}
					{#each Array.from({ length: BOARD_DIMENSIONS.y }, (_, row) => row) as row (row)}
						{#if expandedRows[roller.reel]?.includes(row)}
							<Container
								x={cellX(roller.reel)}
								y={cellY(row) + (REEL_CENTER_Y - cellY(row)) * ct}
								zIndex={22}
								scale={combining ? 1 : (rowScales[`${roller.reel},${row}`]?.current ?? 1)}
								alpha={1 - ct}
							>
								<RollerMultiplierText text={`${displayedMultipliers[roller.reel] ?? 1}X`} />
							</Container>
						{/if}
					{/each}
				{/if}

				<!-- The combined total at the reel centre. -->
				{#if combining}
					<Container
						x={cellX(roller.reel)}
						y={REEL_CENTER_Y}
						zIndex={24}
						scale={totalScales[roller.reel]?.current ?? 1}
						alpha={totalAlphas[roller.reel]?.current ?? 0}
					>
						<RollerMultiplierText text={`${roller.multiplier}X`} />
					</Container>
				{/if}
			{/each}
		</Container>
	</MainContainer>
{/if}
