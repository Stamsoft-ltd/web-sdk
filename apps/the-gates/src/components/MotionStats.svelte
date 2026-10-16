<script lang="ts">
	import { onMount } from 'svelte';
	import { spineMetrics } from '../game/spine';
	import { resetMotionMetrics } from '../game/motionMetrics';
	import { useGpu } from '../game/gpuContext';
	const gpu = useGpu();
	let metrics = $state(spineMetrics());
	let renderer = $state({ frames: 0, jobs: 0, active: false, textures: 0 });
	onMount(() => {
		resetMotionMetrics();
		const timer = setInterval(() => {
			metrics = spineMetrics();
			renderer = gpu.engine?.statistics() ?? renderer;
		}, 500);
		return () => clearInterval(timer);
	});
</script>

<output data-motion-stats={JSON.stringify(metrics)}
	>Pixi {renderer.active ? 'active' : 'idle'} · {renderer.frames} frames · {renderer.jobs} layers · JS
	p95 {metrics.workP95.toFixed(1)}ms</output
>

<style>
	output {
		position: fixed;
		bottom: 2px;
		right: 4px;
		z-index: 50;
		font: 11px monospace;
		color: white;
		background: #102136e8;
		pointer-events: none;
		padding: 2px 4px;
	}
</style>
