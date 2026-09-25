<script lang="ts">
	import { onMount } from 'svelte';

	import { drawSauceSquirt, sauceDark, squirtHash, type SquirtGraphics } from '../game/ketchupSquirt';

	// Realistic sauce FX drawn on a canvas laid over (and bleeding past) its positioned host box:
	//  • splashes — one-shot impact spray: when a splat lands, a few jets of sauce fly outward and
	//    snap into drops of mixed sizes (the same rope → droplet physics as the chef's squirt).
	//  • drips — looping viscous drips off a tip: a bead oozes out on a stretching neck and swells,
	//    the neck pinches off and snaps back (with a little bounce), and the drop falls under gravity,
	//    elongating as it speeds up, trailed by a tiny satellite droplet, then fades.
	// All positions are fractions of the host box; sizes are fractions of the host's height.

	type Splash = {
		x: number;
		y: number;
		color: number;
		/** Main spray direction (radians, 0 = right, -π/2 = up). */
		dir: number;
		spread?: number; // fan half-angle between the jets (radians)
		delay?: number; // ms after mount
		size?: number; // spray scale (fraction of host height)
		jets?: number; // jets per shot (default 3: an impact fan; 1 = a single bottle squirt)
		period?: number; // repeat every `period` ms (default: fire once)
		skip?: number; // with `period`: fraction of slots that stay quiet (irregular, "now and then")
	};
	type Drip = {
		x: number;
		y: number;
		color: number;
		size?: number; // bead radius (fraction of host height)
		period?: number; // ms per drip (±25% per cycle)
		phase?: number; // ms offset
		fall?: number; // fall distance before fading (fraction of host height)
		steady?: boolean; // exact period (no per-cycle jitter) — to stay in sync with a CSS loop
	};
	type Props = { splashes?: Splash[]; drips?: Drip[]; bleed?: number; delay?: number };
	const { splashes = [], drips = [], bleed = 0.35, delay = 0 }: Props = $props();

	let canvas: HTMLCanvasElement;
	onMount(() => {
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const host = canvas.parentElement!;
		let W = 0;
		let H = 0; // host box size (css px)
		let bx = 0;
		let by = 0; // host origin inside the canvas
		const resize = () => {
			W = host.clientWidth;
			H = host.clientHeight;
			const dpr = Math.min(2, devicePixelRatio || 1);
			bx = W * bleed;
			by = H * bleed;
			const cw = W + 2 * bx;
			const ch = H + 2 * by + H * 0.4; // extra room below for falling drops
			canvas.style.left = `${-bx}px`;
			canvas.style.top = `${-by}px`;
			canvas.style.width = `${cw}px`;
			canvas.style.height = `${ch}px`;
			canvas.width = Math.round(cw * dpr);
			canvas.height = Math.round(ch * dpr);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		};
		const ro = new ResizeObserver(resize);
		ro.observe(host);
		resize();

		const hex = (c: number, a = 1) =>
			`rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
		// Minimal PIXI.Graphics-alike over the 2D context, so drawSauceSquirt can paint here too.
		const g: SquirtGraphics = {
			moveTo(x, y) {
				ctx.beginPath();
				ctx.moveTo(x, y);
				return g;
			},
			lineTo(x, y) {
				ctx.lineTo(x, y);
				return g;
			},
			stroke(s: any) {
				ctx.lineWidth = s.width ?? 1;
				ctx.lineCap = s.cap ?? 'butt';
				ctx.strokeStyle = hex(s.color ?? 0, s.alpha ?? 1);
				ctx.stroke();
			},
			circle(x, y, r) {
				ctx.beginPath();
				ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
				return {
					fill(s: any) {
						ctx.fillStyle = hex(s.color ?? 0, s.alpha ?? 1);
						ctx.fill();
					},
					stroke(s: any) {
						ctx.lineWidth = s.width ?? 1;
						ctx.strokeStyle = hex(s.color ?? 0, s.alpha ?? 1);
						ctx.stroke();
					},
				};
			},
		};

		const drawDrip = (d: Drip, i: number, t: number) => {
			const R = (d.size ?? 0.022) * H;
			const base = d.period ?? 2600;
			// Per-cycle jitter so drips don't tick like a metronome.
			const tt = t + (d.phase ?? i * 777);
			const k = Math.floor(tt / base);
			const period = d.steady ? base : base * (0.8 + 0.45 * squirtHash(k * 3.3 + i));
			const p = (tt - k * base) / period;
			if (p > 1) return; // pause between drips
			const x = bx + d.x * W;
			const y0 = by + d.y * H;
			const col = d.color;
			const dark = sauceDark(col);
			const OOZE = 0.62;
			const w0 = R * 1.25; // neck width where it leaves the tip
			if (p < OOZE) {
				// Ooze: the neck stretches, the bead swells (fast at first, then slowing: viscous).
				const q = p / OOZE;
				const e = 1 - (1 - q) ** 2.2;
				const r = R * (0.3 + 0.7 * e);
				const L = R * (0.4 + 2.1 * q ** 1.6);
				const yb = y0 + L + r;
				const wn = w0 * (0.9 - 0.45 * q) + r * 0.2; // neck narrows as the bead gets heavy
				const sway = Math.sin(t / 420 + i) * R * 0.06 * q;
				ctx.beginPath();
				ctx.moveTo(x - w0 / 2, y0);
				ctx.bezierCurveTo(x - w0 / 2, y0 + L * 0.35, x - wn / 2 + sway, yb - r * 1.6, x - r * 0.8 + sway, yb - r * 0.55);
				ctx.arc(x + sway, yb, r, Math.PI * 1.18, Math.PI * 1.82, true);
				ctx.bezierCurveTo(x + wn / 2 + sway, yb - r * 1.6, x + w0 / 2, y0 + L * 0.35, x + w0 / 2, y0);
				ctx.closePath();
				ctx.fillStyle = hex(col);
				ctx.fill();
				ctx.lineWidth = Math.max(0.8, R * 0.12);
				ctx.strokeStyle = hex(dark, 0.55);
				ctx.stroke();
				// Wet highlights: a sliver down the neck + a glint on the bead.
				ctx.beginPath();
				ctx.ellipse(x + sway - r * 0.35, yb - r * 0.3, r * 0.22, r * 0.34, -0.4, 0, Math.PI * 2);
				ctx.fillStyle = 'rgba(255,255,255,0.55)';
				ctx.fill();
				return;
			}
			// Pinch-off: the nub left on the tip snaps back up with a damped bounce.
			const tf = (p - OOZE) / (1 - OOZE); // 0..1 through the fall
			const nubL = R * 0.9 * Math.exp(-6 * tf) * Math.abs(Math.cos(tf * 14));
			ctx.beginPath();
			ctx.ellipse(x, y0 + nubL * 0.5, w0 / 2, Math.max(R * 0.15, nubL * 0.5 + R * 0.15), 0, 0, Math.PI);
			ctx.fillStyle = hex(col);
			ctx.fill();
			// Falling drop: gravity (starts slow), stretches with speed, fades near the end.
			const fallD = (d.fall ?? 0.35) * H;
			const yStart = y0 + R * 2.9;
			const s = tf ** 2;
			const yd = yStart + s * fallD;
			const v = tf; // relative speed
			const sy = 1 + 0.45 * v;
			const sx = 1 - 0.18 * v;
			const al = 1 - Math.max(0, (tf - 0.75) / 0.25);
			// satellite droplet (the pinched thread's remnant), a little behind
			if (tf > 0.05) {
				ctx.beginPath();
				ctx.arc(x, yd - R * (2.2 + 1.5 * v), R * 0.28, 0, Math.PI * 2);
				ctx.fillStyle = hex(col, al);
				ctx.fill();
			}
			ctx.save();
			ctx.translate(x, yd);
			ctx.scale(sx, sy);
			// teardrop: round bottom + pointed top
			ctx.beginPath();
			ctx.moveTo(0, -R * 1.55);
			ctx.bezierCurveTo(R * 0.35, -R * 1.0, R, -R * 0.45, R, 0);
			ctx.arc(0, 0, R, 0, Math.PI, false);
			ctx.bezierCurveTo(-R, -R * 0.45, -R * 0.35, -R * 1.0, 0, -R * 1.55);
			ctx.fillStyle = hex(col, al);
			ctx.fill();
			ctx.lineWidth = Math.max(0.8, R * 0.12);
			ctx.strokeStyle = hex(dark, 0.55 * al);
			ctx.stroke();
			ctx.beginPath();
			ctx.ellipse(-R * 0.35, -R * 0.25, R * 0.2, R * 0.32, -0.3, 0, Math.PI * 2);
			ctx.fillStyle = `rgba(255,255,255,${0.55 * al})`;
			ctx.fill();
			ctx.restore();
		};

		const t0 = performance.now() + delay;
		let raf = 0;
		const loop = (now: number) => {
			raf = requestAnimationFrame(loop);
			const t = now - t0;
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			if (t < 0) return;
			splashes.forEach((sp, i) => {
				let u = t - (sp.delay ?? 0);
				if (sp.period && u >= 0) {
					const k = Math.floor(u / sp.period);
					u = squirtHash(k * 1.37 + i) < (sp.skip ?? 0) ? -1 : u - k * sp.period;
				}
				const unit = (sp.size ?? 0.9) * H;
				const spread = sp.spread ?? 0.55;
				const jets = sp.jets ?? 3;
				for (let j = 0; j < jets; j++) {
					const dir = sp.dir + (jets > 1 ? (j - 1) * spread : 0) + (squirtHash(i * 5 + j) - 0.5) * 0.2;
					drawSauceSquirt(g, {
						u: u - j * 40,
						unit: unit * (0.8 + 0.35 * squirtHash(i * 3 + j * 7)),
						color: sp.color,
						seed: i * 10 + j,
						widthScale: 1.5,
						nozzleAt: () => ({ x: bx + sp.x * W, y: by + sp.y * H, dir }),
					});
				}
			});
			drips.forEach((d, i) => drawDrip(d, i, t));
		};
		raf = requestAnimationFrame(loop);
		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
		};
	});
</script>

<canvas class="sauce-fx" bind:this={canvas} aria-hidden="true"></canvas>

<style>
	.sauce-fx {
		position: absolute;
		pointer-events: none;
		z-index: 3;
	}
</style>
