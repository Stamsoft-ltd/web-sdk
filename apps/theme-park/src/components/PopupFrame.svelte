<script lang="ts" module>
	import { ap } from '../lib/preloadArt';

	// Neon-edged panel art, 640x502 behind the 685x537 settings panel. The confirm dialogs used to
	// have one of these too; they are drawn now — see the `confirm` plate rules below.
	const artWide = ap('/assets/theme-park/v2/popup/wide_panel_neon.webp');
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { i18nDerived } from '../i18n/i18nDerived';
	import PopupBorderLights from './PopupBorderLights.svelte';
	import PopupCloseButton from './PopupCloseButton.svelte';

	type Props = {
		/** 'confirm' = 467x225 two-button dialog; 'wide' = 685x537 settings panel. */
		variant?: 'confirm' | 'wide';
		/**
		 * Clicking the scrim or the top-right close button. Omit to make both inert — a dialog with
		 * no dismiss path (an unfinished round) has to be answered by its own buttons.
		 */
		ondismiss?: () => void;
		dismissLabel?: string;
		children: Snippet;
	};
	const { variant = 'confirm', ondismiss, dismissLabel, children }: Props = $props();
	const label = $derived(dismissLabel ?? i18nDerived.translate('CLOSE'));
</script>

<div class="tp-popup-overlay" data-variant={variant}>
	{#if ondismiss}
		<button class="tp-popup-scrim" type="button" aria-label={label} onclick={ondismiss}></button>
	{/if}
	<div class="tp-popup" data-variant={variant} role="dialog" aria-modal="true">
		{#if variant === 'wide'}
			<img class="tp-popup__art" src={artWide} alt="" />
			<PopupBorderLights {variant} />
		{:else}
			<!-- Two flat plates and a hairline, drawn rather than painted — the confirm dialog has no
			     glow to carry and no lights to run, so there is nothing left for an export to hold. -->
			<div class="tp-popup__plate" aria-hidden="true"></div>
		{/if}
		<div class="tp-popup__content">{@render children()}</div>
	</div>
	<!-- Inside the overlay so it inherits the popup's stacking context and disappears with it. -->
	{#if ondismiss}
		<PopupCloseButton onclick={ondismiss} {label} />
	{/if}
</div>

<style>
	/* Figma 6094:4441 — a flat 70% black scrim, no blur. */
	.tp-popup-overlay {
		position: fixed;
		inset: 0;
		z-index: 9000;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.7);
	}

	.tp-popup-scrim {
		position: absolute;
		inset: 0;
		border: 0;
		padding: 0;
		background: none;
		cursor: pointer;
	}

	/* Every size inside a popup is expressed in cqw — a fraction of the panel's own width — so the
	   whole composition scales as one unit off this single clamp. The clamp is what keeps the design
	   size on desktop while staying readable on a phone, where 467 design px would be unusably small
	   at the HUD's scale factor. */
	.tp-popup {
		position: relative;
		container-type: inline-size;
		font-family: 'Lilita One', sans-serif;
	}

	/* --pop-w is the panel's width IN DESIGN UNITS. Every shared rule below divides a Figma pixel by
	   it, so one set of :global rules renders at the right size in both panels — a bare cqw would
	   make a 14px button caption 21px once it landed in the 685-wide panel instead of the 467. */
	/* min-height rather than aspect-ratio: the design's title is "CONFIRM ALL IN", but the real ones
	   include "CONFIRM DUCK YOUR LUCK", which wraps to two lines. With a locked height and absolutely
	   positioned rows the wrapped title ran straight through the body text. The panel now grows to
	   fit and holds the design's proportions whenever the content fits — which is the common case. */
	.tp-popup[data-variant='confirm'] {
		--pop-w: 467;
		width: clamp(300px, 46vw, 467px);
	}

	.tp-popup[data-variant='wide'] {
		--pop-w: 685;
		width: clamp(320px, 62vw, 685px);
	}

	/* The art carries its own glow falloff out to the edge of the box, so it is placed at inset 0
	   rather than clipped by a radius the way the Figma node is. */
	.tp-popup__art {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	/* The confirm dialog, Figma 7063:18550: a #63307d plate with a #21003D one inset 4 inside it and
	   a #5E4374 hairline around that. It replaces a neon-edged export — a painted glow with running
	   bulbs down its border — which was the only thing in the popup layer still lit that way. Drawn
	   rather than exported because there is nothing here a raster holds better than two rounded
	   rectangles, and the radii then follow the panel's clamp instead of stretching with it. */
	.tp-popup[data-variant='confirm'] .tp-popup__plate {
		position: absolute;
		inset: 0;
		border-radius: calc(14 / var(--pop-w) * 100cqw);
		background: #63307d;
		pointer-events: none;
	}

	.tp-popup[data-variant='confirm'] .tp-popup__plate::after {
		content: '';
		position: absolute;
		inset: calc(4 / var(--pop-w) * 100cqw);
		border: 1px solid #5e4374;
		border-radius: calc(13 / var(--pop-w) * 100cqw);
		background: #21003d;
	}

	/* In flow (not absolute) so the panel's height follows the content. Padding is the design's own
	   inset: confirm has its title at 35 from the top and its 409-wide button row centred in 467,
	   i.e. 29 each side, with 25 left below. The 28 top is 35 less the 7 of empty leading Lilita One
	   carries above its caps at 32/1.15 — the design measures ink, the padding places a line box. */
	/* The design height lives here, NOT on .tp-popup: an element with container-type establishes the
	   container for its DESCENDANTS, so a cqw on .tp-popup itself resolves against the viewport
	   instead of against the panel — which stretched the wide panel to 941px tall. .tp-popup takes
	   its height from this box. */
	.tp-popup__content {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		box-sizing: border-box;
	}

	.tp-popup[data-variant='confirm'] .tp-popup__content {
		min-height: calc(225 / var(--pop-w) * 100cqw);
		padding: calc(28 / var(--pop-w) * 100cqw) calc(29 / var(--pop-w) * 100cqw)
			calc(25 / var(--pop-w) * 100cqw);
	}

	/* Wide: rows start 94 down, the 494-wide column is centred (95.5 each side), 83 left below. */
	.tp-popup[data-variant='wide'] .tp-popup__content {
		min-height: calc(537 / var(--pop-w) * 100cqw);
		padding: calc(94 / var(--pop-w) * 100cqw) calc(95.5 / var(--pop-w) * 100cqw)
			calc(83 / var(--pop-w) * 100cqw);
	}

	/* ── Shared popup type and controls ───────────────────────────────────────────────────────────
	   :global because these are used by the dialogs that mount inside `children`, and Svelte scopes
	   styles to the file that declares the markup. One source of truth for the design language. */

	/* Lilita One 32 / 0.96 tracking, white (node 7063:18552). It used to be the magenta-to-blue
	   gradient the buttons still wear; the redesign keeps the gradient for the one control it wants
	   the eye to land on and leaves the heading plain. Only the two confirm dialogs use this class —
	   the wide panel labels its rows with .tp-popup__label instead. */
	:global(.tp-popup__title) {
		margin: 0;
		font-family: 'Lilita One', sans-serif;
		font-weight: 400;
		font-size: calc(32 / var(--pop-w) * 100cqw);
		letter-spacing: 0.03em;
		line-height: 1.15;
		text-align: center;
		text-transform: uppercase;
		color: #fff;
	}

	/* Nunito Sans Regular 20 / 0.6 tracking, white (node 6401:2083). */
	:global(.tp-popup__body) {
		margin: 0;
		font-family: 'Nunito Sans', sans-serif;
		font-weight: 400;
		font-size: calc(20 / var(--pop-w) * 100cqw);
		letter-spacing: 0.03em;
		line-height: 1.3;
		text-align: center;
		color: #fff;
	}

	/* Nunito Sans Bold 20 / 0.6 tracking — the wide panel's row labels (node 6045:4622). */
	:global(.tp-popup__label) {
		margin: 0;
		font-family: 'Nunito Sans', sans-serif;
		font-weight: 700;
		font-size: calc(20 / var(--pop-w) * 100cqw);
		letter-spacing: 0.03em;
		color: #fff;
	}

	/* 44 tall, radius 12, 1px #b65df3, 12/24 padding, Lilita One 14 / 1.4 tracking
	   (nodes 6401:2085, 6401:2086, 6045:4632). */
	:global(.tp-popup__btn) {
		flex: 1 0 0;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		border: 1px solid #b65df3;
		border-radius: calc(12 / var(--pop-w) * 100cqw);
		/* Height is stated rather than left to 12 + 20 + 12 + 2px of border, which lands on 46. */
		height: calc(44 / var(--pop-w) * 100cqw);
		padding: 0 calc(24 / var(--pop-w) * 100cqw);
		background-image: linear-gradient(0deg, #1a0535 0%, #000 100%);
		filter: drop-shadow(0 4px 2px rgba(0, 0, 0, 0.25));
		cursor: pointer;
		font-family: 'Lilita One', sans-serif;
		font-weight: 400;
		font-size: calc(14 / var(--pop-w) * 100cqw);
		letter-spacing: 0.1em;
		line-height: calc(20 / var(--pop-w) * 100cqw);
		text-transform: uppercase;
		color: #fff;
		transition:
			transform 0.12s ease,
			filter 0.12s ease;
	}

	:global(.tp-popup__btn--primary) {
		background-image: linear-gradient(167.38deg, #d836fc 0%, #272fdd 100%);
	}

	:global(.tp-popup__btn:not(:disabled):hover) {
		filter: brightness(1.12) drop-shadow(0 4px 2px rgba(0, 0, 0, 0.25));
	}

	:global(.tp-popup__btn:not(:disabled):active) {
		transform: translateY(1px) scale(0.985);
	}

	:global(.tp-popup__btn:disabled) {
		opacity: 0.45;
		cursor: default;
	}

	/* The confirm dialog's own buttons (nodes 7063:18554-18557): taller at 50, caption up to 16, and
	   the two states told apart by their fill rather than by a shared dark fill and a shared lilac
	   hairline. Cancel is the inner plate's colour with the outer plate's colour as its edge, so it
	   reads as part of the panel; confirm keeps the gradient and edges itself in the gradient's own
	   magenta. Neither casts a shadow — nothing else on this panel does.

	   Scoped to the variant because .tp-popup__btn is also the wide panel's START AUTOPLAY button,
	   which the redesign leaves alone. */
	:global(.tp-popup[data-variant='confirm'] .tp-popup__btn) {
		height: calc(50 / var(--pop-w) * 100cqw);
		border-color: #63307d;
		background-image: none;
		background-color: #21013d;
		filter: none;
		font-size: calc(16 / var(--pop-w) * 100cqw);
		/* 1.4px at 16, i.e. 0.0875em — stated in design units so it tracks the panel, not the font. */
		letter-spacing: calc(1.4 / var(--pop-w) * 100cqw);
	}

	:global(.tp-popup[data-variant='confirm'] .tp-popup__btn--primary) {
		border-color: #d836fc;
		background-image: linear-gradient(165.72deg, #d836fc 0%, #272fdd 100%);
	}

	:global(.tp-popup[data-variant='confirm'] .tp-popup__btn:not(:disabled):hover) {
		filter: brightness(1.12);
	}

	/* 62 x 33.214 pill. ON is the magenta-to-blue gradient with no border; OFF is the dark gradient
	   with the #d836fc hairline (component "Toggle button"). Knob is a plain white circle 34/47.6 of
	   the track height, inset 4.43. */
	:global(.tp-popup__toggle) {
		position: relative;
		flex: 0 0 auto;
		width: calc(62 / var(--pop-w) * 100cqw);
		height: calc(33.214 / var(--pop-w) * 100cqw);
		padding: 0;
		border: 1px solid #d836fc;
		border-radius: 9999px;
		background-image: linear-gradient(0deg, #1a0535 0%, #000 100%);
		cursor: pointer;
		box-sizing: border-box;
		transition: background-image 0.2s ease;
	}

	:global(.tp-popup__toggle[aria-pressed='true']) {
		border-color: transparent;
		background-image: linear-gradient(151.82deg, #d836fc 0%, #272fdd 100%);
	}

	:global(.tp-popup__toggle::after) {
		content: '';
		position: absolute;
		top: calc(4.43 / var(--pop-w) * 100cqw);
		left: calc(4.43 / var(--pop-w) * 100cqw);
		width: calc(24.3571 / var(--pop-w) * 100cqw);
		height: calc(24.3571 / var(--pop-w) * 100cqw);
		border-radius: 50%;
		background: #fff;
		transition: transform 0.2s ease;
	}

	:global(.tp-popup__toggle[aria-pressed='true']::after) {
		transform: translateX(calc(28.7866 / var(--pop-w) * 100cqw));
	}
</style>
