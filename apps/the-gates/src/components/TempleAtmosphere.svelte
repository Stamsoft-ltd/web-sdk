<script lang="ts">
	import { runtime } from '../game/playback.svelte';
	import { loadRig, SpinePose, spineClock } from '../game/spine';
	let { skin }: { skin: string } = $props();
	let canvas = $state<HTMLCanvasElement>();
	let ready = $state(false);
	$effect(() => {
		const surface = canvas,
			mode = skin;
		ready = false;
		if (!surface || runtime.reduced) return;
		const ctx = surface.getContext('2d');
		if (!ctx) return;
		let disposed = false,
			stop = () => {},
			observer: ResizeObserver | undefined;
		const color = mode === 'super' ? 'green' : mode === 'hidden' ? 'red' : 'gold';
		const image = new Image();
		image.src = `./assets/the-gates/spine/scene-${mode}.png`;
		Promise.all([
			image.decode(),
			loadRig(`fire-${color}`, 'flames'),
			loadRig(`ambient-${mode}`, 'energy'),
		])
			.then(([, fire, ambient]) => {
				if (disposed) return;
				const flames = Array.from({ length: 4 }, (_, i) => new SpinePose(fire, 'burn', i * 0.57));
				const energy = new SpinePose(ambient, 'pulse');
				const placements = [
					[42, 558, 0.73],
					[1510, 558, 0.73],
					[1165, 516, 0.13],
					[1313, 516, 0.13],
				];
				const draw = (dt: number) => {
					ctx.setTransform(surface.width / 1536, 0, 0, surface.height / 1024, 0, 0);
					ctx.drawImage(image, 0, 0, 1536, 1024);
					energy.update(dt);
					energy.draw(ctx, 768, 512, 1);
					flames.forEach((flame, i) => {
						const [x, y, s] = placements[i];
						flame.update(dt);
						flame.draw(ctx, x, y - 75 * s, s);
					});
					ready = true;
				};
				const resize = () => {
					const dpr = Math.min(1.25, devicePixelRatio || 1);
					surface.width = Math.max(1, Math.min(1920, Math.round(surface.clientWidth * dpr)));
					surface.height = Math.max(1, Math.min(1280, Math.round(surface.clientHeight * dpr)));
					draw(0);
				};
				observer = new ResizeObserver(resize);
				observer.observe(surface);
				resize();
				stop = spineClock(draw);
			})
			.catch((error) => console.warn('Spine atmosphere fallback:', error));
		return () => {
			disposed = true;
			stop();
			observer?.disconnect();
		};
	});
</script>

{#if !runtime.reduced}<canvas
		bind:this={canvas}
		class="temple-flames"
		class:ready
		data-fire-source="spine-layers"
		data-ambient={skin}
		aria-hidden="true"
	></canvas>{/if}

<style>
	.temple-flames {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		opacity: 0;
	}
	.temple-flames.ready {
		opacity: 1;
	}
	@media (max-width: 800px) and (min-height: 501px) {
		.temple-flames {
			mask-image: linear-gradient(#000 86%, transparent);
		}
	}
</style>
