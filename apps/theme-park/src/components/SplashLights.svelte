<script lang="ts">
	import { onMount } from 'svelte';

	// The splash screen's marquee bulbs, lit.
	//
	// The three feature frames (and the portrait carousel's card) are painted into the splash art
	// with their bulbs already drawn, so there is nothing to switch on: this draws an additive glow
	// on each painted bulb, from centres found offline (scripts/win-cards/build_splash_bulbs.py).
	// Same idea as <WinCardLights> on the win card, in a DOM canvas instead of pixi — the splash is
	// an HTML overlay — and the same additive-canvas technique <PopupBorderLights> uses, so a light
	// passing over the painted bulb brightens it rather than covering it.

	type Props = {
		/**
		 * Bulb centres as fractions of the ART, one array per frame. Grouped because the chase runs
		 * around each frame separately: pooled, the angle a bulb is lit by would be measured from
		 * the middle of the whole picture and the three frames would strobe as one block.
		 */
		groups: readonly (readonly (readonly [number, number])[])[];
		/** Glow diameter, as a fraction of the canvas width. */
		radius?: number;
		/** Light fronts running around each frame at once, and laps per second. */
		cycles?: number;
		speed?: number;
		/** Lit floor — the bulbs are painted lit, so they never go fully dark. */
		floor?: number;
		/**
		 * Seconds after mount at which each group's bulbs come up, one entry per group. The splash
		 * stages its entrance left to right, and a sign's lights coming on as its copy lands is what
		 * ties the two together — igniting all three at once reads as the page merely appearing.
		 */
		ignite?: number[];
		/** Seconds a group takes to come up. */
		igniteDuration?: number;
		/**
		 * 'chase' runs light fronts around each group — right for a marquee frame, whose bulbs sit
		 * on a closed loop. 'twinkle' gives every lamp its own phase instead, which is what the
		 * park's strings need: they are not loops, and a chase over a coaster rail read as a wave
		 * sweeping the sky rather than as lamps.
		 */
		mode?: 'chase' | 'twinkle';
	};

	const {
		groups,
		radius = 0.012,
		cycles = 2,
		speed = 0.3,
		floor = 0.08,
		ignite,
		igniteDuration = 0.45,
		mode = 'chase',
	}: Props = $props();

	/**
	 * Each bulb is stamped twice: a soft halo and a tight core. The halo is what makes a lit bulb
	 * spill onto the gold around it instead of reading as a dot pasted on the art — but it has to
	 * stay ON THE RAIL. At 2.7x it reached well past the frame into the dark sky above and the flat
	 * panel inside, and those spills read as blobs floating in the dark, not as bulbs. The rail is
	 * only a little wider than a bulb, so the halo can only be a little wider too.
	 */
	const HALO_SCALE = 1.35;
	const HALO_ALPHA = 0.3;

	const TAU = Math.PI * 2;

	let canvas: HTMLCanvasElement;

	onMount(() => {
		const context = canvas.getContext('2d');
		if (!context) return;

		// One glow, rendered once into an offscreen canvas and then stamped per bulb. Building a
		// radial gradient per bulb per frame is what makes this kind of overlay expensive, and there
		// are well over a hundred bulbs on the landscape splash.
		const SPRITE = 64;
		const sprite = document.createElement('canvas');
		sprite.width = SPRITE;
		sprite.height = SPRITE;
		const spriteContext = sprite.getContext('2d');
		if (!spriteContext) return;
		const gradient = spriteContext.createRadialGradient(
			SPRITE / 2,
			SPRITE / 2,
			0,
			SPRITE / 2,
			SPRITE / 2,
			SPRITE / 2,
		);
		// White-hot centre falling off through the bulbs' own amber. A glow that is white all the way
		// out reads as a grey dot over the art instead of as a lit bulb.
		gradient.addColorStop(0, 'rgba(255, 252, 240, 1)');
		gradient.addColorStop(0.22, 'rgba(255, 226, 150, 0.85)');
		gradient.addColorStop(0.55, 'rgba(255, 176, 60, 0.28)');
		gradient.addColorStop(1, 'rgba(255, 150, 40, 0)');
		spriteContext.fillStyle = gradient;
		spriteContext.fillRect(0, 0, SPRITE, SPRITE);

		// Phase per bulb: its angle about its OWN frame's centre, so the light runs round the frame.
		const bulbs = groups.flatMap((group, groupIndex) => {
			const cx = group.reduce((sum, [x]) => sum + x, 0) / Math.max(1, group.length);
			const cy = group.reduce((sum, [, y]) => sum + y, 0) / Math.max(1, group.length);
			return group.map(([x, y], index) => {
				// Deterministic 0-1 per lamp, from its own coordinates so it survives a re-render.
				const noise = ((Math.sin(x * 1273.7 + y * 811.3 + index) * 43758.5453) % 1 + 1) % 1;
				return {
					x,
					y,
					at: ignite?.[groupIndex] ?? 0,
					// Chase: the angle about the group's centre, so a front runs round the frame,
					// with a small jitter so it reads as separate bulbs and not a rotating gradient.
					phase:
						mode === 'twinkle'
							? noise
							: ((Math.atan2(y - cy, x - cx) / TAU + 1) % 1) * cycles + (noise - 0.5) * 0.08,
				};
			});
		});

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
		const tick = (now: number) => {
			handle = requestAnimationFrame(tick);
			if (!width || !height) return;

			const seconds = (now - started) / 1000;
			const run = seconds * speed * cycles;
			const size = radius * width;
			context.clearRect(0, 0, width, height);
			context.globalCompositeOperation = 'lighter';

			const halo = size * HALO_SCALE;
			for (const bulb of bulbs) {
				const up = Math.min(1, Math.max(0, (seconds - bulb.at) / igniteDuration));
				if (up <= 0) continue;
				const wave = 0.5 + 0.5 * Math.cos(TAU * (bulb.phase - run));
				const level = (floor + (1 - floor) * wave ** 3) * up;
				const x = bulb.x * width;
				const y = bulb.y * height;
				context.globalAlpha = level * HALO_ALPHA;
				context.drawImage(sprite, x - halo / 2, y - halo / 2, halo, halo);
				context.globalAlpha = level;
				context.drawImage(sprite, x - size / 2, y - size / 2, size, size);
			}
			context.globalAlpha = 1;
		};
		handle = requestAnimationFrame(tick);

		return () => {
			cancelAnimationFrame(handle);
			observer.disconnect();
		};
	});
</script>

<canvas bind:this={canvas}></canvas>

<style>
	canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
</style>
