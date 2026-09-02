<script lang="ts">
	import { CanvasSizeRectangle } from 'components-layout';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';

	import { getContext } from '../game/context';

	// The bonus hand-off: this component IS the transition into a bonus. One full-screen dim eases in
	// over 1.5s while the board sits there, the whole bonus scene is swapped in behind it once it is
	// up, and it holds through the congratulations screen — so from the trigger to the reveal there is
	// never a frame where the player can see anything change.
	//
	// It replaced a spine wipe, which could not do the job: the wipe ends BEFORE the congratulations
	// fades in and `bonusMode` flips in that gap, so the player saw the old room for a few frames and
	// then the new one. Cross-fading the background could not help either, because the room is only
	// one of the things that change (capsule column, rail boxes, the whole bonus scene).
	const context = getContext();

	const show = $derived(context.stateGame.bonusHandoffActive);

	// 0.9 leaves the room faintly readable underneath rather than cutting to black — a hard blackout
	// reads as the game hanging. Out is quicker than in because that fade IS the reveal of the bonus,
	// and the player has already been waiting through the celebration by then.
	const DIM = 0.9;
	const IN_MS = 1500;
	const OUT_MS = 620;

	// Must stay in step with BONUS_HANDOFF_DIM_MS in bookEventHandlerMap: the swap is timed to land
	// after this ramp has finished, and a longer ramp here would put it back in view.
	const dim = new Tween(0, { easing: cubicInOut });
	$effect(() => {
		dim.set(show ? DIM : 0, { duration: show ? IN_MS : OUT_MS });
	});
</script>

{#if dim.current > 0.002}
	<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={dim.current} />
{/if}
