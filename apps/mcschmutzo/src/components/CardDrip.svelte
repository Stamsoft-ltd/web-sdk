<script lang="ts">
	import { onMount } from 'svelte';

	// A splash-card drip made from the PAINTED drip itself, so colour + shading match exactly:
	// the tendril's round tip (bulb) and a slice of the tube above it are cut from the drip art and
	// redrawn here (the painted layer is clipped just above the bulb, see SplashIntro .drip--t*).
	// At rest this draws exactly the painted pixels. Each cycle the tube STRETCHES (the slice is
	// stretched down, narrowing as it goes), the bulb swells, the neck pinches, and the bulb breaks
	// off and RUNS down the card trailing a thin streak of the same painted slice, while the tendril
	// recoils and a fresh bulb regrows at the tip — so the loop is seamless.
	type Tendril = {
		cx: number; // bulb centre x (art px)
		tip: number; // bulb bottom y (art px)
		bulb: number; // bulb height (art px)
		period: number; // ms per drip
		phase: number; // ms offset
		reach?: number; // how far the tube stretches before pinching (art px)
		run?: number; // how far the drop runs down the card (art px)
		endCx?: number; // centre of the rounded end (art px), if it differs from the tube's
		endW?: number; // width of the rounded end's top (art px)
	};
	type Props = { src: string; artW: number; artH: number; tendrils: Tendril[] };
	const { src, artW, artH, tendrils }: Props = $props();

	let canvas: HTMLCanvasElement;
	onMount(() => {
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
		const img = new Image();
		img.src = src;
		let k = 1; // card px per art px
		const resize = () => {
			const dpr = Math.min(1.5, devicePixelRatio || 1);
			const w = canvas.clientWidth;
			const h = canvas.clientHeight;
			canvas.width = Math.round(w * dpr);
			canvas.height = Math.round(h * dpr);
			k = w / artW;
			ctx.setTransform(dpr * k, 0, 0, dpr * k, 0, 0); // draw in ART px
		};
		const ro = new ResizeObserver(resize);
		ro.observe(canvas);
		resize();

		const HALF = 22; // half-width of the source slices (art px) — covers the tube + its outline
		const ease = (q: number) => q * q * (3 - 2 * q);
		// Draw the tube slice (the 4 straight rows above the bulb) stretched from y0 to y1, its width
		// scaled per band by widthAt(f) (f = 0 top → 1 bottom), centred on cx.
		// The painted tube (a 1-row slice just above the rounded end) stretched from y0 to y1 in ONE draw
		// (no bands → no stripes), at width factor wf.
		const tube = (t: Tendril, y0: number, y1: number, wf: number, alpha = 1) => {
			if (y1 - y0 <= 0.2) return;
			const sy = t.tip - t.bulb + 2;
			ctx.globalAlpha = alpha;
			ctx.drawImage(img, t.cx - HALF, sy, HALF * 2, 1, t.cx - HALF * wf, y0, HALF * 2 * wf, y1 - y0 + 0.5);
			ctx.globalAlpha = 1;
		};
		// The painted end of the tendril (tube + rounded tip) with its top at y, scaled by s.
		const bulb = (t: Tendril, y: number, s: number, alpha = 1) => {
			const sy = t.tip - t.bulb + 2;
			const sh = t.bulb;
			ctx.globalAlpha = alpha;
			ctx.drawImage(img, t.cx - HALF, sy, HALF * 2, sh, t.cx - HALF * s, y, HALF * 2 * s, sh * s);
			ctx.globalAlpha = 1;
		};
		// Exact colours of THIS drip, sampled from the painted art once it loads: body (right of the
		// highlight), rim (darkest outline pixel) and highlight (brightest), per tendril.
		type Pal = { body: string; rim: string; hi: string; w: number };
		const pal = new Map<Tendril, Pal>();
		const sample = () => {
			const c = document.createElement('canvas');
			c.width = artW;
			c.height = artH;
			const x = c.getContext('2d', { willReadFrequently: true })!;
			x.drawImage(img, 0, 0, artW, artH);
			for (const t of tendrils) {
				const y = Math.round(t.tip - t.bulb + 6);
				const d = x.getImageData(Math.round(t.cx - HALF), y, HALF * 2, 1).data;
				let dark = [255, 255, 255, 0], bright = [0, 0, 0, 0], l = -1, r = -1;
				for (let i = 0; i < HALF * 2; i++) {
					const [R, G, B, A] = [d[i * 4], d[i * 4 + 1], d[i * 4 + 2], d[i * 4 + 3]];
					if (A < 200) continue;
					if (l < 0) l = i;
					r = i;
					const L = R + G + B;
					if (L < dark[0] + dark[1] + dark[2]) dark = [R, G, B, A];
					if (L > bright[0] + bright[1] + bright[2]) bright = [R, G, B, A];
				}
				const bi = Math.round(HALF + 4); // just right of centre, past the highlight
				const body = `rgb(${d[bi * 4]},${d[bi * 4 + 1]},${d[bi * 4 + 2]})`;
				// rim = the painted outline at the BOTTOM of the rounded end (pure outline — the tube's side
				// edges touch the card frame / anti-aliasing): 2 rows above its lowest opaque pixel.
				const ex = Math.round(t.endCx ?? t.cx);
				const col = x.getImageData(ex, Math.round(t.tip - 10), 1, 14).data;
				let lo = -1;
				for (let j = 0; j < 14; j++) if (col[j * 4 + 3] > 200) lo = j;
				const rj = Math.max(0, lo - 2);
				const rim = `rgb(${col[rj * 4]},${col[rj * 4 + 1]},${col[rj * 4 + 2]})`;
				void dark;
				pal.set(t, { body, rim, hi: `rgba(${bright[0]},${bright[1]},${bright[2]},0.85)`, w: r - l + 1 });
			}
		};
		// Thin sauce thread (a solid body-coloured strand with a faint rim).
		const thread = (t: Tendril, y0: number, y1: number, w: number, alpha = 1) => {
			const c = pal.get(t);
			if (!c || y1 - y0 <= 0.2 || w <= 0.2) return;
			ctx.globalAlpha = alpha;
			ctx.fillStyle = c.body;
			ctx.fillRect(t.cx - w / 2, y0, w, y1 - y0);
			ctx.globalAlpha = 1;
		};
		// Pinching neck between the tube (full width W at yA) and the hanging end (full width at yB),
		// narrowing to `min` in the middle — smooth curves, body fill + rim, like the painted outline.
		const neck = (t: Tendril, yA: number, yB: number, min: number) => {
			const c = pal.get(t);
			if (!c || yB <= yA) return;
			const hw = c.w / 2 - 0.5;
			const N = 16;
			const pts: [number, number][] = [];
			for (let j = 0; j <= N; j++) {
				const f = j / N;
				// hourglass, narrowest at 70% down (just above the heavy end), full width at both ends
				// smoothstep in/out: starts parallel to the tube (no shoulder), narrowest at 78%
				const g = f < 0.78 ? ease(f / 0.78) : 1 - ease((f - 0.78) / 0.22);
				pts.push([hw - (hw - min / 2) * g, yA + (yB - yA) * f]);
			}
			ctx.beginPath();
			pts.forEach(([w, y], j) => (j ? ctx.lineTo(t.cx - w, y) : ctx.moveTo(t.cx - w, y)));
			for (let j = N; j >= 0; j--) ctx.lineTo(t.cx + pts[j][0], pts[j][1]);
			ctx.closePath();
			// fill with the PAINTED tube (shading + highlight), clipped to the hourglass
			ctx.save();
			ctx.clip();
			tube(t, yA - 0.5, yB + 0.5, 1);
			ctx.restore();
			ctx.lineWidth = 1.6;
			ctx.strokeStyle = c.rim;
			// outline only where the neck narrows (the painted tube above already has its own outline)
			const from = Math.round(N * 0.3);
			for (const side of [-1, 1]) {
				ctx.beginPath();
				for (let j = from; j <= N; j++) {
					const [w, y] = pts[j];
					if (j === from) ctx.moveTo(t.cx + side * w, y);
					else ctx.lineTo(t.cx + side * w, y);
				}
				ctx.stroke();
			}
		};
		// A falling teardrop (round bottom, pointed top), in the painted colours, centred on cx; `cy` =
		// centre of its round part, `r` = radius, `len` = tail length above.
		const drop = (t: Tendril, cy: number, r: number, len: number, alpha = 1) => {
			const c = pal.get(t);
			if (!c) return;
			const x = t.endCx ?? t.cx;
			ctx.globalAlpha = alpha;
			ctx.beginPath();
			ctx.moveTo(x, cy - r - len);
			ctx.bezierCurveTo(x + r * 0.35, cy - r - len * 0.45, x + r, cy - r * 0.55, x + r, cy);
			ctx.arc(x, cy, r, 0, Math.PI, false);
			ctx.bezierCurveTo(x - r, cy - r * 0.55, x - r * 0.35, cy - r - len * 0.45, x, cy - r - len);
			ctx.closePath();
			ctx.fillStyle = c.body;
			ctx.fill();
			ctx.lineWidth = 1.6;
			ctx.strokeStyle = c.rim;
			ctx.stroke();
			ctx.beginPath();
			ctx.ellipse(x - r * 0.38, cy - r * 0.25, r * 0.2, r * 0.36, -0.25, 0, Math.PI * 2);
			ctx.fillStyle = c.hi;
			ctx.fill();
			ctx.globalAlpha = 1;
		};

		const draw = (t: Tendril, now: number) => {
			const P = t.period;
			const p = reduce ? 0 : ((((now + t.phase) % P) + P) % P) / P;
			const top = t.tip - t.bulb + 2; // the painted layer is cut here; everything below is ours
			const E = t.reach ?? 30;
			const RUN = t.run ?? 230;
			const STRETCH = 0.5;
			const PINCH = 0.62;
			const R0 = ((pal.get(t)?.w ?? 26) / 2) * 0.8; // detached drop radius
			if (p < STRETCH) {
				// The painted tendril STRETCHES (slow viscous ooze): exact painted pixels, just longer.
				const ext = E * ease(p / STRETCH);
				tube(t, top, top + ext + 1, 1);
				bulb(t, top + ext, 1);
				return;
			}
			if (p < PINCH) {
				// The neck thins over the stretched length while the heavy end (kept exactly where the
				// stretch left it) sags a little — continuous with the stretch, no jump.
				const q = ease((p - STRETCH) / (PINCH - STRETCH));
				const sag = 4 * q;
				const yA = top + E * 0.35;
				const yB = top + E + sag + 5;
				const W = pal.get(t)?.w ?? 26;
				tube(t, top, yA + 1, 1);
				neck(t, yA, yB, W * (0.92 - 0.8 * q));
				bulb(t, top + E + sag, 1);
				return;
			}
			// Detached: a teardrop RUNS down the card (slow start, speeding up, then easing), trailing a
			// thin streak that fades; the tendril recoils to its painted rest with a damped bounce.
			const q = (p - PINCH) / (1 - PINCH);
			const sp = q < 0.55 ? (q / 0.55) ** 2 * 0.7 : 0.7 + 0.3 * ease((q - 0.55) / 0.45);
			const r = R0 * (1 - 0.3 * q);
			const cy = top + E + 4 + t.bulb - R0 + RUN * sp; // starts where the hanging end was
			const fade = q > 0.72 ? 1 - (q - 0.72) / 0.28 : 1;
			thread(t, top + t.bulb - 2, cy - r - 6, 2.4 * (1 - 0.4 * q), 0.85 * fade);
			drop(t, cy, r, r * 1.3, fade);
			const rq = Math.min(1, q / 0.4);
			const ext = Math.max(0, E * 0.35 * (1 - rq) * Math.cos(rq * Math.PI * 1.5));
			tube(t, top, top + ext + 1, 1);
			bulb(t, top + ext, 1);
		};

		let raf = 0;
		const loop = (now: number) => {
			raf = requestAnimationFrame(loop);
			if (document.hidden || !img.complete || !img.naturalWidth) return;
			if (!pal.size) sample();
			ctx.save();
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.restore();
			for (const t of tendrils) draw(t, now);
		};
		raf = requestAnimationFrame(loop);
		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
		};
	});
	void artH;
</script>

<canvas class="card-drip" bind:this={canvas} aria-hidden="true"></canvas>

<style>
	.card-drip {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
</style>
