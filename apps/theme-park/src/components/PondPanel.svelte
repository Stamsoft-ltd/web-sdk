<script lang="ts">
	import { FillGradient, Graphics } from 'pixi-svelte';

	import { POPUP_BORDERS } from '../lib/popupBorder';
	import PanelBorderLights from './PanelBorderLights.svelte';

	// The Duck Your Luck chrome plate, drawn to the pick-panel design (Figma 6471:6346 family):
	// a dark indigo rounded rect with a thin blue-to-pink neon stroke and the confirm dialogs'
	// running border lights. Procedural rather than art because the pond needs it at three very
	// different aspects (pick, total, and the 5:1 counter strip) and stretching the panel exports
	// smeared their painted edges.

	type Props = { width: number; height: number };
	const props: Props = $props();

	/** Corner radius fraction of the short side — the design's plate is visibly rounder than the
	 * congrats card. */
	const RADIUS_FRACTION = 0.13;
	const STROKE = 2.5;

	const radius = $derived(Math.min(props.width, props.height) * RADIUS_FRACTION);

	// Left-to-right blue → purple → pink, like the painted edge on the popup arts.
	const strokeFill = new FillGradient({
		type: 'linear',
		start: { x: 0, y: 0.5 },
		end: { x: 1, y: 0.5 },
		colorStops: [
			{ offset: 0, color: 0x3f74ff },
			{ offset: 0.5, color: 0x9a3cff },
			{ offset: 1, color: 0xff4fd0 },
		],
		textureSpace: 'local',
	});
	const plateFill = new FillGradient({
		type: 'linear',
		start: { x: 0.5, y: 0 },
		end: { x: 0.5, y: 1 },
		colorStops: [
			{ offset: 0, color: 0x261149 },
			{ offset: 1, color: 0x170833 },
		],
		textureSpace: 'local',
	});

	// Where the lights run: on the stroke, with the same corner rounding as the plate.
	const lightsBorder = $derived({
		left: 0.004,
		top: 0.006,
		right: 0.996,
		bottom: 0.994,
		rx: radius / props.width,
		ry: radius / props.height,
		ramp: POPUP_BORDERS.square.ramp,
	});
</script>

<Graphics
	draw={(graphics) => {
		graphics
			.roundRect(-props.width / 2, -props.height / 2, props.width, props.height, radius)
			.fill({ fill: plateFill, alpha: 0.97 })
			.stroke({ fill: strokeFill, width: STROKE });
	}}
/>
<PanelBorderLights width={props.width} height={props.height} border={lightsBorder} />
