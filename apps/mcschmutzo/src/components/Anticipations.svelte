<script lang="ts">
	import { getContext } from '../game/context';
	import Anticipation from './Anticipation.svelte';

	const context = getContext();
</script>

<!-- (no anticipation sound in the McSchmutzo set — the reels' visual anticipation runs silent) -->
{#each context.stateGame.board as reel, reelIndex}
	{#if reel.reelState.anticipating}
		<Anticipation {reel} {reelIndex} oncomplete={() => (reel.reelState.anticipating = false)} />
	{/if}
{/each}
