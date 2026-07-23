<script lang="ts" module>
	import type { RollerReel } from '../game/types';

	export type EmitterEventRollerWilds =
		| { type: 'rollerWildsShow'; reels: RollerReel[] }
		| { type: 'rollerWildsHide' };
</script>

<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut, linear } from 'svelte/easing';
	import { BitmapText, Container, Sprite } from 'pixi-svelte';
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

	const context = getContext();
	const layout = $derived(context.stateGameDerived.boardLayout());
	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const megaWildKey = $derived(getSpecialSymbolKey('megaWild', layoutType));

	let transformed = $state<RollerReel[]>([]);
	let totalizedReels = $state<number[]>([]);
	let summingReels = $state<number[]>([]);
	let triggerReels = $state<RollerReel[]>([]);
	let expandedRows = $state<Record<number, number[]>>({});
	let rowScales = $state<Record<string, Tween<number>>>({});
	let totalScales = $state<Record<number, Tween<number>>>({});
	let current = $state<RollerReel | null>(null);
	const carY = new Tween(-SYMBOL_H);
	const sumScale = new Tween(1);
	const CAR_DESCENT_MS = 430;

	context.eventEmitter.subscribeOnMount({
		rollerWildsShow: async (event) => {
			transformed = [];
			totalizedReels = [];
			summingReels = [];
			triggerReels = event.reels;
			expandedRows = {};
			rowScales = {};
			totalScales = {};
			current = null;
			for (const reel of event.reels) {
				current = reel;
				transformed = [...transformed, reel];
				expandedRows = { ...expandedRows, [reel.reel]: [] };
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
				// Hold the row values, visibly add them, then stamp their total
				// onto all five Mega Wild cells.
				await waitForTimeout(110);
				summingReels = [...summingReels, reel.reel];
				sumScale.set(0.72, { duration: 0 });
				await sumScale.set(1.14, { duration: 150, easing: cubicOut });
				await sumScale.set(1, { duration: 100, easing: cubicOut });
				await waitForTimeout(280);
				summingReels = summingReels.filter((value) => value !== reel.reel);
				const totalScale = new Tween(0.9);
				totalScales = { ...totalScales, [reel.reel]: totalScale };
				totalizedReels = [...totalizedReels, reel.reel];
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
			summingReels = [];
			triggerReels = [];
			expandedRows = {};
			rowScales = {};
			totalScales = {};
			current = null;
		},
	});

	const cellX = (reel: number) => SYMBOL_W * (reel + 0.5);
	const cellY = (row: number) => SYMBOL_H * (row + 0.5);
	const rowMultiplier = (roller: RollerReel, row: number) =>
		roller.multipliers.find((entry) => entry.row === row)?.multiplier;
	const shouldCoverCell = (roller: RollerReel, row: number) =>
		context.stateGame.board[roller.reel]?.reelState.symbols[row + 1]?.rawSymbol.name === 'W';
	const sumExpression = (roller: RollerReel) =>
		`${roller.multipliers.map(({ multiplier }) => `${multiplier}X`).join(' + ')} = ${roller.multiplier}X`;
	const sumFontSize = (roller: RollerReel) =>
		SYMBOL_H * Math.max(0.095, 0.185 - sumExpression(roller).length * 0.0032);
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
			<!-- Hide only W cells already expanded by legacy math. Real symbols
			     remain visible until the cart reaches and replaces their row. -->
			{#each triggerReels as roller (`cover-${roller.reel}`)}
				{#each Array.from({ length: BOARD_DIMENSIONS.y }, (_, row) => row) as row (row)}
					{#if shouldCoverCell(roller, row) && !expandedRows[roller.reel]?.includes(row)}
						<Container x={cellX(roller.reel)} y={cellY(row)} zIndex={4}>
							<CoasterWildBackground reel={roller.reel} {row} />
						</Container>
					{/if}
				{/each}
			{/each}

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

			<!-- Cover the source W with the Mega Wild that triggers the reel expansion. -->
			{#each triggerReels as roller (`trigger-${roller.reel}`)}
				{#if !expandedRows[roller.reel]?.includes(roller.triggerRow)}
					<Container x={cellX(roller.reel)} y={cellY(roller.triggerRow)} zIndex={9}>
						<Sprite key={megaWildKey} anchor={0.5} width={SYMBOL_W} height={SYMBOL_H} />
					</Container>
				{/if}
			{/each}

			{#if current}
				<Container x={cellX(current.reel)} y={carY.current} zIndex={30}>
					<Sprite
						key="rollerWildCar"
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
							<Sprite key={megaWildKey} anchor={0.5} width={SYMBOL_W} height={SYMBOL_H} />
							{@const multiplier = totalized ? roller.multiplier : rowMultiplier(roller, row)}
							{#if multiplier}
								<Container
									x={totalized ? 0 : SYMBOL_W * 0.25}
									y={totalized ? SYMBOL_H * 0.29 : -SYMBOL_H * 0.29}
								>
									<Sprite
										key="forestBonusBadge"
										anchor={0.5}
										width={SYMBOL_W * (totalized ? 0.68 : 0.46)}
										height={SYMBOL_H * (totalized ? 0.34 : 0.3)}
									/>
									<BitmapText
										anchor={{ x: 0.5, y: 0.5 }}
										text={`${multiplier}X`}
										style={{
											fontFamily: 'gold',
											fontSize: SYMBOL_H * (totalized ? 0.2 : 0.16),
										}}
									/>
								</Container>
							{/if}
						</Container>
					{/if}
				{/each}

				{#if summingReels.includes(roller.reel)}
					<Container x={cellX(roller.reel)} y={cellY(2)} zIndex={22} scale={sumScale.current}>
						<Sprite
							key="forestBonusBadge"
							anchor={0.5}
							width={SYMBOL_W * 1.72}
							height={SYMBOL_H * 0.54}
						/>
						<BitmapText
							anchor={{ x: 0.5, y: 0.5 }}
							text={sumExpression(roller)}
							style={{
								fontFamily: 'gold',
								fontSize: sumFontSize(roller),
							}}
						/>
					</Container>
				{/if}
			{/each}
		</Container>
	</MainContainer>
{/if}
