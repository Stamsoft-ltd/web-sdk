<script lang="ts" module>
	/** Full length of the break-open at pace 1, ms; App waits this (times its pace). */
	export const MYSTERY_MS = 7800;
	/** When the egg bursts, and the four knocks before it that each open the crack further. */
	export const BURST_MS = 4300;
	export const KNOCKS_MS = [1300, 2100, 2900, 3700];
	/** Blobs per tile each drawn bonus starts with (the math's 1 / 2 / 3). */
	export const START_BLOBS: Record<string, number> = { normal: 1, super: 2, hidden: 3 };
	/** The sacs' two heartbeats, and when the first hatches (each next one HATCH_GAP_MS later). */
	export const HEARTS_MS = [5700, 6000];
	export const HATCH_MS = 6350;
	export const HATCH_GAP_MS = 120;
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import Blob from './Blob.svelte';
	import PixiMama from './PixiMama.svelte';
	import { SHOW_MAMA } from '../lib/features';

	// Mystery buy reveal: the mystery egg (Figma 11174:5039) drops in and sits still, then takes
	// four knocks, each opening the crack further from the middle out while a light that cycles
	// through all three tiers' colours swells behind it (the crack leaks white: nothing gives the
	// draw away early); a held breath as the room goes dark round it, and it bursts open in the
	// drawn tier's colour (top flies off, shell bits and a flash, the question marks dissolve).
	// The blobs are born (user 2026-11-04: "somehow like born"): a glowing jelly sac in the tier's
	// colour rises out of the egg and divides like a cell into as many sacs as the drawn bonus
	// starts its tiles with (Normal 1, Super 2, Hidden 3), each holding a dark curled-up
	// silhouette; two heartbeats, the silhouettes kick, and the sacs pop one by one, each blob
	// bursting out in full colour with a newborn squash. App then shows the result card. Parts from
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
	const SPLIT_GAP = 360; // ms per generation
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

	// Mama watches beside the egg (user, 2026-10-27): on the edge of her seat, wondering what it
	// will be, through the knocks; when it bursts and the blobs climb out she laughs and claps.
	let mamaHope = $state(true);
	let mamaWin = $state(false);
	let mamaBeat = $state(0);
	let narrow = $state(false);
	onMount(() => {
		narrow = matchMedia('(max-width: 760px)').matches;
		const t = [
			setTimeout(() => (mamaHope = false), BURST_MS * pace),
			setTimeout(() => ((mamaWin = true), mamaBeat++), RISE_AT * pace),
			setTimeout(() => mamaBeat++, (RISE_AT + RISE_MS + depth * SPLIT_GAP) * pace),
		];
		return () => t.forEach(clearTimeout);
	});

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
	// The backdrop (user, 2026-10-27: "add some nice background"): a mystery stage in the game's
	// jelly colours, never the drawn tier's (nothing may give the tier away before the burst).
	// Bubbles drift up [x %, size px, seconds, delay s, colour], question marks float
	// [x %, y %, size px, tilt deg], and sparkles twinkle [x %, y %, size px, delay s].
	const BG_BUBBLES = [
		[6, 34, 13, 0, '#ff7ce5'],
		[15, 18, 10, 3.5, '#7fd8ff'],
		[24, 52, 16, 7, '#b26bff'],
		[33, 14, 11, 1.8, '#ffe36b'],
		[61, 22, 12, 5.2, '#7fd8ff'],
		[70, 46, 15, 2.6, '#ff7ce5'],
		[79, 16, 10, 8.1, '#b26bff'],
		[88, 30, 13, 4.4, '#5bed7c'],
		[95, 20, 11, 0.9, '#ff7ce5'],
		[45, 12, 12, 9.3, '#b26bff'],
		[54, 26, 14, 11, '#ffe36b'],
		[2, 20, 12, 6.3, '#7fd8ff'],
	] as const;
	const MARKS = [
		[13, 22, 92, -14],
		[86, 18, 70, 12],
		[78, 72, 110, 8],
		[22, 78, 64, -6],
		[64, 9, 48, 18],
		[36, 10, 40, -20],
	] as const;
	// Dust in the beam: [x, y from the centre px, drift px, seconds, delay s], inside its cone.
	const MOTES = [
		[-60, -220, 14, 6, 0],
		[40, -300, -10, 7.5, 2.2],
		[-110, -40, 18, 6.8, 4.1],
		[120, -120, -16, 8, 1.3],
		[10, -380, 12, 7, 5.6],
		[-150, 60, 10, 6.4, 3],
		[160, 30, -12, 7.2, 0.7],
		[-20, -150, -8, 6.2, 6.4],
	] as const;
	const SPARKS = [
		[9, 12, 10, 0],
		[28, 30, 7, 1.1],
		[40, 70, 9, 2.3],
		[57, 84, 7, 0.6],
		[71, 34, 11, 1.7],
		[90, 56, 8, 2.9],
		[18, 60, 8, 3.4],
		[83, 88, 10, 0.3],
		[50, 6, 8, 2],
		[96, 8, 7, 1.4],
	] as const;
	// A sac's droplets as it pops: angles, deg.
	const SAC_DROPS = [-160, -115, -65, -20, 30, 150];
	// Droplets in the tier's colour.
	const DROPS = Array.from({ length: 12 }, (_, i) => [i * 30 + 8, 150 + ((i * 37) % 90), 8 + ((i * 5) % 9)]);
