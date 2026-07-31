<script lang="ts">
	import { onMount } from 'svelte';

	import { POPUP_BORDERS } from '../lib/popupBorder';
	import { rampCss, roundedRectPoint } from '../lib/roundedRectPath';

	type Props = { variant: 'confirm' | 'wide' };
	const { variant }: Props = $props();

	/** Seconds for a light to run from the top of the panel to the bottom. A drift, not a chase. */
	const RUN_SECONDS = 8;
	// A mirrored pair: both leave the middle of the top edge together, one down each side. They meet
	// at the middle of the bottom edge, that run ends, and the next pair sets off from the top again
	// — they never turn round and come back. t is measured clockwise from the top middle, so the run
	// is simply 0 to half a lap in each direction.
	const LIGHTS = [{ direction: 1 }, { direction: -1 }];
	// Fractions of a run spent fading in and out. The fade-in is short on purpose: it is what decides
	// where the pair APPEARS, and a long one has them showing up well down the top edge instead of
	// splitting from its middle. The fade-out can be slower — they are merging into one light at the
	// bottom by then, and a hard cut there reads as a glitch.
	const RUN_FADE_IN = 0.015;
	const RUN_FADE_OUT = 0.07;
	/** Trail length as a fraction of the perimeter, and how many glows draw it. */
	const TRAIL = 0.02;
	const TRAIL_STEPS = 8;
	/** Halo and white core radius, as fractions of the panel's width. */
	const HALO = 0.017;
	const CORE = 0.0022;

	const border = $derived(POPUP_BORDERS[variant]);

	let canvas: HTMLCanvasElement;

	onMount(() => {
		const context = canvas.getContext('2d');
		if (!context) return;

		// The panel is sized in cqw off a clamp, so its pixel size changes with the viewport. The
		// backing store is resized to match rather than the canvas being stretched, or the glows go
		// soft and oval on wide screens.
		let width = 0;
		let height = 0;
		const observer = new ResizeObserver(([entry]) => {
			const box = entry.contentRect;
			const ratio = Math.min(window.devicePixelRatio || 1, 2);
			width = box.width;
			height = box.height;
			canvas.width = Math.max(1, Math.round(width * ratio));
			canvas.height = Math.max(1, Math.round(height * ratio));
			context.setTransform(ratio, 0, 0, ratio, 0, 0);
		});
		observer.observe(canvas);

		let handle = 0;
		const started = performance.now();
		const glow = (x: number, y: number, radius: number, colour: string, edge: string) => {
			const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
			gradient.addColorStop(0, colour);
			gradient.addColorStop(1, edge);
			context.fillStyle = gradient;
			context.beginPath();
			context.arc(x, y, radius, 0, Math.PI * 2);
			context.fill();
		};

		const tick = (now: number) => {
			handle = requestAnimationFrame(tick);
			if (!width || !height) return;

			const run = ((now - started) / 1000 / RUN_SECONDS) % 1;
			// Full brightness for the middle of the run, easing in at the top and out at the bottom.
			const life = Math.min(1, run / RUN_FADE_IN, (1 - run) / RUN_FADE_OUT);
			context.clearRect(0, 0, width, height);
			// Additive, so a light passing over the painted line brightens it rather than covering it.
			context.globalCompositeOperation = 'lighter';

			for (const light of LIGHTS) {
				// Half a lap per run: 0 at the top middle, 0.5 (the bottom middle) at the end.
				const head = run * 0.5 * light.direction;
				// Tail first, so the head's own glow lands on top of it.
				for (let i = TRAIL_STEPS; i >= 1; i -= 1) {
					const t = head - (i / TRAIL_STEPS) * TRAIL * light.direction;
					const point = roundedRectPoint(border, t, width, height);
					// Square falloff: a streak that dies quickly, not a comma.
					const fade = (1 - i / TRAIL_STEPS) ** 2;
					glow(
						point.x,
						point.y,
						HALO * width * (0.18 + fade * 0.45),
						rampCss(border.ramp, t, fade * 0.75 * life),
						rampCss(border.ramp, t, 0),
					);
				}
				// Wide halo, then a tight one at nearly full strength, then a small white centre. Most of
				// the light is the border's own colour — a big white core washes the hue out, and the
				// colour is the point: blue stays blue on the blue run, red on the red.
				const point = roundedRectPoint(border, head, width, height);
				glow(
					point.x,
					point.y,
					HALO * width,
					rampCss(border.ramp, head, 0.5 * life),
					rampCss(border.ramp, head, 0),
				);
				glow(
					point.x,
					point.y,
					HALO * width * 0.42,
					rampCss(border.ramp, head, 0.95 * life),
					rampCss(border.ramp, head, 0),
				);
				glow(
					point.x,
					point.y,
					CORE * width * 2,
					`rgba(255, 255, 255, ${0.8 * life})`,
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

<canvas bind:this={canvas} class="tp-popup__lights" aria-hidden="true"></canvas>

<style>
	/* Same box as the panel art, which carries its glow out to the edge of that box — so the lights
	   line up with the painted edge without any extra inset. */
	.tp-popup__lights {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
</style>
