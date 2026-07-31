<script lang="ts">
	import { onMount } from 'svelte';
	import { Container, SpineProvider, SpineTrack } from 'pixi-svelte';

	import type { Reel } from '../game/stateGame.svelte';
	import { CELL_W, SYMBOL_W, SYMBOL_H, BOARD_SIZES, BOARD_GRID_OFFSET_Y } from '../game/constants';
	import { getContext } from '../game/context';

	type Props = { reel: Reel; oncomplete: () => void };
	const props: Props = $props();
	const context = getContext();
	const board = $derived(context.stateGameDerived.boardLayout());

	type AnimationName = 'anticipation_intro' | 'anticipation_loop' | 'anticipation_out';
	let animationName = $state<AnimationName>('anticipation_intro');
	let completed = false;

	const complete = () => {
		if (completed) return;
		completed = true;
		props.oncomplete();
	};

	onMount(() => {
		if (context.stateGame.anticipationSkipped) {
			props.reel.forceStop();
			complete();
		}
	});

	$effect(() => {
		if (props.reel.reelState.motion === 'stopped') animationName = 'anticipation_out';
	});

	context.eventEmitter.subscribeOnMount({
		stopButtonClick: () => {
			context.stateGame.anticipationSkipped = true;
			props.reel.forceStop();
			complete();
		},
	});

	const extendBottom = SYMBOL_H * 0.26;
</script>

<Container
	x={board.x +
		((props.reel.reelIndex + 0.5) * CELL_W - BOARD_SIZES.width * 0.5) * board.boardScale}
	y={board.y + BOARD_GRID_OFFSET_Y + (extendBottom * 0.5 - SYMBOL_H * 0.12) * board.boardScale}
>
	<SpineProvider
		key="anticipation"
		width={(SYMBOL_W * board.boardScale) / 2}
		height={((BOARD_SIZES.height + extendBottom) * board.boardScale) / 2}
	>
		<SpineTrack
			trackIndex={0}
			{animationName}
			loop={animationName === 'anticipation_loop'}
			timeScale={0.65}
			listener={{
				complete: () => {
					if (animationName === 'anticipation_intro') {
						animationName = 'anticipation_loop';
						return;
					}
					if (animationName === 'anticipation_out') complete();
				},
			}}
		/>
	</SpineProvider>
</Container>
