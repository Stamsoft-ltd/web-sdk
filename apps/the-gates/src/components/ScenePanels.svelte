<script lang="ts">
	import { useGpu } from '../game/gpuContext';
	import type { createGpuPanels, PanelState } from '../game/gpuPanels';
	let {
		stage,
		board,
		panelState,
	}: { stage?: HTMLElement; board?: HTMLElement; panelState: PanelState } = $props();
	const gpu = useGpu();
	let renderer = $state.raw<ReturnType<typeof createGpuPanels>>();
	$effect(() => {
		const engine = gpu.engine,
			stageHost = stage,
			boardHost = board;
		if (!engine || !stageHost || !boardHost) return;
		let dead = false,
			owned: ReturnType<typeof createGpuPanels> | undefined;
		void import('../game/gpuPanels')
			.then(({ createGpuPanels }) => {
				if (dead) return;
				owned = createGpuPanels(engine, stageHost, boardHost, (error) => {
					gpu.error = String(error);
				});
				renderer = owned;
			})
			.catch((error) => {
				if (!dead) gpu.error = String(error);
			});
		const observer = new ResizeObserver(() => owned?.resize());
		observer.observe(stageHost);
		observer.observe(boardHost);
		return () => {
			dead = true;
			observer.disconnect();
			owned?.destroy();
			renderer = undefined;
		};
	});
	$effect(() => renderer?.update(panelState));
</script>

<!-- No side-panel visual fallback. Public semantic copy remains available to assistive tech. -->
<div class="scene-announcement" role="status" aria-live="polite" data-renderer="pixi-webgl">
	{panelState.translate('TUMBLES')}
	{panelState.progress}/3. {panelState.translate('MULTIPLIER')}
	{panelState.multiplier}×.
	{#if panelState.bonus}{panelState.translate('FREE SPINS')}
		{panelState.freeSpin}/{panelState.totalFs}.{/if}
	{panelState.caption}
	{panelState.inline}
</div>

<style>
	.scene-announcement {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
