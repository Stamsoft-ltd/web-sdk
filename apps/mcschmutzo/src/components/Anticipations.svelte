<script lang="ts">
	import { getContext } from '../game/context';
	import { teaseFocus } from '../game/winFocus.svelte';
	import Anticipation from './Anticipation.svelte';

	const context = getContext();
	// Spotlight the tease: dim the landed reels' non-scatter symbols while any reel is teasing.
	$effect(() => {
		const on = context.stateGame.board.some((reel) => reel.reelState.anticipating);
		teaseFocus.set(on ? 1 : 0, { duration: on ? 260 : 180 });
	});
</script>

<!-- (no anticipation sound in the McSchmutzo set — the reels' visual anticipation runs silent) -->
{#each context.stateGame.board as reel, reelIndex}
	{#if reel.reelState.anticipating}
		<Anticipation {reel} {reelIndex} oncomplete={() => (reel.reelState.anticipating = false)} />
	{/if}
{/each}
