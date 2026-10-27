<script lang="ts" module>
	/** Full length of the break-open at pace 1, ms; App waits this (times its pace). */
	export const MYSTERY_MS = 6650;
	/** When the egg bursts, and the four knocks before it that each open the crack further. */
	export const BURST_MS = 4300;
	export const KNOCKS_MS = [1300, 2100, 2900, 3700];
	/** Blobs per tile each drawn bonus starts with (the math's 1 / 2 / 3). */
	export const START_BLOBS: Record<string, number> = { normal: 1, super: 2, hidden: 3 };
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import Blob from './Blob.svelte';

	// Mystery buy reveal: the mystery egg (Figma 11174:5039) drops in and sits still, then takes
	// four knocks, each opening the crack further from the middle out while a light that cycles
	// through all three tiers' colours swells behind it (the crack leaks white: nothing gives the
	// draw away early); a held breath, and it bursts open in the drawn tier's colour (top flies
	// off, shell bits and a flash); a blob climbs out
	// and divides into as many blobs as the drawn bonus starts its tiles with (Normal 1, Super 2,
	// Hidden 3), side by side over the egg; App then shows the result card. Parts from
	// scripts/build-mystery-egg.py. Every time is scaled by `pace` (turbo plays it faster).
	let { tier, pace = 1 }: { tier: string; pace?: number } = $props();
	const count = START_BLOBS[tier] ?? 1;

	// The blob's flavour follows the tier's colours.
	const symbol = ({ normal: 'KIWI', super: 'GRAPES', hidden: 'LEMON' } as Record<string, string>)[tier] ?? 'STRAWBERRY';
	// Stage px from its centre. The blob climbs out of the broken egg to ROOT, then halves its
	// group each generation (a binary split of the final arc) until every blob has its own spot.
	const EGG = { x: 0, y: -10 };
	const ROOT = { x: 0, y: -120 };
	const BLOB = 96; // px at scale 1 (the first blob); the last generation is END_SCALE of it
	const END_SCALE = 0.86;
	const RISE_AT = 4400;
	const RISE_MS = 520;
	const SPLIT_GAP = 420; // ms per generation
	// The final blobs stand in a row at the root's height, 118px apart.
	const leaves = Array.from({ length: count }, (_, i) => ({ x: (i - (count - 1) / 2) * 118, y: ROOT.y }));
	// paths[i][g]: blob i's spot at generation g (a group's spot = the middle of its leaves).
	const depth = Math.ceil(Math.log2(Math.max(1, count)));
	const paths = leaves.map(() => [ROOT] as { x: number; y: number }[]);
	const walk = (a: number, b: number, g: number) => {
		if (g > depth) return;
		const mid = (a + b) / 2;
		const spot = (lo: number, hi: number) => {
			const xs = leaves.slice(lo, hi);
			return { x: xs.reduce((t, p) => t + p.x, 0) / xs.length, y: xs.reduce((t, p) => t + p.y, 0) / xs.length };
		};
		if (b - a === 1) {
			for (let k = g; k <= depth; k++) paths[a][k] = leaves[a];
			return;
		}
		const lo = Math.floor(mid);
		for (const [x, y] of [
			[a, lo],
			[lo, b],
		]) {
			const p = spot(x, y);
			for (let i = x; i < y; i++) paths[i][g] = p;
			walk(x, y, g + 1);
		}
	};
	walk(0, count, 1);

	let blobs: HTMLElement[] = $state([]);
	onMount(() => {
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
			// No travel: every blob is simply at its spot.
			blobs.forEach((el, i) => {
				const p = paths[i][depth];
				el.style.transform = `translate(${p.x}px, ${p.y}px) scale(${END_SCALE})`;
				el.style.opacity = '1';
			});
			return;
		}
		const total = RISE_MS + depth * SPLIT_GAP;
		const at = (ms: number) => ms / total;
		const scaleAt = (g: number) => 1 - ((1 - END_SCALE) * g) / Math.max(1, depth);
		const pose = (p: { x: number; y: number }, s: number, sx = 1, sy = 1) =>
			`translate(${p.x}px, ${p.y}px) scale(${s * sx}, ${s * sy})`;
		const anims = blobs.map((el, i) => {
			const path = paths[i];
			const frames: Keyframe[] = [
				{ offset: 0, transform: pose(EGG, 0.2), opacity: 0 },
				{ offset: at(RISE_MS * 0.55), transform: pose({ x: ROOT.x, y: ROOT.y - 18 }, 1, 0.88, 1.16), opacity: 1 },
				{ offset: at(RISE_MS * 0.8), transform: pose(ROOT, 1, 1.12, 0.9), opacity: 1 },
				{ offset: at(RISE_MS), transform: pose(ROOT, 1), opacity: 1 },
			];
			for (let g = 1; g <= depth; g++) {
				const t0 = RISE_MS + (g - 1) * SPLIT_GAP;
				const from = path[g - 1];
				const to = path[g];
				const s0 = scaleAt(g - 1);
				const s1 = scaleAt(g);
				const moves = Math.hypot(to.x - from.x, to.y - from.y) > 0.5;
				// Swell stacked on the parent, stretch apart along the split, snap, settle.
				frames.push(
					{ offset: at(t0 + SPLIT_GAP * 0.25), transform: pose(from, s0, moves ? 1.14 : 1.04, moves ? 0.9 : 0.97), opacity: 1 },
					{
						offset: at(t0 + SPLIT_GAP * 0.6),
						transform: pose({ x: from.x + (to.x - from.x) * 1.08, y: from.y + (to.y - from.y) * 1.08 }, s1, moves ? 0.86 : 1, moves ? 1.12 : 1),
						opacity: 1,
					},
					{ offset: at(t0 + SPLIT_GAP), transform: pose(to, s1), opacity: 1 },
				);
			}
			return el.animate(frames, { duration: total * pace, delay: RISE_AT * pace, fill: 'both', easing: 'linear' });
		});
		return () => anims.forEach((a) => a.cancel());
	});

	// Shell bits: [angle deg, distance px, size px, spin deg].
	const BITS = [
		[-150, 190, 30, -260],
		[-120, 230, 22, 200],
		[-75, 250, 26, -180],
		[-40, 210, 20, 300],
		[-15, 170, 28, -220],
		[200, 160, 18, 240],
		[-170, 140, 16, 160],
		[-95, 290, 14, -320],
	];
	// Droplets in the tier's colour.
	const DROPS = Array.from({ length: 12 }, (_, i) => [i * 30 + 8, 150 + ((i * 37) % 90), 8 + ((i * 5) % 9)]);
