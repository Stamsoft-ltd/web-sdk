<script lang="ts">
	// Via pixi-svelte's re-export rather than a direct 'pixi.js' import: the app has no pixi.js
	// dependency of its own, and adding one breaks svelte-check across the whole project.
	import { getContextParent, PIXI } from 'pixi-svelte';
	import { onDestroy } from 'svelte';
	import { GlowFilter } from 'pixi-filters';

	type Props = {
		waypoints: Array<{ x: number; y: number }>;
		progress: number;
		width: number;
	};

	const props: Props = $props();
	const parentContext = getContextParent();

	// A gold ribbon rather than a flat stroke: four passes over the same path, from the shadowed
	// underside out to a narrow specular highlight sitting just above the centre line. Layering
	// strokes keeps the shading correct whichever way a segment runs — a linear gradient fill is
	// anchored in world space, so it would read right on the horizontal runs and wrong on the steps
	// between rows.
	const LAYERS = [
		{ scale: 1, color: 0x4a2400, alpha: 0.9, offset: 0 },
		{ scale: 0.84, color: 0xff9c12, alpha: 1, offset: 0.04 },
		{ scale: 0.46, color: 0xffc94a, alpha: 1, offset: -0.1 },
		{ scale: 0.16, color: 0xfffdf0, alpha: 1, offset: -0.26 },
		{ scale: 0.1, color: 0x9c4f00, alpha: 0.5, offset: 0.36 },
	];

	const line = new PIXI.Graphics();
	const maskGraphics = new PIXI.Graphics();
	const container = new PIXI.Container();
	container.addChild(line);
	line.mask = maskGraphics;
	container.addChild(maskGraphics);
	container.filters = [
		new GlowFilter({
			distance: 14,
			outerStrength: 3.5,
			innerStrength: 0,
			color: 0xffb020,
			alpha: 0.9,
			quality: 0.3,
		}),
	];

	parentContext.addToParent(container);

	onDestroy(() => {
		container.parent?.removeChild(container);
		container.destroy({ children: true });
	});

	$effect(() => {
		// Recompute extents inside the effect so the mask stays correct when the waypoints change
		// (the paylines cycle).
		const minX = Math.min(...props.waypoints.map((p) => p.x));
		const maxX = Math.max(...props.waypoints.map((p) => p.x));
		const minY = Math.min(...props.waypoints.map((p) => p.y));
		const maxY = Math.max(...props.waypoints.map((p) => p.y));
		const pad = props.width * 3;

		line.clear();
		for (const layer of LAYERS) {
			line.setStrokeStyle({
				width: props.width * layer.scale,
				color: layer.color,
				alpha: layer.alpha,
				cap: 'round',
				join: 'round',
			});
			const dy = props.width * layer.offset;
			line.moveTo(props.waypoints[0].x, props.waypoints[0].y + dy);
			for (let i = 1; i < props.waypoints.length; i++) {
				line.lineTo(props.waypoints[i].x, props.waypoints[i].y + dy);
			}
			line.stroke();
		}

		maskGraphics.clear();
		maskGraphics
			.rect(
				minX - pad,
				minY - pad,
				(maxX - minX + pad * 2) * props.progress,
				maxY - minY + pad * 2,
			)
			.fill(0xffffff);
	});
</script>
