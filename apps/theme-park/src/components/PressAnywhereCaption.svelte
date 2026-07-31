<script lang="ts">
	import { getContext } from '../game/context';

	const context = getContext();
	const showing = $derived(context.stateGame.pressToContinueShowing);
</script>

<!-- Figma 6094:4022: the line sits across the HUD bar, 41 up from the bottom of the 670-tall frame,
     centred, white, 16px. Inert to pointer events — the press itself is handled on the canvas by
     <PressToContinue>, and a DOM element that swallowed the click would break every one of those
     screens. -->
{#if showing}
	<div class="press-anywhere" aria-hidden="true">
		{context.i18nDerived.translate('PRESS ANYWHERE TO CONTINUE')}
		<span class="press-anywhere__arrow">→</span>
	</div>
{/if}

<style>
	.press-anywhere {
		position: absolute;
		left: 0;
		right: 0;
		/* 41 / 670 of the frame height, measured from the bottom. */
		bottom: 6.1%;
		z-index: 21;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.7em;
		pointer-events: none;
		font-family: Helvetica, Arial, sans-serif;
		font-weight: 700;
		/* 16 of the design's 1200-wide frame, held between legible and oversized. */
		font-size: clamp(11px, 1.33vw, 21px);
		letter-spacing: 0.04em;
		color: #fff;
		text-shadow: 0 2px 6px rgba(0, 0, 0, 0.65);
	}

	.press-anywhere__arrow {
		font-size: 1.15em;
		line-height: 1;
	}
</style>
