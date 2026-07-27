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
		// Detect touch / mobile once — drives the phone-only heat optimizations below.
		const isTouchDevice =
			typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;
		// Cap render resolution. Phones report devicePixelRatio up to 3 (→ ~9× the pixels of a 1× canvas),
		// so shading fewer pixels every frame is the BROADEST GPU-heat reduction — it helps every phone
		// regardless of refresh rate (unlike the fps cap, which only helps 120Hz panels). Phones get a
		// tighter 1.8× cap (still crisp on a dense screen); desktops/laptops keep the retina-sharp 2× cap.
		const renderResolution = Math.min(devicePixelRatio.current || 1, isTouchDevice ? 1.8 : 2);
		// Antialiasing (MSAA) off on TOUCH / MOBILE devices only — a real GPU cost on phones, near-invisible
		// once we supersample. Desktops/laptops (fine pointer) keep AA on. AA does not affect frame rate.
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

		context.stateApp.pixiApplication.stage.sortableChildren = true;

		wrap.appendChild(context.stateApp.pixiApplication.canvas);
		context.stateApp.pixiApplication.canvas.style.display = 'block';
		context.stateApp.pixiApplication.canvas.style.width = '100%';
		context.stateApp.pixiApplication.canvas.style.height = '100%';

		// to prevent that you can't scroll the page with touch on the canvas. https://github.com/pixijs/pixijs/issues/4824
		context.stateApp.pixiApplication.renderer.events.autoPreventDefault = false;
		context.stateApp.pixiApplication.renderer.canvas.style.touchAction = 'auto';

		// Sustained-heat guard for high-refresh phones: rendering the full scene every frame at 120Hz is
		// ~2× the GPU work (and heat) of 60fps, with no visible benefit for slot content. On TOUCH devices
		// whose panel is genuinely ≥~105Hz, cap the loop to 60fps — a stable 120Hz panel divides 2:1 to an
		// even, smooth 60. Desktops (fine pointer) and 60/90Hz screens stay at native refresh, so this can
		// NOT reintroduce the beat-judder seen on 60Hz displays. Refresh is measured from rAF (median of a
		// short burst) so we only engage on genuine high-refresh hardware.
		if (isTouchDevice) {
			const app = context.stateApp.pixiApplication;
			const gaps: number[] = [];
			let prev = performance.now();
			const sample = () => {
				const now = performance.now();
				gaps.push(now - prev);
				prev = now;
				if (gaps.length < 32) {
					requestAnimationFrame(sample);
					return;
				}
				const sorted = gaps.slice(2).sort((a, b) => a - b);
				const medianGap = sorted[sorted.length >> 1] ?? 16.7;
				if (medianGap < 9.5) app.ticker.maxFPS = 60;
			};
			requestAnimationFrame(sample);
		}
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
