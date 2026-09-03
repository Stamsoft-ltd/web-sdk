<script lang="ts">
	import { stateBet } from 'state-shared';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { fitTextScale } from '../utils/fitText';
	import { CONFIRM_TITLE_FONT_F, CONFIRM_TITLE_FIT_W, CONFIRM_TITLE_FAMILY } from './confirmDialog';

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
	const modeLabel = $derived(
		mode === 'SUPER' ? 'Mega Chain' : mode === 'BONUS' ? 'Drop-O-Magnet' : 'Bonus',
	);
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

<!-- The design puts a close button at the SCREEN's top-right on every dismissible popup
     (9078:18631 POPUPS: 48.7px, #49489B, white glyph — the same one .ap-close draws in the autospin
     modal), and this dialog was the only one without it.

     It RESUMES rather than ends. There is no third outcome here — the round is open and has to be
     either played or settled — so the X is wired to the non-destructive one: ending the round
     settles a bonus the player never gets to see, which is not what an X should do. -->
<button class="resume-close" type="button" onclick={props.onPlay} aria-label={t('PLAY ROUND')}>
	<span class="resume-close__glyph"></span>
</button>

<div class="modal-overlay">
	<div
		class="resume"
		role="dialog"
		aria-modal="true"
		bind:this={boxEl}
		style={`--resume-title-fit:${titleFit}`}
	>
		<div class="resume-panel">
			<div class="resume-title">{title}</div>
			<div class="resume-text">{bodyParts[0]}<strong>{modeLabel}</strong>{bodyParts[1] ?? ''}</div>
			<div class="resume-row">
				<button
					class="resume-btn resume-btn--cancel"
					type="button"
					onclick={handleEnd}
					disabled={ending}>{ending ? '…' : t('END ROUND')}</button
				>
				<button class="resume-btn resume-btn--ok" type="button" onclick={props.onPlay}
					>{t('PLAY ROUND')}</button
				>
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

	/* Width is shared with the other two dialogs — see the plate note below. Not a flat cap: a flat
	   500px is fine on desktop but enormous in a popout (popout L is only ~800 CSS px across), so the
	   vw term shrinks it there while the cap keeps desktop as-is. */
	.resume {
		/* Kept in lockstep with CustomBuyBonusModal .confirm — see the note there (2026-08-10 pass). */
		width: clamp(300px, 54vw, 720px);
		container-type: inline-size;
		font-family: 'Chakra Petch', 'Inter', sans-serif;
	}

	/* MOTHERSHIP confirm popup — plate node 9076:28671 inside the design's "confirm popup" frame
	   (Figma 4036:3584, SECTION 9078:18631 POPUPS). Three dialogs wear this plate — the buy
	   confirmation, the unfinished-round dialog and the insufficient-funds notice — and they must
	   stay identical; the metrics the text fitter needs live in confirmDialog.ts.
	   
	   Re-measured 2026-09-03 off 9076:28671, which REPLACED the 4036-era plate the old numbers came
	   from. What changed: the faces (Audiowide title / Poppins body, not Chakra Petch throughout),
	   a 4px #2D2C69 edge with a #5E4374 hairline inside it, and 196.5x50 buttons on radius 12.
	   The outer plate is 467 design px wide, so with container-type:inline-size 1cqw == 1% of it
	   and every number below is the design's own measurement divided by 467. */
	.resume-panel {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 5.7cqw;
		padding: 4.71cqw 5.35cqw 4.26cqw;
		background: #3a3981;
		border: 0.86cqw solid #2d2c69;
		border-radius: 3cqw;
		/* The design's inner plate carries its own 1px #5E4374 hairline inside the #2D2C69 edge. */
		box-shadow:
			inset 0 0 0 0.21cqw #5e4374,
			0 1.6cqw 3.6cqw rgba(0, 0, 0, 0.5);
	}
	.resume-title {
		text-align: center;
		/* 32/467, AUDIOWIDE — Regular is the family's only weight, so 700 here would be synthesised. */
		font-family: 'Audiowide', 'Chakra Petch', 'Inter', sans-serif;
		font-weight: 400;
		font-size: calc(6.85cqw * var(--resume-title-fit, 1));
		letter-spacing: 0.03em;
		text-transform: uppercase;
		line-height: 1;
		white-space: nowrap;
		color: #ffffff;
	}
	/* WRAPS, unlike the buy confirm's single line — the resume body is a sentence, and the plate is
	   flow-sized, so it simply grows. */
	.resume-text {
		text-align: center;
		/* 20/467, POPPINS Regular. */
		font-family: 'Poppins', 'Chakra Petch', 'Inter', sans-serif;
		font-size: 4.28cqw;
		font-weight: 400;
		letter-spacing: 0.03em;
		color: #fff;
		line-height: 1.3;
	}
	.resume-text strong {
		font-weight: 700;
		color: #cbb6ff;
	}
	/* 9076:28675 — two 196.5x50 buttons 16 apart, spanning 89% of the plate. */
	.resume-row {
		display: flex;
		gap: 3.43cqw;
		justify-content: center;
	}
	.resume-btn {
		height: 10.71cqw;
		min-width: 42.08cqw;
		padding: 0 3cqw;
		/* The design's primary is a flat #A88EFF with NO stroke — which is what this ring already is
		   once the fill matches it, so both variants keep the same box. */
		border: 0.21cqw solid #a88eff;
		border-radius: 2.57cqw;
		font-family: 'Audiowide', 'Chakra Petch', 'Inter', sans-serif;
		font-size: 3.43cqw;
		font-weight: 400;
		letter-spacing: 0.0875em;
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

	/* 9078:18631 — a 48.7px #49489B circle at the screen's top-right with a white X. Sized against
	   the VIEWPORT, not the plate: it sits outside the container-query context, and a fixed-px
	   button takes a huge bite out of a phone screen. The design's 48px is the cap. */
	.resume-close {
		position: fixed;
		top: clamp(10px, 3vw, 22px);
		right: clamp(10px, 3vw, 22px);
		z-index: 10000;
		width: clamp(32px, 8.5vw, 48px);
		height: clamp(32px, 8.5vw, 48px);
		font-size: clamp(10.5px, 2.8vw, 16px);
		padding: 0;
		border: none;
		border-radius: 50%;
		background: #49489b;
		display: grid;
		place-items: center;
		cursor: pointer;
		transition: filter 0.12s ease;
	}
	.resume-close:hover {
		filter: brightness(1.3);
	}
	/* The glyph is two rotated bars, sized in em off the button's own font-size (no cqw out here). */
	.resume-close__glyph {
		position: relative;
		display: block;
		width: 1.155em;
		height: 0.133em;
	}
	.resume-close__glyph::before,
	.resume-close__glyph::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 0.133em;
		background: #fff;
	}
	.resume-close__glyph::before {
		transform: rotate(45deg);
	}
	.resume-close__glyph::after {
		transform: rotate(-45deg);
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
