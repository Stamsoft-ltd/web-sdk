<script lang="ts">
	import ReelSymbol from './ReelSymbol.svelte';
	import { getContext } from '../game/context';

	const context = getContext();
</script>

{#each context.stateGame.board as reel, reelIndex (reelIndex)}
	{#each reel.reelState.symbols as reelSymbol, symbolIndex}
		<ReelSymbol {reelIndex} {symbolIndex} {reelSymbol} />
	{/each}
{/each}
