<script lang="ts">
	import { runtime } from '../game/playback.svelte';
	import { t } from '../i18n';
	import TempleAtmosphere from './TempleAtmosphere.svelte';
	let { rewardText }: { rewardText: string } = $props();
	const skin = $derived(runtime.game.tier ?? 'base');
</script>

<!-- Background, sculpted jambs and generated OPEN interior share one coordinate
     system with the approved closed leaves. Never move/scale a door separately. -->
<div class="temple-scene" data-scene={skin}>
	<div class="temple-world">
		<img class="scene-art" src={`./assets/the-gates/scene-${skin}.png`} alt="" />
		<TempleAtmosphere {skin} />
		<div
			class="temple-gate"
			data-skin={skin}
			class:open={runtime.game.gateOpen}
			style="--gate-art:url('./assets/the-gates/gate-doors.png')"
			role="img"
			aria-label={`${t('GATE')} · ${t(skin === 'base' ? 'BASE' : skin.toUpperCase())}${rewardText ? ` · ${rewardText}` : ''}`}
		>
			<div class="gate-leaf leaf-left" aria-hidden="true">
				<div class="door-front"><div class="door-texture"></div></div>
				<div class="door-back"></div>
				<div class="door-edge"></div>
				<div class="door-top"></div>
			</div>
			<div class="gate-leaf leaf-right" aria-hidden="true">
				<div class="door-front"><div class="door-texture"></div></div>
				<div class="door-back"></div>
				<div class="door-edge"></div>
				<div class="door-top"></div>
			</div>
			<div class="gate-cast-shadow" aria-hidden="true"></div>
			{#if runtime.game.reward}
				{#key `${runtime.game.spinId}-${runtime.game.gate}-${runtime.game.rewardOrder}`}
					<div class="gate-reward" aria-hidden="true">
						<span>{t('REWARD')} {runtime.game.rewardOrder}/{runtime.game.rewardCount}</span>
						<strong>{rewardText}</strong>
					</div>
				{/key}
			{/if}
		</div>
	</div>
</div>

<style>
	.temple-scene {
		position: absolute;
		inset: 0;
		z-index: -2;
		overflow: hidden;
		pointer-events: none;
	}
	.temple-world {
		position: absolute;
		inset: 0;
	}
	.scene-art {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: fill;
	}
	.temple-gate {
		/* Common 1536 × 1024 source registration: inner jamb x1130..1340,
		   y213..700. Each generated variant preserves these architectural bounds. */
		position: absolute;
		left: 73.5677%;
		top: 20.8008%;
		width: 13.6719%;
		height: 47.5586%;
		perspective: 650px;
		--door-x: 0%;
		--door-y: 0%;
		--door-scale: 206%;
	}
	.temple-gate[data-skin='normal'] {
		--door-x: 100%;
	}
	.temple-gate[data-skin='super'] {
		--door-y: 100%;
		--door-scale: 195%;
	}
	.temple-gate[data-skin='hidden'] {
		--door-x: 100%;
		--door-y: 100%;
		--door-scale: 195%;
	}

	.gate-leaf {
		position: absolute;
		inset-block: 0;
		width: 50.05%;
		--thickness: clamp(8px, 1.7vw, 24px);
		transform-style: preserve-3d;
		transition: transform 1100ms cubic-bezier(0.65, 0, 0.2, 1);
		z-index: 1;
	}
	.leaf-left {
		left: 0;
		transform-origin: left center;
	}
	.leaf-right {
		right: 0;
		transform-origin: right center;
	}
	.door-front,
	.door-back {
		position: absolute;
		inset: 0;
		backface-visibility: hidden;
	}
	.door-front {
		overflow: hidden;
		box-shadow: inset 0 0 8px #0009;
	}
	.door-front::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(90deg, #0009, transparent 35%, #000c);
		opacity: 0.15;
		transition: opacity 1100ms;
	}
	.door-back {
		transform: translateZ(calc(-1 * var(--thickness))) rotateY(180deg);
		background: repeating-linear-gradient(0deg, #293029 0 20%, #75613a 20% 22%, #202b29 22% 25%);
		border: 4px ridge #6e5736;
	}
	.door-edge {
		position: absolute;
		inset-block: 0;
		width: var(--thickness);
		transform-origin: left;
		transform: rotateY(90deg);
		background: linear-gradient(90deg, #d7bb77, #76613b 20%, #2b3029 80%, #a98c50);
		box-shadow: inset 0 0 0 2px #322918;
	}
	.leaf-left .door-edge {
		left: 100%;
	}
	.leaf-right .door-edge {
		left: 0;
	}
	.door-top {
		position: absolute;
		top: 0;
		width: 100%;
		height: var(--thickness);
		transform-origin: top;
		transform: rotateX(-90deg);
		background: #887345;
	}
	.door-texture {
		position: absolute;
		inset-block: 0;
		width: 200%;
		background: var(--gate-art) var(--door-x) var(--door-y) / 200% var(--door-scale);
	}
	.leaf-left .door-texture {
		left: 0;
	}
	.leaf-right .door-texture {
		right: 0;
	}
	.open .leaf-left {
		transform: translateZ(-4px) rotateY(74deg);
	}
	.open .leaf-right {
		transform: translateZ(-4px) rotateY(-74deg);
	}
	.open .door-front::after {
		opacity: 0.8;
	}
	.gate-cast-shadow {
		position: absolute;
		inset: 0;
		box-shadow: inset 0 0 35px 15px #000d;
		opacity: 0.85;
		transition: opacity 1100ms;
		pointer-events: none;
	}
	.open .gate-cast-shadow {
		opacity: 0.25;
	}
	.gate-reward {
		position: absolute;
		z-index: 2;
		inset: 0 -8%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		gap: 12px;
		text-shadow:
			0 2px 5px #000,
			0 0 18px #000,
			0 0 30px #000;
		animation: reward-in 220ms both;
	}
	.gate-reward span {
		font-size: 10px;
		letter-spacing: 1px;
	}
	.gate-reward strong {
		font: 700 clamp(18px, 2.3vw, 34px) / 1.2 var(--serif);
		color: #fff7d4;
	}
	@media (max-width: 800px) and (min-height: 501px) {
		/* Crop the SAME world, with the SAME registration; never float a frame
		   above another background. The lower architecture fades beneath board. */
		.temple-world {
			inset: 35px auto auto calc(100% - 125px - 112.56vw);
			width: 140vw;
			height: 440px;
		}
		.scene-art {
			mask-image: linear-gradient(#000 86%, transparent);
		}
	}
	@media (max-width: 620px) {
		.temple-world {
			inset: 45px auto auto calc(100% - 58px - 120.6vw);
			width: 150vw;
			height: 330px;
		}
		.gate-reward {
			gap: 6px;
		}
		.gate-reward span {
			font-size: 8px;
			letter-spacing: 0;
		}
		.gate-reward strong {
			font-size: 19px;
		}
	}
	@media (max-width: 620px) and (max-height: 700px) {
		.temple-world {
			top: 15px;
			height: 210px;
			left: calc(100% - 45px - 120.6vw);
		}
		.gate-reward span {
			font-size: 7px;
		}
		.gate-reward strong {
			font-size: 16px;
		}
	}
</style>
