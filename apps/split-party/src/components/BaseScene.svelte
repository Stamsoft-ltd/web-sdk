<script lang="ts">
	import { onMount } from 'svelte';
	import Blob from './Blob.svelte';
	import JellyDome from './JellyDome.svelte';
	import LiveSea from './LiveSea.svelte';
	import SkyClouds from './SkyClouds.svelte';

	// Base-game backdrop, Figma 11195:8973 (1200×670), cover-scaled behind the stage like the
	// splash sky: the hills, the split seascape of 11362:70545 (water, far hills, the smoking
	// volcano and its dome hill, the right island) with its sailboat,
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
	// visible slice and a size in scene px, sit on the grass between the board and the HUD
	// strip (as SceneView's PHONE_DOMES), and pop more often so a phone player sees them.
	// Feet never go above GRASS_Y (the seascape's water ends just above it).
	const GRASS_Y = 505;
	const PHONE_DOMES = [
		['purple', 0.12, 0.78, 62],
		['magenta', 0.3, 0.775, 46],
		['green', 0.7, 0.78, 52],
		['magenta', 0.89, 0.775, 54],
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
			src: `./base/hd/dome-${c}${s < 120 ? '-small' : ''}.webp`,
			color: { magenta: '#ea32df', green: '#5bed7c', purple: '#b241fb' }[c],
			x: x + 0.06 * s,
			y: y + 0.3 * s,
			w: 0.88 * s,
			h: 0.4 * s,
		};
	}

	// Light on the water band (11358:69611's open water, y ~380–480 in the frame): glints that
	// swell and drift. Same placements as SceneView's.
	const GLINTS = Array.from({ length: 22 }, (_, i) => {
		const h = Math.imul(i + 1, 2654435761) >>> 0;
		const x = 2 + ((h % 1000) / 1000) * 92;
		const y = 384 + (((h >>> 10) % 100) / 100) * 88;
		const near = (y - 384) / 88;
		return {
			x,
			y,
			w: (3 + ((h >>> 17) % 5)) * (0.7 + 0.6 * near),
			dur: 3.2 + ((h >>> 5) % 9) * 0.25,
			delay: -(((h >>> 13) % 40) / 10),
		};
	});

	// 11362:70732, the island on the right. Now and then a blob peeks up over its ridge, between
	// the water and the island, so the island hides its lower half. x is the blob's centre and
	// top its hidden box's top, % of the island; px/py the peek's offset, % of the blob. The
	// second sneaks out diagonally from behind the left bush (SceneView's ISLAND_SPOTS).
	const ISLAND = { x: 900, y: 268, w: 362, h: 181 };
	const SPOTS = [
		{ x: 47, top: 36, px: 0, py: -61, lean: -6 },
		{ x: 30, top: 44, px: 85, py: -95, lean: 16 },
	];
	const PEEK_SIZE = 26;
	type Peek = (typeof SPOTS)[number] & { id: number; symbol: string; delay: number };
	const PEEK_MS = 4200;
	const PEEKERS = ['WATERMELON', 'CHERRIES', 'GRAPES', 'STRAWBERRY', 'BLUEBERRY', 'KIWI', 'LEMON'];
	const rand = (a: number, b: number) => a + Math.random() * (b - a);
	const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
	let peeks = $state<Peek[]>([]);
	let peekId = 0;
	// 11358:69762, the sailboat: crosses the water from a random side, bow first, behind the
	// island, mama and the board; rests off-screen between trips.
	// Smoke from the volcano's crater (~(1086, 179)): SceneView's Smoke, as evenly staggered
	// CSS puffs on one 10s cycle.
	const SMOKE_MS = 10000;
	const SMOKE_N = 10;
	// The live sea (SceneView's, without the reflection): LiveSea's water in the cleared water's
	// colours (water-clear.webp, sampled at x 1000) and its swells, from the horizon (374) to the
	// grass (484).
	const SEA_STOPS: [number, string][] = [
		[374, '#0a8fc4'],
		[380, '#009bcf'],
		[388, '#01ccff'],
		[398, '#00beff'],
		[438, '#00c6fe'],
		[458, '#00d6ff'],
		[468, '#05e4fd'],
		[480, '#19f3ff'],
	];
	let boat = $state<{ id: number; right: boolean; ms: number } | null>(null);
	let boatId = 0;
	onMount(() => {
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const timers = new Set<ReturnType<typeof setTimeout>>();
		const later = (ms: number, fn: () => void) => {
			const t = setTimeout(() => (timers.delete(t), fn()), ms);
			timers.add(t);
		};
		const peek = () => {
			const spots = Math.random() < 0.35 ? SPOTS : [pick(SPOTS)];
			const fresh = spots.map((s, i) => ({ id: peekId++, symbol: pick(PEEKERS), ...s, delay: i * rand(250, 700) }));
			peeks = [...peeks, ...fresh];
			// By id: the items in `peeks` are $state proxies, not the objects pushed.
			const ids = fresh.map((p) => p.id);
			later(PEEK_MS + 800, () => (peeks = peeks.filter((p) => !ids.includes(p.id))));
			later(rand(10000, 28000), peek);
		};
		later(rand(4000, 12000), peek);
		const sail = () => {
			const ms = rand(55000, 70000);
			boat = { id: boatId++, right: Math.random() < 0.5, ms };
			later(ms, () => ((boat = null), later(rand(4000, 10000), sail)));
		};
		later(rand(600, 2000), sail);
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
	<img class="hills" src="./base/hd/hills.webp" alt="" />
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
			avoid=".base-mama"
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
	<LiveSea w={SKY.w} y0={370} y1={486} horizon={374} top={[374, 374]} shore={[484, 484]} stops={SEA_STOPS} scale={scale} />
	<img class="layer" src="./base/hd/far-hills.webp" alt="" style="left:0;top:68px;width:1011px;height:400px" />
	<img class="layer" src="./base/hd/volcano.webp" alt="" style="left:912px;top:92px;width:329px;height:329px" />
	<!-- The lava (gloss baked on) over the bare rock, only ever running downhill: the crater and
	     upper streams stay, and a copy oozes down over them to the tips, then cools and fades
	     into the rock (SceneView's Lava does it per drip; here one mask slides down the layer). -->
	<img class="layer lava" src="./base/hd/volcano-lava.webp" alt="" style="left:912px;top:92px;width:329px;height:329px" />
	<img class="layer lava flow" src="./base/hd/volcano-lava.webp" alt="" style="left:912px;top:92px;width:329px;height:329px" />
	<span class="crater-glow"></span>
	{#each Array.from({ length: SMOKE_N }, (_, i) => i) as i}
		<span
			class="smoke"
			style={`animation-duration:${SMOKE_MS}ms;animation-delay:${((-i / SMOKE_N) * SMOKE_MS).toFixed(0)}ms`}
		></span>
	{/each}
	<img class="layer" src="./base/hd/dome-hill.webp" alt="" style="left:814px;top:268px;width:267px;height:117px" />
	{#each GLINTS as g}
		<span
			class="glint"
			style={`left:${(g.x * 12).toFixed(1)}px;top:${g.y.toFixed(1)}px;width:${(g.w * 12).toFixed(1)}px;animation-duration:${g.dur.toFixed(2)}s;animation-delay:${g.delay.toFixed(2)}s`}
		></span>
	{/each}
	{#if boat}
		{#key boat.id}
			<span class="boat" class:left={!boat.right} style={`animation-duration:${boat.ms.toFixed(0)}ms`}
				><img src="./base/hd/boat.webp" alt="" /></span
			>
		{/key}
	{/if}
	{#each peeks as p (p.id)}
		<span
			class="peek"
			style={`left:${(ISLAND.x + (p.x / 100) * ISLAND.w - PEEK_SIZE / 2).toFixed(1)}px;top:${(ISLAND.y + (p.top / 100) * ISLAND.h).toFixed(1)}px;width:${PEEK_SIZE}px;--dx:0%;--px:${p.px}%;--py:${p.py}%;--lean:${p.lean}deg;animation-duration:${PEEK_MS}ms;animation-delay:${p.delay.toFixed(0)}ms`}
			><Blob symbol={p.symbol} uid={`peek-${p.id}`} /></span
		>
	{/each}
	<img class="layer" src="./base/hd/island.webp" alt="" style={`left:${ISLAND.x}px;top:${ISLAND.y}px;width:${ISLAND.w}px;height:${ISLAND.h}px`} />
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
	.layer {
		position: absolute;
	}
	/* The mask is twice the layer's height, opaque over its top half: slid up by p of the
	   layer's height, it shows the top 1 - p. The crater sits in the top 20%, the longest tip
	   at ~66%. */
	.lava {
		mask-image: linear-gradient(#000 0 47%, #0000 50%);
		mask-size: 100% 200%;
		mask-repeat: no-repeat;
		mask-position: 0 42%;
	}
	.lava.flow {
		animation: lava-ooze 11s infinite;
	}
	@keyframes lava-ooze {
		0% {
			mask-position: 0 42%;
			opacity: 1;
			animation-timing-function: cubic-bezier(0.2, 0.6, 0.4, 1);
		}
		62% {
			mask-position: 0 0%;
			opacity: 1;
		}
		80% {
			mask-position: 0 0%;
			opacity: 1;
			filter: none;
		}
		100% {
			mask-position: 0 0%;
			opacity: 0;
			filter: brightness(0.65);
		}
	}
	@keyframes lava-glow {
		0%,
		100% {
			opacity: 0.1;
		}
		35% {
			opacity: 0.32;
		}
		55% {
			opacity: 0.2;
		}
		75% {
			opacity: 0.36;
		}
	}
	.crater-glow {
		position: absolute;
		left: 1050px;
		top: 170px;
		width: 72px;
		height: 24px;
		background: radial-gradient(closest-side, #ff8a3d, #ff8a3d88 55%, #ff8a3d00);
		animation: lava-glow 4s ease-in-out infinite;
	}
	/* A soft round puff, 58×49 at full size, centred on the crater; drawn at full size and
	   scaled so the transform stays on the compositor. SceneView's Smoke curve, sampled. */
	.smoke {
		position: absolute;
		left: 1057px;
		top: 153.5px;
		width: 58px;
		height: 49px;
		background: radial-gradient(closest-side, #fbf7ff, #fbf7ff88 55%, #fbf7ff00);
		opacity: 0;
		animation: smoke linear infinite;
	}
	@keyframes smoke {
		0% {
			opacity: 0;
			transform: translate(0, 0) scale(0.31);
		}
		10% {
			opacity: 0.45;
			transform: translate(0.4px, -16px) scale(0.38);
		}
		35% {
			opacity: 0.3;
			transform: translate(5px, -50px) scale(0.55);
		}
		65% {
			opacity: 0.14;
			transform: translate(15px, -81px) scale(0.76);
		}
		100% {
			opacity: 0;
			transform: translate(26px, -100px) scale(1);
		}
	}
	/* Origin on the keel's waterline (86% down the 77×67 box), so the rock pivots in the water. */
	.boat {
		position: absolute;
		left: 0;
		top: 341px;
		width: 77px;
		height: 67px;
		animation: sail linear both;
	}
	.boat.left {
		animation-name: sail-left;
	}
	.boat img {
		display: block;
		width: 100%;
		height: 100%;
		transform-origin: 50% 86%;
		animation: bob 3s ease-in-out infinite;
	}
	.boat.left img {
		scale: -1 1;
	}
	@keyframes sail {
		from {
			transform: translateX(-98px);
		}
		to {
			transform: translateX(1222px);
		}
	}
	@keyframes sail-left {
		from {
			transform: translateX(1222px);
		}
		to {
			transform: translateX(-98px);
		}
	}
	@keyframes bob {
		0%,
		100% {
			transform: translateY(-1.1px) rotate(-1.5deg);
		}
		50% {
			transform: translateY(1.1px) rotate(1.5deg);
		}
	}
	/* Far away, so about one bush wide, and as soft and hazy as the painting around it
	   (SceneView's peek filters). */
	.peek {
		position: absolute;
		aspect-ratio: 1;
		filter: blur(0.5px) contrast(0.92) brightness(1.06);
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
		.smoke {
			animation-play-state: paused;
		}
		.lava,
		.crater-glow {
			animation: none;
		}
		.lava.flow {
			mask-position: 0 0%;
		}
	}
</style>