</script>

<div class={`mystery ${tier}`} style={`--p:${pace}`} aria-live="polite">
	<div class="veil"></div>
	<div class="stage">
		<div class="rays"></div>
		<div class="flash"></div>
		<div class="glow"><span class="normal"></span><span class="super"></span><span class="hidden"></span></div>
		<!-- Two layers: one transform each (the drop, then the wobble). -->
		<div class="fall">
			<div class="egg">
				<img class="whole" src="./mystery/hd/egg.webp" alt="" />
				{#each KNOCKS_MS as _, i}<img class={`crack c${i}`} src="./mystery/hd/egg-crack.webp" alt="" />{/each}
				<div class="leak">{#each KNOCKS_MS as _, i}<span class={`c${i}`}></span>{/each}</div>
				<img class="bottom" src="./mystery/hd/egg-bottom.webp" alt="" />
				<img class="top" src="./mystery/hd/egg-top.webp" alt="" />
			</div>
		</div>
		{#each BITS as [a, r, s, spin]}
			<span class="bit" style={`--a:${a}deg;--r:${r}px;--spin:${spin}deg;width:${s}px;height:${s * 0.8}px`}></span>
		{/each}
		{#each DROPS as [a, r, s]}
			<span class="drop" style={`--a:${a}deg;--r:${r}px;width:${s}px;height:${s}px`}></span>
		{/each}
		{#each paths as _, i}
			<div class="egg-blob" bind:this={blobs[i]} style={`width:${BLOB}px;height:${BLOB}px;margin:${-BLOB / 2}px`}>
				<Blob {symbol} uid={`mystery-blob-${i}`} />
			</div>
		{/each}
	</div>
</div>

<style>
	/* Timeline (ms at pace 1): drop 0-550, still to 1300; knocks at 1300 / 2100 / 2900 / 3700,
	   each widening the crack (shudder building between them, the light behind swelling); held
	   breath 3810-4300; burst at 4300; blob climbs out 4400-4920 and splits up to twice (420ms
	   each) to ~5760, holds, everything fades 6250-6650. Transform/opacity only. */
	.mystery {
		--c1: #b6f04a;
		--c2: #2bc4b4;
		position: fixed;
		inset: 0;
		z-index: 40;
		display: grid;
		place-items: center;
		pointer-events: none;
		animation: m-out calc(400ms * var(--p)) calc(6250ms * var(--p)) both;
	}
	.mystery.super {
		--c1: #ff7ce5;
		--c2: #9b3dfb;
	}
	.mystery.hidden {
		--c1: #ffe36b;
		--c2: #ff9f1c;
	}
	@keyframes m-out {
		to {
			opacity: 0;
		}
	}
	.veil {
		position: absolute;
		inset: 0;
		background: radial-gradient(closest-side, #2a124fcc, #120a2ee6);
		animation: m-fade calc(450ms * var(--p)) both;
	}
	@keyframes m-fade {
		from {
			opacity: 0;
		}
	}
	.stage {
		position: relative;
		width: 270px;
		height: 300px;
		/* Smaller than drawn (user request 2026-10-20); `scale` leaves the children's transforms alone. */
		scale: 0.72;
	}
	.fall,
	.egg,
	.egg img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.fall {
		transform-origin: 50% 90%;
		animation: egg-drop calc(550ms * var(--p)) cubic-bezier(0.3, 0, 0.6, 1) both;
	}
	.egg {
		transform-origin: 50% 90%;
		animation: egg-wobble calc(3750ms * var(--p)) calc(550ms * var(--p)) both;
	}
	@keyframes egg-drop {
		0% {
			transform: translateY(-120vh);
		}
		70% {
			transform: translateY(0) scale(1.12, 0.86);
		}
		85% {
			transform: translateY(-14px) scale(0.95, 1.06);
		}
		100% {
			transform: none;
		}
	}
	/* 3750ms from 550 (1% = 37.5ms): near-still, then a knock at 20% (1300), 41% (2100), 63%
	   (2900) and 84% (3700), each harder, with a tremor between that grows into a swelling
	   shudder; after the last, a held breath (87-97%) and the pre-burst squash. */
	@keyframes egg-wobble {
		0%,
		19%,
		100% {
			transform: none;
		}
		8% {
			transform: rotate(0.8deg);
		}
		14% {
			transform: rotate(-0.8deg);
		}
		20.5% {
			transform: rotate(-4deg) scale(1.02, 0.98);
		}
		22% {
			transform: rotate(2deg);
		}
		24%,
		41% {
			transform: none;
		}
		30% {
			transform: rotate(0.6deg);
		}
		36% {
			transform: rotate(-0.6deg);
		}
		42% {
			transform: rotate(5deg) scale(1.03, 0.97);
		}
		43.5% {
			transform: rotate(-3deg);
		}
		45% {
			transform: rotate(1.5deg);
		}
		47%,
		62% {
			transform: none;
		}
		50% {
			transform: rotate(-1.2deg);
		}
		53% {
			transform: rotate(1.2deg);
		}
		56% {
			transform: rotate(-1.5deg);
		}
		59% {
			transform: rotate(1.5deg);
		}
		63.5% {
			transform: rotate(-6deg) scale(1.05, 0.95);
		}
		65% {
			transform: rotate(4deg) scale(1.04);
		}
		66.5% {
			transform: rotate(-2deg) scale(1.04);
		}
		69% {
			transform: rotate(2deg) scale(1.05);
		}
		71% {
			transform: rotate(-2.2deg) scale(1.05);
		}
		73% {
			transform: rotate(2.5deg) scale(1.06);
		}
		75% {
			transform: rotate(-2.8deg) scale(1.06);
		}
		77% {
			transform: rotate(3deg) scale(1.07);
		}
		79% {
			transform: rotate(-3.2deg) scale(1.07);
		}
		81% {
			transform: rotate(3.5deg) scale(1.08);
		}
		83% {
			transform: rotate(-3.5deg) scale(1.08);
		}
		85% {
			transform: scale(1.12, 0.9);
		}
		87%,
		97% {
			transform: scale(1.06, 1.04);
		}
		99.5% {
			transform: scale(1.18, 0.84);
		}
	}
	/* Whole until it bursts; then the halves take over. The halves, bits and drops fill
	   forwards only: their first keyframe is visible, and a backwards fill would show them on
	   the whole egg from the start. */
	.whole {
		animation: m-hide 1ms calc(4300ms * var(--p)) both;
	}
	@keyframes m-hide {
		to {
			opacity: 0;
		}
	}
	/* The crack grows from the middle out, one width per knock: four copies of the art, each
	   cut wider (static clip-paths) and switched on at its knock, so only opacity animates. */
	.crack {
		opacity: 0;
		animation:
			m-show 1ms calc(var(--at) * var(--p)) forwards,
			m-hide 1ms calc(4300ms * var(--p)) forwards;
	}
	:is(.crack, .leak span).c0 {
		--at: 1300ms;
		clip-path: inset(0 41% 0 41%);
	}
	:is(.crack, .leak span).c1 {
		--at: 2100ms;
		clip-path: inset(0 29% 0 29%);
	}
	:is(.crack, .leak span).c2 {
		--at: 2900ms;
		clip-path: inset(0 15% 0 15%);
	}
	:is(.crack, .leak span).c3 {
		--at: 3700ms;
	}
	@keyframes m-show {
		to {
			opacity: 1;
		}
	}
	/* Light leaking out along the crack lines, white so it can't tell the tier: a fill masked by
	   the crack's inner slit (egg-leak.webp, cut per knock like the crack), haloed by a static drop-shadow; it flares at
	   each knock and settles a little brighter each time. */
	.leak {
		position: absolute;
		inset: 0;
		filter: drop-shadow(0 0 9px #fff6c880);
		opacity: 0;
		animation:
			leak calc(3000ms * var(--p)) calc(1300ms * var(--p)) ease-out forwards,
			m-hide 1ms calc(4300ms * var(--p)) forwards;
	}
	.leak span {
		position: absolute;
		inset: 0;
		opacity: 0;
		animation: m-show 1ms calc(var(--at) * var(--p)) forwards;
		background: #fff3c4;
		-webkit-mask: url('/mystery/hd/egg-leak.webp') 0 0 / 100% 100% no-repeat;
		mask: url('/mystery/hd/egg-leak.webp') 0 0 / 100% 100% no-repeat;
	}
	/* 3000ms from 1300 (knocks at 0, 26.7, 53.3 and 80%). */
	@keyframes leak {
		0% {
			opacity: 0;
		}
		3% {
			opacity: 0.6;
		}
		12%,
		26.7% {
			opacity: 0.3;
		}
		29% {
			opacity: 0.75;
		}
		38%,
		53.3% {
			opacity: 0.45;
		}
		56% {
			opacity: 0.9;
		}
		65%,
		80% {
			opacity: 0.6;
		}
		82%,
		100% {
			opacity: 1;
		}
	}
	/* The light behind the egg: three layers in the three tiers' colours cross-fading in turn
	   (any of them could be coming), swelling with each knock and dying in the flash. */
	.glow {
		position: absolute;
		left: 50%;
		top: 52%;
		width: 470px;
		height: 470px;
		margin: -235px 0 0 -235px;
		opacity: 0;
		animation: glow-build calc(3050ms * var(--p)) calc(1300ms * var(--p)) ease-in-out forwards;
	}
	.glow span {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		animation: glow-cycle calc(1500ms * var(--p)) linear infinite;
	}
	.glow .normal {
		background: radial-gradient(closest-side, color-mix(in srgb, #b6f04a, #fff 35%), color-mix(in srgb, #2bc4b4, transparent 40%) 45%, #fff0);
	}
	.glow .super {
		background: radial-gradient(closest-side, color-mix(in srgb, #ff7ce5, #fff 35%), color-mix(in srgb, #9b3dfb, transparent 40%) 45%, #fff0);
		animation-delay: calc(-500ms * var(--p));
	}
	.glow .hidden {
		background: radial-gradient(closest-side, color-mix(in srgb, #ffe36b, #fff 35%), color-mix(in srgb, #ff9f1c, transparent 40%) 45%, #fff0);
		animation-delay: calc(-1000ms * var(--p));
	}
	@keyframes glow-cycle {
		0%,
		100% {
			opacity: 1;
		}
		33%,
		67% {
			opacity: 0;
		}
	}
	/* 3050ms from 1300 (knocks at 0, 26.2, 52.5 and 78.7%; burst at 98.4%). */
	@keyframes glow-build {
		0% {
			opacity: 0;
			transform: scale(0.5);
		}
		5% {
			opacity: 0.5;
			transform: scale(0.7);
		}
		20%,
		26.2% {
			opacity: 0.25;
			transform: scale(0.65);
		}
		31% {
			opacity: 0.6;
			transform: scale(0.8);
		}
		45%,
		52.5% {
			opacity: 0.35;
			transform: scale(0.76);
		}
		57% {
			opacity: 0.8;
			transform: scale(0.92);
		}
		70%,
		78.7% {
			opacity: 0.55;
			transform: scale(0.88);
		}
		83% {
			opacity: 1;
			transform: scale(1.08);
		}
		96% {
			opacity: 0.85;
			transform: scale(1);
		}
		98.4% {
			opacity: 1;
			transform: scale(1.2);
		}
		100% {
			opacity: 0;
			transform: scale(1.6);
		}
	}
	.top,
	.bottom {
		opacity: 0;
	}
	.top {
		transform-origin: 50% 50%;
		animation: top-fly calc(900ms * var(--p)) calc(4300ms * var(--p)) cubic-bezier(0.2, 0.7, 0.4, 1) forwards;
	}
	@keyframes top-fly {
		0% {
			opacity: 1;
			transform: none;
		}
		40% {
			opacity: 1;
			transform: translate(-70px, -150px) rotate(-38deg);
		}
		100% {
			opacity: 0;
			transform: translate(-150px, -60px) rotate(-95deg) scale(0.8);
		}
	}
	.bottom {
		transform-origin: 50% 100%;
		animation: bottom-stay calc(2900ms * var(--p)) calc(4300ms * var(--p)) forwards;
	}
	@keyframes bottom-stay {
		0% {
			opacity: 1;
			transform: scale(1.1, 0.9);
		}
		15% {
			transform: scale(0.96, 1.04);
		}
		30% {
			transform: none;
		}
		70% {
			opacity: 1;
			transform: translateY(0);
		}
		100% {
			opacity: 0;
			transform: translateY(40px) scale(0.9);
		}
	}
	.flash {
		position: absolute;
		left: 50%;
		top: 46%;
		width: 420px;
		height: 420px;
		margin: -210px 0 0 -210px;
		border-radius: 50%;
		background: radial-gradient(closest-side, #fff, #fff9 30%, color-mix(in srgb, var(--c1), transparent 50%) 55%, #fff0);
		opacity: 0;
		animation: flash calc(700ms * var(--p)) calc(4270ms * var(--p)) ease-out both;
	}
	@keyframes flash {
		0% {
			opacity: 0;
			transform: scale(0.2);
		}
		20% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: scale(1.5);
		}
	}
	/* Slow-turning rays behind the prize. */
	.rays {
		position: absolute;
		left: 50%;
		top: 40%;
		width: 640px;
		height: 640px;
		margin: -320px 0 0 -320px;
		border-radius: 50%;
		background: repeating-conic-gradient(color-mix(in srgb, var(--c1), transparent 55%) 0 9deg, #fff0 9deg 22.5deg);
		mask: radial-gradient(closest-side, #000 20%, #0000);
		opacity: 0;
		animation:
			rays-in calc(500ms * var(--p)) calc(4350ms * var(--p)) both,
			rays-turn 9s linear infinite;
	}
	@keyframes rays-in {
		from {
			opacity: 0;
			scale: 0.3;
		}
		to {
			opacity: 1;
			scale: 1;
		}
	}
	@keyframes rays-turn {
		to {
			rotate: 360deg;
		}
	}
	/* Each blob's path is a WAAPI animation (onMount); hidden until it rises. */
	.egg-blob {
		position: absolute;
		left: 50%;
		top: 50%;
		opacity: 0;
	}
	.bit,
	.drop {
		position: absolute;
		left: 50%;
		top: 47%;
		opacity: 0;
	}
	.bit {
		background: #fff4d6;
		border: 3px solid #f7b733;
		box-sizing: border-box;
		clip-path: polygon(0 30%, 45% 0, 100% 40%, 70% 100%, 15% 85%);
		animation: bit-fly calc(900ms * var(--p)) calc(4300ms * var(--p)) cubic-bezier(0.15, 0.7, 0.4, 1) forwards;
	}
	@keyframes bit-fly {
		0% {
			opacity: 1;
			transform: translate(-50%, -50%) rotate(var(--a)) translateX(10px);
		}
		70% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translate(-50%, -50%) rotate(var(--a)) translateX(var(--r)) translateY(60px) rotate(var(--spin));
		}
	}
	.drop {
		border-radius: 50%;
		background: radial-gradient(circle at 35% 30%, #fffc 0 20%, var(--c1) 32%, var(--c2));
		animation: drop-fly calc(800ms * var(--p)) calc(4330ms * var(--p)) cubic-bezier(0.2, 0.7, 0.4, 1) forwards;
	}
	@keyframes drop-fly {
		0% {
			opacity: 1;
			transform: translate(-50%, -50%) rotate(var(--a)) translateX(0) scale(0.4);
		}
		75% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translate(-50%, -50%) rotate(var(--a)) translateX(var(--r)) scale(1);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.glow,
		.leak {
			display: none;
		}
		.mystery *,
		.mystery {
			animation-duration: 1ms !important;
		}
		.rays {
			animation: none;
			opacity: 1;
		}
	}
</style>
