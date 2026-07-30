<script lang="ts">
	import { stateBet } from 'state-shared';
	import { i18nDerived } from '../i18n/i18nDerived';

	const t = (k: string) => i18nDerived.translate(k);

	type Props = { onPlay: () => void; onEnd: () => void | Promise<void> };
	const props: Props = $props();

	const panelBg = './assets/components/ui/confirm_panel.webp?v=20260708b';

	let ending = $state(false);
	const handleEnd = async () => {
		ending = true;
		await props.onEnd();
		ending = false;
	};

	const mode = $derived(stateBet.betToResume?.mode ?? '');
	const modeLabel = $derived(mode === 'SUPER' ? 'Mega Chain' : mode === 'BONUS' ? 'Drop-O-Magnet' : 'Bonus');
	// Split the localized body around %mode% so the mode name stays bold in any language.
	const bodyParts = $derived(t('RESUME BODY').split('%mode%'));
</script>

<div class="modal-overlay">
	<div class="resume" role="dialog" aria-modal="true">
		<div class="resume-panel" style={`background-image:url('${panelBg}')`}>
			<div class="resume-content">
				<div class="resume-title">{t('UNFINISHED ROUND')}</div>
				<div class="resume-text">{bodyParts[0]}<strong>{modeLabel}</strong>{bodyParts[1] ?? ''}</div>
				<div class="resume-row">
					<button class="resume-btn resume-btn--ok" type="button" onclick={props.onPlay}>{t('PLAY ROUND')}</button>
					<button class="resume-btn resume-btn--cancel" type="button" onclick={handleEnd} disabled={ending}>{ending ? '…' : t('END ROUND')}</button>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.72);
		backdrop-filter: blur(5px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
	}

	.resume {
		/* Figma panel is 500px wide; the cqw units below resolve to the spec px at that width, so this
		   single value scales the whole dialog — text, padding and buttons included.

		   Was min(500px, 92vw), i.e. a flat 500px on anything wider than ~545px. That is fine on
		   desktop but enormous in a popout: popout L is only ~800 CSS px across, so the panel took 62%
		   of the window, and popout S fell back to 92vw and spanned it almost edge to edge. The 32vw
		   term halves it in both (≈256px at popout L, floored at 170px for popout S) while the 500px
		   cap keeps desktop exactly as it was. */
		width: clamp(170px, 32vw, 500px);
		container-type: inline-size;
		font-family: 'Inter', sans-serif;
	}

	/* Blue bracketed panel background (shared with the buy-bonus confirm dialog) */
	.resume-panel {
		aspect-ratio: 500 / 300;
		background-size: 100% 100%;
		background-repeat: no-repeat;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 13% 13% 14%;
		box-sizing: border-box;
	}

	.resume-content {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		text-align: center;
	}

	/* IBM Plex Sans Condensed Black, cyan→blue gradient (Figma #00fcff → #0046a9) */
	.resume-title {
		font-family: 'IBM Plex Sans Condensed', 'Inter', sans-serif;
		font-weight: 900;
		font-size: 4.8cqw;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		line-height: 1;
		white-space: nowrap;
		background: linear-gradient(180deg, #00fcff 0%, #0046a9 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		color: transparent;
		filter: drop-shadow(0 2px 8px rgba(0, 60, 140, 0.55));
	}

	/* Inter, white (Figma 20px / 0.6px) */
	.resume-text {
		font-family: 'Inter', sans-serif;
		font-size: 3.8cqw;
		font-weight: 500;
		letter-spacing: 0.03em;
		color: #fff;
		line-height: 1.35;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.7);
	}
	.resume-text strong {
		font-weight: 700;
		color: #7fdcff;
	}

	.resume-row {
		display: flex;
		gap: 3.2cqw;
		justify-content: center;
	}
	.resume-btn {
		border: 1px solid #60a5fa;
		border-radius: 2.4cqw;
		padding: 2.4cqw 4.8cqw;
		min-width: 28cqw;
		font-family: 'Inter', sans-serif;
		font-size: 2.8cqw;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #fff;
		cursor: pointer;
		filter: drop-shadow(0 4px 2px rgba(0, 0, 0, 0.25));
		transition: filter 0.12s ease;
	}
	.resume-btn:hover {
		filter: brightness(1.12) drop-shadow(0 4px 2px rgba(0, 0, 0, 0.25));
	}
	/* Play Round — bright cyan (primary) */
	.resume-btn--ok {
		background: linear-gradient(180deg, #00fcff 0%, #0046a9 100%);
	}
	/* End Round — dark navy (secondary) */
	.resume-btn--cancel {
		background: linear-gradient(0deg, #0f2053 0%, #000000 100%);
	}
</style>
