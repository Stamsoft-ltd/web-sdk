<script lang="ts">
	import JellyDome from './JellyDome.svelte';

	// Super-bonus backdrop, Figma 11300:27276 (1200×670, 2026-10-29), cover-scaled like
	// BaseScene: the pink sunset dunes, three pink clouds swaying, and a blue jelly dome at the
	// board's foot that now and then pops and blows back up, and the candy tree (11376:74001) (SceneView's SuperWorld). Layers
	// from scripts/build-bonus-scene.py (blur baked in).
	const SKY = { w: 1200, h: 670 };
	const A = './bonus/super/hd';
	let vw = $state(1200);
	let vh = $state(670);
	let scale = $derived(Math.max(vw / SKY.w, vh / SKY.h) * 1.04);
	// [x, y, w, h, sway px, sway period ms]
	const CLOUDS = [
		[38, 31, 297, 99, 16, 27000],
		[600, 103, 297, 99, 12, 34000],
		[934, 26, 231, 77, 14, 23000],
	] as const;
	// 11300:27289 at (291, 441) 133 square; the webp keeps the build script's CROP (x 6-94%,
	// y 30-70% of the square).
	const D = { x: 291, y: 441, s: 133, foot: 0.914 };
	const DW = 0.88 * D.s;
	const DH = 0.4 * D.s;
	// The tree's candies as fairy lights, as SceneView's TREE_LIGHTS: [x, y, size] in the art's
	// px (1199 wide), the colour, and the light wave's delay from the candy's angle round the hub.
	const TREE_K = 331 / 1199;
	const TREE_WAVE_MS = 2600;
	const LIGHTS = (
		[
			[513, 106, 160, '#ffd84a'],
			[640, 216, 104, '#ffd84a'],
			[200, 474, 62, '#ffd84a'],
			[501, 550, 164, '#ffd84a'],
			[847, 518, 62, '#ffd84a'],
			[887, 694, 100, '#ffd84a'],
			[263, 303, 194, '#3ec8ff'],
			[832, 327, 108, '#3ec8ff'],
			[988, 489, 160, '#3ec8ff'],
			[344, 652, 104, '#3ec8ff'],
			[469, 270, 66, '#c46bff'],
			[131, 577, 108, '#c46bff'],
			[720, 602, 108, '#c46bff'],
		] as const
	).map(([x, y, size, c]) => {
		const turn = Math.atan2(y - 470, x - 560) / (Math.PI * 2);
		return { x: x * TREE_K, y: y * TREE_K, d: size * TREE_K * 4.2, c, delay: Math.round(((turn % 1) + 1) % 1 * TREE_WAVE_MS) };
	});
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} />

<div
	class="bonus-scene"
	style={`width:${SKY.w}px;height:${SKY.h}px;transform:translate(-50%,-50%) scale(${scale})`}
>
	<!-- The painting's box (12, -16, 1185×686) falls short of the frame's sides: scaled about its
	     centre to the frame's width. -->
	<img class="dunes" src={`${A}/dunes.webp`} alt="" />
	{#each CLOUDS as [x, y, w, h, sway, ms]}
		<img
			class="cloud"
			src="./bonus/normal/hd/cloud.webp"
			alt=""
			style={`left:${x}px;top:${y}px;width:${w}px;height:${h}px;--sway:${sway}px;animation-duration:${ms / 2}ms`}
		/>
	{/each}
	<!-- 11376:74001, the candy tree right of the board, its far side past the frame's edge. -->
	<div class="tree">
		<img src={`${A}/candy-tree.webp`} alt="" />
		{#each LIGHTS as l}<span
				class="light"
				style={`left:${l.x.toFixed(1)}px;top:${l.y.toFixed(1)}px;--d:${l.d.toFixed(1)}px;--c:${l.c};animation-delay:-${TREE_WAVE_MS - l.delay}ms`}
			></span>{/each}
	</div>
	<JellyDome
		src={`${A}/dome-blue.webp`}
		x={D.x + 0.06 * D.s}
		y={D.y + 0.3 * D.s}
		w={DW}
		h={DH}
		ox={DW / 2}
		oy={DH * D.foot}
		color="#3f7bff"
		shown
		first={[2000, 12000]}
		rest={[3000, 7000]}
		wait={[1500, 5000]}
	/>
</div>

<style>
	.bonus-scene {
		position: absolute;
		left: 50%;
		top: 50%;
		overflow: hidden;
		pointer-events: none;
	}
	.dunes {
		position: absolute;
		left: 0;
		top: -20px;
		width: 1200px;
		height: 694px;
	}
	.tree {
		position: absolute;
		left: 978px;
		top: 129px;
		width: 331px;
		height: 362px;
		/* Sways a touch from its trunk's foot (620, 1290 of the art). */
		transform-origin: 51.7% 98.3%;
		animation: tree-sway 8s ease-in-out infinite alternate;
	}
	.tree img {
		display: block;
		width: 100%;
		height: 100%;
	}
	/* A halo in the candy's colour round a hot core, brightening as the wave passes. */
	.light {
		position: absolute;
		width: var(--d);
		height: var(--d);
		margin: calc(var(--d) / -2) 0 0 calc(var(--d) / -2);
		border-radius: 50%;
		background: radial-gradient(
			circle,
			rgb(255 255 255 / 0.16) 0 10%,
			color-mix(in srgb, var(--c) 14%, transparent) 26%,
			color-mix(in srgb, var(--c) 6%, transparent) 38%,
			transparent 46%
		);
		mix-blend-mode: screen;
		opacity: 0.35;
		animation: tree-light 5.6s ease-in-out infinite;
	}
	@keyframes tree-sway {
		from {
			transform: rotate(-0.23deg);
		}
		to {
			transform: rotate(0.23deg);
		}
	}
	@keyframes tree-light {
		0%,
		100% {
			opacity: 0.75;
			transform: scale(1.03);
		}
		20%,
		80% {
			opacity: 0.3;
			transform: scale(0.97);
		}
	}
	.cloud {
		position: absolute;
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
		.cloud,
		.tree,
		.light {
			animation: none;
		}
	}
</style>
