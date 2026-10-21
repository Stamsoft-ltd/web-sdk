<script lang="ts">
	import { onMount } from 'svelte';
	import Blob from './Blob.svelte';
	import JellyDome from './JellyDome.svelte';
	import SkyClouds from './SkyClouds.svelte';

	// Normal-bonus backdrop, Figma 11174:5578 (1200×670), cover-scaled like BaseScene: the
	// sunset, its pink clouds drifting, the three slime cliffs, and the jelly domes that now and
	// then pop and blow back up. Now and then a blob peeks over the top of a cliff (their
	// slopes are behind the board and the round panels, so the tops are the visible edge).
	// Layers from scripts/build-bonus-scene.py (blur baked in).
	const SKY = { w: 1200, h: 670 };
	const A = './bonus/normal/crisp';
	let vw = $state(1200);
	let vh = $state(670);
	let scale = $derived(Math.max(vw / SKY.w, vh / SKY.h) * 1.04);

	// The frame's clouds sit at y 26-103 and are 231-297px wide.
	const CLOUD = { src: `${A}/cloud-puff.webp`, w: [160, 190] as [number, number], alpha: [0.8, 0.8] as [number, number] };
	const FAR = { src: `${A}/cloud-puff.webp`, w: [110, 135] as [number, number], alpha: [0.65, 0.8] as [number, number] };
	const CLOUD_LANES = [
		{ far: false, y: [24, 40] as [number, number] },
		{ far: true, y: [96, 112] as [number, number] },
	];

	// Cliffs [x, y, w, h, mirrored, small art].
	const CLIFFS = [
		[877, 181, 356, 364, false, false],
		[-50, 128, 408, 417, true, false],
		[-60, 390, 207, 212, true, true],
	] as const;

	// Figma dome boxes [colour, x, y, size]; the webps keep the build script's CROP (x 6-94%,
	// y 30-70% of the square), and each colour's foot is where its art ends in that crop.
	const DOME_SCALE = 0.5;
	const FOOT = { blue: 0.914, green: 0.952, magenta: 0.951 };
	const COLOR = { blue: '#3f7bff', green: '#5bed7c', magenta: '#ea32df' };
	const DOMES = (
		[
			['blue', 994, 380, 290],
			['green', 1007, 484, 315],
			['green', 845, 433, 149],
			['blue', 904, 496, 146],
			['blue', 42, 363, 290],
			['blue', 291, 441, 133],
			['magenta', -152, 337, 510],
		] as const
	).map(([c, fx, fy, fs]) => {
		// Half the frame's size, standing on the same spot (the foot's centre stays put).
		const s = fs * DOME_SCALE;
		const x = fx + fs / 2 - s / 2;
		const y = fy + fs * (0.3 + 0.4 * FOOT[c]) - s * (0.3 + 0.4 * FOOT[c]);
		return {
			src: `${A}/dome-${c}${fs < 200 ? '-small' : ''}.webp`,
			color: COLOR[c],
			x: x + 0.06 * s,
			y: y + 0.3 * s,
			w: 0.88 * s,
			h: 0.4 * s,
			foot: FOOT[c],
		};
	});

	// Peek spots: the blob's centre x and the cliff's top edge there (measured from the art's
	// alpha: the slime top is highest at 50-80% across, 6-7% down), in frame px; lean tips the
	// blob toward the board as it looks over.
	type Spot = { x: number; edge: number; lean: number };
	const SPOTS: Spot[] = [
		{ x: 1073, edge: 206, lean: -8 },
		{ x: 1133, edge: 203, lean: -6 },
		{ x: 1027, edge: 217, lean: -10 },
		{ x: 134, edge: 156, lean: 8 },
		{ x: 66, edge: 153, lean: 6 },
	];
	const PEEK = 50;
	const PEEK_MS = 4000;
	const PEEKERS = ['WATERMELON', 'CHERRIES', 'GRAPES', 'STRAWBERRY', 'BLUEBERRY', 'KIWI', 'LEMON'];
	const rand = (a: number, b: number) => a + Math.random() * (b - a);
	const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
	type Peek = Spot & { id: number; symbol: string };
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
			const busy = new Set(peeks.map((p) => p.x));
			const spot = pick(SPOTS.filter((s) => !busy.has(s.x)));
			if (spot) {
				const id = peekId++;
				peeks = [...peeks, { ...spot, id, symbol: pick(PEEKERS) }];
				// By id: the items in `peeks` are $state proxies, not the objects pushed.
				later(PEEK_MS + 300, () => (peeks = peeks.filter((p) => p.id !== id)));
			}
			later(rand(5000, 14000), peek);
		};
		later(rand(2000, 6000), peek);
		return () => timers.forEach(clearTimeout);
	});
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} />

<div
	class="bonus-scene"
	style={`width:${SKY.w}px;height:${SKY.h}px;transform:translate(-50%,-50%) scale(${scale})`}
>
	<img class="sunset" src={`${A}/sunset.webp`} alt="" />
	<SkyClouds lanes={CLOUD_LANES} width={SKY.w} near={CLOUD} far={FAR} />
	<!-- Behind the cliffs, so a cliff hides everything below its top edge. -->
	{#each peeks as p (p.id)}
		<span
			class="peek"
			style={`left:${p.x - PEEK / 2}px;top:${p.edge + 4}px;width:${PEEK}px;--lean:${p.lean}deg;animation-duration:${PEEK_MS}ms`}
			><Blob symbol={p.symbol} uid={`bonus-peek-${p.id}`} /></span
		>
	{/each}
	{#each CLIFFS as [x, y, w, h, flip, small]}
		<img
			class="cliff"
			class:flip
			src={`${A}/cliff${small ? '-small' : ''}.webp`}
			alt=""
			style={`left:${x}px;top:${y}px;width:${w}px;height:${h}px`}
		/>
	{/each}
	{#each DOMES as d}
		<JellyDome
			src={d.src}
			x={d.x}
			y={d.y}
			w={d.w}
			h={d.h}
			ox={d.w / 2}
			oy={d.h * d.foot}
			color={d.color}
			shown
			first={[2500, 16000]}
			rest={[3000, 7000]}
			wait={[9000, 26000]}
		/>
	{/each}
</div>

<style>
	.bonus-scene {
		position: absolute;
		left: 50%;
		top: 50%;
		overflow: hidden;
		pointer-events: none;
	}
	.sunset {
		position: absolute;
		left: -60px;
		top: -30px;
		width: 1260px;
		height: 730px;
	}
	.cliff {
		position: absolute;
	}
	.cliff.flip {
		transform: scaleX(-1);
	}
	.peek {
		position: absolute;
		aspect-ratio: 1;
		filter: blur(0.6px);
		transform-origin: 50% 90%;
		animation: cliff-peek ease-in-out both;
	}
	/* Rises over the slime to the eyes, leans in to look at the board, a glance back, ducks. */
	@keyframes cliff-peek {
		0%,
		100% {
			transform: none;
		}
		14% {
			transform: translateY(-66%) scale(0.95, 1.08);
		}
		22%,
		40% {
			transform: translateY(-58%) rotate(var(--lean));
		}
		52%,
		68% {
			transform: translateY(-58%) rotate(calc(var(--lean) * -0.4));
		}
		80% {
			transform: translateY(-60%) rotate(var(--lean));
		}
		92% {
			transform: translateY(-8%) scale(1.04, 0.94);
		}
	}
</style>
