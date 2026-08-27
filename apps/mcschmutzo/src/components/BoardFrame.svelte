<script lang="ts" module>
	export type EmitterEventBoardFrame =
		| { type: 'boardFrameGlowShow' }
		| { type: 'boardFrameGlowHide' };
</script>

<script lang="ts">
	import { Container, Sprite, Rectangle } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { BOARD_DIMENSIONS, SYMBOL_SIZE, SYMBOL_WIDTH } from '../game/constants';

	const context = getContext();
	const board = $derived(context.stateGameDerived.boardLayout());
	const lockedPositionKeys = $derived(
		new Set(
			context.stateGame.lockedPositions.map(({ reel, row }) => `${reel}:${row - 1}`),
		),
	);

	// board.webp bakes a 5x5 grid inside a beveled frame. Its playable grid occupies
	// 0.9588 x 0.9548 of the image (inset ~0.0206 x 0.0224), so upscale the sprite to map
	// that grid onto the board playable area and let the frame overhang the edges.
	const bgWidth = $derived(board.width * 1.043);
	const bgHeight = $derived(board.height * 1.0473);
	const bgX = $derived(-board.width * 0.0206);
	const bgY = $derived(-board.height * 0.0224);
</script>

<Container x={board.x} y={board.y} pivot={board.pivot} zIndex={-1}>
	<Sprite key="boardBg" anchor={{ x: 0, y: 0 }} x={bgX} y={bgY} width={bgWidth} height={bgHeight} />

	<!-- Locked cells keep their golden highlight, drawn over the board art (behind symbols). -->
	{#each Array(BOARD_DIMENSIONS.x) as _, reel}
		{#each Array(BOARD_DIMENSIONS.y) as _, row}
			{#if lockedPositionKeys.has(`${reel}:${row}`)}
				<Rectangle
					x={reel * SYMBOL_WIDTH + 2}
					y={row * SYMBOL_SIZE + 2}
					width={SYMBOL_WIDTH - 4}
					height={SYMBOL_SIZE - 4}
					borderRadius={3}
					backgroundColor={0xe8b574}
					borderColor={0xffc383}
					borderWidth={4}
				/>
			{/if}
		{/each}
	{/each}
</Container>
