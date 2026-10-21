<script lang="ts" module>
	let nextId = 0;
</script>

<script lang="ts">
	// The ground splitting under a dividing blob, drawn live: tapered fissures (dark gap, a
	// hot pink seam glowing inside it, a lit lip along one edge) tear outward from where the new
	// blobs meet, chips of the pad jump out as it breaks, and the seam keeps a slow glow after.
	// The tear runs in step with Blob.svelte's division beat (--divide-ms). Coordinates are
	// Blob.svelte's 0–100 blob space, so every crack runs between two of the layout's blobs;
	// branches run past the cell, which clips them.
	let { units, seed = 1 }: { units: number; seed?: number } = $props();
	const id = `crack-${nextId++}`;

	type Pt = [number, number];
	// [from, to, start, duration, base width]: start/duration are fractions of the beat.
	type Branch = [Pt, Pt, number, number, number];
	// The tear starts once the blob has swollen (30% of the beat) and runs while it pinches apart.
	const out = (from: Pt, to: Pt, delay = 0, w = 4.8): Branch => [from, to, 0.3 + delay, 0.32, w];
	// Junctions are where the blobs' territories meet (equidistant from their centres).
	const RING: Pt = [50, 50];
	const RING_R = 22;
	const PLANS: Record<number, Branch[]> = {
		2: [out([50, 50], [50, -8]), out([50, 50], [50, 108])],
		// Top blob over a bottom pair: arms out under the top blob, stem down between the pair.
		3: [out([50, 48], [50, 108]), out([50, 48], [-14, 48]), out([50, 48], [114, 48])],
		4: [out([50, 49], [50, -8]), out([50, 49], [50, 108]), out([50, 49], [-14, 49]), out([50, 49], [114, 49])],
		// Four corner blobs round a centre one: the ring opens round the centre first, then
		// straight spokes tear off it between the corners (up, down, left, right).
		5: ([[0, -1], [0, 1], [-1, 0], [1, 0]] as Pt[]).map(([sx, sy]) =>
			out([RING[0] + sx * RING_R, RING[1] + sy * RING_R], [RING[0] + sx * 64, RING[1] + sy * 58], 0.08, 3.8),
		),
		6: [
			out([29, 50], [71, 50], 0, 3.8),
			out([29, 50], [-14, 50], 0, 3.8),
			out([71, 50], [114, 50], 0, 3.8),
			out([29, 50], [29, -8], 0, 3.8),
			out([29, 50], [29, 108], 0, 3.8),
			out([71, 50], [71, -8], 0, 3.8),
			out([71, 50], [71, 108], 0, 3.8),
		],
	};

	// mulberry32: the same cell always cracks the same way, neighbours differently.
	function rng(s: number) {
		return () => {
			s = (s + 0x6d2b79f5) | 0;
			let t = Math.imul(s ^ (s >>> 15), 1 | s);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}
	const f = (n: number) => n.toFixed(2);
	// Zig-zag centreline: every ~6 units step sideways, mostly alternating sides.
	function jag(a: Pt, b: Pt, rand: () => number, amp = 3): Pt[] {
		const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
		const len = Math.hypot(dx, dy);
		const [nx, ny] = [-dy / len, dx / len];
		const n = Math.max(3, Math.round(len / 6));
		const pts: Pt[] = [a];
		let side = rand() < 0.5 ? -1 : 1;
		for (let i = 1; i < n; i++) {
			if (rand() < 0.75) side = -side;
			const o = side * amp * (0.3 + rand() * 0.7);
			const t = (i + (rand() - 0.5) * 0.5) / n;
			pts.push([a[0] + dx * t + nx * o, a[1] + dy * t + ny * o]);
		}
		pts.push(b);
		return pts;
	}
	// A crack is a sliver: full width where it starts, a hairline at the tip.
	function sliver(pts: Pt[], w0: number, w1: number, shift = 0): string {
		const left: Pt[] = [];
		const right: Pt[] = [];
		pts.forEach((p, i) => {
			const a = pts[Math.max(0, i - 1)];
			const b = pts[Math.min(pts.length - 1, i + 1)];
			const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
			const [nx, ny] = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
			const w = (w0 + (w1 - w0) * (i / (pts.length - 1))) / 2;
			const c = [p[0] + nx * shift, p[1] + ny * shift];
			left.push([c[0] + nx * w, c[1] + ny * w]);
			right.push([c[0] - nx * w, c[1] - ny * w]);
		});
		return 'M' + [...left, ...right.reverse()].map(([x, y]) => `${f(x)} ${f(y)}`).join('L') + 'Z';
	}
	// Where the tear starts: energy gathers here first, then bursts as it breaks.
	const JUNCTIONS: Record<number, Pt[]> = {
		2: [[50, 50]],
		3: [[50, 48]],
		4: [[50, 49]],
		5: [RING],
		6: [
			[29, 50],
			[71, 50],
		],
	};
	const line = (pts: Pt[]) => 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L');

	type Tear = { path: string; gap: string; seam: string; lip: string; s: number; t: number; w: number };
	type Chip = { x: number; y: number; dx: number; dy: number; r: number; size: number; d: number; light: boolean };
	let crack = $derived.by(() => {
		const rand = rng(seed * 2654435761 + units);
		const tears: Tear[] = [];
		const chips: Chip[] = [];
		const add = (pts: Pt[], s: number, t: number, w: number, closed = false) => {
			const end = closed ? w : w * 0.12;
			tears.push({
				path: line(pts) + (closed ? 'Z' : ''),
				gap: sliver(pts, w, end),
				seam: sliver(pts, w * 0.5, end * 0.45),
				lip: sliver(pts, w * 0.16, end * 0.25, -w * 0.6),
				s,
				t,
				w,
			});
		};
		if (units === 5) {
			const pts: Pt[] = [];
			for (let i = 0; i <= 18; i++) {
				const a = (i / 18) * Math.PI * 2 - Math.PI / 2;
				const r = i % 18 === 0 ? RING_R : RING_R + (rand() - 0.5) * 3.5;
				pts.push([RING[0] + Math.cos(a) * r, RING[1] + Math.sin(a) * r]);
			}
			add(pts, 0.28, 0.2, 3.4, true);
		}
		for (const [a, b, s, t, w] of PLANS[Math.min(units, 6)] ?? []) {
			const pts = jag(a, b, rand);
			add(pts, s, t, w);
			// A side twig off the branch, tearing as the main crack passes it.
			const k = 1 + Math.floor(rand() * (pts.length - 2));
			const [px, py] = pts[k];
			const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + (rand() < 0.5 ? -1 : 1) * (0.5 + rand() * 0.45);
			const len = 6 + rand() * 7;
			const twig = jag([px, py], [px + Math.cos(ang) * len, py + Math.sin(ang) * len], rand, 1.3);
			add(twig, s + (t * k) / (pts.length - 1), 0.1, w * 0.55);
			// Chips break off near the junction and jump out sideways as the tear passes.
			for (let c = 0; c < 2; c++) {
				const i = 1 + Math.floor(rand() * Math.min(4, pts.length - 2));
				const [x, y] = pts[i];
				const dir = Math.atan2(b[1] - a[1], b[0] - a[0]) + (rand() < 0.5 ? -1 : 1) * Math.PI * (0.35 + rand() * 0.3);
				const dist = 7 + rand() * 9;
				chips.push({
					x,
					y,
					dx: Math.cos(dir) * dist,
					dy: Math.sin(dir) * dist,
					r: (rand() - 0.5) * 540,
					size: 1.2 + rand() * 1.6,
					d: s + (t * i) / (pts.length - 1),
					light: rand() < 0.5,
				});
			}
		}
		return { tears, chips, junctions: JUNCTIONS[Math.min(units, 6)] ?? [] };
	});
</script>

<span class="crack" aria-hidden="true">
	<svg viewBox="0 0 100 100">
		<defs>
			<!-- The tear itself: a fat stroke along each centreline that draws outward. -->
			<mask id={`${id}-tear`} maskUnits="userSpaceOnUse" x="-30" y="-30" width="160" height="160">
				{#each crack.tears as c}
					<path
						class="reveal"
						d={c.path}
						pathLength="1"
						stroke-width={c.w * 3 + 4}
						style={`--s:${c.s.toFixed(3)};--t:${c.t.toFixed(3)}`}
					/>
				{/each}
			</mask>
		</defs>
		<g class="tear" mask={`url(#${id}-tear)`}>
			{#each crack.tears as c}<path class="halo" d={c.path} stroke-width={c.w * 2.4} />{/each}
			{#each crack.tears as c}<path class="gap" d={c.gap} />{/each}
			{#each crack.tears as c}<path class="lip" d={c.lip} />{/each}
			<g class="seam">
				{#each crack.tears as c}<path d={c.seam} />{/each}
			</g>
			<g class="seam-hot">
				{#each crack.tears as c}<path d={c.seam} />{/each}
			</g>
		</g>
		{#each crack.chips as p}
			<rect
				class="chip"
				class:light={p.light}
				x={p.x - p.size / 2}
				y={p.y - p.size / 2}
				width={p.size}
				height={p.size * 0.75}
				rx=".3"
				style={`--dx:${p.dx.toFixed(1)}px;--dy:${p.dy.toFixed(1)}px;--r:${p.r.toFixed(0)}deg;--d:${p.d.toFixed(3)}`}
			/>
		{/each}
	</svg>
</span>
<!-- In front of the blobs: the swollen blob hides the junction, so the energy gathering where
     it will pinch and the shockwave of the break play over it. -->
<span class="crack fx" aria-hidden="true">
	<svg viewBox="0 0 100 100">
		<defs>
			<radialGradient id={`${id}-charge`}>
				<stop offset="0" stop-color="#fff" />
				<stop offset=".35" stop-color="#ff8af2" stop-opacity=".9" />
				<stop offset="1" stop-color="#f782fe" stop-opacity="0" />
			</radialGradient>
		</defs>
		{#each crack.junctions as [x, y]}
			<circle class="charge" cx={x} cy={y} r="9" fill={`url(#${id}-charge)`} />
			<circle class="burst" cx={x} cy={y} r="5" />
		{/each}
	</svg>
</span>

<style>
	/* The cell's own box (cells clip at their rounded corners even when lit). */
	.crack {
		position: absolute;
		inset: 0;
		z-index: 0;
		overflow: hidden;
		border-radius: 8px;
		pointer-events: none;
	}
	.crack.fx {
		z-index: 2;
	}
	/* Once the blobs have parted the crack settles into a faint scar: a board full of split
	   tiles would otherwise be 49 glowing tears around up to six blobs each. */
	.crack:not(.fx) {
		animation: crack-settle 900ms ease-out calc(var(--divide-ms, 900ms) * 2) both;
	}
	@keyframes crack-settle {
		to {
			opacity: 0.35;
		}
	}
	/* Laid over the cell exactly like the blob art (74.08px, centred), so the coordinates match. */
	svg {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 74.08px;
		height: 74.08px;
		translate: -50% -50%;
		overflow: visible;
	}
	.reveal {
		fill: none;
		stroke: #fff;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-dasharray: 1 1;
		animation: tear calc(var(--divide-ms, 900ms) * var(--t)) cubic-bezier(0.2, 0.6, 0.35, 1)
			calc(var(--divide-ms, 900ms) * var(--s)) both;
	}
	@keyframes tear {
		from {
			stroke-dashoffset: 1;
		}
		to {
			stroke-dashoffset: 0;
		}
	}
	/* Heat bleeding out of the gap onto the pad. */
	.halo {
		fill: none;
		stroke: #f782fe;
		stroke-opacity: 0.3;
		stroke-linejoin: round;
		stroke-linecap: round;
		animation: halo-pulse 2.6s ease-in-out var(--divide-ms, 900ms) 2;
	}
	/* The seam's slow afterglow: only the halo's opacity moves (no filter), so a cracked
	   board stays cheap to draw. */
	@keyframes halo-pulse {
		50% {
			stroke-opacity: 0.55;
		}
	}
	/* The gap: deep shadow. */
	.gap {
		fill: #12061f;
	}
	/* Light catching the broken edge on one side. */
	.lip {
		fill: #c3b0ff;
		opacity: 0.55;
	}
	/* Hot seam down the middle: white-hot as it tears, cooling to pink. The white copy (its glow
	   a soft wide stroke) fades off the pink one: opacity only, where the seam used to animate
	   fill and a drop-shadow filter every frame. */
	.seam {
		fill: #ff6ef0;
	}
	.seam-hot {
		fill: #fff;
		stroke: #fff;
		stroke-width: 1.6;
		stroke-opacity: 0.35;
		stroke-linejoin: round;
		opacity: 0;
		animation: seam-flash var(--divide-ms, 900ms) ease-out both;
	}
	@keyframes seam-flash {
		0%,
		32% {
			opacity: 1;
		}
		70% {
			opacity: 0.4;
		}
		100% {
			opacity: 0;
		}
	}
	/* Before it breaks: a hot spot gathers and flickers where the tear will start (while the
	   blob swells), then is spent in the burst. */
	.charge {
		transform-box: fill-box;
		transform-origin: center;
		opacity: 0;
		animation: charge var(--divide-ms, 900ms) linear both;
	}
	@keyframes charge {
		0%,
		6% {
			opacity: 0;
			transform: scale(0.2);
		}
		18% {
			opacity: 0.7;
			transform: scale(0.7);
		}
		22% {
			opacity: 0.45;
			transform: scale(0.75);
		}
		27% {
			opacity: 1;
			transform: scale(1.05);
		}
		31% {
			opacity: 1;
			transform: scale(1.5);
		}
		42%,
		100% {
			opacity: 0;
			transform: scale(0.6);
		}
	}
	/* The break: a white shockwave ring rolls out across the cell. */
	.burst {
		fill: none;
		stroke: #fff;
		stroke-width: 2.4;
		transform-box: fill-box;
		transform-origin: center;
		opacity: 0;
		animation: burst var(--divide-ms, 900ms) cubic-bezier(0.2, 0.7, 0.4, 1) both;
	}
	@keyframes burst {
		0%,
		29% {
			opacity: 0;
			transform: scale(0.3);
		}
		31% {
			opacity: 1;
			stroke-width: 2.4;
			transform: scale(0.6);
		}
		58%,
		100% {
			opacity: 0;
			stroke-width: 0.4;
			transform: scale(7);
		}
	}
	/* Chips of the pad pop out as the tear passes, tumble and land. */
	.chip {
		fill: #3a2a6e;
		transform-box: fill-box;
		transform-origin: center;
		opacity: 0;
		animation: chip calc(var(--divide-ms, 900ms) * 0.42) cubic-bezier(0.25, 0.6, 0.5, 1)
			calc(var(--divide-ms, 900ms) * var(--d)) both;
	}
	.chip.light {
		fill: #8f78e0;
	}
	@keyframes chip {
		0% {
			opacity: 1;
			translate: 0 0;
			rotate: 0deg;
		}
		55% {
			opacity: 1;
			translate: calc(var(--dx) * 0.7) calc(var(--dy) * 0.7 - 5px);
		}
		100% {
			opacity: 0;
			translate: var(--dx) calc(var(--dy) + 2px);
			rotate: var(--r);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.reveal,
		.seam-hot,
		.halo,
		.charge,
		.burst,
		.chip {
			animation: none;
		}
		.chip,
		.charge,
		.burst {
			display: none;
		}
	}
</style>
