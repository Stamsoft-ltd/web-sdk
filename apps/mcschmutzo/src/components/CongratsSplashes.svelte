<script lang="ts">
	import { splashShapes, SPLASH_RED, SPLASH_YELLOW, type SplashSpec } from '../game/winSplash';
	import { drawSplatCanvas } from '../game/splatCanvas';

	// The congrats plaques' mustard + ketchup, drawn in code with the big-win card's splash geometry
	// (game/winSplash.ts): nothing shows until the CONGRATS title slams onto the plaque (`hitMs`), then
	// the sauce is squeezed out from behind it — a top pair bursting past the upper corners and a
	// smaller under pair (colours swapped) from the sides. Sits BEHIND the plaque in the stage, which
	// is the parent box it measures; units are fractions of the stage width W.
	type Props = { hitMs: number };
	const props: Props = $props();

	type Placed = { spec: SplashSpec; side: 1 | -1; x: number; y: number; k: number; delay: number; seed: number };
	// Drawn in the logo's sauce style (game/logoSplash SPLAT: the reel symbols' look — thick dark
	// outline, flat body, pale gloss), not the big-win card's softer 3D one. Outline scaled to each
	// spec's core so it reads as thick as the logo's.
	const RED: SplashSpec = {
		...SPLASH_RED,
		palette: { edge: 0x5a0d07, body: 0xe2271a, shade: 0xa8150b, light: 0xffb3a3 },
		edgeW: 0.0085,
		item: true,
	};
	const YELLOW: SplashSpec = {
		...SPLASH_YELLOW,
		palette: { edge: 0x6b3d05, body: 0xf4aa1e, shade: 0xc27c0a, light: 0xffe7a8 },
		edgeW: 0.008,
		item: true,
	};
	// y is from the plaque TOP (stage top = 0), so it suits both plaque heights.
	const SPLASHES: Placed[] = [
		// under pair first (drawn beneath the top pair)
		{ spec: RED, side: -1, x: -0.43, y: 0.34, k: 0.7, delay: 110, seed: 2.1 },
		{ spec: YELLOW, side: 1, x: 0.43, y: 0.3, k: 0.7, delay: 150, seed: 3.4 },
		{ spec: YELLOW, side: -1, x: -0.38, y: 0.1, k: 1, delay: 0, seed: 0 },
		{ spec: RED, side: 1, x: 0.38, y: 0.08, k: 1, delay: 40, seed: 1.2 },
	];
	// winSplash specs carry the big-win card's origin; here each is drawn around its own spot.
	const atOrigin = SPLASHES.map((s) => ({ ...s, spec: { ...s.spec, ox: 0, oy: 0 } }));

	let canvas: HTMLCanvasElement | undefined = $state();
	let W = $state(0);
	let H = $state(0);
	// The canvas overhangs the stage by W/2 on every side (tongues + flung drops reach past it).
	// Narrow screens (the stage is nearly screen-wide): tuck the splashes in and draw them smaller so
	// the reach stays on screen, like the portrait win pad.
	let compact = $state(false);
	const box = $derived(`left:${-W / 2}px; top:${-W / 2}px; width:${W * 2}px; height:${H + W}px`);

	$effect(() => {
		const parent = canvas?.parentElement;
		if (!parent) return;
		const ro = new ResizeObserver(() => {
			W = parent.clientWidth;
			H = parent.clientHeight;
			compact = W > window.innerWidth * 0.75;
		});
		ro.observe(parent);
		return () => ro.disconnect();
	});

	$effect(() => {
		if (!canvas || W <= 0) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		canvas.width = Math.round(W * 2 * dpr);
		canvas.height = Math.round((H + W) * dpr);
		const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		const t0 = performance.now();
		let raf = 0;
		const frame = (now: number) => {
			// reduced motion: the settled splash, no wobble
			const ms = reduced ? 1200 : now - t0 - props.hitMs;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, W * 2, H + W);
			for (const s of atOrigin) {
				const list = splashShapes(s.spec, s.side, ms - s.delay, s.seed);
				const [xk, kk] = compact ? [0.9, 0.8] : [1, 1];
				drawSplatCanvas(ctx, list, W + s.x * xk * W, W / 2 + s.y * W, W * s.k * kk);
			}
			if (!reduced) raf = requestAnimationFrame(frame);
		};
		raf = requestAnimationFrame(frame);
		return () => cancelAnimationFrame(raf);
	});
</script>

<canvas class="congrats-splashes" bind:this={canvas} style={box} aria-hidden="true"></canvas>

<style>
	.congrats-splashes {
		position: absolute;
		z-index: 0;
		pointer-events: none;
	}
</style>
