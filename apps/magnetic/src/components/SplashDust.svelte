<script lang="ts">
	// The splash room's airborne debris — the same burnt-lab atmosphere the game board sits in
	// (<AmbientDebris>), so pressing through the splash does not walk into a different room.
	//
	// This is a 2D canvas rather than a pixi layer because the splash is plain DOM: it mounts
	// before the game and outlives the pixi App's first frame. The motion maths is deliberately
	// identical to AmbientDebris — ONE shared gust function carrying every flake, so the whole
	// field surges together and reads as wind rather than as floating sparkles.
	//
	// Placement is the caller's job: this fills its positioned parent, so dropping it directly
	// after the room background puts the dust BEHIND the pillar, logo, panels and floor parts.
	// It must never drift across the info panels — that is the whole reason it is not on top.
	const props: { count?: number } = $props();

	let canvasEl = $state<HTMLCanvasElement | null>(null);

	const FLAKES = Array.from({ length: 64 }, (_, i) => {
		const h = (k: number) => (((i + 1) * k) % 997) / 997;
		const ember = i % 11 === 4;
		const verts = Array.from({ length: 5 }, (_, v) => {
			const a = (v / 5) * Math.PI * 2 + h(9973 * (v + 2)) * 0.7;
			const r = 0.55 + 0.45 * h(7919 * (v + 3));
			return { cos: Math.cos(a) * r, sin: Math.sin(a) * r };
		});
		return {
			ember,
			verts,
			startX: (i * 0.61803) % 1,
			y: h(15485863) * 1.06 - 0.03,
			drag: 0.55 + 0.9 * h(40503),
			sink: (h(104729) - 0.55) * 0.16,
			bob: 0.006 + 0.018 * h(9973),
			bobFreq: 0.5 + 1.1 * h(7919),
			size: (ember ? 0.0022 : 0.0035) + 0.0042 * h(104729),
			spin: (h(40503) - 0.5) * 2.4,
			phase: h(15485863) * 6.283,
			dim: 0.35 + 0.65 * h(7919),
		};
	});

	const gust = (t: number) =>
		0.055 * t + 0.052 * Math.sin(t * 0.21) + 0.026 * Math.sin(t * 0.53 + 1.1);
	const edgeFade = (u: number) => Math.min(1, u / 0.12, (1 - u) / 0.12);

	$effect(() => {
		const el = canvasEl;
		if (!el) return;
		const ctx = el.getContext('2d');
		if (!ctx) return;

		let W = 0;
		let H = 0;
		const resize = () => {
			const dpr = Math.min(2, window.devicePixelRatio || 1);
			const r = el.getBoundingClientRect();
			W = r.width;
			H = r.height;
			el.width = Math.max(1, Math.round(W * dpr));
			el.height = Math.max(1, Math.round(H * dpr));
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		};
		resize();
		const ro = new ResizeObserver(resize);
		ro.observe(el);

		const count = props.count ?? 34;
		let raf = 0;
		const t0 = performance.now();
		const tick = (now: number) => {
			raf = requestAnimationFrame(tick);
			if (W < 1 || H < 1) return;
			const t = (now - t0) / 1000;
			const wind = gust(t);
			ctx.clearRect(0, 0, W, H);
			for (let i = 0; i < count; i++) {
				const f = FLAKES[i];
				const u = (((f.startX + wind * f.drag) % 1) + 1) % 1;
				const a = f.dim * edgeFade(u) * (f.ember ? 0.22 : 0.45);
				if (a <= 0.004) continue;
				const x = W * (-0.05 + 1.1 * u);
				const y = H * (f.y + f.sink * u + f.bob * Math.sin(t * f.bobFreq + f.phase));
				const r = W * f.size;
				const rot = f.phase + t * f.spin;
				const flip = 0.25 + 0.75 * Math.abs(Math.cos(rot * 1.6 + f.phase));
				const cr = Math.cos(rot);
				const sr = Math.sin(rot);
				ctx.beginPath();
				for (let v = 0; v < f.verts.length; v++) {
					const vx = f.verts[v].cos * r * flip;
					const vy = f.verts[v].sin * r;
					const px = x + vx * cr - vy * sr;
					const py = y + vx * sr + vy * cr;
					if (v === 0) ctx.moveTo(px, py);
					else ctx.lineTo(px, py);
				}
				ctx.closePath();
				if (f.ember) {
					const glow = 0.6 + 0.4 * Math.sin(t * 3.1 + f.phase) ** 2;
					ctx.globalCompositeOperation = 'lighter';
					ctx.fillStyle = `rgba(255,156,74,${a * glow})`;
					ctx.fill();
					ctx.beginPath();
					ctx.arc(x, y, r * 1.6, 0, Math.PI * 2);
					ctx.fillStyle = `rgba(255,122,34,${a * 0.16 * glow})`;
					ctx.fill();
					ctx.globalCompositeOperation = 'source-over';
				} else {
					ctx.fillStyle = `rgba(207,216,230,${a})`;
					ctx.fill();
				}
			}
		};
		raf = requestAnimationFrame(tick);
		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
		};
	});
</script>

<canvas class="splash-dust" bind:this={canvasEl}></canvas>

<style>
	.splash-dust {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.splash-dust {
			display: none;
		}
	}
</style>
