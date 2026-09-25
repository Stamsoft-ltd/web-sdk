<script lang="ts">
	import { onMount } from 'svelte';

	import { squirtHash } from '../game/ketchupSquirt';

	// Floating dust for HTML screens (the splash): warm motes drifting on a slow swirling current,
	// brighter + a soft halo where they pass through light pools, twinkling; every ~8s a draft sweeps
	// them sideways, then the air settles. Same motion model as the free-games kitchen air.
	type Light = { x: number; y: number; r: number }; // fractions of the host (r of its height)
	type Props = { count?: number; color?: string; glow?: string; lights?: Light[]; boost?: number };
	const { count = 60, color = '255,246,224', glow = '255,214,140', lights = [], boost = 1 }: Props = $props();

	let canvas: HTMLCanvasElement;
	onMount(() => {
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		let W = 1;
		let H = 1;
		const resize = () => {
			const dpr = Math.min(2, devicePixelRatio || 1);
			W = canvas.clientWidth;
			H = canvas.clientHeight;
			canvas.width = Math.round(W * dpr);
			canvas.height = Math.round(H * dpr);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		};
		const ro = new ResizeObserver(resize);
		ro.observe(canvas);
		resize();
		let raf = 0;
		const loop = (t: number) => {
			raf = requestAnimationFrame(loop);
			ctx.clearRect(0, 0, W, H);
			const DRAFT = 8000;
			const dk = Math.floor(t / DRAFT);
			const dp = (t % DRAFT) / 2400;
			const gust = dp < 1 ? Math.sin(Math.PI * dp) ** 2 : 0;
			const gustDir = dk % 2 ? -1 : 1;
			for (let i = 0; i < count; i++) {
				const h1 = squirtHash(i * 5.3);
				const h2 = squirtHash(i * 9.1);
				const sp = 0.00004 + 0.00005 * h2;
				const bx = ((h1 + t * sp * (0.6 + h1)) % 1) * W;
				const by = ((((h2 + t * sp * 0.35 * (h1 - 0.5)) % 1) + 1) % 1) * H;
				const swirlX = Math.sin(t / (1900 + 900 * h1) + i) * W * 0.018 + Math.sin(t / 700 + i * 2.3) * W * 0.004;
				const swirlY = Math.cos(t / (2300 + 800 * h2) + i * 1.7) * H * 0.025;
				let x = bx + swirlX + gust * gustDir * W * (0.05 + 0.07 * h2);
				x = ((x % W) + W) % W;
				const y = by + swirlY - gust * H * 0.02 * h1;
				let lit = 0.3;
				for (const L of lights) {
					const d = Math.hypot(x - L.x * W, y - L.y * H) / (L.r * H);
					if (d < 1) lit = Math.max(lit, 0.3 + 0.7 * (1 - d) ** 1.5);
				}
				const tw = 0.7 + 0.3 * Math.sin(t / (220 + 160 * h1) + i * 2.9);
				const a = Math.min(0.95, lit * tw * (1 + 0.5 * gust) * boost);
				const r = H * (0.0014 + 0.002 * h1) * (1 + 0.8 * lit) * (0.6 + 0.4 * boost);
				if (lit > 0.45) {
					ctx.beginPath();
					ctx.arc(x, y, r * 3.5, 0, Math.PI * 2);
					ctx.fillStyle = `rgba(${glow},${a * 0.14})`;
					ctx.fill();
				}
				ctx.beginPath();
				ctx.arc(x, y, r, 0, Math.PI * 2);
				ctx.fillStyle = `rgba(${color},${a})`;
				ctx.fill();
			}
		};
		raf = requestAnimationFrame(loop);
		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
		};
	});
</script>

<canvas class="dust-fx" bind:this={canvas} aria-hidden="true"></canvas>

<style>
	.dust-fx {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
</style>
