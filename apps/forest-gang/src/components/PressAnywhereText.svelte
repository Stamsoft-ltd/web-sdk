<script lang="ts">
	import { Text } from 'pixi-svelte';

	import { i18nDerived } from '../i18n/i18nDerived';

	// Figma 3104:5895 — Cinzel Black 18px; letter-spacing 0.54px. Positioned by the parent
	// (e.g. in board units just under the congratulations board).
	//
	// SOLID fill on purpose: the Figma gold gradient rendered mostly-dark here — pixi v8 pads the
	// text texture for the stroke/drop-shadow, and a `local`-space FillGradient maps over that
	// PADDED canvas, so the glyphs sample the dark bottom stops (text showed as near-black with a
	// light top edge). A bright cream + heavy dark stroke reads on dark wood AND the golden glow.
	type Props = {
		y: number;
		fontSize: number;
	};

	const props: Props = $props();
</script>

<Text
	anchor={{ x: 0.5, y: 0.5 }}
	y={props.y}
	text={i18nDerived.translate('PRESS ANYWHERE')}
	style={{
		fontFamily: 'Cinzel',
		fontWeight: '900',
		fontSize: props.fontSize,
		align: 'center',
		letterSpacing: props.fontSize * (0.54 / 18),
		// Same gold as the CONGRATULATIONS heading (the earlier near-white cream read as "wrong
		// color" against the rest of the popup's gold text).
		fill: 0xf1c14a,
		// Stroke/shadow much stronger than the Figma spec (0.7px / 25%) — the text sits on bright
		// golden backdrops (free-spin intro/outro glow), where thin outlines wash out completely.
		stroke: { color: 0x3a1503, width: props.fontSize * (2.2 / 18) },
		dropShadow: {
			color: 0x000000,
			alpha: 0.6,
			angle: Math.PI / 2,
			distance: props.fontSize * (3 / 18),
			blur: props.fontSize * (4 / 18),
		},
	}}
/>
