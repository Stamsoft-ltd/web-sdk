<script lang="ts">
	import { Popup } from 'components-shared';
	import { zIndex } from 'constants-shared/zIndex';
	import { stateModal, type ModalErrorCode } from 'state-shared';

	import BaseContent from './BaseContent.svelte';
	import { i18nDerived } from '../i18n/i18nDerived';

	const modal = $derived(stateModal.modal?.name === 'error' ? stateModal.modal : null);
	// Fatal errors (a failed authentication, an expired session) leave nothing to return to, so they
	// stay persistent. Anything flagged recoverable dropped the game back to idle and must be
	// dismissible, otherwise the modal locks the player out of lowering the bet and playing on
	// (STAKE_REVIEW_LESSONS R-06).
	const recoverable = $derived(modal?.recoverable === true);

	// Player-facing copy comes ONLY from the i18n catalog, keyed by the error code. The raw error
	// (an RGS payload, an Error, a JSON blob) is logged where it is raised and never rendered: it is
	// untranslated, can carry prohibited social-mode wording, and means nothing to a player (R-07).
	const MESSAGE_BY_CODE: Record<ModalErrorCode, () => string> = {
		insufficientFunds: i18nDerived.insufficientFunds,
		network: i18nDerived.errorNetwork,
		session: i18nDerived.errorSession,
		limits: i18nDerived.errorLimits,
		replay: i18nDerived.errorReplay,
		general: i18nDerived.errorGeneral,
	};
	const message = $derived(modal ? (MESSAGE_BY_CODE[modal.code ?? 'general'] ?? i18nDerived.errorGeneral)() : '');
</script>

{#if modal}
	<Popup zIndex={zIndex.modal} persistent={!recoverable} onclose={() => (stateModal.modal = null)}>
		<BaseContent maxWidth="100%">
			<span>{i18nDerived.notification()}</span>
			<div class="scrollY error-text" data-test="error-content">
				{message}
			</div>
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
