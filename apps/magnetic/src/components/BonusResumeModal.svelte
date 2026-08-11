<script lang="ts">
	import { stateBet } from 'state-shared';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { fitTextScale } from '../utils/fitText';
	import {
		CONFIRM_PANEL_BG,
		CONFIRM_TITLE_FONT_F,
		CONFIRM_TITLE_FIT_W,
		CONFIRM_TITLE_FAMILY,
	} from './confirmDialog';

	const t = (k: string) => i18nDerived.translate(k);

	type Props = { onPlay: () => void; onEnd: () => void | Promise<void> };
	const props: Props = $props();

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

	// The design's heading is ONE nowrap line; longer translations shrink to fit the plate.
	const title = $derived(t('UNFINISHED ROUND'));
	let boxW = $state(0);
	let boxEl = $state<HTMLDivElement>();
	$effect(() => {
		const el = boxEl;
		if (!el) return;
		const measure = () => (boxW = el.clientWidth);
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => ro.disconnect();
	});
	const titleFit = $derived(
		fitTextScale(title, {
			fontSizePx: boxW * CONFIRM_TITLE_FONT_F,
			availablePx: boxW * CONFIRM_TITLE_FIT_W,
			fontFamily: CONFIRM_TITLE_FAMILY,
			letterSpacingEm: 0.03,
		}),
	);
</script>

<div class="modal-overlay">
	<div class="resume" role="dialog" aria-modal="true" bind:this={boxEl} style={`--resume-title-fit:${titleFit}`}>
		<div class="resume-panel" style={`background-image:url('${CONFIRM_PANEL_BG}')`}>
			<div class="resume-title">{title}</div>
			<div class="resume-text">{bodyParts[0]}<strong>{modeLabel}</strong>{bodyParts[1] ?? ''}</div>
			<div class="resume-row">
				<button class="resume-btn resume-btn--cancel" type="button" onclick={handleEnd} disabled={ending}>{ending ? '…' : t('END ROUND')}</button>
				<button class="resume-btn resume-btn--ok" type="button" onclick={props.onPlay}>{t('PLAY ROUND')}</button>
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

	/* Version2 confirm popup (Figma 4036-3584, art node 7002:11406). The same plate and the same
	   numbers drive CustomBuyBonusModal's .confirm block — see confirmDialog.ts, and keep the two
	   style blocks in sync.

	   The keyed art box is 507.33 x 283 design px, so with container-type:inline-size on this
	   element 1cqw == 1% of the design width and every number below is the design's own measurement.

	   Width stays clamp(170px, 32vw, 508px) — not a flat cap. A flat 500px is fine on desktop but
	   enormous in a popout: popout L is only ~800 CSS px across, so the panel took 62% of the
	   window. The 32vw term halves it there while the cap keeps desktop as-is. */
	.resume {
		/* Kept in lockstep with CustomBuyBonusModal .confirm — see the note there (2026-08-10 pass). */
		width: clamp(300px, 54vw, 720px);
		container-type: inline-size;
		font-family: 'Chakra Petch', 'Inter', sans-serif;
	}

	/* Steel-framed plate; children are absolutely positioned at the design's own % offsets. */
	.resume-panel {
		position: relative;
		aspect-ratio: 507.33 / 283;
		background-size: 100% 100%;
		background-repeat: no-repeat;
	}

	/* Figma 4154:20115 — IBM Plex Sans Condensed Bold 32px, FLAT #2391C1 (not a gradient). */
	.resume-title {
		position: absolute;
		left: 7%;
		right: 7%;
		top: 29.33%;
		transform: translateY(-50%);
		text-align: center;
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-weight: 700;
		font-size: calc(6.31cqw * var(--resume-title-fit, 1));
		letter-spacing: 0.03em;
		text-transform: uppercase;
		line-height: 1;
		white-space: nowrap;
		color: #2391c1;
	}

	/* Figma 4036:3614 — Inter Medium 20px, white, 0.6px tracking. Wraps (unlike the buy confirm's
	   single line) because the resume body is a sentence. */
	.resume-text {
		position: absolute;
		left: 8%;
		right: 8%;
		top: 50.18%;
		transform: translateY(-50%);
		text-align: center;
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-size: 3.94cqw;
		font-weight: 600;
		letter-spacing: 0.03em;
		color: #fff;
		line-height: 1.3;
	}
	.resume-text strong {
		font-weight: 700;
		color: #7fdcff;
	}

	/* Figma 4036:3615 — two 143.95x44 buttons, 16px apart, centred at 71.38% of the plate. */
	.resume-row {
		position: absolute;
		left: 0;
		right: 0;
		top: 71.38%;
		transform: translateY(-50%);
		display: flex;
		gap: 3.15cqw;
		justify-content: center;
	}
	.resume-btn {
		height: 8.67cqw;
		min-width: 28.37cqw;
		padding: 0 4.73cqw;
		border: 1px solid #60a5fa;
		border-radius: 2.37cqw;
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-size: 2.76cqw;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		white-space: nowrap;
		color: #fff;
		cursor: pointer;
		filter: drop-shadow(0 4px 2px rgba(0, 0, 0, 0.25));
		transition: filter 0.12s ease;
	}
	.resume-btn:hover {
		filter: brightness(1.12) drop-shadow(0 4px 2px rgba(0, 0, 0, 0.25));
	}
	.resume-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}
	/* Play Round — the design's primary: flat #28A6DE */
	.resume-btn--ok {
		background: #28a6de;
	}
	/* End Round — the design's secondary: near-black navy */
	.resume-btn--cancel {
		background: linear-gradient(0deg, #0f2053 0%, #000000 100%);
	}

	/* Buttons do NOT inherit font-family: the UA stylesheet hard-sets `font: 400 13.333px Arial` on
	   form controls, so every <button> here (and the glyph spans inside them) rendered in Arial no
	   matter what the container was set to — measured via getComputedStyle, not assumed.
	   Deliberately NOT scoped to a root element, and set OUTRIGHT rather than to `inherit`: the
	   confirm dialog in CustomBuyBonusModal is a SIBLING of .panel, so a `.panel button` rule misses
	   its buttons, and `inherit` on a top-level sibling like .confirm-close resolves against <body>,
	   not the dialog. Svelte already scopes this to the component. */
	button {
		font-family: 'Chakra Petch', 'Inter', sans-serif;
	}
</style>
