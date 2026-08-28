<script lang="ts" module>
	import { ap } from '../lib/preloadArt';

	const iconClose = ap('/assets/theme-park/v2/hud/icon_close.svg');
</script>

<script lang="ts">
	import { i18nDerived } from '../i18n/i18nDerived';

	type Props = {
		onclick: () => void;
		/** Announced to screen readers; defaults to the translated "CLOSE". */
		label?: string;
	};
	const { onclick, label }: Props = $props();
</script>

<button
	class="popup-close"
	type="button"
	aria-label={label ?? i18nDerived.translate('CLOSE')}
	{onclick}
>
	<img src={iconClose} alt="" />
</button>

<style>
	/* Figma 6094:4443. The close is a screen-corner control, not a panel-corner one: in the 1200x670
	   frame it is a 48.696 "Icon buttons" circle at (1118, 29) — 33.3 in from the frame's right edge
	   — while the dialog itself is centred far below it. Every popup shows the same one in the same
	   place, so it does not move as panels change size.

	   --close-u is that frame's design unit. It fits the WHOLE 1200x670 frame inside the window,
	   `min(100vw / 1200, 100vh / 670)`, which is the same expression <CustomBuyBonusModal>'s .stage
	   uses for its own --u — so the button scales with the panel it closes instead of drifting away
	   from it. Sizing it off the width alone was the bug: a popout is short and wide, so the game
	   scaled itself by height while this scaled by width, and at 800x470 the X came out 1.4x too big
	   for its cards (at 420x240, 2.6x). The ceiling stops it growing on a wide monitor once the
	   design's proportions no longer apply.

	   The 40px floor that used to sit under it is a FINGER measurement, so it now applies only where
	   there is a finger. On a phone it still wins — 100vw/1200 there is ~0.33, a 16px target — and
	   the button is knowingly out of proportion with the modal, which is what --close-clear in
	   <CustomBuyBonusModal> reserves room for. With a mouse there is nothing to floor: a popout
	   window is a desktop surface, and the pointer hits a 17px target as happily as a 40px one.

	   The inset is measured from the viewport edge, not from the HUD's centred column, so it stays in
	   the screen's corner at every width. */
	.popup-close {
		--close-fit: min(100vw / 1200, 100vh / 670, 1.25px);
		--close-u: var(--close-fit);
		position: fixed;
		/* The design's own inset is (29, 33.3); pulled in to (18, 22) on 2026-08-27 because the button
		   was landing on the top-right corner of the panel below it rather than beside it. Still far
		   enough off the two edges that no browser's own chrome can crop it. */
		top: calc(var(--close-u) * 18);
		right: calc(var(--close-u) * 22);
		z-index: 62;
		width: calc(var(--close-u) * 48.696);
		height: calc(var(--close-u) * 48.696);
		padding: 0;
		box-sizing: border-box;
		/* Rim, not a hairline: the "Icon buttons" component strokes itself with the brand sweep —
		   magenta on the top-left shoulder, cold blue on the bottom-right (Figma 7057:9389, whose
		   SVG export gives the stops verbatim). The fill stays the same near-black lifting to
		   #1a0535 at the bottom. Two backgrounds do it, the fill clipped to the padding box and the
		   rim to the border box with the border itself transparent — the same trick <HudHtml>'s
		   .nav-btn uses, so every round button in the game is lit from the same corner. */
		border: 1px solid transparent;
		border-radius: 9999px;
		background:
			linear-gradient(0deg, #1a0535 0%, #000 100%) padding-box,
			linear-gradient(135deg, #d836fc 0%, #272fdd 100%) border-box;
		/* Drop shadow to lift it off the art, plus the same resting rim glow every other round button
		   in the game now carries (design ask, 2026-08-26) — see .nav-btn in <HudHtml>. */
		box-shadow:
			0 4px 14px rgba(0, 0, 0, 0.55),
			0 0 calc(var(--close-u) * 5) calc(var(--close-u) * 0.5) rgba(197, 106, 255, 0.5),
			0 0 calc(var(--close-u) * 14) calc(var(--close-u) * 2) rgba(124, 48, 221, 0.32);
		display: grid;
		place-items: center;
		cursor: pointer;
		transition:
			transform 0.12s ease,
			filter 0.12s ease,
			box-shadow 0.12s ease;
	}

	@media (pointer: coarse) {
		.popup-close {
			--close-u: max(var(--close-fit), 0.8214px);
		}
	}

	@media (hover: hover) {
		.popup-close:hover {
			filter: brightness(1.2);
			box-shadow:
				0 4px 14px rgba(0, 0, 0, 0.55),
				0 0 calc(var(--close-u) * 9) calc(var(--close-u) * 1.5) rgba(160, 96, 246, 0.85);
		}
	}

	.popup-close:active {
		transform: translateY(1px) scale(0.96);
	}

	/* The glyph's box is 26.134 because the 18.483 vector is rotated 45 degrees inside it. */
	.popup-close img {
		display: block;
		pointer-events: none;
		width: calc(var(--close-u) * 26.134);
		height: calc(var(--close-u) * 26.134);
	}
</style>
