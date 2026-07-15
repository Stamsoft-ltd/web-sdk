<script lang="ts">
	import { Text } from 'pixi-svelte';
	// @ts-expect-error - 'pixi.js' is resolved at build time via the vite alias (transitive dep).
	import { FillGradient } from 'pixi.js';

	import { i18nDerived } from '../i18n/i18nDerived';

	// Figma 3104:5895 — Cinzel Black 18px; letter-spacing 0.54px, 0.7px #4A1904 stroke,
	// 2.78px black shadow. All metrics scale with the font size. Positioned by the parent
	// (e.g. in board units just under the congratulations board).
	type Props = {
		y: number;
		fontSize: number;
	};

	const props: Props = $props();

	// linear-gradient(184deg, #F7AB22 15.26%, #D7880C 69.74%, #A16202 92.88%) — 184deg ≈ vertical.
	const pressFill = new FillGradient({
		type: 'linear',
		start: { x: 0.5, y: 0 },
		end: { x: 0.5, y: 1 },
		colorStops: [
			{ offset: 0.1526, color: 0xf7ab22 },
			{ offset: 0.6974, color: 0xd7880c },
			{ offset: 0.9288, color: 0xa16202 },
		],
		textureSpace: 'local',
	});
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
		fill: pressFill,
		// Stroke/shadow slightly stronger than the Figma spec (0.7px / 25%) — the text can sit
		// on bright backdrops (win screens), where the original values were unreadable.
		stroke: { color: 0x4a1904, width: props.fontSize * (1.1 / 18) },
		dropShadow: {
			color: 0x000000,
			alpha: 0.45,
			angle: Math.PI / 2,
			distance: props.fontSize * (3 / 18),
			blur: props.fontSize * (3 / 18),
		},
	}}
/>
