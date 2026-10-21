<script module lang="ts">
	type Dome = { src: string; color: string; x: number; y: number; w: number; h: number; foot: number };
	// Domes start blown up, and now and then burst and blow back up.
	const dome = (d: Dome) => ({
		src: d.src,
		color: d.color,
		x: d.x,
		y: d.y,
		w: d.w,
		h: d.h,
		ox: d.w / 2,
		oy: d.h * d.foot,
		shown: true,
		first: [2000, 12000] as [number, number],
		rest: [3000, 7000] as [number, number],
		wait: [1500, 5000] as [number, number],
	});
</script>

<script lang="ts">
	import JellyDome from './JellyDome.svelte';
	import SkyClouds from './SkyClouds.svelte';

	// Super-bonus backdrop, Figma 11174:5079 (1200×670), cover-scaled like BaseScene: the sunset
	// arches over calm water, two melting jelly islands flying slowly, the pink sheens on the
	// water (11174:5084) drifting and breathing, wave bands rolling in and light ripples across
	// the whole surface so the water lives, the
	// jelly domes popping and blowing back up, and the pink clouds drifting.
	// Layers from scripts/build-bonus-scene.py (blur baked in).
	// `night` is the Hidden tier's world: the same water at night, under a moon and stars.
	let { night = false }: { night?: boolean } = $props();
	const SKY = { w: 1200, h: 670 };
	const A = './bonus/super/crisp';
	let vw = $state(1200);
	let vh = $state(670);
	let scale = $derived(Math.max(vw / SKY.w, vh / SKY.h) * 1.04);

	// The frame's clouds: 171-297px wide at y 18-194, all at 60%.
	const NEAR = { src: './bonus/normal/crisp/cloud-puff.webp', w: [150, 185] as [number, number], alpha: [0.85, 0.85] as [number, number] };
	const FAR = { src: './bonus/normal/crisp/cloud-puff.webp', w: [100, 125] as [number, number], alpha: [0.65, 0.75] as [number, number] };
	const CLOUD_LANES = [
		{ far: true, y: [14, 26] as [number, number] },
		{ far: false, y: [98, 112] as [number, number] },
		{ far: true, y: [188, 200] as [number, number] },
	];

	// Islands [x, y, size, phase s]: each bobs and sways on its own clock.
	const ISLANDS = [
		[154, 43, 142, 0],
		[993, 103, 142, -5.5],
	] as const;
	// Water sheens [x, y, w, h, small art, phase s].
	const WATER = [
		[489, 469, 675, 289, false, 0],
		[124, 523, 343, 147, true, -4],
	] as const;

	// Dome boxes [colour, x, y, size]; webps cropped to x 6-94%, y 30-70% of the square.
	const DOME_SCALE = 0.5;
	const FOOT = { blue: 0.914, purple: 0.953, magenta: 0.951 };
	const COLOR = { blue: '#3f7bff', purple: '#9b3dfb', magenta: '#ea32df' };
	const DOMES = (
		[
			['purple', -84, 252, 318],
			['magenta', 278, 366, 172],
			['blue', -178, 315, 563],
			['blue', 827, 195, 563],
		] as const
	).map(([c, fx, fy, fs]) => {
		// Half the frame's size, standing on the same spot (the foot's centre stays put).
		const s = fs * DOME_SCALE;
		const x = fx + fs / 2 - s / 2;
		const y = fy + fs * (0.3 + 0.4 * FOOT[c]) - s * (0.3 + 0.4 * FOOT[c]);
		return {
			src: `${A}/dome-${c}.webp`,
			color: COLOR[c],
			x: x + 0.06 * s,
			y: y + 0.3 * s,
			w: 0.88 * s,
			h: 0.4 * s,
			foot: FOOT[c],
		};
	});

	// Ripples on the water (the surface starts at y ~448, the frame ends at 676): light streaks
	// across the whole surface that drift and swell, small and quick near the horizon, longer,
	// brighter and slower toward the viewer (d = depth 0..1).
	// Stars over the upper sky [x, y, size, twinkle s, phase s], seeded so they never move.
	const STARS = Array.from({ length: 38 }, (_, i) => {
		const h = Math.imul(i + 7, 2246822519) >>> 0;
		return [
			(h % 1000) * 1.2,
			((h >>> 10) % 1000) * 0.3,
			1.5 + ((h >>> 20) % 4) * 0.8,
			2 + ((h >>> 5) % 30) / 10,
			-(((h >>> 15) % 40) / 10),
		] as const;
	});

	const RIPPLES = Array.from({ length: 46 }, (_, i) => {
		const h = Math.imul(i + 1, 2654435761) >>> 0;
		const d = (((h >>> 10) % 1000) / 1000) ** 0.8;
		return {
			x: -20 + ((h % 1000) / 1000) * 1200,
			y: 452 + d * 214,
			w: 14 + d * 70 + ((h >>> 17) % 20),
			hgt: 1.5 + d * 3,
			drift: 8 + d * 34,
			alpha: 0.35 + d * 0.5,
			dur: 3 + d * 3 + ((h >>> 5) % 9) * 0.25,
			delay: -(((h >>> 13) % 60) / 10),
		};
	});
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} />

