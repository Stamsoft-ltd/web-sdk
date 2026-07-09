<script lang="ts">
	import { stateBet } from 'state-shared';

	type Props = { onPlay: () => void; onEnd: () => Promise<void> };
	const props: Props = $props();

	const panelBg = './assets/components/ui/confirm_panel.png?v=20260708b';

	let ending = $state(false);
	const handleEnd = async () => {
		ending = true;
		await props.onEnd();
		ending = false;
	};

	const mode = $derived(stateBet.betToResume?.mode ?? '');
	const modeLabel = $derived(mode === 'SUPER' ? 'Mega Chain' : mode === 'BONUS' ? 'Drop-O-Magnet' : 'Bonus');
</script>

<div class="modal-overlay">
	<div class="resume" role="dialog" aria-modal="true">
		<div class="resume-panel" style={`background-image:url('${panelBg}')`}>
			<div class="resume-content">
				<div class="resume-title">UNFINISHED ROUND</div>
				<div class="resume-text">You have an active <strong>{modeLabel}</strong> bonus in progress.</div>
				<div class="resume-row">
					<button class="resume-btn resume-btn--ok" type="button" onclick={props.onPlay}>PLAY ROUND</button>
					<button class="resume-btn resume-btn--cancel" type="button" onclick={handleEnd} disabled={ending}>{ending ? '…' : 'END ROUND'}</button>
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
		/* Figma panel is 500px wide; cqw units below resolve to the spec px at this width. */
		width: min(500px, 92vw);
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

	/* Cinzel Black, cyan→blue gradient (Figma #00fcff → #0046a9) */
	.resume-title {
		font-family: 'Cinzel', serif;
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
