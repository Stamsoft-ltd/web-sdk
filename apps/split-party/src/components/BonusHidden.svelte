<script lang="ts">
	import JellyDome from './JellyDome.svelte';

	// Hidden-bonus backdrop, Figma 11174:6525 (1200×670), cover-scaled like BonusNormal: the neon
	// blue cavern, its slime mounds and jelly domes, the floating jelly gem, the cyan glows and
	// the blue candy house (11381:76399) with a little smoke off its chimney.
	// The ?scene=dom twin of SceneView's HiddenWorld (keep the two in step).
	// Layers from scripts/build-bonus-scene.py (blur baked in).
	const SKY = { w: 1200, h: 670 };
	const A = './bonus/hidden/hd';
	let vw = $state(1200);
	let vh = $state(670);
	let scale = $derived(Math.max(vw / SKY.w, vh / SKY.h) * 1.04);

	const GLOWS = [
		[721, 258],
		[1094, 346],
		[780, 92],
		[320, 106],
		[134, 92],
		[150, 229],
		[965, 61],
	] as const;
	// [art, x, y, w, h] in the frame's order; the dome art's foot sits at 68% of its square.
	const FRONT = [
		['mound-a', -78, 274, 296, 296],
		['dome', 92, 335, 314, 314],
		['mound-b', -155, 324, 551, 551],
	] as const;
	const FOOT = 0.682;
	// SceneView's H_SMOKE: the crater smoke's cycle at 0.6 size, rising from behind the cap.
	const SMOKE_MS = 10000;
	const SMOKE_N = 10;
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} />

<div
	class="bonus-scene"
	style={`width:${SKY.w}px;height:${SKY.h}px;transform:translate(-50%,-50%) scale(${scale})`}
>
	<img class="cavern" src={`${A}/cavern.webp`} alt="" />
	<img class="part" src={`${A}/mound-a.webp`} alt="" style="left:-90px;top:178px;width:432px;height:432px" />
	{#each GLOWS as [x, y], i}
		<span class="glow" style={`left:${x}px;top:${y}px;animation-delay:${-i * 0.53}s`}></span>
	{/each}
	<img class="part gem" src={`${A}/gem.webp`} alt="" style="left:70px;top:258px;width:229px;height:305px" />
	{#each FRONT as [art, x, y, w, h]}
		{#if art === 'dome'}
			<JellyDome
				src={`${A}/dome.webp`}
				{x}
				{y}
				{w}
				{h}
				ox={w / 2}
				oy={h * FOOT}
				color="#ea32df"
				shown
				first={[2500, 14000]}
				rest={[3000, 7000]}
				wait={[9000, 24000]}
			/>
		{:else}
			<img class="part" src={`${A}/${art}.webp`} alt="" style={`left:${x}px;top:${y}px;width:${w}px;height:${h}px`} />
		{/if}
	{/each}
	<div class="smoke-at">
		{#each Array.from({ length: SMOKE_N }, (_, i) => i) as i}
			<span
				class="smoke"
				style={`animation-duration:${SMOKE_MS}ms;animation-delay:${((-i / SMOKE_N) * SMOKE_MS).toFixed(0)}ms`}
			></span>
		{/each}
	</div>
	<img class="part" src={`${A}/candy-house.webp`} alt="" style="left:965px;top:130px;width:457px;height:395px" />
</div>

<style>
	.bonus-scene {
		position: absolute;
		left: 50%;
		top: 50%;
		overflow: hidden;
		pointer-events: none;
	}
	.cavern {
		position: absolute;
		left: -40px;
		top: -14px;
		width: 1250px;
		height: 700px;
	}
	.part {
		position: absolute;
	}
	/* The frame's 16px #04DAFD glow (blur 2), twinkling. */
	.glow {
		position: absolute;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: radial-gradient(circle, #9ff3ff 0 34%, #04dafdcc 50%, #04dafd00 75%);
		animation: hidden-glow 2.8s ease-in-out infinite alternate;
	}
	.gem {
		animation: hidden-gem 2.2s ease-in-out infinite alternate;
	}
	@keyframes hidden-glow {
		from {
			opacity: 0.45;
			transform: scale(0.8);
		}
	}
	@keyframes hidden-gem {
		to {
			transform: translateY(-5px) rotate(1.4deg);
		}
	}
	/* BaseScene's crater smoke, scaled about its origin and tinted lavender for the cavern. */
	.smoke-at {
		position: absolute;
		left: 1112px;
		top: 176px;
		transform: scale(0.6);
		transform-origin: 0 0;
	}
	.smoke {
		position: absolute;
		left: -29px;
		top: -24.5px;
		width: 58px;
		height: 49px;
		background: radial-gradient(closest-side, #e6deff, #e6deff88 55%, #e6deff00);
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
	@media (prefers-reduced-motion: reduce) {
		.glow,
		.gem,
		.smoke {
			animation: none;
		}
	}
</style>
