<script lang="ts">
	import { stateBet, stateI18nDerived } from 'state-shared';

	type Props = { onPlay: () => void; onEnd: () => void | Promise<void> };
	const props: Props = $props();
	const t = (key: string) => stateI18nDerived.translate(key);

	let ending = $state(false);
	const mode = $derived(String(stateBet.betToResume?.mode ?? '').toUpperCase());
	const modeLabel = $derived(
		t(
			mode === 'SUPER'
				? 'MODE SUPER TITLE'
				: mode === 'MYSTERY'
					? 'MODE MYSTERY TITLE'
					: mode === 'BONUS'
						? 'MODE BONUS TITLE'
						: 'BONUS',
		),
	);
	const bodyParts = $derived(t('RESUME BODY').split('%mode%'));
	const endRound = async () => {
		if (ending) return;
		ending = true;
		await props.onEnd();
		ending = false;
	};
</script>

<div class="resume-overlay">
	<section class="resume-card" role="dialog" aria-modal="true" aria-labelledby="resume-title">
		<h2 id="resume-title">{t('UNFINISHED ROUND')}</h2>
		<p>{bodyParts[0]}<strong>{modeLabel}</strong>{bodyParts[1] ?? ''}</p>
		<div class="actions">
			<button class="secondary" type="button" disabled={ending} onclick={endRound}
				>{ending ? '…' : t('END ROUND')}</button
			>
			<button class="primary" type="button" onclick={props.onPlay}>{t('PLAY ROUND')}</button>
		</div>
	</section>
</div>

<style>
	.resume-overlay {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: grid;
		place-items: center;
		padding: 18px;
		background: rgb(4 14 7 / 76%);
	}
	.resume-card {
		width: min(620px, 94vw);
		padding: clamp(24px, 5vw, 48px);
		border: 8px solid #321304;
		background: #31521c;
		box-shadow:
			inset 0 0 0 5px #e5a538,
			inset 0 0 0 10px #6d3510,
			8px 8px 0 rgb(16 6 1 / 72%);
		color: #fff;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		text-align: center;
		image-rendering: pixelated;
	}
	h2 {
		margin: 0 0 20px;
		color: #ffd052;
		font-size: clamp(24px, 5vw, 46px);
		line-height: 1;
		text-shadow: 4px 4px 0 #4b2207;
	}
	p {
		margin: 0 auto 28px;
		max-width: 480px;
		font-size: clamp(14px, 2.2vw, 21px);
		line-height: 1.5;
	}
	strong {
		color: #ffe463;
	}
	.actions {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 14px;
	}
	button {
		min-height: 52px;
		border: 4px solid #3b1905;
		padding: 10px 16px;
		border-radius: 0;
		color: #fff;
		font:
			900 clamp(12px, 2vw, 18px) ui-monospace,
			monospace;
		cursor: pointer;
	}
	.primary {
		background: #ed9300;
	}
	.secondary {
		background: #54280b;
	}
	button:disabled {
		opacity: 0.55;
		cursor: default;
	}
	@media (max-width: 460px) {
		.actions {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 520px) and (max-height: 300px) and (orientation: landscape) {
		.resume-overlay {
			padding: 4px;
		}
		.resume-card {
			width: min(360px, calc(100vw - 8px));
			max-height: calc(100dvh - 8px);
			padding: 10px 12px;
			border-width: 4px;
			box-shadow:
				inset 0 0 0 2px #e5a538,
				inset 0 0 0 5px #6d3510,
				3px 3px 0 rgb(16 6 1 / 72%);
			overflow: auto;
		}
		h2 {
			margin-bottom: 6px;
			font-size: 16px;
			text-shadow: 2px 2px 0 #4b2207;
		}
		p {
			margin-bottom: 7px;
			font-size: 8px;
			line-height: 1.2;
		}
		.actions {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 6px;
		}
		button {
			min-height: 28px;
			padding: 3px 6px;
			border-width: 2px;
			font-size: 8px;
		}
	}
</style>
