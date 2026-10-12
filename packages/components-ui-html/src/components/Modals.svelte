<script lang="ts">
	import type { Snippet } from 'svelte';

	import ModalError from './ModalError.svelte';
	import ModalBetMenu from './ModalBetMenu.svelte';
	import ModalBuyBonus from './ModalBuyBonus.svelte';
	import ModalBuyBonusConfirm from './ModalBuyBonusConfirm.svelte';
	import ModalAutoSpin from './ModalAutoSpin.svelte';
	import ModalAutoSpinMessage from './ModalAutoSpinMessage.svelte';
	import ModalPayTable from './ModalPayTable.svelte';
	import ModalGameRules from './ModalGameRules.svelte';
	import ModalSettings from './ModalSettings.svelte';

	type Props = {
		version: Snippet;
		/** A game's own error dialog, in place of the generic NOTIFICATION box (ModalError). */
		error?: Snippet;
	};

	const props: Props = $props();
</script>

{#if props.error}
	{@render props.error()}
{:else}
	<ModalError />
{/if}
<ModalBetMenu />
<ModalBuyBonus />
<ModalBuyBonusConfirm />
<ModalAutoSpin />
<ModalAutoSpinMessage />
<ModalPayTable>
	{@render props.version()}
</ModalPayTable>
<ModalGameRules>
	{@render props.version()}
</ModalGameRules>
<ModalSettings />
