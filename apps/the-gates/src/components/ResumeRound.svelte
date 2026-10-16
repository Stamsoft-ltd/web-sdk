<script lang="ts">
	import Modal from './Modal.svelte';
	import { t } from '../i18n';
	let { busy, resume, skip }: { busy: boolean; resume: () => void; skip: () => void } = $props();
</script>

<Modal title={t('RESUME')} close={() => {}} locked compact framed>
	<div class="resume-copy"><p>{t('UNFINISHED ROUND CHOICE')}</p></div>
	<div class="confirmation-actions resume-actions">
		<button class="gold-button" disabled={busy} onclick={resume}>{t('PLAY ROUND')}</button>
		<button class="quiet-button" disabled={busy} onclick={skip}>{t('SKIP ROUND')}</button>
	</div>
</Modal>

<style>
	.resume-copy {
		min-height: 160px;
		display: grid;
		align-items: center;
	}
	@media (max-height: 450px) {
		.resume-copy {
			min-height: 80px;
		}
	}

	.resume-actions > button {
		height: auto;
		min-height: 56px;
		padding: 10px 8px;
		font-size: 16px;
		line-height: 1.2;
	}
</style>
