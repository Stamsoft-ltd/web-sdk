<script lang="ts">
	import * as PIXI from 'pixi.js';
	import { onMount, onDestroy, type Snippet } from 'svelte';
	import { devicePixelRatio } from 'svelte/reactivity/window';

	import { getContextApp } from '../context.svelte';
	import { preloadFont } from '../utils.svelte';

	// pixi.js 8.8.x exports PrepareSystem but never runs its extension registration (lib/prepare/
	// init.mjs does `extensions.add(PrepareSystem)` yet nothing imports it), so `renderer.prepare`
	// is undefined on every renderer and AssetsLoader's prewarm aborts silently — every texture
	// then uploads to the GPU on its first DRAW instead of at load time, a mid-spin stall exactly
	// when a new animation appears. Register it before any Application.init(). A duplicate add is
	// harmless: system extensions land in a name-keyed record, so re-adding overwrites in place.
	PIXI.extensions.add(PIXI.PrepareSystem);

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
		//  - textureGCActive: pixi's texture GC unloads any GPU texture idle for ~60s, so a
		//    prewarmed sheet re-uploads (and stalls) on its next use. Games that prewarm their
		//    whole art set at load should pass false to keep it resident.
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
			resolution: Math.min(devicePixelRatio.current, props.maxResolution ?? Infinity),
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
