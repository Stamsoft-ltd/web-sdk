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
		gems = [],
		logoPaths = [],
		textGlows = [],
		framePath = [],
		showFrame = true,
		plasma = [],
	}: {
		x?: number;
		y?: number;
		boardW: number;
		boardH: number;
		hx: number;
		hy: number;
		color: number;
		/** Positions (px, relative to this overlay's origin) of the medallion-ring gems to halo. */
		gems?: { x: number; y: number }[];
		/** Closed polylines (px, arc-length-even points) of the P logo's contours (bowl + stem). */
		logoPaths?: { x: number; y: number }[][];
		/** Elliptic glow regions (px) over baked text (MAX WIN screen lettering). */
		textGlows?: { x: number; y: number; rx: number; ry: number; color: number }[];
		/** Closed contour (px) of the art's outer edge — when set, the frame FX (glow band,
		 *  bars, corner gems, runners) follow this organic path instead of a rectangle. */
		framePath?: { x: number; y: number }[];
		/** When false, no perimeter frame FX are drawn at all (the MAX WIN art has its own baked
		 *  electric border, so it opts out — the gem/logo/text glows still render). */
		showFrame?: boolean;
		/** Small contained plasma crackle (px) on each plasma face — the MAX WIN compass medallion
		 *  and the blue sphere. r = the face's plasma-core radius; the effect stays within ~r. */
		plasma?: { x: number; y: number; r: number; color: number }[];
	} = $props();

	// Point on a closed contour at parameter u ∈ [0,1) — points are arc-length-even,
	// so index interpolation traverses the border at constant speed.
	const pathPointAt = (path: { x: number; y: number }[], u: number) => {
		const n = path.length;
		const s = (((u % 1) + 1) % 1) * n;
		const i = Math.floor(s);
		const f = s - i;
		const a = path[i % n];
		const b = path[(i + 1) % n];
		return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
	};

	type G = {
		clear: () => void;
		moveTo: (x: number, y: number) => void;
		lineTo: (x: number, y: number) => void;
		roundRect: (x: number, y: number, w: number, h: number, r: number) => unknown;
		circle: (x: number, y: number, r: number) => unknown;
		ellipse: (x: number, y: number, rx: number, ry: number) => unknown;
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

		// ── Organic frame (MAX WIN): the glow band + electric runners follow the art's
		//    alpha contour instead of a rectangle. ──
		if (showFrame && framePath.length > 2) {
			g.moveTo(framePath[0].x, framePath[0].y);
			for (let i = 1; i <= framePath.length; i++) {
				const p = framePath[i % framePath.length];
				g.lineTo(p.x, p.y);
			}
			g.stroke({ width: boardW * 0.045, color, alpha: 0.05 + 0.08 * beat, cap: 'round', join: 'round' });
			g.moveTo(framePath[0].x, framePath[0].y);
			for (let i = 1; i <= framePath.length; i++) {
				const p = framePath[i % framePath.length];
				g.lineTo(p.x, p.y);
			}
			g.stroke({ width: boardW * 0.018, color, alpha: 0.1 + 0.14 * beat, cap: 'round', join: 'round' });

			// Three electric runners crawling the contour (re-jittered every frame).
			const jitF = boardW * 0.008;
			const baseF = t * 0.1;
			for (const off of [0, 1 / 3, 2 / 3]) {
				const NF = 12;
				const SEGF = 0.05;
				const pts: { x: number; y: number }[] = [];
				for (let i = 0; i <= NF; i++) {
					const p = pathPointAt(framePath, baseF + off - (i / NF) * SEGF);
					pts.push({
						x: p.x + (Math.random() - 0.5) * 2 * jitF,
						y: p.y + (Math.random() - 0.5) * 2 * jitF,
					});
				}
				g.moveTo(pts[0].x, pts[0].y);
				for (let i = 1; i <= NF; i++) g.lineTo(pts[i].x, pts[i].y);
				g.stroke({ width: boardW * 0.012, color, alpha: 0.45, cap: 'round', join: 'round' });
				g.moveTo(pts[0].x, pts[0].y);
				for (let i = 1; i <= NF; i++) g.lineTo(pts[i].x, pts[i].y);
				g.stroke({ width: boardW * 0.004, color: 0xffffff, alpha: 0.95, cap: 'round', join: 'round' });
				g.circle(pts[0].x, pts[0].y, boardW * 0.007 * (0.8 + 0.4 * Math.random()));
				g.fill({ color: 0xffffff, alpha: 0.95 });
			}
		}

		// ── Breathing glow band along the whole frame (rectangular tier boards) ──
		if (showFrame && framePath.length <= 2) {
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
		}

		// ── Pulsing halos around the medallion-ring gems (the 4 hexes on the centre dial) ──
		const GR = boardW * 0.075;
		for (const [i, gem] of gems.entries()) {
			// Slow out-of-phase breathing with a faster shimmer riding on top.
			const pulse =
				0.5 + 0.5 * Math.sin(t * 2.6 + i * 1.7) * (0.75 + 0.25 * Math.sin(t * 11 + i * 2.3));
			for (let k = 5; k >= 1; k--) {
				const f = k / 5;
				g.circle(gem.x, gem.y, GR * f);
				g.fill({ color, alpha: (0.14 + 0.38 * pulse) * (1 - f) + 0.05 });
			}
			// Bright white sparkle core so the gem itself reads as the light source.
			g.circle(gem.x, gem.y, GR * 0.2);
			g.fill({ color: 0xffffff, alpha: 0.3 + 0.5 * pulse });
		}

		// ── Rim light on the P logo: a faint gold edge shimmer along both glyph pieces
		//    (bowl + stem bar), with small sparkling glints chasing around each border. ──
		if (logoPaths.length) {
			const shimmer = 0.5 + 0.5 * Math.sin(t * 2.3) * (0.8 + 0.2 * Math.sin(t * 9.1));
			for (const [pi, path] of logoPaths.entries()) {
				if (path.length < 3) continue;
				// Soft constant edge glow (two stroke weights = cheap bloom).
				g.moveTo(path[0].x, path[0].y);
				for (let i = 1; i <= path.length; i++) {
					const p = path[i % path.length];
					g.lineTo(p.x, p.y);
				}
				g.stroke({ width: boardW * 0.012, color: 0xffc84a, alpha: 0.1 + 0.12 * shimmer, cap: 'round', join: 'round' });
				g.moveTo(path[0].x, path[0].y);
				for (let i = 1; i <= path.length; i++) {
					const p = path[i % path.length];
					g.lineTo(p.x, p.y);
				}
				g.stroke({ width: boardW * 0.004, color: 0xffe9a8, alpha: 0.22 + 0.2 * shimmer, cap: 'round', join: 'round' });

				// Sparkling glints: tiny hot cores with random per-frame twinkle and short
				// star-cross rays. 4 on the bowl piece, 2 on the stem bar.
				const SEG = 0.08; // trail length as a fraction of the contour
				const N = 10;
				const offsets = pi === 0 ? [0, 0.25, 0.5, 0.75] : [0, 0.5];
				for (const off of offsets) {
					const head = t * 0.34 + off;
					for (let i = 0; i < N; i++) {
						const a = pathPointAt(path, head - (i / N) * SEG);
						const b = pathPointAt(path, head - ((i + 1) / N) * SEG);
						const fade = 1 - i / N;
						g.moveTo(a.x, a.y);
						g.lineTo(b.x, b.y);
						g.stroke({ width: boardW * 0.005 * fade + boardW * 0.001, color: 0xfff0b8, alpha: 0.85 * fade, cap: 'round' });
					}
					const hp = pathPointAt(path, head);
					// Hard twinkle: mostly dim with random full-brightness bursts -> real sparkle.
					const burst = Math.random() < 0.3;
					const tw = burst ? 0.85 + 0.15 * Math.random() : 0.15 + 0.45 * Math.random();
					const ray = boardW * (burst ? 0.012 + 0.012 * Math.random() : 0.004 + 0.005 * Math.random());
					const ang = Math.random() * Math.PI;
					for (const a0 of [ang, ang + Math.PI / 2]) {
						g.moveTo(hp.x - Math.cos(a0) * ray, hp.y - Math.sin(a0) * ray);
						g.lineTo(hp.x + Math.cos(a0) * ray, hp.y + Math.sin(a0) * ray);
						g.stroke({ width: boardW * 0.0015, color: 0xffffff, alpha: 0.95 * tw, cap: 'round' });
					}
					g.circle(hp.x, hp.y, boardW * 0.003);
					g.fill({ color: 0xffffff, alpha: tw });
					g.circle(hp.x, hp.y, boardW * 0.007);
					g.fill({ color: 0xfff3c8, alpha: 0.45 * tw });
				}

				// Glitter: a few random micro-sparks popping along the contour every frame,
				// so the whole border glitters between the traveling glints.
				const sparks = pi === 0 ? 4 : 2;
				for (let s = 0; s < sparks; s++) {
					const sp = pathPointAt(path, Math.random());
					const sa = Math.random();
					if (sa < 0.35) continue; // some frames skip -> irregular popping
					g.circle(sp.x, sp.y, boardW * (0.0015 + 0.0025 * sa));
					g.fill({ color: 0xffffff, alpha: 0.5 + 0.5 * sa });
				}
			}
		}

		// ── Glow + glitter over baked lettering (MAX WIN screen: warm over MAX, electric
		//    over WIN). Layered breathing ellipses with fast flicker, plus micro-sparks
		//    popping across each word every frame. ──
		for (const [gi, tg] of textGlows.entries()) {
			const breathe =
				0.5 + 0.5 * Math.sin(t * 2.1 + gi * 2.4) * (0.75 + 0.25 * Math.sin(t * 8.7 + gi));
			const flick = 0.85 + 0.15 * Math.sin(t * 31 + gi * 5);
			for (let k = 5; k >= 1; k--) {
				const f = k / 5;
				g.ellipse(tg.x, tg.y, tg.rx * f, tg.ry * f);
				g.fill({ color: tg.color, alpha: (0.1 + 0.2 * breathe) * flick * (1 - f) + 0.03 });
			}
			// Glitter sparks scattered over the word.
			for (let s = 0; s < 5; s++) {
				const sa = Math.random();
				if (sa < 0.4) continue;
				const a0 = Math.random() * Math.PI * 2;
				const rr = Math.sqrt(Math.random());
				const sx = tg.x + Math.cos(a0) * tg.rx * 0.9 * rr;
				const sy = tg.y + Math.sin(a0) * tg.ry * 0.9 * rr;
				g.circle(sx, sy, boardW * (0.0012 + 0.002 * sa));
				g.fill({ color: 0xffffff, alpha: 0.45 + 0.55 * sa });
			}
		}

		// ── Plasma faces (compass medallion + blue sphere): a small, contained electric crackle
		//    so each face reads as energized without hiding the art. A soft blue core glow, a
		//    small (not overpowering) bright core, and short flickering tendrils that stay within
		//    ~the plasma-core radius. Re-jittered every frame -> live plasma. ──
		for (const p of plasma) {
			const R0 = p.r;
			const flick = 0.55 + 0.45 * Math.abs(Math.sin(t * 15 + p.x)) * (0.7 + 0.3 * Math.sin(t * 47));
			// Soft blue glow (small, kept within the face).
			for (let k = 5; k >= 1; k--) {
				const f = k / 5;
				g.circle(p.x, p.y, R0 * f);
				g.fill({ color: p.color, alpha: (0.1 + 0.13 * flick) * (1 - f) + 0.02 });
			}
			// Small bright core — small enough that the compass/clock face stays visible.
			g.circle(p.x, p.y, R0 * 0.3);
			g.fill({ color: 0xcdeeff, alpha: 0.28 + 0.32 * flick });
			g.circle(p.x, p.y, R0 * 0.13);
			g.fill({ color: 0xffffff, alpha: 0.4 + 0.3 * flick });
			// Short crackling tendrils around the core (contained; re-jittered each frame).
			const RAYS = 8;
			for (let i = 0; i < RAYS; i++) {
				const ang = (i / RAYS) * Math.PI * 2 + t * 0.5 + (Math.random() - 0.5) * 0.4;
				const on = 0.4 + 0.6 * Math.sin(t * 18 + i * 2.3 + p.y);
				if (on < 0.5) continue;
				const len = R0 * (0.4 + 0.5 * Math.random());
				const start = R0 * 0.22;
				const SEG = 3;
				const pts = [{ x: p.x + Math.cos(ang) * start, y: p.y + Math.sin(ang) * start }];
				for (let s = 1; s <= SEG; s++) {
					const rr = start + (len * s) / SEG;
					const a = ang + (Math.random() - 0.5) * 0.5;
					pts.push({ x: p.x + Math.cos(a) * rr, y: p.y + Math.sin(a) * rr });
				}
				g.moveTo(pts[0].x, pts[0].y);
				for (let s = 1; s < pts.length; s++) g.lineTo(pts[s].x, pts[s].y);
				g.stroke({ width: boardW * 0.004, color: p.color, alpha: 0.4 * on, cap: 'round', join: 'round' });
				g.moveTo(pts[0].x, pts[0].y);
				for (let s = 1; s < pts.length; s++) g.lineTo(pts[s].x, pts[s].y);
				g.stroke({ width: boardW * 0.0016, color: 0xffffff, alpha: 0.75 * on, cap: 'round', join: 'round' });
			}
		}

		// ── Two electric runners crawling the perimeter (re-jittered every frame -> live arcs) ──
		// Rectangular tier boards only — the MAX WIN board opts out of the frame FX entirely.
		if (showFrame && framePath.length <= 2) {
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
