<script lang="ts" module>
	import type { RawSymbol, Position } from '../game/types';

	export type EmitterEventBoard =
		| { type: 'boardSettle'; board: RawSymbol[][] }
		| { type: 'boardShow' }
		| { type: 'boardHide' }
		| { type: 'boardWithAnimateSymbols'; symbolPositions: Position[] }
		| { type: 'skipToAnticipation' };
</script>

<script lang="ts">
	import { Container, Graphics, Sprite } from 'pixi-svelte';
	import { OnPressFullScreen } from 'components-layout';

	import { getContext } from '../game/context';
	import { SYMBOL_W, SYMBOL_H, BOARD_DIMENSIONS, BOARD_GRID_OFFSET_Y } from '../game/constants';
	import { spriteKeyByName, bonusSpriteKeyByName, winSpriteKeyByName } from '../game/utils';
	import type { SymbolName } from '../game/types';

	const LOW_SYMBOLS_SET = new Set<SymbolName>(['L1', 'L2', 'L3', 'L4', 'L5']);

	const context = getContext();
	const board = $derived(context.stateGame.board);
	const layout = $derived(context.stateGameDerived.boardLayout());
	const isAnyReelSpinning = $derived(board.some((reel) => reel.reelState.motion !== 'stopped'));
	let show = $state(true);

	const activeMap = $derived(context.stateGame.bonusMode ? bonusSpriteKeyByName : spriteKeyByName);
	const getSpriteKey = (name: SymbolName, state?: string) => {
		if (state === 'win') return winSpriteKeyByName[name] ?? activeMap[name] ?? 'tp_h1.png';
		return activeMap[name] ?? 'tp_h1.png';
	};

	const getX = (reelIndex: number) => SYMBOL_W * (reelIndex + 0.5);
	const getY = (rowIndex: number) => SYMBOL_H * (rowIndex + 0.5);
	const rollerReelSet = $derived(new Set(context.stateGame.activeRollerReels.map(({ reel }) => reel)));
	const coasterCellSet = $derived(
		new Set(context.stateGame.coasterTiles.map(({ reel, row }) => `${reel},${row}`)),
	);
	const getCellFrame = (reelIndex: number, rowIndex: number) => {
		const symbol = board[reelIndex]?.reelState.symbols[rowIndex + 1];
		const highlighted =
			symbol?.symbolState === 'win' ||
			rollerReelSet.has(reelIndex) ||
			coasterCellSet.has(`${reelIndex},${rowIndex}`);
		return highlighted ? 'cellBoxWin' : 'cellBox';
	};

	// True while any symbol is in 'win' state — used to dim non-winning symbols
	const hasWinState = $derived(
		context.stateGame.board.some((reel) =>
			reel.reelState.symbols.some((s) => s.symbolState === 'win'),
		),
	);

	// Reels whose symbols should be hidden behind the low-symbol expanded overlay.
	// Added one-by-one with a small delay so the overlay sprite starts drawing first.
	let hiddenReels = $state(new Set<number>());

	$effect(() => {
		const expanded = context.stateGame.expandedSymbol;
		// Reset when no expansion, non-low symbol, OR reels cleared for next spin
		if (!expanded || !LOW_SYMBOLS_SET.has(expanded.symbol) || expanded.reels.length === 0) {
			if (hiddenReels.size > 0) hiddenReels = new Set<number>();
			return;
		}
		const lastReel = expanded.reels[expanded.reels.length - 1];
		if (hiddenReels.has(lastReel)) return;
		const t = setTimeout(() => {
			hiddenReels = new Set([...hiddenReels, lastReel]);
		}, 80);
		return () => clearTimeout(t);
	});

	const hasActiveAnticipation = () => board.some((reel) => reel.reelState.anticipating);
	const stopReelsForSkip = () => {
		if (hasActiveAnticipation()) {
			context.stateGameDerived.enhancedBoard.forceStop();
			return;
		}
		context.stateGameDerived.enhancedBoard.stop();
	};
	const requestSpinSkip = () => {
		if (context.stateGame.awaitingFirstReveal) {
			context.stateGame.pendingStop = true;
			return;
		}
		if (context.stateGame.hasAnticipationPending && !hasActiveAnticipation()) {
			context.stateGame.hasAnticipationPending = false;
			context.eventEmitter.broadcast({ type: 'skipToAnticipation' });
			return;
		}
		context.eventEmitter.broadcast({ type: 'stopButtonClick' });
	};

	context.eventEmitter.subscribeOnMount({
		stopButtonClick: () => stopReelsForSkip(),
		skipToAnticipation: () => board.forEach((reel) => reel.stop()),
		boardSettle: ({ board }) => context.stateGameDerived.enhancedBoard.settle(board),
		boardShow: () => (show = true),
		boardHide: () => (show = false),
		boardWithAnimateSymbols: async ({ symbolPositions }) => {
			// Event positions use VISIBLE coordinates (row 0-4); the settled reel
			// symbols include 1 padding row on top (contract ROW_OFFSET = 1).
			const ROW_OFFSET = 1;
			for (const position of symbolPositions) {
				const reelSymbol =
					context.stateGame.board[position.reel].reelState.symbols[position.row + ROW_OFFSET];
				if (reelSymbol) reelSymbol.symbolState = 'win';
			}
		},
	});

	context.stateGameDerived.enhancedBoard.readyToSpinEffect();
</script>

{#if isAnyReelSpinning}
	<OnPressFullScreen onpress={requestSpinSkip} />
{/if}

{#if show}
	<Container
		x={layout.x}
		y={layout.y + BOARD_GRID_OFFSET_Y}
		pivot={layout.pivot}
		scale={layout.boardScale}
	>
		<Graphics
			isMask
			draw={(graphics) => {
				graphics.beginFill(0xffffff);
				graphics.rect(0, 0, SYMBOL_W * BOARD_DIMENSIONS.x, SYMBOL_H * BOARD_DIMENSIONS.y);
				graphics.endFill();
			}}
		/>
		<!-- Magnetic's stationary cell-board pattern: frames stay fixed while only
		     symbols move. This replaces translucent per-symbol Pixi rectangles. -->
		{#each Array.from({ length: BOARD_DIMENSIONS.x }, (_, reel) => reel) as reel (reel)}
			{#each Array.from({ length: BOARD_DIMENSIONS.y }, (_, row) => row) as row (row)}
				<Sprite
					key={getCellFrame(reel, row)}
					x={getX(reel)}
					y={getY(row)}
					anchor={0.5}
					width={SYMBOL_W * 0.98}
					height={SYMBOL_H * 0.98}
				/>
			{/each}
		{/each}
		{#each board as reel, reelIndex (reelIndex)}
			{#if !hiddenReels.has(reelIndex)}
				{#each reel.reelState.symbols as reelSymbol, symbolIndex (symbolIndex)}
					{@const y = reelSymbol.symbolY()}
					{@const isWin = reelSymbol.symbolState === 'win'}
					<Sprite
						key={getSpriteKey(reelSymbol.rawSymbol.name, reelSymbol.symbolState)}
						x={getX(reelIndex)}
						{y}
						anchor={{ x: 0.5, y: 0.5 }}
						width={SYMBOL_W}
						height={SYMBOL_H}
						alpha={hasWinState && !isWin ? 0.35 : 1}
						tint={isWin ? 0xffffff : 0xffffff}
					/>
				{/each}
			{/if}
		{/each}
	</Container>
{/if}
