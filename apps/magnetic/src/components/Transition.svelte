<script lang="ts" module>
	export type EmitterEventTransition = { type: 'transition' };
</script>

<script lang="ts">
	import { waitForResolve } from 'utils-shared/wait';

	import TransitionAnimation from './TransitionAnimation.svelte';
	import { getContext } from '../game/context';

	// Just the wipe. The coin shower that briefly lived here now belongs to <BonusHandoffVeil>,
	// which holds it for the whole hand-off rather than only for the length of the wipe — see the
	// note there for why the seam needed covering end to end.
	const context = getContext();

	let transitioning = $state(false);
	let oncomplete = $state(() => {});

	context.eventEmitter.subscribeOnMount({
		transition: async () => {
			transitioning = true;
			await waitForResolve((resolve) => (oncomplete = resolve));
		},
	});
</script>

{#if transitioning}
	<TransitionAnimation
		oncomplete={() => {
			oncomplete();
			transitioning = false;
		}}
	/>
{/if}
