<script lang="ts">
	// The Figma logo (11003:27691) as layers: the base art, its six side splashes cut out by
	// scripts/build-logo-layers.py so they can squash, and live eyes in the "O" with a smile
	// and blush (lib/logoFace.ts). On a win (`cheer`) it jelly-bounces and the O squints ^^
	// with an open grin (scene/LogoView.ts does the same in Pixi).
	import EYES from '../lib/eyes.json';
	import LAYERS from '../lib/logo-layers.json';
	import { FACE, grinPath, smilePath } from '../lib/logoFace';
	import LiveEyes, { type Eye } from './LiveEyes.svelte';

	let {
		uid = 'logo',
		gaze = null,
		cheer = false,
		beat = 0,
	}: { uid?: string; gaze?: { x: number; y: number } | null; cheer?: boolean; beat?: number } = $props();
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

<svg viewBox={`0 0 ${LAYERS.width} ${LAYERS.height}`} role="img" aria-label="Blob Split" class:cheer>
	<!-- Keyed on the win beat: every new win remounts it, restarting the bounce and splashes. -->
	{#key cheer ? beat : -1}
	<g class="jelly" style={`transform-origin:${LAYERS.width / 2}px ${LAYERS.height}px`}>
	<image href="./splash/logo-base.webp" width={LAYERS.width} height={LAYERS.height} />
	{#each LAYERS.drops as d, i}
		<g
			class="drop"
			class:dot={!d.anchored}
			style={`transform-origin:${d.ax}px ${d.ay}px;${fly(d)}animation-delay:${delay(i, d).toFixed(2)}s`}
		>
			<image href={d.src} x={d.x} y={d.y} width={d.w} height={d.h} preserveAspectRatio="none" />
		</g>
	{/each}
	<LiveEyes {eyes} id={uid} lookDelay="-1.2s" blinkDelay="-2.8s" rim={1.4} {gaze} joy={cheer} />
	<g transform={`translate(${FACE.x} ${FACE.y}) rotate(${FACE.deg})`}>
		{#each [-1, 1] as side}<ellipse
				cx={side * FACE.blush.dx}
				cy={FACE.blush.dy}
				rx={FACE.blush.rx}
				ry={FACE.blush.ry}
				fill={FACE.blush.color}
				fill-opacity={FACE.blush.alpha}
			/>{/each}
		{#if cheer}
			<g class="grin">
				<path d={grinPath()} fill={FACE.grin.fill} stroke={FACE.ink} stroke-width="0.45" stroke-linejoin="round" />
				<ellipse cy={FACE.grin.depth * 0.62} rx={FACE.grin.w * 0.47} ry={FACE.grin.depth * 0.18} fill={FACE.grin.tongue} />
			</g>
		{:else}
			<path d={smilePath()} fill="none" stroke={FACE.ink} stroke-width={FACE.smile.width} stroke-linecap="round" />
		{/if}
	</g>
	</g>
	{/key}
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
	/* The same splat under another name, so adding .cheer restarts it. */
	@keyframes drop-splat-win {
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

	/* The same splat under another name, so adding .cheer restarts it. */
	@keyframes dot-splat-win {
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
	/* A win: one jelly bounce about the bottom centre, the splashes fling out at once (their
	   loop restarts with the class), the eyes squint ^^ and the grin pops open. */
	/* After the bounce, while the win stays on show: a smaller hop every 0.9s, ^^ in the air
	   and open-eyed on the ground (scene/LogoView.ts HOP). */
	/* At rest: a gentle breath (scene/LogoView.ts BREATH). */
	.jelly {
		animation: logo-breathe 3.6s ease-in-out infinite;
	}
	@keyframes logo-breathe {
		0%,
		100% {
			transform: none;
		}
		40%,
		50% {
			transform: translateY(-0.2px) scale(0.992, 1.022);
		}
		78% {
			transform: scale(1.006, 0.993);
		}
	}
	.cheer .jelly {
		animation:
			logo-bounce 0.9s ease-in-out both,
			logo-hop 0.9s ease-in-out 0.9s infinite;
	}
	.cheer :global(.joy) {
		animation: logo-joy 0.9s 0.9s infinite;
	}
	.cheer .grin {
		animation:
			grin-open 0.2s ease-out both,
			grin-laugh 0.9s ease-in-out 0.9s infinite;
	}
	@keyframes logo-hop {
		0%,
		100% {
			transform: none;
		}
		18% {
			transform: scale(1.045, 0.94);
		}
		45% {
			transform: translateY(-1.6px) scale(0.97, 1.05);
		}
		72% {
			transform: scale(1.025, 0.975);
		}
	}
	@keyframes logo-joy {
		0%,
		24%,
		81%,
		100% {
			transform: scaleY(0);
		}
		25%,
		80% {
			transform: none;
		}
	}
	@keyframes grin-laugh {
		0%,
		100% {
			transform: none;
		}
		50% {
			transform: scaleY(1.18);
		}
	}
	.cheer .drop {
		animation-name: drop-splat-win;
		animation-delay: 0s !important;
	}
	.cheer .drop.dot {
		animation-name: dot-splat-win;
	}
	.cheer :global(.joy) {
		transform: none;
	}
	.cheer :global(.lid) {
		animation: none;
	}
	.grin {
		animation: grin-open 0.2s ease-out both;
	}
	@keyframes grin-open {
		from {
			transform: scaleY(0.4);
		}
	}
	@keyframes logo-bounce {
		0%,
		100% {
			transform: none;
		}
		14% {
			transform: scale(1.07, 0.9);
		}
		34% {
			transform: translateY(-2.6px) scale(0.95, 1.08);
		}
		54% {
			transform: scale(1.04, 0.96);
		}
		74% {
			transform: translateY(-0.4px) scale(0.99, 1.02);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.drop,
		.jelly,
		.cheer .jelly,
		.cheer .grin,
		.grin {
			animation: none;
		}
		.cheer :global(.joy) {
			animation: none;
		}
	}
</style>
