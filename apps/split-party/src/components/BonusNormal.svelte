<script lang="ts">
	import { onMount } from 'svelte';
	import Blob from './Blob.svelte';

	// Normal-bonus backdrop, Figma 11362:72643 (1200×670, 2026-10-29), cover-scaled like
	// BaseScene: the frame's gradient sky, two pink clouds swaying, the hills, the blob house
	// and the dunes. Now and then a blob peeks over a crest right of the board, behind the hill
	// or the dunes (SceneView's NormalWorld). Layers from scripts/build-bonus-scene.py.
	const SKY = { w: 1200, h: 670 };
	const A = './bonus/normal/hd';
	let vw = $state(1200);
	let vh = $state(670);
	let scale = $derived(Math.max(vw / SKY.w, vh / SKY.h) * 1.04);
	// The two pink clouds: [x, y, sway px, sway period ms].
	const CLOUDS = [
		[73, 6, 18, 23000],
		[887, 118, 14, 31000],
	] as const;

	// Peek spots: the blob's centre x and the crest's edge there (measured from the art's
	// alpha), frame px; back: behind the hill (else behind the dunes); lean tips it to the board.
	type Spot = { x: number; edge: number; lean: number; back: boolean };
	const SPOTS: Spot[] = [
		{ x: 1062, edge: 411, lean: -8, back: true },
		{ x: 1155, edge: 449, lean: -6, back: false },
		{ x: 985, edge: 440, lean: -10, back: false },
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
	<span class="sky"></span>
	{#each CLOUDS as [x, y, sway, ms]}
		<img class="cloud" src={`${A}/cloud.webp`} alt="" style={`left:${x}px;top:${y}px;--sway:${sway}px;animation-duration:${ms / 2}ms`} />
	{/each}
	{#snippet peekers(back: boolean)}
		{#each peeks.filter((p) => p.back === back) as p (p.id)}
			<span
				class="peek"
				style={`left:${p.x - PEEK / 2}px;top:${p.edge + 4}px;width:${PEEK}px;--lean:${p.lean}deg;animation-duration:${PEEK_MS}ms`}
				><Blob symbol={p.symbol} uid={`bonus-peek-${p.id}`} /></span
			>
		{/each}
	{/snippet}
	{@render peekers(true)}
	<img class="layer" src={`${A}/hills.webp`} alt="" style="left:194px;top:248px;width:1023px;height:342px" />
	<img class="layer" src={`${A}/house.webp`} alt="" style="left:-56px;top:102px;width:369px;height:379px" />
	{@render peekers(false)}
	<img class="layer" src={`${A}/dunes.webp`} alt="" style="left:-209px;top:315px;width:1497px;height:500px" />
</div>

<style>
	.bonus-scene {
		position: absolute;
		left: 50%;
		top: 50%;
		overflow: hidden;
		pointer-events: none;
	}
	.sky {
		position: absolute;
		left: -80px;
		top: -120px;
		width: 1360px;
		height: 616px;
		/* The frame's gradient over its 496px, its top colour carried up past the frame. */
		background: linear-gradient(180deg, #985efb 0 120px, #ce5cf3 271px, #fc68cb 409px, #fd80b3 487px, #fd979b 100%);
	}
	.layer {
		position: absolute;
	}
	.cloud {
		position: absolute;
		width: 297px;
		height: 99px;
		opacity: 0.6;
		animation: cloud-sway ease-in-out infinite alternate;
	}
	@keyframes cloud-sway {
		from {
			transform: translateX(calc(var(--sway) * -1));
		}
		to {
			transform: translateX(var(--sway));
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.cloud {
			animation: none;
		}
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
