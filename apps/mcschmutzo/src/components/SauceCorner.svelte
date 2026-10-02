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
	import { splashShapes, type SplashSpec } from '../game/winSplash';
	import { drawSplatCanvas } from '../game/splatCanvas';

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
		// (the whole card height: a drop bound for a lower line of copy runs past its usual run)
		const RY = artH;
		// art px → device px of the work canvases, including the blob's scale about its anchor
		const artToDevice = (c: CanvasRenderingContext2D) =>
			c.setTransform(s * SCALE, 0, 0, s * SCALE, s * AX * (1 - SCALE), s * AY * (1 - SCALE));

		// Smooth closed path through the traced points (quadratic curves via the midpoints).
		// Outline points within EDGE_SNAP px of the card's edge (measured at this blob's scale) are pushed
		// just past it, so the sauce always reaches the clip — on the corner arc AND the straight top and
		// left edges alike (the traced points sit a hair inside, and the scale moves them further). Points
		// deeper in are untouched, so the curve leaves the edge smoothly.
		const EDGE_SNAP = 4;
		// Along the straight LEFT edge it reaches further: the red/green corner drips ran ~10 px in from
		// the edge with a strip of frame showing beside them; now they hug it (see `hugs` below).
		const EDGE_SNAP_LEFT = 16;
		const EDGE_PAST = 3;
		const sealed = poly.slice();
		for (let i = 0; i < sealed.length; i += 2) {
			const x = sealed[i] * SCALE;
			const y = sealed[i + 1] * SCALE;
			const qx = Math.min(Math.max(x, frameR), artW - frameR);
			const qy = Math.min(Math.max(y, frameR), artH - frameR);
			let depth: number;
			let nx = 0;
			let ny = 0;
			if (qx !== x && qy !== y) {
				// corner zone: distance inside the arc, normal pointing out from its centre
				const l = Math.hypot(x - qx, y - qy);
				depth = frameR - l;
				nx = (x - qx) / l;
				ny = (y - qy) / l;
			} else {
				const d = [x, artW - x, y, artH - y];
				const m = d.indexOf(Math.min(...d));
				depth = d[m];
				[nx, ny] = [[-1, 0], [1, 0], [0, -1], [0, 1]][m];
			}
			const corner = qx !== x && qy !== y;
			if (depth >= (!corner && nx === -1 ? EDGE_SNAP_LEFT : EDGE_SNAP)) continue;
			sealed[i] = (x + nx * (depth + EDGE_PAST)) / SCALE;
			sealed[i + 1] = (y + ny * (depth + EDGE_PAST)) / SCALE;
		}
		const blob = new Path2D();
		{
			const n = sealed.length / 2;
			const px = (i: number) => sealed[((i + n) % n) * 2];
			const py = (i: number) => sealed[((i + n) % n) * 2 + 1];
			blob.moveTo((px(-1) + px(0)) / 2, (py(-1) + py(0)) / 2);
			for (let i = 0; i < n; i++) blob.quadraticCurveTo(px(i), py(i), (px(i) + px(i + 1)) / 2, (py(i) + py(i + 1)) / 2);
			blob.closePath();
		}

		// The long specular streak: an arc inside the frame's rounded corner that runs on along the top
		// edge, in frame space (the sauce is clipped to the frame, so it always follows that curve). It
		// used to be traced from the outline's points, which kinked wherever the outline wobbled.
		const STREAK_IN = 6.5; // art px inside the frame edge
		const STREAK_RUN = 48; // how far it carries on along the top
		// The logo splats' cartoon look (game/winSplash), in art px: a thick dark-brown outline, a flat
		// body, a darker rim pooled along the lower-right, a 40% lighter core nudged up-left, white gloss.
		const OUTLINE = 4.5;
		const EDGE = '#3a1408';
		const RIM = 2.6; // lower-right rim depth
		const RIM_THIN = 1.1; // and all round
		const LIGHT_IN = 7; // the lit core's inset from the edge…
		const LIGHT_NX = -2.5; // …nudged up-left
		const LIGHT_NY = -3;
		const streak = new Path2D();
		streak.arc(frameR, frameR, frameR - STREAK_IN, Math.PI * 1.08, Math.PI * 1.5);
		streak.lineTo(frameR + STREAK_RUN, STREAK_IN);

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
			// Full screen density (Retina / browser zoom): a lower cap upscaled the rim into stair-steps.
			const dpr = Math.min(3, devicePixelRatio || 1);
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
			measureLand();
			if (reduce) render(0);
		});
		ro.observe(canvas);
		resize();

		const ease = (q: number) => q * q * (3 - 2 * q);

		// Every shape below fills its path, and — in the outline pass, when OUTLINE mode is on — strokes it
		// too: the union of the stroked shapes is the silhouette grown by half the line width, i.e. the
		// cartoon outline (the same thick dark edge as the logo's splats), at no extra geometry cost.
		let outlining = false;
		const paint = (c: CanvasRenderingContext2D, path?: Path2D) => {
			if (path) c.fill(path);
			else c.fill();
			if (!outlining) return;
			if (path) c.stroke(path);
			else c.stroke();
		};

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
			paint(c);
		};
		const disc = (c: CanvasRenderingContext2D, x: number, y: number, r: number) => {
			c.beginPath();
			c.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
			paint(c);
		};
		// A teardrop: round bottom (centre y, radius r) rising to a point h above the centre.
		const tear = (c: CanvasRenderingContext2D, x: number, y: number, r: number, h: number) => {
			c.beginPath();
			c.moveTo(x, y - h);
			c.bezierCurveTo(x + r * 0.35, y - h * 0.55, x + r, y - r * 0.55, x + r, y);
			c.arc(x, y, r, 0, Math.PI);
			c.bezierCurveTo(x - r, y - r * 0.55, x - r * 0.35, y - h * 0.55, x, y - h);
			c.closePath();
			paint(c);
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
		// A detached drop: `draw` adds its silhouette to the mask (shaded like the blob); `paint` draws a
		// finished splash straight to the canvas (it carries its own outline and shading).
		type Falling = { alpha: number; glints: Glint[]; draw?: (c: CanvasRenderingContext2D) => void; paint?: (c: CanvasRenderingContext2D) => void };
		// A drip whose left side runs within EDGE_SNAP_LEFT of the card edge hugs it: a wall of sauce from
		// the edge to the drip's centre, rounded off at the bottom into the drip's own round end, so no
		// strip of frame shows beside it. The drip itself still stretches / pinches / drops at its centre.
		const hugs = (t: SauceTendril) => (t.cx - t.w / 2) * SCALE < EDGE_SNAP_LEFT;
		const hugWall = (c: CanvasRenderingContext2D, t: SauceTendril) => {
			const r = t.w / 2;
			const cy = t.tip - r;
			const x0 = -EDGE_PAST / SCALE;
			c.beginPath();
			c.rect(x0, cy - r * 2, t.cx - x0, r * 2);
			c.ellipse(t.cx, cy, t.cx - x0, r, 0, 0, Math.PI * 2);
			paint(c);
		};

		// Where a falling drop can land: the top of each line of copy (title + description), in art px,
		// top to bottom. A drop lands on the first line it is above (the lines are centred, so a drop near
		// the side can miss a short line and hit a longer one below); one that misses them all falls on and
		// fades. Re-measured now and then — the copy reflows / fits.
		let lands: { top: number; left: number; right: number }[] = [];
		const measureLand = () => {
			lands = [];
			const cr = canvas.getBoundingClientRect();
			const copy = canvas.closest('.card')?.querySelectorAll('.card-title, .card-body p');
			if (!copy?.length || cr.width <= 0) return;
			const kk = cr.width / artW;
			const range = document.createRange();
			// the letters start a little below each line box's top (its ascent room)
			lands = [...copy]
				.flatMap((el) => {
					range.selectNodeContents(el);
					return [...range.getClientRects()];
				})
				.filter((q) => q.width > 1)
				.map((q) => ({ top: (q.top - cr.top + q.height * CAP_DROP) / kk, left: (q.left - cr.left) / kk, right: (q.right - cr.left) / kk }))
				.sort((a, b) => a.top - b.top);
		};
		const CAP_DROP = 0.2;
		// Adds this tendril's ATTACHED sauce to the mask and returns its glints; `falling` collects the
		// detached drop (drawn in its own pass so it can fade without dimming the blob).
		// A random 0..1 per drip cycle (stable for the whole cycle), so every drop is its own size.
		const cycleRandom = (k: number, i: number) => {
			const x = Math.sin(k * 12.9898 + i * 78.233) * 43758.5453;
			return x - Math.floor(x);
		};
		// The drop hitting a line of copy: a splash drawn by the SAME engine as the logo's splats (game/
		// winSplash), in this card's sauce colour with the logo's dark-brown outline — tongues thrown up
		// and sideways off the letters' top edge, two short ones running down over them, drops flung up.
		// Its own units: the core is ~1 unit wide; `u` (art px per unit) is set from the drop's size.
		const hex = (t: number) => {
			const f = (c: number) => Math.round(t < 0 ? c * (1 + t) : c + (255 - c) * t);
			return (f(br) << 16) | (f(bg) << 8) | f(bb);
		};
		const SPLAT_U = 0.18; // core radius in units
		const splatSpec = (seed: number): SplashSpec => {
			const j = (n: number, amp: number) => amp * (cycleRandom(seed + 7, n) - 0.5);
			return {
				ox: 0,
				oy: 0,
				core: { rx: SPLAT_U * 1.15, ry: SPLAT_U * 0.62 },
				// a = degrees off "outward" (side +1 = right; -90 up, 90 down)
				tongues: [
					{ a: -168 + j(0, 14), len: 0.36, w: 0.085, head: 0.1, curl: 14 },
					{ a: -122 + j(1, 18), len: 0.3, w: 0.08, head: 0.095, curl: -10 },
					{ a: -58 + j(2, 18), len: 0.38, w: 0.085, head: 0.1, curl: 12 },
					{ a: -10 + j(3, 14), len: 0.33, w: 0.08, head: 0.095, curl: -14 },
					{ a: 72 + j(4, 12), len: 0.2, w: 0.075, head: 0.09, curl: -4 },
					{ a: 112 + j(5, 12), len: 0.17, w: 0.07, head: 0.085, curl: 4 },
				],
				drops: [
					{ a: -138 + j(6, 20), d: 0.62, r: 0.045, delay: 30 },
					{ a: -88 + j(7, 20), d: 0.7, r: 0.04, delay: 0 },
					{ a: -40 + j(8, 20), d: 0.6, r: 0.042, delay: 50 },
					{ a: 4 + j(9, 16), d: 0.5, r: 0.034, delay: 70 },
				],
				palette: { edge: 0x3a1408, body: hex(0), shade: hex(-0.3), light: hex(0.35) },
				edgeW: 0, // set per hit (a fixed width in art px)
			};
		};
		const splatAt = (x: number, y: number, rs: number, ms: number, seed: number) => {
			const u = (rs / SPLAT_U) * 0.6; // art px per unit (smaller than the drop's own size: it mustn't bury the word)
			const spec = { ...splatSpec(seed), edgeW: OUTLINE / u };
			const list = splashShapes(spec, cycleRandom(seed, 9) < 0.5 ? 1 : -1, ms, seed);
			// sits on the letters' top edge: the core a little above it, the downward tongues over the caps
			return (c: CanvasRenderingContext2D) => drawSplatCanvas(c, list, x, y - spec.core.ry * u * 0.35, u);
		};

		const tendrilShapes = (
			i: number,
			t: SauceTendril,
			now: number,
			c: CanvasRenderingContext2D,
			glints: Glint[],
			falling: Falling[],
		) => {
			const r = t.w / 2;
			const cy = t.tip - r; // centre of the tendril's round end
			const P = t.period;
			const p = reduce ? 0 : ((((now + t.phase) % P) + P) % P) / P;
			// this cycle's drop size: the end swells (or stays lean) toward it while it stretches
			const dropScale = 0.82 + 0.36 * cycleRandom(Math.floor((now + t.phase) / P), i);
			const E = t.reach;
			if (hugs(t)) hugWall(c, t);
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
			// Does it land on the title? (lands are in card art px; the drip lives in the blob's scaled space)
			const X = t.cx * SCALE;
			// (it counts once at least half the drop is over the letters — it then hangs on the line's end)
			const half = rb * SCALE * 0.5;
			const land = lands.find((l) => X + half > l.left && X - half < l.right && l.top / SCALE > yb0 + rb);
			const landY = land ? land.top / SCALE : Infinity;
			const hits = !!land;
			// a drop bound for a lower line runs as far as it needs to (it stops on the letters anyway)
			const run = hits ? Math.max(t.run, landY - yb0 + rb) : t.run;
			const fall = run * fallCurve(q);
			const rd = rb * (1 - 0.2 * q); // the drop thins as it leaves sauce behind
			const yd = yb0 + fall;
			// The drop's tail still reaches back to the break when it parts, then snaps up into a short
			// round teardrop (no straight streak left on the card — it read as a hard line beside the rule).
			const snap = ease(Math.min(1, q / 0.16));
			const tailH = Math.max(rd * 1.2, (yd - yP) * (1 - snap) + rd * 1.2 * snap);
			const bottomAt = (qq: number) => yb0 + run * fallCurve(qq) + rb * (1 - 0.2 * qq);
			let qHit = 1;
			if (hits) {
				let lo = 0;
				let hi = 1;
				for (let n = 0; n < 24; n++) {
					const mid = (lo + hi) / 2;
					if (bottomAt(mid) >= landY) hi = mid;
					else lo = mid;
				}
				qHit = hi;
			}
			if (hits && q >= qHit) {
				const rs = rb * (1 - 0.2 * qHit);
				const e = ((q - qHit) * P) / 1000; // seconds since the hit
				falling.push({
					alpha: q > 0.82 ? 1 - (q - 0.82) / 0.18 : 1,
					// drawn as-is (it carries its own outline and shading), not through the mask pass
					paint: splatAt(t.cx, landY, rs, e * 1000, i + Math.floor((now + t.phase) / P) * 3.1),
					glints: [],
				});
			} else {
				const fade = !hits && q > 0.72 ? 1 - (q - 0.72) / 0.28 : 1;
				falling.push({
					alpha: fade,
					draw: (fc) => tear(fc, t.cx, yd, rd, tailH),
					glints: [[t.cx - rd * 0.38, yd - rd * 0.1, rd * 0.17, rd * 0.32]],
				});
			}
			// upper half recoils from the break to the rest pose; its end beads up, then a damped wobble
			const u = ease(Math.min(1, q / 0.28));
			const wob = q > 0.28 ? 2.2 * Math.exp(-(q - 0.28) * 9) * Math.sin((q - 0.28) * 26) : 0;
			const su = MIN_NECK + 0.25 + (0.75 - MIN_NECK) * u;
			// its round end starts just above the break (clear of the drop's tail) and pulls back up
			const yEnd = cy + (yP - r * su - cy) * (1 - u) + Math.max(0, wob);
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
			// (Clipped a hair OUTSIDE the frame: on the exact same outline the frame's anti-aliased dark
			// edge showed through as a thin line around the sauce's curve.)
			const BLEED = 2; // art px (also covers the drip-wrap's 2% sag)
			mc.beginPath();
			mc.roundRect(-BLEED, -BLEED, artW + 2 * BLEED, artH + 2 * BLEED, frameR + BLEED);
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
			// Everything outside the card counts as sauce too, so where the sauce is cut off by the
			// card's edge it gets no rim / inner shadow — it reads as running on over the edge instead of
			// a dark outline along the frame. (Starts 1 px inside the clip so the two anti-aliased edges
			// don't leave a faint seam.)
			ic.setTransform(s, 0, 0, s, 0, 0);
			ic.beginPath();
			ic.rect(-BLEED - 20, -BLEED - 20, artW + 2 * BLEED + 40, artH + 2 * BLEED + 40);
			ic.roundRect(-BLEED + 1, -BLEED + 1, artW + 2 * BLEED - 2, artH + 2 * BLEED - 2, frameR + BLEED - 1);
			ic.fill('evenodd');
			ic.setTransform(1, 0, 0, 1, 0, 0);
			ic.globalCompositeOperation = 'source-over';
			// body: the silhouette in the flat sauce colour
			oc.setTransform(1, 0, 0, 1, 0, 0);
			oc.globalCompositeOperation = 'source-over';
			oc.clearRect(0, 0, W, H);
			oc.drawImage(M, 0, 0);
			oc.globalCompositeOperation = 'source-in';
			oc.fillStyle = shade(0);
			oc.fillRect(0, 0, W, H);
			// Bands inside the silhouette = the inverse mask's shadow, offset, kept inside (source-atop).
			// Hard-edged (no blur), like the logo's layered fills.
			oc.globalCompositeOperation = 'source-atop';
			const inner = (color: string, dx: number, dy: number) => {
				oc.save();
				oc.shadowColor = color;
				oc.shadowBlur = 0;
				oc.shadowOffsetX = dx * s;
				oc.shadowOffsetY = dy * s;
				oc.drawImage(I, 0, 0);
				oc.restore();
			};
			// lit core: tint everything, then put the body colour back in a ring LIGHT_IN wide around it
			oc.fillStyle = shade(0.35, 0.4);
			oc.fillRect(0, 0, W, H);
			for (let n = 0; n < 10; n++) {
				const a = (n / 10) * Math.PI * 2;
				inner(shade(0), LIGHT_NX + LIGHT_IN * Math.cos(a), LIGHT_NY + LIGHT_IN * Math.sin(a));
			}
			// the darker rim: pooled along the lower-right, a thin line elsewhere
			const dark = shade(-0.3);
			inner(dark, -RIM, -RIM * 1.2);
			inner(dark, RIM_THIN, 0);
			inner(dark, -RIM_THIN, 0);
			inner(dark, 0, RIM_THIN);
			inner(dark, 0, -RIM_THIN);
			// gloss
			if (withStreak) {
				oc.setTransform(s, 0, 0, s, 0, 0);
				oc.lineCap = 'round';
				// fades in from the left side, full along the corner, fades out along the top
				const g = oc.createLinearGradient(STREAK_IN, frameR * 1.15, frameR + STREAK_RUN, STREAK_IN);
				g.addColorStop(0, 'rgba(255,255,255,0)');
				g.addColorStop(0.3, 'rgba(255,255,255,0.8)');
				g.addColorStop(0.62, 'rgba(255,255,255,0.8)');
				g.addColorStop(1, 'rgba(255,255,255,0)');
				oc.strokeStyle = g;
				oc.lineWidth = 3;
				oc.stroke(streak);
			}
			artToDevice(oc);
			for (const [x, y, rx, ry, a] of glints) glint(oc, x, y, rx, ry, a);
			// Outline: the same shapes stroked (into I, free by now), clipped to the card like the sauce —
			// so there is none along the card's edge — and slid UNDER the shaded body.
			ic.setTransform(1, 0, 0, 1, 0, 0);
			ic.globalCompositeOperation = 'source-over';
			ic.clearRect(0, 0, W, H);
			artToDevice(ic);
			ic.fillStyle = EDGE;
			ic.strokeStyle = EDGE;
			ic.lineWidth = (2 * OUTLINE) / SCALE;
			ic.lineJoin = 'round';
			outlining = true;
			fill(ic);
			outlining = false;
			ic.setTransform(s, 0, 0, s, 0, 0);
			ic.globalCompositeOperation = 'destination-in';
			ic.beginPath();
			ic.roundRect(-BLEED, -BLEED, artW + 2 * BLEED, artH + 2 * BLEED, frameR + BLEED);
			ic.fill();
			ic.globalCompositeOperation = 'source-over';
			oc.setTransform(1, 0, 0, 1, 0, 0);
			oc.globalCompositeOperation = 'destination-over';
			oc.drawImage(I, 0, 0);
			oc.globalCompositeOperation = 'source-over';
		};

		// The tendrils' glints + detached drops are collected once per frame (on a throwaway context);
		// the fill callback itself then only draws, so it can run for the silhouette AND the outline.
		const scratch = document.createElement('canvas').getContext('2d')!;
		const render = (now: number) => {
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			const glints: Glint[] = [];
			const falling: Falling[] = [];
			spec.tendrils.forEach((t, i) => tendrilShapes(i, t, now, scratch, glints, falling));
			shadeInto(
				(c) => {
					paint(c, blob);
					// The traced outline's own tendril stubs are cut off below their round end's centre (the
					// green one had a squared corner where it ran down the card edge) — tendrilShapes redraws
					// every tendril in full, so its end is always round. (Wide enough to take the stub's
					// outline with it in the outline pass.)
					const op = c.globalCompositeOperation;
					c.globalCompositeOperation = 'destination-out';
					for (const t of spec.tendrils) {
						const pad = 5 + OUTLINE / SCALE;
						const x0 = hugs(t) ? -20 : t.cx - t.w / 2 - pad;
						c.fillRect(x0, t.tip - t.w / 2, t.cx + t.w / 2 + pad - x0, t.w);
					}
					c.globalCompositeOperation = op;
					spec.tendrils.forEach((t, i) => tendrilShapes(i, t, now, c, [], []));
				},
				glints,
				true,
			);
			ctx.drawImage(O, 0, 0);
			for (const f of falling) {
				if (f.alpha <= 0.01) continue;
				if (f.paint) {
					oc.setTransform(1, 0, 0, 1, 0, 0);
					oc.globalCompositeOperation = 'source-over';
					oc.clearRect(0, 0, O.width, O.height);
					artToDevice(oc);
					f.paint(oc);
					oc.setTransform(1, 0, 0, 1, 0, 0);
				} else if (f.draw) shadeInto(f.draw, f.glints, false);
				ctx.globalAlpha = f.alpha;
				ctx.drawImage(O, 0, 0);
				ctx.globalAlpha = 1;
			}
		};

		let raf = 0;
		let measuredAt = -Infinity;
		const loop = (now: number) => {
			raf = requestAnimationFrame(loop);
			if (document.hidden) return;
			if (now - measuredAt > 500 || now < measuredAt) {
				measuredAt = now;
				measureLand();
			}
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
