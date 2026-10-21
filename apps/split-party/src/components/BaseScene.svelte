<script lang="ts">
	import { onMount } from 'svelte';
	import Blob from './Blob.svelte';
	import JellyDome from './JellyDome.svelte';
	import SkyClouds from './SkyClouds.svelte';

	// Base-game backdrop, Figma 11195:8973 (1200×670), cover-scaled behind the stage like the
	// splash sky: the hills, the island seascape twice (11195:9215, and 11195:9216 mirrored),
	// the splash's drifting clouds in place of the frame's static ones, and the jelly domes
	// along the bottom: hidden most of the time, each now and then blows up, sits a few
	// seconds and bursts, like the splash's but rarer.
	// Layers come from scripts/build-base-scene.py (the frame's 2px blur is baked in).
	const SKY = { w: 1200, h: 670 };
	let vw = $state(1200);
	let vh = $state(670);
	// 4% overscan, so the cover never shows an edge.
	let scale = $derived(Math.max(vw / SKY.w, vh / SKY.h) * 1.04);

	// The frame's clouds: a big near one up top, small far ones in the middle band.
	const CLOUD_LANES: { far: boolean; y: [number, number] }[] = [
		{ far: false, y: [36, 60] },
		{ far: true, y: [92, 110] },
		{ far: false, y: [160, 185] },
	];
	// A phone sees only a ~300px-wide middle slice of the scene, where the lanes above rarely
	// pass: portrait gets its own clouds drifting across just that slice, smaller and denser,
	// in the sky above the board.
	let portrait = $derived(vh > vw);
	let slice = $derived({ w: vw / scale, h: vh / scale });
	const PHONE_LANES: { far: boolean; y: [number, number] }[] = [
		{ far: false, y: [0, 14] },
		{ far: true, y: [44, 58] },
		{ far: false, y: [82, 100] },
		{ far: true, y: [124, 140] },
	];
	const PHONE_NEAR = { src: './splash/cloud-puff.webp', w: [60, 80] as [number, number], alpha: [0.9, 0.9] as [number, number] };
	const PHONE_FAR = { src: './splash/cloud-puff-far.webp', w: [34, 46] as [number, number], alpha: [0.7, 0.8] as [number, number] };

	// Figma dome boxes [x, y, size]; the webps keep CROP of the square (x 6–94%, y 30–70%), and
	// each dome's foot is at 95.5% of that crop's height.
	const DOMES = (
		[
			['magenta', 30, 588, 82],
			['magenta', 292, 617, 90],
			['magenta', 1118, 560, 82],
			['green', 36, 551, 201],
			['purple', -72, 568, 168],
			['purple', 905, 568, 168],
			// Not in the frame: smaller ones on the strips of grass either side of the board
			// (y ~495–550, between the seascape and the HUD), feet at y 516–536.
			['purple', 60, 491, 66],
			['magenta', 150, 479, 54],
			['green', 205, 494, 62],
			['green', 955, 485, 70],
			['magenta', 1058, 480, 56],
			['purple', 1118, 492, 64],
		] as const
	).map(dome);
	// Portrait sees none of those: its own domes, placed as [colour, x, foot y] fractions of the
	// visible slice and a size in scene px, sit on the grass between the HUD bar and the
	// balance row and along the bottom edge, and pop more often so a phone player sees them.
	// Feet never go above GRASS_Y (the seascape's water ends just above it).
	const GRASS_Y = 505;
	const PHONE_DOMES = [
		['purple', 0.13, 0.868, 62],
		['magenta', 0.36, 0.865, 50],
		['green', 0.66, 0.868, 58],
		['magenta', 0.89, 0.865, 52],
		['green', 0.08, 0.995, 64],
		['purple', 0.5, 1.0, 72],
		['magenta', 0.88, 0.995, 58],
	] as const;
	let phoneDomes = $derived(
		PHONE_DOMES.map(([c, fx, fy, s]) =>
			dome([
				c,
				(SKY.w - slice.w) / 2 + fx * slice.w - s / 2,
				Math.max(GRASS_Y, (SKY.h - slice.h) / 2 + fy * slice.h) - 0.3 * s - 0.4 * s * 0.955,
				s,
			]),
		),
	);
	function dome([c, x, y, s]: readonly ['magenta' | 'green' | 'purple', number, number, number]) {
		return {
			// Under 120px the big dome's baked blur would shrink to nothing: use the small copy.
			src: `./base/crisp/dome-${c}${s < 120 ? '-small' : ''}.webp`,
			color: { magenta: '#ea32df', green: '#5bed7c', purple: '#b241fb' }[c],
			x: x + 0.06 * s,
			y: y + 0.3 * s,
			w: 0.88 * s,
			h: 0.4 * s,
		};
	}

	// Light on the seascape's water (its band is y 76–94% of the image): glints that swell and
	// drift, kept inside the band and off the island on the right (no mask: placed instead).
	const GLINTS = Array.from({ length: 16 }, (_, i) => {
		const h = Math.imul(i + 1, 2654435761) >>> 0;
		const x = 8 + ((h % 1000) / 1000) * 80;
		const y = (x > 56 ? 85 : 80) + (((h >>> 10) % 100) / 100) * (x > 56 ? 6 : 11);
		return {
			x,
			y,
			w: 3 + ((h >>> 17) % 5),
			dur: 3.2 + ((h >>> 5) % 9) * 0.25,
			delay: -(((h >>> 13) % 40) / 10),
		};
	});

	// Now and then a blob peeks out of an island: on the right island one or two step out
	// sideways from behind the bush cluster (never over its top), on the left one slides in
	// from the screen's left edge behind the slope. They sit in the seascape's own % space, between seascape.webp and its island
	// cut-out (seascape-front.webp), so the island hides their lower half. The left island is
	// the mirrored seascape (its outer half is off-screen), so its spot is on the right of the
	// art and +dx slides toward the screen's left.
	// x/top place the hidden blob (% of the seascape); dx is where it starts and px/py where it
	// peeks to, both % of its own box.
	type Spot = { x: number; top: number; dx: number; px: number; py: number; lean: number };
	type Peek = Spot & { id: number; island: 'left' | 'right'; symbol: string; delay: number };
	const PEEK_MS = 4200;
	const PEEKERS = ['WATERMELON', 'CHERRIES', 'GRAPES', 'STRAWBERRY', 'BLUEBERRY', 'KIWI', 'LEMON'];
	const rand = (a: number, b: number) => a + Math.random() * (b - a);
	const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
	let peeks = $state<Peek[]>([]);
	let peekId = 0;
	onMount(() => {
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const timers = new Set<ReturnType<typeof setTimeout>>();
		const later = (ms: number, fn: () => void) => {
			const t = setTimeout(() => (timers.delete(t), fn()), ms);
			timers.add(t);
		};
		const peek = () => {
			const island = Math.random() < 0.5 ? 'left' : 'right';
			// Bushes span x 76–86% with their top at y 46.5%; the grass beside them is at y ~50%
			// on the left and drops to ~55% on the right, so the right-hand spot sits lower.
			const bushLeft: Spot = { x: 78.4, top: 46, dx: 0, px: -125, py: 0, lean: -9 };
			const bushRight: Spot = { x: 82.2, top: 49.5, dx: 0, px: 120, py: 0, lean: 9 };
			const spots: Spot[] =
				island === 'right'
					? Math.random() < 0.35
						? [bushLeft, bushRight]
						: [Math.random() < 0.5 ? bushLeft : bushRight]
					: // Behind the slope where it meets the screen edge (top y 56–60%), leaning in.
						[{ x: 67, top: 58.8, dx: 100, px: 0, py: -84, lean: -12 }];
			const fresh = spots.map((s, i) => ({
				id: peekId++,
				island,
				symbol: pick(PEEKERS),
				...s,
				delay: i * rand(250, 700),
			})) as Peek[];
			peeks = [...peeks, ...fresh];
			// By id: the items in `peeks` are $state proxies, not the objects pushed.
			const ids = fresh.map((p) => p.id);
			later(PEEK_MS + 800, () => (peeks = peeks.filter((p) => !ids.includes(p.id))));
			later(rand(10000, 28000), peek);
		};
		later(rand(4000, 12000), peek);
		return () => timers.forEach(clearTimeout);
	});
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} />

