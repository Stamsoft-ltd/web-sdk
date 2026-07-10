<script lang="ts">
	import { Graphics } from 'pixi-svelte';

	// Animated "energized frame" overlay for the win boards: a breathing glow band along the whole
	// frame, pulsing light bars at the middle of each edge, pulsing corner gems, and two electric
	// runners crawling the perimeter. Drawing is IMPERATIVE — a persistent rAF redraws into the
	// captured Graphics instance every frame, so no Svelte reactivity sits in the render path
	// (the pattern that froze the board cell arcs).
	const {
		x = 0,
		y = 0,
		boardW,
		boardH,
		hx,
		hy,
		color,
	}: { x?: number; y?: number; boardW: number; boardH: number; hx: number; hy: number; color: number } =
		$props();

	type G = {
		clear: () => void;
		moveTo: (x: number, y: number) => void;
		lineTo: (x: number, y: number) => void;
		roundRect: (x: number, y: number, w: number, h: number, r: number) => unknown;
		circle: (x: number, y: number, r: number) => unknown;
		stroke: (s: object) => void;
		fill: (s: object) => void;
	};
	let g: G | null = null;

	const render = (now: number) => {
		if (!g) return;
		const t = now / 1000;
		const W2 = boardW * hx;
		const H2 = boardH * hy;
		g.clear();

		// Heartbeat + fast flicker shared by the whole frame.
		const beat = Math.max(
			0,
			Math.min(1, 0.55 + 0.35 * Math.sin(t * 4.1) * Math.sin(t * 1.7) + 0.12 * Math.sin(t * 29)),
		);

		// ── Breathing glow band along the whole frame ──
		const R = boardW * 0.04;
		g.roundRect(-W2, -H2, W2 * 2, H2 * 2, R);
		g.stroke({ width: boardW * 0.075, color, alpha: 0.05 + 0.08 * beat, cap: 'round', join: 'round' });
		g.roundRect(-W2, -H2, W2 * 2, H2 * 2, R);
		g.stroke({ width: boardW * 0.032, color, alpha: 0.1 + 0.16 * beat, cap: 'round', join: 'round' });

		// ── Pulsing light bars at the middle of each edge (the art's glow strips) ──
		const bars = [
			{ x1: -W2 * 0.5, y1: -H2, x2: W2 * 0.5, y2: -H2, ph: 0 },
			{ x1: -W2 * 0.5, y1: H2, x2: W2 * 0.5, y2: H2, ph: 1.4 },
			{ x1: -W2, y1: -H2 * 0.5, x2: -W2, y2: H2 * 0.5, ph: 2.6 },
			{ x1: W2, y1: -H2 * 0.5, x2: W2, y2: H2 * 0.5, ph: 3.9 },
		];
		for (const b of bars) {
			const pulse = 0.5 + 0.5 * Math.sin(t * 3.3 + b.ph);
			const a = 0.25 + 0.55 * pulse;
			g.moveTo(b.x1, b.y1);
			g.lineTo(b.x2, b.y2);
			g.stroke({ width: boardW * 0.05, color, alpha: a * 0.3, cap: 'round' });
			g.moveTo(b.x1, b.y1);
			g.lineTo(b.x2, b.y2);
			g.stroke({ width: boardW * 0.02, color, alpha: a * 0.55, cap: 'round' });
			g.moveTo(b.x1, b.y1);
			g.lineTo(b.x2, b.y2);
			g.stroke({ width: boardW * 0.007, color: 0xffffff, alpha: a * 0.5, cap: 'round' });
		}

		// ── Pulsing corner gems ──
		const CR = boardW * 0.055;
		const corners = [
			{ cx: -W2, cy: -H2, ph: 0.4 },
			{ cx: W2, cy: -H2, ph: 1.9 },
			{ cx: W2, cy: H2, ph: 3.1 },
			{ cx: -W2, cy: H2, ph: 4.6 },
		];
		for (const c of corners) {
			const pulse = 0.5 + 0.5 * Math.sin(t * 3.8 + c.ph);
			for (let i = 3; i >= 1; i--) {
				const k = i / 3;
				g.circle(c.cx, c.cy, CR * k);
				g.fill({ color, alpha: (0.1 + 0.28 * pulse) * (1 - k) + 0.05 });
			}
			g.circle(c.cx, c.cy, CR * 0.22);
			g.fill({ color: 0xffffff, alpha: 0.25 + 0.45 * pulse });
		}

		// ── Two electric runners crawling the perimeter (re-jittered every frame -> live arcs) ──
		const per = 4 * (W2 + H2);
		const pointAt = (p: number) => {
			let d = (((p % 1) + 1) % 1) * per;
			if (d < 2 * W2) return { x: -W2 + d, y: -H2 };
			d -= 2 * W2;
			if (d < 2 * H2) return { x: W2, y: -H2 + d };
			d -= 2 * H2;
			if (d < 2 * W2) return { x: W2 - d, y: H2 };
			d -= 2 * W2;
			return { x: -W2, y: H2 - d };
		};
		const jit = boardW * 0.012;
		const baseT = t * 0.22;
		for (const off of [0, 0.5]) {
			const N = 10;
			const SEG = 0.09;
			const pts: { x: number; y: number }[] = [];
			for (let i = 0; i <= N; i++) {
				const p = pointAt(baseT + off - (i / N) * SEG);
				pts.push({
					x: p.x + (Math.random() - 0.5) * 2 * jit,
					y: p.y + (Math.random() - 0.5) * 2 * jit,
				});
			}
			g.moveTo(pts[0].x, pts[0].y);
			for (let i = 1; i <= N; i++) g.lineTo(pts[i].x, pts[i].y);
			g.stroke({ width: boardW * 0.02, color, alpha: 0.45, cap: 'round', join: 'round' });
			g.moveTo(pts[0].x, pts[0].y);
			for (let i = 1; i <= N; i++) g.lineTo(pts[i].x, pts[i].y);
			g.stroke({ width: boardW * 0.007, color: 0xffffff, alpha: 0.95, cap: 'round', join: 'round' });
		}
	};

	$effect(() => {
		let raf = 0;
		const tick = (now: number) => {
			raf = requestAnimationFrame(tick);
			render(now);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
</script>

<Graphics {x} {y} blendMode="add" draw={(gr) => (g = gr as unknown as G)} />
