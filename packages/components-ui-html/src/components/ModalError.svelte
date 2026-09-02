<script lang="ts">
	import { Popup } from 'components-shared';
	import { zIndex } from 'constants-shared/zIndex';
	import { stateModal } from 'state-shared';

	import BaseContent from './BaseContent.svelte';
	import { i18nDerived } from '../i18n/i18nDerived';

	const modal = $derived(stateModal.modal?.name === 'error' ? stateModal.modal : null);
	// Fatal errors (a failed authentication) leave nothing to return to, so they stay persistent.
	// Anything flagged recoverable dropped the game back to idle and must be dismissible, otherwise
	// the modal locks the player out of lowering the bet and playing on.
	const recoverable = $derived(modal?.recoverable === true);
</script>

{#if modal}
	<Popup zIndex={zIndex.modal} persistent={!recoverable} onclose={() => (stateModal.modal = null)}>
		<BaseContent maxWidth="100%">
			{#if modal.code === 'insufficientFunds'}
				<span>{i18nDerived.notification()}</span>
				<div class="scrollY error-text" data-test="error-content">
					{i18nDerived.insufficientFunds()}
				</div>
			{:else}
				{@const error = modal.error}
				<span>Sorry, something went wrong.</span>
				<div class="scrollY error-text" data-test="error-content">
					{#if error}
						{#if error?.error && error?.message}
							<span>{JSON.stringify(error.error || 'unknown')}</span>
							<p>{JSON.stringify(error.message || 'unknown')}</p>
						{:else}
							<p>{error}</p>
						{/if}
					{:else}
						<span>unknown error</span>
					{/if}
				</div>
			{/if}
		</BaseContent>
	</Popup>
{/if}

<style lang="scss">
	.error-text {
		max-height: 100px;
		max-width: 480px;
		border-radius: 8px;
		border: 1px solid red;
		white-space: normal;
		padding: 1rem;
		text-align: center;
	}
</style>
