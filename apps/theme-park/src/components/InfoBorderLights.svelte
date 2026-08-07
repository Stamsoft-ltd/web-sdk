<script lang="ts">
	import { onMount } from 'svelte';

	import { POPUP_BORDERS } from '../lib/popupBorder';
	import { rampCss, roundedRectPoint } from '../lib/roundedRectPath';

	// Marching border lights for a plain CSS rounded-rect box (a card or the modal frame), rather
	// than the painted panel art PopupBorderLights traces. Same look as the confirm dialog — a
	// mirrored pair leaving the top middle, one down each side, meeting at the bottom middle.
	type Props = {
		/** Corner radius of the ring, in CSS px. */
		radius?: number;
		/** How far in from the host's BORDER-box edge the light rides (sits it on the neon line). */
		inset?: number;
		/** Per-side overrides — the S-pad frame draws its line at a different inset on each edge. */
		insetTop?: number;
		insetRight?: number;
		insetBottom?: number;
		insetLeft?: number;
		/** Extra px the canvas extends beyond the box on every side, so the glow can bleed out. */
		pad?: number;
		/** Halo radius of a light in CSS px (absolute, so it stays the same size on any box). */
		glow?: number;
		/** Seconds for a light to drift from top middle to bottom middle. */
		runSeconds?: number;
		/** Colour ramp round the ring; defaults to the confirm dialog's pink→blue neon. */
		ramp?: readonly number[];
	};
	const {
		radius = 18,
		inset = 12,
		insetTop,
		insetRight,
		insetBottom,
		insetLeft,
		pad = 14,
		glow = 7,
		runSeconds = 9,
		ramp = POPUP_BORDERS.confirm.ramp,
	}: Props = $props();

	const RUN_FADE_IN = 0.02;
	const RUN_FADE_OUT = 0.08;
	const TRAIL = 0.022;
	// A longer, denser trail reads as a smooth streak of light rather than a hard travelling ball.
	const TRAIL_STEPS = 9;
	const LIGHTS = [{ direction: 1 }, { direction: -1 }];

	let canvas: HTMLCanvasElement;

	onMount(() => {
		const context = canvas.getContext('2d');
		const host = canvas.parentElement;
		if (!context || !host) return;

		// The canvas is sized/placed in JS against the host's BORDER box (offsetWidth/Height) rather
		// than via `width:100%`+`inset` — those resolve against the padding box, so a border-image
		// border (13–15px here) would shove the ring that far inward, off the neon line.
		let width = 0;
		let height = 0;
		const place = () => {
			const style = getComputedStyle(host);
			const borderLeft = parseFloat(style.borderLeftWidth) || 0;
			const borderTop = parseFloat(style.borderTopWidth) || 0;
			width = host.offsetWidth + pad * 2;
			height = host.offsetHeight + pad * 2;
			// Left/top are measured from the padding box, so add the border to reach the border box.
			canvas.style.left = `${-(borderLeft + pad)}px`;
			canvas.style.top = `${-(borderTop + pad)}px`;
			canvas.style.width = `${width}px`;
			canvas.style.height = `${height}px`;
			const ratio = Math.min(window.devicePixelRatio || 1, 3);
			canvas.width = Math.max(1, Math.round(width * ratio));
			canvas.height = Math.max(1, Math.round(height * ratio));
			context.setTransform(ratio, 0, 0, ratio, 0, 0);
		};
		const observer = new ResizeObserver(place);
		observer.observe(host);
		place();

		let handle = 0;
		const started = performance.now();
		const dot = (x: number, y: number, r: number, colour: string, edge: string) => {
			const gradient = context.createRadialGradient(x, y, 0, x, y, r);
			gradient.addColorStop(0, colour);
			gradient.addColorStop(1, edge);
			context.fillStyle = gradient;
			context.beginPath();
			context.arc(x, y, r, 0, Math.PI * 2);
			context.fill();
		};

		const tick = (now: number) => {
			handle = requestAnimationFrame(tick);
			if (!width || !height) return;

			// The border box sits `pad` px inside the canvas; ride the ring each side's own inset in.
			const geometry = {
				left: (pad + (insetLeft ?? inset)) / width,
				top: (pad + (insetTop ?? inset)) / height,
				right: 1 - (pad + (insetRight ?? inset)) / width,
				bottom: 1 - (pad + (insetBottom ?? inset)) / height,
				rx: radius / width,
				ry: radius / height,
			};

			const run = ((now - started) / 1000 / runSeconds) % 1;
			const life = Math.min(1, run / RUN_FADE_IN, (1 - run) / RUN_FADE_OUT);
			context.clearRect(0, 0, width, height);
			context.globalCompositeOperation = 'lighter';

			for (const light of LIGHTS) {
				const head = run * 0.5 * light.direction;
				for (let i = TRAIL_STEPS; i >= 1; i -= 1) {
					const t = head - (i / TRAIL_STEPS) * TRAIL * light.direction;
					const point = roundedRectPoint(geometry, t, width, height);
					const fade = (1 - i / TRAIL_STEPS) ** 2;
					dot(
						point.x,
						point.y,
						glow * (0.18 + fade * 0.45),
						rampCss(ramp, t, fade * 0.75 * life),
						rampCss(ramp, t, 0),
					);
				}
				const point = roundedRectPoint(geometry, head, width, height);
				dot(point.x, point.y, glow, rampCss(ramp, head, 0.5 * life), rampCss(ramp, head, 0));
				dot(
					point.x,
					point.y,
					glow * 0.42,
					rampCss(ramp, head, 0.95 * life),
					rampCss(ramp, head, 0),
				);
				dot(
					point.x,
					point.y,
					glow * 0.32,
					`rgba(255, 255, 255, ${0.85 * life})`,
					'rgba(255, 255, 255, 0)',
				);
			}
		};
		handle = requestAnimationFrame(tick);

		return () => {
			cancelAnimationFrame(handle);
			observer.disconnect();
		};
	});
</script>

<canvas bind:this={canvas} class="info-lights" aria-hidden="true"></canvas>

<style>
	.info-lights {
		position: absolute;
		pointer-events: none;
		z-index: 3;
	}
</style>
