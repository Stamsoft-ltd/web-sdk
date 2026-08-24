<script lang="ts" module>
	export type EmitterEventBoardFrame =
		| { type: 'boardFrameGlowShow' }
		| { type: 'boardFrameGlowHide' };
</script>

<script lang="ts">
	import { Container, Rectangle } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { BOARD_DIMENSIONS, SYMBOL_SIZE, SYMBOL_WIDTH } from '../game/constants';

	const context = getContext();
	const board = $derived(context.stateGameDerived.boardLayout());
	const lockedPositionKeys = $derived(
		new Set(
			context.stateGame.lockedPositions.map(({ reel, row }) => `${reel}:${row - 1}`),
		),
	);
</script>

<Container x={board.x} y={board.y} pivot={board.pivot} zIndex={-1}>
	<Rectangle
		x={-12}
		y={-12}
		width={board.width + 24}
		height={board.height + 24}
		borderRadius={14}
		backgroundColor={0x141414}
		borderColor={0x292929}
		borderWidth={6}
	/>
	<Rectangle
		x={-5}
		y={-5}
		width={board.width + 10}
		height={board.height + 10}
		borderRadius={8}
		backgroundColor={0x202020}
	/>
	{#each Array(BOARD_DIMENSIONS.x) as _, reel}
		{#each Array(BOARD_DIMENSIONS.y) as _, row}
			{@const isLocked = lockedPositionKeys.has(`${reel}:${row}`)}
			<Rectangle
				x={reel * SYMBOL_WIDTH + 2}
				y={row * SYMBOL_SIZE + 2}
				width={SYMBOL_WIDTH - 4}
				height={SYMBOL_SIZE - 4}
				borderRadius={isLocked ? 3 : 2}
				backgroundColor={isLocked ? 0xe8b574 : 0x292929}
				borderColor={isLocked ? 0xffc383 : 0x222222}
				borderWidth={isLocked ? 4 : 2}
			/>
		{/each}
	{/each}
</Container>
