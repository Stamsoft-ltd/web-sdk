<script lang="ts">
	// The backdrops (base world + bonus worlds) drawn in WebGL (scene/SceneView.ts). The
	// .base-world wrapper and its sky gradient stay in the DOM, so App's splash → base fly-in
	// (it scales and feathers .base-world) works unchanged; the canvas covers the viewport
	// inside it. If WebGL can't start, `onfail` hands back to BaseScene + the bonus components.
	import { onMount } from 'svelte';
	import type { SceneView, Tier } from '../scene/SceneView';

	let { tier, onfail }: { tier: Tier; onfail?: () => void } = $props();
	let host: HTMLDivElement;
	let view: SceneView | null = null;

	// Past this, a load that never settles (a stalled request) would leave the backdrop empty.
	const INIT_TIMEOUT_MS = 20000;
	let dead = false;
	let failed = false;
	// Once, from wherever it breaks (import, init, timeout, a frame, a lost context, an update):
	// tear the view down and hand back to the DOM version.
	function fail(e: unknown) {
		if (failed || dead) return;
		failed = true;
		console.error('[PixiScene]', e);
		view?.destroy();
		view = null;
		onfail?.();
	}

	onMount(() => {
		const timer = setTimeout(() => fail(new Error('init timed out')), INIT_TIMEOUT_MS);
		import('../scene/SceneView')
			.then(async ({ SceneView }) => {
				if (dead || failed) return;
				view = new SceneView();
				view.onfail = fail;
				view.setTier(tier);
				await view.init(host);
			})
			.then(() => clearTimeout(timer), fail);
		return () => {
			dead = true;
			clearTimeout(timer);
			view?.destroy();
			view = null;
		};
	});
	$effect(() => {
		const t = tier;
		try {
			view?.setTier(t);
		} catch (e) {
			fail(e);
		}
	});
</script>

<div class="base-world" aria-hidden="true"><div class="scene-host" bind:this={host}></div></div>

<style>
	/* As BaseScene's: 20% past the screen on every side, feathered there during the fly-in. */
	.base-world {
		position: fixed;
		inset: -20vh -20vw;
		overflow: hidden;
		pointer-events: none;
		background: linear-gradient(#2ca4fe, #54c4fc 30%, #8ce4fc 58%, #a8f24e 64%, #5ad756 90%, #28bd72);
	}
	.base-world:global(.flying) {
		mask:
			linear-gradient(90deg, #0000, #000 13%, #000 87%, #0000),
			linear-gradient(#0000, #000 13%, #000 87%, #0000);
		mask-composite: intersect;
	}
	.scene-host {
		position: absolute;
		left: 20vw;
		top: 20vh;
		width: 100vw;
		height: 100vh;
	}
</style>
