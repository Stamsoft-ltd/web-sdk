<script lang="ts" module>
	export type EmitterEventBoardFrame =
		| { type: 'boardFrameGlowShow' }
		| { type: 'boardFrameGlowHide' };
</script>

<script lang="ts">
	import { Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';

	const context = getContext();
	const board = $derived(context.stateGameDerived.boardLayout());
	let glowVisible = $state(false);

	context.eventEmitter.subscribeOnMount({
		boardFrameGlowShow: () => (glowVisible = true),
		boardFrameGlowHide: () => (glowVisible = false),
	});

	const frameW = $derived(board.width * board.boardScale * 1.08);
	const frameH = $derived(board.height * board.boardScale * 1.08);
</script>

<Sprite
	key="themeBoard"
	anchor={0.5}
	x={board.x}
	y={board.y}
	width={frameW}
	height={frameH}
	tint={glowVisible ? 0xffc4ff : 0xffffff}
/>