<div
	class="bonus-scene"
	style={`width:${SKY.w}px;height:${SKY.h}px;transform:translate(-50%,-50%) scale(${scale})`}
>
	<img class="arches" src={`${A}/arches.webp`} alt="" />
	{#each DOMES.slice(0, 2) as d}
		<JellyDome {...dome(d)} />
	{/each}
	{#each ISLANDS as [x, y, s, phase]}
		<div class="island" style={`left:${x}px;top:${y}px;width:${s}px;height:${s}px;--t:${phase}s`}>
			<img src={`${A}/island.webp`} alt="" />
		</div>
	{/each}
	{#each WATER as [x, y, w, h, small, phase]}
		<img
			class="water"
			src={`${A}/water${small ? '-small' : ''}.webp`}
			alt=""
			style={`left:${x}px;top:${y}px;width:${w}px;height:${h}px;--t:${phase}s`}
		/>
	{/each}
	<!-- Soft wave bands rolling toward the viewer, under the ripples. -->
	<div class="swell"><div></div><div class="far"></div></div>
	{#each RIPPLES as r}
		<span
			class="ripple"
			style={`left:${r.x.toFixed(0)}px;top:${r.y.toFixed(0)}px;width:${r.w.toFixed(0)}px;height:${r.hgt.toFixed(1)}px;--drift:${r.drift.toFixed(0)}px;--a:${r.alpha.toFixed(2)};animation-duration:${r.dur.toFixed(2)}s;animation-delay:${r.delay.toFixed(2)}s`}
		></span>
	{/each}
	{#each DOMES.slice(2) as d}
		<JellyDome {...dome(d)} />
	{/each}
	{#if night}
		<div class="night"></div>
		<div class="moon"></div>
		{#each STARS as [x, y, size, dur, phase]}
			<span
				class="star"
				style={`left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;width:${size}px;height:${size}px;animation-duration:${dur}s;animation-delay:${phase}s`}
			></span>
		{/each}
	{/if}
	<SkyClouds lanes={CLOUD_LANES} width={SKY.w} near={NEAR} far={FAR} />
</div>

<style>
	.bonus-scene {
		position: absolute;
		left: 50%;
		top: 50%;
		overflow: hidden;
		pointer-events: none;
	}
	.arches {
		position: absolute;
		left: 0;
		top: 0;
		width: 1202px;
		height: 676px;
	}
	/* Flying slowly: a long sway across and a shorter bob with a little tilt, out of step. */
	.island {
		position: absolute;
		animation: island-sway 17s ease-in-out var(--t) infinite;
	}
	.island img {
		display: block;
		width: 100%;
		height: 100%;
		animation: island-bob 6.5s ease-in-out var(--t) infinite;
	}
	@keyframes island-sway {
		0%,
		100% {
			transform: translateX(-16px);
		}
		50% {
			transform: translateX(16px);
		}
	}
	@keyframes island-bob {
		0%,
		100% {
			transform: translateY(0) rotate(-2deg);
		}
		50% {
			transform: translateY(-11px) rotate(2.5deg);
		}
	}
	/* The sheens drift and stretch like light on a slow swell, brightening as they spread. */
	.water {
		position: absolute;
		transform-origin: 50% 50%;
		animation: water-swell 7s ease-in-out var(--t) infinite;
	}
	@keyframes water-swell {
		0%,
		100% {
			opacity: 0.75;
			transform: translateX(-26px) scale(0.94, 1.03);
		}
		50% {
			opacity: 1;
			transform: translateX(26px) scale(1.08, 0.92);
		}
	}
	/* Each set of bands moves down one spacing per cycle so the roll loops seamlessly; faded
	   in under the horizon. Transform only: no repaint. */
	.swell {
		position: absolute;
		left: 0;
		top: 448px;
		width: 1200px;
		height: 228px;
		overflow: hidden;
		mask: linear-gradient(#0000, #000 35%);
		opacity: 0.45;
	}
	/* Two sets of soft bands at different spacings and speeds, so their sum never reads as a
	   regular grid of lines. */
	.swell div {
		position: absolute;
		inset: -22px 0 0;
		background: repeating-linear-gradient(#fff0 0 8px, #ffffff30 14px, #fff0 22px);
		animation: swell-roll 3.4s linear infinite;
	}
	.swell div.far {
		inset: -31px 0 0;
		background: repeating-linear-gradient(#fff0 0 12px, #ffffff22 20px, #fff0 31px);
		animation: swell-roll-far 6.1s linear infinite;
	}
	@keyframes swell-roll {
		to {
			transform: translateY(22px);
		}
	}
	@keyframes swell-roll-far {
		to {
			transform: translateY(31px);
		}
	}
	.ripple {
		position: absolute;
		border-radius: 50%;
		background: radial-gradient(closest-side, #fff, #fff8 55%, #fff0);
		opacity: 0;
		animation: ripple ease-in-out infinite;
	}
	@keyframes ripple {
		0%,
		100% {
			opacity: 0;
			transform: translateX(calc(var(--drift) * -1)) scaleX(0.35);
		}
		40% {
			opacity: var(--a);
			transform: translateX(0) scaleX(1);
		}
		65% {
			opacity: calc(var(--a) * 0.6);
			transform: translateX(calc(var(--drift) * 0.6)) scaleX(0.85);
		}
	}
	/* Night: a flat indigo wash, darkest at the top, so the sunset reads as moonlight. Static,
	   no blend mode or filter, so it costs one composited layer. */
	.night {
		position: absolute;
		inset: 0;
		background: linear-gradient(#0b0630e6, #1b0f55b3 55%, #120a3ccc);
	}
	.moon {
		position: absolute;
		left: 560px;
		top: 52px;
		width: 74px;
		height: 74px;
		border-radius: 50%;
		background: radial-gradient(circle at 38% 36%, #fffbe8, #f3e7b8 60%, #d9c98f);
		box-shadow: 0 0 40px 14px #fff4c455;
	}
	.star {
		position: absolute;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 0 6px 1px #ffffffaa;
		animation: twinkle ease-in-out infinite alternate;
	}
	@keyframes twinkle {
		from {
			opacity: 0.25;
			transform: scale(0.6);
		}
		to {
			opacity: 1;
			transform: scale(1.1);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.star {
			animation: none;
		}
		.island,
		.island img,
		.water {
			animation: none;
		}
		.swell div {
			animation: none;
		}
		.ripple {
			animation: none;
			opacity: 0.3;
		}
	}
</style>
