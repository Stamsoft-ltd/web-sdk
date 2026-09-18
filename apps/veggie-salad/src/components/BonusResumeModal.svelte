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
		<p class="font-copy">{bodyParts[0]}<strong>{modeLabel}</strong>{bodyParts[1] ?? ''}</p>
		<div class="actions">
			<button class="secondary" type="button" disabled={ending} onclick={endRound}
				>{ending ? '…' : t('END ROUND')}</button
			>
			<button class="primary" type="button" onclick={props.onPlay}>{t('PLAY ROUND')}</button>
		</div>
	</section>
</div>

<style>
	/* Design 9024:5943. The dialog is the same slab the rest of this game's panels are built from —
	   a 604x294 box of #351E01 inside a 3px #935901 border — so it is sized the same way: one `--u`
	   unit equal to a design pixel, and every measurement below is that frame's own. Sizing the
	   parts independently is what made this one read as a different game: a gold-and-green plaque
	   with brown slab buttons, none of which appear in the design. */
	.resume-overlay {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: grid;
		place-items: center;
		padding: 18px;
		background: rgb(6 3 0 / 62%);
	}
	.resume-card {
		--u: calc(min(604px, 92vw, 118svh) / 604);
		box-sizing: border-box;
		width: calc(604 * var(--u));
		max-height: calc(100svh - 24px);
		overflow-y: auto;
		padding: calc(32 * var(--u)) calc(30 * var(--u)) calc(38 * var(--u));
		border: calc(3 * var(--u)) solid #935901;
		border-radius: calc(12 * var(--u));
		background: #351e01;
		box-shadow: none;
		color: #f2cb8c;
		font-family: 'Jersey 10', monospace;
		text-align: center;
	}
	h2 {
		margin: 0;
		color: #f2a52f;
		font-size: calc(52 * var(--u));
		font-weight: 400;
		line-height: 1;
		text-shadow: none;
	}
	p {
		margin: calc(40 * var(--u)) auto calc(36 * var(--u));
		max-width: calc(440 * var(--u));
		color: #f2cb8c;
		font-size: calc(19 * var(--u));
		line-height: 1.6;
	}
	strong {
		color: #f2a52f;
		font-weight: 700;
	}
	.actions {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: calc(15 * var(--u));
	}
	button {
		display: grid;
		place-items: center;
		box-sizing: border-box;
		min-height: calc(60 * var(--u));
		padding: calc(8 * var(--u)) calc(12 * var(--u));
		border: 0;
		border-radius: calc(8 * var(--u));
		font-family: 'Jersey 10', monospace;
		font-size: calc(21 * var(--u));
		font-weight: 400;
		letter-spacing: calc(0.6 * var(--u));
		line-height: 1;
		cursor: pointer;
	}
	/* Design 9024:5943 gives the destructive action an outline and the safe one the fill. */
	.secondary {
		border: calc(1 * var(--u)) solid #935906;
		background: #361e01;
		color: #f2cb8c;
	}
	.primary {
		background: #e38b01;
		color: #fff;
	}
	button:disabled {
		opacity: 0.55;
		cursor: default;
	}
	/* The whole dialog is one drawing, so the small shells only narrow `--u` — nothing inside it
	   is re-sized on its own. */
	@media (max-width: 460px) {
		.resume-card {
			--u: calc(min(388px, 100vw - 8px, (100dvh - 8px) * 604 / 294) / 604);
		}
	}
	@media (max-width: 520px) and (max-height: 300px) and (orientation: landscape) {
		.resume-overlay {
			padding: 4px;
		}
		.resume-card {
			--u: calc(min(604px, 100vw - 16px, (100svh - 16px) * 604 / 294) / 604);
			max-height: calc(100dvh - 8px);
		}
	}
</style>
