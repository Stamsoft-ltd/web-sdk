<script lang="ts" module>
	export type EmitterEventTransition = { type: 'transition' };
</script>

<script lang="ts">
	import { waitForResolve } from 'utils-shared/wait';

	import TransitionAnimation from './TransitionAnimation.svelte';
	import { getContext } from '../game/context';

	const context = getContext();

	let transitioning = $state(false);
	// Resolved once the screen is fully covered, so the caller (bookEventHandlerMap) swaps the
	// background / bonus state while it is hidden; the overlay then fades back out to reveal it.
	let resolveCover = $state(() => {});

	context.eventEmitter.subscribeOnMount({
		transition: async () => {
			transitioning = true;
			await waitForResolve((resolve) => (resolveCover = resolve));
		},
	});
</script>

{#if transitioning}
	<TransitionAnimation
		oncover={() => resolveCover()}
		ondone={() => (transitioning = false)}
	/>
{/if}
