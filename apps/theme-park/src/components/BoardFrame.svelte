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
	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	let glowVisible = $state(false);

	context.eventEmitter.subscribeOnMount({
		boardFrameGlowShow: () => (glowVisible = true),
		boardFrameGlowHide: () => (glowVisible = false),
	});

	// Forest slot_pad geometry. Theme Park's board layout was authored against
	// this 3616×2528 frame, so keep the same inner-window fractions.
	const FOREST_INNER_W = 0.64;
	const FOREST_ASPECT = 3616 / 2528;
	const FOREST_MARGIN = 1.04;
	const FOREST_SCALE = 1.35 / 1.15;
	const forestW = $derived(
		(board.width * board.boardScale * FOREST_MARGIN * FOREST_SCALE) / FOREST_INNER_W,
	);
	const forestH = $derived(forestW / FOREST_ASPECT);

	// Magnetic mobile frames hug the actual grid. Width/height fit independently,
	// matching Magnetic's board implementation and avoiding procedural borders.
	const magneticW = $derived((board.width * board.boardScale) / 0.95);
	const magneticH = $derived((board.height * board.boardScale) / 0.95);
</script>

{#if layoutType === 'portrait'}
	<Sprite
		key="magneticBoardPadMobile"
		anchor={0.5}
		x={board.x}
		y={board.y}
		width={magneticW}
		height={magneticH}
		tint={glowVisible ? 0xffb7f2 : 0xffffff}
	/>
{:else if layoutType === 'landscape'}
	<Sprite
		key="magneticBoardPadLand"
		anchor={0.5}
		x={board.x}
		y={board.y}
		width={magneticW}
		height={magneticH}
		tint={glowVisible ? 0xffb7f2 : 0xffffff}
	/>
{:else}
	<Sprite
		key="forestBoardPad"
		anchor={{ x: 0.5, y: 0.45 }}
		x={board.x}
		y={board.y}
		width={forestW}
		height={forestH}
		tint={glowVisible ? 0xffb7f2 : 0xffffff}
	/>
{/if}
