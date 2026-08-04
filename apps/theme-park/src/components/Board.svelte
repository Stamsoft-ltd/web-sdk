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
	import { CELL_W, SYMBOL_W, SYMBOL_H, BOARD_DIMENSIONS, BOARD_GRID_OFFSET_Y } from '../game/constants';
	import {
		spriteKeyByName,
		bonusSpriteKeyByName,
		winSpriteKeyByName,
		getSpecialSymbolKey,
	} from '../game/utils';
	import type { RawSymbol, SymbolName } from '../game/types';
	import LoopingAssetSprite from './LoopingAssetSprite.svelte';

	const LOW_SYMBOLS_SET = new Set<SymbolName>(['L1', 'L2', 'L3', 'L4', 'L5']);
	const WIN_ANIMATION_KEY_BY_NAME: Partial<Record<SymbolName, string>> = {
		H1: 'tpH1WinAnim',
		H2: 'tpH2WinAnim',
		H3: 'tpH3WinAnim',
		H4: 'tpH4WinAnim',
		H5: 'tpH5WinAnim',
		L1: 'tpL1WinAnim',
		L2: 'tpL2WinAnim',
		L3: 'tpL3WinAnim',
		L4: 'tpL4WinAnim',
		L5: 'tpL5WinAnim',
	};

	const context = getContext();
	const board = $derived(context.stateGame.board);
	const layout = $derived(context.stateGameDerived.boardLayout());
	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const isAnyReelSpinning = $derived(board.some((reel) => reel.reelState.motion !== 'stopped'));
	let show = $state(true);

	const activeMap = $derived(context.stateGame.bonusMode ? bonusSpriteKeyByName : spriteKeyByName);
	const getX = (reelIndex: number) => CELL_W * (reelIndex + 0.5);
	const rollerReelSet = $derived(
		new Set(context.stateGame.activeRollerReels.map(({ reel }) => reel)),
	);
	const coasterCellSet = $derived(
		new Set(context.stateGame.coasterTiles.map(({ reel, row }) => `${reel},${row}`)),
	);
	const isInitialRollerTriggerCell = (
		rawSymbol: RawSymbol,
		reelIndex: number,
		rowIndex: number,
	) => {
		if (rawSymbol.name !== 'W' || rollerReelSet.has(reelIndex)) return false;
		if (rawSymbol.rollerTrigger) return true;
		return (
			rowIndex === Math.floor(BOARD_DIMENSIONS.y / 2) &&
			(Boolean(rawSymbol.reelMultiplier) || Boolean(rawSymbol.multiplier))
		);
	};
	const isRollerMultiplierCell = (rawSymbol: RawSymbol, reelIndex: number, rowIndex: number) =>
		rawSymbol.name === 'W' &&
		rowIndex >= 0 &&
		rowIndex < BOARD_DIMENSIONS.y &&
		!rawSymbol.persistent &&
		!coasterCellSet.has(`${reelIndex},${rowIndex}`) &&
		!isInitialRollerTriggerCell(rawSymbol, reelIndex, rowIndex) &&
		(Boolean(rawSymbol.rollerTrigger) ||
			Boolean(rawSymbol.reelMultiplier) ||
			Boolean(rawSymbol.multiplier) ||
			rollerReelSet.has(reelIndex));
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
			if (isInitialRollerTriggerCell(rawSymbol, reelIndex, rowIndex))
				return getSpecialSymbolKey('megaWild', layoutType);
			return getSpecialSymbolKey('wild', layoutType);
		}
		if (name === 'S_DUCK') return getSpecialSymbolKey('duckScatter', layoutType);
		if (name === 'S_ROLLER') return getSpecialSymbolKey('rollerScatter', layoutType);
		if (name === 'S_COASTER') return getSpecialSymbolKey('coasterScatter', layoutType);
		if (state === 'win') return winSpriteKeyByName[name] ?? activeMap[name] ?? 'tpH1';
		return activeMap[name] ?? 'tpH1';
	};
	const getAnimationKey = (
		rawSymbol: RawSymbol,
		state: string | undefined,
		reelIndex: number,
		rowIndex: number,
	) => {
		if (rawSymbol.persistent || coasterCellSet.has(`${reelIndex},${rowIndex}`)) return undefined;
		if (rawSymbol.name === 'W') {
			if (isInitialRollerTriggerCell(rawSymbol, reelIndex, rowIndex))
				return state === 'win' ? 'tpMegaWildWinAnim' : 'tpMegaWildAnim';
			return 'tpWildAnim';
		}
		if (rawSymbol.name === 'S_DUCK')
			return state === 'win' ? 'tpDuckScatterWinAnim' : 'tpDuckScatterAnim';
		if (rawSymbol.name === 'S_ROLLER')
			return state === 'win' ? 'tpRollerScatterWinAnim' : 'tpRollerScatterAnim';
		if (rawSymbol.name === 'S_COASTER')
			return state === 'win' ? 'tpCoasterScatterWinAnim' : 'tpCoasterScatterAnim';
		return state === 'win' ? WIN_ANIMATION_KEY_BY_NAME[rawSymbol.name] : undefined;
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
				graphics.rect(0, 0, CELL_W * BOARD_DIMENSIONS.x, SYMBOL_H * BOARD_DIMENSIONS.y);
				graphics.endFill();
			}}
		/>
		<!-- The 5x5 grid is painted into board-lines.webp (see ART_GRID in <BoardFrame>, which sizes
		     the pad so its lines land on these cell boundaries). Stroking a second grid here only put
		     a gold line on top of the art's orange one. -->
		{#each board as reel, reelIndex (reelIndex)}
			{#if !hiddenReels.has(reelIndex)}
				{#each reel.reelState.symbols as reelSymbol, symbolIndex (symbolIndex)}
					{@const y = reelSymbol.symbolY()}
					{@const isWin = reelSymbol.symbolState === 'win'}
					<!-- The DC duck under an in-flight gift reveal is hidden — the animation replaces
					     it, and the duck art was showing through underneath. -->
					{@const underDuckReveal =
						context.stateGame.duckRevealPosition?.reel === reelIndex &&
						context.stateGame.duckRevealPosition?.row === symbolIndex - 1}
					{#if !underDuckReveal && !isRollerMultiplierCell(reelSymbol.rawSymbol, reelIndex, symbolIndex - 1)}
						{@const fallbackKey = getSpriteKey(
							reelSymbol.rawSymbol,
							reelSymbol.symbolState,
							reelIndex,
							symbolIndex - 1,
						)}
						{@const animationKey = getAnimationKey(
							reelSymbol.rawSymbol,
							reelSymbol.symbolState,
							reelIndex,
							symbolIndex - 1,
						)}
						{#if animationKey}
							<LoopingAssetSprite
								{animationKey}
								{fallbackKey}
								restartKey={`${reelSymbol.rawSymbol.name}:${reelSymbol.symbolState}`}
								x={getX(reelIndex)}
								{y}
								anchor={{ x: 0.5, y: 0.5 }}
								width={SYMBOL_W * (isWin ? winPulse : 1)}
								height={SYMBOL_H * (isWin ? winPulse : 1)}
								alpha={hasWinState && !isWin ? 0.35 : 1}
							/>
						{:else}
							<Sprite
								key={fallbackKey}
								x={getX(reelIndex)}
								{y}
								anchor={{ x: 0.5, y: 0.5 }}
								width={SYMBOL_W * (isWin ? winPulse : 1)}
								height={SYMBOL_H * (isWin ? winPulse : 1)}
								alpha={hasWinState && !isWin ? 0.35 : 1}
							/>
						{/if}
					{/if}
				{/each}
			{/if}
		{/each}
	</Container>
{/if}
