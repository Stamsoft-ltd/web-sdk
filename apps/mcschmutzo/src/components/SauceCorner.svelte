<script lang="ts" module>
	// Each card's corner blob gets its own size every time the splash opens: the three cards draw from
	// three different size bands (small / normal / big, shuffled), so they never look cloned.
	const BANDS: [number, number][] = [
		[0.8, 0.9],
		[0.95, 1.05],
		[1.1, 1.2],
	];
	let bag: [number, number][] = [];
	const nextBlobScale = () => {
		if (!bag.length) bag = [...BANDS].sort(() => Math.random() - 0.5);
		const [lo, hi] = bag.pop()!;
		return lo + Math.random() * (hi - lo);
	};
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import type { SauceSpec, SauceTendril } from '../lib/splashSauce';

	// A splash card's corner sauce, drawn entirely in code (it replaced the painted drip webp, whose
	// soft upscaled pixels read as generated art, and the drips that stretched those pixels into a
	// neck — the squeezed outline + highlight crossed into an "X"). Everything — the corner blob, each
	// tendril stretching, pinching, the drop running down the card and the recoil — is one silhouette
	// built as a MASK and shaded in a single pass, so a drop is always lit exactly like the sauce it
	// came from: body gradient, a soft inner shadow at the bottom-right, a top-left inner light, a crisp
	// darker rim and sharp white glints.
	//
	// Drawn in the card art's 470x690 px space (the canvas covers the card box).
	// frameR = corner radius of the card frame's outer edge (art px; the three frames are identical).
	type Props = { spec: SauceSpec; artW?: number; artH?: number; frameR?: number };
	const { spec, artW = 470, artH = 690, frameR = 54 }: Props = $props();

	let canvas: HTMLCanvasElement;

	onMount(() => {
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

		const [br, bg, bb] = spec.body;
		const shade = (t: number, a = 1) => {
			// t < 0 darkens toward black, t > 0 lightens toward white
			const f = (c: number) => Math.round(t < 0 ? c * (1 + t) : c + (255 - c) * t);
			return `rgba(${f(br)},${f(bg)},${f(bb)},${a})`;
		};

		// Region of the art the sauce can ever cover (blob + the longest run), so the work canvases stay
		// small instead of card-sized.
		const poly = spec.poly;
		let maxX = 0;
		let maxY = 0;
		for (let i = 0; i < poly.length; i += 2) {
			maxX = Math.max(maxX, poly[i]);
			maxY = Math.max(maxY, poly[i + 1]);
		}
		for (const t of spec.tendrils) maxY = Math.max(maxY, t.tip + t.reach + t.run + t.w);
		// The blob scales about the frame's top-left corner (where every card's sauce is pinned).
		const SCALE = nextBlobScale();
		const AX = 0;
		const AY = 0;
		const RX = Math.ceil(AX + (maxX - AX) * SCALE + 8);
		const RY = Math.ceil(Math.min(artH, AY + (maxY - AY) * SCALE + 8));
		// art px → device px of the work canvases, including the blob's scale about its anchor
		const artToDevice = (c: CanvasRenderingContext2D) =>
			c.setTransform(s * SCALE, 0, 0, s * SCALE, s * AX * (1 - SCALE), s * AY * (1 - SCALE));

		// Smooth closed path through the traced points (quadratic curves via the midpoints).
		const blob = new Path2D();
		{
			const n = poly.length / 2;
			const px = (i: number) => poly[((i + n) % n) * 2];
			const py = (i: number) => poly[((i + n) % n) * 2 + 1];
			blob.moveTo((px(-1) + px(0)) / 2, (py(-1) + py(0)) / 2);
			for (let i = 0; i < n; i++) blob.quadraticCurveTo(px(i), py(i), (px(i) + px(i + 1)) / 2, (py(i) + py(i + 1)) / 2);
			blob.closePath();
		}

		// The long specular streak: the stretch of outline that faces up-left, pulled 5.5 px inside.
		const streaks: [number, number][][] = [];
		{
			const n = poly.length / 2;
			let cx = 0;
			let cy = 0;
			for (let i = 0; i < n; i++) {
				cx += poly[i * 2];
				cy += poly[i * 2 + 1];
			}
			cx /= n;
			cy /= n;
			const pts = Array.from({ length: n }, (_, i) => {
				const x = poly[i * 2];
				const y = poly[i * 2 + 1];
				const dx = poly[((i + 1) % n) * 2] - poly[((i - 1 + n) % n) * 2];
				const dy = poly[((i + 1) % n) * 2 + 1] - poly[((i - 1 + n) % n) * 2 + 1];
				const l = Math.hypot(dx, dy) || 1;
				let nx = dy / l;
				let ny = -dx / l;
				if (nx * (x - cx) + ny * (y - cy) < 0) {
					nx = -nx;
					ny = -ny;
				}
				return { x, y, nx, ny };
			});
			let run: [number, number][] = [];
			for (const p of pts) {
				// faces the light (up-left) and sits in the top band, not on a tendril
				if (p.nx * -0.45 + p.ny * -0.9 > 0.82 && p.y < 40) run.push([p.x - p.nx * 5.5, p.y - p.ny * 5.5]);
				else {
					if (run.length > 4) streaks.push(run);
					run = [];
				}
			}
			if (run.length > 4) streaks.push(run);
		}

		// Work canvases (region-sized): M = silhouette mask, I = its inverse, O = shaded result.
		const mk = () => document.createElement('canvas');
		const M = mk();
		const I = mk();
		const O = mk();
		const mc = M.getContext('2d')!;
		const ic = I.getContext('2d')!;
		const oc = O.getContext('2d')!;
		let s = 1; // device px per art px
		let k = 1; // css px per art px

		const resize = () => {
			const dpr = Math.min(1.5, devicePixelRatio || 1);
			const w = canvas.clientWidth;
			k = w / artW;
			s = k * dpr;
			canvas.width = Math.round(w * dpr);
			canvas.height = Math.round(canvas.clientHeight * dpr);
			for (const c of [M, I, O]) {
				c.width = Math.ceil(RX * s);
				c.height = Math.ceil(RY * s);
			}
		};
		const ro = new ResizeObserver(() => {
			resize();
			if (reduce) render(0);
		});
		ro.observe(canvas);
		resize();

		const ease = (q: number) => q * q * (3 - 2 * q);

		// A vertical "profile" shape: from y0 to y1, width w(f) (f = 0 top → 1 bottom), centred on cx.
		const profile = (c: CanvasRenderingContext2D, cx: number, y0: number, y1: number, w: (f: number) => number) => {
			if (y1 - y0 < 0.3) return;
			const N = Math.max(6, Math.ceil((y1 - y0) / 1.5));
			c.beginPath();
			for (let i = 0; i <= N; i++) {
				const f = i / N;
				c.lineTo(cx - w(f) / 2, y0 + (y1 - y0) * f);
			}
			for (let i = N; i >= 0; i--) {
				const f = i / N;
				c.lineTo(cx + w(f) / 2, y0 + (y1 - y0) * f);
			}
			c.closePath();
			c.fill();
		};
		const disc = (c: CanvasRenderingContext2D, x: number, y: number, r: number) => {
			c.beginPath();
			c.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
			c.fill();
		};
		// A teardrop: round bottom (centre y, radius r) rising to a point h above the centre.
		const tear = (c: CanvasRenderingContext2D, x: number, y: number, r: number, h: number) => {
			c.beginPath();
			c.moveTo(x, y - h);
			c.bezierCurveTo(x + r * 0.35, y - h * 0.55, x + r, y - r * 0.55, x + r, y);
			c.arc(x, y, r, 0, Math.PI);
			c.bezierCurveTo(x - r, y - r * 0.55, x - r * 0.35, y - h * 0.55, x, y - h);
			c.closePath();
			c.fill();
		};
		const glint = (c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a = 0.85) => {
			c.fillStyle = `rgba(255,255,255,${a})`;
			c.beginPath();
			c.ellipse(x, y, Math.max(0.2, rx), Math.max(0.2, ry), -0.25, 0, Math.PI * 2);
			c.fill();
		};

		// Drip cycle per tendril (same choreography as before: stretch → pinch → the drop runs down the
		// card while the rest recoils to its rest pose), as vector shapes.
		const STRETCH = 0.48;
		const PINCH = 0.64;
		const MIN_NECK = 0.12;
		const SAG = 5;
		const PINCH_AT = 0.5;
		const neckG = (f: number) =>
			f < PINCH_AT ? ease(f / PINCH_AT) : 1 - Math.sin((Math.PI / 2) * ((f - PINCH_AT) / (1 - PINCH_AT)));
		// slow start, speeding up, easing out — one smooth curve (no seam where the speed restarts)
		const fallCurve = (q: number) => (q < 0.5 ? 4 * q * q * q : 1 - (2 - 2 * q) ** 3 / 2);

		type Glint = [number, number, number, number, number?];
		// Adds this tendril's ATTACHED sauce to the mask and returns its glints; `falling` collects the
		// detached drop (drawn in its own pass so it can fade without dimming the blob).
		// A random 0..1 per drip cycle (stable for the whole cycle), so every drop is its own size.
		const cycleRandom = (k: number, i: number) => {
			const x = Math.sin(k * 12.9898 + i * 78.233) * 43758.5453;
			return x - Math.floor(x);
		};
		const tendrilShapes = (
			i: number,
			t: SauceTendril,
			now: number,
			c: CanvasRenderingContext2D,
			glints: Glint[],
			falling: { draw: (c: CanvasRenderingContext2D) => void; glints: Glint[]; alpha: number }[],
		) => {
			const r = t.w / 2;
			const cy = t.tip - r; // centre of the tendril's round end
			const P = t.period;
			const p = reduce ? 0 : ((((now + t.phase) % P) + P) % P) / P;
			// this cycle's drop size: the end swells (or stays lean) toward it while it stretches
			const dropScale = 0.82 + 0.36 * cycleRandom(Math.floor((now + t.phase) / P), i);
			const E = t.reach;
			if (p < STRETCH) {
				const q = ease(p / STRETCH);
				const ext = E * q;
				const sw = 1 + (1.06 * dropScale - 1) * q;
				profile(c, t.cx, cy - 2, cy + ext, () => t.w);
				disc(c, t.cx, cy + ext, r * sw);
				glints.push([t.cx - r * 0.38, cy + ext - r * 0.05, r * 0.17, r * 0.32]);
				return;
			}
			const rb = r * 1.06 * dropScale;
			if (p < PINCH) {
				const q = ease((p - STRETCH) / (PINCH - STRETCH));
				const yb = cy + E + SAG * q;
				const m = 1 - (1 - MIN_NECK) * q;
				profile(c, t.cx, cy - 2, yb, (f) => t.w * (1 - (1 - m) * neckG(f)));
				disc(c, t.cx, yb, rb * (1 + 0.04 * q));
				glints.push([t.cx - rb * 0.38, yb - rb * 0.05, rb * 0.17, rb * 0.32]);
				return;
			}
			// Broken: the drop runs down the card; the rest springs back up into the rest pose.
			const q = (p - PINCH) / (1 - PINCH);
			const yb0 = cy + E + SAG;
			const yP = cy + (yb0 - cy) * PINCH_AT; // where the neck parted
			const fall = t.run * fallCurve(q);
			const rd = rb * (1 - 0.2 * q); // the drop thins as it leaves sauce behind
			const yd = yb0 + fall;
			const tailH = rd * (1.25 + 0.6 * ease(Math.min(1, q / 0.3)));
			const fade = q > 0.72 ? 1 - (q - 0.72) / 0.28 : 1;
			falling.push({
				alpha: fade,
				draw: (fc) => {
					// a thin wet streak from the break down to the drop
					if (q > 0.04) {
						const top = yP + 3;
						const bot = yd - tailH * 0.6;
						const sw = r * 0.34 * (1 - 0.45 * q);
						profile(fc, t.cx, top, bot, (f) => sw * (0.55 + 0.45 * f));
					}
					tear(fc, t.cx, yd, rd, tailH);
				},
				glints: [[t.cx - rd * 0.38, yd - rd * 0.1, rd * 0.17, rd * 0.32]],
			});
			// upper half recoils from the break to the rest pose; its end beads up, then a damped wobble
			const u = ease(Math.min(1, q / 0.28));
			const wob = q > 0.28 ? 2.2 * Math.exp(-(q - 0.28) * 9) * Math.sin((q - 0.28) * 26) : 0;
			const su = MIN_NECK + 0.25 + (0.75 - MIN_NECK) * u;
			const yEnd = cy + (yP - cy) * (1 - u) + Math.max(0, wob);
			profile(c, t.cx, cy - 2, yEnd, (f) => t.w * (1 - (1 - su) * f * f));
			disc(c, t.cx, yEnd, r * su);
			glints.push([t.cx - r * su * 0.38, yEnd - r * su * 0.05, r * su * 0.17, r * su * 0.32]);
		};

		// Shade whatever silhouette `fill` adds to the mask, into O (then O is drawn to the screen).
		const shadeInto = (fill: (c: CanvasRenderingContext2D) => void, glints: Glint[], withStreak: boolean) => {
			const W = M.width;
			const H = M.height;
			mc.setTransform(1, 0, 0, 1, 0, 0);
			mc.clearRect(0, 0, W, H);
			artToDevice(mc);
			mc.fillStyle = '#000';
			fill(mc);
			// The sauce overhangs the frame corner a little; clip it to the frame's own rounded outline so
			// on every card it starts exactly at the wood edge and follows the corner's curve (no gap).
			mc.setTransform(s, 0, 0, s, 0, 0);
			mc.globalCompositeOperation = 'destination-in';
			mc.beginPath();
			mc.roundRect(0, 0, artW, artH, frameR);
			mc.fill();
			mc.globalCompositeOperation = 'source-over';
			// inverse mask (for the inner shadows)
			ic.setTransform(1, 0, 0, 1, 0, 0);
			ic.globalCompositeOperation = 'source-over';
			ic.clearRect(0, 0, W, H);
			ic.fillStyle = '#000';
			ic.fillRect(0, 0, W, H);
			ic.globalCompositeOperation = 'destination-out';
			ic.drawImage(M, 0, 0);
			ic.globalCompositeOperation = 'source-over';
			// body: the silhouette filled with a top-lit gradient
			oc.setTransform(1, 0, 0, 1, 0, 0);
			oc.globalCompositeOperation = 'source-over';
			oc.clearRect(0, 0, W, H);
			oc.drawImage(M, 0, 0);
			oc.globalCompositeOperation = 'source-in';
			const g = oc.createLinearGradient(0, 0, 0, 70 * s);
			g.addColorStop(0, shade(0.14));
			g.addColorStop(1, shade(0));
			oc.fillStyle = g;
			oc.fillRect(0, 0, W, H);
			// inner shading: the inverse mask's shadow, kept inside the silhouette only
			oc.globalCompositeOperation = 'source-atop';
			const inner = (color: string, blur: number, dx: number, dy: number) => {
				oc.save();
				oc.shadowColor = color;
				oc.shadowBlur = blur * s;
				oc.shadowOffsetX = dx * s;
				oc.shadowOffsetY = dy * s;
				oc.drawImage(I, 0, 0);
				oc.restore();
			};
			inner(shade(-0.45, 0.75), 5, -2.6, -4.6); // bottom-right body shadow (volume)
			inner('rgba(255,255,255,0.42)', 3, 2.2, 3.2); // top-left inner light
			inner(shade(-0.55, 0.9), 1.4, 0, 0); // crisp rim
			// glints
			artToDevice(oc);
			if (withStreak) {
				oc.lineCap = 'round';
				oc.lineJoin = 'round';
				for (const run of streaks) {
					oc.beginPath();
					run.forEach(([x, y], i) => (i ? oc.lineTo(x, y) : oc.moveTo(x, y)));
					oc.strokeStyle = 'rgba(255,255,255,0.28)';
					oc.lineWidth = 6;
					oc.stroke();
					oc.strokeStyle = 'rgba(255,255,255,0.85)';
					oc.lineWidth = 2.4;
					oc.stroke();
				}
			}
			for (const [x, y, rx, ry, a] of glints) glint(oc, x, y, rx, ry, a);
			oc.globalCompositeOperation = 'source-over';
			oc.setTransform(1, 0, 0, 1, 0, 0);
		};

		const render = (now: number) => {
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			const glints: Glint[] = [];
			const falling: { draw: (c: CanvasRenderingContext2D) => void; glints: Glint[]; alpha: number }[] = [];
			shadeInto(
				(c) => {
					c.fill(blob);
					spec.tendrils.forEach((t, i) => tendrilShapes(i, t, now, c, glints, falling));
				},
				glints,
				true,
			);
			ctx.drawImage(O, 0, 0);
			for (const f of falling) {
				if (f.alpha <= 0.01) continue;
				shadeInto(f.draw, f.glints, false);
				ctx.globalAlpha = f.alpha;
				ctx.drawImage(O, 0, 0);
				ctx.globalAlpha = 1;
			}
		};

		let raf = 0;
		const loop = (now: number) => {
			raf = requestAnimationFrame(loop);
			if (document.hidden) return;
			render(now);
		};
		if (reduce) render(0);
		else raf = requestAnimationFrame(loop);
		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
		};
	});
</script>

<canvas class="sauce-corner" bind:this={canvas} aria-hidden="true"></canvas>

<style>
	.sauce-corner {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
</style>
