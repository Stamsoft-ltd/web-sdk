<script lang="ts">
	import { untrack } from 'svelte';
	import { loadRig, SpinePose, spineClock } from '../game/spine';
	import { SymbolAsh, ashProgress, type AshTiming } from '../game/symbolAsh';
	let {
		rig,
		atlas = 'symbols',
		animation = 'idle',
		intro,
		speed = 1,
		reduced = false,
		seed = 0,
		onready,
		ash,
	}: {
		rig: string;
		atlas?: string;
		animation?: string;
		intro?: string;
		speed?: number;
		reduced?: boolean;
		seed?: number;
		onready?: (ready: boolean) => void;
		ash?: AshTiming;
	} = $props();
	let canvas = $state<HTMLCanvasElement>();
	let pose = $state<SpinePose>();
	let ready = $state(false);
	const introduced = new WeakSet<SpinePose>();
	$effect(() => {
		const surface = canvas,
			name = rig,
			page = atlas;
		if (!surface) return;
		let disposed = false;
		ready = false;
		pose = undefined;
		loadRig(name, page)
			.then((data) => {
				if (!disposed) pose = new SpinePose(data, 'idle', seed * 0.173);
			})
			.catch((error) => console.warn('Spine art fallback:', name, error));
		return () => {
			disposed = true;
		};
	});
	$effect(() => {
		if (!pose) return;
		if (intro && !reduced && !introduced.has(pose)) {
			introduced.add(pose);
			pose.playIntro(intro, animation);
		} else pose.setAnimation(animation, animation === 'idle' ? seed * 0.173 : 0);
	});
	$effect(() => {
		const surface = canvas,
			actor = pose,
			still = reduced;
		if (!surface || !actor) return;
		const ctx = surface.getContext('2d');
		if (!ctx) return;
		let removal: SymbolAsh | undefined;
		let removalStart: number | undefined;
		const resize = () => {
			removal = undefined;
			const dpr = Math.min(2, window.devicePixelRatio || 1);
			surface.width = Math.max(1, Math.round(surface.clientWidth * dpr));
			surface.height = Math.max(1, Math.round(surface.clientHeight * dpr));
			draw(0);
		};
		const draw = (dt: number) => {
			const timing = untrack(() => ash);
			if (!timing || timing.startedAt !== removalStart) removal = undefined;
			removalStart = timing?.startedAt;
			if (timing && removal && !still) {
				removal.draw(ctx, ashProgress(performance.now(), timing));
				return;
			}
			actor.update(still ? 0 : dt * speed);
			ctx.clearRect(0, 0, surface.width, surface.height);
			ctx.imageSmoothingEnabled = true;
			ctx.imageSmoothingQuality = 'high';
			const scale = Math.min(surface.width / actor.data.width, surface.height / actor.data.height);
			actor.draw(ctx, surface.width / 2, surface.height / 2, scale);
			if (timing && !still) {
				removal = new SymbolAsh(surface, timing.seed);
				removal.draw(ctx, ashProgress(performance.now(), timing));
			}
			ready = true;
		};
		const observer = new ResizeObserver(resize);
		observer.observe(surface);
		resize();
		const stop = still ? () => {} : spineClock(draw);
		return () => {
			stop();
			observer.disconnect();
		};
	});
	$effect(() => {
		onready?.(ready);
	});
</script>

<canvas
	bind:this={canvas}
	class:ready
	data-spine-rig={rig}
	data-spine-animation={animation}
	data-symbol-ash={ash && !reduced ? 'active' : undefined}
	aria-hidden="true"
></canvas>

<style>
	canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		pointer-events: none;
	}
	canvas.ready {
		opacity: 1;
	}
</style>
