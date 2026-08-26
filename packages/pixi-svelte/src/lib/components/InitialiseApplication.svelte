<script lang="ts" module>
	let registeredPrepare = false;
</script>

<script lang="ts">
	import * as PIXI from 'pixi.js';
	import { onMount, onDestroy, type Snippet } from 'svelte';
	import { devicePixelRatio } from 'svelte/reactivity/window';

	import { getContextApp } from '../context.svelte';
	import { preloadFont } from '../utils.svelte';

	// PIXI 8.8.1 NEVER REGISTERS PrepareSystem, so `renderer.prepare` is undefined and every
	// prewarm in <AssetsLoader> silently no-ops — see the guard there. pixi's own entry point
	// imports `prepare/index.mjs`, which only re-exports the classes; the `extensions.add` call
	// lives in `prepare/init.mjs`, which nothing imports. The symptom is textures uploading to the
	// GPU the first time they are DRAWN, which for art that appears mid-round (the anticipation
	// sign, a bonus screen) is a stall in the middle of a spin.
	//
	// Registered once per module rather than per <App>: `extensions.add` does not de-duplicate.
	if (!registeredPrepare) {
		registeredPrepare = true;
		PIXI.extensions.add(PIXI.PrepareSystem);
	}

	type Props = {
		children: Snippet;
		// Loads the shared Typekit kit before the app initialises. Defaults ON for backwards
		// compatibility, but games that self-host their fonts should pass false: the kit is an
		// EXTERNAL runtime request (blocked on hosts like Stake Engine), and awaiting it here
		// stalls app startup until the web-font loader times out.
		preloadWebFont?: boolean;
		// Renderer tuning — all optional and defaulting to the historical values, so existing games
		// are unaffected. Games target Safari/low-end devices by opting in:
		//  - maxResolution: cap the render-target DPR (Safari retina is 2–3×; uncapped renders up to
		//    9× the pixels → the dominant fragment-shader cost). e.g. 2.
		//  - antialias: MSAA is expensive on Safari; sprite-based games can disable it safely.
		//  - rendererPreference: 'webgl' avoids Pixi's less-mature WebGPU path (buggy on Safari 18).
		maxResolution?: number;
		antialias?: boolean;
		rendererPreference?: 'webgpu' | 'webgl';
		//  - textureGCActive: pixi unloads any texture that has not been DRAWN for
		//    `textureGCMaxIdle` frames — 3600, i.e. a minute at 60fps — and re-uploads it the next
		//    time it is drawn. For art that only appears occasionally (an anticipation sign, a
		//    bonus card) that guarantees the re-upload lands mid-round, undoing the prewarm above.
		//    Pass false on a game whose whole atlas set is meant to stay resident.
		textureGCActive?: boolean;
	};

	const props: Props = $props();
	const context = getContextApp();

	let wrap: HTMLDivElement;
	let initialised = $state(false);

	const initialiseApplication = async () => {
		PIXI.Assets.reset();

		if (props.preloadWebFont ?? true) await preloadFont();
		// Work on a LOCAL reference and publish to state only when fully initialised: the parent
		// App component's onMount calls stateApp.reset() AFTER this child onMount starts (Svelte
		// mounts children first), so a state-held reference can be nulled mid-`init()` await.
		const app = new PIXI.Application<PIXI.Renderer<HTMLCanvasElement>>();
		await app.init({
			autoDensity: true,
			backgroundAlpha: 0,
			hello: true,
			multiView: false,
			antialias: props.antialias ?? true,
			clearBeforeRender: true,
			preference: props.rendererPreference ?? 'webgpu',
			powerPreference: 'high-performance',
			resolution: Math.min(devicePixelRatio.current || 1, props.maxResolution ?? Infinity),
			resizeTo: wrap,
			textureGCActive: props.textureGCActive ?? true,
		});

		app.stage.sortableChildren = true;

		wrap.appendChild(app.canvas);
		app.canvas.style.display = 'block';
		app.canvas.style.width = '100%';
		app.canvas.style.height = '100%';

		// to prevent that you can't scroll the page with touch on the canvas. https://github.com/pixijs/pixijs/issues/4824
		app.renderer.events.autoPreventDefault = false;
		app.renderer.canvas.style.touchAction = 'auto';

		context.stateApp.pixiApplication = app;
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
