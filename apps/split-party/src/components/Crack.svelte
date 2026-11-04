<script lang="ts" module>
	let nextId = 0;
</script>

<script lang="ts">
	// The ground splitting under a dividing blob, drawn live: tapered fissures (a dark rim
	// sinking into the gap, a hot pink seam glowing inside it, a lit lip along one edge and a
	// shadowed one along the other) tear outward from where the new
	// blobs meet, chips of the pad jump out as it breaks, and the seam keeps a slow glow after.
	// The tear runs in step with Blob.svelte's division beat (--divide-ms). Coordinates are
	// Blob.svelte's 0–100 blob space, so every crack runs between two of the layout's blobs;
	// branches run past the cell, which clips them.
	import { crackPlan, prefix, sliver, type Pt } from '../board/crackGeom';

	let { units, seed = 1 }: { units: number; seed?: number } = $props();
	const id = `crack-${nextId++}`;

	// The geometry is the Pixi board's (board/crackGeom.ts), so both renderers crack a tile alike.
	type Tear = { path: string; rim: string; gap: string; seam: string; lip: string; dark: string; s: number; t: number; w: number };
	const f = (n: number) => n.toFixed(2);
	const line = (pts: Pt[]) => 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L');
	const shape = (flat: number[]) => {
		let d = '';
		for (let i = 0; i < flat.length; i += 2) d += `${i ? 'L' : 'M'}${f(flat[i])} ${f(flat[i + 1])}`;
		return d + 'Z';
	};
	let crack = $derived.by(() => {
		const plan = crackPlan(units, seed);
		const tears: Tear[] = plan.tears.map(({ pts, closed, s, t, w }) => {
			const { at } = prefix(pts, 1);
			const end = closed ? w : w * 0.12;
			const taper = (a: number, b: number, shift = 0) => shape(sliver(pts, at, w * a, end * b, shift));
			return {
				path: line(pts) + (closed ? 'Z' : ''),
				rim: taper(1.7, 1.6),
				gap: taper(1, 1),
				seam: taper(0.5, 0.45),
				lip: taper(0.16, 0.25, -w * 0.6),
				dark: taper(0.16, 0.25, w * 0.6),
				s,
				t,
				w,
			};
		});
		return { tears, chips: plan.chips, junctions: plan.junctions };
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
			{#each crack.tears as c}<path class="rim" d={c.rim} />{/each}
			{#each crack.tears as c}<path class="gap" d={c.gap} />{/each}
			{#each crack.tears as c}<path class="lip" d={c.lip} />{/each}
			{#each crack.tears as c}<path class="dark-lip" d={c.dark} />{/each}
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
	/* Once the blobs have parted the crack settles into a scar (BoardView's settle: 0.7 since
	   2026-11-04, was 0.35): a board full of split tiles would otherwise be 49 glowing tears
	   around up to six blobs each. */
	.crack:not(.fx) {
		animation: crack-settle 900ms ease-out calc(var(--divide-ms, 900ms) * 2) both;
	}
	@keyframes crack-settle {
		to {
			opacity: 0.7;
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
	/* The pad sinking into the gap. */
	.rim {
		fill: #0b0418;
		opacity: 0.38;
	}
	/* Light catching the broken edge on one side, shadow on the other. */
	.lip {
		fill: #c3b0ff;
		opacity: 0.7;
	}
	.dark-lip {
		fill: #05020c;
		opacity: 0.6;
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
