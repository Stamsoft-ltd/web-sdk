<script lang="ts">
	import { stateModal, type ModalErrorCode } from 'state-shared';

	import CustomConfirmModal from './CustomConfirmModal.svelte';
	import { i18nDerived } from '../i18n/i18nDerived';

	// The game's own error dialog (the diner confirm card), in place of the shared NOTIFICATION box
	// (components-ui-html ModalError). Same rules as that one: copy comes ONLY from the i18n catalog by
	// error code — the raw error is never rendered (STAKE_REVIEW_LESSONS R-07) — and a recoverable
	// error is dismissible (R-06) while a fatal one stays up with nothing to press.
	const modal = $derived(stateModal.modal?.name === 'error' ? stateModal.modal : null);
	const recoverable = $derived(modal?.recoverable === true);

	const MESSAGE_BY_CODE: Record<ModalErrorCode, string> = {
		insufficientFunds:
			'INSUFFICIENT FUNDS TO PLACE THIS BET. PLEASE ADD FUNDS TO YOUR ACCOUNT OR LOWER THE BET LEVEL.',
		network: 'CONNECTION PROBLEM. PLEASE CHECK YOUR CONNECTION AND TRY AGAIN.',
		session: 'YOUR SESSION HAS EXPIRED. PLEASE RELOAD THE GAME.',
		limits: 'YOUR ACCOUNT LIMIT HAS BEEN REACHED.',
		replay: 'THIS REPLAY COULD NOT BE LOADED. PLEASE TRY AGAIN.',
		general: 'SOMETHING WENT WRONG. PLEASE TRY AGAIN.',
	};
	const message = $derived(
		modal ? i18nDerived.translate(MESSAGE_BY_CODE[modal.code ?? 'general'] ?? MESSAGE_BY_CODE.general) : '',
	);
	const close = () => (stateModal.modal = null);
</script>

{#if modal}
	<CustomConfirmModal
		title={i18nDerived.translate('NOTIFICATION')}
		{message}
		confirmLabel={recoverable ? i18nDerived.translate('CLOSE') : undefined}
		onconfirm={close}
		persistent={!recoverable}
	/>
{/if}
