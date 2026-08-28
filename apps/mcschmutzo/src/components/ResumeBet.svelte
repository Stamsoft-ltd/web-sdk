<script lang="ts">
	import { stateBet } from 'state-shared';
	import { getContext } from '../game/context';
	import { onMount } from 'svelte';

	const context = getContext();

	onMount(() => {
		// An active bonus is mid-flight → prompt the player with the Unfinished Round dialog
		// (HudHtml renders it off context.stateGame.resumeModalOpen) instead of silently resuming.
		// Anything else (no bet, or an inactive-but-reconstructable state) resumes silently as before.
		if (stateBet.betToResume?.active && stateBet.betToResume.mode) {
			context.stateGame.resumeModalOpen = true;
			return;
		}
		context.eventEmitter.broadcast({ type: 'resumeBet' });
	});
</script>
