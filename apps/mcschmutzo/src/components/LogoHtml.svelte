<script lang="ts">
	import { ap } from '../lib/preloadArt';
	import { LOGO_ASPECT, LOGO_REST_MS, LOGO_WORD, logoSplashShapes } from '../game/logoSplash';
	import { drawSplatCanvas } from '../game/splatCanvas';

	// The HTML McSchmutzo logo: the Figma wordmark over two ketchup splats drawn in code (game/
	// logoSplash). Fills its parent's width at the logo box's aspect. `hitAt` = ms after mount when
	// the logo hits something and squeezes the splats out (the splash's drop); without it the splats
	// are simply there, at rest (loader, portrait header).
	type Props = { hitAt?: number };
	const props: Props = $props();

	const word = ap('/assets/mcschmutzo/logo-word-v2.webp');
	const wordW = LOGO_WORD.w;
	const wordH = LOGO_WORD.w / LOGO_WORD.aspect;
	// The wordmark's box as % of the logo box (y units are box widths, the box is 1/LOGO_ASPECT tall).
	const wordStyle = `left:${(0.5 + LOGO_WORD.x - wordW / 2) * 100}%; width:${wordW * 100}%; top:${(0.5 + (LOGO_WORD.y - wordH / 2) * LOGO_ASPECT) * 100}%;`;

	let root: HTMLDivElement | undefined = $state();
	let canvas: HTMLCanvasElement | undefined = $state();
	let W = $state(0);
	// Drops are flung past the box; the canvas overhangs it by M on every side.
	const M = 0.12;
	const box = $derived(`left:${-M * W}px; top:${-M * W}px; width:${W * (1 + 2 * M)}px; height:${W / LOGO_ASPECT + 2 * M * W}px`);

	$effect(() => {
		if (!root) return;
		const el = root;
		const ro = new ResizeObserver(() => (W = el.clientWidth));
		ro.observe(el);
		return () => ro.disconnect();
	});

	const t0 = performance.now();
	$effect(() => {
		if (!canvas || W <= 0) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		const cw = W * (1 + 2 * M);
		const ch = W / LOGO_ASPECT + 2 * M * W;
		canvas.width = Math.round(cw * dpr);
		canvas.height = Math.round(ch * dpr);
		const animate = props.hitAt !== undefined && !matchMedia('(prefers-reduced-motion: reduce)').matches;
		let raf = 0;
		const paint = (ms: number) => {
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, cw, ch);
			drawSplatCanvas(ctx, logoSplashShapes(ms), cw / 2, ch / 2, W);
		};
		if (!animate) {
			paint(Infinity);
			return;
		}
		const frame = (now: number) => {
			const ms = now - t0 - (props.hitAt ?? 0);
			paint(ms);
			// The splats settle by LOGO_REST_MS and hold that frame (the board draws the same one).
			if (ms < LOGO_REST_MS + 100) raf = requestAnimationFrame(frame);
		};
		raf = requestAnimationFrame(frame);
		return () => cancelAnimationFrame(raf);
	});
</script>

<div class="mcs-logo" bind:this={root} style={`aspect-ratio:${LOGO_ASPECT}`}>
	<canvas class="mcs-logo__splats" bind:this={canvas} style={box} aria-hidden="true"></canvas>
	<img class="mcs-logo__word" src={word} alt="McSchmutzo" draggable="false" style={wordStyle} />
</div>

<style>
	.mcs-logo {
		position: relative;
		width: 100%;
	}
	.mcs-logo__splats {
		position: absolute;
		pointer-events: none;
	}
	.mcs-logo__word {
		position: absolute;
		height: auto;
		max-width: none;
	}
</style>
