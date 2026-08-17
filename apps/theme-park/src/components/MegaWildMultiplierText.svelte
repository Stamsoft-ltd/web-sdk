<script lang="ts">
	import { FillGradient, Text } from 'pixi-svelte';

	type Props = { text: string };
	const props: Props = $props();
	const size = $derived(props.text.length <= 3 ? 92 : props.text.length === 4 ? 74 : 62);
	const fill = new FillGradient({
		type: 'linear',
		start: { x: 0.5, y: 0 },
		end: { x: 0.5, y: 1 },
		colorStops: [
			{ offset: 0, color: 0xfff8a8 },
			{ offset: 0.42, color: 0xffd329 },
			{ offset: 1, color: 0xf28b00 },
		],
		textureSpace: 'local',
	});
</script>

<Text
	anchor={0.5}
	text={props.text}
	style={{
		fontFamily: 'Lilita One',
		fontSize: size,
		fontWeight: '400',
		fill,
		stroke: { color: 0x4b1700, width: 7 },
		dropShadow: { color: 0x130018, alpha: 0.9, angle: Math.PI / 2, distance: 7, blur: 2 },
	}}
/>
