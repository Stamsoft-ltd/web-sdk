<script lang="ts">
	import * as PIXI from 'pixi.js';
	import { onMount, onDestroy, type Snippet } from 'svelte';
	import { devicePixelRatio } from 'svelte/reactivity/window';

	import { getContextApp } from '../context.svelte';
	import { preloadFont } from '../utils.svelte';

	type Props = { children: Snippet };

	const props: Props = $props();
	const context = getContextApp();

	let wrap: HTMLDivElement;
	let initialised = $state(false);

	const initialiseApplication = async () => {
		PIXI.Assets.reset();

		await preloadFont();
		// Cap the render resolution at 2× the CSS pixel grid. Many phones report a devicePixelRatio of 3,
		// which makes the GPU shade ~9× the pixels of a 1× canvas (vs 4× at 2×) — the single biggest cause
		// of mobile heat/lag here. 2× is still visually retina-sharp for this art.
		const renderResolution = Math.min(devicePixelRatio.current || 1, 2);
		// Antialiasing (MSAA) off on TOUCH / MOBILE devices only — it is a real GPU cost on phones and
		// near-invisible once we supersample at the capped 2× resolution. Desktops/laptops (fine pointer)
		// keep AA on, exactly as before. AA does NOT affect frame rate, so this cannot cause any stutter.
		const isTouchDevice =
			typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;
		context.stateApp.pixiApplication = new PIXI.Application<PIXI.Renderer<HTMLCanvasElement>>();
		await context.stateApp.pixiApplication.init({
			autoDensity: true,
			backgroundAlpha: 0,
			hello: true,
			multiView: false,
			antialias: !isTouchDevice,
			clearBeforeRender: true,
			preference: 'webgpu',
			powerPreference: 'high-performance',
			resolution: renderResolution,
			resizeTo: wrap,
		});

		// NOTE: intentionally NOT capping ticker.maxFPS. Pixi throttles by skipping ticker frames, and when
		// the cap sits at/near the display refresh, rAF jitter makes it skip unevenly — the reactive scene
		// (Svelte tweens) then gets sampled at irregular intervals and the spin visibly judders. The DPR cap
		// + AA-off already cut per-frame cost a lot, so we let the loop run at the native refresh (smooth).
		context.stateApp.pixiApplication.stage.sortableChildren = true;

		wrap.appendChild(context.stateApp.pixiApplication.canvas);
		context.stateApp.pixiApplication.canvas.style.display = 'block';
		context.stateApp.pixiApplication.canvas.style.width = '100%';
		context.stateApp.pixiApplication.canvas.style.height = '100%';

		// to prevent that you can't scroll the page with touch on the canvas. https://github.com/pixijs/pixijs/issues/4824
		context.stateApp.pixiApplication.renderer.events.autoPreventDefault = false;
		context.stateApp.pixiApplication.renderer.canvas.style.touchAction = 'auto';
	};

	onMount(async () => {
		try {
			if (!initialised) await initialiseApplication();
			initialised = true;
		} catch (error) {
			console.error(error);
		}
	});

	onDestroy(() => {
		if (context.stateApp.pixiApplication) {
			context.stateApp.pixiApplication.destroy();
		}
	});
</script>

<div bind:this={wrap} style="width: 100%; height: 100%; overflow: hidden;">
	{#if initialised}
		{@render props.children()}
	{/if}
</div>
