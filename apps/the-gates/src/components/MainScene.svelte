<script lang="ts">
	import { useGpu } from '../game/gpuContext';
	import type { createMainScene } from '../game/gpuScene';
	let {
		src,
		host,
		logoHost,
		studioHost,
	}: { src: string; host?: HTMLElement; logoHost?: HTMLElement; studioHost?: HTMLElement } =
		$props();
	const gpu = useGpu();
	let adapter = $state.raw<ReturnType<typeof createMainScene>>();
	$effect(() => {
		const engine = gpu.engine,
			target = host,
			brand = logoHost,
			studio = studioHost;
		if (!engine || !target || !brand || !studio) return;
		let dead = false,
			owned: ReturnType<typeof createMainScene> | undefined;
		void import('../game/gpuScene')
			.then(({ createMainScene }) => {
				if (dead) return;
				owned = createMainScene(engine, target, brand, studio, (error) => {
					if (!dead) gpu.error = String(error);
				});
				adapter = owned;
			})
			.catch((error) => {
				if (!dead) gpu.error = String(error);
			});
		const observer = new ResizeObserver(() => owned?.resize());
		observer.observe(target);
		observer.observe(brand);
		observer.observe(studio);
		return () => {
			dead = true;
			observer.disconnect();
			owned?.destroy();
			adapter = undefined;
		};
	});
	$effect(() => {
		adapter?.update(src);
	});
</script>
