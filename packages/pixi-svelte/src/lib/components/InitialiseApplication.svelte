<script lang="ts">
	import * as PIXI from 'pixi.js';
	import { onMount, onDestroy, type Snippet } from 'svelte';
	import { devicePixelRatio } from 'svelte/reactivity/window';

	import { getContextApp } from '../context.svelte';
	import { preloadFont } from '../utils.svelte';

	type Props = {
		children: Snippet;
		// Loads the shared Typekit kit before the app initialises. Defaults ON for backwards
		// compatibility, but games that self-host their fonts should pass false: the kit is an
		// EXTERNAL runtime request (blocked on hosts like Stake Engine), and awaiting it here
		// stalls app startup until the web-font loader times out.
		preloadWebFont?: boolean;
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
			antialias: true,
			clearBeforeRender: true,
			preference: 'webgpu',
			powerPreference: 'high-performance',
			resolution: devicePixelRatio.current,
			resizeTo: wrap,
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
