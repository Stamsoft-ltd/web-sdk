<script lang="ts">
	import { OnMount } from 'components-shared';
	import { SECOND } from 'constants-shared/time';
	import { stateSound } from 'state-shared';

	import { getContext } from '../game/context';
	import Anticipation from './Anticipation.svelte';

	const context = getContext();
	const hasAnticipation = $derived(
		context.stateGame.board.some((reel) => reel.reelState.anticipating),
	);

	// Music ducking: while the scatter anticipation is on screen, drop the background music to 10%
	// of its current level so the anticipation sound cuts through, then restore it afterwards.
	let duckedMusicVolume = 0;
</script>

{#if hasAnticipation}
	<OnMount
		onmount={() => {
			context.eventEmitter.broadcast({ type: 'soundLoop', name: 'sfx_scatter_anticipation_loop' });
			context.eventEmitter.broadcast({
				type: 'soundFade',
				name: 'sfx_scatter_anticipation_loop',
				from: 0,
				to: 1,
				duration: SECOND,
			});

			// Duck the background music to 10% of whatever the player has it set to.
			duckedMusicVolume = stateSound.volumeValueMusic;
			stateSound.volumeValueMusic = duckedMusicVolume * 0.1;

			return () => {
				context.eventEmitter.broadcast({ type: 'soundStop', name: 'sfx_scatter_anticipation_loop' });
				// Restore the background music to its pre-anticipation level.
				stateSound.volumeValueMusic = duckedMusicVolume;
			};
		}}
	/>
{/if}

{#each context.stateGame.board as reel}
	{#if reel.reelState.anticipating}
		<Anticipation {reel} oncomplete={() => (reel.reelState.anticipating = false)} />
	{/if}
{/each}
