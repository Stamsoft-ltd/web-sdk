<script lang="ts">
	import { onMount } from 'svelte';
	import type { GpuContext } from '../game/gpuContext';
	let { context }: { context: GpuContext } = $props();
	let host: HTMLDivElement;
	onMount(() => {
		let disposed = false;
		let owned: import('../game/gpuRenderer').GpuEngine | undefined;
		void import('../game/gpuRenderer')
			.then(async ({ GpuEngine }) => {
				if (disposed) return;
				owned = new GpuEngine(host, (value) => {
					context.presenting = value;
				});
				await owned.init();
				if (!disposed) context.engine = owned;
			})
			.catch((error) => {
				if (!disposed) {
					context.error = String(error);
					console.error('Pixi renderer unavailable', error);
				}
			});
		return () => {
			disposed = true;
			context.engine = null;
			owned?.destroy();
		};
	});
</script>

<div
	class="gpu-surface"
	class:presenting={context.presenting}
	bind:this={host}
	aria-hidden="true"
></div>

<style>
	.gpu-surface {
		position: fixed;
		inset: 0;
		z-index: 4;
		pointer-events: none;
		overflow: hidden;
	}
</style>
