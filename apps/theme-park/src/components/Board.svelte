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
	import { Container, Graphics, PIXI, Sprite } from 'pixi-svelte';
	import { OnPressFullScreen } from 'components-layout';
	import { onMount } from 'svelte';

	import { getContext } from '../game/context';
	import {
		CELL_W,
		CELL_H,
		SYMBOL_W,
		SYMBOL_H,
		BOARD_DIMENSIONS,
		BOARD_GRID_OFFSET_Y,
		BOARD_SIDE_CONTENT_INSET,
		getBoardCellCenterX,
	} from '../game/constants';
	import {
		spriteKeyByName,
		bonusSpriteKeyByName,
		winSpriteKeyByName,
		getSpecialSymbolKey,
	} from '../game/utils';
	import { duckLookForPosition, duckVariantForPosition } from '../game/duckVisual';
	import type { RawSymbol, SymbolName } from '../game/types';
	import DuckPondDuck from './DuckPondDuck.svelte';
	import LandingSquish from './LandingSquish.svelte';
	import LoopingAssetSprite from './LoopingAssetSprite.svelte';
	import MegaWildFullReel from './MegaWildFullReel.svelte';

	const LOW_SYMBOLS_SET = new Set<SymbolName>(['L1', 'L2', 'L3', 'L4', 'L5']);
	const DUCK_SYMBOL_SIZE = Math.min(SYMBOL_W, SYMBOL_H) * 1.04;
	// Keep reel pixels off the grid dividers. The one authored grid in BoardFrame then remains visible
	// through these narrow gaps without drawing a second set of lines above the board.
	const GRID_LINE_CLEARANCE = 1.4;
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
	const getX = getBoardCellCenterX;
	const drawBoardContentMask = (graphics: PIXI.Graphics) => {
		for (let reel = 0; reel < BOARD_DIMENSIONS.x; reel += 1) {
			const leftInset = reel === 0 ? BOARD_SIDE_CONTENT_INSET : GRID_LINE_CLEARANCE;
			const rightInset =
				reel === BOARD_DIMENSIONS.x - 1 ? BOARD_SIDE_CONTENT_INSET : GRID_LINE_CLEARANCE;
			for (let row = 0; row < BOARD_DIMENSIONS.y; row += 1) {
				graphics.rect(
					CELL_W * reel + leftInset,
					CELL_H * row + GRID_LINE_CLEARANCE,
					CELL_W - leftInset - rightInset,
					CELL_H - GRID_LINE_CLEARANCE * 2,
				);
			}
		}
		graphics.fill(0xffffff);
	};
	const coasterCellSet = $derived(
		new Set(context.stateGame.coasterTiles.map(({ reel, row }) => `${reel},${row}`)),
	);
	const duckCollectPrizeByCell = $derived(
		new Map(
			(context.stateGame.duckCollect?.revealed ?? []).map((prize) => [
				`${prize.position.reel},${prize.position.row}`,
				prize,
			]),
		),
	);
	const duckRevealCellSet = $derived(
		new Set(context.stateGame.duckRevealPositions.map(({ reel, row }) => `${reel},${row}`)),
	);
	const duckTurnedCellSet = $derived(
		new Set(context.stateGame.duckTurnedPositions.map(({ reel, row }) => `${reel},${row}`)),
	);
	const boardPosition = (reel: number, row: number): Position => ({ reel, row });
	const getDuckCollectPrize = (reel: number, row: number) =>
		duckCollectPrizeByCell.get(`${reel},${row}`) ?? null;
	const duckStyleSeed = (rawSymbol: RawSymbol) => rawSymbol.duckStyleSeed ?? 0;
	const duckVariant = (rawSymbol: RawSymbol, position: Position) =>
		rawSymbol.duckVariant ?? duckVariantForPosition(position, duckStyleSeed(rawSymbol));
	const duckLook = (rawSymbol: RawSymbol, position: Position) =>
		rawSymbol.duckLook ?? duckLookForPosition(position, duckStyleSeed(rawSymbol));
	const isDuckCollectRevealing = (reel: number, row: number) =>
		duckRevealCellSet.has(`${reel},${row}`);
	const isDuckCollectTurned = (reel: number, row: number) =>
		duckTurnedCellSet.has(`${reel},${row}`);
	const finishDuckCollectReveal = (position: Position) =>
		context.eventEmitter.broadcast({ type: 'duckCollectRevealComplete', position });
	// Cells the roller-wilds carts have passed. Board hides each old symbol in the same render that
	// the overlay replaces it with that row's multiplier contribution.
	const rollerClearedSet = $derived(new Set(context.stateGame.rollerClearedCells));
	const isInitialRollerTriggerCell = (
		rawSymbol: RawSymbol,
		_reelIndex: number,
		rowIndex: number,
	) => {
		if (rawSymbol.name !== 'W') return false;
		if (rawSymbol.rollerTrigger) return true;
		// Legacy books mark the centre trigger with `multiplier`. The settled reel uses the distinct
		// `reelMultiplier` field so it can remain a plaque while it physically rolls out next spin.
		return (
			rowIndex === Math.floor(BOARD_DIMENSIONS.y / 2) &&
			Boolean(rawSymbol.multiplier) &&
			!rawSymbol.reelMultiplier
		);
	};
	const isRollerMultiplierCell = (rawSymbol: RawSymbol, reelIndex: number, rowIndex: number) =>
		rawSymbol.name === 'W' &&
		Boolean(rawSymbol.reelMultiplier) &&
		rowIndex >= 0 &&
		rowIndex < BOARD_DIMENSIONS.y &&
		!rawSymbol.persistent &&
		!coasterCellSet.has(`${reelIndex},${rowIndex}`);
	const isRollerReelWinning = (reelIndex: number, reelMultiplier: number) =>
		board[reelIndex]?.reelState.symbols.some(
			(symbol) =>
				symbol.symbolState === 'win' && symbol.rawSymbol.reelMultiplier === reelMultiplier,
		) ?? false;
	const reelBounceDurationMs = (reelIndex: number) => {
		const options = board[reelIndex].reelState.spinOptions();
		return (CELL_H * options.reelBounceSizeMulti) / options.reelBounceBackSpeed;
	};
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
		if (name === 'DC')
			return `duckPondDuck${duckVariant(rawSymbol, { reel: reelIndex, row: rowIndex })}`;
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
			if (isInitialRollerTriggerCell(rawSymbol, reelIndex, rowIndex)) return undefined;
			return 'tpWildAnim';
		}
		if (rawSymbol.name === 'DC' || rawSymbol.name === 'S_DUCK') return undefined;
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
		<Graphics isMask draw={drawBoardContentMask} />
		<!-- The 5x5 grid exists only in board-lines.webp. The cell mask above leaves its exact dividers
		     and outer edges unobstructed instead of repainting a second grid at a higher layer. -->
		{#each board as reel, reelIndex (reelIndex)}
			{#if !hiddenReels.has(reelIndex)}
				{#each reel.reelState.symbols as reelSymbol, symbolIndex (symbolIndex)}
					{@const y = reelSymbol.symbolY()}
					{@const isWin = reelSymbol.symbolState === 'win'}
					{#if !rollerClearedSet.has(`${reelIndex},${symbolIndex - 1}`) && !coasterCellSet.has(`${reelIndex},${symbolIndex - 1}`)}
						{@const position = boardPosition(reelIndex, symbolIndex - 1)}
						{@const duckPrize = getDuckCollectPrize(reelIndex, symbolIndex - 1)}
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
						<!-- Keep one DC component mounted for front idle -> turn -> rear idle. No
						     Board/presenter swap, so variant, scale and timeline stay continuous. -->
						<!-- Settled Roller cells are the multiplier itself, not a Mega Wild symbol with a
						     badge over it. This lives inside the moving reel symbol loop, so the unchanged
						     plaques roll out naturally on the following spin. -->
						<LandingSquish
							trigger={reel.reelState.landingSequence}
							x={getX(reelIndex)}
							{y}
							durationMs={reelBounceDurationMs(reelIndex)}
						>
							{#if isRollerMultiplierCell(reelSymbol.rawSymbol, reelIndex, symbolIndex - 1)}
								{#if symbolIndex - 1 === Math.floor(BOARD_DIMENSIONS.y / 2)}
									<MegaWildFullReel
										x={getX(reelIndex)}
										{y}
										fakeMultiplier={reelSymbol.rawSymbol.reelMultiplier ?? 1}
										multiplier={reelSymbol.rawSymbol.reelMultiplier ?? 1}
										animationName={!reelSymbol.rawSymbol.rollerExpanded
											? 'intro'
											: isRollerReelWinning(reelIndex, reelSymbol.rawSymbol.reelMultiplier ?? 1)
												? 'win'
												: 'idle'}
										alpha={hasWinState &&
										!isRollerReelWinning(reelIndex, reelSymbol.rawSymbol.reelMultiplier ?? 1)
											? 0.35
											: 1}
									/>
								{/if}
							{:else if reelSymbol.rawSymbol.name === 'DC'}
								<DuckPondDuck
									x={getX(reelIndex)}
									{y}
									size={DUCK_SYMBOL_SIZE}
									variant={duckVariant(reelSymbol.rawSymbol, position)}
									look={duckLook(reelSymbol.rawSymbol, position)}
									prize={duckPrize ? { kind: duckPrize.kind, value: duckPrize.value } : null}
									revealing={isDuckCollectRevealing(reelIndex, symbolIndex - 1)}
									turned={isDuckCollectTurned(reelIndex, symbolIndex - 1)}
									batch={context.stateGame.duckRevealBatch}
									alpha={hasWinState && !isWin ? 0.35 : 1}
									onrevealcomplete={() => finishDuckCollectReveal(position)}
								/>
							{:else if animationKey}
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
						</LandingSquish>
					{/if}
				{/each}
			{/if}
		{/each}
	</Container>
{/if}
