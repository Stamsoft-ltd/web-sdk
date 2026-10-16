<script lang="ts">
	import { useGpu } from '../game/gpuContext';
	import type { createLoadingScene } from '../game/gpuScene';
	let { progress = 0 }: { progress?: number } = $props();
	const gpu = useGpu();
	let host = $state<HTMLElement>();
	let adapter = $state.raw<ReturnType<typeof createLoadingScene>>();
	$effect(() => {
		const engine = gpu.engine,
			target = host;
		if (!engine || !target) return;
		let dead = false,
			owned: ReturnType<typeof createLoadingScene> | undefined;
		void import('../game/gpuScene')
			.then(({ createLoadingScene }) => {
				if (dead) return;
				owned = createLoadingScene(engine, target);
				adapter = owned;
			})
			.catch((error) => {
				if (!dead) gpu.error = String(error);
			});
		return () => {
			dead = true;
			owned?.destroy();
			adapter = undefined;
		};
	});
	$effect(() => {
		adapter?.update(progress);
	});
</script>

<div
	class="loading-scene-host"
	bind:this={host}
	role="progressbar"
	aria-label="Loading The Gates"
	aria-valuemin="0"
	aria-valuemax="100"
	aria-valuenow={Math.round(progress * 100)}
	data-renderer="pixi-webgl"
></div>

<style>
	.loading-scene-host {
		position: fixed;
		inset: 0;
		z-index: 80;
		display: grid;
		place-items: center;
		overflow: hidden;
	}
</style>
