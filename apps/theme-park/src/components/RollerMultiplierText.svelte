<script lang="ts">
	import { FillGradient, Text } from 'pixi-svelte';

	type Props = {
		text: string;
	};

	const props: Props = $props();

	// Shrink wider values ("100X", "1024X") so the text always sits inside the ~156px-wide cell
	// instead of spilling over the grid line into neighbouring cells.
	const size = $derived(
		props.text.length <= 3 ? 35.05 : props.text.length === 4 ? 29 : 24,
	);

	// Themed to the game's main pink/purple neon (was gold, which read off against the board).
	const fill = new FillGradient({
		type: 'linear',
		start: { x: 0.54, y: 0 },
		end: { x: 0.46, y: 1 },
		colorStops: [
			{ offset: 0.18, color: 0xf49bff },
			{ offset: 0.5, color: 0xe23cff },
			{ offset: 0.85, color: 0x9a2bf0 },
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
		stroke: { color: 0x2b0838, width: 0.2 },
		dropShadow: {
			color: 0x1a0530,
			alpha: 1,
			angle: Math.atan2(0.94, 0.67),
			distance: Math.hypot(0.67, 0.94),
			blur: 0.94,
		},
	}}
/>
