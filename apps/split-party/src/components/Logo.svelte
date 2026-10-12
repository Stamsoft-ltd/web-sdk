<script lang="ts">
	// The Figma logo (11003:27691) as layers: the base art, its six side splashes cut out by
	// scripts/build-logo-layers.py so they can squash, and live eyes in the "O".
	import EYES from '../lib/eyes.json';
	import LAYERS from '../lib/logo-layers.json';
	import LiveEyes, { type Eye } from './LiveEyes.svelte';

	let { uid = 'logo' }: { uid?: string } = $props();
	const eyes = (EYES as Record<string, Eye[]>).LOGO ?? [];
	// A free dot flies out of the nearest anchored splash, so it starts at that anchor.
	const fly = (d: (typeof LAYERS.drops)[number]) => {
		if (d.anchored) return '';
		const cx = d.x + d.w / 2;
		const cy = d.y + d.h / 2;
		const from = LAYERS.drops
			.filter((o) => o.anchored)
			.reduce((a, o) => (Math.hypot(o.ax - cx, o.ay - cy) < Math.hypot(a.ax - cx, a.ay - cy) ? o : a));
		return `--fx:${(from.ax - cx).toFixed(2)}px;--fy:${(from.ay - cy).toFixed(2)}px;`;
	};
	// Left splashes burst first, the right side answers; each drop trails the one before.
	const delay = (i: number, d: (typeof LAYERS.drops)[number]) =>
		(d.ax > LAYERS.width / 2 ? 0.5 : 0) + (i % 3) * 0.07 + (d.anchored ? 0 : 0.08);
</script>

<svg viewBox={`0 0 ${LAYERS.width} ${LAYERS.height}`} role="img" aria-label="Blob Split">
	<image href="/splash/logo-base.webp" width={LAYERS.width} height={LAYERS.height} />
	{#each LAYERS.drops as d, i}
		<g
			class="drop"
			class:dot={!d.anchored}
			style={`transform-origin:${d.ax}px ${d.ay}px;${fly(d)}animation-delay:${delay(i, d).toFixed(2)}s`}
		>
			<image href={d.src} x={d.x} y={d.y} width={d.w} height={d.h} preserveAspectRatio="none" />
		</g>
	{/each}
	<LiveEyes {eyes} id={uid} lookDelay="-1.2s" blinkDelay="-2.8s" rim={1.4} />
</svg>

<style>
	svg {
		display: block;
		width: 100%;
		height: 100%;
		overflow: visible;
	}
	/* Splat: every 4s each splash is flung out of the letters, overshoots and wobbles to
	   rest, then gets sucked back in just before the next splat. Dots fly out of the splash
	   they belong to. */
	.drop {
		animation: drop-splat 4s cubic-bezier(0.3, 0.7, 0.4, 1) infinite both;
	}
	.drop.dot {
		animation-name: dot-splat;
	}
	@keyframes drop-splat {
		0% {
			transform: scale(0.12, 0.3);
		}
		6% {
			transform: scale(1.24, 1.08);
		}
		11% {
			transform: scale(0.9, 1.08);
		}
		17% {
			transform: scale(1.06, 0.95);
		}
		24%,
		86% {
			transform: none;
		}
		93% {
			transform: scale(1.08, 0.86);
		}
		100% {
			transform: scale(0.12, 0.3);
		}
	}
	@keyframes dot-splat {
		0% {
			transform: translate(var(--fx), var(--fy)) scale(0);
		}
		7% {
			transform: translate(calc(var(--fx) * -0.12), calc(var(--fy) * -0.12)) scale(1.3, 0.75);
		}
		13% {
			transform: scale(0.85, 1.2);
		}
		20% {
			transform: scale(1.05, 0.96);
		}
		26%,
		86% {
			transform: none;
		}
		100% {
			transform: translate(var(--fx), var(--fy)) scale(0);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.drop {
			animation: none;
		}
	}
</style>
