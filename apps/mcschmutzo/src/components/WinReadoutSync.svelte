<script lang="ts">
	import { untrack } from 'svelte';

	import { getContext } from '../game/context';

	// Mirrors a win screen's count-up onto the HUD WIN readout (stateGame.winCountUp). It only writes
	// while a presentation owns the readout (the book handler set winCountUp), so the dev tier
	// previews can't leave the readout stuck.
	type Props = { amount: number };
	const props: Props = $props();
	const context = getContext();

	$effect(() => {
		const amount = props.amount;
		untrack(() => {
			if (context.stateGame.winCountUp !== null) context.stateGame.winCountUp = amount;
		});
	});
</script>