<!-- The wrap is what the splash → base fly-in scales; its gradient (the hills' own sky and
	grass) fills round the scene while it is still small. -->
<div class="base-world" aria-hidden="true">
<div
	class="base-scene"
	style={`width:${SKY.w}px;height:${SKY.h}px;transform:translate(-50%,-50%) scale(${scale})`}
>
	<img class="hills" src="./base/crisp/hills.webp" alt="" />
	{#each portrait ? [] : DOMES as d}
		<JellyDome
			src={d.src}
			x={d.x}
			y={d.y}
			w={d.w}
			h={d.h}
			ox={d.w / 2}
			oy={d.h * 0.955}
			color={d.color}
			first={[4000, 25000]}
			rest={[2500, 6000]}
			wait={[20000, 50000]}
		/>
	{/each}
	{#if portrait}
		{#each phoneDomes as d, i (i)}
			<JellyDome
				src={d.src}
				x={d.x}
				y={d.y}
				w={d.w}
				h={d.h}
				ox={d.w / 2}
				oy={d.h * 0.955}
				color={d.color}
				first={[1500, 9000]}
				rest={[2500, 6000]}
				wait={[6000, 18000]}
			/>
		{/each}
		<div
			class="phone-sky"
			style={`left:${((SKY.w - slice.w) / 2).toFixed(1)}px;top:${((SKY.h - slice.h) / 2).toFixed(1)}px;width:${slice.w.toFixed(1)}px`}
		>
			<SkyClouds lanes={PHONE_LANES} width={slice.w} near={PHONE_NEAR} far={PHONE_FAR} />
		</div>
	{:else}
		<SkyClouds lanes={CLOUD_LANES} width={SKY.w} />
	{/if}
	{#each [{ x: 496, y: 183, w: 772, h: 309, flip: false }, { x: -187, y: 178, w: 795.2, h: 318, flip: true }] as s}
		<div class="seascape" class:flip={s.flip} style={`left:${s.x}px;top:${s.y}px;width:${s.w}px;height:${s.h}px`}>
			<img src="./base/crisp/seascape.webp" alt="" />
			{#each peeks.filter((p) => (p.island === 'left') === s.flip) as p (p.id)}
				<span
					class="peek"
					style={`left:${p.x}%;top:${p.top}%;--dx:${p.dx}%;--px:${p.px}%;--py:${p.py}%;--lean:${p.lean}deg;animation-duration:${PEEK_MS}ms;animation-delay:${p.delay.toFixed(0)}ms`}
					><Blob symbol={p.symbol} uid={`peek-${p.id}`} /></span
				>
			{/each}
			<img class="front" src="./base/crisp/seascape-front.webp" alt="" />
			{#each GLINTS as g}
				<span
					class="glint"
					style={`left:${g.x.toFixed(1)}%;top:${g.y.toFixed(1)}%;width:${g.w}%;animation-duration:${g.dur.toFixed(2)}s;animation-delay:${g.delay.toFixed(2)}s`}
				></span>
			{/each}
		</div>
	{/each}
</div>
</div>

<style>
	/* 20% bigger than the screen on every side. During the fly-in (App adds .flying) it is
	   feathered in that hidden margin, so while it's small its edge melts into the splash
	   instead of showing a box; the mask is off otherwise, since a mask costs a GPU pass every
	   frame anything inside animates. */
	.base-world {
		position: fixed;
		inset: -20vh -20vw;
		overflow: hidden;
		pointer-events: none;
		background: linear-gradient(#2ca4fe, #54c4fc 30%, #8ce4fc 58%, #a8f24e 64%, #5ad756 90%, #28bd72);
	}
	.base-world:global(.flying) {
		mask:
			linear-gradient(90deg, #0000, #000 13%, #000 87%, #0000),
			linear-gradient(#0000, #000 13%, #000 87%, #0000);
		mask-composite: intersect;
	}
	.base-scene {
		position: absolute;
		left: 50%;
		top: 50%;
		overflow: hidden;
		pointer-events: none;
	}
	.hills {
		position: absolute;
		left: -2px;
		top: -3px;
		width: 1204px;
		height: 674px;
	}
	.phone-sky {
		position: absolute;
		height: 0;
	}
	.seascape {
		position: absolute;
	}
	.seascape.flip {
		transform: scaleX(-1);
	}
	.seascape img {
		display: block;
		width: 100%;
		height: 100%;
	}
	.seascape img.front {
		position: absolute;
		left: 50%;
		top: 0;
		width: 50%;
	}
	/* Far away, so about one bush bump wide (3.2% of the seascape, 8% of its height), and as
	   soft as the painting around it. */
	.peek {
		position: absolute;
		width: 3.2%;
		aspect-ratio: 1;
		filter: blur(0.6px);
		transform-origin: 50% 90%;
		animation: peek ease-in-out both;
	}
	/* Pops out to the eyes with a little stretch, glances about, then ducks back. */
	@keyframes peek {
		0%,
		100% {
			transform: translateX(var(--dx));
		}
		14% {
			transform: translate(calc(var(--px) * 1.08), calc(var(--py) * 1.08)) scale(0.96, 1.06)
				rotate(calc(var(--lean) * 0.5));
		}
		22%,
		38% {
			transform: translate(var(--px), var(--py)) rotate(var(--lean));
		}
		52%,
		66% {
			transform: translate(var(--px), var(--py)) rotate(calc(var(--lean) * 0.3));
		}
		80% {
			transform: translate(calc(var(--px) * 1.02), calc(var(--py) * 1.02)) rotate(var(--lean));
		}
		92% {
			transform: translate(calc(var(--dx) * 0.5 + var(--px) * 0.1), 4%);
		}
	}
	.glint {
		position: absolute;
		height: 5px;
		/* Soft-edged, to sit in the same soft focus as the painting. */
		background: radial-gradient(closest-side, #fff, #fff8 55%, #fff0);
		opacity: 0;
		animation: glint 4s ease-in-out infinite;
	}
	@keyframes glint {
		0%,
		100% {
			opacity: 0;
			transform: translateX(-10px) scaleX(0.4);
		}
		45% {
			opacity: 0.8;
			transform: translateX(3px) scaleX(1);
		}
		70% {
			opacity: 0.45;
			transform: translateX(10px) scaleX(0.8);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.glint {
			animation: none;
			opacity: 0.4;
		}
	}
</style>
