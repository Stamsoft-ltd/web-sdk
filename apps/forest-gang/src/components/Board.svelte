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
	import { Container, Graphics, Rectangle, Sprite } from 'pixi-svelte';
	import { OnPressFullScreen } from 'components-layout';

	import { getContext } from '../game/context';
	import { SYMBOL_W, SYMBOL_H, SYMBOL_SIZE, BOARD_DIMENSIONS, BOARD_GRID_OFFSET_Y } from '../game/constants';
	import {
		spriteKeyByName,
		bonusSpriteKeyByName,
		winSpriteKeyByName,
		spriteKeyByNameLandscape,
		winSpriteKeyByNameLandscape,
	} from '../game/utils';
	import type { SymbolName } from '../game/types';

	const LOW_SYMBOLS_SET = new Set<SymbolName>(['T', 'J', 'Q', 'K', 'A']);

	const context = getContext();
	const board = $derived(context.stateGame.board);
	const layout = $derived(context.stateGameDerived.boardLayout());
	const isAnyReelSpinning = $derived(board.some((r) => r.reelState.motion !== 'stopped'));
	let show = $state(true);

	// Mobile-landscape uses dedicated framed symbol art; desktop/portrait keep the standard maps.
	const isLandscape = $derived(context.stateLayoutDerived.layoutType() === 'landscape');
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');
	const activeMap = $derived(
		isLandscape
			? spriteKeyByNameLandscape
			: context.stateGame.bonusMode
				? bonusSpriteKeyByName
				: spriteKeyByName,
	);
	const activeWinMap = $derived(isLandscape ? winSpriteKeyByNameLandscape : winSpriteKeyByName);
	const getSpriteKey = (name: SymbolName, state?: string) => {
		if (state === 'win') return activeWinMap[name] ?? activeMap[name] ?? activeMap.A;
		return activeMap[name] ?? activeMap.A;
	};

	const getX = (reelIndex: number) => SYMBOL_W * (reelIndex + 0.5);

	// Landscape spreads the reel pitch on each axis (boardScaleX/Y) to fill the panel. Compensate
	// each symbol's width/height so it renders at the uniform boardScale size (undistorted).
	const scaleX = $derived(layout.boardScaleX ?? layout.boardScale);
	const scaleY = $derived(layout.boardScaleY ?? layout.boardScale);
	// Desktop symbols carry a lot of built-in tile padding, so enlarge them to fill the cell more
	// (reduces the gaps between symbols). Landscape/portrait keep their own tuned sizing.
	const isDesktop = $derived(context.stateLayoutDerived.layoutType() === 'desktop');
	const SIZE_BOOST = $derived(isDesktop ? 1.1 : 1);
	const symbolW = $derived(SYMBOL_W * (layout.boardScale / scaleX) * SIZE_BOOST);
	const symbolH = $derived(SYMBOL_H * (layout.boardScale / scaleY) * SIZE_BOOST);
	// Column divider width in LOCAL units, chosen so it renders ~2.5px wide after the container's
	// scaleX (the line stays thin at any board size).
	const DIVIDER_W = $derived(2.5 / scaleX);

	// Per-type visual balance: card (low) letters fill their tile much more than the framed
	// animal / wild / scatter art, so they read bigger. Shrink the low cards and nudge the
	// wild/scatter emblems up so all symbol types appear a similar size on the reels.
	const HIGH_SYMBOLS_SET = new Set<SymbolName>(['FOX', 'WOLF', 'BEAR', 'RABBIT', 'SQUIRREL']);
	const symScale = (name: SymbolName) => {
		// Portrait relies on the tuned per-symbol PNG padding (yesterday's mobile assets) for even
		// gaps, so it draws every symbol at cell size — no per-type rescaling.
		if (isPortrait) return 1;
		if (LOW_SYMBOLS_SET.has(name)) return 0.86;
		if (name === 'WILD' || name === 'SCATTER') return 1.1;
		// Premium animals: desktop art has built-in margin (reads small) so enlarge it; the
		// landscape art already fills its tile, so keep it at reference size there.
		if (HIGH_SYMBOLS_SET.has(name)) return isLandscape ? 1.0 : 1.18;
		return 1;
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

	context.eventEmitter.subscribeOnMount({
		stopButtonClick: () => {
			context.stateGameDerived.enhancedBoard.forceStop();
		},
		skipToAnticipation: () => {
			context.stateGame.board.forEach((reel) => reel.stop());
		},
		boardSettle: ({ board }) => context.stateGameDerived.enhancedBoard.settle(board),
		boardShow: () => (show = true),
		boardHide: () => (show = false),
		boardWithAnimateSymbols: async ({ symbolPositions }) => {
			for (const position of symbolPositions) {
				const reelSymbol = context.stateGame.board[position.reel].reelState.symbols[position.row];
				reelSymbol.symbolState = 'win';
			}
		},
	});

	context.stateGameDerived.enhancedBoard.readyToSpinEffect();
</script>

{#if isAnyReelSpinning}
	<OnPressFullScreen onpress={() => {
		if (context.stateGame.awaitingFirstReveal) {
			context.stateGame.pendingStop = true;
		} else {
			context.eventEmitter.broadcast({ type: 'stopButtonClick' });
		}
	}} />
{/if}

{#if show}
	<Container x={layout.x + (isDesktop ? 3 : 0)} y={layout.y + BOARD_GRID_OFFSET_Y} pivot={layout.pivot} scale={{ x: scaleX, y: scaleY }}>
		<Graphics
			isMask
			draw={(graphics) => {
				// Inset the mask a few units top & bottom so the top slivers of the buffer symbols
				// (just outside the visible rows) don't bleed in as thin lines at the grid edge.
				const inset = isDesktop ? 2 : 0;
				graphics.beginFill(0xffffff);
				graphics.rect(0, inset, SYMBOL_W * BOARD_DIMENSIONS.x, SYMBOL_H * BOARD_DIMENSIONS.y - inset * 2);
				graphics.endFill();
			}}
		/>
		<!-- Thin vertical divider lines between the reel columns (behind the symbols). -->
		{#each Array.from({ length: BOARD_DIMENSIONS.x - 1 }) as _, i (i)}
			<Sprite
				key="reelDivider"
				x={SYMBOL_W * (i + 1)}
				y={0}
				anchor={{ x: 0.5, y: 0 }}
				width={DIVIDER_W}
				height={SYMBOL_H * BOARD_DIMENSIONS.y}
				alpha={0.55}
			/>
		{/each}
		{#each board as reel, reelIndex (reelIndex)}
			{#if !hiddenReels.has(reelIndex)}
			{#each reel.reelState.symbols as reelSymbol, symbolIndex (symbolIndex)}
				{@const y = reelSymbol.symbolY()}
				<Rectangle
					x={getX(reelIndex) - SYMBOL_W * 0.5}
					y={y - SYMBOL_H * 0.5}
					width={SYMBOL_W}
					height={SYMBOL_H}
					backgroundColor={0x000000}
					alpha={0.02}
				/>
				{@const isWin = reelSymbol.symbolState === 'win'}
				{@const s = symScale(reelSymbol.rawSymbol.name)}
				<Sprite
					key={getSpriteKey(reelSymbol.rawSymbol.name, reelSymbol.symbolState)}
					x={getX(reelIndex)}
					y={y}
					anchor={{ x: 0.5, y: 0.5 }}
					width={symbolW * s}
					height={symbolH * s}
					alpha={hasWinState && !isWin ? 0.35 : 1}
					tint={isWin ? 0xffffff : 0xffffff}
				/>
			{/each}
			{/if}
		{/each}
	</Container>
{/if}
