<script lang="ts">
	import { stateBet } from 'state-shared';
	import { i18nDerived } from '../i18n/i18nDerived';

	type Props = { onPlay: () => void; onEnd: () => void };
	const props: Props = $props();

	const ap = (p: string) => `./${p.startsWith('/') ? p.slice(1) : p}`;
	const confirmPanelBg = ap('/assets/components/ui/confirm_frame.webp?v=20260624');

	const mode = $derived(stateBet.betToResume?.mode ?? '');
	const modeLabel = $derived(mode === 'SUPER' ? 'All In' : mode === 'BONUS' ? 'Deal It' : 'Bonus');
</script>

<!-- Backdrop -->
<div class="backdrop"></div>

<!-- Confirm-styled panel -->
<div class="confirm" role="dialog" aria-modal="true">
	<div class="confirm-panel" style={`background-image:url('${confirmPanelBg}')`}>
		<div class="confirm-content">
			<div class="confirm-title">{i18nDerived.translate('RESUME TITLE')}</div>
			<div class="confirm-text">{i18nDerived.translateVars('RESUME BODY', { mode: modeLabel })}</div>
			<div class="confirm-row">
				<button class="confirm-btn confirm-btn--cancel" type="button" onclick={props.onEnd}>✕ {i18nDerived.translate('END ROUND')}</button>
				<button class="confirm-btn confirm-btn--ok" type="button" onclick={props.onPlay}>▶ {i18nDerived.translate('PLAY ROUND')}</button>
			</div>
		</div>
	</div>
</div>

<style>
	.backdrop {
		position: fixed; inset: 0; z-index: 9998;
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(4px);
	}

	.confirm {
		position: fixed; left: 50%; top: 50%;
		transform: translate(-50%, -50%);
		z-index: 9999;
		/* Cap by height too (panel is 505:301) — on short landscape screens the width cap alone
		   let the panel outgrow the viewport and the text spilled onto the wooden border. */
		width: min(680px, 94vw, 150vh);
		font-family: 'Cinzel', serif;
		/* All inner sizing is in cqw so the content scales with the panel, not the viewport. */
		container-type: inline-size;
	}

	.confirm-panel {
		aspect-ratio: 505 / 301;
		background-size: 100% 100%;
		background-repeat: no-repeat;
		display: flex; align-items: center; justify-content: center;
		padding: 15% 13%;
		box-sizing: border-box;
	}

	.confirm-content {
		width: 100%;
		display: flex; flex-direction: column; align-items: center;
		gap: 3.4cqw;
		text-align: center;
	}

	.confirm-title {
		font-weight: 900; font-size: 4.7cqw;
		white-space: nowrap;
		letter-spacing: 0.06em;
		background: linear-gradient(180deg, #ffd84a 10%, #ffa90e 60%, #d18005 95%);
		-webkit-background-clip: text; background-clip: text;
		-webkit-text-fill-color: transparent; color: transparent;
		text-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
	}
	.confirm-text {
		font-size: 2.9cqw; font-weight: 700;
		color: #fff; line-height: 1.45;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.7);
	}
	.confirm-text strong { color: #ffd84a; }

	.confirm-row { display: flex; gap: 2.4cqw; justify-content: center; width: 100%; }
	.confirm-btn {
		flex: 1 1 0; border-radius: 1.6cqw; padding: 2.2cqw;
		font-family: 'Cinzel', serif; font-size: 2.4cqw; font-weight: 900;
		letter-spacing: 0.06em; cursor: pointer;
		transition: filter 0.12s ease;
		white-space: nowrap;
	}
	.confirm-btn:hover { filter: brightness(1.08); }
	.confirm-btn--cancel {
		border: 1px solid rgba(217, 133, 3, 0.5);
		background: rgba(20, 14, 6, 0.6); color: #e8c878;
	}
	.confirm-btn--ok {
		border: 0;
		background: linear-gradient(180deg, #ffa90e 15%, #ee960b 70%, #d18005 93%);
		color: #452b01;
		box-shadow: 0 0 4px #d98503;
	}
</style>
