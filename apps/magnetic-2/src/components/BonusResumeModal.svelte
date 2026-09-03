<script lang="ts">
	import { stateBet } from 'state-shared';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { fitTextScale } from '../utils/fitText';
	import {
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
		<div class="resume-panel">
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

	/* The plate is DRAWN, not art: a flat rounded rectangle, exactly what the design is. It also
	   stopped being a fixed-aspect box — the three dialogs that wear it hold one nowrap line, a
	   wrapping sentence and a single button respectively, and an `aspect-ratio` plate sized for one
	   of them clips or strands the other two. Flow layout at the design's own paddings instead.
	   Design 4036:3584: plate 458x215, radius 14, fill #3A3981 over a #2D2C69 edge. */
	.resume-panel {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6.3cqw;
		padding: 6.33cqw 5.5cqw 4.37cqw;
		background: #3a3981;
		border: 0.44cqw solid #2d2c69;
		border-radius: 3.06cqw;
		box-shadow: 0 1.6cqw 3.6cqw rgba(0, 0, 0, 0.5);
	}
	/* Design 4036:3584 — Chakra Petch Bold 30/458 of the plate, WHITE (the Version2 plate set this
	   in #2391C1; the MOTHERSHIP design does not). */
	.resume-title {
		text-align: center;
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-weight: 700;
		font-size: calc(6.55cqw * var(--resume-title-fit, 1));
		letter-spacing: 0.03em;
		text-transform: uppercase;
		line-height: 1;
		white-space: nowrap;
		color: #ffffff;
	}
	/* Design 4036:3584 — 20/458 of the plate, white. WRAPS (unlike the buy confirm's single line)
	   because the resume body is a sentence; the plate is flow-sized, so it simply grows. */
	.resume-text {
		text-align: center;
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-size: 4.37cqw;
		font-weight: 600;
		letter-spacing: 0.03em;
		color: #fff;
		line-height: 1.3;
	}
	.resume-text strong {
		font-weight: 700;
		color: #cbb6ff;
	}
	/* Design 4036:3584 — two 196x48 buttons, 17 apart, spanning 89.3% of the plate. */
	.resume-row {
		display: flex;
		gap: 3.71cqw;
		justify-content: center;
	}
	.resume-btn {
		height: 10.48cqw;
		min-width: 42.79cqw;
		padding: 0 3cqw;
		border: 0.22cqw solid #a88eff;
		border-radius: 1.75cqw;
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-size: 3.28cqw;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		white-space: nowrap;
		color: #ffffff;
		cursor: pointer;
		background: #47468a;
		transition: filter 0.12s ease;
	}
	.resume-btn:hover {
		filter: brightness(1.18);
	}
	.resume-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}
	/* Play Round — the design's primary: flat #A88EFF */
	.resume-btn--ok {
		background: #a88eff;
	}
	/* End Round — the design's secondary: the plate's own lighter purple, outlined */
	.resume-btn--cancel {
		background: #47468a;
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
