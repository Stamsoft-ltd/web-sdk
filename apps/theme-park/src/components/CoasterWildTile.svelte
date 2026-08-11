<script lang="ts">
	import { Container, FillGradient, Sprite, Text } from 'pixi-svelte';

	import { SYMBOL_W, SYMBOL_H } from '../game/constants';
	import CoasterWildBackground from './CoasterWildBackground.svelte';

	type Props = {
		reel?: number;
		multiplier: number;
		contentScale?: number;
	};
	const props: Props = $props();

	// Sampled from the WILD lettering baked into wild-slime.png: pale bevel highlight -> vivid
	// yellow -> amber base. The brown keyline and deep-green shadow match its outer edge.
	const multiplierFill = new FillGradient({
		type: 'linear',
		start: { x: 0.5, y: 0 },
		end: { x: 0.5, y: 1 },
		colorStops: [
			{ offset: 0, color: 0xfff7a0 },
			{ offset: 0.12, color: 0xffe243 },
			{ offset: 0.3, color: 0xfff01d },
			{ offset: 0.5, color: 0xffe607 },
			{ offset: 0.68, color: 0xffcf06 },
			{ offset: 0.84, color: 0xfabc0a },
			{ offset: 1, color: 0xdf9700 },
		],
		textureSpace: 'local',
	});
</script>

<!-- Setup and persistent phases share this exact presentation. No handoff size pop. -->
<CoasterWildBackground reel={props.reel} />
<!-- Pop only the Wild and its multiplier. The opaque reel cover must remain cell-sized. -->
<Container scale={props.contentScale ?? 1}>
	<Sprite key="tpCoasterWild" anchor={0.5} width={SYMBOL_W * 0.82} height={SYMBOL_H * 0.82} />
	<Container y={SYMBOL_H * 0.18}>
		<Text
			anchor={{ x: 0.5, y: 0.5 }}
			text={`${props.multiplier}X`}
			style={{
				fontFamily: 'Cinzel',
				fontSize: SYMBOL_H * 0.22,
				fontWeight: '900',
				fill: multiplierFill,
				stroke: { color: 0x4d1d00, width: Math.max(3, SYMBOL_H * 0.035) },
				dropShadow: {
					color: 0x062900,
					alpha: 0.95,
					angle: Math.PI * 0.5,
					distance: Math.max(2, SYMBOL_H * 0.026),
					blur: Math.max(1, SYMBOL_H * 0.009),
				},
			}}
		/>
	</Container>
</Container>
