<script lang="ts">
	// A live sea drawn over a backdrop's painted one (user, 2026-10-29: "water is still very
	// still.. clear the image and animate the sea"). On a canvas, in the backdrop's frame px:
	// clipped to the water (from `top`, under whatever stands on the horizon, down to `shore`),
	// a gradient of the painting's own water colours, the painting above the horizon mirrored
	// into it and rippling row by row, and soft swells rolling in toward the shore in perspective.
	// 30fps; one still frame under reduced motion.
	import { onMount } from 'svelte';

	let {
		src,
		w,
		y0,
		y1,
		horizon,
		top,
		shore,
		stops,
		scale = 1,
	}: {
		/** The backdrop painting (mirrored for the reflection), drawn at w × its aspect; none: no
		 *  reflection, water and swells only. */
		src?: string;
		w: number;
		/** The canvas spans y0..y1 of the frame. */
		y0: number;
		y1: number;
		/** The line the reflection mirrors about. */
		horizon: number;
		/** Water's top / the shore, sampled every w / (n − 1) px. */
		top: number[];
		shore: number[];
		/** Water colours: [y, css colour]. */
		stops: [number, string][];
		/** Screen px per frame px (the cover scale), for the canvas's resolution. */
		scale?: number;
	} = $props();

	let canvas = $state<HTMLCanvasElement>();
	const H = $derived(y1 - y0);

	// Smooth profile through the samples (Catmull-Rom-ish via midpoints).
	function edge(ctx: CanvasRenderingContext2D, pts: number[], reverse: boolean) {
		const step = w / (pts.length - 1);
		const p = pts.map((y, i) => [i * step, y - y0] as const);
		if (reverse) p.reverse();
		ctx.lineTo(p[0][0], p[0][1]);
		for (let i = 1; i < p.length - 1; i++) ctx.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2);
		ctx.lineTo(p.at(-1)![0], p.at(-1)![1]);
	}
	const lerpAt = (pts: number[], x: number) => {
		const f = (x / w) * (pts.length - 1);
		const i = Math.max(0, Math.min(pts.length - 2, Math.floor(f)));
		return pts[i] + (pts[i + 1] - pts[i]) * (f - i);
	};

	// Swells: dashes on a band that rolls from the horizon to the shore and widens as it comes.
	const BANDS = 9;
	const DASHES = Array.from({ length: BANDS }, (_, b) =>
		Array.from({ length: 9 }, (_, i) => {
			const h = Math.imul(b * 31 + i + 1, 2654435761) >>> 0;
			return { x: (h % 1000) / 1000, len: 0.04 + ((h >>> 10) % 100) / 1000, k: ((h >>> 20) % 100) / 100 };
		}),
	);

	onMount(() => {
		const c = canvas!;
		const ctx = c.getContext('2d')!;
		const img = src ? new Image() : null;
		if (img && src) img.src = src;
		const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		let raf = 0;
		let last = -1e9;
		let res = 1;
		const resize = () => {
			res = Math.min(2, Math.max(1, scale * devicePixelRatio));
			c.width = Math.round(w * res);
			c.height = Math.round(H * res);
		};
		resize();
		const draw = (now: number) => {
			if (img && (!img.complete || !img.naturalWidth)) return false;
			const t = now / 1000;
			ctx.setTransform(res, 0, 0, res, 0, 0);
			ctx.clearRect(0, 0, w, H);
			ctx.save();
			ctx.beginPath();
			ctx.moveTo(0, top[0] - y0);
			edge(ctx, top, false);
			edge(ctx, shore, true);
			ctx.closePath();
			ctx.clip();
			// Water.
			const g = ctx.createLinearGradient(0, 0, 0, H);
			for (const [y, col] of stops) g.addColorStop(Math.max(0, Math.min(1, (y - y0) / H)), col);
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, w, H);
			// Reflection: the painting above the horizon, mirrored and squashed a little, each
			// row pushed sideways by two travelling sines that grow toward the viewer.
			const rows = img ? Math.ceil(H * res) : 0;
			const iw = img?.naturalWidth ?? 0;
			const k = iw / w; // image px per frame px
			for (let j = 0; j < rows; j++) {
				const y = j / res;
				const fy = y0 + y;
				const d = fy - horizon;
				if (d < 0) continue;
				const depth = Math.min(1, d / 95);
				const sy = horizon - d * 0.92 - 1;
				if (sy < 0) continue;
				const amp = reduced ? 0 : 0.6 + 3 * depth;
				const off = amp * (Math.sin(d * 0.26 - t * 1.7) + 0.45 * Math.sin(d * 0.09 + t * 1.1));
				// Strong just under the horizon, gone by the middle of the sea.
				ctx.globalAlpha = 0.36 * (1 - depth) ** 1.6;
				if (ctx.globalAlpha < 0.01) continue;
				ctx.drawImage(img!, 0, sy * k, iw, k, off, y, w, 1 / res + 0.5);
			}
			ctx.globalAlpha = 1;
			// Swells rolling in: light dashes, thin and slow far off, long and soft up close.
			for (let b = 0; b < BANDS; b++) {
				const p = reduced ? (b + 0.5) / BANDS : (t / 9 + b / BANDS) % 1;
				const fade = Math.sin(p * Math.PI);
				for (const dsh of DASHES[b]) {
					const x = (((dsh.x + t * (0.004 + 0.006 * dsh.k)) % 1) + 1) % 1;
					const px = x * w;
					const shoreY = lerpAt(shore, px);
					const topY = lerpAt(top, px);
					const y = topY + (shoreY - topY) * p ** 1.5;
					const len = w * dsh.len * (0.5 + p);
					const th = 0.8 + 3.2 * p;
					ctx.globalAlpha = 0.26 * fade * (0.6 + 0.4 * dsh.k);
					ctx.fillStyle = '#ffffff';
					ctx.beginPath();
					ctx.ellipse(px, y - y0, len / 2, th / 2, 0, 0, Math.PI * 2);
					ctx.fill();
				}
			}
			ctx.globalAlpha = 1;
			ctx.restore();
			return true;
		};
		const loop = (now: number) => {
			raf = requestAnimationFrame(loop);
			if (now - last < 33) return;
			last = now;
			if (draw(now) && reduced) cancelAnimationFrame(raf);
		};
		raf = requestAnimationFrame(loop);
		addEventListener('resize', resize);
		return () => {
			cancelAnimationFrame(raf);
			removeEventListener('resize', resize);
		};
	});
</script>

<canvas bind:this={canvas} class="live-sea" style={`top:${y0}px;width:${w}px;height:${H}px`} aria-hidden="true"></canvas>

<style>
	.live-sea {
		position: absolute;
		left: 0;
		pointer-events: none;
		/* The painting around it is soft: a touch of blur so the drawn sea isn't a sticker. */
		filter: blur(0.6px);
	}
</style>
