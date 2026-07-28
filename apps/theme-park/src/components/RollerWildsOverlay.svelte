<script lang="ts" module>
	import type { RollerReel } from '../game/types';

	export type EmitterEventRollerWilds =
		| { type: 'rollerWildsShow'; reels: RollerReel[] }
		| { type: 'rollerWildsHide' };
</script>

<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut, linear } from 'svelte/easing';
	import { Container, Sprite } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';
	import { waitForTimeout } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import {
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
	let totalizedReels = $state<number[]>([]);
	let triggerReels = $state<RollerReel[]>([]);
	let expandedRows = $state<Record<number, number[]>>({});
	let displayedMultipliers = $state<Record<number, number>>({});
	let rowScales = $state<Record<string, Tween<number>>>({});
	let totalScales = $state<Record<number, Tween<number>>>({});
	let current = $state<RollerReel | null>(null);
	const carY = new Tween(-SYMBOL_H);
	const CAR_DESCENT_MS = 430;
	const MULTIPLIER_STEP_MS = 140;

	const multiplierFrames = (roller: RollerReel) => {
		if (roller.multiplier <= 1) return [1];
		if (roller.multipliers.length > 1) {
			const cumulative = roller.multipliers.reduce<number[]>((frames, entry) => {
				frames.push((frames.at(-1) ?? 0) + entry.multiplier);
				return frames;
			}, []);
			return [...new Set([1, ...cumulative, roller.multiplier])].filter(
				(value) => value <= roller.multiplier,
			);
		}
		const steps = Math.min(8, roller.multiplier - 1);
		return [
			1,
			...Array.from({ length: steps }, (_, index) =>
				Math.round(1 + ((roller.multiplier - 1) * (index + 1)) / steps),
			),
		];
	};

	context.eventEmitter.subscribeOnMount({
		rollerWildsShow: async (event) => {
			transformed = [];
			totalizedReels = [];
			triggerReels = event.reels;
			expandedRows = {};
			displayedMultipliers = {};
			rowScales = {};
			totalScales = {};
			current = null;
			for (const reel of event.reels) {
				current = reel;
				transformed = [...transformed, reel];
				expandedRows = { ...expandedRows, [reel.reel]: [] };
				displayedMultipliers = { ...displayedMultipliers, [reel.reel]: 1 };
				const startY = -SYMBOL_H * 0.72;
				const endY = BOARD_SIZES.height + SYMBOL_H * 0.72;
				carY.set(startY, { duration: 0 });
				const descent = carY.set(endY, {
					duration: CAR_DESCENT_MS,
					easing: linear,
				});
				let previousRevealMs = 0;

				for (let row = 0; row < BOARD_DIMENSIONS.y; row += 1) {
					const targetY = SYMBOL_H * (row + 0.5);
					const revealMs = ((targetY - startY) / (endY - startY)) * CAR_DESCENT_MS;
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
						await scale.set(1.1, { duration: 110, easing: cubicOut });
						await scale.set(1, { duration: 80, easing: cubicOut });
					})();
				}

				await descent;
				current = null;
				// All five cells enter as 1X, then count together to the final
				// reel multiplier. The math multiplier remains unchanged.
				await waitForTimeout(110);
				const totalScale = new Tween(0.9);
				totalScales = { ...totalScales, [reel.reel]: totalScale };
				totalizedReels = [...totalizedReels, reel.reel];
				for (const value of multiplierFrames(reel).slice(1)) {
					displayedMultipliers = { ...displayedMultipliers, [reel.reel]: value };
					context.eventEmitter.broadcast({
						type: 'soundOnce',
						name: 'sfx_reel_stop_2',
						forcePlay: true,
					});
					await waitForTimeout(MULTIPLIER_STEP_MS);
				}
				await totalScale.set(1.12, { duration: 160, easing: cubicOut });
				await totalScale.set(1, { duration: 100, easing: cubicOut });
			}
			// Keep the animation layer intact until the handler commits the
			// transformed board and explicitly sends rollerWildsHide.
			await waitForTimeout(180);
		},
		rollerWildsHide: () => {
			transformed = [];
			totalizedReels = [];
			triggerReels = [];
			expandedRows = {};
			displayedMultipliers = {};
			rowScales = {};
			totalScales = {};
			current = null;
		},
	});

	const cellX = (reel: number) => SYMBOL_W * (reel + 0.5);
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
			<!-- Two parallel rails per reel; only winning reels receive a cart. -->
			{#each Array.from({ length: BOARD_DIMENSIONS.x }, (_, reel) => reel) as reel (reel)}
				{#each [-0.38, 0.38] as railOffset (railOffset)}
					<Sprite
						key="rollerWildRail"
						x={cellX(reel) + SYMBOL_W * railOffset}
						y={BOARD_SIZES.height * 0.5}
						zIndex={5}
						anchor={0.5}
						width={SYMBOL_W * 0.12}
						height={BOARD_SIZES.height * 1.08}
					/>
				{/each}
			{/each}

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
						animationKey="rollerWildCarAnim"
						fallbackKey="rollerWildCar"
						restartKey={current.reel}
						anchor={0.5}
						width={SYMBOL_W * 1.55}
						height={SYMBOL_H * 1.65}
					/>
				</Container>
			{/if}

			{#each transformed as roller (roller.reel)}
				{#each Array.from({ length: BOARD_DIMENSIONS.y }, (_, row) => row) as row (row)}
					{@const totalized = totalizedReels.includes(roller.reel)}
					{#if expandedRows[roller.reel]?.includes(row)}
						<Container
							x={cellX(roller.reel)}
							y={cellY(row)}
							zIndex={10}
							scale={totalized
								? (totalScales[roller.reel]?.current ?? 1)
								: (rowScales[`${roller.reel},${row}`]?.current ?? 1)}
						>
							<CoasterWildBackground reel={roller.reel} {row} />
							<RollerMultiplierText text={`${displayedMultipliers[roller.reel] ?? 1}X`} />
						</Container>
					{/if}
				{/each}
			{/each}
		</Container>
	</MainContainer>
{/if}
