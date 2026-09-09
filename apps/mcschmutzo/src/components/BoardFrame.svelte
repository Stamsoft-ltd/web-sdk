<script lang="ts" module>
	export type EmitterEventBoardFrame =
		| { type: 'boardFrameGlowShow' }
		| { type: 'boardFrameGlowHide' };
</script>

<script lang="ts">
	import { Container, Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';

	const context = getContext();
	const board = $derived(context.stateGameDerived.boardLayout());

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
	<!-- Locked-cell highlight + held symbol are drawn on top of the board by LockedCells.svelte so
	     the held symbol stays pinned to its box while the reel spins. -->
</Container>
