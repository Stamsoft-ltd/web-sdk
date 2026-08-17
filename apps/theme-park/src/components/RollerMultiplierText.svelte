<script lang="ts">
	import { FillGradient, Text } from 'pixi-svelte';

	type Props = {
		text: string;
	};

	const props: Props = $props();

	// Shrink wider values ("100X", "1024X") so the text always sits inside the ~156px-wide cell
	// instead of spilling over the grid line into neighbouring cells.
	const size = $derived(props.text.length <= 3 ? 35.05 : props.text.length === 4 ? 29 : 24);

	// Exact final Mega Wild yellow/gold ramp. Contributions and total now read as one feature.
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
	anchor={{ x: 0.5, y: 0.5 }}
	text={props.text}
	style={{
		fontFamily: 'Helvetica',
		fontWeight: '700',
		fontSize: size,
		lineHeight: size,
		letterSpacing: size * 0.03,
		align: 'center',
		fill,
		stroke: { color: 0x4b1700, width: 2.4 },
		dropShadow: {
			color: 0x130018,
			alpha: 0.9,
			angle: Math.PI / 2,
			distance: 2.4,
			blur: 1,
		},
	}}
/>
