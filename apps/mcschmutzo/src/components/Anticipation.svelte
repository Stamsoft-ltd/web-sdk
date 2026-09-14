<script lang="ts">
	import type { Reel } from '../game/stateGame.svelte';

	type Props = {
		reel: Reel;
		oncomplete: () => void;
	};

	const props: Props = $props();

	// The per-reel anticipation SPINE (a glowing radial frame with rocks + sparks + dust) was a
	// leftover from the source mining/lava template and clashed with the diner theme — it lit up the
	// last reels ("4th/5th row") when scatters were landing. The visual is removed at every resolution;
	// we keep only the lifecycle so `anticipating` still clears once the reel stops (which also stops
	// the anticipation sound in Anticipations.svelte). No overlay is drawn.
	$effect(() => {
		if (props.reel.reelState.motion === 'stopped') props.oncomplete();
	});
</script>
