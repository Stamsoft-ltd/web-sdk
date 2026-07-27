<script lang="ts">
	import { stateBet } from 'state-shared';
	import { i18nDerived } from '../i18n/i18nDerived';

	type Props = { onPlay: () => void; onEnd: () => void };
	const props: Props = $props();

	const mode = $derived(stateBet.betToResume?.mode ?? '');
	const modeLabel = $derived(
		({
			ANTE: i18nDerived.translate('BET MODE ANTE TITLE'),
			FSPIN1: i18nDerived.translate('BET MODE FSPIN1 TITLE'),
			FSPIN2: i18nDerived.translate('BET MODE FSPIN2 TITLE'),
			DUCK: i18nDerived.translate('BET MODE DUCK TITLE'),
			ROLLER: i18nDerived.translate('BET MODE ROLLER TITLE'),
			COASTER: i18nDerived.translate('BET MODE COASTER TITLE'),
		} as Record<string, string>)[mode] ?? i18nDerived.gameTitle(),
	);
</script>

<div class="modal-overlay">
	<div class="modal" role="dialog" aria-modal="true">
		<h2 class="title">{i18nDerived.translate('RECOVERY TITLE')}</h2>
		<p class="subtitle">{i18nDerived.translateVars('RESUME BODY', { mode: modeLabel })}</p>
		<div class="buttons">
			<button class="btn btn-play" onclick={props.onPlay}>
				▶ {i18nDerived.translate('PLAY ROUND')}
			</button>
			<button class="btn btn-end" onclick={props.onEnd}>
				✕ {i18nDerived.translate('END ROUND')}
			</button>
		</div>
	</div>
</div>

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.75);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
	}
	.modal {
		background: #0d1a0e;
		border: 2px solid #d4a017;
		border-radius: 16px;
		padding: 2rem 2.5rem;
		text-align: center;
		max-width: 380px;
		width: 90%;
	}
	.title {
		color: #ffd84d;
		font-size: 1.4rem;
		margin: 0 0 0.5rem;
		font-family: serif;
	}
	.subtitle {
		color: #ccc;
		font-size: 0.95rem;
		margin: 0 0 1.5rem;
	}
	.buttons {
		display: flex;
		gap: 1rem;
		justify-content: center;
	}
	.btn {
		padding: 0.65rem 1.4rem;
		border-radius: 8px;
		font-size: 0.95rem;
		font-weight: bold;
		cursor: pointer;
		border: none;
	}
	.btn-play {
		background: #2e7d32;
		color: #fff;
	}
	.btn-play:hover { background: #388e3c; }
	.btn-end {
		background: #5a1a1a;
		color: #ccc;
	}
	.btn-end:hover { background: #7b2020; }
</style>
