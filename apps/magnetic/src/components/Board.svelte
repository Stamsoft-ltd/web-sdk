<script lang="ts" module>
	import type { Position, RawSymbol } from '../game/types';

	export type EmitterEventBoard =
		| { type: 'boardSettle'; board: RawSymbol[][] }
		| { type: 'boardShow' }
		| { type: 'boardHide' }
		| { type: 'boardWithAnimateSymbols'; symbolPositions: Position[] };
</script>

<script lang="ts">
	import { BitmapText, Container, Graphics, Rectangle, Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { BOARD_DIMENSIONS, BOARD_GRID_OFFSET_Y, SYMBOL_H, SYMBOL_W } from '../game/constants';
	import { getSymbolInfo, shouldShowMultiplierText } from '../game/utils';

	const context = getContext();
	const board = $derived(context.stateGame.board);
	const layout = $derived(context.stateGameDerived.boardLayout());
	const magnetPulseKeys = $derived(new Set(context.stateGame.magnetPulseKeys));
	const reelSpinOffsets = $derived(context.stateGame.reelSpinOffsets);
	const flatCells = $derived(board.flatMap((reel) => reel));
	const orderedCells = $derived([
		...flatCells.filter((cell) => !cell.locked),
		...flatCells.filter((cell) => cell.locked),
	]);
	let show = $state(true);

	const getX = (reelIndex: number) => SYMBOL_W * (reelIndex + 0.5);
	const getY = (reelIndex: number, baseY: number) => baseY + reelSpinOffsets[reelIndex].current;

	context.eventEmitter.subscribeOnMount({
		stopButtonClick: () => {
			context.stateGameDerived.speedUpMotion();
		},
		boardSettle: ({ board }) => context.stateGameDerived.setBoardFromRaw({ rawBoard: board }),
		boardShow: () => (show = true),
		boardHide: () => (show = false),
		boardWithAnimateSymbols: async ({ symbolPositions }) => {
			await context.stateGameDerived.animateWinningPositions(symbolPositions);
		},
	});
</script>

{#if show}
	<Container x={layout.x} y={layout.y + BOARD_GRID_OFFSET_Y} pivot={layout.pivot} scale={layout.boardScale}>
		<Graphics
			isMask
			draw={(graphics) => {
				graphics.beginFill(0xffffff);
				graphics.rect(0, -SYMBOL_H * 2.5, SYMBOL_W * BOARD_DIMENSIONS.x, SYMBOL_H * (BOARD_DIMENSIONS.y + 2.5));
				graphics.endFill();
			}}
		/>
		{#each board as reel, reelIndex (reelIndex)}
			{#each reel as cell (cell.key)}
				{@const x = getX(reelIndex)}
				{@const y = getY(reelIndex, cell.displayY.current)}
				<Rectangle
					x={x - SYMBOL_W * 0.5}
					y={y - SYMBOL_H * 0.5}
					width={SYMBOL_W}
					height={SYMBOL_H}
					backgroundColor={cell.locked ? 0x102433 : 0x0b0f18}
					alpha={cell.locked ? 0.3 : context.stateGame.boardSpinning ? 0.18 : 0.1}
				/>
			{/each}
		{/each}

		{#each orderedCells as cell (cell.key)}
			{@const x = getX(cell.position.reel)}
			{@const y = getY(cell.position.reel, cell.displayY.current)}
			{@const symbolInfo = getSymbolInfo({ rawSymbol: cell, state: cell.symbolState })}
			{@const width = SYMBOL_W * symbolInfo.sizeRatios.width * cell.displayScale.current}
			{@const height = SYMBOL_H * symbolInfo.sizeRatios.height * cell.displayScale.current}
			{#if cell.locked}
				<Graphics
					draw={(graphics) => {
						graphics.clear();
						graphics.beginFill(0xffd76a, 0.16);
						graphics.drawRoundedRect(x - SYMBOL_W * 0.43, y - SYMBOL_H * 0.43, SYMBOL_W * 0.86, SYMBOL_H * 0.86, 16);
						graphics.endFill();
					}}
				/>
			{/if}
				{#if cell.target || cell.locked || cell.persistent || cell.highlighted || cell.fresh}
					<Graphics
						draw={(graphics) => {
							graphics.clear();
							const color = cell.highlighted
								? 0xfff2a8
								: cell.fresh
									? 0x8ef3ff
									: cell.persistent
										? 0x84d6ff
										: cell.target
											? 0x4bd9ff
											: 0xf6cb52;
							const width = cell.highlighted ? 6 : cell.fresh ? 5 : cell.persistent ? 5 : 4;
							graphics.lineStyle({ width, color, alpha: 0.95 });
							graphics.drawRoundedRect(x - SYMBOL_W * 0.44, y - SYMBOL_H * 0.44, SYMBOL_W * 0.88, SYMBOL_H * 0.88, 14);
						}}
					/>
				{/if}

			{#if magnetPulseKeys.has(cell.key)}
				<Graphics
					draw={(graphics) => {
						graphics.clear();
						graphics.lineStyle({ width: 8, color: 0xbff8ff, alpha: 0.8 });
						graphics.drawRoundedRect(x - SYMBOL_W * 0.48, y - SYMBOL_H * 0.48, SYMBOL_W * 0.96, SYMBOL_H * 0.96, 18);
					}}
				/>
			{/if}

			<Sprite
				key={symbolInfo.assetKey}
				x={x}
				y={y}
				anchor={{ x: 0.5, y: 0.5 }}
				width={width}
				height={height}
				alpha={cell.displayAlpha.current}
				tint={cell.locked ? 0xfff6d5 : 0xffffff}
			/>

			{#if shouldShowMultiplierText(cell)}
				<BitmapText
					anchor={0.5}
					x={x}
					y={y + SYMBOL_H * 0.26}
					text={`${cell.multiplier}X`}
					style={{ fontFamily: 'gold', fontSize: 20 }}
				/>
			{/if}

			{#if cell.name === 'MAGNET'}
				<BitmapText
					anchor={0.5}
					x={x}
					y={y - SYMBOL_H * 0.3}
					text="MAG"
					style={{ fontFamily: 'gold', fontSize: 16 }}
				/>
			{/if}

			{#if cell.locked}
				<BitmapText
					anchor={0.5}
					x={x}
					y={y + SYMBOL_H * 0.38}
					text="LOCK"
					style={{ fontFamily: 'gold', fontSize: 12 }}
				/>
			{/if}
		{/each}

		{#each context.stateGame.clusterWinBadges as badge (badge.id)}
			<BitmapText
				anchor={0.5}
				x={getX(badge.reel)}
				y={(badge.row + 0.08) * SYMBOL_H - SYMBOL_H * 0.34}
				text={badge.text}
				style={{ fontFamily: 'gold', fontSize: 18 }}
			/>
		{/each}
	</Container>
{/if}
