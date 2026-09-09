<script lang="ts">
	import { Container, Rectangle, Sprite } from 'pixi-svelte';

	import Symbol from './Symbol.svelte';
	import { getContext } from '../game/context';
	import { SYMBOL_SIZE, SYMBOL_WIDTH } from '../game/constants';
	import type { RawSymbol } from '../game/types';

	const context = getContext();
	const board = $derived(context.stateGameDerived.boardLayout());

	// Each locked/active cell is drawn ON TOP of the (possibly spinning) board so the held symbol
	// stays pinned to its box instead of scrolling with the reel — the light background is opaque and
	// covers the reel behind it. `lockedPositions.row` is 1-based (grid row = row - 1, and it doubles
	// as the symbols-array index used to read the held symbol when no single lockSymbol is set).
	const cells = $derived(
		context.stateGame.lockedPositions.map(({ reel, row }) => {
			const name =
				context.stateGame.lockSymbol ??
				context.stateGame.board[reel]?.reelState.symbols[row]?.rawSymbol?.name;
			return { reel, gridRow: row - 1, name };
		}),
	);
	const badge = $derived(Math.min(SYMBOL_WIDTH, SYMBOL_SIZE) * 0.34);

	// DEV preview (key 9): toggle a locked block to inspect the pinned cells + burger animation.
	import { onMount } from 'svelte';
	onMount(() => {
		if (!import.meta.env.DEV) return;
		const demo = [
			{ reel: 0, row: 3 },
			{ reel: 2, row: 3 },
			{ reel: 3, row: 3 },
			{ reel: 4, row: 3 },
			{ reel: 4, row: 4 },
		];
		const onDev = (e: KeyboardEvent) => {
			if (e.code !== 'Digit9') return;
			context.stateGame.lockedPositions =
				context.stateGame.lockedPositions.length > 0 ? [] : demo;
		};
		window.addEventListener('keydown', onDev);
		return () => window.removeEventListener('keydown', onDev);
	});
</script>

<Container x={board.x} y={board.y} pivot={board.pivot} zIndex={5}>
	{#each cells as { reel, gridRow, name } (`${reel}:${gridRow}`)}
		{@const cx = reel * SYMBOL_WIDTH + SYMBOL_WIDTH / 2}
		{@const cy = gridRow * SYMBOL_SIZE + SYMBOL_SIZE / 2}
		<!-- Full-cell cover in the board's own cell colour, so a spinning reel behind can't show
		     through the gap around the inset highlight. -->
		<Rectangle
			x={reel * SYMBOL_WIDTH + 1}
			y={gridRow * SYMBOL_SIZE + 1}
			width={SYMBOL_WIDTH - 2}
			height={SYMBOL_SIZE - 2}
			borderRadius={3}
			backgroundColor={0x2e2a27}
		/>
		<!-- Opaque light background (inset so adjacent locked cells keep a gap). -->
		<Rectangle
			x={reel * SYMBOL_WIDTH + 9}
			y={gridRow * SYMBOL_SIZE + 9}
			width={SYMBOL_WIDTH - 18}
			height={SYMBOL_SIZE - 18}
			borderRadius={10}
			backgroundColor={0xe8b574}
			borderColor={0xffc383}
			borderWidth={4}
		/>
		{#if name}
			<!-- Held symbol, pinned to the box (plays its come-alive animation once on lock). -->
			<Symbol
				x={cx}
				y={cy}
				state="static"
				rawSymbol={{ name } as RawSymbol}
				winning={true}
			/>
		{/if}
		<Sprite key="lockBadge" x={cx} y={gridRow * SYMBOL_SIZE + SYMBOL_SIZE * 0.62} anchor={0.5} width={badge} height={badge} />
	{/each}
</Container>