</script>

<div class={`mystery ${tier}`} style={`--p:${pace}`} aria-live="polite">
	<div class="veil">
		<div class="spot"></div>
		{#each MOTES as [x, y, dx, dur, delay]}
			<span class="mote" style={`left:calc(50% + ${x}px);top:calc(50% + ${y}px);--dx:${dx}px;--dur:${dur}s;--delay:${-delay}s`}></span>
		{/each}
		{#each MARKS as [x, y, size, tilt], i}
			<span class="mark" style={`left:${x}%;top:${y}%;font-size:${size}px;--tilt:${tilt}deg;--i:${i}`}>?</span>
		{/each}
		{#each BG_BUBBLES as [x, size, dur, delay, color]}
			<span class="bg-bubble" style={`left:${x}%;width:${size}px;height:${size}px;--c:${color};--dur:${dur}s;--delay:${-delay}s`}></span>
		{/each}
		{#each SPARKS as [x, y, size, delay]}
			<span class="spark" style={`left:${x}%;top:${y}%;width:${size}px;height:${size}px;--delay:${-delay}s`}></span>
		{/each}
	</div>
	<!-- The lights go down for the held breath; the burst's flash brings them back. -->
	<div class="hush"></div>
	{#if SHOW_MAMA}
		<div class="mama">
			<PixiMama instant edge={mamaHope} win={mamaWin} beat={mamaBeat} gaze={mamaWin ? null : narrow ? { x: 0.6, y: -0.8 } : { x: 1, y: -0.2 }} />
		</div>
	{/if}
	<div class="stage">
		<div class="rays"></div>
		<div class="podium"></div>
		<div class="flash"></div>
		<div class="glow"><span class="normal"></span><span class="super"></span><span class="hidden"></span></div>
		<!-- Two layers: one transform each (the drop, then the wobble). -->
		<div class="fall">
			<div class="egg">
				<img class="whole" src="./mystery/v3/egg.webp" alt="" />
				{#each KNOCKS_MS as _, i}<img class={`crack c${i}`} src="./mystery/v3/egg-crack.webp" alt="" />{/each}
				<div class="leak">{#each KNOCKS_MS as _, i}<span class={`c${i}`}></span>{/each}</div>
				<img class="bottom" src="./mystery/v3/egg-bottom.webp" alt="" />
				<img class="top" src="./mystery/v3/egg-top.webp" alt="" />
			</div>
		</div>
		{#each BITS as [a, r, s, spin]}
			<span class="bit" style={`--a:${a}deg;--r:${r}px;--spin:${spin}deg;width:${s}px;height:${s * 0.8}px`}></span>
		{/each}
		{#each DROPS as [a, r, s]}
			<span class="drop" style={`--a:${a}deg;--r:${r}px;width:${s}px;height:${s}px`}></span>
		{/each}
		{#each paths as _, i}
			<div class="egg-blob" bind:this={blobs[i]} style={`width:${BLOB}px;height:${BLOB}px;margin:${-BLOB / 2}px;--i:${i}`}>
				<div class="sac"></div>
				<div class="embryo"><Blob {symbol} uid={`mystery-blob-${i}`} /></div>
				<span class="hatch-ring"></span>
				{#each SAC_DROPS as a}<span class="sac-drop" style={`--a:${a}deg`}></span>{/each}
			</div>
		{/each}
	</div>
</div>

<style>
	/* Timeline (ms at pace 1): drop 0-550, still to 1300; knocks at 1300 / 2100 / 2900 / 3700,
	   each widening the crack (shudder building between them, the light behind swelling); held
	   breath 3810-4300 with the room darkening; burst at 4300; the sac rises 4400-4920 and
	   divides up to twice (360ms each) to ~5640; heartbeats at 5700 / 6000 (HEARTS_MS); the sacs
	   hatch from 6350, 120ms apart (HATCH_MS); everything fades 7400-7800. */
	.mystery {
		--c1: #b6f04a;
		--c2: #2bc4b4;
		position: fixed;
		inset: 0;
		z-index: 40;
		display: grid;
		place-items: center;
		pointer-events: none;
		animation: m-out calc(400ms * var(--p)) calc(7400ms * var(--p)) both;
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
		/* Opaque: nothing of the board behind shows through the reveal (user, 2026-10-27). */
		background:
			radial-gradient(60% 45% at 50% 46%, #4a1f86, #fff0),
			radial-gradient(120% 40% at 50% 110%, #ff7ce533, #fff0 60%),
			radial-gradient(closest-side, #2a124f, #120a2e);
		overflow: hidden;
		animation: m-fade calc(450ms * var(--p)) both;
	}
	/* Darkened edges over everything in the backdrop. */
	.veil::after {
		content: '';
		position: absolute;
		inset: 0;
		background: radial-gradient(75% 70% at 50% 48%, #0000 55%, #07031acc);
	}
	/* A spotlight from above onto the egg. A cone, not a cut-out: its apex sits off-screen
	   above, its sides fall off softly (a conic gradient's feathered stops), the air in it fades
	   with distance from the lamp and brightens again where it lands, a pool of light spills
	   round the podium, and dust drifts slowly through the beam. It breathes, never swings. */
	.spot {
		position: absolute;
		inset: 0;
		/* Pointing straight down (180deg) from 15deg left of it; stops in 0-30deg (negative
		   ones don't wrap: they cut the cone in half). */
		background: conic-gradient(
			from 165deg at 50% -38%,
			#fff0 0deg,
			#ffeefa0a 4deg,
			#ffeefa26 9deg,
			#fff3fb33 15deg,
			#ffeefa26 21deg,
			#ffeefa0a 26deg,
			#fff0 30deg
		);
		-webkit-mask: linear-gradient(#000c, #0006 40%, #000d 66%, #0003 92%, #0000);
		mask: linear-gradient(#000c, #0006 40%, #000d 66%, #0003 92%, #0000);
		animation: m-breathe 5.5s ease-in-out infinite alternate;
	}
	/* Where it lands: an oval pool on the floor round the podium, and the lamp's glare above. */
	.spot::before,
	.spot::after {
		content: '';
		position: absolute;
		left: 50%;
		border-radius: 50%;
	}
	.spot::before {
		top: calc(50% + 70px);
		width: 620px;
		height: 150px;
		margin-left: -310px;
		background: radial-gradient(closest-side, #ffd9f566, #ff9fe626 55%, #fff0);
	}
	.spot::after {
		top: -90px;
		width: 360px;
		height: 160px;
		margin-left: -180px;
		background: radial-gradient(closest-side, #fff8, #ffe2f622 60%, #fff0);
	}
	@keyframes m-breathe {
		from {
			opacity: 0.85;
		}
		to {
			opacity: 1;
		}
	}
	.mote {
		position: absolute;
		width: 3px;
		height: 3px;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 0 4px #fff;
		opacity: 0;
		animation: m-mote var(--dur) ease-in-out var(--delay) infinite;
	}
	@keyframes m-mote {
		0% {
			opacity: 0;
			transform: translate(0, 0);
		}
		30%,
		70% {
			opacity: 0.5;
		}
		100% {
			opacity: 0;
			transform: translate(var(--dx), -60px);
		}
	}
	/* Big faint question marks, bobbing; the burst answers them and they dissolve outward. */
	.mark {
		position: absolute;
		font-family: 'Coiny', sans-serif;
		line-height: 1;
		color: #ffffff12;
		-webkit-text-stroke: 2px #ffffff1a;
		rotate: var(--tilt);
		animation:
			m-bob 4.6s ease-in-out calc(var(--i) * -0.8s) infinite alternate,
			mark-out calc(500ms * var(--p)) calc((4300ms + var(--i) * 40ms) * var(--p)) ease-out forwards;
	}
	@keyframes mark-out {
		to {
			opacity: 0;
			scale: 1.6;
		}
	}
	/* 4400ms from 0: dark from the last knock's tail (85%) into the held breath (96.6% = 4250),
	   gone in the flash (98.4% = 4330). Under the stage, so the egg and its light stay lit. */
	.hush {
		position: absolute;
		inset: 0;
		background: radial-gradient(closest-side, #05010f99, #05010f);
		opacity: 0;
		animation: hush calc(4400ms * var(--p)) both;
	}
	@keyframes hush {
		0%,
		85% {
			opacity: 0;
		}
		96.6% {
			opacity: 0.78;
		}
		98.4%,
		100% {
			opacity: 0;
		}
	}
	@keyframes m-bob {
		to {
			transform: translateY(-14px) rotate(6deg);
		}
	}
	/* Jelly bubbles drifting up the screen. */
	.bg-bubble {
		position: absolute;
		top: 100%;
		border-radius: 50%;
		background: radial-gradient(circle at 32% 30%, #fffc 0 10%, color-mix(in srgb, var(--c), transparent 45%) 30%, color-mix(in srgb, var(--c), transparent 80%));
		box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--c), transparent 40%);
		animation: m-rise var(--dur) linear var(--delay) infinite;
	}
	@keyframes m-rise {
		from {
			transform: translate(0, 0);
		}
		50% {
			transform: translate(22px, -60vh);
		}
		to {
			transform: translate(-10px, -125vh);
		}
	}
	/* Four-point sparkles, twinkling. */
	.spark {
		position: absolute;
		background: #fff;
		clip-path: polygon(50% 0, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0 50%, 40% 40%);
		animation: m-twinkle 2.4s ease-in-out var(--delay) infinite;
	}
	@keyframes m-twinkle {
		0%,
		100% {
			opacity: 0.1;
			transform: scale(0.5);
		}
		50% {
			opacity: 0.9;
			transform: scale(1) rotate(45deg);
		}
	}
	/* The jelly podium the egg lands on: a glossy oval with a lit rim and a soft shadow. */
	.podium {
		position: absolute;
		left: 50%;
		top: 87%;
		width: 330px;
		height: 74px;
		margin-left: -165px;
		border-radius: 50%;
		/* Its top, lit from straight above by the spotlight: brightest in the middle. */
		background:
			radial-gradient(48% 34% at 50% 40%, #ffe4f8b3, #fff0),
			radial-gradient(closest-side, #ff9be9, #d24fe0 62%, #9a2bc4);
		/* Then its side, the drum under the top in shade (offset copies of the oval: a
		   pseudo-element at z -1 would paint over the top inside this stacking context), its
		   shadow on the floor and a little glow. */
		box-shadow:
			inset 0 3px 0 #ffffff80,
			inset 0 -6px 10px #6b168f,
			0 9px 0 #a93ad2,
			0 18px 0 #7a22a6,
			0 22px 0 #4f1272,
			0 34px 34px #000b,
			0 0 50px #ff7ce540;
		animation: m-fade calc(450ms * var(--p)) both;
	}
	/* Where the egg stands on it. */
	.podium::after {
		content: '';
		position: absolute;
		left: 26%;
		right: 26%;
		top: 10%;
		height: 44%;
		border-radius: 50%;
		background: radial-gradient(closest-side, #3d0a5c99, #3d0a5c00);
	}
	/* Mama low to the egg's left (below it on a narrow screen), a little under her board size
	   (182x200): user, 2026-10-27, "more to the left and bottom ... reduce her with 20%". */
	.mama {
		position: absolute;
		left: calc(50% - 480px);
		top: calc(50% - 30px);
		width: 174px;
		height: 192px;
		animation: m-fade calc(450ms * var(--p)) both;
	}
	@media (max-width: 760px) {
		/* Bottom left, clear of the podium (centred under it, its rim cut her head off: user
		   2026-11-02), looking up at the egg. */
		.mama {
			left: calc(50% - 178px);
			top: calc(50% + 172px);
			width: 131px;
			height: 144px;
		}
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
	/* Each knock's copy shows the crack out to --cut from each side, its ends feathered so the
	   short early cracks taper off instead of stopping square. */
	.crack,
	.leak span {
		--feather: linear-gradient(
			90deg,
			#0000 calc(var(--cut) - 2%),
			#000 calc(var(--cut) + 5%),
			#000 calc(100% - var(--cut) - 5%),
			#0000 calc(100% - var(--cut) + 2%)
		);
	}
	.crack {
		opacity: 0;
		-webkit-mask: var(--feather);
		mask: var(--feather);
		animation:
			m-show 1ms calc(var(--at) * var(--p)) forwards,
			m-hide 1ms calc(4300ms * var(--p)) forwards;
	}
	:is(.crack, .leak span).c0 {
		--at: 1300ms;
		--cut: 40%;
	}
	:is(.crack, .leak span).c1 {
		--at: 2100ms;
		--cut: 28%;
	}
	:is(.crack, .leak span).c2 {
		--at: 2900ms;
		--cut: 14%;
	}
	:is(.crack, .leak span).c3 {
		--at: 3700ms;
		--cut: -8%;
	}
	@keyframes m-show {
		to {
			opacity: 1;
		}
	}
	/* Light leaking out along the crack lines, white so it can't tell the tier: a fill masked by
	   the crack's inner slit (egg-leak.webp, feathered per knock like the crack), haloed by a
	   static drop-shadow; it flares at
	   each knock and settles a little brighter each time. */
	.leak {
		position: absolute;
		inset: 0;
		filter: drop-shadow(0 0 2px #fff6dc) drop-shadow(0 0 8px #fff3c880);
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
		background: #fff6dc;
		-webkit-mask:
			url('/mystery/v3/egg-leak.webp') 0 0 / 100% 100% no-repeat,
			var(--feather);
		-webkit-mask-composite: source-in;
		mask:
			url('/mystery/v3/egg-leak.webp') 0 0 / 100% 100% no-repeat,
			var(--feather);
		mask-composite: intersect;
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
	/* Each blob's path is a WAAPI animation (onMount); hidden until it rises. Inside: its sac,
	   the blob as a silhouette until it hatches (--hatch), the pop's ring and droplets. */
	.egg-blob {
		position: absolute;
		left: 50%;
		top: 50%;
		opacity: 0;
		--hatch: calc((6350ms + var(--i) * 120ms) * var(--p));
	}
	.egg-blob > * {
		position: absolute;
	}
	.sac {
		inset: -16%;
		border-radius: 50%;
		background:
			radial-gradient(circle at 33% 27%, #fffe 0 6%, #fff6 11%, #fff0 21%),
			radial-gradient(closest-side, color-mix(in srgb, var(--c1), transparent 72%) 52%, color-mix(in srgb, var(--c1), transparent 22%) 86%, color-mix(in srgb, var(--c2), transparent 5%));
		box-shadow:
			0 0 34px color-mix(in srgb, var(--c1), transparent 35%),
			inset 0 0 0 2px #ffffff70;
		animation:
			sac-wobble 1.1s ease-in-out infinite,
			sac-beat calc(300ms * var(--p)) calc(5700ms * var(--p)) ease-in-out 2,
			sac-pop calc(240ms * var(--p)) var(--hatch) ease-out forwards;
	}
	@keyframes sac-wobble {
		0%,
		100% {
			border-radius: 50%;
		}
		33% {
			border-radius: 54% 46% 50% 50% / 47% 53% 47% 53%;
		}
		66% {
			border-radius: 47% 53% 52% 48% / 53% 47% 52% 48%;
		}
	}
	@keyframes sac-beat {
		0%,
		100% {
			scale: 1;
		}
		30% {
			scale: 1.12 1.05;
		}
		55% {
			scale: 0.97 1.01;
		}
	}
	@keyframes sac-pop {
		0% {
			scale: 1;
			opacity: 1;
		}
		35% {
			scale: 1.2;
			opacity: 0.9;
		}
		100% {
			scale: 1.45;
			opacity: 0;
		}
	}
	/* Curled up and dark inside the sac, kicking on the heartbeats; then born. */
	.embryo {
		inset: 0;
		filter: brightness(0.1) saturate(0.3);
		scale: 0.74;
		rotate: -8deg;
		opacity: 0.85;
		animation:
			embryo-kick calc(300ms * var(--p)) calc(5700ms * var(--p)) ease-in-out 2,
			embryo-born calc(560ms * var(--p)) var(--hatch) forwards;
	}
	@keyframes embryo-kick {
		0%,
		100% {
			rotate: -8deg;
		}
		35% {
			rotate: 6deg;
			scale: 0.8 0.7;
		}
	}
	@keyframes embryo-born {
		0% {
			filter: brightness(0.1) saturate(0.3);
			scale: 0.74;
			rotate: -8deg;
			opacity: 0.85;
		}
		22% {
			filter: brightness(2.4) saturate(0.5);
			scale: 0.72 1.22;
			rotate: 0deg;
			opacity: 1;
		}
		52% {
			filter: brightness(1.15);
			scale: 1.2 0.82;
		}
		76% {
			scale: 0.95 1.06;
		}
		100% {
			filter: brightness(1);
			scale: 1;
			rotate: 0deg;
			opacity: 1;
		}
	}
	.hatch-ring {
		inset: -10%;
		border-radius: 50%;
		border: 4px solid #fff;
		opacity: 0;
		animation: hatch-ring calc(460ms * var(--p)) var(--hatch) ease-out forwards;
	}
	@keyframes hatch-ring {
		0% {
			opacity: 1;
			scale: 0.7;
		}
		100% {
			opacity: 0;
			scale: 1.9;
			border-width: 0.5px;
		}
	}
	.sac-drop {
		left: 50%;
		top: 50%;
		width: 14px;
		height: 14px;
		margin: -7px;
		border-radius: 50%;
		background: radial-gradient(circle at 35% 30%, #fffc 0 20%, var(--c1) 34%, var(--c2));
		opacity: 0;
		animation: sac-drop calc(520ms * var(--p)) var(--hatch) cubic-bezier(0.2, 0.7, 0.4, 1) forwards;
	}
	@keyframes sac-drop {
		0% {
			opacity: 1;
			transform: rotate(var(--a)) translateX(30px) scale(0.6);
		}
		70% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: rotate(var(--a)) translateX(92px) translateY(18px) scale(1);
		}
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
