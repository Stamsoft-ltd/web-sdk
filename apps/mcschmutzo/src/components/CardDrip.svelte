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
	type Props = {
		src: string;
		artW: number;
		artH: number;
		tendrils: Tendril[];
		/** half-width of the painted slices (art px) — must cover the tube, not its neighbours */
		half?: number;
		/** drops fall FREE off an edge (accelerating, no streak) instead of running down a surface */
		free?: boolean;
	};
	const { src, artW, artH, tendrils, half = 22, free = false }: Props = $props();

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

		const HALF = half; // half-width of the source slices (art px) — covers the tube + its outline
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
		type Pal = { body: string; rim: string; hi: string; w: number; rows: number[]; eq: number };
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
				// Width of every row of the painted end (tube → round tip), and `eq` = the last full-width
				// row, where the rounded bottom begins (the ends are straight tubes that round off at the tip,
				// not bulbs — everything above `eq` gets squeezed into the neck / the drop's domed top).
				const rows: number[] = [];
				for (let j = 0; j < t.bulb; j++) {
					const rd = x.getImageData(Math.round(t.cx - HALF), Math.round(t.tip - t.bulb + 2 + j), HALF * 2, 1).data;
					let a0 = -1, a1 = -1;
					for (let i = 0; i < HALF * 2; i++) if (rd[i * 4 + 3] > 128) { if (a0 < 0) a0 = i; a1 = i; }
					rows.push(a0 < 0 ? 0 : a1 - a0 + 1);
				}
				const maxW = Math.max(...rows);
				let eq = 0;
				for (let j = 0; j < rows.length; j++) if (rows[j] >= maxW * 0.96) eq = j;
				pal.set(t, { body, rim, hi: `rgba(${bright[0]},${bright[1]},${bright[2]},0.85)`, w: r - l + 1, rows, eq });
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
		// Draw rows y0…y1, each one a painted source row squeezed horizontally about cx. `rowAt(f)`
		// (f = 0 top → 1 bottom) returns which row of the painted end to use (-1 = the plain tube row),
		// its painted content width, and the width to draw it at. Squeezing painted rows (instead of
		// clipping or stroking) keeps the art's own outline + highlight at every width, so a thinning
		// neck or a drop's tail looks painted, not drawn.
		type RowSpec = { src: number; srcW: number; w: number };
		const W_NARROW = 16; // art px — rows narrower than this get the body wash (see span)
		const span = (t: Tendril, y0: number, y1: number, rowAt: (f: number) => RowSpec, alpha = 1) => {
			if (y1 - y0 <= 0.2) return;
			const top = t.tip - t.bulb + 2;
			const n = Math.max(1, Math.ceil(y1 - y0));
			const hStep = (y1 - y0) / n;
			ctx.globalAlpha = alpha;
			for (let i = 0; i < n; i++) {
				const r = rowAt((i + 0.5) / n);
				const wf = r.srcW > 0 ? Math.max(0, r.w) / r.srcW : 0;
				if (wf <= 0.01) continue;
				const sy = top + Math.max(0, r.src);
				ctx.drawImage(img, t.cx - HALF, sy, HALF * 2, 1, t.cx - HALF * wf, y0 + i * hStep, HALF * 2 * wf, hStep + 0.6);
				// very narrow rows: the squeezed highlight + outline crowd into a pale criss-cross; wash
				// the row's middle with the sauce body so a thin neck reads as solid sauce
				const c = pal.get(t);
				if (c && r.w < W_NARROW && r.w > 1) {
					ctx.globalAlpha = alpha * 0.55 * (1 - r.w / W_NARROW);
					ctx.fillStyle = c.body;
					ctx.fillRect(t.cx - r.w * 0.32, y0 + i * hStep, r.w * 0.64, hStep + 0.6);
					ctx.globalAlpha = alpha;
				}
			}
			ctx.globalAlpha = 1;
		};
		// The painted end from its row `from` down (the part below the neck/tail), top at y, scaled s.
		const bulbFrom = (t: Tendril, y: number, from: number, s: number, alpha = 1) => {
			const sy = t.tip - t.bulb + 2 + from;
			const sh = t.bulb - from;
			ctx.globalAlpha = alpha;
			ctx.drawImage(img, t.cx - HALF, sy, HALF * 2, sh, t.cx - HALF * s, y, HALF * 2 * s, sh * s);
			ctx.globalAlpha = 1;
		};
		// Neck profile over the squeezed span: 0 at both ends, 1 at the pinch point. Above the pinch it
		// eases in (the tube thinning); below it the width comes back like a DOME (fast off the pinch,
		// flattening into the heavy end), so the hanging end reads round, not squat.
		const PINCH_AT = 0.5;
		const neckG = (f: number) =>
			f < PINCH_AT ? ease(f / PINCH_AT) : 1 - Math.sin((Math.PI / 2) * ((f - PINCH_AT) / (1 - PINCH_AT)));

		const draw = (t: Tendril, now: number) => {
			const P = t.period;
			const p = reduce ? 0 : ((((now + t.phase) % P) + P) % P) / P;
			const top = t.tip - t.bulb + 2; // the painted layer is cut here; everything below is ours
			const E = t.reach ?? 30;
			const RUN = t.run ?? 230;
			const c = pal.get(t);
			const W = c?.w ?? 26;
			const eq = c?.eq ?? Math.round(t.bulb * 0.45);
			const endW = (r: number) => c?.rows[Math.min(t.bulb - 1, Math.max(0, Math.floor(r)))] || W;
			const STRETCH = 0.48;
			const PINCH = 0.64;
			const MIN_NECK = 0.12; // neck width at the moment it lets go (fraction of the row's width)
			const SAG = E * 0.3; // further ooze while the neck thins (the end keeps moving — never pauses)
			// One continuous path for the hanging end, from rest to the break: an ever-so-slightly
			// accelerating ooze (the drop gets heavier), so the stretch flows straight into the pinch.
			const POS = (pp: number) => (E + SAG) * Math.min(1, pp / PINCH) ** 1.7;
			const yA = top + E * 0.3; // the squeezed span starts here (shared by the pinch and the break)
			// Row of the squeezed span at absolute y, given where the painted end's top (yb) is.
			const baseRow = (y: number, yb: number): RowSpec =>
				y < yb ? { src: -1, srcW: W, w: W } : { src: y - yb, srcW: endW(y - yb), w: endW(y - yb) };
			if (p < STRETCH) {
				// The painted tendril STRETCHES (slow viscous ooze): exact painted pixels, just longer.
				const ext = POS(p);
				tube(t, top, top + ext + 1, 1);
				bulb(t, top + ext, 1);
				return;
			}
			if (p < PINCH) {
				// The neck thins while the heavy end sags a touch. Everything from the neck down to the
				// end's widest row is squeezed painted rows (tube rows, then the end's own rows), so at the
				// start this is exactly the stretched pose and there's never a flat edge.
				const q = ease((p - STRETCH) / (PINCH - STRETCH));
				const yb = top + POS(p);
				const yEq = yb + eq;
				const m = 1 - (1 - MIN_NECK) * q;
				tube(t, top, yA + 1, 1);
				bulbFrom(t, yEq, eq, 1);
				span(t, yA, yEq + 0.5, (f) => {
					const b = baseRow(yA + (yEq - yA) * f, yb);
					return { ...b, w: b.w * (1 - (1 - m) * neckG(f)) };
				});
				return;
			}
			// Broken: the neck parts at its pinch point. The lower half stays on the drop as its tail
			// (sharpening to a point and pulling in), and the drop — still the painted end — runs down
			// the card (slow start, speeding up, easing out) leaving a thin streak. The upper half
			// springs back up and beads into the painted rest pose.
			const q = (p - PINCH) / (1 - PINCH);
			const yb0 = top + E + SAG;
			const yEq0 = yb0 + eq;
			const yP = yA + (yEq0 - yA) * PINCH_AT;
			// The drop leaves at the speed the end was oozing (no restart from zero). Running down a
			// surface: a smooth Hermite curve from that speed to a gentle stop as it fades (it never stalls
			// mid-way); free fall: gravity on top of that launch speed.
			const v0 = ((E + SAG) * 1.7 * (1 - PINCH)) / PINCH / RUN; // launch slope in run units per q
			const sp = free
				? Math.min(1, v0 * q + (1 - v0) * Math.min(1, q / 0.7) ** 2)
				: v0 * (q * q * q - 2 * q * q + q) + 3 * q * q - 2 * q * q * q;
			const fall = RUN * sp;
			const s = 1 - (free ? 0.06 : 0.18) * q; // the drop thins as it leaves sauce behind
			const fade = free
				? q > 0.42
					? Math.max(0, 1 - (q - 0.42) / 0.28)
					: 1
				: q > 0.72
					? 1 - (q - 0.72) / 0.28
					: 1;
			// The lower half of the neck rounds into a teardrop top: from exactly the neck's shape at the
			// break to a dome narrowing to a point, ~1.5× the height of the drop's rounded bottom.
			const tailPull = ease(Math.min(1, q / 0.3));
			const tipW = MIN_NECK * (1 - ease(Math.min(1, q / 0.1))); // the tip closes to a point
			const yEq = yEq0 + fall;
			const H0 = yEq0 - yP;
			const Hd = Math.max(8, (t.bulb - eq) * 1.5);
			const tailTop = yEq - (H0 + (Hd - H0) * tailPull) * s;
			if (!free && q > 0.04) thread(t, yP + 2, tailTop, 1.8 * (1 - 0.4 * q), 0.6 * fade * Math.min(1, (q - 0.04) / 0.1));
			bulbFrom(t, yEq, eq, s, fade);
			span(
				t,
				tailTop,
				yEq + 0.5,
				(f) => {
					// same rows/profile as the neck's lower half just before the break, compressed
					const yo = yP + (yEq0 - yP) * f;
					const b = baseRow(yo, yb0);
					const fo = (yo - yA) / (yEq0 - yA);
					const neckShape = 1 - (1 - tipW) * neckG(fo);
					const tear = Math.sin((Math.PI / 2) * f) ** 1.4; // pointed top → full width at the base
					return { ...b, w: b.w * s * (neckShape + (tear - neckShape) * tailPull) };
				},
				fade,
			);
			// Upper half: recoils from the break point to the rest pose; its tip beads up — a small
			// painted end at the tip of the retracting taper that swells to full size as it arrives —
			// then a small damped wobble.
			const u = ease(Math.min(1, q / 0.28));
			const wob = q > 0.28 ? 2.5 * Math.exp(-(q - 0.28) * 9) * Math.sin((q - 0.28) * 26) : 0;
			const su = MIN_NECK + 0.25 + (0.75 - MIN_NECK) * u; // bead size (fraction of the rest end)
			const yEnd = top + (yP - top) * (1 - u);
			span(t, top, yEnd + 0.5, (f) => ({ src: -1, srcW: W, w: W * (1 - (1 - su) * f * f) }));
			bulb(t, yEnd + Math.max(0, wob), su);
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
