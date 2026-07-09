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
	import { getSymbolInfo } from '../game/utils';

	const context = getContext();
	const board = $derived(context.stateGame.board);
	const spinBoard = $derived(context.stateGame.spinBoard);
	const boardMode = $derived(context.stateGame.boardMode);
	const layout = $derived(context.stateGameDerived.boardLayout());
	const flatCells = $derived(board.flatMap((reel) => reel));
	let show = $state(true);

	const getX = (reelIndex: number) => SYMBOL_W * (reelIndex + 0.5);
	const getStaticY = (rowIndex: number) => SYMBOL_H * (rowIndex + 0.5);
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
				graphics.rect(0, 0, SYMBOL_W * BOARD_DIMENSIONS.x, SYMBOL_H * BOARD_DIMENSIONS.y);
				graphics.fill(0xffffff);
			}}
		/>

		<!-- Stationary box grid — the cell boxes never move; only the symbols roll inside them.
		     Winning cells (settle mode) swap to the win-state box. -->
		{#each board as reel, reelIndex (reelIndex)}
			{#each reel as cell, rowIndex (cell.key)}
				<Sprite
					key={cell.highlighted || cell.locked ? 'cellBoxWin' : 'cellBox'}
					x={getX(reelIndex)}
					y={getStaticY(rowIndex)}
					anchor={0.5}
					width={SYMBOL_W}
					height={SYMBOL_H}
				/>
			{/each}
		{/each}

		{#if boardMode === 'spin'}
			<!-- ── Spin mode: clip reel symbols per unlocked cell. Locked cells get no reel window. ── -->
			{#each board as reelCells, reelIndex (reelIndex)}
				{#each reelCells.filter((cell) => !cell.locked) as clipCell (`${clipCell.key}:spin-window`)}
					<Container>
						<Graphics
							isMask
							draw={(graphics) => {
								graphics.rect(
									getX(reelIndex) - SYMBOL_W * 0.5,
									getStaticY(clipCell.position.row) - SYMBOL_H * 0.5,
									SYMBOL_W,
									SYMBOL_H,
								);
								graphics.fill(0xffffff);
							}}
						/>
						{#each spinBoard[reelIndex].reelState.symbols as reelSymbol, symbolIndex (symbolIndex)}
							{@const y = reelSymbol.symbolY()}
							{@const symbolInfo = getSymbolInfo({ rawSymbol: reelSymbol.rawSymbol, state: reelSymbol.symbolState })}
							<Sprite
								key={symbolInfo.assetKey}
								x={getX(reelIndex)}
								y={y}
								anchor={{ x: 0.5, y: 0.5 }}
								width={SYMBOL_W * symbolInfo.sizeRatios.width}
								height={SYMBOL_H * symbolInfo.sizeRatios.height}
								alpha={1}
							/>
						{/each}
					</Container>
				{/each}
			{/each}

			<!-- Locked cluster cells cover the closed reel windows, then render lock symbol above. -->
			{#each flatCells.filter((c) => c.locked) as cell (cell.key)}
				{@const x = getX(cell.position.reel)}
				{@const y = getStaticY(cell.position.row)}
				{@const symbolInfo = getSymbolInfo({ rawSymbol: cell, state: 'locked' })}
				{@const width = SYMBOL_W * symbolInfo.sizeRatios.width}
				{@const height = SYMBOL_H * symbolInfo.sizeRatios.height}
				<!-- Opaque full outer cell cover sits ABOVE spinning reels. -->
				<Rectangle
					{x}
					{y}
					anchor={0.5}
					width={SYMBOL_W}
					height={SYMBOL_H}
					backgroundColor={0x05070b}
					backgroundAlpha={1}
				/>
				<Sprite
					key="cellBoxWin"
					{x}
					{y}
					anchor={0.5}
					width={SYMBOL_W}
					height={SYMBOL_H}
				/>
				<Sprite
					key={symbolInfo.assetKey}
					{x}
					{y}
					anchor={{ x: 0.5, y: 0.5 }}
					{width}
					{height}
					alpha={1}
					tint={0xffffff}
				/>
			{/each}
		{:else}
			<!-- ── Settle/respin mode: render per-cell board with decorations ── -->

			<!-- Static background grid cells -->
			{#each board as reel, reelIndex (reelIndex)}
				{#each reel as cell, rowIndex (cell.key)}
					<Rectangle
						x={getX(reelIndex)}
						y={getStaticY(rowIndex)}
						anchor={0.5}
						width={SYMBOL_W}
						height={SYMBOL_H}
						backgroundColor={cell.locked ? 0x05070b : 0x0b0f18}
						backgroundAlpha={cell.locked ? 1 : context.stateGame.boardSpinning ? 0.18 : 0.1}
					/>
				{/each}
			{/each}

			<!-- Base symbols stay mounted even when a cell becomes locked; locked overlay covers them. -->
			{#each flatCells as cell (cell.key)}
				{@const x = cell.locked ? getX(cell.position.reel) : getX(cell.position.reel) + cell.displayX.current}
				{@const y = cell.locked ? getStaticY(cell.position.row) : cell.displayY.current}
				{@const symbolInfo = getSymbolInfo({ rawSymbol: cell, state: cell.locked ? 'locked' : cell.symbolState })}
				{@const width = SYMBOL_W * symbolInfo.sizeRatios.width * cell.displayScale.current}
				{@const height = SYMBOL_H * symbolInfo.sizeRatios.height * cell.displayScale.current}


				<Sprite
					key={symbolInfo.assetKey}
					x={x}
					y={y}
					anchor={{ x: 0.5, y: 0.5 }}
					{width}
					{height}
					alpha={cell.locked ? 1 : cell.displayAlpha.current}
					tint={0xffffff}
				/>
			{/each}

			<!-- Locked overlay: full outer cover + highlighted rectangle + top symbol. -->
			{#each flatCells.filter((c) => c.locked) as cell (`${cell.key}:locked`)}
				{@const x = getX(cell.position.reel)}
				{@const y = getStaticY(cell.position.row)}
				{@const symbolInfo = getSymbolInfo({ rawSymbol: cell, state: cell.symbolState === 'win' ? 'win' : 'locked' })}
				{@const width = SYMBOL_W * symbolInfo.sizeRatios.width * cell.displayScale.current}
				{@const height = SYMBOL_H * symbolInfo.sizeRatios.height * cell.displayScale.current}
				<Rectangle
					{x}
					{y}
					anchor={0.5}
					width={SYMBOL_W}
					height={SYMBOL_H}
					backgroundColor={0x05070b}
					backgroundAlpha={1}
				/>
				<Sprite
					key="cellBoxWin"
					{x}
					{y}
					anchor={0.5}
					width={SYMBOL_W}
					height={SYMBOL_H}
				/>
				<Sprite
					key={symbolInfo.assetKey}
					{x}
					{y}
					anchor={{ x: 0.5, y: 0.5 }}
					{width}
					{height}
					alpha={1}
					tint={0xffffff}
				/>
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
		{/if}
	</Container>
{/if}
