<script lang="ts">
	import { Container, Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { SYMBOL_SIZE, SYMBOL_WIDTH } from '../game/constants';

	const context = getContext();
	const board = $derived(context.stateGameDerived.boardLayout());

	// DEV preview (key 9): toggle a locked block over some cells to inspect the lock badge, the
	// light-background gap, and the winning-symbol idle animation without playing into a bonus.
	import { onMount } from 'svelte';
	onMount(() => {
		if (!import.meta.env.DEV) return;
		const demo = [
			{ reel: 3, row: 3 },
			{ reel: 4, row: 3 },
			{ reel: 3, row: 4 },
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
	// lockedPositions use 1-based visible rows (grid row = row - 1), matching BoardFrame.
	const locks = $derived(
		context.stateGame.lockedPositions.map(({ reel, row }) => ({ reel, gridRow: row - 1 })),
	);
	const badge = $derived(Math.min(SYMBOL_WIDTH, SYMBOL_SIZE) * 0.34);
</script>

<!-- Lock badge drawn on top of every locked/active symbol (the light-background cells). -->
<Container x={board.x} y={board.y} pivot={board.pivot} zIndex={5}>
	{#each locks as { reel, gridRow } (`${reel}:${gridRow}`)}
		<Sprite
			key="lockBadge"
			x={reel * SYMBOL_WIDTH + SYMBOL_WIDTH / 2}
			y={gridRow * SYMBOL_SIZE + SYMBOL_SIZE * 0.62}
			anchor={0.5}
			width={badge}
			height={badge}
		/>
	{/each}
</Container>
