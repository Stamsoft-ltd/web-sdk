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
	import { onMount } from 'svelte';

	import { getContext } from '../game/context';
	import { SYMBOL_W, SYMBOL_H, BOARD_DIMENSIONS, BOARD_GRID_OFFSET_Y } from '../game/constants';
	import {
		spriteKeyByName,
		bonusSpriteKeyByName,
		winSpriteKeyByName,
		getSpecialSymbolKey,
	} from '../game/utils';
	import type { RawSymbol, SymbolName } from '../game/types';

	const LOW_SYMBOLS_SET = new Set<SymbolName>(['L1', 'L2', 'L3', 'L4', 'L5']);

	const context = getContext();
	const board = $derived(context.stateGame.board);
	const layout = $derived(context.stateGameDerived.boardLayout());
	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const isAnyReelSpinning = $derived(board.some((reel) => reel.reelState.motion !== 'stopped'));
	let show = $state(true);

	const activeMap = $derived(context.stateGame.bonusMode ? bonusSpriteKeyByName : spriteKeyByName);
	const getX = (reelIndex: number) => SYMBOL_W * (reelIndex + 0.5);
	const rollerReelSet = $derived(
		new Set(context.stateGame.activeRollerReels.map(({ reel }) => reel)),
	);
	const coasterCellSet = $derived(
		new Set(context.stateGame.coasterTiles.map(({ reel, row }) => `${reel},${row}`)),
	);
	const getSpriteKey = (
		rawSymbol: RawSymbol,
		state: string | undefined,
		reelIndex: number,
		rowIndex: number,
	) => {
		const { name } = rawSymbol;
		if (name === 'W') {
			if (rawSymbol.persistent || coasterCellSet.has(`${reelIndex},${rowIndex}`))
				return 'tpCoasterWild';
			if (
				rawSymbol.rollerTrigger ||
				rawSymbol.reelMultiplier ||
				rawSymbol.multiplier ||
				rollerReelSet.has(reelIndex)
			)
				return getSpecialSymbolKey('megaWild', layoutType);
			return getSpecialSymbolKey('wild', layoutType);
		}
		if (name === 'S_DUCK') return getSpecialSymbolKey('duckScatter', layoutType);
		if (name === 'S_ROLLER') return getSpecialSymbolKey('rollerScatter', layoutType);
		if (name === 'S_COASTER') return getSpecialSymbolKey('coasterScatter', layoutType);
		if (state === 'win') return winSpriteKeyByName[name] ?? activeMap[name] ?? 'tpH1';
		return activeMap[name] ?? 'tpH1';
	};

	// True while any symbol is in 'win' state — used to dim non-winning symbols
	const hasWinState = $derived(
		context.stateGame.board.some((reel) =>
			reel.reelState.symbols.some((s) => s.symbolState === 'win'),
		),
	);
	let winPulse = $state(1);

	onMount(() => {
		let frame = 0;
		const started = performance.now();
		const tick = (now: number) => {
			winPulse = hasWinState ? 1.05 + Math.sin((now - started) * 0.012) * 0.06 : 1;
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	});

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
		<!-- One clean 5x5 gold grid over the Theme Park board. No per-cell frames. -->
		<Graphics
			draw={(graphics) => {
				for (let reel = 1; reel < BOARD_DIMENSIONS.x; reel += 1) {
					const x = SYMBOL_W * reel;
					graphics.moveTo(x, 0);
					graphics.lineTo(x, SYMBOL_H * BOARD_DIMENSIONS.y);
				}
				for (let row = 1; row < BOARD_DIMENSIONS.y; row += 1) {
					const y = SYMBOL_H * row;
					graphics.moveTo(0, y);
					graphics.lineTo(SYMBOL_W * BOARD_DIMENSIONS.x, y);
				}
				graphics.stroke({ width: 2.4, color: 0xf2b632, alpha: 0.96 });
			}}
		/>
		{#each board as reel, reelIndex (reelIndex)}
			{#if !hiddenReels.has(reelIndex)}
				{#each reel.reelState.symbols as reelSymbol, symbolIndex (symbolIndex)}
					{@const y = reelSymbol.symbolY()}
					{@const isWin = reelSymbol.symbolState === 'win'}
					<Sprite
						key={getSpriteKey(
							reelSymbol.rawSymbol,
							reelSymbol.symbolState,
							reelIndex,
							symbolIndex - 1,
						)}
						x={getX(reelIndex)}
						{y}
						anchor={{ x: 0.5, y: 0.5 }}
						width={SYMBOL_W * (isWin ? winPulse : 1)}
						height={SYMBOL_H * (isWin ? winPulse : 1)}
						alpha={hasWinState && !isWin ? 0.35 : 1}
						tint={isWin ? 0xffffff : 0xffffff}
					/>
				{/each}
			{/if}
		{/each}
	</Container>
{/if}
