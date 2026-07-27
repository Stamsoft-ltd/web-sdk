<script lang="ts">
	import type { Snippet } from 'svelte';

	import { Popup } from 'components-shared';
	import { zIndex } from 'constants-shared/zIndex';
	import { stateMeta, stateModal } from 'state-shared';

	import BaseContent from './BaseContent.svelte';
	import BaseScrollable from './BaseScrollable.svelte';
	import GameInfoCarousel from './GameInfoCarousel.svelte';
	import GameRuleSections from './GameRuleSections.svelte';

	type Props = {
		children: Snippet;
	};

	const props: Props = $props();

	const infoPages = $derived(stateMeta.gameRuleMeta.infoPages ?? []);
	const infoAssets = $derived(stateMeta.gameRuleMeta.infoAssets);
</script>

{#if stateModal.modal?.name === 'gameRules'}
	<Popup
		zIndex={zIndex.modal}
		hideClose={infoPages.length > 0}
		onclose={() => (stateModal.modal = null)}
	>
		<BaseContent maxWidth="100%">
			{#if infoPages.length && infoAssets}
				<GameInfoCarousel
					pages={infoPages}
					assets={infoAssets}
					onClose={() => (stateModal.modal = null)}
				/>
				{@render props.children()}
			{:else}
				<BaseScrollable type="column">
					<GameRuleSections sections={stateMeta.gameRuleMeta.gameRules} />
					{@render props.children()}
				</BaseScrollable>
			{/if}
		</BaseContent>
	</Popup>
{/if}
